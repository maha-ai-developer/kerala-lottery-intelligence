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
import { ResearchDataService } from "@kerala-lottery/data";
import {
  verifyOpsAuthorization,
  validateOpsEnvironment,
  withOpsSingleFlightLock,
  getOpsRunRepository,
  getDiscoveryFetchOverrideForTesting,
  getOpsIngestionCloudDependenciesForTesting,
  buildOpsSourceIngestionService,
  CATCH_UP_DISCOVERY_TTL_MS,
  type CachedDiscoveryEntry,
  discoveryCache,
  lastVerifiedDiscoveryByMode,
  inFlightDiscovery
} from "../../../../../lib/ops-guard";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
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
    const source = typeof body.source === "string" ? body.source : "operator-console";
    const isSiteOpen = source === "site-open" && mode !== "INGEST";

    // Site-open read-only discovery is permitted for any visitor without mutating state;
    // operator mutations and explicit operator runs require verifyOpsAuthorization.
    if (!isSiteOpen) {
      const auth = verifyOpsAuthorization(req);
      if (!auth.authorized) {
        return auth.errorResponse!;
      }
    }

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
    const forceRefresh = body.forceRefresh === true;

    if (mode !== "INGEST") {
      const cacheKey = `${environment}_${mode}_${referenceDate || "live"}_${afterDrawDateIso || "auto"}_${testDeps?.cacheDir || "default"}`;
      const modeFallbackKey = `${environment}_${mode}_${testDeps?.cacheDir || "default"}`;
      const nowMs = Date.now();

      if (!forceRefresh) {
        const existingCached = discoveryCache.get(cacheKey);
        if (existingCached && nowMs < existingCached.expiresAtMs && existingCached.result.portalReachable) {
          return NextResponse.json({
            success: existingCached.result.portalReachable,
            ...existingCached.result,
            cacheMeta: {
              cached: true,
              deduplicatedInFlight: false,
              fetchedAt: existingCached.fetchedAt,
              expiresAt: existingCached.expiresAt,
              ttlSeconds: Math.round(CATCH_UP_DISCOVERY_TTL_MS / 1000),
              staleFallbackUsed: false,
              source
            }
          });
        }

        const existingInFlight = inFlightDiscovery.get(cacheKey);
        if (existingInFlight) {
          const deduplicatedEntry = await existingInFlight;
          return NextResponse.json({
            success: deduplicatedEntry.result.portalReachable,
            ...deduplicatedEntry.result,
            cacheMeta: {
              cached: true,
              deduplicatedInFlight: true,
              fetchedAt: deduplicatedEntry.fetchedAt,
              expiresAt: deduplicatedEntry.expiresAt,
              ttlSeconds: Math.round(CATCH_UP_DISCOVERY_TTL_MS / 1000),
              staleFallbackUsed: false,
              source
            }
          });
        }
      }

      const executeDiscoveryPromise = (async (): Promise<CachedDiscoveryEntry> => {
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
        const completedMs = Date.now();
        const entry: CachedDiscoveryEntry = {
          result,
          fetchedAt: new Date(completedMs).toISOString(),
          fetchedAtMs: completedMs,
          expiresAt: new Date(completedMs + CATCH_UP_DISCOVERY_TTL_MS).toISOString(),
          expiresAtMs: completedMs + CATCH_UP_DISCOVERY_TTL_MS
        };
        if (result.portalReachable) {
          discoveryCache.set(cacheKey, entry);
          lastVerifiedDiscoveryByMode.set(modeFallbackKey, entry);
        }
        return entry;
      })();

      inFlightDiscovery.set(cacheKey, executeDiscoveryPromise);
      let entry: CachedDiscoveryEntry;
      try {
        entry = await executeDiscoveryPromise;
      } finally {
        inFlightDiscovery.delete(cacheKey);
      }

      const result = entry.result;
      const previousVerified = lastVerifiedDiscoveryByMode.get(modeFallbackKey);
      const staleFallbackUsed = !result.portalReachable && Boolean(previousVerified);

      // Perform zero writes on automatic site-open discovery; only record an ops run for manual/operator checks
      if (!isSiteOpen) {
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
      }

      return NextResponse.json({
        success: result.portalReachable,
        ...result,
        // If official source is unreachable, preserve previous verified candidate discovery alongside the outage notice
        candidates:
          !result.portalReachable && result.candidates.length === 0 && previousVerified
            ? previousVerified.result.candidates
            : result.candidates,
        previousVerifiedCheckAt: previousVerified?.fetchedAt || null,
        cacheMeta: {
          cached: false,
          deduplicatedInFlight: false,
          fetchedAt: entry.fetchedAt,
          expiresAt: entry.expiresAt,
          ttlSeconds: Math.round(CATCH_UP_DISCOVERY_TTL_MS / 1000),
          staleFallbackUsed,
          source
        }
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

      // Invalidate active research corpus cache and discovery cache after ingestion
      ResearchDataService.getInstance().invalidateCache();
      discoveryCache.clear();
      lastVerifiedDiscoveryByMode.clear();

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
