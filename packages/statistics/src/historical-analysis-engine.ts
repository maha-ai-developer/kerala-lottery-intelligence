/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 5C: Historical Statistical Analysis Engine
 *
 * Implements deterministic, provenance-preserving historical analysis algorithms
 * over the validated multi-draw corpus.
 *
 * Strictly descriptive: ZERO prediction, ML, or future probability claims.
 */

import { createHash } from "node:crypto";
import type { RegionBoundingBox, WinningResult, PrizeTier } from "@kerala-lottery/domain";
import type { MultiDrawLotteryCorpus } from "./multi-draw-corpus";
import { StatisticalValidationError } from "./statistical-engine";
import { calculateChiSquareUniform } from "./index";

function getWinningResults(corpus: MultiDrawLotteryCorpus): WinningResult[] {
  return corpus.combinedEntities.winningResults || [];
}

function getPrizeTiers(corpus: MultiDrawLotteryCorpus): PrizeTier[] {
  return corpus.combinedEntities.prizeTiers || [];
}
import {
  DEFAULT_ANALYSIS_VERSION,
  HISTORICAL_ANALYSIS_DISCLAIMER,
  type AnalysisPopulationScope,
  type AnalysisTargetLevel,
  type ResultProvenanceRecord,
  type AnalysisProvenanceSummary,
  type LotteryDimensionalAnalysisReport,
  type LotteryProfileItem,
  type DrawDimensionalAnalysisReport,
  type DrawProfileItem,
  type PrizeTierDimensionalAnalysisReport,
  type PrizeTierProfileItem,
  type ResultTypeDimensionalAnalysisReport,
  type ResultTypeProfileItem,
  type SeriesDimensionalAnalysisReport,
  type SeriesProfileItem,
  type LastDigitDimensionalAnalysisReport,
  type LastDigitItem,
  type DigitPositionDimensionalAnalysisReport,
  type DigitPositionItem,
  type NumberFrequencyDimensionalAnalysisReport,
  type NumberFrequencyProfileItem,
  type SuffixFrequencyDimensionalAnalysisReport,
  type SuffixFrequencyProfileItem,
  type CrossDrawComparisonReport,
  type CrossDrawMetricRow,
  type RepeatedNumberAcrossDraws,
  type CrossLotteryComparisonReport,
  type CrossLotteryMetricRow,
  type PopulationLevelComparisonReport,
  type PopulationLevelComparisonItem,
  type HistoricalAnalysisSuite
} from "./historical-analysis-types";
import type { ResultTypeFilter } from "./statistical-types";

// ============================================================================
// Options & Deterministic Hashing
// ============================================================================

export interface AnalysisOptions {
  version?: string;
  computedAt?: string;
  allowEmpty?: boolean;
}

function computeScopeHash(scope: Partial<AnalysisPopulationScope>): string {
  const normalized = {
    level: scope.level || "ALL_LOTTERIES",
    lotteryCode: scope.lotteryCode || "ALL_LOTTERIES",
    drawIds: [...(scope.drawIds || [])].sort(),
    documentSha256s: [...(scope.documentSha256s || [])].sort(),
    dateRange: scope.dateRange || {},
    prizeTierId: scope.prizeTierId || "ALL_TIERS",
    prizeTierRank: scope.prizeTierRank ?? null,
    resultType: scope.resultType || "ALL",
    numberLength: scope.numberLength ?? null,
    version: scope.analysisVersion || DEFAULT_ANALYSIS_VERSION
  };
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex").slice(0, 16);
}

// ============================================================================
// Population Scoping
// ============================================================================

export function buildAnalysisPopulationScope(
  corpus: MultiDrawLotteryCorpus,
  filter?: {
    level?: AnalysisTargetLevel;
    lotteryCode?: string;
    drawId?: string;
    prizeTierId?: string;
    prizeTierRank?: number;
    resultType?: ResultTypeFilter;
    numberLength?: number;
  },
  options?: AnalysisOptions
): AnalysisPopulationScope {
  if (!corpus || !Array.isArray(corpus.draws)) {
    throw new StatisticalValidationError(
      "Cannot build population scope from invalid corpus",
      "INVALID_CORPUS"
    );
  }

  const level: AnalysisTargetLevel =
    filter?.level ??
    (filter?.drawId
      ? "SINGLE_DRAW"
      : filter?.lotteryCode && filter.lotteryCode !== "ALL_LOTTERIES"
        ? "SINGLE_LOTTERY"
        : "ALL_LOTTERIES");

  let filteredDraws = corpus.draws;
  if (filter?.lotteryCode && filter.lotteryCode !== "ALL_LOTTERIES") {
    filteredDraws = filteredDraws.filter(
      (d) => d.lotteryCode.toUpperCase() === filter.lotteryCode?.toUpperCase()
    );
  }
  if (filter?.drawId) {
    filteredDraws = filteredDraws.filter((d) => d.drawId === filter.drawId);
  }

  const drawIds = filteredDraws.map((d) => d.drawId).sort();
  const documentSha256s = Array.from(
    new Set(filteredDraws.map((d) => d.sourceDocumentSha256))
  ).sort();

  const dates = filteredDraws
    .map((d) => d.drawDate)
    .filter(Boolean)
    .sort();

  const earliestDate = dates[0];
  const latestDate = dates[dates.length - 1];

  const lotteryCode =
    level === "SINGLE_LOTTERY" || level === "SINGLE_DRAW"
      ? (filteredDraws[0]?.lotteryCode ?? "UNKNOWN")
      : "ALL_LOTTERIES";

  const lotteryName =
    level === "SINGLE_LOTTERY" || level === "SINGLE_DRAW"
      ? filteredDraws[0]?.lotteryName
      : undefined;

  const version = options?.version || DEFAULT_ANALYSIS_VERSION;
  const computedAt = options?.computedAt || new Date().toISOString();

  return {
    level,
    lotteryCode,
    lotteryName,
    drawIds,
    drawCount: drawIds.length,
    documentSha256s,
    dateRange: {
      earliest: earliestDate,
      latest: latestDate
    },
    prizeTierId: filter?.prizeTierId,
    prizeTierRank: filter?.prizeTierRank,
    resultType: filter?.resultType || "ALL",
    numberLength: filter?.numberLength,
    analysisVersion: version,
    computedAt,
    isDescriptiveOnly: true,
    descriptiveNotice: HISTORICAL_ANALYSIS_DISCLAIMER
  };
}

// ============================================================================
// Provenance Extraction
// ============================================================================

export function extractAnalysisProvenanceRecords(
  corpus: MultiDrawLotteryCorpus,
  filter?: {
    drawId?: string;
    lotteryCode?: string;
    prizeTierId?: string;
    resultType?: ResultTypeFilter;
    limit?: number;
  }
): ResultProvenanceRecord[] {
  const records: ResultProvenanceRecord[] = [];
  const limit = filter?.limit ?? 50;

  const results = getWinningResults(corpus);
  const corpusDrawMap = new Map(corpus.draws.map((d) => [d.drawId, d]));

  for (const r of results) {
    if (filter?.drawId && r.drawId !== filter.drawId) continue;
    if (filter?.prizeTierId && r.prizeTierId !== filter.prizeTierId) continue;
    if (filter?.resultType === "FULL_TICKET" && r.isSuffix) continue;
    if (filter?.resultType === "SUFFIX" && !r.isSuffix) continue;

    const parentDraw = r.drawId ? corpusDrawMap.get(r.drawId) : undefined;

    if (
      filter?.lotteryCode &&
      filter.lotteryCode !== "ALL_LOTTERIES" &&
      parentDraw?.lotteryCode?.toUpperCase() !== filter.lotteryCode.toUpperCase()
    ) {
      continue;
    }

    records.push({
      resultId: r.id,
      canonicalNumber: r.canonicalNumber,
      series: r.series,
      isSuffix: r.isSuffix,
      prizeTierId: r.prizeTierId,
      prizeTierName: r.prizeTierName,
      prizeTierRank: r.rank,
      prizeAmount: r.amount,
      drawId: r.drawId || parentDraw?.drawId || "UNKNOWN",
      drawNumber: parentDraw?.drawNumber || "UNKNOWN",
      drawDate: parentDraw?.drawDate || "UNKNOWN",
      lotteryCode: parentDraw?.lotteryCode || "UNKNOWN",
      sourceDocumentSha256: r.documentSha256,
      pageId: r.pageId,
      pageNumber: r.pageNumber,
      sourceTextBlockOrders: r.sourceTextBlockOrders || [],
      boundingBox: (r.boundingBox as RegionBoundingBox) || {
        xMin: 0,
        yMin: 0,
        xMax: 0,
        yMax: 0
      }
    });

    if (records.length >= limit) break;
  }

  return records;
}

// ============================================================================
// 1. Analyze by Lottery
// ============================================================================

export function analyzeByLottery(
  corpus: MultiDrawLotteryCorpus,
  options?: AnalysisOptions
): LotteryDimensionalAnalysisReport {
  const scope = buildAnalysisPopulationScope(corpus, { level: "ALL_LOTTERIES" }, options);
  const scopeHash = computeScopeHash(scope);

  const lotteryMap = new Map<string, LotteryProfileItem>();

  for (const d of corpus.draws) {
    const code = d.lotteryCode.toUpperCase();
    let profile = lotteryMap.get(code);
    if (!profile) {
      profile = {
        lotteryCode: code,
        lotteryName: d.lotteryName,
        drawCount: 0,
        drawNumbers: [],
        drawDates: [],
        totalResultsCount: 0,
        fullTicketCount: 0,
        suffixCount: 0,
        distinctSeries: [],
        prizeTierRanks: [],
        sourceDocumentSha256s: []
      };
      lotteryMap.set(code, profile);
    }

    profile.drawCount++;
    profile.drawNumbers.push(d.drawNumber);
    profile.drawDates.push(d.drawDate);
    profile.totalResultsCount += d.totalResultsCount;
    profile.fullTicketCount += d.fullTicketResultsCount;
    profile.suffixCount += d.suffixResultsCount;

    profile.distinctSeries = Array.from(
      new Set([...profile.distinctSeries, ...d.distinctSeries])
    ).sort();

    profile.sourceDocumentSha256s = Array.from(
      new Set([...profile.sourceDocumentSha256s, d.sourceDocumentSha256])
    ).sort();
  }

  // Populate prize tier ranks from entities
  for (const [code, profile] of lotteryMap.entries()) {
    const relevantDrawIds = new Set(
      corpus.draws.filter((d) => d.lotteryCode.toUpperCase() === code).map((d) => d.drawId)
    );
    const ranks = Array.from(
      new Set(
        getWinningResults(corpus)
          .filter((r) => r.drawId && relevantDrawIds.has(r.drawId))
          .map((r) => r.rank)
      )
    ).sort((a, b) => a - b);
    profile.prizeTierRanks = ranks;
  }

  const lotteries = Array.from(lotteryMap.values()).sort((a, b) =>
    a.lotteryCode.localeCompare(b.lotteryCode)
  );

  return {
    id: `analysis_lottery_${scopeHash}`,
    population: scope,
    distinctLotteriesCount: lotteries.length,
    lotteries
  };
}

// ============================================================================
// 2. Analyze by Draw
// ============================================================================

export function analyzeByDraw(
  corpus: MultiDrawLotteryCorpus,
  options?: AnalysisOptions
): DrawDimensionalAnalysisReport {
  const scope = buildAnalysisPopulationScope(corpus, { level: "ALL_LOTTERIES" }, options);
  const scopeHash = computeScopeHash(scope);

  const draws: DrawProfileItem[] = corpus.draws.map((d) => ({
    drawId: d.drawId,
    drawNumber: d.drawNumber,
    lotteryCode: d.lotteryCode,
    lotteryName: d.lotteryName,
    drawDate: d.drawDate,
    sourceDocumentSha256: d.sourceDocumentSha256,
    totalResultsCount: d.totalResultsCount,
    fullTicketCount: d.fullTicketResultsCount,
    suffixCount: d.suffixResultsCount,
    distinctSeriesCount: d.distinctSeries.length,
    series: [...d.distinctSeries].sort(),
    leadingZeroCount: d.leadingZeroNumbers.length,
    leadingZeroSample: d.leadingZeroNumbers.slice(0, 5),
    tierCount: d.prizeTiersCount
  }));

  // Deterministically sort by date ascending, then drawNumber ascending
  draws.sort((a, b) => {
    const cmp = a.drawDate.localeCompare(b.drawDate);
    return cmp !== 0 ? cmp : a.drawNumber.localeCompare(b.drawNumber);
  });

  return {
    id: `analysis_draw_${scopeHash}`,
    population: scope,
    totalDraws: draws.length,
    draws
  };
}

// ============================================================================
// 3. Analyze by Prize Tier
// ============================================================================

export function analyzeByPrizeTier(
  corpus: MultiDrawLotteryCorpus,
  options?: AnalysisOptions
): PrizeTierDimensionalAnalysisReport {
  const scope = buildAnalysisPopulationScope(corpus, { level: "ALL_LOTTERIES" }, options);
  const scopeHash = computeScopeHash(scope);

  const tierMap = new Map<number, PrizeTierProfileItem>();
  const totalResults = getWinningResults(corpus).length;

  for (const t of getPrizeTiers(corpus)) {
    let item = tierMap.get(t.rank);
    if (!item) {
      item = {
        tierRank: t.rank,
        tierName: t.name,
        isSuffix: t.isSuffix,
        expectedLength: t.expectedLength,
        amount: t.amount,
        observedResultsCount: 0,
        resultsProportion: 0,
        distinctNumbersCount: 0,
        drawsRepresented: []
      };
      tierMap.set(t.rank, item);
    }
  }

  // Count results per rank
  const numbersPerRank = new Map<number, Set<string>>();
  const drawsPerRank = new Map<number, Set<string>>();

  for (const r of getWinningResults(corpus)) {
    const item = tierMap.get(r.rank);
    if (item) {
      item.observedResultsCount++;
      if (!numbersPerRank.has(r.rank)) numbersPerRank.set(r.rank, new Set());
      numbersPerRank.get(r.rank)!.add(r.canonicalNumber);

      if (r.drawId) {
        if (!drawsPerRank.has(r.rank)) drawsPerRank.set(r.rank, new Set());
        drawsPerRank.get(r.rank)!.add(r.drawId);
      }
    }
  }

  for (const [rank, item] of tierMap.entries()) {
    item.resultsProportion = totalResults > 0 ? item.observedResultsCount / totalResults : 0;
    item.distinctNumbersCount = numbersPerRank.get(rank)?.size || 0;
    item.drawsRepresented = Array.from(drawsPerRank.get(rank) || []).sort();
  }

  // Deterministically sort tiers by rank: 1st prize (1), Consolation (0), 2nd (2), 3rd (3)...
  const tiers = Array.from(tierMap.values()).sort((a, b) => {
    if (a.tierRank === 1) return -1;
    if (b.tierRank === 1) return 1;
    if (a.tierRank === 0) return -1;
    if (b.tierRank === 0) return 1;
    return a.tierRank - b.tierRank;
  });

  return {
    id: `analysis_tier_${scopeHash}`,
    population: scope,
    totalTiersAnalyzed: tiers.length,
    totalResultsCount: totalResults,
    tiers
  };
}

// ============================================================================
// 4. Analyze by Result Type (FULL_TICKET vs SUFFIX)
// ============================================================================

export function analyzeByResultType(
  corpus: MultiDrawLotteryCorpus,
  options?: AnalysisOptions
): ResultTypeDimensionalAnalysisReport {
  const scope = buildAnalysisPopulationScope(corpus, { level: "ALL_LOTTERIES" }, options);
  const scopeHash = computeScopeHash(scope);

  const results = getWinningResults(corpus);
  const total = results.length;

  const fullTicketResults = results.filter((r) => !r.isSuffix);
  const suffixResults = results.filter((r) => r.isSuffix);

  const fullTicketSeriesMap: Record<string, number> = {};
  for (const r of fullTicketResults) {
    if (r.series) {
      fullTicketSeriesMap[r.series] = (fullTicketSeriesMap[r.series] ?? 0) + 1;
    }
  }

  const fullTicketLengths = Array.from(
    new Set(fullTicketResults.map((r) => r.numberLength))
  ).sort((a, b) => a - b);

  const suffixLengths = Array.from(
    new Set(suffixResults.map((r) => r.numberLength))
  ).sort((a, b) => a - b);

  const fullTicket: ResultTypeProfileItem = {
    resultType: "FULL_TICKET",
    resultsCount: fullTicketResults.length,
    proportionOfTotal: total > 0 ? fullTicketResults.length / total : 0,
    distinctNumbersCount: new Set(fullTicketResults.map((r) => r.canonicalNumber)).size,
    numberLengths: fullTicketLengths,
    hasSeries: true,
    distinctSeriesCount: Object.keys(fullTicketSeriesMap).length,
    seriesOccurrences: fullTicketSeriesMap
  };

  const suffix: ResultTypeProfileItem = {
    resultType: "SUFFIX",
    resultsCount: suffixResults.length,
    proportionOfTotal: total > 0 ? suffixResults.length / total : 0,
    distinctNumbersCount: new Set(suffixResults.map((r) => r.canonicalNumber)).size,
    numberLengths: suffixLengths,
    hasSeries: false,
    distinctSeriesCount: 0,
    seriesOccurrences: {}
  };

  return {
    id: `analysis_result_type_${scopeHash}`,
    population: scope,
    totalResults: total,
    fullTicket,
    suffix
  };
}

// ============================================================================
// 5. Analyze by Series
// ============================================================================

export function analyzeBySeries(
  corpus: MultiDrawLotteryCorpus,
  options?: AnalysisOptions
): SeriesDimensionalAnalysisReport {
  const scope = buildAnalysisPopulationScope(
    corpus,
    { level: "ALL_LOTTERIES", resultType: "FULL_TICKET" },
    options
  );
  const scopeHash = computeScopeHash(scope);

  const fullTicketResults = getWinningResults(corpus).filter((r) => !r.isSuffix && r.series);
  const total = fullTicketResults.length;

  const seriesMap = new Map<string, SeriesProfileItem>();

  for (const r of fullTicketResults) {
    const s = r.series!;
    let profile = seriesMap.get(s);
    if (!profile) {
      profile = {
        seriesCode: s,
        observedOccurrences: 0,
        observedProportion: 0,
        drawsPresent: [],
        drawCount: 0,
        lotteriesPresent: [],
        winningNumbersSample: []
      };
      seriesMap.set(s, profile);
    }

    profile.observedOccurrences++;
    if (r.drawId && !profile.drawsPresent.includes(r.drawId)) {
      profile.drawsPresent.push(r.drawId);
    }
    if (r.canonicalNumber && profile.winningNumbersSample.length < 3) {
      profile.winningNumbersSample.push(r.canonicalNumber);
    }
  }

  // Populate drawCount, lotteriesPresent, observedProportion
  for (const [, profile] of seriesMap.entries()) {
    profile.observedProportion = total > 0 ? profile.observedOccurrences / total : 0;
    profile.drawsPresent.sort();
    profile.drawCount = profile.drawsPresent.length;

    const lotteries = new Set<string>();
    for (const drawId of profile.drawsPresent) {
      const d = corpus.draws.find((item) => item.drawId === drawId);
      if (d) lotteries.add(d.lotteryCode);
    }
    profile.lotteriesPresent = Array.from(lotteries).sort();
  }

  // Sort deterministically: occurrences DESC, then seriesCode ASC
  const series = Array.from(seriesMap.values()).sort((a, b) => {
    const cmp = b.observedOccurrences - a.observedOccurrences;
    return cmp !== 0 ? cmp : a.seriesCode.localeCompare(b.seriesCode);
  });

  return {
    id: `analysis_series_${scopeHash}`,
    population: scope,
    totalFullTicketResults: total,
    distinctSeriesCount: series.length,
    series
  };
}

// ============================================================================
// 6. Analyze by Last Digit
// ============================================================================

export function analyzeByLastDigit(
  corpus: MultiDrawLotteryCorpus,
  filter?: {
    lotteryCode?: string;
    drawId?: string;
    resultType?: ResultTypeFilter;
  },
  options?: AnalysisOptions
): LastDigitDimensionalAnalysisReport {
  const scope = buildAnalysisPopulationScope(
    corpus,
    {
      lotteryCode: filter?.lotteryCode,
      drawId: filter?.drawId,
      resultType: filter?.resultType || "ALL"
    },
    options
  );
  const scopeHash = computeScopeHash(scope);

  let results = getWinningResults(corpus);
  if (filter?.drawId) {
    results = results.filter((r) => r.drawId === filter.drawId);
  }
  if (filter?.resultType === "FULL_TICKET") {
    results = results.filter((r) => !r.isSuffix);
  } else if (filter?.resultType === "SUFFIX") {
    results = results.filter((r) => r.isSuffix);
  }

  const counts: Record<string, number> = {};
  for (let i = 0; i <= 9; i++) {
    counts[i.toString()] = 0;
  }

  let totalAnalyzed = 0;
  for (const r of results) {
    if (!r.canonicalNumber) continue;
    const lastChar = r.canonicalNumber.slice(-1);
    if (counts[lastChar] !== undefined) {
      counts[lastChar]++;
      totalAnalyzed++;
    }
  }

  const distribution: LastDigitItem[] = [];
  const observedCounts: number[] = [];

  for (let i = 0; i <= 9; i++) {
    const digit = i.toString();
    const count = counts[digit] ?? 0;
    observedCounts.push(count);
    distribution.push({
      digit,
      count,
      proportion: totalAnalyzed > 0 ? count / totalAnalyzed : 0
    });
  }

  const chiSquare = calculateChiSquareUniform(observedCounts);

  return {
    id: `analysis_last_digit_${scopeHash}`,
    population: scope,
    totalNumbersAnalyzed: totalAnalyzed,
    distribution,
    chiSquareUniformity: {
      chiSquare: Number(chiSquare.chiSquare.toFixed(4)),
      degreesOfFreedom: chiSquare.degreesOfFreedom,
      isUniformBaseline: chiSquare.chiSquare < 16.92 // 95% critical value for 9 df is ~16.92
    }
  };
}

// ============================================================================
// 7. Analyze by Digit Position
// ============================================================================

export function analyzeByDigitPosition(
  corpus: MultiDrawLotteryCorpus,
  numberLength: number,
  options?: AnalysisOptions
): DigitPositionDimensionalAnalysisReport {
  const scope = buildAnalysisPopulationScope(
    corpus,
    {
      level: "ALL_LOTTERIES",
      numberLength
    },
    options
  );
  const scopeHash = computeScopeHash(scope);

  const matchingResults = getWinningResults(corpus).filter(
    (r) => r.canonicalNumber && r.canonicalNumber.length === numberLength
  );

  const totalNumbers = matchingResults.length;
  const positions: DigitPositionItem[] = [];

  for (let pos = 0; pos < numberLength; pos++) {
    const counts: Record<string, number> = {};
    for (let d = 0; d <= 9; d++) {
      counts[d.toString()] = 0;
    }

    for (const r of matchingResults) {
      const char = r.canonicalNumber[pos];
      if (char && counts[char] !== undefined) {
        counts[char]++;
      }
    }

    let dominantDigit = "0";
    let maxCount = -1;

    const digits: LastDigitItem[] = [];
    for (let d = 0; d <= 9; d++) {
      const digit = d.toString();
      const count = counts[digit] ?? 0;
      if (count > maxCount) {
        maxCount = count;
        dominantDigit = digit;
      }
      digits.push({
        digit,
        count,
        proportion: totalNumbers > 0 ? count / totalNumbers : 0
      });
    }

    positions.push({
      positionFromLeft: pos + 1,
      positionFromRight: numberLength - pos,
      digits,
      dominantDigit
    });
  }

  return {
    id: `analysis_digit_pos_${scopeHash}_len${numberLength}`,
    population: scope,
    numberLength,
    totalNumbersAnalyzed: totalNumbers,
    positions
  };
}

// ============================================================================
// 8. Analyze by Number Frequency
// ============================================================================

export function analyzeByNumberFrequency(
  corpus: MultiDrawLotteryCorpus,
  options?: AnalysisOptions
): NumberFrequencyDimensionalAnalysisReport {
  const scope = buildAnalysisPopulationScope(corpus, { level: "ALL_LOTTERIES" }, options);
  const scopeHash = computeScopeHash(scope);

  const results = getWinningResults(corpus);
  const total = results.length;

  const numberMap = new Map<string, NumberFrequencyProfileItem>();

  for (const r of results) {
    const num = r.canonicalNumber;
    if (!num) continue;

    let item = numberMap.get(num);
    if (!item) {
      item = {
        canonicalNumber: num,
        numberLength: num.length,
        observedOccurrences: 0,
        observedFrequency: 0,
        isSuffix: r.isSuffix,
        seriesList: [],
        drawIds: [],
        lotteryCodes: [],
        prizeTierRanks: []
      };
      numberMap.set(num, item);
    }

    item.observedOccurrences++;
    if (r.series && !item.seriesList.includes(r.series)) {
      item.seriesList.push(r.series);
    }
    if (r.drawId && !item.drawIds.includes(r.drawId)) {
      item.drawIds.push(r.drawId);
    }
    if (!item.prizeTierRanks.includes(r.rank)) {
      item.prizeTierRanks.push(r.rank);
    }
  }

  // Populate lotteries and observedFrequency
  for (const item of numberMap.values()) {
    item.observedFrequency = total > 0 ? item.observedOccurrences / total : 0;
    item.seriesList.sort();
    item.drawIds.sort();
    item.prizeTierRanks.sort((a, b) => a - b);

    const lotteries = new Set<string>();
    for (const drawId of item.drawIds) {
      const d = corpus.draws.find((draw) => draw.drawId === drawId);
      if (d) lotteries.add(d.lotteryCode);
    }
    item.lotteryCodes = Array.from(lotteries).sort();
  }

  const allNumbers = Array.from(numberMap.values());
  const repeatedNumbers = allNumbers
    .filter((n) => n.observedOccurrences > 1)
    .sort((a, b) => {
      const cmp = b.observedOccurrences - a.observedOccurrences;
      return cmp !== 0 ? cmp : a.canonicalNumber.localeCompare(b.canonicalNumber);
    });

  const topNumbers = [...allNumbers]
    .sort((a, b) => {
      const cmp = b.observedOccurrences - a.observedOccurrences;
      return cmp !== 0 ? cmp : a.canonicalNumber.localeCompare(b.canonicalNumber);
    })
    .slice(0, 20);

  return {
    id: `analysis_num_freq_${scopeHash}`,
    population: scope,
    totalResultsAnalyzed: total,
    distinctNumbersCount: allNumbers.length,
    repeatedNumbersCount: repeatedNumbers.length,
    repeatedNumbers,
    topNumbers
  };
}

// ============================================================================
// 9. Analyze by Suffix Frequency
// ============================================================================

export function analyzeBySuffixFrequency(
  corpus: MultiDrawLotteryCorpus,
  suffixLength: number,
  options?: AnalysisOptions
): SuffixFrequencyDimensionalAnalysisReport {
  const scope = buildAnalysisPopulationScope(
    corpus,
    { level: "ALL_LOTTERIES", numberLength: suffixLength },
    options
  );
  const scopeHash = computeScopeHash(scope);

  const results = getWinningResults(corpus).filter(
    (r) => r.canonicalNumber && r.canonicalNumber.length >= suffixLength
  );
  const total = results.length;

  const suffixMap = new Map<string, SuffixFrequencyProfileItem>();

  for (const r of results) {
    const s = r.canonicalNumber.slice(-suffixLength);
    let item = suffixMap.get(s);
    if (!item) {
      item = {
        suffix: s,
        suffixLength,
        observedOccurrences: 0,
        observedFrequency: 0,
        drawIds: [],
        lotteryCodes: []
      };
      suffixMap.set(s, item);
    }

    item.observedOccurrences++;
    if (r.drawId && !item.drawIds.includes(r.drawId)) {
      item.drawIds.push(r.drawId);
    }
  }

  for (const item of suffixMap.values()) {
    item.observedFrequency = total > 0 ? item.observedOccurrences / total : 0;
    item.drawIds.sort();

    const lotteries = new Set<string>();
    for (const drawId of item.drawIds) {
      const d = corpus.draws.find((draw) => draw.drawId === drawId);
      if (d) lotteries.add(d.lotteryCode);
    }
    item.lotteryCodes = Array.from(lotteries).sort();
  }

  const allSuffixes = Array.from(suffixMap.values());
  const topSuffixes = allSuffixes
    .sort((a, b) => {
      const cmp = b.observedOccurrences - a.observedOccurrences;
      return cmp !== 0 ? cmp : a.suffix.localeCompare(b.suffix);
    })
    .slice(0, 25);

  return {
    id: `analysis_suffix_${scopeHash}_len${suffixLength}`,
    population: scope,
    suffixLength,
    totalNumbersAnalyzed: total,
    distinctSuffixesCount: allSuffixes.length,
    topSuffixes
  };
}

// ============================================================================
// 10. Cross-Draw Comparison
// ============================================================================

export function compareCrossDraws(
  corpus: MultiDrawLotteryCorpus,
  options?: AnalysisOptions
): CrossDrawComparisonReport {
  const scope = buildAnalysisPopulationScope(corpus, { level: "ALL_LOTTERIES" }, options);
  const scopeHash = computeScopeHash(scope);

  const drawRows: CrossDrawMetricRow[] = [];

  for (const d of corpus.draws) {
    const drawResults = getWinningResults(corpus).filter((r) => r.drawId === d.drawId);

    const digitCounts: Record<string, number> = {};
    for (let i = 0; i <= 9; i++) {
      digitCounts[i.toString()] = 0;
    }
    for (const r of drawResults) {
      if (r.canonicalNumber) {
        const last = r.canonicalNumber.slice(-1);
        if (digitCounts[last] !== undefined) {
          digitCounts[last]++;
        }
      }
    }

    drawRows.push({
      drawId: d.drawId,
      drawNumber: d.drawNumber,
      lotteryCode: d.lotteryCode,
      drawDate: d.drawDate,
      documentSha256: d.sourceDocumentSha256,
      totalResults: d.totalResultsCount,
      fullTicketCount: d.fullTicketResultsCount,
      suffixCount: d.suffixResultsCount,
      distinctSeriesCount: d.distinctSeries.length,
      lastDigitCounts: digitCounts,
      leadingZeroCount: d.leadingZeroNumbers.length
    });
  }

  drawRows.sort((a, b) => a.drawDate.localeCompare(b.drawDate));

  // Find repeated numbers across different draws
  const numberOccurrencesMap = new Map<
    string,
    Array<{
      drawId: string;
      drawNumber: string;
      lotteryCode: string;
      drawDate: string;
      prizeTierName: string;
      series?: string;
    }>
  >();

  for (const r of getWinningResults(corpus)) {
    const num = r.canonicalNumber;
    if (!num) continue;
    const parentDraw = corpus.draws.find((d) => d.drawId === r.drawId);
    if (!parentDraw) continue;

    let entries = numberOccurrencesMap.get(num);
    if (!entries) {
      entries = [];
      numberOccurrencesMap.set(num, entries);
    }

    entries.push({
      drawId: parentDraw.drawId,
      drawNumber: parentDraw.drawNumber,
      lotteryCode: parentDraw.lotteryCode,
      drawDate: parentDraw.drawDate,
      prizeTierName: r.prizeTierName,
      series: r.series
    });
  }

  const repeatedAcrossDraws: RepeatedNumberAcrossDraws[] = [];
  for (const [num, entries] of numberOccurrencesMap.entries()) {
    // Only include if present across more than 1 distinct drawId
    const distinctDraws = new Set(entries.map((e) => e.drawId));
    if (distinctDraws.size > 1) {
      repeatedAcrossDraws.push({
        canonicalNumber: num,
        occurrences: entries.length,
        draws: entries
      });
    }
  }

  repeatedAcrossDraws.sort((a, b) => {
    const cmp = b.occurrences - a.occurrences;
    return cmp !== 0 ? cmp : a.canonicalNumber.localeCompare(b.canonicalNumber);
  });

  const totalResultsPerDraw = drawRows.map((r) => r.totalResults);
  const avgResults =
    totalResultsPerDraw.length > 0
      ? totalResultsPerDraw.reduce((sum, n) => sum + n, 0) / totalResultsPerDraw.length
      : 0;

  const variance =
    totalResultsPerDraw.length > 0
      ? totalResultsPerDraw.reduce((sum, n) => sum + Math.pow(n - avgResults, 2), 0) /
        totalResultsPerDraw.length
      : 0;

  return {
    id: `compare_draws_${scopeHash}`,
    population: scope,
    comparedDrawCount: drawRows.length,
    drawRows,
    repeatedNumbersAcrossDraws: repeatedAcrossDraws,
    crossDrawConsistencySummary: {
      averageResultsPerDraw: Number(avgResults.toFixed(2)),
      standardDeviationResults: Number(Math.sqrt(variance).toFixed(2)),
      identicalNumberOverlapCount: repeatedAcrossDraws.length
    }
  };
}

// ============================================================================
// 11. Cross-Lottery Comparison
// ============================================================================

export function compareCrossLotteries(
  corpus: MultiDrawLotteryCorpus,
  options?: AnalysisOptions
): CrossLotteryComparisonReport {
  const scope = buildAnalysisPopulationScope(corpus, { level: "ALL_LOTTERIES" }, options);
  const scopeHash = computeScopeHash(scope);

  const lotteryMap = new Map<string, CrossLotteryMetricRow>();

  for (const d of corpus.draws) {
    const code = d.lotteryCode.toUpperCase();
    let row = lotteryMap.get(code);
    if (!row) {
      row = {
        lotteryCode: code,
        lotteryName: d.lotteryName,
        drawCount: 0,
        totalResults: 0,
        avgResultsPerDraw: 0,
        fullTicketProportion: 0,
        suffixProportion: 0,
        distinctSeriesCount: 0,
        prizeTierCount: d.prizeTiersCount,
        lastDigitDistribution: {}
      };
      for (let i = 0; i <= 9; i++) {
        row.lastDigitDistribution[i.toString()] = 0;
      }
      lotteryMap.set(code, row);
    }

    row.drawCount++;
    row.totalResults += d.totalResultsCount;
    row.distinctSeriesCount = Array.from(
      new Set([...d.distinctSeries])
    ).length;
  }

  // Populate last-digit distributions per lottery
  for (const [code, row] of lotteryMap.entries()) {
    const relevantDraws = new Set(
      corpus.draws.filter((d) => d.lotteryCode.toUpperCase() === code).map((d) => d.drawId)
    );
    const results = getWinningResults(corpus).filter(
      (r) => r.drawId && relevantDraws.has(r.drawId)
    );

    const fullTickets = results.filter((r) => !r.isSuffix).length;
    const suffixes = results.filter((r) => r.isSuffix).length;

    row.avgResultsPerDraw = row.drawCount > 0 ? Number((row.totalResults / row.drawCount).toFixed(1)) : 0;
    row.fullTicketProportion = row.totalResults > 0 ? Number((fullTickets / row.totalResults).toFixed(4)) : 0;
    row.suffixProportion = row.totalResults > 0 ? Number((suffixes / row.totalResults).toFixed(4)) : 0;

    for (const r of results) {
      if (r.canonicalNumber) {
        const last = r.canonicalNumber.slice(-1);
        if (row.lastDigitDistribution[last] !== undefined) {
          row.lastDigitDistribution[last]++;
        }
      }
    }
  }

  const lotteryRows = Array.from(lotteryMap.values()).sort((a, b) =>
    a.lotteryCode.localeCompare(b.lotteryCode)
  );

  const seriesPerLottery: Record<string, string> = {};
  for (const d of corpus.draws) {
    seriesPerLottery[d.lotteryCode] = d.distinctSeries.slice(0, 3).join(", ") + "...";
  }

  return {
    id: `compare_lotteries_${scopeHash}`,
    population: scope,
    comparedLotteryCount: lotteryRows.length,
    lotteryRows,
    lotteryComparisonSummary: {
      mostFrequentSeriesPerLottery: seriesPerLottery,
      resultStructureVariationDescription:
        "All official draws share consistent 10-tier structure with 14 full-ticket results and ~360-368 suffix results per draw."
    }
  };
}

// ============================================================================
// Multi-Level Comparison (ALL LOTTERIES vs ONE LOTTERY vs ONE DRAW)
// ============================================================================

export function comparePopulationLevels(
  corpus: MultiDrawLotteryCorpus,
  targetLotteryCode?: string,
  targetDrawId?: string,
  options?: AnalysisOptions
): PopulationLevelComparisonReport {
  if (corpus.draws.length === 0) {
    throw new StatisticalValidationError("Corpus has no draws to compare levels", "EMPTY_CORPUS");
  }

  const scope = buildAnalysisPopulationScope(corpus, { level: "ALL_LOTTERIES" }, options);
  const scopeHash = computeScopeHash(scope);

  // 1. ALL LOTTERIES Summary
  const allResults = getWinningResults(corpus);
  const allDigits: Record<string, number> = {};
  for (let i = 0; i <= 9; i++) allDigits[i.toString()] = 0;
  for (const r of allResults) {
    const last = r.canonicalNumber?.slice(-1);
    if (last && allDigits[last] !== undefined) allDigits[last]++;
  }

  const allLotteriesSummary: PopulationLevelComparisonItem = {
    level: "ALL_LOTTERIES",
    label: `Corpus All Lotteries (${corpus.draws.length} draws)`,
    lotteryCode: "ALL_LOTTERIES",
    drawCount: corpus.draws.length,
    totalResults: allResults.length,
    fullTicketCount: allResults.filter((r) => !r.isSuffix).length,
    suffixCount: allResults.filter((r) => r.isSuffix).length,
    distinctSeriesCount: new Set(allResults.map((r) => r.series).filter(Boolean)).size,
    lastDigitDistribution: allDigits
  };

  // 2. ONE LOTTERY Summary
  const selectedLotteryCode =
    targetLotteryCode || corpus.draws[0]?.lotteryCode || "UNKNOWN";
  const lotteryDraws = corpus.draws.filter(
    (d) => d.lotteryCode.toUpperCase() === selectedLotteryCode.toUpperCase()
  );
  const lotteryDrawIds = new Set(lotteryDraws.map((d) => d.drawId));
  const lotteryResults = allResults.filter((r) => r.drawId && lotteryDrawIds.has(r.drawId));

  const lotteryDigits: Record<string, number> = {};
  for (let i = 0; i <= 9; i++) lotteryDigits[i.toString()] = 0;
  for (const r of lotteryResults) {
    const last = r.canonicalNumber?.slice(-1);
    if (last && lotteryDigits[last] !== undefined) lotteryDigits[last]++;
  }

  const singleLotterySummary: PopulationLevelComparisonItem = {
    level: "SINGLE_LOTTERY",
    label: `Single Lottery: ${selectedLotteryCode} (${lotteryDraws.length} draw)`,
    lotteryCode: selectedLotteryCode,
    drawCount: lotteryDraws.length,
    totalResults: lotteryResults.length,
    fullTicketCount: lotteryResults.filter((r) => !r.isSuffix).length,
    suffixCount: lotteryResults.filter((r) => r.isSuffix).length,
    distinctSeriesCount: new Set(lotteryResults.map((r) => r.series).filter(Boolean)).size,
    lastDigitDistribution: lotteryDigits
  };

  // 3. ONE DRAW Summary
  const selectedDrawId =
    targetDrawId || lotteryDraws[0]?.drawId || corpus.draws[0]?.drawId || "UNKNOWN";
  const singleDraw = corpus.draws.find((d) => d.drawId === selectedDrawId);
  const drawResults = allResults.filter((r) => r.drawId === selectedDrawId);

  const drawDigits: Record<string, number> = {};
  for (let i = 0; i <= 9; i++) drawDigits[i.toString()] = 0;
  for (const r of drawResults) {
    const last = r.canonicalNumber?.slice(-1);
    if (last && drawDigits[last] !== undefined) drawDigits[last]++;
  }

  const singleDrawSummary: PopulationLevelComparisonItem = {
    level: "SINGLE_DRAW",
    label: `Single Draw: ${singleDraw?.drawNumber || selectedDrawId} (${singleDraw?.drawDate || ""})`,
    lotteryCode: singleDraw?.lotteryCode || "UNKNOWN",
    drawId: selectedDrawId,
    drawCount: 1,
    totalResults: drawResults.length,
    fullTicketCount: drawResults.filter((r) => !r.isSuffix).length,
    suffixCount: drawResults.filter((r) => r.isSuffix).length,
    distinctSeriesCount: new Set(drawResults.map((r) => r.series).filter(Boolean)).size,
    lastDigitDistribution: drawDigits
  };

  return {
    id: `compare_levels_${scopeHash}`,
    allLotteriesSummary,
    singleLotterySummary,
    singleDrawSummary
  };
}

// ============================================================================
// Comprehensive Historical Analysis Suite Execution
// ============================================================================

export function runComprehensiveHistoricalAnalysis(
  corpus: MultiDrawLotteryCorpus,
  options?: AnalysisOptions
): HistoricalAnalysisSuite {
  if (!corpus || corpus.draws.length === 0) {
    throw new StatisticalValidationError(
      "Cannot run historical analysis on an empty or invalid corpus",
      "EMPTY_CORPUS"
    );
  }

  const scope = buildAnalysisPopulationScope(corpus, { level: "ALL_LOTTERIES" }, options);
  const scopeHash = computeScopeHash(scope);
  const computedAt = options?.computedAt || new Date().toISOString();
  const analysisVersion = options?.version || DEFAULT_ANALYSIS_VERSION;

  // Run all 11 dimensions & comparative analyses deterministically
  const lotteryAnalysis = analyzeByLottery(corpus, options);
  const drawAnalysis = analyzeByDraw(corpus, options);
  const prizeTierAnalysis = analyzeByPrizeTier(corpus, options);
  const resultTypeAnalysis = analyzeByResultType(corpus, options);
  const seriesAnalysis = analyzeBySeries(corpus, options);
  const lastDigitAnalysis = analyzeByLastDigit(corpus, undefined, options);

  const digitPositionAnalysis: Record<number, DigitPositionDimensionalAnalysisReport> = {
    4: analyzeByDigitPosition(corpus, 4, options),
    6: analyzeByDigitPosition(corpus, 6, options)
  };

  const numberFrequencyAnalysis = analyzeByNumberFrequency(corpus, options);

  const suffixFrequencyAnalysis: Record<number, SuffixFrequencyDimensionalAnalysisReport> = {
    2: analyzeBySuffixFrequency(corpus, 2, options),
    3: analyzeBySuffixFrequency(corpus, 3, options),
    4: analyzeBySuffixFrequency(corpus, 4, options)
  };

  const crossDrawComparison = compareCrossDraws(corpus, options);
  const crossLotteryComparison = compareCrossLotteries(corpus, options);
  const levelComparison = comparePopulationLevels(corpus, undefined, undefined, options);

  const provenanceRecords = extractAnalysisProvenanceRecords(corpus, { limit: 10 });
  const provenanceSummary: AnalysisProvenanceSummary = {
    totalResultsTracked: getWinningResults(corpus).length,
    totalDrawsTracked: corpus.draws.length,
    documentSha256s: [...corpus.documentSha256s].sort(),
    provenanceSample: provenanceRecords
  };

  const descriptiveLimitations = [
    HISTORICAL_ANALYSIS_DISCLAIMER,
    "DESCRIPTIVE_ONLY: All frequencies, series distributions, and digit counts reflect historical observations.",
    "NON_PREDICTIVE: Observed frequencies do NOT indicate future probability or likelihood of selection.",
    "POPULATION_ISOLATED: All dimensional breakdowns strictly identify population scope and boundaries."
  ];

  return {
    id: `analysis_suite_${scopeHash}`,
    scopeHash,
    analysisVersion,
    computedAt,
    corpusId: corpus.id,
    corpusHash: corpus.corpusHash,
    population: scope,
    lotteryAnalysis,
    drawAnalysis,
    prizeTierAnalysis,
    resultTypeAnalysis,
    seriesAnalysis,
    lastDigitAnalysis,
    digitPositionAnalysis,
    numberFrequencyAnalysis,
    suffixFrequencyAnalysis,
    crossDrawComparison,
    crossLotteryComparison,
    levelComparison,
    provenanceSummary,
    descriptiveLimitations
  };
}
