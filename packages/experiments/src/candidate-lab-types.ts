/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone V1.0 Final: Multi-Candidate Comparison & Historical Backtesting Lab Types
 *
 * Provides domain contracts and analytical types for:
 * - Multi-candidate ticket entry (bounded 2 to 10 candidates)
 * - Candidate structural validation and duplicate detection
 * - Side-by-side mathematical feature profiling
 * - Retrospective historical corpus comparison (frequency, percentile, suffixes, exact matches)
 * - Series-level historical comparison with mandatory exposure unavailable disclaimer
 * - Strict walk-forward chronological backtesting with zero temporal data leakage
 * - Temporal stability classification (HISTORICALLY STABLE, HISTORICALLY VARIABLE, NOVEL)
 * - Descriptive trade-off analysis matrix without predictive/betting scoring
 * - Deterministic provenance and SHA-256 fingerprinting
 *
 * STRICT NON-NEGOTIABLE INVARIANT:
 * Purely descriptive and retrospective empirical analysis.
 * Zero prediction, winning probabilities, betting advice, or optimal ticket selection.
 */

import {
  type TicketValidationResult,
  type TicketFeatureProfile,
  type HistoricalMatchItem,
  type ResearchDescriptiveClassification
} from "./research-sandbox-types";

export type CandidateStabilityClassification =
  | "HISTORICALLY STABLE"
  | "HISTORICALLY VARIABLE"
  | "NOVEL";

export interface CandidateLabTicketInput {
  id?: string; // Optional user label, defaults to "A", "B", "C", etc.
  lotteryCode: string;
  schemeVersionId?: string;
  series: string;
  ticketNumber: string;
  userLabel?: string;
}

export interface CandidateLabRequest {
  candidates: CandidateLabTicketInput[];
  temporalCutoffDate?: string; // Optional global cutoff date (ISO YYYY-MM-DD)
  backtestWindows?: number; // Number of chronological backtest checkpoints (default: 4)
}

export interface CandidateValidationSummary {
  candidateId: string;
  label: string;
  input: CandidateLabTicketInput;
  validation: TicketValidationResult;
  isDuplicate: boolean;
  duplicateOf?: string; // Candidate ID of earlier identical ticket
}

export interface CandidateFeatureItem {
  candidateId: string;
  label: string;
  lotteryCode: string;
  series: string;
  canonicalNumber: string;
  profile?: TicketFeatureProfile;
}

export interface CandidateHistoricalItem {
  candidateId: string;
  label: string;
  lotteryCode: string;
  series: string;
  canonicalNumber: string;
  exactMatch: {
    observedInCorpus: boolean;
    matchCount: number;
    matches: HistoricalMatchItem[];
  };
  terminalDigit: {
    digit: string;
    observedCount: number;
    empiricalFrequency: number;
    wilsonConfidenceInterval95: [number, number];
    relativeCommonness: "RELATIVELY_COMMON" | "RELATIVELY_UNCOMMON" | "NEAR_EXPECTED";
  };
  firstDigit: {
    digit: string;
    observedCount: number;
    empiricalFrequency: number;
    wilsonConfidenceInterval95: [number, number];
    relativeCommonness: "RELATIVELY_COMMON" | "RELATIVELY_UNCOMMON" | "NEAR_EXPECTED";
  };
  suffix2: {
    suffix: string;
    observedCount: number;
    empiricalFrequency: number;
  };
  suffix3: {
    suffix: string;
    observedCount: number;
    empiricalFrequency: number;
  };
  suffix4: {
    suffix: string;
    observedCount: number;
    empiricalFrequency: number;
  };
  digitSum: {
    sum: number;
    empiricalPercentile: number;
    rarityClassification: "COMMON" | "MODERATE" | "RARE";
  };
  empiricalClassifications: ResearchDescriptiveClassification[];
}

export interface SeriesComparisonItem {
  series: string;
  associatedCandidateIds: string[];
  candidateCount: number;
  observedCorpusCount: number;
  distinctDrawsCount: number;
  majorPrizeWinnerCount: number;
  empiricalFrequency: number;
  firstObservedDate?: string;
  lastObservedDate?: string;
  exposureStatus: "EXPOSURE_UNAVAILABLE";
  disclaimer: string;
}

export interface SeriesComparisonResult {
  seriesItems: SeriesComparisonItem[];
  totalUniqueSeriesInSet: number;
  criticalExposureNotice: string;
}

export interface BacktestWindowDefinition {
  windowIndex: number;
  windowName: string;
  cutoffDate: string; // ISO date YYYY-MM-DD
  cutoffDrawId: string;
  drawCount: number;
  resultCount: number;
}

export interface CandidateWindowMetric {
  windowIndex: number;
  cutoffDate: string;
  sampleSizeDraws: number;
  sampleSizeResults: number;
  terminalDigitFrequency: number;
  suffix2Frequency: number;
  suffix3Frequency: number;
  cumulativeExactMatches: number;
  digitSumPercentile: number;
}

export interface CandidateBacktestResult {
  candidateId: string;
  label: string;
  series: string;
  canonicalNumber: string;
  windowMetrics: CandidateWindowMetric[];
  stabilityClassification: CandidateStabilityClassification;
  metricVariance: number;
  descriptiveTrend: string;
}

export interface CandidateTradeOffItem {
  candidateId: string;
  label: string;
  series: string;
  ticketNumber: string;
  parityBalance: string;
  digitSum: number;
  digitSumPercentile: number;
  terminalDigitFreqPercent: number;
  suffix2FreqPercent: number;
  suffix3FreqPercent: number;
  seriesObservedCount: number;
  exactHistoricalMatches: number;
  stability: CandidateStabilityClassification;
  descriptiveCharacteristics: string[];
  descriptiveConsiderations: string[];
}

export interface CandidateLabAnalysis {
  analysisId: string;
  analysisTimestamp: string;
  deterministicHash: string;
  candidateCount: number;
  hasDuplicates: boolean;
  duplicateCount: number;
  validationSummaries: CandidateValidationSummary[];
  featureProfiles: CandidateFeatureItem[];
  historicalComparisons: CandidateHistoricalItem[];
  seriesComparison: SeriesComparisonResult;
  backtestResults: {
    windows: BacktestWindowDefinition[];
    candidateResults: CandidateBacktestResult[];
    temporalLeakageAssertionPassed: boolean;
  };
  tradeOffAnalysis: {
    comparisonMatrix: CandidateTradeOffItem[];
    nonPredictiveNotice: string;
  };
  researchInterpretation: {
    summary: string;
    candidateInterpretations: Array<{
      candidateId: string;
      label: string;
      classifications: string[];
      descriptiveText: string;
    }>;
    globalNotice: string;
  };
  limitations: {
    nonPredictiveDisclaimer: string;
    seriesExposureDisclaimer: string;
    districtExposureDisclaimer: string;
    statisticalCaveats: string[];
  };
  provenance: {
    corpusVersion: string;
    featureVersion: string;
    datasetVersion: string;
    experimentVersion: string;
    validationVersion: string;
    candidateSetVersion: string;
    geographicVersion: string;
    auditSha256: string;
  };
}
