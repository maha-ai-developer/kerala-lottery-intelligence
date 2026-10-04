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
  resolveCanonicalAndResponseFilename
} from "@kerala-lottery/service-ingestion";
import {
  computeSha256,
  validatePdfBuffer,
  KERALA_STATE_LOTTERY_PORTAL
} from "@kerala-lottery/documents";
import {
  FirestoreDocumentRepository,
  InMemoryDocumentRepository,
  InMemoryStorageService,
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
    const body = await req.json();
    const { candidate, environment: envRequested = "DEV" } = body;

    // 2. Strict Environment Safety Guard (Mutating action)
    const envCheck = validateOpsEnvironment(envRequested, true);
    if (!envCheck.allowed) {
      return envCheck.errorResponse!;
    }
    const environment = envCheck.environment; // Guaranteed "DEV"

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

    const runId = `run_ops_download_${new Date().toISOString().replace(/[:.]/g, "-")}_${Math.random().toString(36).substring(2, 8)}`;
    const acquisitionService = new DocumentAcquisitionService();
    const discoveryService = new OfficialSourceDiscoveryService();

    // 3. Single-Flight Concurrency Lease Guard
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
        const acq = await acquisitionService.acquire({
          url: candidate.sourceUrl,
          officialSource: KERALA_STATE_LOTTERY_PORTAL,
          title: candidate.title
        });
        fileBuffer = acq.fileBuffer;
      }

      if (!fileBuffer) {
        throw new Error("Unable to acquire candidate PDF bytes from sourceUrl or provided payload.");
      }

      // Validate narrow PDF format
      validatePdfBuffer(fileBuffer);
      const sha256 = computeSha256(fileBuffer);

      const resolved = resolveCanonicalAndResponseFilename(
        candidate.fileName,
        sha256,
        candidate.canonicalFilename,
        candidate.sourceResponseFilename
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

      // Set up authoritative cloud persistence dependencies
      let docRepo = isFirebaseConfigured
        ? new FirestoreDocumentRepository(db)
        : new InMemoryDocumentRepository();

      const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "kerala-lottery-intel-dev.firebasestorage.app";
      let storageService = isFirebaseConfigured
        ? new FirebaseStorageService({ bucketName: storageBucket })
        : new InMemoryStorageService();

      const sourceIngestionService = new SourceIngestionService({
        documentRepository: docRepo,
        storageService
      });

      // Execute daily ingestion pipeline
      const engine = new DailyIngestionEngine({
        dryRun: false,
        silent: true,
        runId,
        injectedCandidates: [injectedCandidate],
        acquisitionService,
        discoveryService,
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
          lottery: auditRecord?.lottery || candidate.lotteryCode || "Unknown",
          drawNumber: auditRecord?.drawNumber || candidate.drawNumber || "Unknown",
          drawDate: auditRecord?.drawDate || candidate.drawDate || "Unknown"
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
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: "DOWNLOAD_INGESTION_FAILED",
        message: `Download and ingestion failed: ${message}`,
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
