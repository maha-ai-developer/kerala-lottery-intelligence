/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Official Result Catch-Up Engine — Last Ingested Date Through Today (IST)
 *
 * Automatically calculates the missing date range:
 *   lastVerifiedIngestedDrawDate < drawDate <= currentISTDate
 * enumerates official LOTIS results and upcoming schedule, classifies every candidate,
 * supports dry-run validation of all eligible candidates, and executes sequential
 * operator-confirmed DEV ingestion.
 */

import {
  computeSha256,
  validatePdfBuffer,
  DEFAULT_MAX_UPLOAD_BYTES,
  KERALA_STATE_LOTTERY_PORTAL,
  validateSafeUrl,
  type OfficialSource
} from "@kerala-lottery/documents";
import { normalizeDateToIso } from "@kerala-lottery/domain";
import {
  OfficialSourceDiscoveryService,
  getIstDateInfo,
  getScheduledLotteryForIstDate,
  type IstDateInfo,
  type ScheduledLotteryInfo,
  type UpcomingScheduledDraw
} from "./discovery";
import { DocumentAcquisitionService } from "./acquisition";
import { DocumentCacheManager, type IngestedDocumentRecord } from "./document-cache";
import {
  DailyIngestionEngine,
  resolveCanonicalAndResponseFilename,
  type InjectedCandidate,
  type CandidateAuditRecord
} from "./daily-ingestion-engine";
import type { SourceIngestionService } from "./index";

type FetchLike = typeof fetch;

export type CatchUpCandidateClassification =
  | "NEW_ELIGIBLE"
  | "ALREADY_INGESTED_BY_SHA256"
  | "ALREADY_INGESTED_BY_DRAW_IDENTITY"
  | "CONFLICT_DIFF_HASH"
  | "INVALID_SCHEME_OR_PARSE_ERROR"
  | "NOT_PUBLISHED_YET";

export type CatchUpMode = "DISCOVER" | "DRY_RUN" | "INGEST";

export interface CatchUpVerifiedDrawSummary {
  drawNumber: string;
  lotteryName: string;
  lotteryCode: string;
  drawDate: string;
  isoDate: string;
  sha256: string;
  canonicalFilename: string;
  resultCount: number;
}

export type CatchUpFinalDisposition =
  | "ALREADY_PRESENT"
  | "READY_TO_INGEST"
  | "INGESTED"
  | "REJECTED"
  | "CONFLICTING"
  | "UNAVAILABLE";

export interface CatchUpCandidateRecord {
  drawNumber: string;
  lotteryName: string;
  lotteryCode: string;
  drawDate: string;
  isoDate: string;
  title: string;
  officialListingUrl: string;
  sourceUrl?: string;
  retrievedAt: string;
  canonicalFilename?: string;
  sourceResponseFilename?: string;
  sha256?: string;
  fileSize?: number;
  localCorpusStatus: "PRESENT_VALID" | "MISSING" | "NOT_APPLICABLE";
  devCloudStorageStatus: "PRESENT" | "MISSING" | "UNVERIFIED" | "NOT_APPLICABLE";
  devFirestoreStatus: "PRESENT" | "MISSING" | "UNVERIFIED" | "NOT_APPLICABLE";
  classification: CatchUpCandidateClassification;
  validationStatus:
    | "VALID"
    | "INVALID"
    | "CONFLICT"
    | "PENDING"
    | "UNVERIFIED"
    | "ALREADY_KNOWN"
    | "REJECTED"
    | "SKIPPED";
  finalDisposition: CatchUpFinalDisposition;
  actionTaken?: "INGESTED" | "SKIPPED_EXISTING" | "DRY_RUN_VALIDATED" | "REJECTED" | "NONE";
  schemeId?: string;
  schemeAuthorityLevel?: string;
  resultCount?: number;
  fullTicketCount?: number;
  suffixCount?: number;
  leadingZeroCount?: number;
  sampleLeadingZeroNumbers?: string[];
  prizeTierSummary?: Array<{
    rank: string;
    label: string;
    amount: number;
    winnerCount: number;
    resultGranularity: "FULL_TICKET" | "SUFFIX_4D";
  }>;
  firstPrize?: {
    ticketNumber: string;
    series?: string;
    location?: string;
    amount: number;
  };
  secondPrize?: {
    ticketNumber: string;
    series?: string;
    location?: string;
    amount: number;
  };
  thirdPrize?: {
    ticketNumber: string;
    series?: string;
    location?: string;
    amount: number;
  };
  cloudStoragePath?: string;
  firestoreDocumentId?: string;
  details: string;
}

export interface CatchUpExecutionOptions {
  mode: CatchUpMode;
  environment?: "DEV" | "PROD";
  referenceDate?: string | Date;
  afterDrawDateIso?: string;
  cacheDir?: string;
  sourceDir?: string;
  officialSource?: OfficialSource;
  fetchImpl?: FetchLike;
  sourceIngestionService?: SourceIngestionService;
  runId?: string;
}

export interface CatchUpExecutionResult {
  runId: string;
  mode: CatchUpMode;
  environment: "DEV" | "PROD";
  startedAt: string;
  completedAt: string;
  portalReachable: boolean;
  portalNotice?: string;
  currentIst: IstDateInfo;
  lastVerifiedIngestedDraw: CatchUpVerifiedDrawSummary | null;
  catchUpRange: {
    afterDrawDateIso: string;
    throughDrawDateIso: string;
    formula: string;
  };
  todaySchedule: ScheduledLotteryInfo;
  todayStatus: {
    isoDate: string;
    displayDate: string;
    drawNumber?: string;
    lotteryName?: string;
    classification: CatchUpCandidateClassification | "NO_SCHEDULED_DRAW";
    summary: string;
  };
  plainLanguageSummary: {
    lastIngestedResult: string;
    publishedResultsFoundSinceThen: number;
    eligibleToIngestCount: number;
    alreadyIngestedCount: number;
    todaysDrawSummary: string;
  };
  counts: {
    totalInCatchUpRange: number;
    publishedInCatchUpRange: number;
    newEligible: number;
    alreadyIngestedBySha256: number;
    alreadyIngestedByDrawIdentity: number;
    conflictDiffHash: number;
    invalidSchemeOrParseError: number;
    notPublishedYet: number;
    ingestedThisRun: number;
  };
  corpusBefore: {
    totalDraws: number;
    totalResults: number;
    fullTicketResults: number;
    suffixResults: number;
    latestDrawNumber: string;
    latestDrawDate: string;
  };
  corpusAfter: {
    totalDraws: number;
    totalResults: number;
    fullTicketResults: number;
    suffixResults: number;
    latestDrawNumber: string;
    latestDrawDate: string;
  };
  candidates: CatchUpCandidateRecord[];
}

function cleanDrawCode(drawNumber: string): string {
  return (drawNumber || "").replace(/(st|nd|rd|th)$/i, "").trim().toUpperCase();
}

function formatDisplayDateShort(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const [y, m, d] = isoDate.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d} ${months[(m || 1) - 1]} ${y}`;
}

export class OfficialResultCatchUpEngine {
  private readonly cacheManager: DocumentCacheManager;
  private readonly discoveryService: OfficialSourceDiscoveryService;
  private readonly acquisitionService: DocumentAcquisitionService;

  constructor(private readonly options: CatchUpExecutionOptions) {
    this.cacheManager = new DocumentCacheManager({ cacheDir: options.cacheDir });
    this.discoveryService = new OfficialSourceDiscoveryService(options.fetchImpl);
    this.acquisitionService = new DocumentAcquisitionService(options.fetchImpl);
  }

  private getCorpusSnapshot(): {
    lastVerifiedDraw: CatchUpVerifiedDrawSummary | null;
    shaMap: Map<string, IngestedDocumentRecord>;
    drawIdentityMap: Map<string, IngestedDocumentRecord>;
    drawCodeMap: Map<string, IngestedDocumentRecord>;
    summary: {
      totalDraws: number;
      totalResults: number;
      fullTicketResults: number;
      suffixResults: number;
      latestDrawNumber: string;
      latestDrawDate: string;
    };
  } {
    const freshCache = new DocumentCacheManager({ cacheDir: this.options.cacheDir });
    const manifest = freshCache.getManifest();
    const docs = Object.values(manifest.documents || {});
    const shaMap = new Map<string, IngestedDocumentRecord>();
    const drawIdentityMap = new Map<string, IngestedDocumentRecord>();
    const drawCodeMap = new Map<string, IngestedDocumentRecord>();

    let lastVerifiedDraw: CatchUpVerifiedDrawSummary | null = null;
    let totalDraws = 0;
    let totalResults = 0;
    let fullTicketResults = 0;
    let suffixResults = 0;

    for (const doc of docs) {
      if (doc.status !== "VALID") continue;
      const isoDate = normalizeDateToIso(doc.drawDate || "");
      const code = cleanDrawCode(doc.drawNumber || "");
      const docResults = doc.totalResults || (doc as any).resultCount || 0;
      totalDraws++;
      totalResults += docResults;
      fullTicketResults += doc.fullTicketCount || 0;
      suffixResults += doc.suffixCount || 0;

      if (doc.sha256) {
        shaMap.set(doc.sha256, doc);
      }
      if (code && isoDate) {
        drawIdentityMap.set(`${code}_${isoDate}`, doc);
      }
      if (code) {
        drawCodeMap.set(code, doc);
      }

      if (isoDate && (!lastVerifiedDraw || isoDate > lastVerifiedDraw.isoDate)) {
        lastVerifiedDraw = {
          drawNumber: doc.drawNumber,
          lotteryName: doc.lotteryName,
          lotteryCode: doc.lotteryCode,
          drawDate: doc.drawDate,
          isoDate,
          sha256: doc.sha256,
          canonicalFilename: doc.canonicalFilename || doc.fileName,
          resultCount: docResults
        };
      }
    }

    return {
      lastVerifiedDraw,
      shaMap,
      drawIdentityMap,
      drawCodeMap,
      summary: {
        totalDraws,
        totalResults,
        fullTicketResults,
        suffixResults,
        latestDrawNumber: lastVerifiedDraw ? cleanDrawCode(lastVerifiedDraw.drawNumber) : "None",
        latestDrawDate: lastVerifiedDraw?.isoDate || "2026-06-01"
      }
    };
  }

  async execute(): Promise<CatchUpExecutionResult> {
    const startedAt = new Date().toISOString();
    const environment = this.options.environment || "DEV";
    const mode = this.options.mode || "DISCOVER";
    const runId =
      this.options.runId ||
      `run_ops_catchup_${mode.toLowerCase()}_${startedAt.replace(/[:.]/g, "-")}_${Math.random().toString(36).substring(2, 8)}`;

    const refDate = this.options.referenceDate ? new Date(this.options.referenceDate) : new Date();
    const currentIst = getIstDateInfo(Number.isNaN(refDate.getTime()) ? new Date() : refDate);
    const todaySchedule = getScheduledLotteryForIstDate(currentIst.isoDate);

    const beforeSnapshot = this.getCorpusSnapshot();
    const afterDrawDateIso =
      this.options.afterDrawDateIso || beforeSnapshot.lastVerifiedDraw?.isoDate || "2026-06-01";
    const throughDrawDateIso = currentIst.isoDate;

    const officialSource = this.options.officialSource || KERALA_STATE_LOTTERY_PORTAL;
    let discoveredFromPortal: Awaited<ReturnType<OfficialSourceDiscoveryService["discover"]>> = [];
    let upcomingSchedule: UpcomingScheduledDraw[] = [];
    let portalReachable = true;
    let portalNotice: string | undefined;

    try {
      discoveredFromPortal = await this.discoveryService.discover(officialSource, {
        maxRetries: this.options.fetchImpl ? 1 : 2,
        retryDelayMs: 50
      });
      if (todaySchedule.scheduled) {
        upcomingSchedule = await this.discoveryService.discoverUpcomingSchedule(officialSource, {
          maxRetries: 1,
          retryDelayMs: 50
        });
        const liveUpcomingToday = upcomingSchedule.find((u) => u.drawDate === currentIst.isoDate);
        if (liveUpcomingToday) {
          if (liveUpcomingToday.lotteryName) todaySchedule.lotteryName = liveUpcomingToday.lotteryName;
          if (liveUpcomingToday.lotteryCode) {
            todaySchedule.lotteryCode = liveUpcomingToday.lotteryCode;
            todaySchedule.scheduledLotteryCode = liveUpcomingToday.lotteryCode;
          }
          if (liveUpcomingToday.drawNumber) todaySchedule.drawNumber = liveUpcomingToday.drawNumber;
          if (liveUpcomingToday.drawTimeIst) todaySchedule.drawTimeIst = liveUpcomingToday.drawTimeIst;
          if (liveUpcomingToday.venue) todaySchedule.venue = liveUpcomingToday.venue;
          if (liveUpcomingToday.rawTitle) todaySchedule.rawScheduleTitle = liveUpcomingToday.rawTitle;
        }
      }
    } catch (err: unknown) {
      portalReachable = false;
      portalNotice = err instanceof Error ? err.message : String(err);
    }

    // Filter discovered published results in (afterDrawDateIso, throughDrawDateIso]
    const strictInRangePublished = discoveredFromPortal
      .map((doc) => {
        const isoDate = normalizeDateToIso(doc.drawDate || "");
        return { doc, isoDate };
      })
      .filter(({ isoDate }) => Boolean(isoDate && isoDate > afterDrawDateIso && isoDate <= throughDrawDateIso))
      .sort((a, b) => a.isoDate.localeCompare(b.isoDate));

    const v1BaselineEndIso = "2026-10-13";
    const inRangePublished =
      strictInRangePublished.length > 0 || this.options.afterDrawDateIso
        ? strictInRangePublished
        : discoveredFromPortal
            .map((doc) => {
              const isoDate = normalizeDateToIso(doc.drawDate || "");
              return { doc, isoDate };
            })
            .filter(({ isoDate }) => Boolean(isoDate && isoDate > v1BaselineEndIso && isoDate <= throughDrawDateIso))
            .sort((a, b) => a.isoDate.localeCompare(b.isoDate));

    const candidates: CatchUpCandidateRecord[] = [];
    let ingestedThisRun = 0;

    for (const { doc, isoDate } of inRangePublished) {
      const code = cleanDrawCode(doc.drawNumber || "");
      const identityKey = `${code}_${isoDate}`;
      const existingByIdentity =
        beforeSnapshot.drawIdentityMap.get(identityKey) || (code ? beforeSnapshot.drawCodeMap.get(code) : undefined);

      const displayDateParts = isoDate.split("-");
      const displayDate =
        displayDateParts.length === 3
          ? `${displayDateParts[2]}/${displayDateParts[1]}/${displayDateParts[0]}`
          : doc.drawDate || isoDate;

      const sourceResponseFilename = code ? `${code}.pdf` : `${isoDate}.pdf`;
      const retrievedAt = new Date().toISOString();

      if (mode === "DISCOVER") {
        if (existingByIdentity) {
          let devCloudStorageStatus: CatchUpCandidateRecord["devCloudStorageStatus"] = "UNVERIFIED";
          let devFirestoreStatus: CatchUpCandidateRecord["devFirestoreStatus"] = "UNVERIFIED";
          if (this.options.sourceIngestionService && existingByIdentity.sha256) {
            try {
              const residency = await this.options.sourceIngestionService.checkResidency(existingByIdentity.sha256);
              devCloudStorageStatus = residency.inCloudStorage ? "PRESENT" : "MISSING";
              devFirestoreStatus = residency.inFirestore ? "PRESENT" : "MISSING";
            } catch {
              devCloudStorageStatus = "UNVERIFIED";
              devFirestoreStatus = "UNVERIFIED";
            }
          }
          candidates.push({
            drawNumber: existingByIdentity.drawNumber || code,
            lotteryName: existingByIdentity.lotteryName || doc.lotteryCode || "Unknown",
            lotteryCode: existingByIdentity.lotteryCode || doc.lotteryCode || "Unknown",
            drawDate: existingByIdentity.drawDate || displayDate,
            isoDate,
            title: doc.title,
            officialListingUrl: officialSource.discoveryUrl,
            sourceUrl: doc.documentUrl,
            retrievedAt,
            canonicalFilename: existingByIdentity.canonicalFilename || existingByIdentity.fileName,
            sourceResponseFilename,
            sha256: existingByIdentity.sha256,
            fileSize: existingByIdentity.fileSize,
            localCorpusStatus: "PRESENT_VALID",
            devCloudStorageStatus,
            devFirestoreStatus,
            classification: "ALREADY_INGESTED_BY_DRAW_IDENTITY",
            validationStatus: "VALID",
            finalDisposition: "ALREADY_PRESENT",
            actionTaken: "SKIPPED_EXISTING",
            resultCount: existingByIdentity.totalResults,
            fullTicketCount: existingByIdentity.fullTicketCount,
            suffixCount: existingByIdentity.suffixCount,
            details: `Draw ${existingByIdentity.drawNumber} (${existingByIdentity.drawDate}) is already verified in active corpus.`
          });
        } else {
          candidates.push({
            drawNumber: doc.drawNumber || code || "Unknown",
            lotteryName: (doc.lotteryCode || "Unknown").replace(/-/g, " "),
            lotteryCode: doc.lotteryCode || "Unknown",
            drawDate: displayDate,
            isoDate,
            title: doc.title,
            officialListingUrl: officialSource.discoveryUrl,
            sourceUrl: doc.documentUrl,
            retrievedAt,
            sourceResponseFilename,
            localCorpusStatus: "MISSING",
            devCloudStorageStatus: "UNVERIFIED",
            devFirestoreStatus: "UNVERIFIED",
            classification: "NEW_ELIGIBLE",
            validationStatus: "UNVERIFIED",
            finalDisposition: "READY_TO_INGEST",
            actionTaken: "NONE",
            details: `Published on official LOTIS portal (${displayDate}); eligible for dry-run validation and DEV ingestion.`
          });
        }
        continue;
      }

      // DRY_RUN or INGEST mode: acquire PDF bytes, validate %PDF- and prize scheme
      let fileBuffer: Uint8Array;
      let acquiredFileName: string | undefined;
      try {
        validateSafeUrl(doc.documentUrl, officialSource.allowedDomains);
        const acq = await this.acquisitionService.acquire({
          url: doc.documentUrl,
          officialSource,
          title: doc.title
        });
        fileBuffer = acq.fileBuffer;
        acquiredFileName = acq.fileName;
        validatePdfBuffer(fileBuffer, {
          maxBytes: DEFAULT_MAX_UPLOAD_BYTES,
          requireEofMarker: true
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        candidates.push({
          drawNumber: doc.drawNumber || code || "Unknown",
          lotteryName: (doc.lotteryCode || "Unknown").replace(/-/g, " "),
          lotteryCode: doc.lotteryCode || "Unknown",
          drawDate: displayDate,
          isoDate,
          title: doc.title,
          officialListingUrl: officialSource.discoveryUrl,
          sourceUrl: doc.documentUrl,
          retrievedAt,
          sourceResponseFilename,
          localCorpusStatus: "MISSING",
          devCloudStorageStatus: "MISSING",
          devFirestoreStatus: "MISSING",
          classification: "INVALID_SCHEME_OR_PARSE_ERROR",
          validationStatus: "INVALID",
          finalDisposition: "REJECTED",
          actionTaken: "REJECTED",
          details: `PDF acquisition or signature validation failed: ${msg}`
        });
        continue;
      }

      const sha256 = computeSha256(fileBuffer);
      const existingBySha = beforeSnapshot.shaMap.get(sha256);
      const resolvedNames = resolveCanonicalAndResponseFilename(
        acquiredFileName || sourceResponseFilename,
        sha256,
        acquiredFileName && /^[0-9]+-[0-9]+-[0-9]{2}-[0-9]{2}-[0-9]{4}\.pdf$/i.test(acquiredFileName)
          ? acquiredFileName
          : undefined,
        sourceResponseFilename,
        doc.documentUrl,
        { candidateDrawNumber: doc.drawNumber }
      );

      // Check pre-ingestion cloud residency if sourceIngestionService is provided
      let devCloudStorageStatus: CatchUpCandidateRecord["devCloudStorageStatus"] = "UNVERIFIED";
      let devFirestoreStatus: CatchUpCandidateRecord["devFirestoreStatus"] = "UNVERIFIED";
      if (this.options.sourceIngestionService) {
        try {
          const residency = await this.options.sourceIngestionService.checkResidency(sha256);
          devCloudStorageStatus = residency.inCloudStorage ? "PRESENT" : "MISSING";
          devFirestoreStatus = residency.inFirestore ? "PRESENT" : "MISSING";
        } catch {
          devCloudStorageStatus = "UNVERIFIED";
          devFirestoreStatus = "UNVERIFIED";
        }
      }

      // Run dry-run validation through DailyIngestionEngine first
      const injected: InjectedCandidate = {
        fileName: resolvedNames.canonicalFilename || sourceResponseFilename,
        canonicalFilename: resolvedNames.canonicalFilename,
        sourceResponseFilename: resolvedNames.sourceResponseFilename,
        fileBuffer,
        sourceUrl: doc.documentUrl,
        title: doc.title,
        drawDate: displayDate,
        drawNumber: doc.drawNumber,
        lotteryCode: doc.lotteryCode
      };

      const dryEngine = new DailyIngestionEngine({
        dryRun: true,
        silent: true,
        limit: 1,
        injectedCandidates: [injected],
        acquisitionService: this.acquisitionService,
        discoveryService: this.discoveryService,
        environment,
        cacheDir: this.options.cacheDir,
        sourceDir: this.options.sourceDir
      });

      const dryResult = await dryEngine.execute();
      const dryAudit: CandidateAuditRecord | undefined = dryResult.candidates[0];

      // Determine classification
      let classification: CatchUpCandidateClassification;
      if (existingBySha) {
        classification = "ALREADY_INGESTED_BY_SHA256";
      } else if (existingByIdentity && existingByIdentity.sha256 !== sha256) {
        classification = "CONFLICT_DIFF_HASH";
      } else if (existingByIdentity) {
        classification = "ALREADY_INGESTED_BY_DRAW_IDENTITY";
      } else if (!dryAudit || dryAudit.validationStatus === "INVALID") {
        classification = "INVALID_SCHEME_OR_PARSE_ERROR";
      } else if (dryAudit.validationStatus === "CONFLICT") {
        classification = "CONFLICT_DIFF_HASH";
      } else {
        classification = "NEW_ELIGIBLE";
      }

      let finalAudit = dryAudit;
      let actionTaken: CatchUpCandidateRecord["actionTaken"] =
        classification === "NEW_ELIGIBLE"
          ? "DRY_RUN_VALIDATED"
          : classification.startsWith("ALREADY_INGESTED")
            ? "SKIPPED_EXISTING"
            : "REJECTED";
      let cloudStoragePath: string | undefined =
        devCloudStorageStatus === "PRESENT" ? `source-documents/${sha256}.pdf` : undefined;
      let firestoreDocumentId: string | undefined =
        devFirestoreStatus === "PRESENT" ? sha256 : undefined;
      let localCorpusStatus: CatchUpCandidateRecord["localCorpusStatus"] =
        existingBySha || existingByIdentity ? "PRESENT_VALID" : "MISSING";

      // If mode === "INGEST" and candidate is NEW_ELIGIBLE, ingest into DEV
      if (mode === "INGEST" && classification === "NEW_ELIGIBLE") {
        const ingestEngine = new DailyIngestionEngine({
          dryRun: false,
          silent: true,
          limit: 1,
          injectedCandidates: [injected],
          acquisitionService: this.acquisitionService,
          discoveryService: this.discoveryService,
          sourceIngestionService: this.options.sourceIngestionService,
          environment,
          cacheDir: this.options.cacheDir,
          sourceDir: this.options.sourceDir
        });
        const ingestResult = await ingestEngine.execute();
        if (ingestResult.candidates[0]) {
          finalAudit = ingestResult.candidates[0];
        }
        if (ingestResult.success && finalAudit?.validationStatus === "VALID") {
          actionTaken = "INGESTED";
          ingestedThisRun++;
          localCorpusStatus = "PRESENT_VALID";
          if (this.options.sourceIngestionService) {
            devCloudStorageStatus = "PRESENT";
            devFirestoreStatus = "PRESENT";
          }
          cloudStoragePath = `source-documents/${sha256}.pdf`;
          firestoreDocumentId = sha256;
        } else {
          actionTaken = "REJECTED";
          classification =
            finalAudit?.validationStatus === "CONFLICT"
              ? "CONFLICT_DIFF_HASH"
              : "INVALID_SCHEME_OR_PARSE_ERROR";
        }
      }

      const finalDisposition: CatchUpFinalDisposition =
        actionTaken === "INGESTED"
          ? "INGESTED"
          : classification.startsWith("ALREADY_INGESTED")
            ? "ALREADY_PRESENT"
            : classification === "NEW_ELIGIBLE"
              ? "READY_TO_INGEST"
              : classification === "CONFLICT_DIFF_HASH"
                ? "CONFLICTING"
                : "REJECTED";

      // Extract top 3 prizes from cached graph if ingested, or from dryAudit prizeTierSummary
      const graphRecord = this.cacheManager.getGraph(sha256);
      const findTopPrize = (rankNum: number) => {
        if (graphRecord) {
          const match = graphRecord.nodes.find(
            (n) => n.type === "WinningResult" && n.properties?.rank === rankNum
          );
          if (match && match.properties) {
            return {
              ticketNumber: String(match.properties.canonicalNumber || ""),
              series: match.properties.series ? String(match.properties.series) : undefined,
              location: match.properties.location ? String(match.properties.location) : undefined,
              amount: typeof match.properties.amount === "number" ? match.properties.amount : 0
            };
          }
        }
        const tier = finalAudit?.prizeTierSummary?.find(
          (t: any) => t.rank === rankNum || t.rank === `${rankNum}`
        );
        if (tier && tier.sampleNumbers && tier.sampleNumbers.length > 0) {
          const sample = String(tier.sampleNumbers[0] || "").trim();
          const parts = sample.split(/\s+/);
          const p0 = parts[0] || "";
          const p1 = parts[1] || "";
          const hasSeries = parts.length >= 2 && /^[A-Z]{1,2}$/i.test(p0);
          return {
            ticketNumber: hasSeries ? p1 : p0,
            series: hasSeries ? p0 : undefined,
            amount: typeof tier.amount === "number" ? tier.amount : 0
          };
        }
        return undefined;
      };

      candidates.push({
        drawNumber: finalAudit?.drawNumber || doc.drawNumber || code || "Unknown",
        lotteryName: finalAudit?.lottery || (doc.lotteryCode || "Unknown").replace(/-/g, " "),
        lotteryCode: doc.lotteryCode || finalAudit?.lottery || "Unknown",
        drawDate: finalAudit?.drawDate || displayDate,
        isoDate,
        title: doc.title,
        officialListingUrl: officialSource.discoveryUrl,
        sourceUrl: doc.documentUrl,
        retrievedAt,
        canonicalFilename: finalAudit?.canonicalFilename || resolvedNames.canonicalFilename,
        sourceResponseFilename: finalAudit?.sourceResponseFilename || resolvedNames.sourceResponseFilename,
        sha256,
        fileSize: fileBuffer.byteLength,
        localCorpusStatus,
        devCloudStorageStatus,
        devFirestoreStatus,
        classification,
        validationStatus: finalAudit?.validationStatus || "INVALID",
        finalDisposition,
        actionTaken,
        schemeId: finalAudit?.schemeId,
        schemeAuthorityLevel: finalAudit?.schemeAuthorityLevel,
        resultCount: finalAudit?.resultCount,
        fullTicketCount: finalAudit?.fullTicketCount,
        suffixCount: finalAudit?.suffixCount,
        leadingZeroCount: finalAudit?.leadingZeroCount,
        sampleLeadingZeroNumbers: finalAudit?.sampleLeadingZeroNumbers,
        prizeTierSummary: finalAudit?.prizeTierSummary as any,
        firstPrize: findTopPrize(1),
        secondPrize: findTopPrize(2),
        thirdPrize: findTopPrize(3),
        cloudStoragePath,
        firestoreDocumentId,
        details:
          actionTaken === "INGESTED"
            ? `Validated against ${finalAudit?.schemeId} (${finalAudit?.resultCount} records: ${finalAudit?.fullTicketCount} full + ${finalAudit?.suffixCount} suffix) and ingested into ${environment}.`
            : classification === "NEW_ELIGIBLE"
              ? `Dry-run validated against ${finalAudit?.schemeId} (${finalAudit?.resultCount} records: ${finalAudit?.fullTicketCount} full + ${finalAudit?.suffixCount} suffix, ${finalAudit?.leadingZeroCount} leading-zero strings). Ready for ${environment} ingestion.`
              : finalAudit?.conflictDetails ||
                finalAudit?.errorDetails ||
                `Already ingested in active corpus (${sha256.slice(0, 12)}...).`
      });
    }

    // Check today's scheduled draw status
    const todayPublishedCandidate = candidates.find((c) => c.isoDate === currentIst.isoDate);
    const afterSnapshot = this.getCorpusSnapshot();
    const todayInCorpus = afterSnapshot.drawIdentityMap.get(
      `${cleanDrawCode(todaySchedule.drawNumber || "")}_${currentIst.isoDate}`
    );

    let todayStatus: CatchUpExecutionResult["todayStatus"];
    if (todayPublishedCandidate) {
      todayStatus = {
        isoDate: currentIst.isoDate,
        displayDate: currentIst.displayDate,
        drawNumber: cleanDrawCode(todayPublishedCandidate.drawNumber),
        lotteryName: todayPublishedCandidate.lotteryName,
        classification: todayPublishedCandidate.classification,
        summary: `${cleanDrawCode(todayPublishedCandidate.drawNumber)} (${todayPublishedCandidate.lotteryName}) — published (${todayPublishedCandidate.classification})`
      };
    } else if (todayInCorpus) {
      todayStatus = {
        isoDate: currentIst.isoDate,
        displayDate: currentIst.displayDate,
        drawNumber: cleanDrawCode(todayInCorpus.drawNumber),
        lotteryName: todayInCorpus.lotteryName,
        classification: "ALREADY_INGESTED_BY_DRAW_IDENTITY",
        summary: `${cleanDrawCode(todayInCorpus.drawNumber)} (${todayInCorpus.lotteryName}) — already ingested`
      };
    } else if (todaySchedule.scheduled) {
      const todayCode = cleanDrawCode(todaySchedule.drawNumber || todaySchedule.drawSeriesPrefix || "TODAY");
      const todayLotteryName = todaySchedule.lotteryName || "Scheduled Draw";
      const notPublishedCandidate: CatchUpCandidateRecord = {
        drawNumber: todayCode,
        lotteryName: todayLotteryName,
        lotteryCode: todaySchedule.lotteryCode || todayLotteryName,
        drawDate: currentIst.displayDate,
        isoDate: currentIst.isoDate,
        title:
          todaySchedule.rawScheduleTitle ||
          `${todayLotteryName} (${todayCode}) scheduled for ${currentIst.displayDate}`,
        officialListingUrl: officialSource.discoveryUrl,
        retrievedAt: new Date().toISOString(),
        localCorpusStatus: "NOT_APPLICABLE",
        devCloudStorageStatus: "NOT_APPLICABLE",
        devFirestoreStatus: "NOT_APPLICABLE",
        classification: "NOT_PUBLISHED_YET",
        validationStatus: "PENDING",
        finalDisposition: "UNAVAILABLE",
        actionTaken: "NONE",
        details: `Scheduled for ${currentIst.displayDate} at ${todaySchedule.drawTimeIst}${todaySchedule.venue ? ` (${todaySchedule.venue})` : ""}; official result PDF is not published yet on LOTIS.`
      };
      if (currentIst.isoDate > afterDrawDateIso) {
        candidates.push(notPublishedCandidate);
      }
      todayStatus = {
        isoDate: currentIst.isoDate,
        displayDate: currentIst.displayDate,
        drawNumber: todayCode,
        lotteryName: todayLotteryName,
        classification: "NOT_PUBLISHED_YET",
        summary: `${todayCode} — not published yet`
      };
    } else {
      todayStatus = {
        isoDate: currentIst.isoDate,
        displayDate: currentIst.displayDate,
        classification: "NO_SCHEDULED_DRAW",
        summary: todaySchedule.reason || `No draw scheduled for ${currentIst.displayDate}`
      };
    }

    const publishedCandidates = candidates.filter((c) => c.classification !== "NOT_PUBLISHED_YET");
    const counts = {
      totalInCatchUpRange: candidates.length,
      publishedInCatchUpRange: publishedCandidates.length,
      newEligible: candidates.filter((c) => c.classification === "NEW_ELIGIBLE").length,
      alreadyIngestedBySha256: candidates.filter((c) => c.classification === "ALREADY_INGESTED_BY_SHA256").length,
      alreadyIngestedByDrawIdentity: candidates.filter(
        (c) => c.classification === "ALREADY_INGESTED_BY_DRAW_IDENTITY"
      ).length,
      conflictDiffHash: candidates.filter((c) => c.classification === "CONFLICT_DIFF_HASH").length,
      invalidSchemeOrParseError: candidates.filter((c) => c.classification === "INVALID_SCHEME_OR_PARSE_ERROR").length,
      notPublishedYet: candidates.filter((c) => c.classification === "NOT_PUBLISHED_YET").length,
      ingestedThisRun
    };

    const lastDrawRef = afterSnapshot.lastVerifiedDraw || beforeSnapshot.lastVerifiedDraw;
    const lastIngestedResultLabel = lastDrawRef
      ? `${cleanDrawCode(lastDrawRef.drawNumber)} (${formatDisplayDateShort(lastDrawRef.isoDate)})`
      : "None";

    const completedAt = new Date().toISOString();

    return {
      runId,
      mode,
      environment,
      startedAt,
      completedAt,
      portalReachable,
      portalNotice,
      currentIst,
      lastVerifiedIngestedDraw: afterSnapshot.lastVerifiedDraw || beforeSnapshot.lastVerifiedDraw,
      catchUpRange: {
        afterDrawDateIso,
        throughDrawDateIso,
        formula: `drawDate > ${afterDrawDateIso} AND drawDate <= ${throughDrawDateIso}`
      },
      todaySchedule,
      todayStatus,
      plainLanguageSummary: {
        lastIngestedResult: lastIngestedResultLabel,
        publishedResultsFoundSinceThen: this.options.afterDrawDateIso
          ? publishedCandidates.length
          : strictInRangePublished.length,
        eligibleToIngestCount: counts.newEligible,
        alreadyIngestedCount: counts.alreadyIngestedBySha256 + counts.alreadyIngestedByDrawIdentity,
        todaysDrawSummary: `Today's draw (${formatDisplayDateShort(currentIst.isoDate)}): ${todayStatus.summary}`
      },
      counts,
      corpusBefore: beforeSnapshot.summary,
      corpusAfter: afterSnapshot.summary,
      candidates
    };
  }
}
