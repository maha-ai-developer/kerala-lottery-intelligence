/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Operational Ingestion API — Download & Ingest Official Candidate
 * POST /api/ops/ingestion/download
 *
 * Acquires official published PDF, validates bytes, computes SHA-256,
 * enforces single-flight lease, writes to immutable cloud storage & Firestore,
 * executes promotion into the Research/DEV corpus, and writes durable audit run records.
 *
 * PROD mutations are strictly forbidden and rejected with 403 Forbidden.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  DailyIngestionEngine,
  type InjectedCandidate,
  DocumentAcquisitionService,
  OfficialSourceDiscoveryService,
  SourceIngestionService,
  AcquisitionSecurityError,
  resolveCanonicalAndResponseFilename
} from "@kerala-lottery/service-ingestion";
import {
  computeSha256,
  validatePdfBuffer,
  DocumentValidationError,
  DEFAULT_MAX_UPLOAD_BYTES,
  validateSafeUrl,
  KERALA_STATE_LOTTERY_PORTAL
} from "@kerala-lottery/documents";
import {
  FirestoreDocumentRepository,
  FirebaseStorageService
} from "@kerala-lottery/data";
import {
  verifyOpsAuthorization,
  validateOpsEnvironment,
  withOpsSingleFlightLock,
  getOpsRunRepository,
  getOpsIngestionCloudDependenciesForTesting
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
    const body = await req.json();
    const {
      candidate,
      environment: envRequested = "DEV",
      confirm: explicitConfirm
    } = body;

    // 2. Strict Environment Safety Guard (Mutating action - strictly rejects PROD with 403)
    const envCheck = validateOpsEnvironment(envRequested, true);
    if (!envCheck.allowed) {
      return envCheck.errorResponse!;
    }
    const environment = envCheck.environment; // Guaranteed "DEV"

    if (explicitConfirm === false) {
      return NextResponse.json(
        {
          error: "CONFIRMATION_REQUIRED",
          code: "CONFIRMATION_REQUIRED",
          message: "Explicit operator confirmation (confirm: true) is required before ingesting a discovered document into DEV.",
          statusCode: 400
        },
        { status: 400 }
      );
    }

    if (!candidate || !candidate.fileName) {
      return NextResponse.json(
        {
          error: "BAD_REQUEST",
          message: "Candidate object with 'fileName' and source reference is required.",
          statusCode: 400
        },
        { status: 400 }
      );
    }

    if (!candidate.fileBase64 && !candidate.fileBuffer && !candidate.sourceUrl) {
      return NextResponse.json(
        {
          error: "MISSING_SOURCE_PAYLOAD",
          message: "Candidate requires valid 'sourceUrl', 'fileBase64', or 'fileBuffer' for acquisition.",
          statusCode: 400
        },
        { status: 400 }
      );
    }

    if (candidate.sourceUrl) {
      try {
        validateSafeUrl(candidate.sourceUrl, KERALA_STATE_LOTTERY_PORTAL.allowedDomains);
      } catch (secErr: unknown) {
        const msg = secErr instanceof Error ? secErr.message : String(secErr);
        return NextResponse.json(
          {
            error: "SECURITY_VIOLATION",
            code: "SECURITY_VIOLATION",
            message: msg,
            statusCode: 403
          },
          { status: 403 }
        );
      }
    }

    const testDeps = getOpsIngestionCloudDependenciesForTesting();
    const runId = `run_ops_download_${new Date().toISOString().replace(/[:.]/g, "-")}_${Math.random().toString(36).substring(2, 8)}`;
    const acquisitionService = new DocumentAcquisitionService(testDeps?.acquisitionFetchOverride);
    const discoveryService = new OfficialSourceDiscoveryService(testDeps?.acquisitionFetchOverride);

    // 4. Single-Flight Concurrency Lease Guard
    const lockResult = await withOpsSingleFlightLock(runId, environment, async () => {
      // Resolve candidate file bytes
      let fileBuffer: Uint8Array | undefined;

      if (candidate.fileBase64) {
        const cleanBase64 = candidate.fileBase64.replace(/^data:[^;]+;base64,/, "");
        fileBuffer = new Uint8Array(Buffer.from(cleanBase64, "base64"));
      } else if (candidate.fileBuffer) {
        fileBuffer = new Uint8Array(candidate.fileBuffer);
      } else if (candidate.sourceUrl) {
        // Acquire directly from official source URL
        try {
          const acq = await acquisitionService.acquire({
            url: candidate.sourceUrl,
            officialSource: KERALA_STATE_LOTTERY_PORTAL,
            title: candidate.title
          });
          fileBuffer = acq.fileBuffer;
          if (
            !candidate.canonicalFilename &&
            acq.fileName &&
            /^[0-9]+-[0-9]+-[0-9]{2}-[0-9]{2}-[0-9]{4}\.pdf$/i.test(acq.fileName)
          ) {
            candidate.canonicalFilename = acq.fileName;
          }
        } catch (acqErr: unknown) {
          if (acqErr instanceof AcquisitionSecurityError) {
            throw acqErr;
          }
          const acqMsg = acqErr instanceof Error ? acqErr.message : String(acqErr);
          throw new Error(`ACQUISITION_FAILED: ${acqMsg}`);
        }
      }

      if (!fileBuffer || fileBuffer.byteLength === 0) {
        throw new Error("MISSING_SOURCE_PAYLOAD: Acquired file buffer is empty or unavailable.");
      }

      // Validate narrow PDF format, max size (<= 10 MB), and EOF marker
      validatePdfBuffer(fileBuffer, {
        maxBytes: DEFAULT_MAX_UPLOAD_BYTES,
        requireEofMarker: true
      });
      const sha256 = computeSha256(fileBuffer);

      const resolved = resolveCanonicalAndResponseFilename(
        candidate.fileName,
        sha256,
        candidate.canonicalFilename,
        candidate.sourceResponseFilename,
        candidate.sourceUrl,
        {
          candidateDrawNumber: candidate.drawNumber
        }
      );

      const injectedCandidate: InjectedCandidate = {
        fileName: candidate.fileName,
        canonicalFilename: resolved.canonicalFilename,
        sourceResponseFilename: resolved.sourceResponseFilename,
        fileBuffer,
        sourceUrl: candidate.sourceUrl,
        title: candidate.title,
        drawDate: candidate.drawDate,
        drawNumber: candidate.drawNumber,
        lotteryCode: candidate.lotteryCode
      };

      // Fail-closed Firebase check: operational ingestion requires durable cloud persistence
      if (!isFirebaseConfigured && !testDeps) {
        throw new Error(
          "FIREBASE_NOT_CONFIGURED: Authoritative Firebase backend is not configured. Operational ingestion requires durable cloud persistence and cannot proceed in-memory."
        );
      }

      let sourceIngestionService: SourceIngestionService;
      if (testDeps) {
        sourceIngestionService = testDeps.sourceIngestionService;
      } else {
        const docRepo = new FirestoreDocumentRepository(db);
        const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "kerala-lottery-intel-dev.firebasestorage.app";
        const storageService = new FirebaseStorageService({ bucketName: storageBucket });

        sourceIngestionService = new SourceIngestionService({
          documentRepository: docRepo,
          storageService
        });
      }

      // Execute daily ingestion pipeline
      const engine = new DailyIngestionEngine({
        dryRun: false,
        silent: true,
        limit: 1,
        runId,
        injectedCandidates: [injectedCandidate],
        acquisitionService,
        discoveryService,
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
          fileSize: fileBuffer.byteLength,
          canonicalFilename: auditRecord?.canonicalFilename || resolved.canonicalFilename,
          sourceResponseFilename: auditRecord?.sourceResponseFilename || resolved.sourceResponseFilename,
          drawNumber: auditRecord?.drawNumber || candidate.drawNumber,
          lottery: auditRecord?.lottery || candidate.lotteryCode,
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
        fileSize: fileBuffer.byteLength,
        canonicalFilename: auditRecord?.canonicalFilename || resolved.canonicalFilename,
        sourceResponseFilename: auditRecord?.sourceResponseFilename || resolved.sourceResponseFilename,
        drawIdentity: {
          lottery: auditRecord?.lottery || candidate.lotteryCode || "Unknown",
          drawNumber: auditRecord?.drawNumber || candidate.drawNumber || "Unknown",
          drawDate: auditRecord?.drawDate || candidate.drawDate || "Unknown"
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
    if (err instanceof AcquisitionSecurityError) {
      return NextResponse.json(
        {
          error: "SECURITY_VIOLATION",
          code: "SECURITY_VIOLATION",
          message: err.message,
          statusCode: 403
        },
        { status: 403 }
      );
    }

    if (err instanceof DocumentValidationError) {
      const status = err.code === "FILE_TOO_LARGE" ? 413 : 400;
      return NextResponse.json(
        {
          error: err.code === "FILE_TOO_LARGE" ? "FILE_TOO_LARGE" : "INVALID_PDF",
          code: err.code,
          message: `PDF format validation failed: ${err.message}`,
          statusCode: status
        },
        { status }
      );
    }

    const rawMsg = err instanceof Error ? err.message : String(err);
    // Sanitize any potential credential or private info
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
      sanitizedMsg.includes("ACQUISITION_FAILED") ||
      sanitizedMsg.includes("fetch failed") ||
      sanitizedMsg.includes("ECONNREFUSED") ||
      sanitizedMsg.includes("ETIMEDOUT")
    ) {
      return NextResponse.json(
        {
          error: "UPSTREAM_ACQUISITION_FAILED",
          message: `Official portal acquisition failed: ${sanitizedMsg}`,
          statusCode: 502
        },
        { status: 502 }
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

    if (sanitizedMsg.includes("MISSING_SOURCE_PAYLOAD") || sanitizedMsg.includes("Unable to acquire")) {
      return NextResponse.json(
        {
          error: "BAD_REQUEST",
          message: sanitizedMsg,
          statusCode: 400
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "DOWNLOAD_INGESTION_FAILED",
        message: `Download and ingestion failed: ${sanitizedMsg}`,
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
      message: "GET is not supported on /api/ops/ingestion/download. Use POST to trigger candidate download & ingestion.",
      statusCode: 405
    },
    { status: 405, headers: { Allow: "POST" } }
  );
}
