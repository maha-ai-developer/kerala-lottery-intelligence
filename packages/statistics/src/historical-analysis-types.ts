/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 5C: Historical Statistical Analysis Contracts
 *
 * Defines the deterministic, provenance-preserving historical analysis contracts
 * operating over the validated multi-draw corpus.
 *
 * Invariants:
 * - Purely descriptive historical observations (OBSERVED DATA ONLY).
 * - Strictly NO prediction, betting strategies, lucky/due numbers, or future probability.
 * - String preservation of lottery numbers with exact leading zeros preserved.
 * - Strict full-ticket vs suffix separation.
 * - Explicit population identification (ALL LOTTERIES vs ONE LOTTERY vs ONE DRAW).
 * - End-to-end provenance: Analysis -> observed result -> tier -> draw -> page/block -> SHA-256.
 * - Deterministic IDs and ordering.
 */

import type { RegionBoundingBox } from "@kerala-lottery/domain";
import type { ResultTypeFilter } from "./statistical-types";

export const DEFAULT_ANALYSIS_VERSION = "v1.0.0-historical-analysis";

export const HISTORICAL_ANALYSIS_DISCLAIMER =
  "HISTORICAL_OBSERVATION: Descriptive statistical analysis of observed Kerala State Lottery publications. " +
  "Strictly descriptive of past occurrences; does not predict, forecast, or optimize future lottery results.";

// ============================================================================
// Population Scope & Safety
// ============================================================================

export type AnalysisTargetLevel =
  | "ALL_LOTTERIES"
  | "SINGLE_LOTTERY"
  | "SINGLE_DRAW"
  | "CUSTOM_FILTER";

export interface AnalysisPopulationScope {
  level: AnalysisTargetLevel;
  lotteryCode: string; // e.g. "ALL_LOTTERIES", "KARUNYA", "DHANALEKSHMI"
  lotteryName?: string;
  drawIds: string[];
  drawCount: number;
  documentSha256s: string[];
  dateRange: {
    earliest?: string;
    latest?: string;
  };
  prizeTierId?: string;
  prizeTierRank?: number;
  resultType: ResultTypeFilter;
  numberLength?: number;
  analysisVersion: string;
  computedAt: string;
  isDescriptiveOnly: true;
  descriptiveNotice: string;
}

// ============================================================================
// Provenance Tracking Contracts
// ============================================================================

export interface ResultProvenanceRecord {
  resultId: string;
  canonicalNumber: string;
  series?: string;
  isSuffix: boolean;
  prizeTierId: string;
  prizeTierName: string;
  prizeTierRank: number;
  prizeAmount?: number;
  drawId: string;
  drawNumber: string;
  drawDate: string;
  lotteryCode: string;
  sourceDocumentSha256: string;
  pageId: string;
  pageNumber: number;
  sourceTextBlockOrders: number[];
  boundingBox: RegionBoundingBox;
}

export interface AnalysisProvenanceSummary {
  totalResultsTracked: number;
  totalDrawsTracked: number;
  documentSha256s: string[];
  provenanceSample: ResultProvenanceRecord[];
}

// ============================================================================
// 1. Lottery Dimensional Analysis
// ============================================================================

export interface LotteryProfileItem {
  lotteryCode: string;
  lotteryName: string;
  drawCount: number;
  drawNumbers: string[];
  drawDates: string[];
  totalResultsCount: number;
  fullTicketCount: number;
  suffixCount: number;
  distinctSeries: string[];
  prizeTierRanks: number[];
  sourceDocumentSha256s: string[];
}

export interface LotteryDimensionalAnalysisReport {
  id: string; // Deterministic: `analysis_lottery_${scopeHash}`
  population: AnalysisPopulationScope;
  distinctLotteriesCount: number;
  lotteries: LotteryProfileItem[];
}

// ============================================================================
// 2. Draw Dimensional Analysis
// ============================================================================

export interface DrawProfileItem {
  drawId: string;
  drawNumber: string;
  lotteryCode: string;
  lotteryName: string;
  drawDate: string;
  sourceDocumentSha256: string;
  totalResultsCount: number;
  fullTicketCount: number;
  suffixCount: number;
  distinctSeriesCount: number;
  series: string[];
  leadingZeroCount: number;
  leadingZeroSample: string[];
  tierCount: number;
}

export interface DrawDimensionalAnalysisReport {
  id: string; // Deterministic: `analysis_draw_${scopeHash}`
  population: AnalysisPopulationScope;
  totalDraws: number;
  draws: DrawProfileItem[];
}

// ============================================================================
// 3. Prize Tier Dimensional Analysis
// ============================================================================

export interface PrizeTierProfileItem {
  tierRank: number;
  tierName: string;
  isSuffix: boolean;
  expectedLength: number;
  amount?: number;
  observedResultsCount: number;
  resultsProportion: number;
  distinctNumbersCount: number;
  drawsRepresented: string[];
}

export interface PrizeTierDimensionalAnalysisReport {
  id: string; // Deterministic: `analysis_tier_${scopeHash}`
  population: AnalysisPopulationScope;
  totalTiersAnalyzed: number;
  totalResultsCount: number;
  tiers: PrizeTierProfileItem[];
}

// ============================================================================
// 4. Result Type Dimensional Analysis (FULL_TICKET vs SUFFIX)
// ============================================================================

export interface ResultTypeProfileItem {
  resultType: "FULL_TICKET" | "SUFFIX";
  resultsCount: number;
  proportionOfTotal: number;
  distinctNumbersCount: number;
  numberLengths: number[];
  hasSeries: boolean;
  distinctSeriesCount: number;
  seriesOccurrences: Record<string, number>;
}

export interface ResultTypeDimensionalAnalysisReport {
  id: string; // Deterministic: `analysis_result_type_${scopeHash}`
  population: AnalysisPopulationScope;
  totalResults: number;
  fullTicket: ResultTypeProfileItem;
  suffix: ResultTypeProfileItem;
}

// ============================================================================
// 5. Series Dimensional Analysis
// ============================================================================

export interface SeriesProfileItem {
  seriesCode: string;
  observedOccurrences: number;
  observedProportion: number;
  drawsPresent: string[];
  drawCount: number;
  lotteriesPresent: string[];
  winningNumbersSample: string[];
}

export interface SeriesDimensionalAnalysisReport {
  id: string; // Deterministic: `analysis_series_${scopeHash}`
  population: AnalysisPopulationScope;
  totalFullTicketResults: number;
  distinctSeriesCount: number;
  series: SeriesProfileItem[];
}

// ============================================================================
// 6. Last Digit Dimensional Analysis
// ============================================================================

export interface LastDigitItem {
  digit: string; // "0" through "9"
  count: number;
  proportion: number;
}

export interface LastDigitDimensionalAnalysisReport {
  id: string; // Deterministic: `analysis_last_digit_${scopeHash}`
  population: AnalysisPopulationScope;
  totalNumbersAnalyzed: number;
  distribution: LastDigitItem[];
  chiSquareUniformity: {
    chiSquare: number;
    degreesOfFreedom: number;
    isUniformBaseline: boolean;
  };
}

// ============================================================================
// 7. Digit Position Dimensional Analysis
// ============================================================================

export interface DigitPositionItem {
  positionFromLeft: number; // 1-indexed
  positionFromRight: number; // 1-indexed
  digits: LastDigitItem[];
  dominantDigit: string;
}

export interface DigitPositionDimensionalAnalysisReport {
  id: string; // Deterministic: `analysis_digit_pos_${scopeHash}_len${numberLength}`
  population: AnalysisPopulationScope;
  numberLength: number;
  totalNumbersAnalyzed: number;
  positions: DigitPositionItem[];
}

// ============================================================================
// 8. Number Frequency Dimensional Analysis
// ============================================================================

export interface NumberFrequencyProfileItem {
  canonicalNumber: string; // Leading zeros preserved
  numberLength: number;
  observedOccurrences: number;
  observedFrequency: number;
  isSuffix: boolean;
  seriesList: string[];
  drawIds: string[];
  lotteryCodes: string[];
  prizeTierRanks: number[];
}

export interface NumberFrequencyDimensionalAnalysisReport {
  id: string; // Deterministic: `analysis_num_freq_${scopeHash}`
  population: AnalysisPopulationScope;
  totalResultsAnalyzed: number;
  distinctNumbersCount: number;
  repeatedNumbersCount: number;
  repeatedNumbers: NumberFrequencyProfileItem[];
  topNumbers: NumberFrequencyProfileItem[];
}

// ============================================================================
// 9. Suffix Frequency Dimensional Analysis
// ============================================================================

export interface SuffixFrequencyProfileItem {
  suffix: string; // e.g. "48", "048", "0048"
  suffixLength: number;
  observedOccurrences: number;
  observedFrequency: number;
  drawIds: string[];
  lotteryCodes: string[];
}

export interface SuffixFrequencyDimensionalAnalysisReport {
  id: string; // Deterministic: `analysis_suffix_${scopeHash}_len${suffixLength}`
  population: AnalysisPopulationScope;
  suffixLength: number;
  totalNumbersAnalyzed: number;
  distinctSuffixesCount: number;
  topSuffixes: SuffixFrequencyProfileItem[];
}

// ============================================================================
// 10. Cross-Draw Comparison
// ============================================================================

export interface CrossDrawMetricRow {
  drawId: string;
  drawNumber: string;
  lotteryCode: string;
  drawDate: string;
  documentSha256: string;
  totalResults: number;
  fullTicketCount: number;
  suffixCount: number;
  distinctSeriesCount: number;
  lastDigitCounts: Record<string, number>;
  leadingZeroCount: number;
}

export interface RepeatedNumberAcrossDraws {
  canonicalNumber: string;
  occurrences: number;
  draws: Array<{
    drawId: string;
    drawNumber: string;
    lotteryCode: string;
    drawDate: string;
    prizeTierName: string;
    series?: string;
  }>;
}

export interface CrossDrawComparisonReport {
  id: string; // Deterministic: `compare_draws_${scopeHash}`
  population: AnalysisPopulationScope;
  comparedDrawCount: number;
  drawRows: CrossDrawMetricRow[];
  repeatedNumbersAcrossDraws: RepeatedNumberAcrossDraws[];
  crossDrawConsistencySummary: {
    averageResultsPerDraw: number;
    standardDeviationResults: number;
    identicalNumberOverlapCount: number;
  };
}

// ============================================================================
// 11. Cross-Lottery Comparison
// ============================================================================

export interface CrossLotteryMetricRow {
  lotteryCode: string;
  lotteryName: string;
  drawCount: number;
  totalResults: number;
  avgResultsPerDraw: number;
  fullTicketProportion: number;
  suffixProportion: number;
  distinctSeriesCount: number;
  prizeTierCount: number;
  lastDigitDistribution: Record<string, number>;
}

export interface CrossLotteryComparisonReport {
  id: string; // Deterministic: `compare_lotteries_${scopeHash}`
  population: AnalysisPopulationScope;
  comparedLotteryCount: number;
  lotteryRows: CrossLotteryMetricRow[];
  lotteryComparisonSummary: {
    mostFrequentSeriesPerLottery: Record<string, string>;
    resultStructureVariationDescription: string;
  };
}

// ============================================================================
// Population Level Comparison (ALL LOTTERIES vs ONE LOTTERY vs ONE DRAW)
// ============================================================================

export interface PopulationLevelComparisonItem {
  level: AnalysisTargetLevel;
  label: string;
  lotteryCode: string;
  drawId?: string;
  drawCount: number;
  totalResults: number;
  fullTicketCount: number;
  suffixCount: number;
  distinctSeriesCount: number;
  lastDigitDistribution: Record<string, number>;
}

export interface PopulationLevelComparisonReport {
  id: string; // Deterministic: `compare_levels_${scopeHash}`
  allLotteriesSummary: PopulationLevelComparisonItem;
  singleLotterySummary: PopulationLevelComparisonItem;
  singleDrawSummary: PopulationLevelComparisonItem;
}

// ============================================================================
// Comprehensive Historical Analysis Suite
// ============================================================================

export interface HistoricalAnalysisSuite {
  id: string; // Deterministic: `analysis_suite_${scopeHash}`
  scopeHash: string;
  analysisVersion: string;
  computedAt: string;
  corpusId: string;
  corpusHash: string;
  population: AnalysisPopulationScope;
  lotteryAnalysis: LotteryDimensionalAnalysisReport;
  drawAnalysis: DrawDimensionalAnalysisReport;
  prizeTierAnalysis: PrizeTierDimensionalAnalysisReport;
  resultTypeAnalysis: ResultTypeDimensionalAnalysisReport;
  seriesAnalysis: SeriesDimensionalAnalysisReport;
  lastDigitAnalysis: LastDigitDimensionalAnalysisReport;
  digitPositionAnalysis: Record<number, DigitPositionDimensionalAnalysisReport>; // Keyed by number length (4, 6)
  numberFrequencyAnalysis: NumberFrequencyDimensionalAnalysisReport;
  suffixFrequencyAnalysis: Record<number, SuffixFrequencyDimensionalAnalysisReport>; // Keyed by suffix length (2, 3, 4)
  crossDrawComparison: CrossDrawComparisonReport;
  crossLotteryComparison: CrossLotteryComparisonReport;
  levelComparison: PopulationLevelComparisonReport;
  provenanceSummary: AnalysisProvenanceSummary;
  descriptiveLimitations: string[];
}
