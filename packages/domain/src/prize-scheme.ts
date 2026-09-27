/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 7A.6 — Versioned Prize Scheme / Prize Structure Registry
 *
 * Distinguishes:
 * 1. OFFICIAL SCHEME RULE (promulgated via Government Gazette / S.R.O. Notifications)
 * 2. OBSERVED DRAW RESULT (extracted from official daily result PDFs)
 * 3. THEORETICAL SCHEME CAPACITY vs ACTUAL OBSERVED WINNERS
 * 4. WEEKLY vs BUMPER lottery classification
 * 5. SCHEME AUTHORITY LEVEL:
 *    - OFFICIAL_SCHEME: Backed by authoritative Government Gazette S.R.O.
 *    - OBSERVED_SCHEME_ARCHETYPE: Result-PDF-derived structure retained as archetype
 * 6. AUTHORITATIVE SOURCE PRIORITY:
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

export type SchemeAuthorityLevel = "OFFICIAL_SCHEME" | "OBSERVED_SCHEME_ARCHETYPE";

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
  authorityLevel: SchemeAuthorityLevel;
  documentSha256: string | null;
  isPhysicalDocumentAvailable: boolean;
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
  lotteryCode: string; // e.g. "BT", "DL", "KN", "SS", "SK", "KR", "SM"
  lotteryName: string; // e.g. "Bhagyathara (BT) Weekly Lottery"
  schemeType: SchemeType;
  authorityLevel: SchemeAuthorityLevel;
  version: string; // e.g. "v2025-11-sro1297"
  status: SchemeStatus;
  applicability: SchemeApplicability;
  effectiveFrom: string; // ISO YYYY-MM-DD
  effectiveTo?: string; // ISO YYYY-MM-DD
  supersedesSchemeId?: string;
  supersededBySchemeId?: string;
  sourceDocumentSha256: string | null;
  isPhysicalDocumentAvailable: boolean;
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
  authorityLevel: SchemeAuthorityLevel;
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
  authorityLevel?: SchemeAuthorityLevel;
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
  authorityLevel?: SchemeAuthorityLevel;
  validationStatus: SchemeValidationStatus;
  isValid: boolean;
  discrepancies: string[];
  theoreticalVsObserved: TheoreticalVsObservedCount[];
  sourceAuthority: string;
}

// ============================================================================
// 8. Total Prize Reconciliation Contract
// ============================================================================

export interface PrizeReconciliationResult {
  isReconciled: boolean;
  expectedTotal: number;
  calculatedTotal: number;
  difference: number;
  breakdown: Array<{
    tierCode: string;
    tierName: string;
    amount: number;
    count: number;
    subtotal: number;
  }>;
}

export function reconcilePrizeSchemeTotal(scheme: PrizeSchemeVersion): PrizeReconciliationResult {
  let calculatedTotal = 0;
  const breakdown: PrizeReconciliationResult["breakdown"] = [];

  for (const tier of scheme.tierRules) {
    const subtotal = tier.amount * tier.maximumPrizeCount;
    calculatedTotal += subtotal;
    breakdown.push({
      tierCode: tier.tierCode,
      tierName: tier.tierName,
      amount: tier.amount,
      count: tier.maximumPrizeCount,
      subtotal
    });
  }

  const difference = calculatedTotal - scheme.totalPrizeAmount;
  return {
    isReconciled: difference === 0,
    expectedTotal: scheme.totalPrizeAmount,
    calculatedTotal,
    difference,
    breakdown
  };
}

// ============================================================================
// 9. Provenance & SHA Integrity Validators
// ============================================================================

export function isValidSha256Hex(sha: string | null | undefined): boolean {
  if (sha === null || sha === undefined) return false;
  return /^[0-9a-f]{64}$/i.test(sha);
}

export function validateSchemeProvenanceIntegrity(version: PrizeSchemeVersion): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (version.sourceDocumentSha256 !== null && !isValidSha256Hex(version.sourceDocumentSha256)) {
    errors.push(
      `Invalid sourceDocumentSha256 '${version.sourceDocumentSha256}' in '${version.id}'. Must be a 64-character hexadecimal SHA-256 string or null.`
    );
  }

  if (version.provenance.documentSha256 !== null && !isValidSha256Hex(version.provenance.documentSha256)) {
    errors.push(
      `Invalid provenance.documentSha256 '${version.provenance.documentSha256}' in '${version.id}'. Must be a 64-character hexadecimal SHA-256 string or null.`
    );
  }

  if (version.sourceDocumentSha256 !== version.provenance.documentSha256) {
    errors.push(
      `Mismatch between version sourceDocumentSha256 ('${version.sourceDocumentSha256}') and provenance.documentSha256 ('${version.provenance.documentSha256}') in '${version.id}'.`
    );
  }

  if (version.authorityLevel === "OFFICIAL_SCHEME") {
    if (version.provenance.authorityPriority > 2) {
      errors.push(
        `Official scheme '${version.id}' cannot have authority priority ${version.provenance.authorityPriority} > 2`
      );
    }
    if (version.provenance.sourceType !== "GAZETTE_SRO" && version.provenance.sourceType !== "OFFICIAL_PUBLICATION") {
      errors.push(
        `Official scheme '${version.id}' must have sourceType 'GAZETTE_SRO' or 'OFFICIAL_PUBLICATION'`
      );
    }
  }

  if (version.authorityLevel === "OBSERVED_SCHEME_ARCHETYPE") {
    if (version.provenance.sourceType === "GAZETTE_SRO") {
      errors.push(
        `Observed scheme archetype '${version.id}' cannot claim sourceType 'GAZETTE_SRO'`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// ============================================================================
// 10. Repository Interface
// ============================================================================

export interface IPrizeSchemeRepository {
  registerSchemeVersion(version: PrizeSchemeVersion): void;
  getSchemeVersion(id: string): PrizeSchemeVersion | undefined;
  getAllVersions(): PrizeSchemeVersion[];
  getVersionsForLottery(lotteryCode: string): PrizeSchemeVersion[];
  resolveSchemeForDraw(query: DrawResolutionQuery): SchemeResolutionResult;
}

// ============================================================================
// 11. Date & String Normalization Utilities
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
// 12. Draw -> Scheme Resolution Engine
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
      resolutionEvidence: `UNRESOLVED: Insufficient draw metadata: lottery='${query.lotteryName}', date='${query.drawDate}'`,
      confidence: 0
    };
  }

  const allVersionsForLottery = registry.getVersionsForLottery(lotteryCode);
  if (allVersionsForLottery.length === 0) {
    return {
      status: "SCHEME_NOT_FOUND",
      resolutionEvidence: `UNRESOLVED: No authoritative scheme document ingested for lottery '${lotteryCode}' ('${query.lotteryName}'). Authority source missing in local registry.`,
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
    const earliest = allVersionsForLottery.map((v) => v.effectiveFrom).sort()[0];
    return {
      status: "SCHEME_NOT_FOUND",
      resolutionEvidence: `UNRESOLVED: Draw date '${isoDate}' does not fall within any registered active window for '${lotteryCode}' (earliest: ${earliest})`,
      confidence: 0
    };
  }

  // Handle supersession: if candidate A supersedes candidate B, candidate A prevails
  const resolvedCandidates = candidates.filter((c) => {
    const supersededByAnother = candidates.some((other) => other.supersedesSchemeId === c.id);
    return !supersededByAnother;
  });

  if (resolvedCandidates.length === 1) {
    const chosen = resolvedCandidates[0]!;
    return {
      status: "SCHEME_RESOLVED",
      authorityLevel: chosen.authorityLevel,
      schemeVersion: chosen,
      resolutionEvidence: `Resolved to ${chosen.lotteryName} version ${chosen.version} [${chosen.authorityLevel}] (effective from ${chosen.effectiveFrom}${chosen.effectiveTo ? " to " + chosen.effectiveTo : " onwards"}, SRO: ${chosen.sourceSroNumber || chosen.sourceNotificationNumber})`,
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
    resolutionEvidence: `UNRESOLVED: No unambiguous scheme version found for lottery '${lotteryCode}' on '${isoDate}'`,
    confidence: 0
  };
}

// ============================================================================
// 13. Result <-> Scheme Validation Engine (with BUMPER Structural Rules)
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

  // Find 1st prize winning result for consolation cross-checking
  let firstPrizeResult:
    | {
        canonicalNumber: string;
        series?: string;
      }
    | undefined = undefined;

  if (draw.winningResults) {
    const r1 = draw.winningResults.find((r) => r.rank === 1 && !r.isSuffix);
    if (r1) {
      firstPrizeResult = {
        canonicalNumber: r1.canonicalNumber,
        series: r1.series
      };
    }
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

    // Detailed winning results validation
    let observedCount = 0;
    if (draw.winningResults) {
      const resultsForTier = draw.winningResults.filter((r) => {
        if (rule.isConsolation) {
          return r.prizeTierName?.toLowerCase().includes("cons") || r.rank === 0;
        }
        return r.rank === rule.rank;
      });
      observedCount = resultsForTier.length;

      // 4. Verify number length for each ticket in tier
      for (const res of resultsForTier) {
        if (res.canonicalNumber.length !== rule.numberLength) {
          discrepancies.push(
            `Number length mismatch in '${rule.tierName}': expected ${rule.numberLength} digits, observed '${res.canonicalNumber}' (${res.canonicalNumber.length} digits)`
          );
          break;
        }
      }

      // 5. COMMON_TO_ALL_SERIES Validation
      if (rule.selectionBasis === "COMMON_TO_ALL_SERIES") {
        if (observedCount !== rule.drawCount) {
          discrepancies.push(
            `Common prize count mismatch in '${rule.tierName}': scheme prescribes ${rule.drawCount}, observed ${observedCount}`
          );
        }
      }

      // 6. ONE_PER_SERIES Validation (BUMPER rule)
      if (rule.selectionBasis === "ONE_PER_SERIES") {
        const expectedCount = scheme.numberOfSeries;
        if (observedCount !== expectedCount) {
          discrepancies.push(
            `ONE_PER_SERIES count mismatch in '${rule.tierName}': expected ${expectedCount} prizes (1 per series across ${scheme.numberOfSeries} series), observed ${observedCount}`
          );
        }

        // Validate series allocation if series codes are observable
        const observedSeriesList = resultsForTier
          .map((r) => r.series)
          .filter((s): s is string => typeof s === "string" && s.length > 0);

        if (observedSeriesList.length > 0) {
          const uniqueSeries = new Set(observedSeriesList);
          if (uniqueSeries.size !== observedSeriesList.length) {
            discrepancies.push(
              `ONE_PER_SERIES series duplication in '${rule.tierName}': found repeated series in winning tickets: ${observedSeriesList.join(", ")}`
            );
          }
          if (scheme.seriesCodes && scheme.seriesCodes.length > 0) {
            for (const s of observedSeriesList) {
              if (!scheme.seriesCodes.includes(s)) {
                discrepancies.push(
                  `ONE_PER_SERIES unknown series '${s}' in '${rule.tierName}'. Expected one of: ${scheme.seriesCodes.join(", ")}`
                );
              }
            }
          }
        }
      }

      // 7. N_PER_SERIES Validation (BUMPER rule)
      if (rule.selectionBasis === "N_PER_SERIES") {
        const nPerSeries = rule.drawCount / scheme.numberOfSeries;
        if (observedCount !== rule.drawCount) {
          discrepancies.push(
            `N_PER_SERIES count mismatch in '${rule.tierName}': expected ${rule.drawCount} prizes (${nPerSeries} per series across ${scheme.numberOfSeries} series), observed ${observedCount}`
          );
        }

        const observedSeriesList = resultsForTier
          .map((r) => r.series)
          .filter((s): s is string => typeof s === "string" && s.length > 0);

        if (observedSeriesList.length > 0 && nPerSeries > 0) {
          const seriesCounts = new Map<string, number>();
          for (const s of observedSeriesList) {
            seriesCounts.set(s, (seriesCounts.get(s) || 0) + 1);
          }
          for (const [seriesCode, count] of seriesCounts.entries()) {
            if (count > nPerSeries) {
              discrepancies.push(
                `N_PER_SERIES allocation overflow in '${rule.tierName}': series '${seriesCode}' has ${count} prizes, expected at most ${nPerSeries}`
              );
            }
          }
        }
      }

      // 8. CONSOLATION Validation (Remaining Series Rule)
      if (rule.isConsolation) {
        const expectedConsolationCount = scheme.numberOfSeries - 1;
        if (observedCount !== expectedConsolationCount && observedCount !== rule.drawCount) {
          discrepancies.push(
            `Consolation prize count mismatch: expected ${expectedConsolationCount} (remaining series for ${scheme.numberOfSeries} series), observed ${observedCount}`
          );
        }

        // Validate that consolation prizes match the 1st prize winning number
        if (firstPrizeResult) {
          for (const cResult of resultsForTier) {
            if (cResult.canonicalNumber !== firstPrizeResult.canonicalNumber) {
              discrepancies.push(
                `Consolation ticket number mismatch: expected '${firstPrizeResult.canonicalNumber}' (same as 1st prize), observed '${cResult.canonicalNumber}'`
              );
              break;
            }
            if (cResult.series && firstPrizeResult.series && cResult.series === firstPrizeResult.series) {
              discrepancies.push(
                `Consolation ticket series conflict: consolation prize cannot be awarded to 1st prize winning series '${cResult.series}'`
              );
            }
          }
        }

        // Validate uniqueness of consolation series
        const consolationSeries = resultsForTier
          .map((r) => r.series)
          .filter((s): s is string => typeof s === "string" && s.length > 0);
        if (consolationSeries.length > 0) {
          const uniqueConsSeries = new Set(consolationSeries);
          if (uniqueConsSeries.size !== consolationSeries.length) {
            discrepancies.push(
              `Duplicate series in consolation prizes: ${consolationSeries.join(", ")}`
            );
          }
        }
      }

      // 9. Suffix Repetition Validation
      if (rule.isSuffix) {
        if (rule.drawCount > 0 && observedCount !== rule.drawCount && scheme.schemeType === "WEEKLY") {
          discrepancies.push(
            `Suffix repetition mismatch in '${rule.tierName}': scheme prescribes ${rule.drawCount} draws, observed ${observedCount}`
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
        : rule.selectionBasis === "ONE_PER_SERIES"
        ? `One prize in each of ${scheme.numberOfSeries} series (${rule.drawCount} total)`
        : rule.selectionBasis === "N_PER_SERIES"
        ? `${rule.drawCount / scheme.numberOfSeries} prizes in each of ${scheme.numberOfSeries} series (${rule.drawCount} total)`
        : `Common to all series, ${rule.drawCount} winning ticket`
    });
  }

  const isValid = discrepancies.length === 0;

  const authorityDescription =
    scheme.authorityLevel === "OFFICIAL_SCHEME"
      ? `Government of Kerala Gazette S.R.O. (${scheme.provenance.sroNumber || scheme.sourceNotificationNumber})`
      : `Observed Scheme Archetype (Reference Result PDF ${scheme.sourceNotificationNumber})`;

  return {
    drawId,
    lotteryName: draw.lotteryName,
    drawDate: draw.drawDate,
    schemeVersionId: scheme.id,
    schemeType: scheme.schemeType,
    authorityLevel: scheme.authorityLevel,
    validationStatus: isValid ? "VALIDATED" : "MISMATCH",
    isValid,
    discrepancies,
    theoreticalVsObserved,
    sourceAuthority: authorityDescription
  };
}

// ============================================================================
// 14. In-Memory Prize Scheme Repository Implementation
// ============================================================================

export class InMemoryPrizeSchemeRepository implements IPrizeSchemeRepository {
  private readonly versions = new Map<string, PrizeSchemeVersion>();
  private readonly lotteryVersions = new Map<string, string[]>();

  public registerSchemeVersion(version: PrizeSchemeVersion): void {
    if (!version.id) {
      throw new Error("Cannot register scheme version without an id");
    }

    // Validate provenance integrity (no fake SHAs, consistent SHA fields)
    const integrity = validateSchemeProvenanceIntegrity(version);
    if (!integrity.isValid) {
      throw new Error(`Provenance integrity failure for '${version.id}': ${integrity.errors.join("; ")}`);
    }

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
// 15. Authoritative Seed Factory (Government Gazette SROs)
// ============================================================================

export const BT_SRO_SHA256 = "282cefde6d91660d1b897ed085ebf0cf0262e7c8d3ff0ed884c4d61a133e6703";
export const DL_SRO_SHA256 = "bd3ad7ea79750c4ab91f91d2c7c97935ce543aa8d62bcec8631129516b3588ab";
export const KN_SRO_SHA256 = "d4f8e6f2bda9bff364b0eb7ca8a375c843da311a6f78a2d17b50986818466b85";
export const SS_SRO_SHA256 = "398f9a26bb696f73289972d50d30085f88bc1cc28bdb83adcb88cfbd9c318011";
export const SK_SRO_SHA256 = "a55a29ad43bebcdd7d2563313a17c91b46a30e39f12947da12c28b055bc0fc54";
export const KR_SRO_SHA256 = "f37cbc6f335c0cb2b1bfc9ee03c7b5bcbbecb474b83542629b1b4040cf57517a";
export const SM_SRO_SHA256 = "d769a3191bfa9b4f3253652c02aa05931ccd32e0aec28b4c41a520aa998f8336";

export const MONSOON_BUMPER_SRO_SHA256 = "262f3b0a29c27ad8685f715bef4c5f066ec1368b7bc5e2a501dbf9f5f7a4ddd3";
export const THIRUVONAM_BUMPER_RESULT_SHA256 = "f89bd80ca46cd5b0beab395f2d75f2eda81e83b6460f28dcb4f52eacf44511c3";

// Helper to construct weekly tier rules
function createStandardWeeklyTierRules(opts: {
  secondPrizeAmount: number;
  secondPrizeDrawCount: number;
  thirdPrizeAmount: number;
  thirdPrizeDrawCount: number;
  seventhDrawCount: number;
  eighthDrawCount: number;
  ninthDrawCount: number;
  evidencePage: number;
}): PrizeTierRule[] {
  const factor = 1080; // 1,08,00,000 / 10,000
  return [
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
      sourceEvidence: { pageNumber: opts.evidencePage, rawText: "Category I: Common to all series. Amount: 1,00,00,000. No of prizes: 1" },
      applicability: "Common to all series"
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
      agentCommission: 500,
      sourceEvidence: { pageNumber: opts.evidencePage, rawText: "Consolation Prize: Remaining 11 series. Amount: 5,000. No of prizes: 11" },
      applicability: "Remaining series with 1st prize winning number"
    },
    {
      tierCode: "II",
      tierName: "2nd Prize",
      rank: 2,
      category: "II",
      amount: opts.secondPrizeAmount,
      currency: "INR",
      selectionBasis: "COMMON_TO_ALL_SERIES",
      numberLength: 6,
      seriesScope: "ALL_SERIES",
      drawCount: opts.secondPrizeDrawCount,
      maximumPrizeCount: opts.secondPrizeDrawCount,
      isConsolation: false,
      isSuffix: false,
      agentCommission: opts.secondPrizeAmount * 0.1,
      sourceEvidence: { pageNumber: opts.evidencePage, rawText: `Category II: Common to all series. Amount: ${opts.secondPrizeAmount}. No of prizes: ${opts.secondPrizeDrawCount}` },
      applicability: "Common to all series"
    },
    {
      tierCode: "III",
      tierName: "3rd Prize",
      rank: 3,
      category: "III",
      amount: opts.thirdPrizeAmount,
      currency: "INR",
      selectionBasis: "COMMON_TO_ALL_SERIES",
      numberLength: 6,
      seriesScope: "ALL_SERIES",
      drawCount: opts.thirdPrizeDrawCount,
      maximumPrizeCount: opts.thirdPrizeDrawCount,
      isConsolation: false,
      isSuffix: false,
      agentCommission: opts.thirdPrizeAmount * 0.1,
      sourceEvidence: { pageNumber: opts.evidencePage, rawText: `Category III: Common to all series. Amount: ${opts.thirdPrizeAmount}. No of prizes: ${opts.thirdPrizeDrawCount}` },
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
      maximumPrizeCount: 19 * factor,
      isConsolation: false,
      isSuffix: true,
      agentCommission: 500,
      sourceEvidence: { pageNumber: opts.evidencePage, rawText: "Category IV: Last Four digits to be drawn 19 times. Amount: 5,000. Up to 20,520 prizes" },
      applicability: "Last four digits to be drawn 19 times"
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
      maximumPrizeCount: 6 * factor,
      isConsolation: false,
      isSuffix: true,
      agentCommission: 200,
      sourceEvidence: { pageNumber: opts.evidencePage, rawText: "Category V: Last Four digits to be drawn 6 times. Amount: 2,000. Up to 6,480 prizes" },
      applicability: "Last four digits to be drawn 6 times"
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
      maximumPrizeCount: 25 * factor,
      isConsolation: false,
      isSuffix: true,
      agentCommission: 100,
      sourceEvidence: { pageNumber: opts.evidencePage, rawText: "Category VI: Last Four digits to be drawn 25 times. Amount: 1,000. Up to 27,000 prizes" },
      applicability: "Last four digits to be drawn 25 times"
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
      drawCount: opts.seventhDrawCount,
      maximumPrizeCount: opts.seventhDrawCount * factor,
      isConsolation: false,
      isSuffix: true,
      agentCommission: 50,
      sourceEvidence: { pageNumber: opts.evidencePage, rawText: `Category VII: Last Four digits to be drawn ${opts.seventhDrawCount} times. Amount: 500. Up to ${opts.seventhDrawCount * factor} prizes` },
      applicability: `Last four digits to be drawn ${opts.seventhDrawCount} times`
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
      drawCount: opts.eighthDrawCount,
      maximumPrizeCount: opts.eighthDrawCount * factor,
      isConsolation: false,
      isSuffix: true,
      agentCommission: 20,
      sourceEvidence: { pageNumber: opts.evidencePage, rawText: `Category VIII: Last Four digits to be drawn ${opts.eighthDrawCount} times. Amount: 200. Up to ${opts.eighthDrawCount * factor} prizes` },
      applicability: `Last four digits to be drawn ${opts.eighthDrawCount} times`
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
      drawCount: opts.ninthDrawCount,
      maximumPrizeCount: opts.ninthDrawCount * factor,
      isConsolation: false,
      isSuffix: true,
      agentCommission: 15,
      sourceEvidence: { pageNumber: opts.evidencePage, rawText: `Category IX: Last Four digits to be drawn ${opts.ninthDrawCount} times. Amount: 100. Up to ${opts.ninthDrawCount * factor} prizes` },
      applicability: `Last four digits to be drawn ${opts.ninthDrawCount} times`
    }
  ];
}

export function createAuthoritativePrizeSchemeRegistry(): InMemoryPrizeSchemeRepository {
  const repo = new InMemoryPrizeSchemeRepository();

  // ==========================================================================
  // 1. BHAGYATHARA (BT) Weekly Lottery
  // ==========================================================================

  // Version 1 (Superseded): S.R.O. 1062/2025 (Physical source PDF unavailable -> null SHA)
  repo.registerSchemeVersion({
    id: "scheme_ver_bt_v2025-09-sro1062",
    schemeId: "scheme_bt_weekly",
    lotteryId: "BT",
    lotteryCode: "BT",
    lotteryName: "Bhagyathara (BT) Weekly Lottery",
    schemeType: "WEEKLY",
    authorityLevel: "OFFICIAL_SCHEME",
    version: "v2025-09-sro1062",
    status: "SUPERSEDED",
    applicability: {
      effectiveFrom: "2025-09-17",
      effectiveTo: "2025-11-09",
      supersededBySchemeId: "scheme_ver_bt_v2025-11-sro1297",
      supersededByNotification: "G.O.(P) No.192/2025/TAXES (S.R.O. No. 1297/2025)",
      notes: "Superseded by G.O.(P) No.192/2025/TAXES. Physical Gazette PDF not in local registry."
    },
    effectiveFrom: "2025-09-17",
    effectiveTo: "2025-11-09",
    supersededBySchemeId: "scheme_ver_bt_v2025-11-sro1297",
    sourceDocumentSha256: null,
    isPhysicalDocumentAvailable: false,
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
      authorityLevel: "OFFICIAL_SCHEME",
      documentSha256: null,
      isPhysicalDocumentAvailable: false,
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
    tierRules: [],
    descriptiveOnly: true
  });

  // Version 2 (Active): S.R.O. 1297/2025 (Physical source PDF verified)
  repo.registerSchemeVersion({
    id: "scheme_ver_bt_v2025-11-sro1297",
    schemeId: "scheme_bt_weekly",
    lotteryId: "BT",
    lotteryCode: "BT",
    lotteryName: "Bhagyathara (BT) Weekly Lottery",
    schemeType: "WEEKLY",
    authorityLevel: "OFFICIAL_SCHEME",
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
    isPhysicalDocumentAvailable: true,
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
      authorityLevel: "OFFICIAL_SCHEME",
      documentSha256: BT_SRO_SHA256,
      isPhysicalDocumentAvailable: true,
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
    tierRules: createStandardWeeklyTierRules({
      secondPrizeAmount: 3000000,
      secondPrizeDrawCount: 1,
      thirdPrizeAmount: 500000,
      thirdPrizeDrawCount: 1,
      seventhDrawCount: 76,
      eighthDrawCount: 94,
      ninthDrawCount: 144,
      evidencePage: 2
    }),
    descriptiveOnly: true
  });

  // ==========================================================================
  // 2. DHANALEKSHMI (DL) Weekly Lottery
  // ==========================================================================

  // Version 1 (Superseded): S.R.O. 1061/2025 (Physical source PDF unavailable -> null SHA)
  repo.registerSchemeVersion({
    id: "scheme_ver_dl_v2025-09-sro1061",
    schemeId: "scheme_dl_weekly",
    lotteryId: "DL",
    lotteryCode: "DL",
    lotteryName: "Dhanalekshmi (DL) Weekly Lottery",
    schemeType: "WEEKLY",
    authorityLevel: "OFFICIAL_SCHEME",
    version: "v2025-09-sro1061",
    status: "SUPERSEDED",
    applicability: {
      effectiveFrom: "2025-09-17",
      effectiveTo: "2025-11-09",
      supersededBySchemeId: "scheme_ver_dl_v2025-11-sro1296",
      supersededByNotification: "G.O.(P) No.191/2025/TAXES (S.R.O. No. 1296/2025)",
      notes: "Superseded by G.O.(P) No.191/2025/TAXES. Physical Gazette PDF not in local registry."
    },
    effectiveFrom: "2025-09-17",
    effectiveTo: "2025-11-09",
    supersededBySchemeId: "scheme_ver_dl_v2025-11-sro1296",
    sourceDocumentSha256: null,
    isPhysicalDocumentAvailable: false,
    sourceNotificationNumber: "G.O.(P) No.144/2025/TAXES",
    sourceSroNumber: "S. R. O. No. 1061/2025",
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
      authorityLevel: "OFFICIAL_SCHEME",
      documentSha256: null,
      isPhysicalDocumentAvailable: false,
      notificationNumber: "G.O.(P) No.144/2025/TAXES",
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
  });

  // Version 2 (Active): S.R.O. 1296/2025 (Physical source PDF verified)
  repo.registerSchemeVersion({
    id: "scheme_ver_dl_v2025-11-sro1296",
    schemeId: "scheme_dl_weekly",
    lotteryId: "DL",
    lotteryCode: "DL",
    lotteryName: "Dhanalekshmi (DL) Weekly Lottery",
    schemeType: "WEEKLY",
    authorityLevel: "OFFICIAL_SCHEME",
    version: "v2025-11-sro1296",
    status: "ACTIVE",
    applicability: {
      effectiveFrom: "2025-11-10",
      supersedesSchemeId: "scheme_ver_dl_v2025-09-sro1061",
      supersedesNotification: "G.O.(P) No.144/2025/TAXES (S.R.O. No. 1061/2025)",
      notes: "Issued in supersession of S.R.O. No. 1061/2025 in Kerala Gazette Extraordinary No. 3981."
    },
    effectiveFrom: "2025-11-10",
    supersedesSchemeId: "scheme_ver_dl_v2025-09-sro1061",
    sourceDocumentSha256: DL_SRO_SHA256,
    isPhysicalDocumentAvailable: true,
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
      authorityLevel: "OFFICIAL_SCHEME",
      documentSha256: DL_SRO_SHA256,
      isPhysicalDocumentAvailable: true,
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
    tierRules: createStandardWeeklyTierRules({
      secondPrizeAmount: 3000000,
      secondPrizeDrawCount: 1,
      thirdPrizeAmount: 500000,
      thirdPrizeDrawCount: 1,
      seventhDrawCount: 76,
      eighthDrawCount: 96,
      ninthDrawCount: 138,
      evidencePage: 2
    }),
    descriptiveOnly: true
  });

  // ==========================================================================
  // 3. KARUNYA PLUS (KN) Weekly Lottery
  // ==========================================================================

  // Version 1 (Superseded): S.R.O. 1060/2025 (Physical source PDF unavailable -> null SHA)
  repo.registerSchemeVersion({
    id: "scheme_ver_kn_v2025-09-sro1060",
    schemeId: "scheme_kn_weekly",
    lotteryId: "KN",
    lotteryCode: "KN",
    lotteryName: "Karunya Plus (KN) Weekly Lottery",
    schemeType: "WEEKLY",
    authorityLevel: "OFFICIAL_SCHEME",
    version: "v2025-09-sro1060",
    status: "SUPERSEDED",
    applicability: {
      effectiveFrom: "2025-09-17",
      effectiveTo: "2025-11-09",
      supersededBySchemeId: "scheme_ver_kn_v2025-11-sro1294",
      supersededByNotification: "G.O.(P) No.189/2025/TAXES (S.R.O. No. 1294/2025)",
      notes: "Superseded by G.O.(P) No.189/2025/TAXES. Physical Gazette PDF not in local registry."
    },
    effectiveFrom: "2025-09-17",
    effectiveTo: "2025-11-09",
    supersededBySchemeId: "scheme_ver_kn_v2025-11-sro1294",
    sourceDocumentSha256: null,
    isPhysicalDocumentAvailable: false,
    sourceNotificationNumber: "G.O.(P) No.143/2025/TAXES",
    sourceSroNumber: "S. R. O. No. 1060/2025",
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
      authorityLevel: "OFFICIAL_SCHEME",
      documentSha256: null,
      isPhysicalDocumentAvailable: false,
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
  });

  // Version 2 (Active): S.R.O. 1294/2025 (Physical source PDF verified)
  repo.registerSchemeVersion({
    id: "scheme_ver_kn_v2025-11-sro1294",
    schemeId: "scheme_kn_weekly",
    lotteryId: "KN",
    lotteryCode: "KN",
    lotteryName: "Karunya Plus (KN) Weekly Lottery",
    schemeType: "WEEKLY",
    authorityLevel: "OFFICIAL_SCHEME",
    version: "v2025-11-sro1294",
    status: "ACTIVE",
    applicability: {
      effectiveFrom: "2025-11-10",
      supersedesSchemeId: "scheme_ver_kn_v2025-09-sro1060",
      supersedesNotification: "G.O.(P) No.143/2025/TAXES (S.R.O. No. 1060/2025)",
      notes: "Issued in supersession of S.R.O. No. 1060/2025 in Kerala Gazette Extraordinary No. 3979."
    },
    effectiveFrom: "2025-11-10",
    supersedesSchemeId: "scheme_ver_kn_v2025-09-sro1060",
    sourceDocumentSha256: KN_SRO_SHA256,
    isPhysicalDocumentAvailable: true,
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
      authorityLevel: "OFFICIAL_SCHEME",
      documentSha256: KN_SRO_SHA256,
      isPhysicalDocumentAvailable: true,
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
    tierRules: createStandardWeeklyTierRules({
      secondPrizeAmount: 3000000,
      secondPrizeDrawCount: 1,
      thirdPrizeAmount: 500000,
      thirdPrizeDrawCount: 1,
      seventhDrawCount: 76,
      eighthDrawCount: 84,
      ninthDrawCount: 156,
      evidencePage: 2
    }),
    descriptiveOnly: true
  });

  // ==========================================================================
  // 4. STHREE-SAKTHI (SS) Weekly Lottery
  // ==========================================================================

  // Version 1 (Superseded): S.R.O. 1065/2025 (Physical source PDF unavailable -> null SHA)
  repo.registerSchemeVersion({
    id: "scheme_ver_ss_v2025-09-sro1065",
    schemeId: "scheme_ss_weekly",
    lotteryId: "SS",
    lotteryCode: "SS",
    lotteryName: "Sthree-Sakthi (SS) Weekly Lottery",
    schemeType: "WEEKLY",
    authorityLevel: "OFFICIAL_SCHEME",
    version: "v2025-09-sro1065",
    status: "SUPERSEDED",
    applicability: {
      effectiveFrom: "2025-09-17",
      effectiveTo: "2025-11-09",
      supersededBySchemeId: "scheme_ver_ss_v2025-11-sro1292",
      supersededByNotification: "G.O.(P) No.187/2025/TAXES (S.R.O. No. 1292/2025)",
      notes: "Superseded by G.O.(P) No.187/2025/TAXES. Physical Gazette PDF not in local registry."
    },
    effectiveFrom: "2025-09-17",
    effectiveTo: "2025-11-09",
    supersededBySchemeId: "scheme_ver_ss_v2025-11-sro1292",
    sourceDocumentSha256: null,
    isPhysicalDocumentAvailable: false,
    sourceNotificationNumber: "G.O.(P) No.150/2025/TAXES",
    sourceSroNumber: "S. R. O. No. 1065/2025",
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
      authorityLevel: "OFFICIAL_SCHEME",
      documentSha256: null,
      isPhysicalDocumentAvailable: false,
      notificationNumber: "G.O.(P) No.150/2025/TAXES",
      sroNumber: "S. R. O. No. 1065/2025",
      gazetteNumber: "3332",
      publishedDate: "2025-09-17",
      pageNumber: 1,
      evidenceText: "Published as S.R.O.No.1065/2025 in Kerala Gazette Extraordinary No.3332 dated 17th September, 2025",
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
  });

  // Version 2 (Active): S.R.O. 1292/2025 (Physical source PDF verified)
  repo.registerSchemeVersion({
    id: "scheme_ver_ss_v2025-11-sro1292",
    schemeId: "scheme_ss_weekly",
    lotteryId: "SS",
    lotteryCode: "SS",
    lotteryName: "Sthree-Sakthi (SS) Weekly Lottery",
    schemeType: "WEEKLY",
    authorityLevel: "OFFICIAL_SCHEME",
    version: "v2025-11-sro1292",
    status: "ACTIVE",
    applicability: {
      effectiveFrom: "2025-11-10",
      supersedesSchemeId: "scheme_ver_ss_v2025-09-sro1065",
      supersedesNotification: "G.O.(P) No.150/2025/TAXES (S.R.O. No. 1065/2025)",
      notes: "Issued in supersession of S.R.O. No. 1065/2025 in Kerala Gazette Extraordinary No. 3977."
    },
    effectiveFrom: "2025-11-10",
    supersedesSchemeId: "scheme_ver_ss_v2025-09-sro1065",
    sourceDocumentSha256: SS_SRO_SHA256,
    isPhysicalDocumentAvailable: true,
    sourceNotificationNumber: "G.O.(P) No.187/2025/TAXES",
    sourceSroNumber: "S. R. O. No. 1292/2025",
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
      authorityLevel: "OFFICIAL_SCHEME",
      documentSha256: SS_SRO_SHA256,
      isPhysicalDocumentAvailable: true,
      notificationNumber: "G.O.(P) No.187/2025/TAXES",
      sroNumber: "S. R. O. No. 1292/2025",
      gazetteNumber: "3977",
      gazetteVolume: "Vol. XIV",
      publishedDate: "2025-11-10",
      pageNumber: 1,
      evidenceText: "Kerala Gazette Extraordinary No. 3977, G.O.(P) No.187/2025/TAXES, S. R. O. No. 1292/2025",
      parserVersion: "v1.0.0-gazette-sro"
    },
    seriesRule: {
      numberOfSeries: 12,
      seriesPattern: "2-letter alphabetic prefix",
      selectionScope: "ALL",
      rawSourceText: "Tickets are issued in twelve series with the prize structure stated in the table given below"
    },
    tierRules: createStandardWeeklyTierRules({
      secondPrizeAmount: 3000000,
      secondPrizeDrawCount: 1,
      thirdPrizeAmount: 500000,
      thirdPrizeDrawCount: 1,
      seventhDrawCount: 76,
      eighthDrawCount: 90,
      ninthDrawCount: 150,
      evidencePage: 2
    }),
    descriptiveOnly: true
  });

  // ==========================================================================
  // 5. SUVARNA KERALAM (SK) Weekly Lottery
  // ==========================================================================

  // Version 1 (Superseded): S.R.O. 1064/2025 (Physical source PDF unavailable -> null SHA)
  repo.registerSchemeVersion({
    id: "scheme_ver_sk_v2025-09-sro1064",
    schemeId: "scheme_sk_weekly",
    lotteryId: "SK",
    lotteryCode: "SK",
    lotteryName: "Suvarna Keralam (SK) Weekly Lottery",
    schemeType: "WEEKLY",
    authorityLevel: "OFFICIAL_SCHEME",
    version: "v2025-09-sro1064",
    status: "SUPERSEDED",
    applicability: {
      effectiveFrom: "2025-09-17",
      effectiveTo: "2025-11-09",
      supersededBySchemeId: "scheme_ver_sk_v2025-11-sro1291",
      supersededByNotification: "G.O.(P) No.186/2025/TAXES (S.R.O. No. 1291/2025)",
      notes: "Superseded by G.O.(P) No.186/2025/TAXES. Physical Gazette PDF not in local registry."
    },
    effectiveFrom: "2025-09-17",
    effectiveTo: "2025-11-09",
    supersededBySchemeId: "scheme_ver_sk_v2025-11-sro1291",
    sourceDocumentSha256: null,
    isPhysicalDocumentAvailable: false,
    sourceNotificationNumber: "G.O.(P) No.149/2025/TAXES",
    sourceSroNumber: "S. R. O. No. 1064/2025",
    sourcePublishedDate: "2025-09-17",
    ticketPrice: 50,
    ticketsPrinted: 10800000,
    numberOfSeries: 12,
    seriesCodes: [],
    totalPrizeAmount: 232579000,
    periodicity: "Weekly Draw",
    drawLocation: "Thiruvananthapuram",
    provenance: {
      sourceType: "GAZETTE_SRO",
      authorityPriority: 1,
      authorityLevel: "OFFICIAL_SCHEME",
      documentSha256: null,
      isPhysicalDocumentAvailable: false,
      notificationNumber: "G.O.(P) No.149/2025/TAXES",
      sroNumber: "S. R. O. No. 1064/2025",
      gazetteNumber: "3331",
      publishedDate: "2025-09-17",
      pageNumber: 1,
      evidenceText: "Published as S.R.O.No.1064/2025 in Kerala Gazette Extraordinary No.3331 dated 17th September, 2025",
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
  });

  // Version 2 (Active): S.R.O. 1291/2025 (Physical source PDF verified)
  repo.registerSchemeVersion({
    id: "scheme_ver_sk_v2025-11-sro1291",
    schemeId: "scheme_sk_weekly",
    lotteryId: "SK",
    lotteryCode: "SK",
    lotteryName: "Suvarna Keralam (SK) Weekly Lottery",
    schemeType: "WEEKLY",
    authorityLevel: "OFFICIAL_SCHEME",
    version: "v2025-11-sro1291",
    status: "ACTIVE",
    applicability: {
      effectiveFrom: "2025-11-10",
      supersedesSchemeId: "scheme_ver_sk_v2025-09-sro1064",
      supersedesNotification: "G.O.(P) No.149/2025/TAXES (S.R.O. No. 1064/2025)",
      notes: "Issued in supersession of S.R.O. No. 1064/2025 in Kerala Gazette Extraordinary No. 3976."
    },
    effectiveFrom: "2025-11-10",
    supersedesSchemeId: "scheme_ver_sk_v2025-09-sro1064",
    sourceDocumentSha256: SK_SRO_SHA256,
    isPhysicalDocumentAvailable: true,
    sourceNotificationNumber: "G.O.(P) No.186/2025/TAXES",
    sourceSroNumber: "S. R. O. No. 1291/2025",
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
    totalPrizeAmount: 232579000,
    periodicity: "Weekly Draw",
    drawLocation: "Thiruvananthapuram",
    provenance: {
      sourceType: "GAZETTE_SRO",
      authorityPriority: 1,
      authorityLevel: "OFFICIAL_SCHEME",
      documentSha256: SK_SRO_SHA256,
      isPhysicalDocumentAvailable: true,
      notificationNumber: "G.O.(P) No.186/2025/TAXES",
      sroNumber: "S. R. O. No. 1291/2025",
      gazetteNumber: "3976",
      gazetteVolume: "Vol. XIV",
      publishedDate: "2025-11-10",
      pageNumber: 1,
      evidenceText: "Kerala Gazette Extraordinary No. 3976, G.O.(P) No.186/2025/TAXES, S. R. O. No. 1291/2025",
      parserVersion: "v1.0.0-gazette-sro"
    },
    seriesRule: {
      numberOfSeries: 12,
      seriesPattern: "2-letter alphabetic prefix",
      selectionScope: "ALL",
      rawSourceText: "Tickets are issued in twelve series with the prize structure stated in the table given below"
    },
    tierRules: createStandardWeeklyTierRules({
      secondPrizeAmount: 3000000,
      secondPrizeDrawCount: 1,
      thirdPrizeAmount: 500000,
      thirdPrizeDrawCount: 1,
      seventhDrawCount: 76,
      eighthDrawCount: 92,
      ninthDrawCount: 144,
      evidencePage: 2
    }),
    descriptiveOnly: true
  });

  // ==========================================================================
  // 6. KARUNYA (KR) Weekly Lottery
  // ==========================================================================

  // Version 1 (Superseded): S.R.O. 1063/2025 (Physical source PDF unavailable -> null SHA)
  repo.registerSchemeVersion({
    id: "scheme_ver_kr_v2025-09-sro1063",
    schemeId: "scheme_kr_weekly",
    lotteryId: "KR",
    lotteryCode: "KR",
    lotteryName: "Karunya (KR) Weekly Lottery",
    schemeType: "WEEKLY",
    authorityLevel: "OFFICIAL_SCHEME",
    version: "v2025-09-sro1063",
    status: "SUPERSEDED",
    applicability: {
      effectiveFrom: "2025-09-17",
      effectiveTo: "2025-11-09",
      supersededBySchemeId: "scheme_ver_kr_v2025-11-sro1295",
      supersededByNotification: "G.O.(P) No.190/2025/TAXES (S.R.O. No. 1295/2025)",
      notes: "Superseded by G.O.(P) No.190/2025/TAXES. Physical Gazette PDF not in local registry."
    },
    effectiveFrom: "2025-09-17",
    effectiveTo: "2025-11-09",
    supersededBySchemeId: "scheme_ver_kr_v2025-11-sro1295",
    sourceDocumentSha256: null,
    isPhysicalDocumentAvailable: false,
    sourceNotificationNumber: "G.O.(P) No.146/2025/TAXES",
    sourceSroNumber: "S. R. O. No. 1063/2025",
    sourcePublishedDate: "2025-09-17",
    ticketPrice: 50,
    ticketsPrinted: 10800000,
    numberOfSeries: 12,
    seriesCodes: [],
    totalPrizeAmount: 232579000,
    periodicity: "Weekly Draw",
    drawLocation: "Thiruvananthapuram",
    provenance: {
      sourceType: "GAZETTE_SRO",
      authorityPriority: 1,
      authorityLevel: "OFFICIAL_SCHEME",
      documentSha256: null,
      isPhysicalDocumentAvailable: false,
      notificationNumber: "G.O.(P) No.146/2025/TAXES",
      sroNumber: "S. R. O. No. 1063/2025",
      gazetteNumber: "3330",
      publishedDate: "2025-09-17",
      pageNumber: 1,
      evidenceText: "Published as S.R.O.No.1063/2025 in Kerala Gazette Extraordinary No.3330 dated 17th September, 2025",
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
  });

  // Version 2 (Active): S.R.O. 1295/2025 (Physical source PDF verified)
  repo.registerSchemeVersion({
    id: "scheme_ver_kr_v2025-11-sro1295",
    schemeId: "scheme_kr_weekly",
    lotteryId: "KR",
    lotteryCode: "KR",
    lotteryName: "Karunya (KR) Weekly Lottery",
    schemeType: "WEEKLY",
    authorityLevel: "OFFICIAL_SCHEME",
    version: "v2025-11-sro1295",
    status: "ACTIVE",
    applicability: {
      effectiveFrom: "2025-11-10",
      supersedesSchemeId: "scheme_ver_kr_v2025-09-sro1063",
      supersedesNotification: "G.O.(P) No.146/2025/TAXES (S.R.O. No. 1063/2025)",
      notes: "Issued in supersession of S.R.O. No. 1063/2025 in Kerala Gazette Extraordinary No. 3980."
    },
    effectiveFrom: "2025-11-10",
    supersedesSchemeId: "scheme_ver_kr_v2025-09-sro1063",
    sourceDocumentSha256: KR_SRO_SHA256,
    isPhysicalDocumentAvailable: true,
    sourceNotificationNumber: "G.O.(P) No.190/2025/TAXES",
    sourceSroNumber: "S. R. O. No. 1295/2025",
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
    totalPrizeAmount: 232579000,
    periodicity: "Weekly Draw",
    drawLocation: "Thiruvananthapuram",
    provenance: {
      sourceType: "GAZETTE_SRO",
      authorityPriority: 1,
      authorityLevel: "OFFICIAL_SCHEME",
      documentSha256: KR_SRO_SHA256,
      isPhysicalDocumentAvailable: true,
      notificationNumber: "G.O.(P) No.190/2025/TAXES",
      sroNumber: "S. R. O. No. 1295/2025",
      gazetteNumber: "3980",
      gazetteVolume: "Vol. XIV",
      publishedDate: "2025-11-10",
      pageNumber: 1,
      evidenceText: "Kerala Gazette Extraordinary No. 3980, G.O.(P) No.190/2025/TAXES, S. R. O. No. 1295/2025",
      parserVersion: "v1.0.0-gazette-sro"
    },
    seriesRule: {
      numberOfSeries: 12,
      seriesPattern: "2-letter alphabetic prefix",
      selectionScope: "ALL",
      rawSourceText: "Tickets are issued in twelve series with the prize structure stated in the table given below"
    },
    tierRules: createStandardWeeklyTierRules({
      secondPrizeAmount: 2500000,
      secondPrizeDrawCount: 1,
      thirdPrizeAmount: 1000000,
      thirdPrizeDrawCount: 1,
      seventhDrawCount: 76,
      eighthDrawCount: 92,
      ninthDrawCount: 144,
      evidencePage: 2
    }),
    descriptiveOnly: true
  });

  // ==========================================================================
  // 7. SAMRUDHI (SM) Weekly Lottery
  // ==========================================================================

  // Version 1 (Superseded): S.R.O. 1066/2025 (Physical source PDF unavailable -> null SHA)
  repo.registerSchemeVersion({
    id: "scheme_ver_sm_v2025-09-sro1066",
    schemeId: "scheme_sm_weekly",
    lotteryId: "SM",
    lotteryCode: "SM",
    lotteryName: "Samrudhi (SM) Weekly Lottery",
    schemeType: "WEEKLY",
    authorityLevel: "OFFICIAL_SCHEME",
    version: "v2025-09-sro1066",
    status: "SUPERSEDED",
    applicability: {
      effectiveFrom: "2025-09-17",
      effectiveTo: "2025-11-09",
      supersededBySchemeId: "scheme_ver_sm_v2025-11-sro1293",
      supersededByNotification: "G.O.(P) No.188/2025/TAXES (S.R.O. No. 1293/2025)",
      notes: "Superseded by G.O.(P) No.188/2025/TAXES. Physical Gazette PDF not in local registry."
    },
    effectiveFrom: "2025-09-17",
    effectiveTo: "2025-11-09",
    supersededBySchemeId: "scheme_ver_sm_v2025-11-sro1293",
    sourceDocumentSha256: null,
    isPhysicalDocumentAvailable: false,
    sourceNotificationNumber: "G.O.(P) No.147/2025/TAXES",
    sourceSroNumber: "S. R. O. No. 1066/2025",
    sourcePublishedDate: "2025-09-17",
    ticketPrice: 50,
    ticketsPrinted: 10800000,
    numberOfSeries: 12,
    seriesCodes: [],
    totalPrizeAmount: 232727000,
    periodicity: "Weekly Draw",
    drawLocation: "Thiruvananthapuram",
    provenance: {
      sourceType: "GAZETTE_SRO",
      authorityPriority: 1,
      authorityLevel: "OFFICIAL_SCHEME",
      documentSha256: null,
      isPhysicalDocumentAvailable: false,
      notificationNumber: "G.O.(P) No.147/2025/TAXES",
      sroNumber: "S. R. O. No. 1066/2025",
      gazetteNumber: "3333",
      publishedDate: "2025-09-17",
      pageNumber: 1,
      evidenceText: "Published as S.R.O.No.1066/2025 in Kerala Gazette Extraordinary No.3333 dated 17th September, 2025",
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
  });

  // Version 2 (Active): S.R.O. 1293/2025 (Physical source PDF verified)
  repo.registerSchemeVersion({
    id: "scheme_ver_sm_v2025-11-sro1293",
    schemeId: "scheme_sm_weekly",
    lotteryId: "SM",
    lotteryCode: "SM",
    lotteryName: "Samrudhi (SM) Weekly Lottery",
    schemeType: "WEEKLY",
    authorityLevel: "OFFICIAL_SCHEME",
    version: "v2025-11-sro1293",
    status: "ACTIVE",
    applicability: {
      effectiveFrom: "2025-11-10",
      supersedesSchemeId: "scheme_ver_sm_v2025-09-sro1066",
      supersedesNotification: "G.O.(P) No.147/2025/TAXES (S.R.O. No. 1066/2025)",
      notes: "Issued in supersession of S.R.O. No. 1066/2025 in Kerala Gazette Extraordinary No. 3978."
    },
    effectiveFrom: "2025-11-10",
    supersedesSchemeId: "scheme_ver_sm_v2025-09-sro1066",
    sourceDocumentSha256: SM_SRO_SHA256,
    isPhysicalDocumentAvailable: true,
    sourceNotificationNumber: "G.O.(P) No.188/2025/TAXES",
    sourceSroNumber: "S. R. O. No. 1293/2025",
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
    totalPrizeAmount: 232727000,
    periodicity: "Weekly Draw",
    drawLocation: "Thiruvananthapuram",
    provenance: {
      sourceType: "GAZETTE_SRO",
      authorityPriority: 1,
      authorityLevel: "OFFICIAL_SCHEME",
      documentSha256: SM_SRO_SHA256,
      isPhysicalDocumentAvailable: true,
      notificationNumber: "G.O.(P) No.188/2025/TAXES",
      sroNumber: "S. R. O. No. 1293/2025",
      gazetteNumber: "3978",
      gazetteVolume: "Vol. XIV",
      publishedDate: "2025-11-10",
      pageNumber: 1,
      evidenceText: "Kerala Gazette Extraordinary No. 3978, G.O.(P) No.188/2025/TAXES, S. R. O. No. 1293/2025",
      parserVersion: "v1.0.0-gazette-sro"
    },
    seriesRule: {
      numberOfSeries: 12,
      seriesPattern: "2-letter alphabetic prefix",
      selectionScope: "ALL",
      rawSourceText: "Tickets are issued in twelve series with the prize structure stated in the table given below"
    },
    tierRules: createStandardWeeklyTierRules({
      secondPrizeAmount: 2500000,
      secondPrizeDrawCount: 1,
      thirdPrizeAmount: 500000,
      thirdPrizeDrawCount: 1,
      seventhDrawCount: 76,
      eighthDrawCount: 92,
      ninthDrawCount: 150,
      evidencePage: 2
    }),
    descriptiveOnly: true
  });

  // ==========================================================================
  // 8. MONSOON BUMPER 2026 (BR-110)
  // ==========================================================================

  // Official Scheme backed by S.R.O. No. 526/2026, Kerala Gazette No. 1604
  repo.registerSchemeVersion({
    id: "scheme_ver_monsoon_bumper_2026_br110",
    schemeId: "scheme_monsoon_bumper",
    lotteryId: "MONSOON_BUMPER",
    lotteryCode: "MONSOON_BUMPER",
    lotteryName: "Monsoon Bumper 2026 (BR-110)",
    schemeType: "BUMPER",
    authorityLevel: "OFFICIAL_SCHEME",
    version: "v2026-sro526",
    status: "ACTIVE",
    applicability: {
      effectiveFrom: "2026-05-18",
      effectiveTo: "2026-08-31",
      notes: "Official Government Gazette notification S.R.O. No. 526/2026 published in Kerala Gazette Extraordinary No. 1604."
    },
    effectiveFrom: "2026-05-18",
    effectiveTo: "2026-08-31",
    sourceDocumentSha256: MONSOON_BUMPER_SRO_SHA256,
    isPhysicalDocumentAvailable: true,
    sourceNotificationNumber: "G.O.(P) No. 58/2026/TAXES",
    sourceSroNumber: "S. R. O. No. 526/2026",
    sourcePublishedDate: "2026-05-19",
    ticketPrice: 250,
    ticketPriceDetails: {
      basicPrice: 178.57,
      gstRate: 0.4,
      rawText: "₹250/- (Ticket price ₹178.57 + 40% Goods and Services Tax)"
    },
    ticketsPrinted: 4500000,
    grossTicketValue: 803565000,
    numberOfSeries: 5,
    seriesCodes: ["MA", "MB", "MC", "MD", "ME"],
    totalPrizeAmount: 308525000, // Reconciled exact total
    periodicity: "Annual Seasonal Bumper",
    drawLocation: "Thiruvananthapuram",
    provenance: {
      sourceType: "GAZETTE_SRO",
      authorityPriority: 1,
      authorityLevel: "OFFICIAL_SCHEME",
      documentSha256: MONSOON_BUMPER_SRO_SHA256,
      isPhysicalDocumentAvailable: true,
      notificationNumber: "G.O.(P) No. 58/2026/TAXES",
      sroNumber: "S. R. O. No. 526/2026",
      gazetteNumber: "1604",
      gazetteVolume: "Vol. XV",
      publishedDate: "2026-05-19",
      pageNumber: 1,
      evidenceText: "Kerala Gazette Extraordinary No. 1604, G.O.(P) No. 58/2026/TAXES, S. R. O. No. 526/2026",
      parserVersion: "v1.0.0-gazette-sro"
    },
    seriesRule: {
      numberOfSeries: 5,
      seriesPattern: "M[A-E]",
      knownSeriesCodes: ["MA", "MB", "MC", "MD", "ME"],
      selectionScope: "PER_SERIES",
      rawSourceText: "Tickets are issued in five series (MA, MB, MC, MD, ME)"
    },
    tierRules: [
      {
        tierCode: "I",
        tierName: "1st Prize",
        rank: 1,
        category: "I",
        amount: 100000000, // 10 crore
        currency: "INR",
        selectionBasis: "COMMON_TO_ALL_SERIES",
        numberLength: 6,
        seriesScope: "ALL_SERIES",
        drawCount: 1,
        maximumPrizeCount: 1,
        isConsolation: false,
        isSuffix: false,
        agentCommission: 10000000,
        sourceEvidence: { pageNumber: 2, rawText: "Sl. 1 Category I: Common to all series. Amount: 10,00,00,000. No of prizes: 1" },
        applicability: "Common to all series"
      },
      {
        tierCode: "CONSOLATION",
        tierName: "Consolation Prize",
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
        agentCommission: 40000,
        sourceEvidence: { pageNumber: 2, rawText: "CONSOLATION PRIZE: Amount: 1,00,000. No of prizes: 4" },
        applicability: "Tickets with 1st prize winning number in remaining 4 series"
      },
      {
        tierCode: "II",
        tierName: "2nd Prize",
        rank: 2,
        category: "II",
        amount: 1000000, // 10 lakh
        currency: "INR",
        selectionBasis: "ONE_PER_SERIES",
        numberLength: 6,
        seriesScope: "PER_SERIES",
        drawCount: 5,
        maximumPrizeCount: 5,
        isConsolation: false,
        isSuffix: false,
        agentCommission: 500000,
        sourceEvidence: { pageNumber: 2, rawText: "Sl. 2 Category II: One prize in each series. Amount: 10,00,000. No of prizes: 5" },
        applicability: "One prize in each series"
      },
      {
        tierCode: "III",
        tierName: "3rd Prize",
        rank: 3,
        category: "III",
        amount: 500000, // 5 lakh
        currency: "INR",
        selectionBasis: "ONE_PER_SERIES",
        numberLength: 6,
        seriesScope: "PER_SERIES",
        drawCount: 5,
        maximumPrizeCount: 5,
        isConsolation: false,
        isSuffix: false,
        agentCommission: 250000,
        sourceEvidence: { pageNumber: 2, rawText: "Sl. 3 Category III: One prize in each series. Amount: 5,00,000. No of prizes: 5" },
        applicability: "One prize in each series"
      },
      {
        tierCode: "IV",
        tierName: "4th Prize",
        rank: 4,
        category: "IV",
        amount: 300000, // 3 lakh
        currency: "INR",
        selectionBasis: "ONE_PER_SERIES",
        numberLength: 6,
        seriesScope: "PER_SERIES",
        drawCount: 5,
        maximumPrizeCount: 5,
        isConsolation: false,
        isSuffix: false,
        agentCommission: 150000,
        sourceEvidence: { pageNumber: 2, rawText: "Sl. 4 Category IV: One prize in each series. Amount: 3,00,000. No of prizes: 5" },
        applicability: "One prize in each series"
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
        maximumPrizeCount: 13500, // 30 * 450
        isConsolation: false,
        isSuffix: true,
        agentCommission: 6750000,
        sourceEvidence: { pageNumber: 2, rawText: "Sl. 5 Category V: Last Four digits to be drawn 30 times. Amount: 5,000. Up to 13,500 prizes" },
        applicability: "Last four digits to be drawn 30 times"
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
        maximumPrizeCount: 40500, // 90 * 450
        isConsolation: false,
        isSuffix: true,
        agentCommission: 4050000,
        sourceEvidence: { pageNumber: 2, rawText: "Sl. 6 Category VI: Last Four digits to be drawn 90 times. Amount: 1,000. Up to 40,500 prizes" },
        applicability: "Last four digits to be drawn 90 times"
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
        maximumPrizeCount: 113400, // 252 * 450
        isConsolation: false,
        isSuffix: true,
        agentCommission: 5670000,
        sourceEvidence: { pageNumber: 2, rawText: "Sl. 7 Category VII: Last Four digits to be drawn 252 times. Amount: 500. Up to 1,13,400 prizes" },
        applicability: "Last four digits to be drawn 252 times"
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
        maximumPrizeCount: 137700, // 306 * 450
        isConsolation: false,
        isSuffix: true,
        agentCommission: 3442500,
        sourceEvidence: { pageNumber: 2, rawText: "Sl. 8 Category VIII: Last Four digits to be drawn 306 times. Amount: 250. Up to 1,37,700 prizes" },
        applicability: "Last four digits to be drawn 306 times"
      }
    ],
    descriptiveOnly: true
  });

  // ==========================================================================
  // 9. THIRUVONAM BUMPER 2026 (BR-111)
  // ==========================================================================

  // Explicitly classified as OBSERVED_SCHEME_ARCHETYPE (derived from result PDF)
  // until authoritative Government Gazette notification is ingested.
  repo.registerSchemeVersion({
    id: "scheme_ver_thiruvonam_bumper_2026_br111",
    schemeId: "scheme_thiruvonam_bumper",
    lotteryId: "THIRUVONAM_BUMPER",
    lotteryCode: "THIRUVONAM_BUMPER",
    lotteryName: "Thiruvonam Bumper 2026 (BR-111)",
    schemeType: "BUMPER",
    authorityLevel: "OBSERVED_SCHEME_ARCHETYPE",
    version: "v2026-br111",
    status: "ACTIVE",
    applicability: {
      effectiveFrom: "2026-09-01",
      effectiveTo: "2026-09-30",
      notes: "Bumper scheme observed archetype from official result PDF 282-2338-26-09-2026.pdf (BR-111th). Authority Priority: 3 (RESULT_PDF). Retained as observed reference archetype until authoritative Government Gazette notification is ingested."
    },
    effectiveFrom: "2026-09-01",
    effectiveTo: "2026-09-30",
    sourceDocumentSha256: THIRUVONAM_BUMPER_RESULT_SHA256,
    isPhysicalDocumentAvailable: true,
    sourceNotificationNumber: "RESULT-PDF-BR-111",
    sourcePublishedDate: "2026-09-26",
    ticketPrice: 500,
    ticketsPrinted: 9000000,
    numberOfSeries: 10,
    seriesCodes: ["TA", "TB", "TC", "TD", "TE", "TG", "TH", "TJ", "TK", "TL"],
    totalPrizeAmount: 1255400000, // Reconciled exact total (125.54 Crore)
    periodicity: "Annual Festival Bumper",
    drawLocation: "Thiruvananthapuram",
    provenance: {
      sourceType: "RESULT_PDF",
      authorityPriority: 3,
      authorityLevel: "OBSERVED_SCHEME_ARCHETYPE",
      documentSha256: THIRUVONAM_BUMPER_RESULT_SHA256,
      isPhysicalDocumentAvailable: true,
      notificationNumber: "DRAW NO. BR-111th",
      publishedDate: "2026-09-26",
      pageNumber: 1,
      evidenceText: "Official Result PDF: THIRUVONAM BUMPER LOTTERY LOTTERY NO.BR-111th DRAW held on 26/09/2026 (OBSERVED_SCHEME_ARCHETYPE)",
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
        amount: 2500000, // 25 lakh
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
        amount: 500000, // 5 lakh
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
        amount: 200000, // 2 lakh
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
        maximumPrizeCount: 54000, // 60 * 900
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
        maximumPrizeCount: 81000, // 90 * 900
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
        maximumPrizeCount: 124200, // 138 * 900
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
        maximumPrizeCount: 275400, // 306 * 900
        isConsolation: false,
        isSuffix: true,
        sourceEvidence: { pageNumber: 5, rawText: "9th Prize-Rs :500/- (FOR THE TICKETS ENDING WITH... 306 draws)" },
        applicability: "Last four digits drawn (306 times)"
      }
    ],
    descriptiveOnly: true
  });

  return repo;
}

/**
 * Checks whether an authoritative Government Gazette / S.R.O. notification exists in the registry
 * for a given lottery code.
 */
export function hasOfficialGazetteSro(lotteryCode: string): boolean {
  const norm = normalizeLotteryCode(lotteryCode);
  return (
    norm === "BT" ||
    norm === "DL" ||
    norm === "KN" ||
    norm === "SS" ||
    norm === "SK" ||
    norm === "KR" ||
    norm === "SM" ||
    norm === "MONSOON_BUMPER"
  );
}
