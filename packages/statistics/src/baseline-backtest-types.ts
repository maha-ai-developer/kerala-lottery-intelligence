/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 7B: Baseline Models & Historical Backtesting Contracts
 *
 * Defines deterministic, versioned, provenance-preserving contracts for:
 * - BaselineModel interface (UniformBaseline, EmpiricalBaseline, MajorityBaseline)
 * - BaselineModelMetadata & Model Parameters
 * - Probability Representation & Zero-Probability Numerical Smoothing Policies
 * - Tie-Breaking Strategy ("LEXICOGRAPHICAL_ASCENDING")
 * - Chronological Holdout & Walk-Forward Backtest Results
 * - WalkForwardAggregateResult
 * - BaselineComparisonReport
 * - Leakage Audit Result
 *
 * Strict Scientific Boundary:
 * - HISTORICAL BENCHMARKING ONLY.
 * - ZERO predictive claims, gambling optimization, betting advice, or lucky numbers.
 * - Descriptive historical research distinguishing OBSERVATION, BASELINE,
 *   BACKTEST RESULT, and INTERPRETATION.
 */

import type {
  TargetDefinition,
  ModelingDatasetRow,
  ConfusionMatrix,
  ModelEvaluation,
  ModelPrediction,
  HistoricalModel
} from "./modeling-types";

export const DEFAULT_BASELINE_BACKTEST_VERSION = "v1.0.0-baseline-backtest";

export const BASELINE_BACKTEST_DISCLAIMER =
  "SCIENTIFIC BENCHMARKING NOTICE: This historical backtesting framework evaluates deterministic baseline reference models over historical Kerala lottery records for descriptive research only. It contains NO winning-number predictions, betting advice, gambling strategy, or future probability claims. Backtest metrics reflect observed historical patterns only. Past historical draw distributions do not predict future lottery outcomes.";

export const ZERO_PROBABILITY_POLICY = "CLIPPED_EPSILON_1E_15" as const;
export const EPSILON_LOG_LOSS = 1e-15;

export const TIE_BREAKING_STRATEGY = "LEXICOGRAPHICAL_ASCENDING" as const;
export type TieBreakingStrategy = typeof TIE_BREAKING_STRATEGY;

// ============================================================================
// 1. Baseline Model Types & Metadata
// ============================================================================

export type BaselineModelType = "UNIFORM" | "EMPIRICAL" | "MAJORITY";

export interface BaselineModelParameters {
  modelType: BaselineModelType;
  allowedValues: string[];
  kClasses: number;
  tieBreakingStrategy: TieBreakingStrategy;
  zeroProbabilityPolicy: typeof ZERO_PROBABILITY_POLICY;
  epsilon: number;
  fittedClassFrequencies?: Record<string, number>;
  majorityClass?: string;
  trainingRowCount?: number;
}

export interface BaselineModelMetadata {
  modelId: string; // Deterministic: `mdef_baseline_${type.toLowerCase()}_${hash}`
  modelName: string;
  modelType: BaselineModelType;
  modelVersion: string;
  targetId: string;
  targetName: string;
  parameters: BaselineModelParameters;
  isFitted: boolean;
  deterministicHash: string;
  descriptiveOnly: true;
}

// ============================================================================
// 2. Baseline Model Abstraction
// ============================================================================

export interface BaselineModel extends HistoricalModel {
  readonly modelType: BaselineModelType;
  readonly metadata: BaselineModelMetadata;

  /**
   * Fits the baseline model using TRAINING data only.
   * Never inspects test rows or future data.
   */
  fit(trainRows: ModelingDatasetRow[], targetDef?: TargetDefinition | string, allowedValues?: string[]): void;

  /**
   * Predicts class labels for test rows deterministically.
   */
  predictClasses(testRows: ModelingDatasetRow[]): string[];

  /**
   * Predicts probability distributions over all allowed target classes for test rows.
   * Guarantees each probability vector sums to 1.0.
   */
  predictProbabilities(testRows: ModelingDatasetRow[]): Array<Record<string, number>>;

  /**
   * Returns complete ModelPrediction records for test rows.
   */
  predict(testRows: ModelingDatasetRow[]): ModelPrediction[];

  /**
   * Evaluates predictions against test rows, returning ModelEvaluation.
   */
  evaluate(testRows: ModelingDatasetRow[], predictions?: ModelPrediction[]): ModelEvaluation;

  /**
   * Returns a serializable snapshot of the fitted model state.
   */
  getFittedState(): Record<string, unknown>;
}

// ============================================================================
// 3. Class Distribution Record
// ============================================================================

export interface ClassDistributionRecord {
  counts: Record<string, number>;
  proportions: Record<string, number>;
  total: number;
}

// ============================================================================
// 4. Backtest Result Schema (Milestone 7B.6)
// ============================================================================

export type BacktestEvaluationMethod = "CHRONOLOGICAL_HOLDOUT" | "WALK_FORWARD";

export interface BaselineBacktestResult {
  resultId: string; // Deterministic: `bktr_${hash}`
  experimentId: string; // Deterministic: `exp_bkt_${hash}`
  experimentVersion: string;
  datasetId: string;
  modelId: string;
  modelVersion: string;
  modelType: BaselineModelType;
  target: string; // e.g. "observed_last_digit"
  targetId: string;
  evaluationMethod: BacktestEvaluationMethod;
  windowId?: string; // e.g. "window_1", "holdout"
  windowIndex?: number; // 1-based index for walk-forward
  trainRowCount: number;
  testRowCount: number;
  trainDateRange: {
    earliest: string;
    latest: string;
    earliestIso: string;
    latestIso: string;
  };
  testDateRange: {
    earliest: string;
    latest: string;
    earliestIso: string;
    latestIso: string;
  };
  trainDrawIds: string[];
  testDrawIds: string[];
  accuracy: number;
  balancedAccuracy: number;
  logLoss: number | null;
  confusionMatrix: ConfusionMatrix;
  trainClassDistribution: ClassDistributionRecord;
  testClassDistribution: ClassDistributionRecord;
  probabilitiesSumToOne: boolean;
  deterministicHash: string;
  createdAt: string;
  provenance: string;
  limitations: string[];
  descriptiveOnly: true;
  notice: string;
}

// ============================================================================
// 5. Walk-Forward Aggregate Result
// ============================================================================

export interface WalkForwardAggregateResult {
  aggregateId: string; // Deterministic: `wfagg_${hash}`
  experimentId: string;
  experimentVersion: string;
  datasetId: string;
  modelId: string;
  modelVersion: string;
  modelType: BaselineModelType;
  target: string;
  targetId: string;
  evaluationMethod: "WALK_FORWARD";
  totalWindows: number;
  windows: BaselineBacktestResult[];
  meanAccuracy: number;
  meanBalancedAccuracy: number;
  meanLogLoss: number | null;
  accuracyStdDev: number;
  balancedAccuracyStdDev: number;
  deterministicHash: string;
  createdAt: string;
  provenance: string;
  limitations: string[];
  descriptiveOnly: true;
  notice: string;
}

// ============================================================================
// 6. Baseline Comparison Report (Milestone 7B.7)
// ============================================================================

export interface BaselineComparisonSummaryRow {
  target: string;
  model: string;
  modelType: BaselineModelType;
  evaluationMethod: BacktestEvaluationMethod;
  trainSize: number;
  testSize: number;
  accuracy: number;
  balancedAccuracy: number;
  logLoss: number | null;
}

export interface BaselineWindowDetailRow {
  target: string;
  model: string;
  modelType: BaselineModelType;
  windowIndex: number;
  trainDrawsCount: number;
  trainSize: number;
  testSize: number;
  testDate: string;
  accuracy: number;
  balancedAccuracy: number;
  logLoss: number | null;
}

export interface BaselineComparisonReport {
  reportId: string; // Deterministic: `bcp_rep_${hash}`
  datasetId: string;
  datasetTotalRows: number;
  modelingVersion: string;
  generatedAt: string;
  holdoutResults: BaselineBacktestResult[];
  walkForwardAggregates: WalkForwardAggregateResult[];
  summaryTable: BaselineComparisonSummaryRow[];
  windowBreakdownTable: BaselineWindowDetailRow[];
  deterministicHash: string;
  descriptiveOnly: true;
  disclaimer: string;
}

// ============================================================================
// 7. Leakage Audit Contracts (Milestone 7B.8)
// ============================================================================

export interface BaselineLeakageAuditResult {
  passed: boolean;
  testLabelsNeverUsedInFitting: boolean;
  empiricalFrequenciesFromTrainOnly: boolean;
  majorityClassFromTrainOnly: boolean;
  chronologicalOrderingPreserved: boolean;
  futureRowCannotInfluenceEarlierWindow: boolean;
  targetColumnsNotInModelInputs: boolean;
  sourceIdentifiersNotPredictive: boolean;
  repeatedExecutionIdentical: boolean;
  issues: string[];
}
