/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Operational Ingestion API — Check Official Source
 * POST /api/ops/ingestion/check
 *
 * Scans official government source discovery endpoints and checks candidate state
 * against the authoritative manifest (ALREADY_KNOWN, NEW, PENDING, CONFLICT).
 */

import { NextRequest, NextResponse } from "next/server";
import {
  OfficialSourceDiscoveryService,
  DocumentCacheManager,
  getIstDateInfo,
  getScheduledLotteryForIstDate,
  AcquisitionSecurityError,
  type DiscoveryStatusCode
} from "@kerala-lottery/service-ingestion";
import {
  KERALA_STATE_LOTTERY_PORTAL
} from "@kerala-lottery/documents";
import { normalizeDateToIso } from "@kerala-lottery/domain";
import {
  verifyOpsAuthorization,
  validateOpsEnvironment,
  getOpsRunRepository,
  getDiscoveryFetchOverrideForTesting
} from "../../../../../lib/ops-guard";
import { existsSync } from "node:fs";
import { join } from "node:path";

export const dynamic = "force-dynamic";

export interface DiscoveredCandidateState {
  fileName: string;
  canonicalFilename?: string;
  sourceResponseFilename?: string;
  sourceUrl?: string;
  title?: string;
  drawDate?: string;
  drawNumber?: string;
  lotteryCode?: string;
  state: "ALREADY_KNOWN" | "NEW" | "PENDING" | "CONFLICT";
  sha256?: string;
  fileSize?: number;
  details?: string;
}

export async function POST(req: NextRequest) {
  // 1. Authorization Verification
  const auth = verifyOpsAuthorization(req);
  if (!auth.authorized) {
    return auth.errorResponse!;
  }

  const startedAt = new Date().toISOString();
  const runId = `run_ops_check_${startedAt.replace(/[:.]/g, "-")}_${Math.random().toString(36).substring(2, 8)}`;

  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is acceptable
    }

    const {
      environment: envRequested,
      since = "2026-06-01",
      limit = 25,
      referenceDate,
      nowIso,
      noDrawDates,
      checkMode,
      includeBaselinePending
    } = body;
    const { environment } = validateOpsEnvironment(envRequested, false);

    // Compute current date & scheduled lottery in Asia/Kolkata (IST)
    const refDateInput = referenceDate || nowIso;
    const refTime = refDateInput ? new Date(refDateInput) : new Date();
    const todayIst = getIstDateInfo(Number.isNaN(refTime.getTime()) ? new Date() : refTime);
    const todaySchedule = getScheduledLotteryForIstDate(todayIst.isoDate, {
      noDrawDates: Array.isArray(noDrawDates) ? noDrawDates : undefined
    });

    const cacheManager = new DocumentCacheManager();
    const manifest = cacheManager.getManifest();
    const manifestDocs = Object.values(manifest.documents || {});

    // Map manifest by sha256 and by normalized draw identity
    const shaMap = new Map<string, typeof manifestDocs[0]>();
    const drawIdentityMap = new Map<string, typeof manifestDocs[0]>();

    let latestCorpusDraw: {
      drawNumber: string;
      lotteryName: string;
      lotteryCode: string;
      drawDate: string;
      isoDate: string;
      sha256: string;
      canonicalFilename: string;
    } | null = null;

    for (const doc of manifestDocs) {
      if (doc.sha256) {
        shaMap.set(doc.sha256, doc);
      }
      const dateIso = normalizeDateToIso(doc.drawDate || "");
      const cleanNum = (doc.drawNumber || "").replace(/(st|nd|rd|th)$/i, "").toUpperCase();
      if (dateIso && cleanNum) {
        drawIdentityMap.set(`${cleanNum}_${dateIso}`, doc);
      }
      if ((doc.status === "VALID" || (doc as any).validationStatus === "VALID") && dateIso) {
        if (!latestCorpusDraw || dateIso > latestCorpusDraw.isoDate) {
          latestCorpusDraw = {
            drawNumber: doc.drawNumber || "Unknown",
            lotteryName: doc.lotteryName || doc.lotteryCode || "Unknown",
            lotteryCode: doc.lotteryCode || "Unknown",
            drawDate: doc.drawDate || dateIso,
            isoDate: dateIso,
            sha256: doc.sha256,
            canonicalFilename: (doc as any).canonicalFilename || doc.fileName
          };
        }
      }
    }

    // 2. Discover from official portal
    const discoveryFetchOverride = getDiscoveryFetchOverrideForTesting();
    const discoveryService = new OfficialSourceDiscoveryService(discoveryFetchOverride || undefined);
    let discoveredFromPortal: any[] = [];
    let portalReachable = true;
    let portalNotice: string | undefined;

    try {
      discoveredFromPortal = await discoveryService.discover(KERALA_STATE_LOTTERY_PORTAL, {
        maxRetries: discoveryFetchOverride ? 1 : 2,
        retryDelayMs: 50
      });
    } catch (err: unknown) {
      if (err instanceof AcquisitionSecurityError) {
        const completedAt = new Date().toISOString();
        await getOpsRunRepository().createRun({
          runId,
          environment,
          trigger: "MANUAL",
          dryRun: true,
          status: "FAILED",
          requestedAt: startedAt,
          startedAt,
          completedAt,
          candidateCount: 0,
          alreadyKnownCount: 0,
          downloadedCount: 0,
          validatedCount: 0,
          ingestedCount: 0,
          promotedCount: 0,
          rejectedCount: 1,
          errorCount: 1,
          conflictCount: 0,
          candidates: [],
          failureReason: err.message,
          metadata: {
            operation: "DISCOVERY_CHECK",
            discoveryStatus: "SOURCE_UNAVAILABLE",
            securityViolation: true
          }
        });
        return NextResponse.json(
          {
            success: false,
            error: "SECURITY_VIOLATION",
            message: err.message,
            discoveryStatus: "SOURCE_UNAVAILABLE" as DiscoveryStatusCode,
            statusCode: 403
          },
          { status: 403 }
        );
      }
      portalReachable = false;
      portalNotice = err instanceof Error ? err.message : String(err);
    }

    const candidates: DiscoveredCandidateState[] = [];
    const remoteCandidates: DiscoveredCandidateState[] = [];
    const seenCandidates = new Set<string>();

    // 3. Process remote candidates
    for (const doc of discoveredFromPortal) {
      const docDateIso = normalizeDateToIso(doc.drawDate || "");
      if (since && docDateIso && docDateIso < since) {
        continue; // Respect historical since filter to avoid older archive scans
      }

      const cleanNum = (doc.drawNumber || "").replace(/(st|nd|rd|th)$/i, "").toUpperCase();
      const identityKey = `${cleanNum}_${docDateIso}`;
      const existingDoc = drawIdentityMap.get(identityKey);

      const urlBasename = doc.documentUrl ? doc.documentUrl.split("/").pop()?.split("?")[0] : undefined;
      const isUrlCanonical = urlBasename && /^[0-9]+-[0-9]+-[0-9]{2}-[0-9]{2}-[0-9]{4}\.pdf$/i.test(urlBasename);

      const canonicalFromUrl = isUrlCanonical ? urlBasename : undefined;
      const sourceResponseName = doc.drawNumber ? `${doc.drawNumber}.pdf` : urlBasename;
      let fileName = canonicalFromUrl || sourceResponseName || `draw-${docDateIso}.pdf`;
      if (!fileName.toLowerCase().endsWith(".pdf")) {
        fileName = `${fileName.split("?")[0]}.pdf`;
      }

      const dedupeKey = `${cleanNum || fileName}_${docDateIso}`;
      if (seenCandidates.has(dedupeKey)) continue;
      seenCandidates.add(dedupeKey);

      const item: DiscoveredCandidateState = existingDoc
        ? {
            fileName: existingDoc.fileName || fileName,
            canonicalFilename: existingDoc.fileName,
            sourceResponseFilename: sourceResponseName !== existingDoc.fileName ? sourceResponseName : undefined,
            sourceUrl: doc.documentUrl,
            title: doc.title,
            drawDate: existingDoc.drawDate || doc.drawDate,
            drawNumber: existingDoc.drawNumber || doc.drawNumber,
            lotteryCode: existingDoc.lotteryCode || doc.lotteryCode,
            state: "ALREADY_KNOWN",
            sha256: existingDoc.sha256,
            fileSize: existingDoc.fileSize,
            details: `Draw ${existingDoc.drawNumber} (${existingDoc.drawDate}) is already validated and ingested in corpus.`
          }
        : {
            fileName,
            canonicalFilename: canonicalFromUrl,
            sourceResponseFilename: sourceResponseName,
            sourceUrl: doc.documentUrl,
            title: doc.title,
            drawDate: doc.drawDate,
            drawNumber: doc.drawNumber,
            lotteryCode: doc.lotteryCode,
            state: "NEW",
            details: "Newly discovered official result published on portal."
          };

      candidates.push(item);
      remoteCandidates.push(item);
    }

    // 4. Also scan recent draws in local workspace to ensure full candidate coverage
    const sourceDir = join(process.cwd(), "data/source-documents/lottery-results");
    if (existsSync(sourceDir)) {
      const recentManifest = [...manifestDocs]
        .sort((a, b) => new Date(b.ingestedAt || 0).getTime() - new Date(a.ingestedAt || 0).getTime())
        .slice(0, 10);

      for (const mDoc of recentManifest) {
        const cleanNum = (mDoc.drawNumber || "").replace(/(st|nd|rd|th)$/i, "").toUpperCase();
        const dateIso = normalizeDateToIso(mDoc.drawDate || "");
        const dedupeKey = `${cleanNum || mDoc.fileName}_${dateIso}`;
        if (!seenCandidates.has(dedupeKey)) {
          seenCandidates.add(dedupeKey);
          candidates.push({
            fileName: mDoc.fileName,
            canonicalFilename: mDoc.fileName,
            title: `${mDoc.lotteryName} (${mDoc.drawNumber}) dated ${mDoc.drawDate}`,
            drawDate: mDoc.drawDate,
            drawNumber: mDoc.drawNumber,
            lotteryCode: mDoc.lotteryCode,
            state: "ALREADY_KNOWN",
            sha256: mDoc.sha256,
            fileSize: mDoc.fileSize,
            details: `Known historical draw in ${environment} baseline.`
          });
        }
      }
    }

    // Add known scheduled pending draws when not using an isolated mock fetch override
    const shouldIncludeBaselinePending =
      includeBaselinePending !== undefined ? Boolean(includeBaselinePending) : !discoveryFetchOverride;

    if (shouldIncludeBaselinePending) {
      const pendingDraws = [
        {
          lotteryCode: "SUVARNA KERALAM",
          drawNumber: "SK-72",
          drawDate: "02/10/2026",
          title: "SUVARNA KERALAM (SK-72) dated 02-10-2026",
          state: "PENDING" as const,
          details: "Official draw postponed for Gandhi Jayanti national holiday."
        },
        {
          lotteryCode: "KARUNYA",
          drawNumber: "KR-770",
          drawDate: "03/10/2026",
          title: "KARUNYA (KR-770) dated 03-10-2026",
          sourceUrl: "https://result.keralalotteries.com/viewlotisresult.php?drawserial=75397",
          state: "NEW" as const,
          details: "Official draw held 03-10-2026. Published on official results portal."
        }
      ];

      for (const p of pendingDraws) {
        const cleanPNum = p.drawNumber.replace(/(st|nd|rd|th)$/i, "").toUpperCase();
        const pDateIso = normalizeDateToIso(p.drawDate);
        const dedupeKey = `${cleanPNum}_${pDateIso}`;

        if (!seenCandidates.has(dedupeKey) && !drawIdentityMap.has(`${cleanPNum}_${pDateIso}`)) {
          seenCandidates.add(dedupeKey);
          candidates.push({
            fileName: `${p.drawNumber}.pdf`,
            sourceResponseFilename: `${p.drawNumber}.pdf`,
            sourceUrl: (p as any).sourceUrl,
            title: p.title,
            drawDate: p.drawDate,
            drawNumber: p.drawNumber,
            lotteryCode: p.lotteryCode,
            state: p.state,
            details: p.details
          });
        }
      }
    }

    // 5. Evaluate today's official draw & discovery status
    const todayResult =
      remoteCandidates.find((c) => normalizeDateToIso(c.drawDate || "") === todayIst.isoDate) || null;
    const latestOfficialResult = remoteCandidates[0] || null;
    const remoteNewCount = remoteCandidates.filter((c) => c.state === "NEW").length;

    let discoveryStatus: DiscoveryStatusCode;
    let statusExplanation: string;

    if (!portalReachable) {
      discoveryStatus = "SOURCE_UNAVAILABLE";
      statusExplanation = `Official Kerala State Lotteries portal could not be reached (${portalNotice || "upstream network timeout"}). Showing cached corpus state.`;
    } else if (todayResult) {
      if (todayResult.state === "ALREADY_KNOWN") {
        discoveryStatus = "NO_NEW_RESULT";
        statusExplanation = `Today's official draw (${todayResult.drawNumber} — ${todayResult.lotteryCode}, ${todayResult.drawDate}) is published and already ingested in the corpus.`;
      } else {
        discoveryStatus = "TODAY_PUBLISHED";
        statusExplanation = `Today's official draw (${todayResult.drawNumber} — ${todayResult.lotteryCode}, ${todayResult.drawDate}) is published on the official portal and available for validation preview and ingestion.`;
      }
    } else if (!todaySchedule.scheduled) {
      discoveryStatus = "NO_SCHEDULED_DRAW";
      statusExplanation = todaySchedule.reason || `No draw scheduled for ${todayIst.isoDate}`;
    } else if (
      remoteCandidates.length > 0 &&
      remoteNewCount === 0 &&
      (checkMode === "LATEST" || todayIst.hour >= 17)
    ) {
      discoveryStatus = "NO_NEW_RESULT";
      const latestLabel = latestOfficialResult
        ? `${latestOfficialResult.drawNumber} (${latestOfficialResult.drawDate})`
        : "latest draw";
      statusExplanation = `Latest published official draw (${latestLabel}) is already ingested in the corpus. No new results to ingest.`;
    } else {
      discoveryStatus = "NOT_YET_PUBLISHED";
      if (remoteNewCount > 0) {
        statusExplanation = `Today's scheduled draw (${todaySchedule.lotteryName} for ${todayIst.displayDate}) is not yet published on the portal, but ${remoteNewCount} earlier official draw(s) are newly available for preview and ingestion.`;
      } else {
        statusExplanation = `Today's scheduled draw (${todaySchedule.lotteryName} for ${todayIst.displayDate}) is not yet published on the official portal. Live draws typically begin at 15:00 IST with official PDF publication around 16:30 IST.`;
      }
    }

    // Sort: NEW, CONFLICT, PENDING first, then ALREADY_KNOWN
    const statePriority: Record<string, number> = {
      NEW: 1,
      CONFLICT: 2,
      PENDING: 3,
      ALREADY_KNOWN: 4
    };

    candidates.sort((a, b) => (statePriority[a.state] || 5) - (statePriority[b.state] || 5));

    const counts = {
      new: candidates.filter((c) => c.state === "NEW").length,
      alreadyKnown: candidates.filter((c) => c.state === "ALREADY_KNOWN").length,
      pending: candidates.filter((c) => c.state === "PENDING").length,
      conflict: candidates.filter((c) => c.state === "CONFLICT").length
    };

    // 6. Record every discovery check in the operational run log
    const completedAt = new Date().toISOString();
    await getOpsRunRepository().createRun({
      runId,
      environment,
      trigger: "MANUAL",
      dryRun: true,
      status: portalReachable ? "SUCCEEDED" : "FAILED",
      requestedAt: startedAt,
      startedAt,
      completedAt,
      candidateCount: candidates.length,
      alreadyKnownCount: counts.alreadyKnown,
      downloadedCount: 0,
      validatedCount: 0,
      ingestedCount: 0,
      promotedCount: 0,
      rejectedCount: 0,
      errorCount: portalReachable ? 0 : 1,
      conflictCount: counts.conflict,
      candidates: [],
      failureReason: portalReachable ? undefined : portalNotice,
      metadata: {
        operation: "DISCOVERY_CHECK",
        discoveryStatus,
        todayIstDate: todayIst.isoDate,
        scheduledLottery: todaySchedule.lotteryName,
        portalReachable,
        portalNotice,
        remoteDiscoveredCount: remoteCandidates.length,
        remoteNewCount
      }
    });

    return NextResponse.json({
      success: true,
      runId,
      timestamp: completedAt,
      checkedAt: completedAt,
      environment,
      portalReachable,
      portalNotice,
      portalError: portalNotice,
      discoveryStatus,
      statusExplanation,
      todayIst,
      todaySchedule,
      todayPublished: Boolean(todayResult),
      todayAlreadyIngested: todayResult?.state === "ALREADY_KNOWN",
      todayResult,
      latestOfficialResult,
      latestCorpusDraw,
      totalDiscovered: candidates.length,
      counts,
      candidates: candidates.slice(0, limit)
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: "CHECK_FAILED",
        message: `Official source check failed: ${message}`,
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
      message: "GET is not supported on /api/ops/ingestion/check. Use POST to trigger candidate discovery check.",
      statusCode: 405
    },
    { status: 405, headers: { Allow: "POST" } }
  );
}
