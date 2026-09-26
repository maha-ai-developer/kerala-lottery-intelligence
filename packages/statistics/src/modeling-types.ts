/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 7A: Modeling Foundation Contracts
 *
 * Defines deterministic, provenance-preserving contracts for:
 * - ModelingDataset, ModelingPopulationScope, ModelingDatasetRow
 * - TargetDefinition, TargetValueType
 * - SplitDefinition, DatasetSplit, SplitPartition, TemporalSplitStrategy
 * - LeakageValidationResult (temporal, draw, result, source-doc, target leakage guards)
 * - BaselineDefinition, BaselineType
 * - ModelDefinition, ModelPrediction, ConfusionMatrix, EvaluationMetric, ModelEvaluation
 * - ModelRun, BacktestDefinition, BacktestWindowResult, BacktestResult
 * - HistoricalModel interface
 * - Repository contracts for historical modeling datasets and runs
 *
 * Strict Scientific Boundary:
 * - Milestone 7A is MODELING FOUNDATION only.
 * - ZERO predictive claims, gambling optimization, betting advice, or lucky/hot/cold numbers.
 * - Descriptive and reproducible historical statistical modeling infrastructure only.
 */

export const DEFAULT_MODELING_VERSION = "v1.0.0-modeling-foundation";

export const HISTORICAL_MODELING_DISCLAIMER =
  "NON-PREDICTIVE MODELING FOUNDATION NOTICE: This modeling foundation defines deterministic mathematical contracts, temporal splits, baseline references, and evaluation metrics over historical Kerala lottery records for scientific research and reproducible statistical study only. It contains NO winning-number predictions, betting advice, gambling strategy, or future probability claims. Historical model evaluation measures observed patterns in historical data only.";

// ============================================================================
// 1. Population Scope & Scope Types
// ============================================================================

export type ModelingPopulationScopeType =
  | "ALL_POPULATION"
  | "SIX_DIGIT_FULL_TICKET"
  | "FOUR_DIGIT_SUFFIX"
  | "SINGLE_LOTTERY";

export interface ModelingPopulationScope {
  corpusId?: string;
  sourceFeatureMatrixId: string;
  sourceFeatureEvaluationId: string;
  sourceModelFeatureMatrixId: string;
  totalRows: number;
  fullTicketCount: number;
  suffixCount: number;
  drawIds: string[];
  drawCount: number;
  lotteryCodes: string[];
  documentSha256s: string[];
  dateRange: {
    earliest?: string;
    latest?: string;
    earliestIso?: string;
    latestIso?: string;
  };
  populationScopeType: ModelingPopulationScopeType;
  targetLotteryCode?: string;
  targetNumberLength?: number;
  populationScopeHash: string;
}

// ============================================================================
// 2. Target Definition
// ============================================================================

export type TargetValueType = "CATEGORICAL" | "NUMERIC";

export interface TargetDefinition {
  targetId: string; // Deterministic: `tgt_${name}`
  targetName: string;
  targetVersion: string;
  targetType: TargetValueType;
  description: string;
  sourceFieldOrFeature: string;
  allowedValues?: string[];
  derivationRule: string;
  descriptiveOnly: true;
  disclaimer: string;
  deterministicHash: string;
}

// ============================================================================
// 3. Modeling Dataset & Rows
// ============================================================================

export interface ModelingDatasetRow {
  resultId: string;
  sourceDrawId: string;
  sourceDocumentSha256: string;
  lotteryCode: string;
  drawDate: string; // DD/MM/YYYY
  drawDateIso: string; // YYYY-MM-DD
  drawTimestamp: number; // epoch ms for deterministic temporal ordering
  canonicalNumber: string;
  resultType: "FULL_TICKET" | "SUFFIX";
  numberLength: number;
  features: Record<string, string | number | boolean | null>;
  targetValue: string | number | null;
}

export interface ModelingDataset {
  id: string; // Deterministic: `mdset_${hash}`
  sourceModelFeatureMatrixId: string;
  sourceFeatureMatrixId: string;
  sourceFeatureEvaluationId: string;
  corpusId?: string;
  modelingVersion: string;
  populationScope: ModelingPopulationScope;
  featureColumnNames: string[]; // canonically sorted
  targetDefinition: TargetDefinition;
  totalRows: number;
  fullTicketCount: number;
  suffixCount: number;
  rows: ModelingDatasetRow[];
  deterministicHash: string;
  provenance: string;
  limitations: string[];
  descriptiveOnly: true;
}

// ============================================================================
// 4. Temporal Splitting Contracts
// ============================================================================

export type TemporalSplitStrategy = "CHRONOLOGICAL_HOLDOUT" | "WALK_FORWARD";

export interface SplitPartition {
  name: "TRAIN" | "VALIDATION" | "TEST";
  drawIds: string[];
  resultIds: string[];
  rowCount: number;
  dateRange: {
    earliest: string;
    latest: string;
    earliestIso: string;
    latestIso: string;
  };
}

export interface DatasetSplit {
  splitId: string; // Deterministic: `split_${hash}`
  strategy: TemporalSplitStrategy;
  splitVersion: string;
  trainPartition: SplitPartition;
  validationPartition?: SplitPartition;
  testPartition: SplitPartition;
  totalDraws: number;
  trainDrawCount: number;
  testDrawCount: number;
  seed?: number;
  deterministicHash: string;
}

export interface SplitDefinition {
  strategy: TemporalSplitStrategy;
  splitVersion: string;
  trainDrawCount?: number;
  testDrawCount?: number;
  minTrainDraws?: number;
  validationDrawCount?: number;
  seed?: number;
}

// ============================================================================
// 5. Leakage Guards
// ============================================================================

export interface LeakageValidationResult {
  passed: boolean;
  temporalLeakageDetected: boolean;
  drawOverlapDetected: boolean;
  resultIdOverlapDetected: boolean;
  futureDateInTrainDetected: boolean;
  targetLeakageDetected: boolean;
  sourceDocumentOverlapDetected: boolean;
  issues: string[];
}

// ============================================================================
// 6. Baseline Definitions
// ============================================================================

export type BaselineType =
  | "UNIFORM_CATEGORICAL"
  | "EMPIRICAL_FREQUENCY"
  | "MAJORITY_CLASS";

export interface BaselineDefinition {
  baselineId: string; // Deterministic: `base_${type.toLowerCase()}`
  baselineType: BaselineType;
  baselineVersion: string;
  targetId: string;
  expectedBehavior: string;
  metricCompatibility: string[];
  deterministicHash: string;
}

// ============================================================================
// 7. Model Abstraction & Definition
// ============================================================================

export interface ModelDefinition {
  modelId: string; // Deterministic: `mdef_${hash}`
  modelName: string;
  modelVersion: string;
  modelType: "BASELINE" | "HISTORICAL_STATISTICAL";
  targetId: string;
  parameters: Record<string, any>;
  deterministicHash: string;
  descriptiveOnly: true;
}

export interface ModelPrediction {
  resultId: string;
  sourceDrawId: string;
  predictedClass?: string;
  predictedValue?: number;
  probabilities?: Record<string, number>;
  observedTarget: string | number | null;
}

// ============================================================================
// 8. Evaluation Metrics & Confusion Matrix
// ============================================================================

export type EvaluationMetricType =
  | "ACCURACY"
  | "BALANCED_ACCURACY"
  | "LOG_LOSS"
  | "SAMPLE_SIZE";

export interface EvaluationMetric {
  metricType: EvaluationMetricType;
  metricName: string;
  value: number;
  formula: string;
  sampleSize: number;
  missingCount: number;
  metricVersion: string;
}

export interface ConfusionMatrix {
  classes: string[];
  matrix: Record<string, Record<string, number>>; // matrix[actual][predicted] = count
  totalSamples: number;
}

export interface ModelEvaluation {
  evaluationId: string; // Deterministic: `meval_${hash}`
  modelId: string;
  datasetId: string;
  splitId: string;
  partitionEvaluated: "TRAIN" | "VALIDATION" | "TEST";
  metrics: Record<string, EvaluationMetric>;
  confusionMatrix?: ConfusionMatrix;
  totalPredictions: number;
  deterministicHash: string;
  evaluatedAt: string;
}

// ============================================================================
// 9. Model Run & Experiment Reproducibility
// ============================================================================

export interface ModelRun {
  runId: string; // Deterministic: `mrun_${hash}`
  experimentId: string; // Deterministic: `exp_${hash}` based on model, dataset, target, split
  modelDefinition: ModelDefinition;
  datasetId: string;
  split: DatasetSplit;
  predictions: ModelPrediction[];
  evaluation: ModelEvaluation;
  executionVersion: string;
  deterministicHash: string;
  executedAt: string;
  provenance: string;
  limitations: string[];
  descriptiveOnly: true;
}

// ============================================================================
// 10. Backtest Contracts
// ============================================================================

export interface BacktestDefinition {
  backtestId: string; // Deterministic: `bkt_${hash}`
  backtestVersion: string;
  datasetId: string;
  modelDefinition: ModelDefinition;
  targetDefinition: TargetDefinition;
  temporalStrategy: TemporalSplitStrategy;
  minTrainDraws: number;
  metricTypes: EvaluationMetricType[];
  deterministicHash: string;
  descriptiveOnly: true;
  provenance: string;
}

export interface BacktestWindowResult {
  windowIndex: number;
  trainDrawIds: string[];
  testDrawId: string;
  testDrawDate: string;
  trainRowCount: number;
  testRowCount: number;
  evaluation: ModelEvaluation;
}

export interface BacktestResult {
  backtestId: string;
  windows: BacktestWindowResult[];
  aggregateMetrics: Record<string, number>;
  totalWindows: number;
  deterministicHash: string;
  executedAt: string;
  limitations: string[];
  descriptiveOnly: true;
}

// ============================================================================
// 11. HistoricalModel Interface
// ============================================================================

export interface HistoricalModel {
  readonly definition: ModelDefinition;
  fit(trainRows: ModelingDatasetRow[], targetDef: TargetDefinition): void;
  predict(testRows: ModelingDatasetRow[]): ModelPrediction[];
  evaluate(testRows: ModelingDatasetRow[], predictions?: ModelPrediction[]): ModelEvaluation;
}

// ============================================================================
// 12. Repository Contracts
// ============================================================================

export interface HistoricalModelingDatasetRecord {
  id: string; // matches dataset.id
  dataset: ModelingDataset;
  createdAt: string;
}

export interface HistoricalModelRunRecord {
  id: string; // matches run.runId
  run: ModelRun;
  createdAt: string;
}

export interface ModelingDatasetRepository {
  saveDataset(record: HistoricalModelingDatasetRecord): Promise<void>;
  getDatasetById(id: string): Promise<HistoricalModelingDatasetRecord | null>;
  listDatasets(limit?: number): Promise<HistoricalModelingDatasetRecord[]>;
}

export interface ModelRunRepository {
  saveModelRun(record: HistoricalModelRunRecord): Promise<void>;
  getModelRunById(id: string): Promise<HistoricalModelRunRecord | null>;
  listModelRuns(limit?: number): Promise<HistoricalModelRunRecord[]>;
}
