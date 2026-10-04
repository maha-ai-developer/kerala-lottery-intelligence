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
  OfficialSourceDiscoveryService
} from "@kerala-lottery/service-ingestion";
import { computeSha256 } from "@kerala-lottery/documents";
import { verifyOpsAuthorization, validateOpsEnvironment } from "../../../../../lib/ops-guard";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // 1. Authorization Verification
  const auth = verifyOpsAuthorization(req);
  if (!auth.authorized) {
    return auth.errorResponse!;
  }

  try {
    const body = await req.json();
    const { candidate, environment: envRequested = "DEV" } = body;

    // Validate environment (dry run doesn't mutate, but we enforce DEV context)
    const { environment } = validateOpsEnvironment(envRequested, false);

    if (!candidate || !candidate.fileName) {
      return NextResponse.json(
        {
          error: "BAD_REQUEST",
          message: "A candidate specification with at least 'fileName' is required for dry-run preview.",
          statusCode: 400
        },
        { status: 400 }
      );
    }

    // Resolve candidate fileBuffer if provided as base64
    let fileBuffer: Uint8Array | undefined;
    if (candidate.fileBase64) {
      const cleanBase64 = candidate.fileBase64.replace(/^data:[^;]+;base64,/, "");
      fileBuffer = new Uint8Array(Buffer.from(cleanBase64, "base64"));
    } else if (candidate.fileBuffer) {
      fileBuffer = new Uint8Array(candidate.fileBuffer);
    }

    const injectedCandidate: InjectedCandidate = {
      fileName: candidate.fileName,
      canonicalFilename: candidate.canonicalFilename,
      sourceResponseFilename: candidate.sourceResponseFilename,
      fileBuffer,
      sourceUrl: candidate.sourceUrl,
      title: candidate.title,
      drawDate: candidate.drawDate,
      drawNumber: candidate.drawNumber,
      lotteryCode: candidate.lotteryCode
    };

    // Initialize acquisition and discovery services if needed for remote candidate
    const acquisitionService = new DocumentAcquisitionService();
    const discoveryService = new OfficialSourceDiscoveryService();

    const engine = new DailyIngestionEngine({
      dryRun: true,
      silent: true,
      injectedCandidates: [injectedCandidate],
      acquisitionService,
      discoveryService,
      environment
    });

    const result = await engine.execute();
    const auditRecord = result.candidates[0] || null;

    const candidateSha = auditRecord?.sha256 || (fileBuffer ? computeSha256(fileBuffer) : undefined);
    const candidateStatus = auditRecord ? auditRecord.validationStatus : "UNKNOWN";

    return NextResponse.json({
      success: result.success,
      dryRun: true,
      environment,
      runId: result.runId,
      candidateStatus,
      actionTaken: auditRecord?.actionTaken || "VALIDATED",
      sha256: candidateSha,
      canonicalFilename: auditRecord?.canonicalFilename || candidate.fileName,
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
        validationStatus: auditRecord?.validationStatus || "UNKNOWN",
        isDuplicate: Boolean(auditRecord?.isDuplicate),
        errorDetails: auditRecord?.errorDetails,
        conflictDetails: auditRecord?.conflictDetails
      },
      projectedChanges: {
        newDocuments: result.newDocuments,
        alreadyIngested: result.alreadyIngested,
        duplicateSha: result.duplicateSha,
        invalidDocuments: result.invalidDocuments,
        newDraws: result.newDraws.length
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
