/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 5A: Historical Statistical Foundation Types
 *
 * Defines the canonical contracts for deterministic historical statistical summaries
 * built upon validated lottery entities and the knowledge graph.
 *
 * Invariants:
 * - Purely descriptive historical observations (OBSERVED DATA + STATISTICAL SUMMARY).
 * - Strictly NO prediction, recommendation, lucky numbers, betting advice, or ML inference.
 * - Explicit population identification and filter scoping on every statistical record.
 * - String preservation of lottery numbers with exact leading zeros preserved.
 * - Strict full-ticket vs suffix separation (no synthetic series for suffix results).
 * - Deterministic computation and versioning.
 */

export const DEFAULT_STATISTICAL_VERSION = "v1.0.0-historical-statistics";

export type ResultTypeFilter = "ALL" | "FULL_TICKET" | "SUFFIX";

// ============================================================================
// Population & Filter Scope
// ============================================================================

export interface StatisticalFilterCriteria {
  lotteryId?: string;
  lotteryCode?: string;
  prizeTierId?: string;
  prizeTierRank?: number;
  resultType?: ResultTypeFilter;
  dateRange?: {
    startDate?: string; // YYYY-MM-DD
    endDate?: string;   // YYYY-MM-DD
  };
  numberLength?: number;
}

export interface StatisticalPopulationScope {
  documentIds: string[];
  drawIds: string[];
  drawCount: number;
  lotteryId?: string;
  lotteryCode?: string;
  prizeTierId?: string;
  prizeTierRank?: number;
  resultType: ResultTypeFilter;
  numberLength?: number;
  dateRange?: {
    startDate?: string;
    endDate?: string;
  };
  statisticalVersion: string;
  computedAt: string;
  isSingleDrawObservation: boolean;
  datasetSizeLimitationNotice: string;
}

// ============================================================================
// Statistical Observation Contracts
// ============================================================================

export interface NumberFrequencyItem {
  canonicalNumber: string; // Exact string with preserved leading zero (e.g. "0259")
  numberLength: number;
  observedOccurrences: number;
  observedFrequency: number; // Proportion of total observed results (0.0 to 1.0)
  sourceResultIds: string[];
  sourceDrawIds: string[];
  sourceDocumentSha256s: string[];
}

export interface NumberFrequencyReport {
  id: string; // Deterministic: `num_freq_${scopeHash}`
  population: StatisticalPopulationScope;
  totalObservedResults: number;
  distinctNumbersCount: number;
  items: NumberFrequencyItem[]; // Deterministically sorted: frequency DESC, then canonicalNumber ASC
}

export interface SeriesFrequencyItem {
  seriesCode: string; // e.g. "DW", "DO"
  observedOccurrences: number;
  observedFrequency: number; // Proportion of full-ticket results (0.0 to 1.0)
  sourceResultIds: string[];
  sourceDrawIds: string[];
}

export interface SeriesFrequencyReport {
  id: string; // Deterministic: `series_freq_${scopeHash}`
  population: StatisticalPopulationScope;
  totalFullTicketResults: number;
  distinctSeriesCount: number;
  items: SeriesFrequencyItem[]; // Deterministically sorted: frequency DESC, then seriesCode ASC
}

export interface DigitDistributionItem {
  digit: string; // "0" through "9"
  observedOccurrences: number;
  observedProportion: number; // Proportion of analyzed digits (0.0 to 1.0)
}

export interface LastDigitFrequencyReport {
  id: string; // Deterministic: `last_digit_${scopeHash}`
  population: StatisticalPopulationScope;
  totalNumbersAnalyzed: number;
  distribution: DigitDistributionItem[]; // Digits "0" to "9" sorted ascending
}

export interface DigitPositionDistribution {
  position: number; // 1-indexed from left (1 = 1st digit, 2 = 2nd digit...)
  positionFromEnd: number; // 1-indexed from right (1 = last digit, 2 = 2nd from last...)
  totalDigitsAnalyzed: number;
  distribution: DigitDistributionItem[]; // Digits "0" to "9" sorted ascending
}

export interface DigitPositionFrequencyReport {
  id: string; // Deterministic: `pos_digit_${scopeHash}_len${numberLength}`
  population: StatisticalPopulationScope;
  numberLength: number; // Invariant: all numbers analyzed have this exact length
  totalNumbersAnalyzed: number;
  positions: DigitPositionDistribution[];
}

export interface SuffixFrequencyItem {
  suffix: string; // Substring of digits, e.g. "59", "259"
  suffixLength: number;
  observedOccurrences: number;
  observedFrequency: number; // Proportion of analyzed numbers (0.0 to 1.0)
  sourceResultIds: string[];
  sourceDrawIds: string[];
}

export interface SuffixFrequencyReport {
  id: string; // Deterministic: `suffix_freq_${scopeHash}_len${suffixLength}`
  population: StatisticalPopulationScope;
  suffixLength: number;
  totalObservedResults: number;
  distinctSuffixesCount: number;
  items: SuffixFrequencyItem[]; // Deterministically sorted: frequency DESC, then suffix ASC
}

export interface PrizeTierStatisticsItem {
  tierRank: number;
  tierName: string;
  tierType: string;
  amount?: number;
  isSuffix: boolean;
  resultCount: number;
  resultsProportion: number; // resultCount / totalWinningResultsCount
}

export interface PrizeTierStatisticsReport {
  id: string; // Deterministic: `tier_stat_${scopeHash}`
  population: StatisticalPopulationScope;
  totalPrizeTiers: number;
  totalResultsAcrossTiers: number;
  items: PrizeTierStatisticsItem[];
}

export interface DrawSummaryStatistics {
  id: string; // Deterministic: `draw_summary_${scopeHash}`
  population: StatisticalPopulationScope;
  drawCount: number;
  totalPrizeTiersCount: number;
  totalWinningResultsCount: number;
  fullTicketResultsCount: number;
  suffixResultsCount: number;
  datasetSizeLimitationNotice: string;
}

// ============================================================================
// Comprehensive Historical Aggregate
// ============================================================================

export interface HistoricalLotteryStatisticsAggregate {
  id: string; // Deterministic: `stat_agg_${scopeHash}`
  scopeHash: string;
  statisticalVersion: string;
  datasetSizeLimitationNotice: string;
  population: StatisticalPopulationScope;
  drawSummary: DrawSummaryStatistics;
  prizeTierStats: PrizeTierStatisticsReport;
  numberFrequency: NumberFrequencyReport;
  seriesFrequency: SeriesFrequencyReport;
  lastDigitFrequency: LastDigitFrequencyReport;
  digitPositionFrequency: Record<number, DigitPositionFrequencyReport>; // Keyed by number length (e.g. 4, 6)
  suffixFrequency: Record<number, SuffixFrequencyReport>; // Keyed by suffix length (e.g. 2, 3, 4)
  duplicateResultsDetectedCount: number;
  metadata: {
    statisticVersion: string;
    computedAt: string;
  };
}
