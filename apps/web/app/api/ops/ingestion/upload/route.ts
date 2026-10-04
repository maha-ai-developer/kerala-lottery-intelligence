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
  SourceIngestionService,
  resolveCanonicalAndResponseFilename
} from "@kerala-lottery/service-ingestion";
import {
  computeSha256,
  validatePdfBuffer,
  DocumentValidationError
} from "@kerala-lottery/documents";
import {
  FirestoreDocumentRepository,
  FirebaseStorageService
} from "@kerala-lottery/data";
import {
  verifyOpsAuthorization,
  validateOpsEnvironment,
  withOpsSingleFlightLock,
  getOpsRunRepository
} from "../../../../../lib/ops-guard";
import { db, isFirebaseConfigured } from "../../../../../lib/firebase";

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

    const contentType = req.headers.get("content-type") || "";

    // 2. Parse Multipart FormData or JSON
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json(
          {
            error: "BAD_REQUEST",
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
    } else {
      const body = await req.json();
      fileName = body.fileName || "uploaded-result.pdf";
      envRequested = body.environment || "DEV";

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

    if (!fileBuffer || fileBuffer.byteLength === 0) {
      return NextResponse.json(
        {
          error: "BAD_REQUEST",
          message: "Empty or missing PDF file buffer.",
          statusCode: 400
        },
        { status: 400 }
      );
    }

    // 4. Narrow PDF Format Validation
    try {
      validatePdfBuffer(fileBuffer);
    } catch (valErr: unknown) {
      const msg = valErr instanceof DocumentValidationError ? valErr.message : "Uploaded file is not a valid PDF.";
      return NextResponse.json(
        {
          error: "INVALID_PDF",
          message: `PDF Validation Failed: ${msg}`,
          statusCode: 400
        },
        { status: 400 }
      );
    }

    // 5. Deterministic SHA-256 Calculation
    const sha256 = computeSha256(fileBuffer);
    const runId = `run_ops_upload_${new Date().toISOString().replace(/[:.]/g, "-")}_${Math.random().toString(36).substring(2, 8)}`;

    const resolved = resolveCanonicalAndResponseFilename(fileName, sha256);

    const candidate: InjectedCandidate = {
      fileName,
      canonicalFilename: resolved.canonicalFilename,
      sourceResponseFilename: resolved.sourceResponseFilename,
      fileBuffer
    };

    // 6. Single-Flight Concurrency Lease Guard
    const lockResult = await withOpsSingleFlightLock(runId, environment, async () => {
      // Fail-closed Firebase check: operational ingestion requires durable cloud persistence
      if (!isFirebaseConfigured) {
        throw new Error(
          "FIREBASE_NOT_CONFIGURED: Authoritative Firebase backend is not configured. Operational ingestion requires durable cloud persistence and cannot proceed in-memory."
        );
      }

      // Set up authoritative cloud persistence dependencies - fail closed
      const docRepo = new FirestoreDocumentRepository(db);
      const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "kerala-lottery-intel-dev.firebasestorage.app";
      const storageService = new FirebaseStorageService({ bucketName: storageBucket });

      const sourceIngestionService = new SourceIngestionService({
        documentRepository: docRepo,
        storageService
      });

      // Execute daily ingestion pipeline
      const engine = new DailyIngestionEngine({
        dryRun: false,
        silent: true,
        runId,
        injectedCandidates: [candidate],
        sourceIngestionService,
        environment
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
        metadata: {
          audit: {
            schedulerState: "PAUSED",
            singleFlightLock: "IDLE",
            zeroSecretsExposed: true
          },
          sha256,
          canonicalFilename: resolved.canonicalFilename,
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
        canonicalFilename: resolved.canonicalFilename,
        drawIdentity: {
          lottery: auditRecord?.lottery || "Unknown",
          drawNumber: auditRecord?.drawNumber || "Unknown",
          drawDate: auditRecord?.drawDate || "Unknown"
        },
        resultCount: auditRecord?.resultCount || (result.corpus ? result.corpus.results : 0),
        fullTicketCount: result.corpus ? result.corpus.fullTicket : 0,
        suffixCount: result.corpus ? result.corpus.suffix : 0,
        cloudStoragePath,
        firestoreDocumentId,
        summaryText: result.summaryText
      };
    });

    if (!lockResult.success) {
      return lockResult.errorResponse!;
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
