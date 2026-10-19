/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 5E: Experimental Validation & Robustness Contracts
 *
 * Defines the canonical contracts for evaluating the stability and sensitivity
 * of historical statistical observations under explicitly defined variations in
 * population boundaries, baseline models, and experimental configurations.
 *
 * Strict Invariants:
 * - Purely descriptive historical robustness (OBSERVED HISTORICAL DATA ONLY).
 * - Strictly NO prediction, betting strategies, lucky numbers, or future probability.
 * - Explicit population variants (never silently merge or fabricate populations).
 * - Preservation of string numbers with leading zeros intact.
 * - Effect size quantification (Cramér's V for Chi-Square goodness-of-fit).
 * - Transparent multiple-comparison handling (Bonferroni correction).
 * - Small-sample safety guards (reject or flag insufficient sample sizes).
 * - Full provenance from robustness report back to source PDFs and SHA-256s.
 */

import type {
  ExperimentDefinition,
  ExperimentResult,
  ExperimentPopulationCriteria,
  ExperimentBaselineDefinition,
  ExperimentTestConfiguration
} from "./experiment-types";
import type { ResultProvenanceRecord } from "./historical-analysis-types";

export const DEFAULT_ROBUSTNESS_VERSION = "v1.0.0-experimental-robustness";

export const HISTORICAL_ROBUSTNESS_DISCLAIMER =
  "HISTORICAL_ROBUSTNESS_EVALUATION: Evaluates stability of historical statistical observations across " +
  "explicitly partitioned sub-populations, alternative baselines, and test configurations. " +
  "Strictly descriptive of observed historical publications only; does NOT predict, forecast, or optimize future lottery results.";

// ============================================================================
// Variant Definitions
// ============================================================================

export type RobustnessVariantDimension =
  | "POPULATION_LOTTERY"       // Partitioning by lottery game (e.g. DHANALEKSHMI, BHAGYATHARA)
  | "POPULATION_DRAW"          // Partitioning by individual draws
  | "POPULATION_PRIZE_TIER"    // Partitioning by prize tier rank
  | "POPULATION_RESULT_TYPE"   // Partitioning by FULL_TICKET vs SUFFIX
  | "POPULATION_CORPUS_SCOPE"  // ALL_LOTTERIES vs sub-corpora
  | "BASELINE_MODEL"           // DISCRETE_UNIFORM vs EMPIRICAL_REFERENCE
  | "SIGNIFICANCE_THRESHOLD";  // Varying alpha levels

export interface RobustnessVariantDefinition {
  variantId: string;
  label: string;
  description: string;
  dimension: RobustnessVariantDimension;
  populationCriteriaOverride?: Partial<ExperimentPopulationCriteria>;
  baselineOverride?: Partial<ExperimentBaselineDefinition>;
  configurationOverride?: Partial<ExperimentTestConfiguration>;
}

// ============================================================================
// Effect Size & Sensitivity Metrics
// ============================================================================

export type EffectSizeMagnitude = "NEGLIGIBLE" | "SMALL" | "MEDIUM" | "LARGE";

export interface EffectSizeMetrics {
  name: "CRAMERS_V";
  value: number; // sqrt(chiSquare / (N * (k - 1)))
  magnitude: EffectSizeMagnitude;
  formula: string; // "V = sqrt(chi2 / (N * (k - 1)))"
  assumptions: string[];
}

export interface RobustnessSensitivityMetric {
  variantId: string;
  label: string;
  dimension: RobustnessVariantDimension;
  sampleSize: number;
  observedStatistic: number;
  expectedStatistic: number;
  difference: number;
  degreesOfFreedom: number;
  unadjustedSignificanceLevel: number;
  adjustedSignificanceLevel: number;
  criticalValue: number;
  adjustedCriticalValue: number;
  rejectsNullUnadjusted: boolean;
  rejectsNullAdjusted: boolean;
  effectSize: EffectSizeMetrics;
  status: "COMPLETED" | "INSUFFICIENT_SAMPLE" | "ASSUMPTION_VIOLATED" | "VALIDATION_FAILED";
  assumptionsMet: {
    minExpectedCountMet: boolean;
    sampleSizeAdequate: boolean;
    reason?: string;
  };
  uncertainty?: {
    standardErrorEstimated?: number;
    notes: string;
  };
  resultSummary: string;
}

// ============================================================================
// Robustness Classification & Assessment
// ============================================================================

export type RobustnessClassification =
  | "HIGHLY_ROBUST"                 // Finding persists across >= stabilityThreshold (e.g. 80%) of valid variants
  | "MODERATELY_ROBUST"             // Finding persists across 50% - 80% of valid variants
  | "SENSITIVE_TO_SUBGROUP"         // Finding holds only in specific lotteries/tiers (< 50% concordance)
  | "INCONCLUSIVE_INSUFFICIENT_POWER"; // Too many variants violated minimum sample requirements

export interface RobustnessEvaluationSummary {
  classification: RobustnessClassification;
  totalVariantsEvaluated: number;
  validVariantsCount: number;
  insufficientSampleVariantsCount: number;
  concordantVariantsCount: number; // Variants sharing baseline statistical conclusion (e.g. reject vs fail-to-reject)
  discordantVariantsCount: number;
  concordanceRatio: number; // concordantVariantsCount / validVariantsCount
  stabilityThreshold: number; // Default 0.80
  effectSizeStability: {
    baselineEffectSize: number;
    minVariantEffectSize: number;
    maxVariantEffectSize: number;
    meanVariantEffectSize: number;
    isStable: boolean;
  };
  robustnessCriteriaDescription: string;
  conclusion: string;
  recommendationsForResearchers: string[];
}

// ============================================================================
// Robustness Configuration & Definition
// ============================================================================

export type MultipleComparisonCorrectionMethod = "NONE" | "BONFERRONI";

export interface RobustnessConfiguration {
  correctionMethod: MultipleComparisonCorrectionMethod;
  stabilityThreshold: number; // Default 0.80 (80% concordance)
  minSamplePerVariant: number; // Default 50
  minExpectedCountPerCategory: number; // Default 5
}

export interface RobustnessDefinition {
  id: string; // Deterministic: `rob_${definitionHash}`
  robustnessId: string; // Alias matching id
  version: string;
  sourceExperimentId: string;
  sourceExperimentDefinition: ExperimentDefinition;
  researchQuestion: string;
  hypothesis: string;
  variants: RobustnessVariantDefinition[];
  configuration: RobustnessConfiguration;
  descriptiveOnly: true;
}

// ============================================================================
// Robustness Report
// ============================================================================

export interface RobustnessReport {
  id: string; // Deterministic: `rob_rep_${reportHash}`
  robustnessId: string;
  sourceExperimentId: string;
  sourceExperimentResultId: string;
  frameworkVersion: string;
  evaluatedAt: string;
  status: "COMPLETED" | "PARTIAL" | "FAILED";
  numberOfComparisons: number;
  comparisonMethod: string;
  correctionMethod: MultipleComparisonCorrectionMethod;
  baselineEvaluation: {
    populationScope: ExperimentResult["populationScope"];
    observedStatistic: number;
    degreesOfFreedom: number;
    criticalValue: number;
    rejectsNullHypothesis: boolean;
    effectSize: EffectSizeMetrics;
    sampleSize: number;
  };
  variantEvaluations: RobustnessSensitivityMetric[];
  evaluationSummary: RobustnessEvaluationSummary;
  limitations: string[];
  provenanceSummary: {
    totalResultsTracked: number;
    totalDrawsTracked: number;
    documentSha256s: string[];
    sampleProvenance?: ResultProvenanceRecord[];
    variantDocumentShaMap: Record<string, string[]>;
  };
  deterministicHash: string;
  descriptiveOnly: true;
}

// ============================================================================
// Repository Record Contract
// ============================================================================

export interface HistoricalRobustnessRecord {
  id: string; // robustnessId
  robustnessId: string;
  definition: RobustnessDefinition;
  report: RobustnessReport;
  createdAt: string;
}
