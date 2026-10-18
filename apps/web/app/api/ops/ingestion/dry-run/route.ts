/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Operational Ingestion API — Dry Run / Validation Preview
 * POST /api/ops/ingestion/dry-run
 *
 * Runs candidate validation, SHA computation, prize scheme resolution,
 * and duplicate/conflict detection in DRY-RUN mode.
 * Zero mutations are committed to local or cloud storage.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  DailyIngestionEngine,
  type InjectedCandidate,
  DocumentAcquisitionService,
  OfficialSourceDiscoveryService,
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
  verifyOpsAuthorization,
  validateOpsEnvironment,
  getOpsRunRepository,
  getOpsIngestionCloudDependenciesForTesting
} from "../../../../../lib/ops-guard";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // 1. Authorization Verification
  const auth = verifyOpsAuthorization(req);
  if (!auth.authorized) {
    return auth.errorResponse!;
  }

  try {
    let candidate: any = {};
    let envRequested = "DEV";
    let fileBuffer: Uint8Array | undefined;

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json(
          {
            error: "BAD_REQUEST",
            code: "MISSING_FILE",
            message: "Missing 'file' field in multipart form data preview.",
            statusCode: 400
          },
          { status: 400 }
        );
      }
      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = new Uint8Array(arrayBuffer);
      const envField = formData.get("environment");
      if (typeof envField === "string") envRequested = envField;

      candidate = {
        fileName: file.name || "uploaded-result.pdf",
        drawDate: (formData.get("drawDate") as string) || undefined,
        drawNumber: (formData.get("drawNumber") as string) || undefined,
        lotteryCode: (formData.get("lotteryCode") as string) || undefined,
        sourceUrl: (formData.get("sourceUrl") as string) || undefined,
        title: (formData.get("title") as string) || undefined
      };
    } else {
      const body = await req.json();
      envRequested = body.environment || "DEV";
      candidate = body.candidate || {
        fileName: body.fileName,
        canonicalFilename: body.canonicalFilename,
        sourceResponseFilename: body.sourceResponseFilename,
        fileBase64: body.fileBase64,
        fileBuffer: body.fileBuffer,
        sourceUrl: body.sourceUrl,
        title: body.title,
        drawDate: body.drawDate,
        drawNumber: body.drawNumber,
        lotteryCode: body.lotteryCode
      };

      if (candidate.fileBase64) {
        const cleanBase64 = candidate.fileBase64.replace(/^data:[^;]+;base64,/, "");
        fileBuffer = new Uint8Array(Buffer.from(cleanBase64, "base64"));
      } else if (candidate.fileBuffer) {
        fileBuffer = new Uint8Array(candidate.fileBuffer);
      }
    }

    // Validate environment (dry run doesn't mutate, but we enforce context)
    const { environment } = validateOpsEnvironment(envRequested, false);

    if (!candidate || !candidate.fileName) {
      return NextResponse.json(
        {
          error: "BAD_REQUEST",
          code: "MISSING_CANDIDATE",
          message: "A candidate specification with at least 'fileName' is required for dry-run preview.",
          statusCode: 400
        },
        { status: 400 }
      );
    }

    const testDeps = getOpsIngestionCloudDependenciesForTesting();
    const acquisitionService = new DocumentAcquisitionService(testDeps?.acquisitionFetchOverride);
    const discoveryService = new OfficialSourceDiscoveryService(testDeps?.acquisitionFetchOverride);

    if (!fileBuffer && candidate.sourceUrl) {
      try {
        validateSafeUrl(candidate.sourceUrl, KERALA_STATE_LOTTERY_PORTAL.allowedDomains);
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
        if (
          acqErr instanceof AcquisitionSecurityError ||
          (acqErr instanceof DocumentValidationError &&
            (acqErr.code === "UNAUTHORIZED_HOST" ||
              acqErr.code === "UNAUTHORIZED_DOMAIN" ||
              acqErr.code === "SSRF_PROHIBITED_HOST" ||
              acqErr.code === "UNSUPPORTED_PROTOCOL" ||
              acqErr.code === "INVALID_URL" ||
              acqErr.code === "MALFORMED_URL"))
        ) {
          return NextResponse.json(
            {
              error: "SECURITY_VIOLATION",
              code: "SECURITY_VIOLATION",
              message: acqErr.message,
              statusCode: 403
            },
            { status: 403 }
          );
        }
        const acqMsg = acqErr instanceof Error ? acqErr.message : String(acqErr);
        return NextResponse.json(
          {
            error: "UPSTREAM_ACQUISITION_FAILED",
            code: "UPSTREAM_ACQUISITION_FAILED",
            message: `Official portal acquisition failed during preview: ${acqMsg}`,
            statusCode: 502
          },
          { status: 502 }
        );
      }
    }

    if (fileBuffer !== undefined) {
      try {
        validatePdfBuffer(fileBuffer, {
          maxBytes: DEFAULT_MAX_UPLOAD_BYTES,
          requireEofMarker: true
        });
      } catch (valErr: unknown) {
        if (valErr instanceof DocumentValidationError) {
          const status = valErr.code === "FILE_TOO_LARGE" ? 413 : 400;
          const errorName =
            valErr.code === "FILE_TOO_LARGE"
              ? "FILE_TOO_LARGE"
              : valErr.code === "TRUNCATED_PDF"
                ? "TRUNCATED_PDF"
                : "INVALID_PDF";
          return NextResponse.json(
            {
              error: errorName,
              code: valErr.code,
              message: `PDF Validation Failed: ${valErr.message}`,
              statusCode: status
            },
            { status }
          );
        }
        throw valErr;
      }
    }

    const preSha = fileBuffer ? computeSha256(fileBuffer) : undefined;
    const resolvedNames = preSha
      ? resolveCanonicalAndResponseFilename(
          candidate.fileName,
          preSha,
          candidate.canonicalFilename,
          candidate.sourceResponseFilename,
          candidate.sourceUrl,
          { candidateDrawNumber: candidate.drawNumber }
        )
      : {
          canonicalFilename: candidate.canonicalFilename || candidate.fileName,
          sourceResponseFilename: candidate.sourceResponseFilename || candidate.fileName
        };

    const injectedCandidate: InjectedCandidate = {
      fileName: candidate.fileName,
      canonicalFilename: resolvedNames.canonicalFilename,
      sourceResponseFilename: resolvedNames.sourceResponseFilename,
      fileBuffer,
      sourceUrl: candidate.sourceUrl,
      title: candidate.title,
      drawDate: candidate.drawDate,
      drawNumber: candidate.drawNumber,
      lotteryCode: candidate.lotteryCode
    };

    const engine = new DailyIngestionEngine({
      dryRun: true,
      silent: true,
      limit: 1,
      injectedCandidates: [injectedCandidate],
      acquisitionService,
      discoveryService,
      environment,
      cacheDir: testDeps?.cacheDir,
      sourceDir: testDeps?.sourceDir
    });

    const result = await engine.execute();
    const auditRecord = result.candidates[0] || null;

    const candidateSha = auditRecord?.sha256 || preSha;
    const candidateStatus = auditRecord ? auditRecord.validationStatus : "UNKNOWN";
    const fileSize = auditRecord?.fileSize ?? (fileBuffer ? fileBuffer.byteLength : 0);

    // Record dry-run preview in operational run log
    await getOpsRunRepository().createRun({
      runId: result.runId,
      environment,
      trigger: "DRY_RUN",
      dryRun: true,
      status: result.success ? "SUCCEEDED" : "FAILED",
      requestedAt: result.startedAt,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      candidateCount: 1,
      alreadyKnownCount: result.alreadyIngested,
      downloadedCount: candidate.sourceUrl ? 1 : 0,
      validatedCount: result.summary.validated,
      ingestedCount: 0,
      promotedCount: 0,
      rejectedCount: result.summary.rejected,
      errorCount: result.invalidDocuments,
      conflictCount: result.summary.conflicts,
      candidates: result.candidates,
      metadata: {
        operation: "DRY_RUN_PREVIEW",
        sha256: candidateSha,
        canonicalFilename: auditRecord?.canonicalFilename || resolvedNames.canonicalFilename,
        sourceResponseFilename: auditRecord?.sourceResponseFilename || resolvedNames.sourceResponseFilename,
        validationStatus: candidateStatus
      }
    });

    return NextResponse.json({
      success: result.success,
      dryRun: true,
      environment,
      runId: result.runId,
      candidateStatus,
      actionTaken: auditRecord?.actionTaken || "VALIDATED",
      sha256: candidateSha,
      fileSize,
      fileName: candidate.fileName,
      canonicalFilename: auditRecord?.canonicalFilename || resolvedNames.canonicalFilename,
      sourceResponseFilename: auditRecord?.sourceResponseFilename || resolvedNames.sourceResponseFilename,
      drawIdentity: {
        lottery: auditRecord?.lottery || candidate.lotteryCode || "Unknown",
        drawNumber: auditRecord?.drawNumber || candidate.drawNumber || "Unknown",
        drawDate: auditRecord?.drawDate || candidate.drawDate || "Unknown"
      },
      scheme: {
        schemeId: auditRecord?.schemeId,
        schemeAuthorityLevel: auditRecord?.schemeAuthorityLevel
      },
      validation: {
        resultCount: auditRecord?.resultCount || 0,
        fullTicketCount: auditRecord?.fullTicketCount ?? 0,
        suffixCount: auditRecord?.suffixCount ?? 0,
        prizeTierSummary: auditRecord?.prizeTierSummary || [],
        leadingZeroCount: auditRecord?.leadingZeroCount ?? 0,
        sampleLeadingZeroNumbers: auditRecord?.sampleLeadingZeroNumbers || [],
        validationStatus: auditRecord?.validationStatus || "UNKNOWN",
        isDuplicate: Boolean(auditRecord?.isDuplicate),
        errorDetails: auditRecord?.errorDetails,
        conflictDetails: auditRecord?.conflictDetails
      },
      projectedChanges: {
        newDocuments: result.summary.validated,
        alreadyIngested: result.alreadyIngested,
        duplicateSha: result.duplicateSha,
        invalidDocuments: result.invalidDocuments,
        newDraws: result.summary.validated
      },
      summaryText: result.summaryText,
      storageMutated: false,
      firestoreMutated: false
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: "DRY_RUN_FAILED",
        message: `Dry-run execution failed: ${message}`,
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
      message: "GET is not supported on /api/ops/ingestion/dry-run. Use POST to trigger candidate dry run.",
      statusCode: 405
    },
    { status: 405, headers: { Allow: "POST" } }
  );
}
