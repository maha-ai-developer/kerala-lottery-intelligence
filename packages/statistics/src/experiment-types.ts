/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 5D: Statistical Experiment Framework Contracts
 *
 * Defines the canonical contracts for defining, configuring, executing,
 * and interpreting deterministic statistical hypothesis experiments over
 * validated historical lottery observations.
 *
 * Strict Invariants:
 * - Purely descriptive statistical tests (OBSERVED HISTORICAL DATA ONLY).
 * - Strictly NO prediction, betting strategies, lucky numbers, or future probability.
 * - Separation of ExperimentDefinition from ExperimentResult.
 * - Explicit, immutable population boundaries (no silent merging).
 * - Preservation of string numbers with leading zeros intact.
 * - Deterministic experiment IDs and reproducible results.
 * - Full provenance from experiment back to PDF and SHA-256.
 */

import type { ResultProvenanceRecord } from "./historical-analysis-types";
import type { ResultTypeFilter } from "./statistical-types";

export const DEFAULT_EXPERIMENT_VERSION = "v1.0.0-historical-experiment";

export const HISTORICAL_EXPERIMENT_DISCLAIMER =
  "HISTORICAL_EXPERIMENT: Formal statistical hypothesis test evaluated strictly on historical observations. " +
  "Descriptive of observed publications only; does NOT predict, forecast, or optimize future lottery results.";

// ============================================================================
// Experiment Definitions & Types
// ============================================================================

export type StatisticalTestType = "CHI_SQUARE_GOODNESS_OF_FIT";

export type ExperimentBaselineType = "DISCRETE_UNIFORM" | "EMPIRICAL_REFERENCE";

export type ExperimentTargetMetric =
  | "LAST_DIGIT_DISTRIBUTION"
  | "DIGIT_POSITION_DISTRIBUTION"
  | "SERIES_DISTRIBUTION";

export interface ExperimentPopulationCriteria {
  lotteryCode?: string; // Specific lottery or undefined/"ALL_LOTTERIES"
  drawId?: string;
  drawIds?: string[];
  prizeTierId?: string;
  prizeTierRank?: number;
  resultType?: ResultTypeFilter; // "ALL" | "FULL_TICKET" | "SUFFIX"
  numberLength?: number;
}

export interface ResolvedExperimentPopulation {
  populationHash: string;
  lotteryCode: string;
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
  sampleSize: number;
  observedItems: Array<{
    resultId: string;
    canonicalNumber: string;
    extractedValue: string; // The specific value being tested (e.g. last digit "8" or series "KA")
    isSuffix: boolean;
    rank: number;
    drawId: string;
    documentSha256: string;
  }>;
}

export interface ExperimentBaselineDefinition {
  type: ExperimentBaselineType;
  description: string;
  categories: string[];
  expectedProportions: Record<string, number>;
}

export interface ExperimentTestConfiguration {
  testType: StatisticalTestType;
  significanceLevel: number; // e.g. 0.05
  minExpectedCountPerCategory: number; // Standard chi-square requirement: >= 5
  targetMetric: ExperimentTargetMetric;
  positionIndex?: number; // 1-indexed from left when targetMetric is DIGIT_POSITION_DISTRIBUTION
}

export interface ExperimentDefinition {
  id: string; // Deterministic: `exp_${definitionHash}`
  experimentId: string; // Alias matching id
  version: string;
  experimentVersion: string; // Alias matching version
  researchQuestion: string;
  hypothesis: string;
  nullHypothesis: string;
  alternativeHypothesis: string;
  populationCriteria: ExperimentPopulationCriteria;
  populationScope?: Partial<ResolvedExperimentPopulation>;
  targetMetric: ExperimentTargetMetric;
  baseline: ExperimentBaselineDefinition;
  configuration: ExperimentTestConfiguration;
  statisticDefinition: ExperimentTestConfiguration; // Alias matching configuration
  descriptiveOnly: true;
  sourceAnalysisVersion: string;
}

// ============================================================================
// Experiment Results
// ============================================================================

export interface CategoryTestDetail {
  category: string;
  observedCount: number;
  observedProportion: number;
  expectedCount: number;
  expectedProportion: number;
  difference: number; // observedCount - expectedCount
  contributionToStatistic: number; // (O - E)^2 / E
}

export interface ExperimentStatisticalTestResult {
  testType: StatisticalTestType;
  testStatisticName: string;
  observedStatistic: number;
  degreesOfFreedom: number;
  significanceLevel: number;
  criticalValue: number;
  rejectsNullHypothesis: boolean;
  assumptionsMet: {
    minExpectedCountMet: boolean;
    sampleSizeAdequate: boolean;
  };
}

export interface ExperimentResult {
  id: string; // Deterministic: `exp_res_${resultHash}`
  experimentId: string;
  executionVersion: string;
  executedAt: string;
  status: "COMPLETED" | "VALIDATION_FAILED" | "INSUFFICIENT_SAMPLE";
  observedStatistic: number;
  expectedStatistic: number;
  difference: number;
  sampleSize: number;
  descriptiveOnly: true;
  populationScope: {
    populationHash: string;
    lotteryCode: string;
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
    sampleSize: number;
  };
  baseline: {
    type: ExperimentBaselineType;
    description: string;
    categoryCount: number;
  };
  baselineMetadata: {
    type: ExperimentBaselineType;
    description: string;
    categoryCount: number;
    categories: string[];
  };
  testMetadata: {
    testType: StatisticalTestType;
    testStatisticName: string;
    degreesOfFreedom: number;
    significanceLevel: number;
    criticalValue: number;
    rejectsNullHypothesis: boolean;
    assumptionsMet: {
      minExpectedCountMet: boolean;
      sampleSizeAdequate: boolean;
    };
  };
  statisticalTest: ExperimentStatisticalTestResult;
  categoryDetails: CategoryTestDetail[];
  interpretation: string;
  limitations: string[];
  provenanceSummary: {
    totalResultsTracked: number;
    totalDrawsTracked: number;
    documentSha256s: string[];
    sampleProvenance: ResultProvenanceRecord[];
  };
}

// ============================================================================
// Experiment Repository Record
// ============================================================================

export interface HistoricalExperimentRecord {
  id: string; // experimentId
  experimentId: string;
  definition: ExperimentDefinition;
  result: ExperimentResult;
  createdAt: string;
}

