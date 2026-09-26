/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 5A: Deterministic Historical Statistical Engine
 *
 * Implements purely descriptive statistical aggregations over validated lottery entities
 * and knowledge graphs with strict population scoping, filter isolation, and leading-zero preservation.
 *
 * Invariants:
 * - Deterministic output: Identical input + version -> Identical output.
 * - Zero predictive claims, zero betting advice, zero lucky numbers.
 * - Numbers preserved as strings with leading zeros ("0259", not 259).
 * - Suffix results NEVER receive synthetic series values.
 * - Explicit single-draw vs multi-draw population notice.
 */

import { createHash } from "node:crypto";
import type {
  WinningResult,
  PrizeTier,
  Draw,
  Lottery
} from "@kerala-lottery/domain";
import type { LotteryKnowledgeGraph } from "@kerala-lottery/knowledge";
import {
  DEFAULT_STATISTICAL_VERSION,
  type StatisticalFilterCriteria,
  type StatisticalPopulationScope,
  type NumberFrequencyItem,
  type NumberFrequencyReport,
  type SeriesFrequencyItem,
  type SeriesFrequencyReport,
  type DigitDistributionItem,
  type LastDigitFrequencyReport,
  type DigitPositionDistribution,
  type DigitPositionFrequencyReport,
  type SuffixFrequencyItem,
  type SuffixFrequencyReport,
  type PrizeTierStatisticsItem,
  type PrizeTierStatisticsReport,
  type DrawSummaryStatistics,
  type HistoricalLotteryStatisticsAggregate
} from "./statistical-types";

// ============================================================================
// Error Class
// ============================================================================

export class StatisticalValidationError extends Error {
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, code = "STATISTICAL_VALIDATION_ERROR", details?: unknown) {
    super(`StatisticalValidationError [${code}]: ${message}`);
    this.name = "StatisticalValidationError";
    this.code = code;
    this.details = details;
  }
}

// ============================================================================
// Engine Input Interface
// ============================================================================

export interface ValidatedStatisticalEntities {
  winningResults: WinningResult[];
  prizeTiers?: PrizeTier[];
  draws?: Draw[];
  lotteries?: Lottery[];
  documentSha256s?: string[];
}

export type StatisticalEngineInput =
  | LotteryKnowledgeGraph
  | LotteryKnowledgeGraph[]
  | ValidatedStatisticalEntities;

export interface StatisticalEngineOptions {
  statisticalVersion?: string;
  computedAt?: string; // Optional deterministic timestamp override
  allowEmpty?: boolean; // If true, empty datasets produce zeroed reports rather than throwing
}

// ============================================================================
// Helper: Extract Entities from Knowledge Graph
// ============================================================================

export function extractEntitiesFromKnowledgeGraph(
  graph: LotteryKnowledgeGraph
): ValidatedStatisticalEntities {
  const winningResults: WinningResult[] = [];
  const prizeTiers: PrizeTier[] = [];
  const draws: Draw[] = [];
  const lotteries: Lottery[] = [];

  for (const node of graph.nodes) {
    if (node.type === "WinningResult") {
      const p = node.properties;
      winningResults.push({
        id: node.id,
        documentSha256: (p.documentSha256 as string) || graph.documentSha256,
        pageId: (p.pageId as string) || `${graph.documentSha256}_${p.pageNumber || 1}`,
        pageNumber: (p.pageNumber as number) || 1,
        sourceTextBlockOrders: (p.textBlockOrders as number[]) || [],
        rawSourceText: (p.rawSourceText as string) || node.label,
        boundingBox: (p.boundingBox as any) || { x: 0, y: 0, width: 0, height: 0, unit: "pt" },
        parserRule: (node.provenance?.parserRule as string) || "rule.graph.extraction_v1",
        parserVersion: (node.provenance?.parserVersion as string) || "v1.0.0",
        prizeTierId: (p.prizeTierId as string) || "",
        prizeTierName: (p.prizeTierName as string) || "",
        rank: (p.rank as number) || 0,
        amount: p.amount as number | undefined,
        series: p.series as string | undefined,
        canonicalNumber: (p.canonicalNumber as string) || "",
        numberLength: (p.numberLength as number) || (p.canonicalNumber as string)?.length || 0,
        isSuffix: Boolean(p.isSuffix),
        location: p.location as string | undefined,
        confidence: node.provenance?.confidence ?? 1.0,
        validationStatus: "VALID",
        createdAt: node.createdAt
      });
    } else if (node.type === "PrizeTier") {
      const p = node.properties;
      prizeTiers.push({
        id: node.id,
        documentSha256: graph.documentSha256,
        pageId: `${graph.documentSha256}_${p.pageNumber || 1}`,
        pageNumber: (p.pageNumber as number) || 1,
        sourceTextBlockOrders: (p.textBlockOrders as number[]) || [],
        rawSourceText: (p.rawSourceText as string) || node.label,
        boundingBox: (p.boundingBox as any) || { x: 0, y: 0, width: 0, height: 0, unit: "pt" },
        parserRule: (node.provenance?.parserRule as string) || "rule.graph.tier_v1",
        parserVersion: (node.provenance?.parserVersion as string) || "v1.0.0",
        name: (p.name as string) || node.label,
        rank: (p.rank as number) || 0,
        tierType: (p.tierType as any) || "RANKED",
        amount: p.amount as number | undefined,
        currency: (p.currency as any) || "INR",
        isSuffix: Boolean(p.isSuffix),
        expectedLength: (p.expectedLength as number) || 6,
        confidence: node.provenance?.confidence ?? 1.0,
        createdAt: node.createdAt
      });
    } else if (node.type === "Draw") {
      const p = node.properties;
      draws.push({
        id: node.id,
        lotteryId: (p.lotteryId as string) || "",
        drawNumber: (p.drawNumber as string) || "UNKNOWN",
        drawDate: (p.drawDate as string) || "",
        drawTime: p.drawTime as string | undefined,
        location: p.location as string | undefined,
        sourceDocumentId: graph.documentSha256,
        sourcePage: 1,
        status: "PARSED",
        createdAt: node.createdAt,
        updatedAt: node.createdAt
      });
    } else if (node.type === "Lottery") {
      const p = node.properties;
      lotteries.push({
        id: node.id,
        code: (p.code as string) || "UNKNOWN",
        name: (p.name as string) || node.label,
        state: "Kerala",
        active: true,
        createdAt: node.createdAt
      });
    }
  }

  return {
    winningResults,
    prizeTiers,
    draws,
    lotteries,
    documentSha256s: [graph.documentSha256]
  };
}

// ============================================================================
// Normalization & Validation of Raw Inputs
// ============================================================================

export function normalizeStatisticalInput(
  input: StatisticalEngineInput
): ValidatedStatisticalEntities {
  if (Array.isArray(input)) {
    // Array of LotteryKnowledgeGraph
    const allResults: WinningResult[] = [];
    const allTiers: PrizeTier[] = [];
    const allDraws: Draw[] = [];
    const allLotteries: Lottery[] = [];
    const docShas: string[] = [];

    for (const g of input) {
      const ent = extractEntitiesFromKnowledgeGraph(g);
      allResults.push(...ent.winningResults);
      if (ent.prizeTiers) allTiers.push(...ent.prizeTiers);
      if (ent.draws) allDraws.push(...ent.draws);
      if (ent.lotteries) allLotteries.push(...ent.lotteries);
      docShas.push(...(ent.documentSha256s || []));
    }

    return {
      winningResults: allResults,
      prizeTiers: allTiers,
      draws: allDraws,
      lotteries: allLotteries,
      documentSha256s: Array.from(new Set(docShas)).sort()
    };
  }

  if ("nodes" in input && "documentSha256" in input) {
    // Single LotteryKnowledgeGraph
    return extractEntitiesFromKnowledgeGraph(input as LotteryKnowledgeGraph);
  }

  // Already ValidatedStatisticalEntities
  return input as ValidatedStatisticalEntities;
}

// ============================================================================
// Deterministic Scope ID Generator
// ============================================================================

export function computeScopeHash(scope: StatisticalPopulationScope): string {
  const payload = [
    scope.statisticalVersion,
    scope.documentIds.slice().sort().join(","),
    scope.drawIds.slice().sort().join(","),
    scope.lotteryId || "ALL_LOTTERIES",
    scope.lotteryCode || "ALL_CODES",
    scope.prizeTierId || "ALL_TIERS",
    scope.prizeTierRank !== undefined ? `rank_${scope.prizeTierRank}` : "ALL_RANKS",
    scope.resultType,
    scope.numberLength !== undefined ? `len_${scope.numberLength}` : "ANY_LEN",
    scope.dateRange?.startDate || "NO_START",
    scope.dateRange?.endDate || "NO_END"
  ].join("|");

  return createHash("sha256").update(payload, "utf8").digest("hex").substring(0, 16);
}

// ============================================================================
// Core Calculation Functions
// ============================================================================

export function calculateHistoricalStatistics(
  input: StatisticalEngineInput,
  criteria?: StatisticalFilterCriteria,
  options?: StatisticalEngineOptions
): HistoricalLotteryStatisticsAggregate {
  const version = options?.statisticalVersion || DEFAULT_STATISTICAL_VERSION;
  const computedAt = options?.computedAt || "2026-09-26T00:00:00.000Z";
  const allowEmpty = options?.allowEmpty ?? false;

  const rawEntities = normalizeStatisticalInput(input);
  const rawResults = rawEntities.winningResults;

  if ((!rawResults || rawResults.length === 0) && !allowEmpty) {
    throw new StatisticalValidationError(
      "Input dataset contains no winning results to aggregate",
      "EMPTY_DATASET"
    );
  }

  // 1. Invariant Validation on Winning Results (String numbers, leading zeros, duplicates)
  const seenResultIds = new Map<string, WinningResult>();
  let duplicateCount = 0;

  for (const r of rawResults) {
    if (!r.id || typeof r.id !== "string") {
      throw new StatisticalValidationError("Winning result missing valid ID", "INVALID_RESULT_ID", r);
    }
    if (typeof r.canonicalNumber !== "string" || !/^\d+$/.test(r.canonicalNumber)) {
      throw new StatisticalValidationError(
        `Canonical number must be a valid string of digits with leading zeros preserved, got: ${String(r.canonicalNumber)}`,
        "MALFORMED_NUMBER",
        r
      );
    }
    if (r.canonicalNumber.length !== r.numberLength) {
      throw new StatisticalValidationError(
        `Number length mismatch for '${r.canonicalNumber}': expected ${r.numberLength}, actual ${r.canonicalNumber.length}`,
        "LENGTH_MISMATCH",
        r
      );
    }

    // Check for duplicate entity ID
    if (seenResultIds.has(r.id)) {
      const existing = seenResultIds.get(r.id)!;
      // Invariant: duplicate entities with same ID must have identical content
      if (
        existing.canonicalNumber !== r.canonicalNumber ||
        existing.series !== r.series ||
        existing.prizeTierId !== r.prizeTierId
      ) {
        throw new StatisticalValidationError(
          `Conflicting duplicate result entity for ID '${r.id}'`,
          "CONFLICTING_DUPLICATE_RESULTS",
          { existing, incoming: r }
        );
      }
      duplicateCount++;
    } else {
      seenResultIds.set(r.id, r);
    }
  }

  // Use deduplicated list for deterministic population
  const uniqueResults = Array.from(seenResultIds.values());

  // 2. Build Draw and Lottery Maps for Filtering
  const drawMap = new Map<string, Draw>();
  for (const d of rawEntities.draws || []) {
    drawMap.set(d.id, d);
  }

  const lotteryMap = new Map<string, Lottery>();
  for (const l of rawEntities.lotteries || []) {
    lotteryMap.set(l.id, l);
  }

  // 3. Apply Filtering Criteria
  const filteredResults = uniqueResults.filter((r) => {
    // Result Type Filter
    if (criteria?.resultType === "FULL_TICKET" && r.isSuffix) return false;
    if (criteria?.resultType === "SUFFIX" && !r.isSuffix) return false;

    // Prize Tier Filters
    if (criteria?.prizeTierId && r.prizeTierId !== criteria.prizeTierId) return false;
    if (criteria?.prizeTierRank !== undefined && r.rank !== criteria.prizeTierRank) return false;

    // Number Length Filter
    if (criteria?.numberLength !== undefined && r.numberLength !== criteria.numberLength) return false;

    // Lottery / Draw Filters
    if (r.drawId && drawMap.has(r.drawId)) {
      const draw = drawMap.get(r.drawId)!;
      if (criteria?.lotteryId && draw.lotteryId !== criteria.lotteryId) return false;

      if (criteria?.lotteryCode) {
        const lottery = lotteryMap.get(draw.lotteryId);
        if (lottery && lottery.code !== criteria.lotteryCode) return false;
      }

      if (criteria?.dateRange?.startDate && draw.drawDate < criteria.dateRange.startDate) return false;
      if (criteria?.dateRange?.endDate && draw.drawDate > criteria.dateRange.endDate) return false;
    } else if (criteria?.lotteryId || criteria?.lotteryCode || criteria?.dateRange) {
      // Result lacks draw reference but lottery/date filter requested -> filter out
      return false;
    }

    return true;
  });

  // 4. Construct Population Scope
  const documentIds = Array.from(
    new Set(filteredResults.map((r) => r.documentSha256).concat(rawEntities.documentSha256s || []))
  )
    .filter(Boolean)
    .sort();

  const drawIds = Array.from(
    new Set(filteredResults.map((r) => r.drawId).filter((d): d is string => Boolean(d)))
  ).sort();

  const drawCount = drawIds.length > 0 ? drawIds.length : (rawEntities.draws?.length || 1);
  const isSingleDrawObservation = drawCount <= 1;

  const datasetSizeLimitationNotice = isSingleDrawObservation
    ? "SINGLE_DRAW_OBSERVATION: This statistical summary reflects observations from a single lottery draw only. It does NOT constitute a historical trend analysis or longitudinal population sample. Descriptive frequencies reflect within-draw distributions."
    : `HISTORICAL_OBSERVATION: Statistical summary aggregated across ${drawCount} lottery draws. Purely descriptive of past observations; does not predict future lottery outcomes.`;

  const populationScope: StatisticalPopulationScope = {
    documentIds,
    drawIds,
    drawCount,
    lotteryId: criteria?.lotteryId,
    lotteryCode: criteria?.lotteryCode,
    prizeTierId: criteria?.prizeTierId,
    prizeTierRank: criteria?.prizeTierRank,
    resultType: criteria?.resultType || "ALL",
    numberLength: criteria?.numberLength,
    dateRange: criteria?.dateRange,
    statisticalVersion: version,
    computedAt,
    isSingleDrawObservation,
    datasetSizeLimitationNotice
  };

  const scopeHash = computeScopeHash(populationScope);

  // 5. Aggregate Sub-reports
  const drawSummary = computeDrawSummaryStatistics(
    filteredResults,
    rawEntities.prizeTiers || [],
    populationScope,
    scopeHash
  );

  const prizeTierStats = computePrizeTierStatistics(
    filteredResults,
    rawEntities.prizeTiers || [],
    populationScope,
    scopeHash
  );

  const numberFrequency = computeNumberFrequency(
    filteredResults,
    populationScope,
    scopeHash
  );

  const seriesFrequency = computeSeriesFrequency(
    filteredResults,
    populationScope,
    scopeHash
  );

  const lastDigitFrequency = computeLastDigitFrequency(
    filteredResults,
    populationScope,
    scopeHash
  );

  // Digit Position Frequency: calculated separately for distinct number lengths present
  const digitPositionFrequency: Record<number, DigitPositionFrequencyReport> = {};
  const distinctLengths = Array.from(new Set(filteredResults.map((r) => r.numberLength))).sort(
    (a, b) => a - b
  );

  for (const len of distinctLengths) {
    digitPositionFrequency[len] = computeDigitPositionFrequency(
      filteredResults.filter((r) => r.numberLength === len),
      len,
      populationScope,
      scopeHash
    );
  }

  // Suffix Frequency: calculated for standard suffix lengths (e.g. 2, 3, 4)
  const suffixFrequency: Record<number, SuffixFrequencyReport> = {};
  for (const suffixLen of [2, 3, 4]) {
    suffixFrequency[suffixLen] = computeSuffixFrequency(
      filteredResults,
      suffixLen,
      populationScope,
      scopeHash
    );
  }

  return {
    id: `stat_agg_${scopeHash}`,
    scopeHash,
    statisticalVersion: version,
    datasetSizeLimitationNotice: populationScope.datasetSizeLimitationNotice,
    population: populationScope,
    drawSummary,
    prizeTierStats,
    numberFrequency,
    seriesFrequency,
    lastDigitFrequency,
    digitPositionFrequency,
    suffixFrequency,
    duplicateResultsDetectedCount: duplicateCount,
    metadata: {
      statisticVersion: version,
      computedAt
    }
  };
}

// ============================================================================
// Report Calculators
// ============================================================================

export function computeDrawSummaryStatistics(
  results: WinningResult[],
  allTiers: PrizeTier[],
  scope: StatisticalPopulationScope,
  scopeHash: string
): DrawSummaryStatistics {
  const fullTicketCount = results.filter((r) => !r.isSuffix).length;
  const suffixCount = results.filter((r) => r.isSuffix).length;

  return {
    id: `draw_summary_${scopeHash}`,
    population: scope,
    drawCount: scope.drawCount,
    totalPrizeTiersCount: allTiers.length,
    totalWinningResultsCount: results.length,
    fullTicketResultsCount: fullTicketCount,
    suffixResultsCount: suffixCount,
    datasetSizeLimitationNotice: scope.datasetSizeLimitationNotice
  };
}

export function computePrizeTierStatistics(
  results: WinningResult[],
  allTiers: PrizeTier[],
  scope: StatisticalPopulationScope,
  scopeHash: string
): PrizeTierStatisticsReport {
  const resultsByRank = new Map<number, WinningResult[]>();
  for (const r of results) {
    const list = resultsByRank.get(r.rank) || [];
    list.push(r);
    resultsByRank.set(r.rank, list);
  }

  const items: PrizeTierStatisticsItem[] = [];
  const totalResults = results.length;

  // Use provided tiers or discover from results
  const tiersByRank = new Map<number, PrizeTier>();
  for (const t of allTiers) {
    tiersByRank.set(t.rank, t);
  }

  const ranks = Array.from(new Set([...tiersByRank.keys(), ...resultsByRank.keys()])).sort(
    (a, b) => a - b
  );

  for (const rank of ranks) {
    const tier = tiersByRank.get(rank);
    const tierResults = resultsByRank.get(rank) || [];
    const count = tierResults.length;
    const isSuffix = tier ? tier.isSuffix : (tierResults[0]?.isSuffix ?? false);

    items.push({
      tierRank: rank,
      tierName: tier ? tier.name : (tierResults[0]?.prizeTierName || `Rank ${rank}`),
      tierType: tier ? tier.tierType : (rank === 0 ? "CONSOLATION" : "RANKED"),
      amount: tier?.amount ?? tierResults[0]?.amount,
      isSuffix,
      resultCount: count,
      resultsProportion: totalResults > 0 ? count / totalResults : 0
    });
  }

  return {
    id: `tier_stat_${scopeHash}`,
    population: scope,
    totalPrizeTiers: items.length,
    totalResultsAcrossTiers: totalResults,
    items
  };
}

export function computeNumberFrequency(
  results: WinningResult[],
  scope: StatisticalPopulationScope,
  scopeHash: string
): NumberFrequencyReport {
  const map = new Map<
    string,
    {
      canonicalNumber: string;
      numberLength: number;
      count: number;
      resultIds: Set<string>;
      drawIds: Set<string>;
      docShas: Set<string>;
    }
  >();

  for (const r of results) {
    const num = r.canonicalNumber; // String with leading zeros preserved
    if (!map.has(num)) {
      map.set(num, {
        canonicalNumber: num,
        numberLength: r.numberLength,
        count: 0,
        resultIds: new Set(),
        drawIds: new Set(),
        docShas: new Set()
      });
    }
    const entry = map.get(num)!;
    entry.count += 1;
    entry.resultIds.add(r.id);
    if (r.drawId) entry.drawIds.add(r.drawId);
    entry.docShas.add(r.documentSha256);
  }

  const total = results.length;
  const items: NumberFrequencyItem[] = Array.from(map.values()).map((entry) => ({
    canonicalNumber: entry.canonicalNumber,
    numberLength: entry.numberLength,
    observedOccurrences: entry.count,
    observedFrequency: total > 0 ? entry.count / total : 0,
    sourceResultIds: Array.from(entry.resultIds).sort(),
    sourceDrawIds: Array.from(entry.drawIds).sort(),
    sourceDocumentSha256s: Array.from(entry.docShas).sort()
  }));

  // Deterministic sorting: observedOccurrences DESC, then canonicalNumber ASC
  items.sort((a, b) => {
    if (b.observedOccurrences !== a.observedOccurrences) {
      return b.observedOccurrences - a.observedOccurrences;
    }
    return a.canonicalNumber.localeCompare(b.canonicalNumber);
  });

  return {
    id: `num_freq_${scopeHash}`,
    population: scope,
    totalObservedResults: total,
    distinctNumbersCount: items.length,
    items
  };
}

export function computeSeriesFrequency(
  results: WinningResult[],
  scope: StatisticalPopulationScope,
  scopeHash: string
): SeriesFrequencyReport {
  // Invariant: ONLY full-ticket results have series. Suffix results MUST NOT receive series.
  const fullTicketResults = results.filter((r) => !r.isSuffix && r.series);

  const map = new Map<
    string,
    {
      code: string;
      count: number;
      resultIds: Set<string>;
      drawIds: Set<string>;
    }
  >();

  for (const r of fullTicketResults) {
    const code = r.series!.trim().toUpperCase();
    if (!map.has(code)) {
      map.set(code, {
        code,
        count: 0,
        resultIds: new Set(),
        drawIds: new Set()
      });
    }
    const entry = map.get(code)!;
    entry.count += 1;
    entry.resultIds.add(r.id);
    if (r.drawId) entry.drawIds.add(r.drawId);
  }

  const total = fullTicketResults.length;
  const items: SeriesFrequencyItem[] = Array.from(map.values()).map((entry) => ({
    seriesCode: entry.code,
    observedOccurrences: entry.count,
    observedFrequency: total > 0 ? entry.count / total : 0,
    sourceResultIds: Array.from(entry.resultIds).sort(),
    sourceDrawIds: Array.from(entry.drawIds).sort()
  }));

  // Deterministic sorting: observedOccurrences DESC, then seriesCode ASC
  items.sort((a, b) => {
    if (b.observedOccurrences !== a.observedOccurrences) {
      return b.observedOccurrences - a.observedOccurrences;
    }
    return a.seriesCode.localeCompare(b.seriesCode);
  });

  return {
    id: `series_freq_${scopeHash}`,
    population: scope,
    totalFullTicketResults: total,
    distinctSeriesCount: items.length,
    items
  };
}

export function computeLastDigitFrequency(
  results: WinningResult[],
  scope: StatisticalPopulationScope,
  scopeHash: string
): LastDigitFrequencyReport {
  const digitCounts: Record<string, number> = {
    "0": 0, "1": 0, "2": 0, "3": 0, "4": 0,
    "5": 0, "6": 0, "7": 0, "8": 0, "9": 0
  };

  let totalAnalyzed = 0;

  for (const r of results) {
    const num = r.canonicalNumber;
    if (num.length > 0) {
      const lastDigit = num[num.length - 1]!;
      if (digitCounts[lastDigit] !== undefined) {
        digitCounts[lastDigit] += 1;
        totalAnalyzed += 1;
      }
    }
  }

  const distribution: DigitDistributionItem[] = Object.keys(digitCounts)
    .sort()
    .map((d) => {
      const count = digitCounts[d]!;
      return {
        digit: d,
        observedOccurrences: count,
        observedProportion: totalAnalyzed > 0 ? count / totalAnalyzed : 0
      };
    });

  return {
    id: `last_digit_${scopeHash}`,
    population: scope,
    totalNumbersAnalyzed: totalAnalyzed,
    distribution
  };
}

export function computeDigitPositionFrequency(
  results: WinningResult[],
  numberLength: number,
  scope: StatisticalPopulationScope,
  scopeHash: string
): DigitPositionFrequencyReport {
  // Invariant: all numbers must have exact numberLength
  for (const r of results) {
    if (r.numberLength !== numberLength || r.canonicalNumber.length !== numberLength) {
      throw new StatisticalValidationError(
        `Cannot calculate digit position distribution across mixed lengths: expected length ${numberLength}, got '${r.canonicalNumber}' (length ${r.canonicalNumber.length})`,
        "MIXED_NUMBER_LENGTHS",
        r
      );
    }
  }

  const positions: DigitPositionDistribution[] = [];

  for (let pos = 0; pos < numberLength; pos++) {
    const digitCounts: Record<string, number> = {
      "0": 0, "1": 0, "2": 0, "3": 0, "4": 0,
      "5": 0, "6": 0, "7": 0, "8": 0, "9": 0
    };

    let totalDigits = 0;

    for (const r of results) {
      const digit = r.canonicalNumber[pos]!;
      if (digitCounts[digit] !== undefined) {
        digitCounts[digit] += 1;
        totalDigits += 1;
      }
    }

    const distribution: DigitDistributionItem[] = Object.keys(digitCounts)
      .sort()
      .map((d) => {
        const count = digitCounts[d]!;
        return {
          digit: d,
          observedOccurrences: count,
          observedProportion: totalDigits > 0 ? count / totalDigits : 0
        };
      });

    positions.push({
      position: pos + 1, // 1-indexed from left
      positionFromEnd: numberLength - pos, // 1-indexed from right
      totalDigitsAnalyzed: totalDigits,
      distribution
    });
  }

  return {
    id: `pos_digit_${scopeHash}_len${numberLength}`,
    population: scope,
    numberLength,
    totalNumbersAnalyzed: results.length,
    positions
  };
}

export function computeSuffixFrequency(
  results: WinningResult[],
  suffixLength: number,
  scope: StatisticalPopulationScope,
  scopeHash: string
): SuffixFrequencyReport {
  const eligibleResults = results.filter((r) => r.canonicalNumber.length >= suffixLength);

  const map = new Map<
    string,
    {
      suffix: string;
      count: number;
      resultIds: Set<string>;
      drawIds: Set<string>;
    }
  >();

  for (const r of eligibleResults) {
    const num = r.canonicalNumber;
    const suf = num.slice(-suffixLength);

    if (!map.has(suf)) {
      map.set(suf, {
        suffix: suf,
        count: 0,
        resultIds: new Set(),
        drawIds: new Set()
      });
    }
    const entry = map.get(suf)!;
    entry.count += 1;
    entry.resultIds.add(r.id);
    if (r.drawId) entry.drawIds.add(r.drawId);
  }

  const total = eligibleResults.length;
  const items: SuffixFrequencyItem[] = Array.from(map.values()).map((entry) => ({
    suffix: entry.suffix,
    suffixLength,
    observedOccurrences: entry.count,
    observedFrequency: total > 0 ? entry.count / total : 0,
    sourceResultIds: Array.from(entry.resultIds).sort(),
    sourceDrawIds: Array.from(entry.drawIds).sort()
  }));

  // Deterministic sorting: observedOccurrences DESC, then suffix string ASC
  items.sort((a, b) => {
    if (b.observedOccurrences !== a.observedOccurrences) {
      return b.observedOccurrences - a.observedOccurrences;
    }
    return a.suffix.localeCompare(b.suffix);
  });

  return {
    id: `suffix_freq_${scopeHash}_len${suffixLength}`,
    population: scope,
    suffixLength,
    totalObservedResults: total,
    distinctSuffixesCount: items.length,
    items
  };
}
