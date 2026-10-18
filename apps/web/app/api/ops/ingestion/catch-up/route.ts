/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Operational Ingestion API — Official Result Catch-Up Workflow
 * POST /api/ops/ingestion/catch-up
 *
 * Automatically determines the missing date range:
 *   drawDate > lastVerifiedIngestedDrawDate AND drawDate <= currentISTDate
 * enumerates official published results and today's scheduled draw on LOTIS,
 * classifies every candidate, supports dry-run validation of all eligible candidates,
 * and allows explicit operator-confirmed DEV ingestion.
 *
 * PROD mutations are strictly forbidden and rejected with 403 Forbidden.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  OfficialResultCatchUpEngine,
  type CatchUpMode
} from "@kerala-lottery/service-ingestion";
import {
  verifyOpsAuthorization,
  validateOpsEnvironment,
  withOpsSingleFlightLock,
  getOpsRunRepository,
  getDiscoveryFetchOverrideForTesting,
  getOpsIngestionCloudDependenciesForTesting,
  buildOpsSourceIngestionService
} from "../../../../../lib/ops-guard";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = verifyOpsAuthorization(req);
  if (!auth.authorized) {
    return auth.errorResponse!;
  }

  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Empty body defaults to DISCOVER mode
    }

    const rawMode = String(body.mode || "DISCOVER").toUpperCase();
    const mode: CatchUpMode =
      rawMode === "INGEST" ? "INGEST" : rawMode === "DRY_RUN" ? "DRY_RUN" : "DISCOVER";
    const envRequested = body.environment || "DEV";
    const isMutating = mode === "INGEST";

    const envCheck = validateOpsEnvironment(envRequested, isMutating);
    if (!envCheck.allowed) {
      return envCheck.errorResponse!;
    }
    const environment = envCheck.environment;

    if (mode === "INGEST" && body.confirm !== true) {
      return NextResponse.json(
        {
          error: "CONFIRMATION_REQUIRED",
          code: "CONFIRMATION_REQUIRED",
          message:
            "Explicit operator confirmation (confirm: true) is required before ingesting catch-up results into DEV.",
          statusCode: 400
        },
        { status: 400 }
      );
    }

    const testDeps = getOpsIngestionCloudDependenciesForTesting();
    const fetchOverride = testDeps?.acquisitionFetchOverride || getDiscoveryFetchOverrideForTesting() || undefined;
    const referenceDate = body.referenceDate || body.nowIso;
    const afterDrawDateIso = typeof body.afterDrawDateIso === "string" ? body.afterDrawDateIso : undefined;

    if (mode !== "INGEST") {
      const optionalSourceIngestionService = buildOpsSourceIngestionService({ allowOptional: true });
      const engine = new OfficialResultCatchUpEngine({
        mode,
        environment,
        referenceDate,
        afterDrawDateIso,
        cacheDir: testDeps?.cacheDir,
        sourceDir: testDeps?.sourceDir,
        fetchImpl: fetchOverride,
        sourceIngestionService: optionalSourceIngestionService
      });
      const result = await engine.execute();

      await getOpsRunRepository().createRun({
        runId: result.runId,
        environment,
        trigger: mode === "DRY_RUN" ? "DRY_RUN" : "MANUAL",
        dryRun: true,
        status: result.portalReachable ? "SUCCEEDED" : "FAILED",
        requestedAt: result.startedAt,
        startedAt: result.startedAt,
        completedAt: result.completedAt,
        candidateCount: result.counts.publishedInCatchUpRange,
        alreadyKnownCount:
          result.counts.alreadyIngestedBySha256 + result.counts.alreadyIngestedByDrawIdentity,
        downloadedCount: mode === "DRY_RUN" ? result.counts.publishedInCatchUpRange : 0,
        validatedCount: mode === "DRY_RUN" ? result.counts.newEligible : 0,
        ingestedCount: 0,
        promotedCount: 0,
        rejectedCount: result.counts.invalidSchemeOrParseError,
        errorCount: result.portalReachable ? 0 : 1,
        conflictCount: result.counts.conflictDiffHash,
        candidates: [],
        failureReason: result.portalNotice,
        metadata: {
          operation: `CATCH_UP_${mode}`,
          catchUpRange: result.catchUpRange,
          plainLanguageSummary: result.plainLanguageSummary,
          counts: result.counts
        }
      });

      return NextResponse.json({
        success: result.portalReachable,
        ...result
      });
    }

    // INGEST mode: acquire single-flight lock and persist to DEV Cloud Storage & Firestore
    const runId = `run_ops_catchup_ingest_${new Date().toISOString().replace(/[:.]/g, "-")}_${Math.random().toString(36).substring(2, 8)}`;

    const lockResult = await withOpsSingleFlightLock(runId, environment, async () => {
      const sourceIngestionService = buildOpsSourceIngestionService({ allowOptional: false })!;

      const engine = new OfficialResultCatchUpEngine({
        mode: "INGEST",
        environment,
        referenceDate,
        afterDrawDateIso,
        runId,
        cacheDir: testDeps?.cacheDir,
        sourceDir: testDeps?.sourceDir,
        fetchImpl: fetchOverride,
        sourceIngestionService
      });

      const result = await engine.execute();

      await getOpsRunRepository().createRun({
        runId: result.runId,
        environment,
        trigger: "MANUAL",
        dryRun: false,
        status:
          result.portalReachable &&
          result.counts.conflictDiffHash === 0 &&
          result.counts.invalidSchemeOrParseError === 0
            ? "SUCCEEDED"
            : "FAILED",
        requestedAt: result.startedAt,
        startedAt: result.startedAt,
        completedAt: result.completedAt,
        candidateCount: result.counts.publishedInCatchUpRange,
        alreadyKnownCount:
          result.counts.alreadyIngestedBySha256 + result.counts.alreadyIngestedByDrawIdentity,
        downloadedCount: result.counts.publishedInCatchUpRange,
        validatedCount: result.counts.ingestedThisRun,
        ingestedCount: result.counts.ingestedThisRun,
        promotedCount: result.counts.ingestedThisRun,
        rejectedCount: result.counts.invalidSchemeOrParseError,
        errorCount: result.counts.invalidSchemeOrParseError,
        conflictCount: result.counts.conflictDiffHash,
        candidates: [],
        failureReason: result.portalNotice,
        metadata: {
          operation: "CATCH_UP_INGEST",
          catchUpRange: result.catchUpRange,
          plainLanguageSummary: result.plainLanguageSummary,
          counts: result.counts,
          corpusBefore: result.corpusBefore,
          corpusAfter: result.corpusAfter
        }
      });

      return {
        success:
          result.portalReachable &&
          result.counts.conflictDiffHash === 0 &&
          result.counts.invalidSchemeOrParseError === 0,
        ...result
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
          message: sanitizedMsg,
          statusCode: 503
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error: "CATCH_UP_FAILED",
        message: `Catch-up workflow failed: ${sanitizedMsg}`,
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
      message:
        "GET is not supported on /api/ops/ingestion/catch-up. Use POST with mode: 'DISCOVER' | 'DRY_RUN' | 'INGEST'.",
      statusCode: 405
    },
    { status: 405, headers: { Allow: "POST" } }
  );
}
