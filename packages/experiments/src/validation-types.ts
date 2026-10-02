/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 9C: Scientific Validation & Research Integrity Contracts
 *
 * Defines versioned, deterministic, provenance-preserving contracts for:
 * - Statistical inference (Confidence Intervals, Bootstrap, Permutation tests, Effect sizes, Uncertainty)
 * - Null-model comparisons (Uniform null, Permutation null, Empirical p-values)
 * - Multiple-testing adjustments (Bonferroni, Holm-Bonferroni, Family tracking)
 * - Temporal robustness & walk-forward evaluation (Expanding window, Chronological folds)
 * - 5-Part Research Interpretation Contract (Observation, Evidence, Uncertainty, Interpretation, Limitation)
 * - Immutable Validation Artifact representation
 *
 * Non-Predictive Scientific Boundary:
 * All validation evaluates retrospective statistical properties against pure chance.
 * ZERO predictive claims, gambling advice, or betting recommendations.
 */

import { computeSha256Short } from "./types";

export const DEFAULT_VALIDATION_VERSION = "1.0.0";
export const DEFAULT_VALIDATION_METHOD = "STATISTICAL_INFERENCE_V1";

export const SCIENTIFIC_VALIDATION_DISCLAIMER =
  "SCIENTIFIC RESEARCH INTEGRITY NOTICE: This validation evaluates retrospective statistical robustness, confidence intervals, null-hypothesis significance tests, and multiple-comparison controls strictly for scientific integrity. Physical Kerala State Lottery draws are independent stochastic trials. Past digit distributions possess zero predictive power for future draws. All predictive, gambling, or betting claims are scientifically unfounded.";

// ============================================================================
// 1. Statistical Inference Types
// ============================================================================

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  confidenceLevel: number; // e.g. 0.95
  method: "WILSON_SCORE" | "BOOTSTRAP_PERCENTILE" | "NORMAL_APPROXIMATION" | "STUDENT_T";
}

export interface EffectSizeMetrics {
  cohensH: number; // For proportions: 2 * (arcsin(sqrt(p1)) - arcsin(sqrt(p0)))
  cohensD?: number;
  relativeAccuracyRatio: number; // p_obs / p_null
  absoluteAccuracyDifference: number; // p_obs - p_null
}

export interface UncertaintyMetadata {
  standardError: number;
  sampleSize: number;
  confidenceLevel: number;
  marginOfError: number;
  degreesOfFreedom?: number;
}

export interface BootstrapEstimate {
  iterations: number;
  seed: number;
  mean: number;
  median: number;
  stdError: number;
  confidenceInterval: ConfidenceInterval;
  bias: number;
}

export interface PermutationTestResult {
  iterations: number;
  seed: number;
  observedStatistic: number;
  nullMean: number;
  nullStdDev: number;
  empiricalPValue: number; // (sum(null >= obs) + 1) / (B + 1)
  isSignificantAt05: boolean;
}

// ============================================================================
// 2. Null Model Framework Types
// ============================================================================

export type NullModelType =
  | "DISCRETE_UNIFORM_NULL"
  | "LABEL_PERMUTATION_NULL"
  | "INDEPENDENT_BERNOULLI_NULL";

export interface NullModelDistributionSummary {
  nullModelType: NullModelType;
  iterations: number;
  seed: number;
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  quantiles: {
    p01: number;
    p05: number;
    p25: number;
    p50: number;
    p75: number;
    p95: number;
    p99: number;
  };
  observedValue: number;
  zScore: number;
  empiricalPValue: number;
}

// ============================================================================
// 3. Multiple Comparison Control Types
// ============================================================================

export type MultipleTestingMethod = "BONFERRONI" | "HOLM_BONFERRONI";
export type ExperimentFamilyDesignation = "EXPLORATORY" | "CONFIRMATORY";

export interface MultipleTestingAdjustment {
  familyId: string;
  designation: ExperimentFamilyDesignation;
  method: MultipleTestingMethod;
  baseAlpha: number; // e.g. 0.05
  adjustedAlpha: number; // e.g. 0.05 / m for Bonferroni
  rawPValue: number;
  adjustedPValue: number;
  isSignificant: boolean;
  totalHypothesesInFamily: number;
  rankInFamily: number; // 1-indexed rank sorted by raw p-value
}

// ============================================================================
// 4. Temporal Robustness & Walk-Forward Evaluation
// ============================================================================

export interface WalkForwardWindowResult {
  windowIndex: number;
  trainDrawCount: number;
  testDrawCount: number;
  trainRowCount: number;
  testRowCount: number;
  trainDateRange: { earliestIso: string; latestIso: string };
  testDateRange: { earliestIso: string; latestIso: string };
  accuracy: number;
  logLoss: number;
  zeroLeakageConfirmed: boolean;
}

export interface TemporalRobustnessSummary {
  strategy: "EXPANDING_WINDOW_WALK_FORWARD";
  windowsCount: number;
  windowResults: WalkForwardWindowResult[];
  meanAccuracy: number;
  stdDevAccuracy: number;
  minAccuracy: number;
  maxAccuracy: number;
  stabilityScore: number; // 1 - (stdDev / mean), clamped [0, 1]
  zeroLeakageConfirmed: boolean;
}

// ============================================================================
// 5. Five-Part Research Interpretation Contract
// ============================================================================

export interface ResearchInterpretationContract {
  observation: string;
  statisticalEvidence: {
    pValue: number;
    adjustedPValue: number;
    confidenceInterval: [number, number];
    effectSize: number;
    effectSizeMetric: "COHENS_H" | "RELATIVE_RATIO" | "PERCENTAGE_DIFFERENCE";
    hypothesisTest: string;
  };
  uncertainty: {
    standardError: number;
    sampleSize: number;
    confidenceLevel: number;
    marginOfError: number;
  };
  interpretation: string;
  limitation: string;
}

// ============================================================================
// 6. Result Artifact Representation (9C)
// ============================================================================

export interface StatisticalValidationArtifact {
  validationId: string; // Deterministic: `val_${hash}`
  runId: string; // Deterministic link to 9B ExperimentRun
  experimentId: string;
  experimentVersion: string;
  datasetVersion: string;
  corpusVersion: string;
  validationMethod: string;
  validationVersion: string;
  createdAt: string;

  // 1. Inference metrics
  confidenceIntervals: {
    accuracy: {
      wilsonScoreInterval: ConfidenceInterval;
      bootstrapInterval: ConfidenceInterval;
    };
    logLoss: {
      normalInterval: ConfidenceInterval;
    };
  };
  effectSizes: EffectSizeMetrics;
  uncertainty: UncertaintyMetadata;

  // 2. Null Model comparison
  nullModelComparison: NullModelDistributionSummary;

  // 3. Multiple testing correction
  multipleTestingCorrection: MultipleTestingAdjustment;

  // 4. Temporal robustness (Walk-Forward summary)
  temporalRobustness: TemporalRobustnessSummary;

  // 5. Research interpretation contract
  interpretationContract: ResearchInterpretationContract;

  // Immutability & Provenance
  deterministicHash: string;
  nonPredictiveNotice: string;
  descriptiveOnly: true;
}

/**
 * Derives deterministic validation ID from runId, method, and parameters.
 */
export function deriveValidationArtifactId(params: {
  runId: string;
  validationMethod: string;
  validationVersion: string;
  seed: number;
}): string {
  const hash = computeSha256Short(
    [params.runId, params.validationMethod, params.validationVersion, params.seed.toString()].join("::")
  );
  return `val_${hash}`;
}
