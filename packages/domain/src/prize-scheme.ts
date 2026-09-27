/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 7A.6 — Versioned Prize Scheme / Prize Structure Registry
 *
 * Distinguishes:
 * 1. OFFICIAL SCHEME RULE (promulgated via Government Gazette / S.R.O. Notifications)
 * 2. OBSERVED DRAW RESULT (extracted from official daily result PDFs)
 * 3. THEORETICAL SCHEME CAPACITY vs ACTUAL OBSERVED WINNERS
 * 4. WEEKLY vs BUMPER lottery classification
 * 5. AUTHORITATIVE SOURCE PRIORITY:
 *    Priority 1: Government of Kerala Gazette / S.R.O. notification
 *    Priority 2: Official Kerala State Lotteries publication
 *    Priority 3: Official result PDF
 *    Priority 4: Third-party discovery / reference (NEVER authoritative)
 *
 * STRICT INVARIANT: Descriptive Historical Research Only. Non-predictive.
 */

// ============================================================================
// 1. Classification & Enums
// ============================================================================

export type SchemeType = "WEEKLY" | "BUMPER" | "OTHER";

export type SchemeStatus = "ACTIVE" | "SUPERSEDED" | "PROPOSED" | "DRAFT";

export type SelectionBasis =
  | "COMMON_TO_ALL_SERIES"
  | "ONE_PER_SERIES"
  | "N_PER_SERIES"
  | "LAST_FOUR_DIGITS"
  | "LAST_THREE_DIGITS"
  | "LAST_TWO_DIGITS"
  | "LAST_ONE_DIGIT"
  | "CONSOLATION"
  | "SPECIAL";

export type SeriesScope = "ALL_SERIES" | "PER_SERIES" | "REMAINING_SERIES" | "NONE";

export type SchemeSourceType =
  | "GAZETTE_SRO"
  | "OFFICIAL_PUBLICATION"
  | "RESULT_PDF"
  | "REFERENCE";

export type SchemeResolutionStatus =
  | "SCHEME_RESOLVED"
  | "SCHEME_NOT_FOUND"
  | "SCHEME_RESOLUTION_AMBIGUOUS";

export type SchemeValidationStatus =
  | "VALIDATED"
  | "MISMATCH"
  | "INCOMPATIBLE"
  | "SKIPPED_NO_SCHEME";

// ============================================================================
// 2. Source Provenance & Authority
// ============================================================================

export interface SchemeSourceProvenance {
  sourceType: SchemeSourceType;
  authorityPriority: number; // 1 = Gazette/SRO, 2 = Official Pub, 3 = Result PDF, 4 = Reference
  documentSha256: string;
  notificationNumber: string; // e.g. "G.O.(P) No.192/2025/TAXES"
  sroNumber?: string; // e.g. "S. R. O. No. 1297/2025"
  governmentOrderNumber?: string;
  gazetteNumber?: string; // e.g. "3982"
  gazetteVolume?: string; // e.g. "Vol. XIV"
  publishedDate: string; // ISO YYYY-MM-DD
  pageNumber: number;
  evidenceText: string;
  parserVersion: string;
}

export interface SchemeApplicability {
  effectiveFrom: string; // ISO YYYY-MM-DD
  effectiveTo?: string; // ISO YYYY-MM-DD if superseded
  supersedesSchemeId?: string;
  supersedesNotification?: string;
  supersededBySchemeId?: string;
  supersededByNotification?: string;
  notes?: string;
}

// ============================================================================
// 3. Series Model
// ============================================================================

export interface SeriesRule {
  numberOfSeries: number;
  seriesPattern: string; // e.g. "2-letter uppercase alphabetic code"
  knownSeriesCodes?: string[]; // e.g. ["MA", "MB", "MC", "MD", "ME"] for Monsoon Bumper
  selectionScope: "ALL" | "PER_SERIES";
  rawSourceText: string;
}

// ============================================================================
// 4. Prize Tier Rule Contract
// ============================================================================

export interface PrizeTierRule {
  tierCode: string; // "I", "II", "III", "IV", ..., "CONSOLATION"
  tierName: string; // "1st Prize", "2nd Prize", "Consolation Prize"
  rank: number; // 1, 2, 3... 0 for consolation
  category: string; // "I", "II", "CONSOLATION", etc.
  amount: number; // Numeric amount in INR
  currency: "INR";
  selectionBasis: SelectionBasis;
  numberLength: number; // 6 for full ticket, 4 for last four digits
  seriesScope: SeriesScope;
  drawCount: number; // e.g. 1 for Tier I, 19 for Tier IV (repetition count)
  maximumPrizeCount: number; // Theoretical maximum, e.g. 20520
  isConsolation: boolean;
  isSuffix: boolean;
  agentCommission?: number;
  sourceEvidence: {
    pageNumber: number;
    rawText: string;
    textBlockOrders?: number[];
  };
  applicability: string;
}

// ============================================================================
// 5. Prize Scheme & Prize Scheme Version Contracts
// ============================================================================

export interface PrizeSchemeVersion {
  id: string; // Deterministic: `scheme_ver_${lotteryCode.toLowerCase()}_${versionId}`
  schemeId: string; // Family ID: `scheme_${lotteryCode.toLowerCase()}_${schemeType.toLowerCase()}`
  lotteryId: string;
  lotteryCode: string; // e.g. "BT", "DL", "KN", "SS", "SK"
  lotteryName: string; // e.g. "Bhagyathara (BT) Weekly Lottery"
  schemeType: SchemeType;
  version: string; // e.g. "v2025-11-sro1297"
  status: SchemeStatus;
  applicability: SchemeApplicability;
  effectiveFrom: string; // ISO YYYY-MM-DD
  effectiveTo?: string; // ISO YYYY-MM-DD
  supersedesSchemeId?: string;
  supersededBySchemeId?: string;
  sourceDocumentSha256: string;
  sourceNotificationNumber: string;
  sourceSroNumber?: string;
  sourcePublishedDate: string;
  ticketPrice: number;
  ticketPriceDetails?: {
    basicPrice?: number;
    gstRate?: number;
    rawText?: string;
  };
  ticketsPrinted: number;
  grossTicketValue?: number;
  totalPrizeAmount: number;
  numberOfSeries: number;
  seriesCodes: string[];
  periodicity: string;
  drawLocation: string;
  provenance: SchemeSourceProvenance;
  seriesRule: SeriesRule;
  tierRules: PrizeTierRule[];
  descriptiveOnly: true;
}

export interface PrizeScheme {
  id: string;
  lotteryCode: string;
  lotteryName: string;
  schemeType: SchemeType;
  currentVersionId: string;
  versions: PrizeSchemeVersion[];
  descriptiveOnly: true;
}

// ============================================================================
// 6. Draw Resolution Types & Contracts
// ============================================================================

export interface DrawResolutionQuery {
  lotteryName: string;
  lotteryCode?: string;
  drawDate: string; // DD/MM/YYYY, DD-MM-YYYY, or YYYY-MM-DD
  drawType?: SchemeType;
}

export interface SchemeResolutionResult {
  status: SchemeResolutionStatus;
  schemeVersion?: PrizeSchemeVersion;
  resolutionEvidence: string;
  confidence: number;
  sourceProvenance?: SchemeSourceProvenance;
}

// ============================================================================
// 7. Result <-> Scheme Validation Types & Contracts
// ============================================================================

export interface TheoreticalVsObservedCount {
  tierCode: string;
  tierName: string;
  selectionBasis: string;
  schemeDrawRepetitions: number;
  schemeTheoreticalMax: number;
  observedCount: number;
  isCompatible: boolean;
  notes?: string;
}

export interface DrawSchemeValidationResult {
  drawId: string;
  lotteryName: string;
  drawDate: string;
  schemeVersionId?: string;
  schemeType?: SchemeType;
  validationStatus: SchemeValidationStatus;
  isValid: boolean;
  discrepancies: string[];
  theoreticalVsObserved: TheoreticalVsObservedCount[];
  sourceAuthority: string;
}

// ============================================================================
// 8. Repository Interface
// ============================================================================

export interface IPrizeSchemeRepository {
  registerSchemeVersion(version: PrizeSchemeVersion): void;
  getSchemeVersion(id: string): PrizeSchemeVersion | undefined;
  getAllVersions(): PrizeSchemeVersion[];
  getVersionsForLottery(lotteryCode: string): PrizeSchemeVersion[];
  resolveSchemeForDraw(query: DrawResolutionQuery): SchemeResolutionResult;
}

// ============================================================================
// 9. Date & String Normalization Utilities
// ============================================================================

export function normalizeDateToIso(dateStr: string): string {
  if (!dateStr) return "";
  const trimmed = dateStr.trim();
  if (trimmed.includes("/")) {
    const parts = trimmed.split("/");
    if (parts.length === 3) {
      const day = parts[0]!.padStart(2, "0");
      const month = parts[1]!.padStart(2, "0");
      const year = parts[2]!;
      return `${year}-${month}-${day}`;
    }
  } else if (trimmed.includes("-")) {
    const parts = trimmed.split("-");
    if (parts.length === 3) {
      if (parts[0]!.length === 4) {
        return trimmed;
      }
      const day = parts[0]!.padStart(2, "0");
      const month = parts[1]!.padStart(2, "0");
      const year = parts[2]!;
      return `${year}-${month}-${day}`;
    }
  }
  return trimmed;
}

export function normalizeLotteryCode(input: string): string {
  const norm = input.toUpperCase().trim();
  if (norm.includes("BHAGYATHARA") || norm === "BT") return "BT";
  if (norm.includes("DHANALEKSHMI") || norm === "DL") return "DL";
  if (norm.includes("KARUNYA PLUS") || norm === "KN") return "KN";
  if (norm.includes("STHREE-SAKTHI") || norm.includes("STHREE SAKTHI") || norm === "SS") return "SS";
  if (norm.includes("SUVARNA KERALAM") || norm === "SK") return "SK";
  if (norm.includes("KARUNYA") && !norm.includes("PLUS") || norm === "KR") return "KR";
  if (norm.includes("SAMRUDHI") || norm === "SM") return "SM";
  if (norm.includes("MONSOON") && norm.includes("BUMPER")) return "MONSOON_BUMPER";
  if (norm.includes("THIRUVONAM") && norm.includes("BUMPER")) return "THIRUVONAM_BUMPER";
  return norm.replace(/[^A-Z0-9_-]/g, "_");
}

export function inferSchemeTypeFromLotteryName(lotteryName: string): SchemeType {
  const norm = lotteryName.toUpperCase();
  if (norm.includes("BUMPER")) return "BUMPER";
  return "WEEKLY";
}

// ============================================================================
// 10. Draw -> Scheme Resolution Engine
// ============================================================================

export function resolvePrizeSchemeForDraw(
  query: DrawResolutionQuery,
  registry: IPrizeSchemeRepository
): SchemeResolutionResult {
  const lotteryCode = normalizeLotteryCode(query.lotteryCode || query.lotteryName);
  const isoDate = normalizeDateToIso(query.drawDate);

  if (!lotteryCode || !isoDate) {
    return {
      status: "SCHEME_NOT_FOUND",
      resolutionEvidence: `Insufficient draw metadata: lottery='${query.lotteryName}', date='${query.drawDate}'`,
      confidence: 0
    };
  }

  const allVersionsForLottery = registry.getVersionsForLottery(lotteryCode);
  if (allVersionsForLottery.length === 0) {
    return {
      status: "SCHEME_NOT_FOUND",
      resolutionEvidence: `No registered scheme definitions for lottery '${lotteryCode}' ('${query.lotteryName}'). Authoritative Gazette SRO missing.`,
      confidence: 0
    };
  }

  // Filter candidates matching date applicability
  const candidates: PrizeSchemeVersion[] = [];

  for (const v of allVersionsForLottery) {
    const afterStart = v.effectiveFrom <= isoDate;
    const beforeEnd = !v.effectiveTo || isoDate <= v.effectiveTo;

    if (afterStart && beforeEnd) {
      candidates.push(v);
    }
  }

  if (candidates.length === 0) {
    // Check if the draw date precedes all known versions or comes after all
    const earliest = allVersionsForLottery.map((v) => v.effectiveFrom).sort()[0];
    return {
      status: "SCHEME_NOT_FOUND",
      resolutionEvidence: `Draw date '${isoDate}' does not fall within any registered active window for '${lotteryCode}' (earliest: ${earliest})`,
      confidence: 0
    };
  }

  // Handle supersession: if candidate A supersedes candidate B, candidate A prevails
  const resolvedCandidates = candidates.filter((c) => {
    // If another candidate in the list supersedes `c`, exclude `c`
    const supersededByAnother = candidates.some((other) => other.supersedesSchemeId === c.id);
    return !supersededByAnother;
  });

  if (resolvedCandidates.length === 1) {
    const chosen = resolvedCandidates[0]!;
    return {
      status: "SCHEME_RESOLVED",
      schemeVersion: chosen,
      resolutionEvidence: `Resolved to ${chosen.lotteryName} version ${chosen.version} (effective from ${chosen.effectiveFrom}${chosen.effectiveTo ? " to " + chosen.effectiveTo : " onwards"}, SRO: ${chosen.sourceSroNumber || chosen.sourceNotificationNumber})`,
      confidence: 1.0,
      sourceProvenance: chosen.provenance
    };
  }

  if (resolvedCandidates.length > 1) {
    return {
      status: "SCHEME_RESOLUTION_AMBIGUOUS",
      resolutionEvidence: `Ambiguous scheme match: draw date '${isoDate}' matches multiple overlapping active scheme versions without clear supersession: ${resolvedCandidates.map((c) => c.id).join(", ")}`,
      confidence: 0
    };
  }

  return {
    status: "SCHEME_NOT_FOUND",
    resolutionEvidence: `No unambiguous scheme version found for lottery '${lotteryCode}' on '${isoDate}'`,
    confidence: 0
  };
}

// ============================================================================
// 11. Result <-> Scheme Validation Engine
// ============================================================================

export interface DrawInputForValidation {
  id?: string;
  drawId?: string;
  lotteryName: string;
  drawDate: string;
  prizeTiers: Array<{
    name: string;
    rank: number;
    amount?: number;
    isSuffix: boolean;
    expectedLength?: number;
  }>;
  winningResults?: Array<{
    prizeTierName?: string;
    rank?: number;
    amount?: number;
    canonicalNumber: string;
    numberLength: number;
    isSuffix: boolean;
    series?: string;
  }>;
}

export function validateDrawAgainstPrizeScheme(
  draw: DrawInputForValidation,
  scheme: PrizeSchemeVersion
): DrawSchemeValidationResult {
  const drawId = draw.drawId || draw.id || "UNKNOWN_DRAW";
  const discrepancies: string[] = [];
  const theoreticalVsObserved: TheoreticalVsObservedCount[] = [];

  const drawLotteryCode = normalizeLotteryCode(draw.lotteryName);
  const schemeLotteryCode = normalizeLotteryCode(scheme.lotteryCode);

  // 1. Lottery code match
  if (drawLotteryCode !== schemeLotteryCode) {
    discrepancies.push(
      `Lottery mismatch: draw lottery '${draw.lotteryName}' (${drawLotteryCode}) does not match scheme lottery '${scheme.lotteryName}' (${schemeLotteryCode})`
    );
  }

  // 2. Scheme type match
  const inferredType = inferSchemeTypeFromLotteryName(draw.lotteryName);
  if (inferredType !== scheme.schemeType) {
    discrepancies.push(
      `Scheme type mismatch: draw inferred type '${inferredType}' does not match scheme type '${scheme.schemeType}'`
    );
  }

  // 3. Compare Prize Tiers
  for (const rule of scheme.tierRules) {
    // Find matching tier in draw by rank or name
    const matchingObservedTier = draw.prizeTiers.find((t) => {
      if (rule.isConsolation && (t.name.toLowerCase().includes("cons") || t.rank === 0)) {
        return true;
      }
      return t.rank === rule.rank && !rule.isConsolation;
    });

    if (!matchingObservedTier) {
      discrepancies.push(
        `Missing observed tier: scheme specifies Tier '${rule.tierName}' (rank ${rule.rank}), but it was not found in draw`
      );
      theoreticalVsObserved.push({
        tierCode: rule.tierCode,
        tierName: rule.tierName,
        selectionBasis: rule.selectionBasis,
        schemeDrawRepetitions: rule.drawCount,
        schemeTheoreticalMax: rule.maximumPrizeCount,
        observedCount: 0,
        isCompatible: false,
        notes: "Tier missing in observed draw results"
      });
      continue;
    }

    // Amount match
    if (matchingObservedTier.amount !== undefined && matchingObservedTier.amount !== rule.amount) {
      discrepancies.push(
        `Amount mismatch in '${rule.tierName}': scheme defines ₹${rule.amount}, observed ₹${matchingObservedTier.amount}`
      );
    }

    // Suffix vs Full Ticket compatibility
    if (matchingObservedTier.isSuffix !== rule.isSuffix) {
      const isBumperPerSeries =
        scheme.schemeType === "BUMPER" &&
        (rule.selectionBasis === "ONE_PER_SERIES" || rule.selectionBasis === "N_PER_SERIES");
      if (!isBumperPerSeries) {
        discrepancies.push(
          `Suffix flag mismatch in '${rule.tierName}': scheme defines isSuffix=${rule.isSuffix}, observed isSuffix=${matchingObservedTier.isSuffix}`
        );
      }
    }

    // Count observed winning numbers for this tier if winningResults are provided
    let observedCount = 0;
    if (draw.winningResults) {
      const resultsForTier = draw.winningResults.filter((r) => {
        if (rule.isConsolation) {
          return r.prizeTierName?.toLowerCase().includes("cons") || r.rank === 0;
        }
        return r.rank === rule.rank;
      });
      observedCount = resultsForTier.length;

      // Verify number length
      for (const res of resultsForTier) {
        if (res.canonicalNumber.length !== rule.numberLength) {
          discrepancies.push(
            `Number length mismatch in '${rule.tierName}': expected ${rule.numberLength} digits, observed '${res.canonicalNumber}' (${res.canonicalNumber.length} digits)`
          );
          break;
        }
      }

      // Check repetition counts for suffix-based tiers
      // In official Kerala result PDFs:
      // For weekly suffix tiers, exactly `rule.drawCount` distinct winning suffixes are printed.
      if (rule.isSuffix) {
        if (rule.drawCount > 0 && observedCount !== rule.drawCount && scheme.schemeType === "WEEKLY") {
          discrepancies.push(
            `Suffix repetition mismatch in '${rule.tierName}': scheme prescribes ${rule.drawCount} draws, observed ${observedCount}`
          );
        }
      }

      // For common-to-all-series primary tiers (1st, 2nd, 3rd)
      if (rule.selectionBasis === "COMMON_TO_ALL_SERIES") {
        if (observedCount !== rule.drawCount) {
          discrepancies.push(
            `Common prize count mismatch in '${rule.tierName}': scheme prescribes ${rule.drawCount}, observed ${observedCount}`
          );
        }
      }

      // For consolation prizes
      if (rule.isConsolation) {
        // Typically numberOfSeries - 1 prizes (e.g. 11 for 12 series, 4 for 5 series)
        if (observedCount !== rule.maximumPrizeCount && observedCount !== rule.drawCount) {
          discrepancies.push(
            `Consolation prize count mismatch: expected ${rule.maximumPrizeCount} (remaining series), observed ${observedCount}`
          );
        }
      }
    }

    const isCompatible =
      observedCount <= rule.maximumPrizeCount &&
      (observedCount === 0 || matchingObservedTier.amount === rule.amount);

    theoreticalVsObserved.push({
      tierCode: rule.tierCode,
      tierName: rule.tierName,
      selectionBasis: rule.selectionBasis,
      schemeDrawRepetitions: rule.drawCount,
      schemeTheoreticalMax: rule.maximumPrizeCount,
      observedCount,
      isCompatible,
      notes: rule.isSuffix
        ? `${rule.drawCount} suffix draws in PDF, theoretical up to ${rule.maximumPrizeCount} winning tickets`
        : rule.isConsolation
        ? `Consolation prize for other ${rule.maximumPrizeCount} series`
        : `Common to all series, ${rule.drawCount} winning ticket`
    });
  }

  const isValid = discrepancies.length === 0;

  return {
    drawId,
    lotteryName: draw.lotteryName,
    drawDate: draw.drawDate,
    schemeVersionId: scheme.id,
    schemeType: scheme.schemeType,
    validationStatus: isValid ? "VALIDATED" : "MISMATCH",
    isValid,
    discrepancies,
    theoreticalVsObserved,
    sourceAuthority: `Government of Kerala Gazette S.R.O. (${scheme.provenance.sroNumber || scheme.sourceNotificationNumber})`
  };
}

// ============================================================================
// 12. In-Memory Prize Scheme Repository Implementation
// ============================================================================

export class InMemoryPrizeSchemeRepository implements IPrizeSchemeRepository {
  private readonly versions = new Map<string, PrizeSchemeVersion>();
  private readonly lotteryVersions = new Map<string, string[]>();

  public registerSchemeVersion(version: PrizeSchemeVersion): void {
    if (!version.id) {
      throw new Error("Cannot register scheme version without an id");
    }
    // Prevent inadvertent overwrite: if exists, must be identical
    if (this.versions.has(version.id)) {
      const existing = this.versions.get(version.id)!;
      if (existing.sourceDocumentSha256 !== version.sourceDocumentSha256) {
        throw new Error(`Scheme version conflict for id '${version.id}'. Overwrites not permitted.`);
      }
      return;
    }

    this.versions.set(version.id, Object.freeze({ ...version }));

    const code = normalizeLotteryCode(version.lotteryCode);
    const existingList = this.lotteryVersions.get(code) || [];
    existingList.push(version.id);
    this.lotteryVersions.set(code, existingList);
  }

  public getSchemeVersion(id: string): PrizeSchemeVersion | undefined {
    return this.versions.get(id);
  }

  public getAllVersions(): PrizeSchemeVersion[] {
    return Array.from(this.versions.values());
  }

  public getVersionsForLottery(lotteryCode: string): PrizeSchemeVersion[] {
    const code = normalizeLotteryCode(lotteryCode);
    const versionIds = this.lotteryVersions.get(code) || [];
    return versionIds
      .map((id) => this.versions.get(id))
      .filter((v): v is PrizeSchemeVersion => v !== undefined);
  }

  public resolveSchemeForDraw(query: DrawResolutionQuery): SchemeResolutionResult {
    return resolvePrizeSchemeForDraw(query, this);
  }
}

// ============================================================================
// 13. Authoritative Seed Factory (Government Gazette SROs)
// ============================================================================

export const BT_SRO_SHA256 = "282cefde6d91660d1b897ed085ebf0cf0262e7c8d3ff0ed884c4d61a133e6703";
export const DL_SRO_SHA256 = "bd3ad7ea79750c4ab91f91d2c7c97935ce543aa8d62bcec8631129516b3588ab";
export const KN_SRO_SHA256 = "d4f8e6f2bda9bff364b0eb7ca8a375c843da311a6f78a2d17b50986818466b85";

export const MONSOON_BUMPER_RESULT_SHA256 = "0a2d3bf52c34b0daf9743f2b6de95f31c530dae39e6aa6286efe4dd69d87aa06";
export const THIRUVONAM_BUMPER_RESULT_SHA256 = "f89bd80ca46cd5b0beab395f2d75f2eda81e83b6460f28dcb4f52eacf44511c3";

export function createAuthoritativePrizeSchemeRegistry(): InMemoryPrizeSchemeRepository {
  const repo = new InMemoryPrizeSchemeRepository();

  // --------------------------------------------------------------------------
  // BHAGYATHARA (BT) Weekly Lottery
  // --------------------------------------------------------------------------

  // Version 1 (Superseded): G.O.(P) No.145/2025/TAXES dated 17/09/2025 (S.R.O. 1062/2025)
  const btVersion1: PrizeSchemeVersion = {
    id: "scheme_ver_bt_v2025-09-sro1062",
    schemeId: "scheme_bt_weekly",
    lotteryId: "BT",
    lotteryCode: "BT",
    lotteryName: "Bhagyathara (BT) Weekly Lottery",
    schemeType: "WEEKLY",
    version: "v2025-09-sro1062",
    status: "SUPERSEDED",
    applicability: {
      effectiveFrom: "2025-09-17",
      effectiveTo: "2025-11-09",
      supersededBySchemeId: "scheme_ver_bt_v2025-11-sro1297",
      supersededByNotification: "G.O.(P) No.192/2025/TAXES (S.R.O. No. 1297/2025)",
      notes: "Superseded by G.O.(P) No.192/2025/TAXES to revise GST rate adjustments."
    },
    effectiveFrom: "2025-09-17",
    effectiveTo: "2025-11-09",
    supersededBySchemeId: "scheme_ver_bt_v2025-11-sro1297",
    sourceDocumentSha256: "superseded_sro_1062_2025_gazette_3329",
    sourceNotificationNumber: "G.O.(P) No.145/2025/TAXES",
    sourceSroNumber: "S. R. O. No. 1062/2025",
    sourcePublishedDate: "2025-09-17",
    ticketPrice: 50,
    ticketsPrinted: 10800000,
    numberOfSeries: 12,
    seriesCodes: [],
    totalPrizeAmount: 233011000,
    periodicity: "Weekly Draw",
    drawLocation: "Thiruvananthapuram",
    provenance: {
      sourceType: "GAZETTE_SRO",
      authorityPriority: 1,
      documentSha256: "superseded_sro_1062_2025_gazette_3329",
      notificationNumber: "G.O.(P) No.145/2025/TAXES",
      sroNumber: "S. R. O. No. 1062/2025",
      gazetteNumber: "3329",
      publishedDate: "2025-09-17",
      pageNumber: 1,
      evidenceText: "Published as S.R.O.No.1062/2025 in Kerala Gazette Extraordinary No.3329 dated 17th September, 2025",
      parserVersion: "v1.0.0-gazette-sro"
    },
    seriesRule: {
      numberOfSeries: 12,
      seriesPattern: "2-letter alphabetic prefix",
      selectionScope: "ALL",
      rawSourceText: "Tickets are issued in twelve series"
    },
    tierRules: [], // Historical stub
    descriptiveOnly: true
  };
  repo.registerSchemeVersion(btVersion1);

  // Version 2 (Active): G.O.(P) No.192/2025/TAXES dated 10/11/2025 (S.R.O. 1297/2025)
  const btVersion2: PrizeSchemeVersion = {
    id: "scheme_ver_bt_v2025-11-sro1297",
    schemeId: "scheme_bt_weekly",
    lotteryId: "BT",
    lotteryCode: "BT",
    lotteryName: "Bhagyathara (BT) Weekly Lottery",
    schemeType: "WEEKLY",
    version: "v2025-11-sro1297",
    status: "ACTIVE",
    applicability: {
      effectiveFrom: "2025-11-10",
      supersedesSchemeId: "scheme_ver_bt_v2025-09-sro1062",
      supersedesNotification: "G.O.(P) No.145/2025/TAXES (S.R.O. No. 1062/2025)",
      notes: "Issued in supersession of S.R.O. No. 1062/2025 in Kerala Gazette Extraordinary No. 3982."
    },
    effectiveFrom: "2025-11-10",
    supersedesSchemeId: "scheme_ver_bt_v2025-09-sro1062",
    sourceDocumentSha256: BT_SRO_SHA256,
    sourceNotificationNumber: "G.O.(P) No.192/2025/TAXES",
    sourceSroNumber: "S. R. O. No. 1297/2025",
    sourcePublishedDate: "2025-11-10",
    ticketPrice: 50,
    ticketPriceDetails: {
      basicPrice: 35.714,
      gstRate: 0.4,
      rawText: "₹50/- (Ticket price ₹35.714 + 40% Goods and Services Tax)"
    },
    ticketsPrinted: 10800000,
    grossTicketValue: 385711200,
    numberOfSeries: 12,
    seriesCodes: [],
    totalPrizeAmount: 233011000,
    periodicity: "Weekly Draw",
    drawLocation: "Thiruvananthapuram",
    provenance: {
      sourceType: "GAZETTE_SRO",
      authorityPriority: 1,
      documentSha256: BT_SRO_SHA256,
      notificationNumber: "G.O.(P) No.192/2025/TAXES",
      sroNumber: "S. R. O. No. 1297/2025",
      gazetteNumber: "3982",
      gazetteVolume: "Vol. XIV",
      publishedDate: "2025-11-10",
      pageNumber: 1,
      evidenceText: "Kerala Gazette Extraordinary No. 3982, G.O.(P) No.192/2025/TAXES, S. R. O. No. 1297/2025",
      parserVersion: "v1.0.0-gazette-sro"
    },
    seriesRule: {
      numberOfSeries: 12,
      seriesPattern: "2-letter alphabetic prefix",
      selectionScope: "ALL",
      rawSourceText: "Tickets are issued in twelve series with the prize structure stated in the table given below"
    },
    tierRules: [
      {
        tierCode: "I",
        tierName: "1st Prize",
        rank: 1,
        category: "I",
        amount: 10000000,
        currency: "INR",
        selectionBasis: "COMMON_TO_ALL_SERIES",
        numberLength: 6,
        seriesScope: "ALL_SERIES",
        drawCount: 1,
        maximumPrizeCount: 1,
        isConsolation: false,
        isSuffix: false,
        agentCommission: 1000000,
        sourceEvidence: { pageNumber: 2, rawText: "Sl. 1 Category I: Common to all series. Amount: 1,00,00,000. No of prizes: 1" },
        applicability: "Common to all series"
      },
      {
        tierCode: "II",
        tierName: "2nd Prize",
        rank: 2,
        category: "II",
        amount: 3000000,
        currency: "INR",
        selectionBasis: "COMMON_TO_ALL_SERIES",
        numberLength: 6,
        seriesScope: "ALL_SERIES",
        drawCount: 1,
        maximumPrizeCount: 1,
        isConsolation: false,
        isSuffix: false,
        agentCommission: 300000,
        sourceEvidence: { pageNumber: 2, rawText: "Sl. 2 Category II: Common to all series. Amount: 30,00,000. No of prizes: 1" },
        applicability: "Common to all series"
      },
      {
        tierCode: "III",
        tierName: "3rd Prize",
        rank: 3,
        category: "III",
        amount: 500000,
        currency: "INR",
        selectionBasis: "COMMON_TO_ALL_SERIES",
        numberLength: 6,
        seriesScope: "ALL_SERIES",
        drawCount: 1,
        maximumPrizeCount: 1,
        isConsolation: false,
        isSuffix: false,
        agentCommission: 50000,
        sourceEvidence: { pageNumber: 2, rawText: "Sl. 3 Category III: Common to all series. Amount: 5,00,000. No of prizes: 1" },
        applicability: "Common to all series"
      },
      {
        tierCode: "IV",
        tierName: "4th Prize",
        rank: 4,
        category: "IV",
        amount: 5000,
        currency: "INR",
        selectionBasis: "LAST_FOUR_DIGITS",
        numberLength: 4,
        seriesScope: "ALL_SERIES",
        drawCount: 19,
        maximumPrizeCount: 20520, // 19 * 1080
        isConsolation: false,
        isSuffix: true,
        agentCommission: 10260000,
        sourceEvidence: { pageNumber: 2, rawText: "Sl. 4 Category IV: Last Four digits to be drawn 19 times. Amount: 5,000. Up to 20,520" },
        applicability: "Last four digits drawn 19 times across 12 series"
      },
      {
        tierCode: "V",
        tierName: "5th Prize",
        rank: 5,
        category: "V",
        amount: 2000,
        currency: "INR",
        selectionBasis: "LAST_FOUR_DIGITS",
        numberLength: 4,
        seriesScope: "ALL_SERIES",
        drawCount: 6,
        maximumPrizeCount: 6480, // 6 * 1080
        isConsolation: false,
        isSuffix: true,
        agentCommission: 1296000,
        sourceEvidence: { pageNumber: 2, rawText: "Sl. 5 Category V: Last Four digits to be drawn 6 times. Amount: 2,000. Up to 6,480" },
        applicability: "Last four digits drawn 6 times across 12 series"
      },
      {
        tierCode: "VI",
        tierName: "6th Prize",
        rank: 6,
        category: "VI",
        amount: 1000,
        currency: "INR",
        selectionBasis: "LAST_FOUR_DIGITS",
        numberLength: 4,
        seriesScope: "ALL_SERIES",
        drawCount: 25,
        maximumPrizeCount: 27000, // 25 * 1080
        isConsolation: false,
        isSuffix: true,
        agentCommission: 2700000,
        sourceEvidence: { pageNumber: 2, rawText: "Sl. 6 Category VI: Last Four digits to be drawn 25 times. Amount: 1,000. Up to 27,000" },
        applicability: "Last four digits drawn 25 times across 12 series"
      },
      {
        tierCode: "VII",
        tierName: "7th Prize",
        rank: 7,
        category: "VII",
        amount: 500,
        currency: "INR",
        selectionBasis: "LAST_FOUR_DIGITS",
        numberLength: 4,
        seriesScope: "ALL_SERIES",
        drawCount: 76,
        maximumPrizeCount: 82080, // 76 * 1080
        isConsolation: false,
        isSuffix: true,
        agentCommission: 4104000,
        sourceEvidence: { pageNumber: 2, rawText: "Sl. 7 Category VII: Last Four digits to be drawn 76 times. Amount: 500. Up to 82,080" },
        applicability: "Last four digits drawn 76 times across 12 series"
      },
      {
        tierCode: "VIII",
        tierName: "8th Prize",
        rank: 8,
        category: "VIII",
        amount: 200,
        currency: "INR",
        selectionBasis: "LAST_FOUR_DIGITS",
        numberLength: 4,
        seriesScope: "ALL_SERIES",
        drawCount: 94,
        maximumPrizeCount: 101520, // 94 * 1080
        isConsolation: false,
        isSuffix: true,
        agentCommission: 2030400,
        sourceEvidence: { pageNumber: 2, rawText: "Sl. 8 Category VIII: Last Four digits to be drawn 94 times. Amount: 200. Up to 1,01,520" },
        applicability: "Last four digits drawn 94 times across 12 series"
      },
      {
        tierCode: "IX",
        tierName: "9th Prize",
        rank: 9,
        category: "IX",
        amount: 100,
        currency: "INR",
        selectionBasis: "LAST_FOUR_DIGITS",
        numberLength: 4,
        seriesScope: "ALL_SERIES",
        drawCount: 144,
        maximumPrizeCount: 155520, // 144 * 1080
        isConsolation: false,
        isSuffix: true,
        agentCommission: 2332800,
        sourceEvidence: { pageNumber: 3, rawText: "Sl. 9 Category IX: Last Four digits to be drawn 144 times. Amount: 100. Up to 1,55,520" },
        applicability: "Last four digits drawn 144 times across 12 series"
      },
      {
        tierCode: "CONSOLATION",
        tierName: "Consolation Prize",
        rank: 0,
        category: "CONSOLATION",
        amount: 5000,
        currency: "INR",
        selectionBasis: "CONSOLATION",
        numberLength: 6,
        seriesScope: "REMAINING_SERIES",
        drawCount: 11,
        maximumPrizeCount: 11,
        isConsolation: true,
        isSuffix: false,
        agentCommission: 5500,
        sourceEvidence: { pageNumber: 3, rawText: "CONSOLATION PRIZE Amount: 5,000. No of prizes: 11" },
        applicability: "Tickets with 1st prize winning number in remaining 11 series"
      }
    ],
    descriptiveOnly: true
  };
  repo.registerSchemeVersion(btVersion2);

  // --------------------------------------------------------------------------
  // DHANALEKSHMI (DL) Weekly Lottery
  // --------------------------------------------------------------------------

  // Version 1 (Superseded): G.O.(P) No.143/2025/TAXES dated 17/09/2025 (S.R.O. 1060/2025)
  const dlVersion1: PrizeSchemeVersion = {
    id: "scheme_ver_dl_v2025-09-sro1060",
    schemeId: "scheme_dl_weekly",
    lotteryId: "DL",
    lotteryCode: "DL",
    lotteryName: "Dhanalekshmi (DL) Weekly Lottery",
    schemeType: "WEEKLY",
    version: "v2025-09-sro1060",
    status: "SUPERSEDED",
    applicability: {
      effectiveFrom: "2025-09-17",
      effectiveTo: "2025-11-09",
      supersededBySchemeId: "scheme_ver_dl_v2025-11-sro1296",
      supersededByNotification: "G.O.(P) No.191/2025/TAXES (S.R.O. No. 1296/2025)"
    },
    effectiveFrom: "2025-09-17",
    effectiveTo: "2025-11-09",
    supersededBySchemeId: "scheme_ver_dl_v2025-11-sro1296",
    sourceDocumentSha256: "superseded_sro_1060_2025_gazette_3327",
    sourceNotificationNumber: "G.O.(P) No.143/2025/TAXES",
    sourceSroNumber: "S. R. O. No. 1060/2025",
    sourcePublishedDate: "2025-09-17",
    ticketPrice: 50,
    ticketsPrinted: 10800000,
    numberOfSeries: 12,
    seriesCodes: [],
    totalPrizeAmount: 232795000,
    periodicity: "Weekly Draw",
    drawLocation: "Thiruvananthapuram",
    provenance: {
      sourceType: "GAZETTE_SRO",
      authorityPriority: 1,
      documentSha256: "superseded_sro_1060_2025_gazette_3327",
      notificationNumber: "G.O.(P) No.143/2025/TAXES",
      sroNumber: "S. R. O. No. 1060/2025",
      gazetteNumber: "3327",
      publishedDate: "2025-09-17",
      pageNumber: 1,
      evidenceText: "Published as S.R.O.No.1060/2025 in Kerala Gazette Extraordinary No.3327 dated 17th September, 2025",
      parserVersion: "v1.0.0-gazette-sro"
    },
    seriesRule: {
      numberOfSeries: 12,
      seriesPattern: "2-letter alphabetic prefix",
      selectionScope: "ALL",
      rawSourceText: "Tickets are issued in twelve series"
    },
    tierRules: [],
    descriptiveOnly: true
  };
  repo.registerSchemeVersion(dlVersion1);

  // Version 2 (Active): G.O.(P) No.191/2025/TAXES dated 10/11/2025 (S.R.O. 1296/2025)
  const dlVersion2: PrizeSchemeVersion = {
    id: "scheme_ver_dl_v2025-11-sro1296",
    schemeId: "scheme_dl_weekly",
    lotteryId: "DL",
    lotteryCode: "DL",
    lotteryName: "Dhanalekshmi (DL) Weekly Lottery",
    schemeType: "WEEKLY",
    version: "v2025-11-sro1296",
    status: "ACTIVE",
    applicability: {
      effectiveFrom: "2025-11-10",
      supersedesSchemeId: "scheme_ver_dl_v2025-09-sro1060",
      supersedesNotification: "G.O.(P) No.143/2025/TAXES (S.R.O. No. 1060/2025)"
    },
    effectiveFrom: "2025-11-10",
    supersedesSchemeId: "scheme_ver_dl_v2025-09-sro1060",
    sourceDocumentSha256: DL_SRO_SHA256,
    sourceNotificationNumber: "G.O.(P) No.191/2025/TAXES",
    sourceSroNumber: "S. R. O. No. 1296/2025",
    sourcePublishedDate: "2025-11-10",
    ticketPrice: 50,
    ticketPriceDetails: {
      basicPrice: 35.714,
      gstRate: 0.4,
      rawText: "₹50/- (Ticket price ₹35.714 + 40% Goods and Services Tax)"
    },
    ticketsPrinted: 10800000,
    grossTicketValue: 385711200,
    numberOfSeries: 12,
    seriesCodes: [],
    totalPrizeAmount: 232795000,
    periodicity: "Weekly Draw",
    drawLocation: "Thiruvananthapuram",
    provenance: {
      sourceType: "GAZETTE_SRO",
      authorityPriority: 1,
      documentSha256: DL_SRO_SHA256,
      notificationNumber: "G.O.(P) No.191/2025/TAXES",
      sroNumber: "S. R. O. No. 1296/2025",
      gazetteNumber: "3981",
      gazetteVolume: "Vol. XIV",
      publishedDate: "2025-11-10",
      pageNumber: 1,
      evidenceText: "Kerala Gazette Extraordinary No. 3981, G.O.(P) No.191/2025/TAXES, S. R. O. No. 1296/2025",
      parserVersion: "v1.0.0-gazette-sro"
    },
    seriesRule: {
      numberOfSeries: 12,
      seriesPattern: "2-letter alphabetic prefix",
      selectionScope: "ALL",
      rawSourceText: "Tickets are issued in twelve series with the prize structure stated in the table given below"
    },
    tierRules: [
      {
        tierCode: "I",
        tierName: "1st Prize",
        rank: 1,
        category: "I",
        amount: 10000000,
        currency: "INR",
        selectionBasis: "COMMON_TO_ALL_SERIES",
        numberLength: 6,
        seriesScope: "ALL_SERIES",
        drawCount: 1,
        maximumPrizeCount: 1,
        isConsolation: false,
        isSuffix: false,
        agentCommission: 1000000,
        sourceEvidence: { pageNumber: 2, rawText: "Sl. 1 Category I: Common to all series. Amount: 1,00,00,000. No of prizes: 1" },
        applicability: "Common to all series"
      },
      {
        tierCode: "II",
        tierName: "2nd Prize",
        rank: 2,
        category: "II",
        amount: 3000000,
        currency: "INR",
        selectionBasis: "COMMON_TO_ALL_SERIES",
        numberLength: 6,
        seriesScope: "ALL_SERIES",
        drawCount: 1,
        maximumPrizeCount: 1,
        isConsolation: false,
        isSuffix: false,
        agentCommission: 300000,
        sourceEvidence: { pageNumber: 2, rawText: "Sl. 2 Category II: Common to all series. Amount: 30,00,000. No of prizes: 1" },
        applicability: "Common to all series"
      },
      {
        tierCode: "III",
        tierName: "3rd Prize",
        rank: 3,
        category: "III",
        amount: 500000,
        currency: "INR",
        selectionBasis: "COMMON_TO_ALL_SERIES",
        numberLength: 6,
        seriesScope: "ALL_SERIES",
        drawCount: 1,
        maximumPrizeCount: 1,
        isConsolation: false,
        isSuffix: false,
        agentCommission: 50000,
        sourceEvidence: { pageNumber: 2, rawText: "Sl. 3 Category III: Common to all series. Amount: 5,00,000. No of prizes: 1" },
        applicability: "Common to all series"
      },
      {
        tierCode: "IV",
        tierName: "4th Prize",
        rank: 4,
        category: "IV",
        amount: 5000,
        currency: "INR",
        selectionBasis: "LAST_FOUR_DIGITS",
        numberLength: 4,
        seriesScope: "ALL_SERIES",
        drawCount: 19,
        maximumPrizeCount: 20520, // 19 * 1080
        isConsolation: false,
        isSuffix: true,
        agentCommission: 10260000,
        sourceEvidence: { pageNumber: 2, rawText: "Sl. 4 Category IV: Last Four digits to be drawn 19 times. Amount: 5,000. Up to 20,520" },
        applicability: "Last four digits drawn 19 times across 12 series"
      },
      {
        tierCode: "V",
        tierName: "5th Prize",
        rank: 5,
        category: "V",
        amount: 2000,
        currency: "INR",
        selectionBasis: "LAST_FOUR_DIGITS",
        numberLength: 4,
        seriesScope: "ALL_SERIES",
        drawCount: 6,
        maximumPrizeCount: 6480, // 6 * 1080
        isConsolation: false,
        isSuffix: true,
        agentCommission: 1296000,
        sourceEvidence: { pageNumber: 2, rawText: "Sl. 5 Category V: Last Four digits to be drawn 6 times. Amount: 2,000. Up to 6,480" },
        applicability: "Last four digits drawn 6 times across 12 series"
      },
      {
        tierCode: "VI",
        tierName: "6th Prize",
        rank: 6,
        category: "VI",
        amount: 1000,
        currency: "INR",
        selectionBasis: "LAST_FOUR_DIGITS",
        numberLength: 4,
        seriesScope: "ALL_SERIES",
        drawCount: 25,
        maximumPrizeCount: 27000, // 25 * 1080
        isConsolation: false,
        isSuffix: true,
        agentCommission: 2700000,
        sourceEvidence: { pageNumber: 2, rawText: "Sl. 6 Category VI: Last Four digits to be drawn 25 times. Amount: 1,000. Up to 27,000" },
        applicability: "Last four digits drawn 25 times across 12 series"
      },
      {
        tierCode: "VII",
        tierName: "7th Prize",
        rank: 7,
        category: "VII",
        amount: 500,
        currency: "INR",
        selectionBasis: "LAST_FOUR_DIGITS",
        numberLength: 4,
        seriesScope: "ALL_SERIES",
        drawCount: 76,
        maximumPrizeCount: 82080, // 76 * 1080
        isConsolation: false,
        isSuffix: true,
        agentCommission: 4104000,
        sourceEvidence: { pageNumber: 2, rawText: "Sl. 7 Category VII: Last Four digits to be drawn 76 times. Amount: 500. Up to 82,080" },
        applicability: "Last four digits drawn 76 times across 12 series"
      },
      {
        tierCode: "VIII",
        tierName: "8th Prize",
        rank: 8,
        category: "VIII",
        amount: 200,
        currency: "INR",
        selectionBasis: "LAST_FOUR_DIGITS",
        numberLength: 4,
        seriesScope: "ALL_SERIES",
        drawCount: 96, // Note: DL has 96 draws for 8th prize!
        maximumPrizeCount: 103680, // 96 * 1080
        isConsolation: false,
        isSuffix: true,
        agentCommission: 2073600,
        sourceEvidence: { pageNumber: 2, rawText: "Sl. 8 Category VIII: Last Four digits to be drawn 96 times. Amount: 200. Up to 1,03,680" },
        applicability: "Last four digits drawn 96 times across 12 series"
      },
      {
        tierCode: "IX",
        tierName: "9th Prize",
        rank: 9,
        category: "IX",
        amount: 100,
        currency: "INR",
        selectionBasis: "LAST_FOUR_DIGITS",
        numberLength: 4,
        seriesScope: "ALL_SERIES",
        drawCount: 138, // Note: DL has 138 draws for 9th prize!
        maximumPrizeCount: 149040, // 138 * 1080
        isConsolation: false,
        isSuffix: true,
        agentCommission: 2235600,
        sourceEvidence: { pageNumber: 3, rawText: "Sl. 9 Category IX: Last Four digits to be drawn 138 times. Amount: 100. Up to 1,49,040" },
        applicability: "Last four digits drawn 138 times across 12 series"
      },
      {
        tierCode: "CONSOLATION",
        tierName: "Consolation Prize",
        rank: 0,
        category: "CONSOLATION",
        amount: 5000,
        currency: "INR",
        selectionBasis: "CONSOLATION",
        numberLength: 6,
        seriesScope: "REMAINING_SERIES",
        drawCount: 11,
        maximumPrizeCount: 11,
        isConsolation: true,
        isSuffix: false,
        agentCommission: 5500,
        sourceEvidence: { pageNumber: 3, rawText: "CONSOLATION PRIZE Amount: 5,000. No of prizes: 11" },
        applicability: "Tickets with 1st prize winning number in remaining 11 series"
      }
    ],
    descriptiveOnly: true
  };
  repo.registerSchemeVersion(dlVersion2);

  // --------------------------------------------------------------------------
  // KARUNYA PLUS (KN) Weekly Lottery
  // --------------------------------------------------------------------------

  // Version 1 (Superseded): G.O.(P) No.146/2025/TAXES dated 17/09/2025 (S.R.O. 1061/2025)
  const knVersion1: PrizeSchemeVersion = {
    id: "scheme_ver_kn_v2025-09-sro1061",
    schemeId: "scheme_kn_weekly",
    lotteryId: "KN",
    lotteryCode: "KN",
    lotteryName: "Karunya Plus (KN) Weekly Lottery",
    schemeType: "WEEKLY",
    version: "v2025-09-sro1061",
    status: "SUPERSEDED",
    applicability: {
      effectiveFrom: "2025-09-17",
      effectiveTo: "2025-11-09",
      supersededBySchemeId: "scheme_ver_kn_v2025-11-sro1294",
      supersededByNotification: "G.O.(P) No.189/2025/TAXES (S.R.O. No. 1294/2025)"
    },
    effectiveFrom: "2025-09-17",
    effectiveTo: "2025-11-09",
    supersededBySchemeId: "scheme_ver_kn_v2025-11-sro1294",
    sourceDocumentSha256: "superseded_sro_1061_2025_gazette_3328",
    sourceNotificationNumber: "G.O.(P) No.146/2025/TAXES",
    sourceSroNumber: "S. R. O. No. 1061/2025",
    sourcePublishedDate: "2025-09-17",
    ticketPrice: 50,
    ticketsPrinted: 10800000,
    numberOfSeries: 12,
    seriesCodes: [],
    totalPrizeAmount: 232147000,
    periodicity: "Weekly Draw",
    drawLocation: "Thiruvananthapuram",
    provenance: {
      sourceType: "GAZETTE_SRO",
      authorityPriority: 1,
      documentSha256: "superseded_sro_1061_2025_gazette_3328",
      notificationNumber: "G.O.(P) No.146/2025/TAXES",
      sroNumber: "S. R. O. No. 1061/2025",
      gazetteNumber: "3328",
      publishedDate: "2025-09-17",
      pageNumber: 1,
      evidenceText: "Published as S.R.O.No.1061/2025 in Kerala Gazette Extraordinary No.3328 dated 17th September, 2025",
      parserVersion: "v1.0.0-gazette-sro"
    },
    seriesRule: {
      numberOfSeries: 12,
      seriesPattern: "2-letter alphabetic prefix",
      selectionScope: "ALL",
      rawSourceText: "Tickets are issued in twelve series"
    },
    tierRules: [],
    descriptiveOnly: true
  };
  repo.registerSchemeVersion(knVersion1);

  // Version 2 (Active): G.O.(P) No.189/2025/TAXES dated 10/11/2025 (S.R.O. 1294/2025)
  const knVersion2: PrizeSchemeVersion = {
    id: "scheme_ver_kn_v2025-11-sro1294",
    schemeId: "scheme_kn_weekly",
    lotteryId: "KN",
    lotteryCode: "KN",
    lotteryName: "Karunya Plus (KN) Weekly Lottery",
    schemeType: "WEEKLY",
    version: "v2025-11-sro1294",
    status: "ACTIVE",
    applicability: {
      effectiveFrom: "2025-11-10",
      supersedesSchemeId: "scheme_ver_kn_v2025-09-sro1061",
      supersedesNotification: "G.O.(P) No.146/2025/TAXES (S.R.O. No. 1061/2025)"
    },
    effectiveFrom: "2025-11-10",
    supersedesSchemeId: "scheme_ver_kn_v2025-09-sro1061",
    sourceDocumentSha256: KN_SRO_SHA256,
    sourceNotificationNumber: "G.O.(P) No.189/2025/TAXES",
    sourceSroNumber: "S. R. O. No. 1294/2025",
    sourcePublishedDate: "2025-11-10",
    ticketPrice: 50,
    ticketPriceDetails: {
      basicPrice: 35.714,
      gstRate: 0.4,
      rawText: "₹50/- (Ticket price ₹35.714 + 40% Goods and Services Tax)"
    },
    ticketsPrinted: 10800000,
    grossTicketValue: 385711200,
    numberOfSeries: 12,
    seriesCodes: [],
    totalPrizeAmount: 232147000,
    periodicity: "Weekly Draw",
    drawLocation: "Thiruvananthapuram",
    provenance: {
      sourceType: "GAZETTE_SRO",
      authorityPriority: 1,
      documentSha256: KN_SRO_SHA256,
      notificationNumber: "G.O.(P) No.189/2025/TAXES",
      sroNumber: "S. R. O. No. 1294/2025",
      gazetteNumber: "3979",
      gazetteVolume: "Vol. XIV",
      publishedDate: "2025-11-10",
      pageNumber: 1,
      evidenceText: "Kerala Gazette Extraordinary No. 3979, G.O.(P) No.189/2025/TAXES, S. R. O. No. 1294/2025",
      parserVersion: "v1.0.0-gazette-sro"
    },
    seriesRule: {
      numberOfSeries: 12,
      seriesPattern: "2-letter alphabetic prefix",
      selectionScope: "ALL",
      rawSourceText: "Tickets are issued in twelve series with the prize structure stated in the table given below"
    },
    tierRules: [
      {
        tierCode: "I",
        tierName: "1st Prize",
        rank: 1,
        category: "I",
        amount: 10000000,
        currency: "INR",
        selectionBasis: "COMMON_TO_ALL_SERIES",
        numberLength: 6,
        seriesScope: "ALL_SERIES",
        drawCount: 1,
        maximumPrizeCount: 1,
        isConsolation: false,
        isSuffix: false,
        agentCommission: 1000000,
        sourceEvidence: { pageNumber: 2, rawText: "Sl. 1 Category I: Common to all series. Amount: 1,00,00,000. No of prizes: 1" },
        applicability: "Common to all series"
      },
      {
        tierCode: "II",
        tierName: "2nd Prize",
        rank: 2,
        category: "II",
        amount: 3000000,
        currency: "INR",
        selectionBasis: "COMMON_TO_ALL_SERIES",
        numberLength: 6,
        seriesScope: "ALL_SERIES",
        drawCount: 1,
        maximumPrizeCount: 1,
        isConsolation: false,
        isSuffix: false,
        agentCommission: 300000,
        sourceEvidence: { pageNumber: 2, rawText: "Sl. 2 Category II: Common to all series. Amount: 30,00,000. No of prizes: 1" },
        applicability: "Common to all series"
      },
      {
        tierCode: "III",
        tierName: "3rd Prize",
        rank: 3,
        category: "III",
        amount: 500000,
        currency: "INR",
        selectionBasis: "COMMON_TO_ALL_SERIES",
        numberLength: 6,
        seriesScope: "ALL_SERIES",
        drawCount: 1,
        maximumPrizeCount: 1,
        isConsolation: false,
        isSuffix: false,
        agentCommission: 50000,
        sourceEvidence: { pageNumber: 2, rawText: "Sl. 3 Category III: Common to all series. Amount: 5,00,000. No of prizes: 1" },
        applicability: "Common to all series"
      },
      {
        tierCode: "IV",
        tierName: "4th Prize",
        rank: 4,
        category: "IV",
        amount: 5000,
        currency: "INR",
        selectionBasis: "LAST_FOUR_DIGITS",
        numberLength: 4,
        seriesScope: "ALL_SERIES",
        drawCount: 19,
        maximumPrizeCount: 20520, // 19 * 1080
        isConsolation: false,
        isSuffix: true,
        agentCommission: 10260000,
        sourceEvidence: { pageNumber: 2, rawText: "Sl. 4 Category IV: Last Four digits to be drawn 19 times. Amount: 5,000. Up to 20,520" },
        applicability: "Last four digits drawn 19 times across 12 series"
      },
      {
        tierCode: "V",
        tierName: "5th Prize",
        rank: 5,
        category: "V",
        amount: 2000,
        currency: "INR",
        selectionBasis: "LAST_FOUR_DIGITS",
        numberLength: 4,
        seriesScope: "ALL_SERIES",
        drawCount: 6,
        maximumPrizeCount: 6480, // 6 * 1080
        isConsolation: false,
        isSuffix: true,
        agentCommission: 1296000,
        sourceEvidence: { pageNumber: 2, rawText: "Sl. 5 Category V: Last Four digits to be drawn 6 times. Amount: 2,000. Up to 6,480" },
        applicability: "Last four digits drawn 6 times across 12 series"
      },
      {
        tierCode: "VI",
        tierName: "6th Prize",
        rank: 6,
        category: "VI",
        amount: 1000,
        currency: "INR",
        selectionBasis: "LAST_FOUR_DIGITS",
        numberLength: 4,
        seriesScope: "ALL_SERIES",
        drawCount: 25,
        maximumPrizeCount: 27000, // 25 * 1080
        isConsolation: false,
        isSuffix: true,
        agentCommission: 2700000,
        sourceEvidence: { pageNumber: 2, rawText: "Sl. 6 Category VI: Last Four digits to be drawn 25 times. Amount: 1,000. Up to 27,000" },
        applicability: "Last four digits drawn 25 times across 12 series"
      },
      {
        tierCode: "VII",
        tierName: "7th Prize",
        rank: 7,
        category: "VII",
        amount: 500,
        currency: "INR",
        selectionBasis: "LAST_FOUR_DIGITS",
        numberLength: 4,
        seriesScope: "ALL_SERIES",
        drawCount: 76,
        maximumPrizeCount: 82080, // 76 * 1080
        isConsolation: false,
        isSuffix: true,
        agentCommission: 4104000,
        sourceEvidence: { pageNumber: 2, rawText: "Sl. 7 Category VII: Last Four digits to be drawn 76 times. Amount: 500. Up to 82,080" },
        applicability: "Last four digits drawn 76 times across 12 series"
      },
      {
        tierCode: "VIII",
        tierName: "8th Prize",
        rank: 8,
        category: "VIII",
        amount: 200,
        currency: "INR",
        selectionBasis: "LAST_FOUR_DIGITS",
        numberLength: 4,
        seriesScope: "ALL_SERIES",
        drawCount: 84, // Note: KN has 84 draws for 8th prize!
        maximumPrizeCount: 90720, // 84 * 1080
        isConsolation: false,
        isSuffix: true,
        agentCommission: 1814400,
        sourceEvidence: { pageNumber: 2, rawText: "Sl. 8 Category VIII: Last Four digits to be drawn 84 times. Amount: 200. Up to 90,720" },
        applicability: "Last four digits drawn 84 times across 12 series"
      },
      {
        tierCode: "IX",
        tierName: "9th Prize",
        rank: 9,
        category: "IX",
        amount: 100,
        currency: "INR",
        selectionBasis: "LAST_FOUR_DIGITS",
        numberLength: 4,
        seriesScope: "ALL_SERIES",
        drawCount: 156, // Note: KN has 156 draws for 9th prize!
        maximumPrizeCount: 168480, // 156 * 1080
        isConsolation: false,
        isSuffix: true,
        agentCommission: 2527200,
        sourceEvidence: { pageNumber: 3, rawText: "Sl. 9 Category IX: Last Four digits to be drawn 156 times. Amount: 100. Up to 1,68,480" },
        applicability: "Last four digits drawn 156 times across 12 series"
      },
      {
        tierCode: "CONSOLATION",
        tierName: "Consolation Prize",
        rank: 0,
        category: "CONSOLATION",
        amount: 5000,
        currency: "INR",
        selectionBasis: "CONSOLATION",
        numberLength: 6,
        seriesScope: "REMAINING_SERIES",
        drawCount: 11,
        maximumPrizeCount: 11,
        isConsolation: true,
        isSuffix: false,
        agentCommission: 5500,
        sourceEvidence: { pageNumber: 3, rawText: "CONSOLATION PRIZE Amount: 5,000. No of prizes: 11" },
        applicability: "Tickets with 1st prize winning number in remaining 11 series"
      }
    ],
    descriptiveOnly: true
  };
  repo.registerSchemeVersion(knVersion2);

  // --------------------------------------------------------------------------
  // BUMPER LOTTERY SCHEMES (Explicit BUMPER SchemeType)
  // Demonstrates full BUMPER model without conflating with WEEKLY.
  // Source authority: RESULT_PDF (Priority 3). Not Gazette SRO.
  // --------------------------------------------------------------------------

  // Monsoon Bumper (BR-110)
  const monsoonBumperScheme: PrizeSchemeVersion = {
    id: "scheme_ver_monsoon_bumper_2026_br110",
    schemeId: "scheme_monsoon_bumper",
    lotteryId: "MONSOON_BUMPER",
    lotteryCode: "MONSOON_BUMPER",
    lotteryName: "MONSOON BUMPER",
    schemeType: "BUMPER",
    version: "v2026-br110",
    status: "ACTIVE",
    applicability: {
      effectiveFrom: "2026-07-01",
      effectiveTo: "2026-07-31",
      notes: "Bumper scheme observed from official result PDF 281-2279-18-07-2026.pdf (BR-110th). Authority Priority: 3 (RESULT_PDF)."
    },
    effectiveFrom: "2026-07-01",
    effectiveTo: "2026-07-31",
    sourceDocumentSha256: MONSOON_BUMPER_RESULT_SHA256,
    sourceNotificationNumber: "RESULT-PDF-BR-110",
    sourcePublishedDate: "2026-07-18",
    ticketPrice: 250,
    ticketsPrinted: 4500000,
    numberOfSeries: 5,
    seriesCodes: ["MA", "MB", "MC", "MD", "ME"],
    totalPrizeAmount: 450000000,
    periodicity: "Annual Bumper",
    drawLocation: "Thiruvananthapuram",
    provenance: {
      sourceType: "RESULT_PDF",
      authorityPriority: 3,
      documentSha256: MONSOON_BUMPER_RESULT_SHA256,
      notificationNumber: "DRAW NO. BR-110th",
      publishedDate: "2026-07-18",
      pageNumber: 1,
      evidenceText: "Official Result PDF: MONSOON BUMPER LOTTERY NO.BR-110th DRAW held on 18/07/2026",
      parserVersion: "v1.0.0-result-pdf"
    },
    seriesRule: {
      numberOfSeries: 5,
      seriesPattern: "M[A-E]",
      knownSeriesCodes: ["MA", "MB", "MC", "MD", "ME"],
      selectionScope: "PER_SERIES",
      rawSourceText: "Tickets issued in five series MA, MB, MC, MD, ME"
    },
    tierRules: [
      {
        tierCode: "I",
        tierName: "1st Prize",
        rank: 1,
        category: "I",
        amount: 100000000,
        currency: "INR",
        selectionBasis: "COMMON_TO_ALL_SERIES",
        numberLength: 6,
        seriesScope: "ALL_SERIES",
        drawCount: 1,
        maximumPrizeCount: 1,
        isConsolation: false,
        isSuffix: false,
        sourceEvidence: { pageNumber: 1, rawText: "1st Prize Rs :100000000/-" },
        applicability: "Common to all series"
      },
      {
        tierCode: "CONSOLATION",
        tierName: "Cons Prize",
        rank: 0,
        category: "CONSOLATION",
        amount: 100000,
        currency: "INR",
        selectionBasis: "CONSOLATION",
        numberLength: 6,
        seriesScope: "REMAINING_SERIES",
        drawCount: 4,
        maximumPrizeCount: 4,
        isConsolation: true,
        isSuffix: false,
        sourceEvidence: { pageNumber: 1, rawText: "Cons Prize-Rs :100000/-" },
        applicability: "Tickets with 1st prize winning number in remaining 4 series"
      },
      {
        tierCode: "II",
        tierName: "2nd Prize",
        rank: 2,
        category: "II",
        amount: 1000000,
        currency: "INR",
        selectionBasis: "ONE_PER_SERIES",
        numberLength: 6,
        seriesScope: "PER_SERIES",
        drawCount: 5,
        maximumPrizeCount: 5,
        isConsolation: false,
        isSuffix: false,
        sourceEvidence: { pageNumber: 1, rawText: "2nd Prize Rs :1000000/- (1 in each series MA, MB, MC, MD, ME)" },
        applicability: "One winning ticket per series across 5 series"
      },
      {
        tierCode: "III",
        tierName: "3rd Prize",
        rank: 3,
        category: "III",
        amount: 500000,
        currency: "INR",
        selectionBasis: "ONE_PER_SERIES",
        numberLength: 6,
        seriesScope: "PER_SERIES",
        drawCount: 5,
        maximumPrizeCount: 5,
        isConsolation: false,
        isSuffix: false,
        sourceEvidence: { pageNumber: 1, rawText: "3rd Prize Rs :500000/- (1 in each series MA, MB, MC, MD, ME)" },
        applicability: "One winning ticket per series across 5 series"
      },
      {
        tierCode: "IV",
        tierName: "4th Prize",
        rank: 4,
        category: "IV",
        amount: 300000,
        currency: "INR",
        selectionBasis: "ONE_PER_SERIES",
        numberLength: 6,
        seriesScope: "PER_SERIES",
        drawCount: 5,
        maximumPrizeCount: 5,
        isConsolation: false,
        isSuffix: false,
        sourceEvidence: { pageNumber: 1, rawText: "4th Prize Rs :300000/- (1 in each series MA, MB, MC, MD, ME)" },
        applicability: "One winning ticket per series across 5 series"
      },
      {
        tierCode: "V",
        tierName: "5th Prize",
        rank: 5,
        category: "V",
        amount: 5000,
        currency: "INR",
        selectionBasis: "LAST_FOUR_DIGITS",
        numberLength: 4,
        seriesScope: "ALL_SERIES",
        drawCount: 30,
        maximumPrizeCount: 13500,
        isConsolation: false,
        isSuffix: true,
        sourceEvidence: { pageNumber: 1, rawText: "5th Prize-Rs :5000/- (FOR THE TICKETS ENDING WITH... 30 draws)" },
        applicability: "Last four digits drawn (30 times)"
      },
      {
        tierCode: "VI",
        tierName: "6th Prize",
        rank: 6,
        category: "VI",
        amount: 1000,
        currency: "INR",
        selectionBasis: "LAST_FOUR_DIGITS",
        numberLength: 4,
        seriesScope: "ALL_SERIES",
        drawCount: 90,
        maximumPrizeCount: 40500,
        isConsolation: false,
        isSuffix: true,
        sourceEvidence: { pageNumber: 2, rawText: "6th Prize-Rs :1000/- (FOR THE TICKETS ENDING WITH... 90 draws)" },
        applicability: "Last four digits drawn (90 times)"
      },
      {
        tierCode: "VII",
        tierName: "7th Prize",
        rank: 7,
        category: "VII",
        amount: 500,
        currency: "INR",
        selectionBasis: "LAST_FOUR_DIGITS",
        numberLength: 4,
        seriesScope: "ALL_SERIES",
        drawCount: 252,
        maximumPrizeCount: 113400,
        isConsolation: false,
        isSuffix: true,
        sourceEvidence: { pageNumber: 2, rawText: "7th Prize-Rs :500/- (FOR THE TICKETS ENDING WITH... 252 draws)" },
        applicability: "Last four digits drawn (252 times)"
      },
      {
        tierCode: "VIII",
        tierName: "8th Prize",
        rank: 8,
        category: "VIII",
        amount: 250,
        currency: "INR",
        selectionBasis: "LAST_FOUR_DIGITS",
        numberLength: 4,
        seriesScope: "ALL_SERIES",
        drawCount: 306,
        maximumPrizeCount: 137700,
        isConsolation: false,
        isSuffix: true,
        sourceEvidence: { pageNumber: 3, rawText: "8th Prize-Rs :250/- (FOR THE TICKETS ENDING WITH... 306 draws)" },
        applicability: "Last four digits drawn (306 times)"
      }
    ],
    descriptiveOnly: true
  };
  repo.registerSchemeVersion(monsoonBumperScheme);

  // Thiruvonam Bumper (BR-111)
  const thiruvonamBumperScheme: PrizeSchemeVersion = {
    id: "scheme_ver_thiruvonam_bumper_2026_br111",
    schemeId: "scheme_thiruvonam_bumper",
    lotteryId: "THIRUVONAM_BUMPER",
    lotteryCode: "THIRUVONAM_BUMPER",
    lotteryName: "THIRUVONAM BUMPER LOTTERY",
    schemeType: "BUMPER",
    version: "v2026-br111",
    status: "ACTIVE",
    applicability: {
      effectiveFrom: "2026-09-01",
      effectiveTo: "2026-09-30",
      notes: "Bumper scheme observed from official result PDF 282-2338-26-09-2026.pdf (BR-111th). Authority Priority: 3 (RESULT_PDF)."
    },
    effectiveFrom: "2026-09-01",
    effectiveTo: "2026-09-30",
    sourceDocumentSha256: THIRUVONAM_BUMPER_RESULT_SHA256,
    sourceNotificationNumber: "RESULT-PDF-BR-111",
    sourcePublishedDate: "2026-09-26",
    ticketPrice: 500,
    ticketsPrinted: 9000000,
    numberOfSeries: 10,
    seriesCodes: ["TA", "TB", "TC", "TD", "TE", "TG", "TH", "TJ", "TK", "TL"],
    totalPrizeAmount: 1250000000,
    periodicity: "Annual Festival Bumper",
    drawLocation: "Thiruvananthapuram",
    provenance: {
      sourceType: "RESULT_PDF",
      authorityPriority: 3,
      documentSha256: THIRUVONAM_BUMPER_RESULT_SHA256,
      notificationNumber: "DRAW NO. BR-111th",
      publishedDate: "2026-09-26",
      pageNumber: 1,
      evidenceText: "Official Result PDF: THIRUVONAM BUMPER LOTTERY LOTTERY NO.BR-111th DRAW held on 26/09/2026",
      parserVersion: "v1.0.0-result-pdf"
    },
    seriesRule: {
      numberOfSeries: 10,
      seriesPattern: "T[A-L] (10 series excluding TI, TF)",
      knownSeriesCodes: ["TA", "TB", "TC", "TD", "TE", "TG", "TH", "TJ", "TK", "TL"],
      selectionScope: "PER_SERIES",
      rawSourceText: "Tickets issued in 10 series TA, TB, TC, TD, TE, TG, TH, TJ, TK, TL"
    },
    tierRules: [
      {
        tierCode: "I",
        tierName: "1st Prize",
        rank: 1,
        category: "I",
        amount: 300000000, // 30 crore
        currency: "INR",
        selectionBasis: "COMMON_TO_ALL_SERIES",
        numberLength: 6,
        seriesScope: "ALL_SERIES",
        drawCount: 1,
        maximumPrizeCount: 1,
        isConsolation: false,
        isSuffix: false,
        sourceEvidence: { pageNumber: 1, rawText: "1st Prize Rs :300000000/-" },
        applicability: "Common to all series"
      },
      {
        tierCode: "CONSOLATION",
        tierName: "Cons Prize",
        rank: 0,
        category: "CONSOLATION",
        amount: 500000,
        currency: "INR",
        selectionBasis: "CONSOLATION",
        numberLength: 6,
        seriesScope: "REMAINING_SERIES",
        drawCount: 9,
        maximumPrizeCount: 9,
        isConsolation: true,
        isSuffix: false,
        sourceEvidence: { pageNumber: 1, rawText: "Cons Prize-Rs :500000/-" },
        applicability: "Tickets with 1st prize winning number in remaining 9 series"
      },
      {
        tierCode: "II",
        tierName: "2nd Prize",
        rank: 2,
        category: "II",
        amount: 10000000, // 1 crore
        currency: "INR",
        selectionBasis: "N_PER_SERIES",
        numberLength: 6,
        seriesScope: "PER_SERIES",
        drawCount: 20, // 2 in each of 10 series
        maximumPrizeCount: 20,
        isConsolation: false,
        isSuffix: false,
        sourceEvidence: { pageNumber: 1, rawText: "2nd Prize Rs :10000000/- (20 prizes across 10 series)" },
        applicability: "2 winning tickets per series across 10 series"
      },
      {
        tierCode: "III",
        tierName: "3rd Prize",
        rank: 3,
        category: "III",
        amount: 2500000,
        currency: "INR",
        selectionBasis: "N_PER_SERIES",
        numberLength: 6,
        seriesScope: "PER_SERIES",
        drawCount: 20,
        maximumPrizeCount: 20,
        isConsolation: false,
        isSuffix: false,
        sourceEvidence: { pageNumber: 1, rawText: "3rd Prize Rs :2500000/- (20 prizes across 10 series)" },
        applicability: "2 winning tickets per series across 10 series"
      },
      {
        tierCode: "IV",
        tierName: "4th Prize",
        rank: 4,
        category: "IV",
        amount: 500000,
        currency: "INR",
        selectionBasis: "ONE_PER_SERIES",
        numberLength: 6,
        seriesScope: "PER_SERIES",
        drawCount: 10,
        maximumPrizeCount: 10,
        isConsolation: false,
        isSuffix: false,
        sourceEvidence: { pageNumber: 2, rawText: "4th Prize Rs :500000/- (1 in each series)" },
        applicability: "One winning ticket per series across 10 series"
      },
      {
        tierCode: "V",
        tierName: "5th Prize",
        rank: 5,
        category: "V",
        amount: 200000,
        currency: "INR",
        selectionBasis: "ONE_PER_SERIES",
        numberLength: 6,
        seriesScope: "PER_SERIES",
        drawCount: 10,
        maximumPrizeCount: 10,
        isConsolation: false,
        isSuffix: false,
        sourceEvidence: { pageNumber: 2, rawText: "5th Prize Rs :200000/- (1 in each series)" },
        applicability: "One winning ticket per series across 10 series"
      },
      {
        tierCode: "VI",
        tierName: "6th Prize",
        rank: 6,
        category: "VI",
        amount: 5000,
        currency: "INR",
        selectionBasis: "LAST_FOUR_DIGITS",
        numberLength: 4,
        seriesScope: "ALL_SERIES",
        drawCount: 60,
        maximumPrizeCount: 54000,
        isConsolation: false,
        isSuffix: true,
        sourceEvidence: { pageNumber: 3, rawText: "6th Prize-Rs :5000/- (FOR THE TICKETS ENDING WITH... 60 draws)" },
        applicability: "Last four digits drawn (60 times)"
      },
      {
        tierCode: "VII",
        tierName: "7th Prize",
        rank: 7,
        category: "VII",
        amount: 2000,
        currency: "INR",
        selectionBasis: "LAST_FOUR_DIGITS",
        numberLength: 4,
        seriesScope: "ALL_SERIES",
        drawCount: 90,
        maximumPrizeCount: 81000,
        isConsolation: false,
        isSuffix: true,
        sourceEvidence: { pageNumber: 4, rawText: "7th Prize-Rs :2000/- (FOR THE TICKETS ENDING WITH... 90 draws)" },
        applicability: "Last four digits drawn (90 times)"
      },
      {
        tierCode: "VIII",
        tierName: "8th Prize",
        rank: 8,
        category: "VIII",
        amount: 1000,
        currency: "INR",
        selectionBasis: "LAST_FOUR_DIGITS",
        numberLength: 4,
        seriesScope: "ALL_SERIES",
        drawCount: 138,
        maximumPrizeCount: 124200,
        isConsolation: false,
        isSuffix: true,
        sourceEvidence: { pageNumber: 4, rawText: "8th Prize-Rs :1000/- (FOR THE TICKETS ENDING WITH... 138 draws)" },
        applicability: "Last four digits drawn (138 times)"
      },
      {
        tierCode: "IX",
        tierName: "9th Prize",
        rank: 9,
        category: "IX",
        amount: 500,
        currency: "INR",
        selectionBasis: "LAST_FOUR_DIGITS",
        numberLength: 4,
        seriesScope: "ALL_SERIES",
        drawCount: 306,
        maximumPrizeCount: 275400,
        isConsolation: false,
        isSuffix: true,
        sourceEvidence: { pageNumber: 5, rawText: "9th Prize-Rs :500/- (FOR THE TICKETS ENDING WITH... 306 draws)" },
        applicability: "Last four digits drawn (306 times)"
      }
    ],
    descriptiveOnly: true
  };
  repo.registerSchemeVersion(thiruvonamBumperScheme);

  return repo;
}

/**
 * Checks whether an authoritative Government Gazette / S.R.O. notification exists in the registry
 * for a given lottery code.
 */
export function hasOfficialGazetteSro(lotteryCode: string): boolean {
  const norm = normalizeLotteryCode(lotteryCode);
  return norm === "BT" || norm === "DL" || norm === "KN";
}
