/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Operational Ingestion API — Manual Official PDF Upload
 * POST /api/ops/ingestion/upload
 *
 * Receives manual PDF file upload (multipart/form-data or JSON with base64 buffer),
 * performs narrow `%PDF-` validation, computes SHA-256, resolves prize scheme,
 * enforces single-flight concurrency lock, persists to immutable Cloud Storage & Firestore,
 * executes promotion into the Research/DEV corpus, and writes durable audit run records.
 *
 * PROD mutations are strictly forbidden and rejected with 403 Forbidden.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  DailyIngestionEngine,
  type InjectedCandidate,
  resolveCanonicalAndResponseFilename
} from "@kerala-lottery/service-ingestion";
import {
  computeSha256,
  validatePdfBuffer,
  DocumentValidationError,
  DEFAULT_MAX_UPLOAD_BYTES
} from "@kerala-lottery/documents";
import {
  verifyOpsAuthorization,
  validateOpsEnvironment,
  withOpsSingleFlightLock,
  getOpsRunRepository,
  getOpsIngestionCloudDependenciesForTesting,
  buildOpsSourceIngestionService
} from "../../../../../lib/ops-guard";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // 1. Caller Authorization Verification
  const auth = verifyOpsAuthorization(req);
  if (!auth.authorized) {
    return auth.errorResponse!;
  }

  try {
    let fileName = "uploaded-result.pdf";
    let fileBuffer: Uint8Array | undefined;
    let envRequested = "DEV";
    let explicitConfirm: boolean | undefined;
    let drawDate: string | undefined;
    let drawNumber: string | undefined;
    let lotteryCode: string | undefined;
    let title: string | undefined;

    const contentType = req.headers.get("content-type") || "";

    // 2. Parse Multipart FormData or JSON
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json(
          {
            error: "BAD_REQUEST",
            code: "MISSING_FILE",
            message: "Missing 'file' field in multipart form data upload.",
            statusCode: 400
          },
          { status: 400 }
        );
      }
      fileName = file.name || "uploaded-result.pdf";
      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = new Uint8Array(arrayBuffer);

      const envField = formData.get("environment");
      if (typeof envField === "string") {
        envRequested = envField;
      }
      const confirmField = formData.get("confirm");
      if (typeof confirmField === "string") {
        explicitConfirm = confirmField.toLowerCase() === "true";
      }
      if (typeof formData.get("drawDate") === "string") drawDate = formData.get("drawDate") as string;
      if (typeof formData.get("drawNumber") === "string") drawNumber = formData.get("drawNumber") as string;
      if (typeof formData.get("lotteryCode") === "string") lotteryCode = formData.get("lotteryCode") as string;
      if (typeof formData.get("title") === "string") title = formData.get("title") as string;
    } else {
      const body = await req.json();
      fileName = body.fileName || "uploaded-result.pdf";
      envRequested = body.environment || "DEV";
      if (typeof body.confirm === "boolean") {
        explicitConfirm = body.confirm;
      }
      drawDate = body.drawDate;
      drawNumber = body.drawNumber;
      lotteryCode = body.lotteryCode;
      title = body.title;

      if (body.fileBase64) {
        const cleanBase64 = body.fileBase64.replace(/^data:[^;]+;base64,/, "");
        fileBuffer = new Uint8Array(Buffer.from(cleanBase64, "base64"));
      } else if (body.fileBuffer) {
        fileBuffer = new Uint8Array(body.fileBuffer);
      }
    }

    // 3. Environment Mutation Safety Guard
    const envCheck = validateOpsEnvironment(envRequested, true);
    if (!envCheck.allowed) {
      return envCheck.errorResponse!;
    }
    const environment = envCheck.environment; // Guaranteed "DEV"

    // 3b. Explicit Operator Confirmation Check
    if (explicitConfirm === false) {
      return NextResponse.json(
        {
          error: "CONFIRMATION_REQUIRED",
          code: "CONFIRMATION_REQUIRED",
          message: "Explicit operator confirmation (confirm: true) is required before ingesting a document into DEV.",
          statusCode: 400
        },
        { status: 400 }
      );
    }

    if (!fileBuffer) {
      return NextResponse.json(
        {
          error: "BAD_REQUEST",
          code: "MISSING_PDF",
          message: "Missing PDF file buffer.",
          statusCode: 400
        },
        { status: 400 }
      );
    }

    // 4. Narrow PDF Format, Size (<= 10 MB), and Non-Truncated EOF Validation
    try {
      validatePdfBuffer(fileBuffer, {
        maxBytes: DEFAULT_MAX_UPLOAD_BYTES,
        requireEofMarker: true
      });
    } catch (valErr: unknown) {
      const code = valErr instanceof DocumentValidationError ? valErr.code : "INVALID_PDF";
      const status = code === "FILE_TOO_LARGE" ? 413 : 400;
      const errorName =
        code === "FILE_TOO_LARGE"
          ? "FILE_TOO_LARGE"
          : code === "TRUNCATED_PDF"
            ? "TRUNCATED_PDF"
            : "INVALID_PDF";
      const msg = valErr instanceof DocumentValidationError ? valErr.message : "Uploaded file is not a valid PDF.";
      return NextResponse.json(
        {
          error: errorName,
          code,
          message: `PDF Validation Failed: ${msg}`,
          statusCode: status
        },
        { status }
      );
    }

    // 5. Deterministic SHA-256 Calculation
    const sha256 = computeSha256(fileBuffer);
    const runId = `run_ops_upload_${new Date().toISOString().replace(/[:.]/g, "-")}_${Math.random().toString(36).substring(2, 8)}`;

    const resolved = resolveCanonicalAndResponseFilename(fileName, sha256, undefined, undefined, undefined, {
      candidateDrawNumber: drawNumber
    });

    const candidate: InjectedCandidate = {
      fileName,
      canonicalFilename: resolved.canonicalFilename,
      sourceResponseFilename: resolved.sourceResponseFilename,
      fileBuffer,
      drawDate,
      drawNumber,
      lotteryCode,
      title
    };

    const testDeps = getOpsIngestionCloudDependenciesForTesting();

    // 6. Single-Flight Concurrency Lease Guard
    const lockResult = await withOpsSingleFlightLock(runId, environment, async () => {
      // Fail-closed Firebase check & authoritative cloud persistence service
      const sourceIngestionService = buildOpsSourceIngestionService({ allowOptional: false })!;

      // Execute daily ingestion pipeline
      const engine = new DailyIngestionEngine({
        dryRun: false,
        silent: true,
        limit: 1,
        runId,
        injectedCandidates: [candidate],
        sourceIngestionService,
        environment,
        cacheDir: testDeps?.cacheDir,
        sourceDir: testDeps?.sourceDir
      });

      const result = await engine.execute();
      const auditRecord = result.candidates[0] || null;

      const cloudStoragePath = `source-documents/${sha256}.pdf`;
      const firestoreDocumentId = sha256;

      // Persist operational audit run record
      const runRepo = getOpsRunRepository();
      await runRepo.createRun({
        runId,
        environment,
        trigger: "MANUAL",
        dryRun: false,
        status: result.success ? "SUCCEEDED" : "FAILED",
        requestedAt: result.startedAt,
        startedAt: result.startedAt,
        completedAt: result.completedAt,
        candidateCount: 1,
        alreadyKnownCount: result.alreadyIngested,
        downloadedCount: 1,
        validatedCount: result.summary.validated,
        ingestedCount: result.newDocuments,
        promotedCount: result.newDraws.length > 0 ? 1 : 0,
        rejectedCount: result.summary.rejected,
        errorCount: result.invalidDocuments,
        conflictCount: result.summary.conflicts,
        candidates: result.candidates,
        failureReason: auditRecord?.conflictDetails || auditRecord?.errorDetails,
        metadata: {
          audit: {
            schedulerState: "PAUSED",
            singleFlightLock: "IDLE",
            zeroSecretsExposed: true
          },
          sha256,
          fileSize: fileBuffer!.byteLength,
          canonicalFilename: auditRecord?.canonicalFilename || resolved.canonicalFilename,
          sourceResponseFilename: auditRecord?.sourceResponseFilename || resolved.sourceResponseFilename,
          drawNumber: auditRecord?.drawNumber,
          lottery: auditRecord?.lottery,
          cloudStoragePath,
          firestoreDocumentId
        }
      });

      return {
        runId,
        environment,
        success: result.success,
        validationStatus: auditRecord?.validationStatus || "UNKNOWN",
        actionTaken: auditRecord?.actionTaken || "UNKNOWN",
        conflictDetails: auditRecord?.conflictDetails,
        errorDetails: auditRecord?.errorDetails,
        candidateCount: 1,
        alreadyKnown: result.alreadyIngested,
        newDocuments: result.newDocuments,
        validated: result.summary.validated,
        ingested: result.newDocuments,
        promoted: result.newDraws.length > 0 ? 1 : 0,
        rejected: result.summary.rejected,
        conflicts: result.summary.conflicts,
        errors: result.summary.errors,
        sha256,
        fileSize: fileBuffer!.byteLength,
        canonicalFilename: auditRecord?.canonicalFilename || resolved.canonicalFilename,
        sourceResponseFilename: auditRecord?.sourceResponseFilename || resolved.sourceResponseFilename,
        drawIdentity: {
          lottery: auditRecord?.lottery || "Unknown",
          drawNumber: auditRecord?.drawNumber || "Unknown",
          drawDate: auditRecord?.drawDate || "Unknown"
        },
        scheme: {
          schemeId: auditRecord?.schemeId,
          schemeAuthorityLevel: auditRecord?.schemeAuthorityLevel
        },
        resultCount: auditRecord?.resultCount || (result.corpus ? result.corpus.results : 0),
        fullTicketCount: auditRecord?.fullTicketCount ?? (result.corpus ? result.corpus.fullTicket : 0),
        suffixCount: auditRecord?.suffixCount ?? (result.corpus ? result.corpus.suffix : 0),
        prizeTierSummary: auditRecord?.prizeTierSummary || [],
        leadingZeroCount: auditRecord?.leadingZeroCount ?? 0,
        sampleLeadingZeroNumbers: auditRecord?.sampleLeadingZeroNumbers || [],
        cloudStoragePath,
        firestoreDocumentId,
        summaryText: result.summaryText
      };
    });

    if (!lockResult.success) {
      return lockResult.errorResponse!;
    }

    if (lockResult.data?.validationStatus === "CONFLICT" || (lockResult.data?.conflicts ?? 0) > 0) {
      return NextResponse.json(
        {
          ...lockResult.data,
          error: "INGESTION_CONFLICT",
          code: "CONFLICT",
          message: lockResult.data?.conflictDetails || "Candidate conflicts with existing corpus record or expected metadata.",
          statusCode: 409
        },
        { status: 409 }
      );
    }

    return NextResponse.json(lockResult.data);
  } catch (err: unknown) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    const sanitizedMsg = rawMsg
      .replace(/AIza[0-9A-Za-z-_]{35}/g, "[REDACTED_API_KEY]")
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "[REDACTED_TOKEN]");

    if (sanitizedMsg.includes("FIREBASE_NOT_CONFIGURED")) {
      return NextResponse.json(
        {
          error: "FIREBASE_NOT_CONFIGURED",
          message: "Authoritative Firebase backend is not configured. Operational ingestion requires durable cloud persistence and cannot proceed in-memory.",
          statusCode: 503
        },
        { status: 503 }
      );
    }

    if (
      sanitizedMsg.includes("PDF") ||
      sanitizedMsg.includes("INVALID_PDF") ||
      sanitizedMsg.includes("Magic header")
    ) {
      return NextResponse.json(
        {
          error: "INVALID_PDF",
          message: `PDF format validation failed: ${sanitizedMsg}`,
          statusCode: 400
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "UPLOAD_INGESTION_FAILED",
        message: `Upload ingestion failed: ${sanitizedMsg}`,
        statusCode: 500
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      error: "METHOD_NOT_ALLOWED",
      message: "GET is not supported on /api/ops/ingestion/upload. Use POST to upload and ingest an official PDF.",
      statusCode: 405
    },
    { status: 405, headers: { Allow: "POST" } }
  );
}
