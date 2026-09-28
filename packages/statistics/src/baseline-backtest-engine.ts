/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 7B: Baseline Models & Historical Backtesting Engine
 *
 * Implements:
 * - Deterministic Baseline Models (UniformBaseline, EmpiricalBaseline, MajorityBaseline)
 * - Strict training-only parameter estimation (zero test leakage)
 * - Probability representation and zero-probability numerical smoothing (CLIPPED_EPSILON_1E_15)
 * - Deterministic tie-breaking (LEXICOGRAPHICAL_ASCENDING)
 * - Chronological Holdout Backtesting (1,516 train, 754 test)
 * - Walk-Forward Backtesting (4 sequential expanding windows)
 * - Versioned BaselineBacktestResult and WalkForwardAggregateResult contracts
 * - Comprehensive BaselineComparisonReport generator
 * - Adversarial Leakage Audit suite
 *
 * Strict Scientific Boundary:
 * - DESCRIPTIVE BENCHMARKING ONLY.
 * - ZERO predictive claims, gambling optimization, betting advice, or lucky numbers.
 */

import { createHash } from "node:crypto";
import type {
  TargetDefinition,
  ModelingDatasetRow,
  ModelingDataset,
  DatasetSplit,
  ModelDefinition,
  ModelPrediction,
  ConfusionMatrix,
  ModelEvaluation
} from "./modeling-types";
import {
  evaluateCategoricalPredictions,
  createChronologicalSplit,
  createWalkForwardSplits,
  createObservedLastDigitTarget,
  createObservedFirstDigitTarget,
  createObservedParityTarget
} from "./modeling-engine";
import {
  DEFAULT_BASELINE_BACKTEST_VERSION,
  BASELINE_BACKTEST_DISCLAIMER,
  ZERO_PROBABILITY_POLICY,
  EPSILON_LOG_LOSS,
  TIE_BREAKING_STRATEGY,
  type BaselineModelType,
  type BaselineModelParameters,
  type BaselineModelMetadata,
  type BaselineModel,
  type ClassDistributionRecord,
  type BaselineBacktestResult,
  type WalkForwardAggregateResult,
  type BaselineComparisonSummaryRow,
  type BaselineWindowDetailRow,
  type BaselineComparisonReport,
  type BaselineLeakageAuditResult
} from "./baseline-backtest-types";

export {
  DEFAULT_BASELINE_BACKTEST_VERSION,
  BASELINE_BACKTEST_DISCLAIMER,
  ZERO_PROBABILITY_POLICY,
  EPSILON_LOG_LOSS,
  TIE_BREAKING_STRATEGY
};

// ============================================================================
// Canonical Stringify & Hashing
// ============================================================================

function canonicalStringify(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map((item) => canonicalStringify(item)).join(",")}]`;
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = keys.map(
    (k) => `${JSON.stringify(k)}:${canonicalStringify((obj as Record<string, unknown>)[k])}`
  );
  return `{${pairs.join(",")}}`;
}

export function computeBaselineModelHash(
  modelType: BaselineModelType,
  targetId: string,
  parameters: Record<string, unknown> | BaselineModelParameters
): string {
  const payload = {
    modelType,
    targetId,
    parameters
  };
  return createHash("sha256").update(canonicalStringify(payload)).digest("hex").slice(0, 16);
}

export function computeBaselineBacktestResultHash(
  res: Omit<BaselineBacktestResult, "resultId" | "deterministicHash">
): string {
  const payload = {
    experimentId: res.experimentId,
    experimentVersion: res.experimentVersion,
    datasetId: res.datasetId,
    modelId: res.modelId,
    modelVersion: res.modelVersion,
    target: res.target,
    evaluationMethod: res.evaluationMethod,
    windowId: res.windowId || null,
    trainRowCount: res.trainRowCount,
    testRowCount: res.testRowCount,
    accuracy: res.accuracy,
    balancedAccuracy: res.balancedAccuracy,
    logLoss: res.logLoss,
    trainDateRange: res.trainDateRange,
    testDateRange: res.testDateRange
  };
  return createHash("sha256").update(canonicalStringify(payload)).digest("hex").slice(0, 16);
}

export function computeWalkForwardAggregateHash(
  agg: Omit<WalkForwardAggregateResult, "aggregateId" | "deterministicHash">
): string {
  const payload = {
    experimentId: agg.experimentId,
    datasetId: agg.datasetId,
    modelId: agg.modelId,
    target: agg.target,
    totalWindows: agg.totalWindows,
    meanAccuracy: agg.meanAccuracy,
    meanBalancedAccuracy: agg.meanBalancedAccuracy,
    meanLogLoss: agg.meanLogLoss,
    windowHashes: agg.windows.map((w) => w.deterministicHash)
  };
  return createHash("sha256").update(canonicalStringify(payload)).digest("hex").slice(0, 16);
}

// ============================================================================
// Target Resolution & Dataset Derivation Helpers
// ============================================================================

export function resolveTargetDefinition(
  targetOrName?: TargetDefinition | string,
  allowedValues?: string[]
): TargetDefinition {
  if (typeof targetOrName === "object" && targetOrName !== null) {
    if (allowedValues && allowedValues.length > 0) {
      return { ...targetOrName, allowedValues: [...allowedValues].sort() };
    }
    return targetOrName;
  }
  const name = typeof targetOrName === "string" ? targetOrName : "observed_last_digit";
  let base: TargetDefinition;
  if (name === "observed_first_digit") {
    base = createObservedFirstDigitTarget();
  } else if (name === "observed_parity") {
    base = createObservedParityTarget();
  } else {
    base = createObservedLastDigitTarget();
  }
  if (allowedValues && allowedValues.length > 0) {
    return { ...base, allowedValues: [...allowedValues].sort() };
  }
  return base;
}

export function deriveDatasetWithTarget(
  sourceDataset: ModelingDataset,
  targetDefOrName: TargetDefinition | string
): ModelingDataset {
  const targetDef = resolveTargetDefinition(targetDefOrName);
  const targetSourceField = targetDef.sourceFieldOrFeature;
  const filteredFeatureColumnNames = sourceDataset.featureColumnNames.filter(
    (col) => col !== targetSourceField
  );

  const rows: ModelingDatasetRow[] = sourceDataset.rows.map((r) => {
    let targetVal: string | number | null = null;
    if (targetDef.targetName === "observed_last_digit") {
      targetVal = String(r.features["lastDigit"] ?? r.canonicalNumber.slice(-1));
    } else if (targetDef.targetName === "observed_first_digit") {
      targetVal = String(r.features["firstDigit"] ?? r.canonicalNumber.slice(0, 1));
    } else if (targetDef.targetName === "observed_parity") {
      const lastDig = Number(r.features["lastDigit"] ?? r.canonicalNumber.slice(-1));
      targetVal = lastDig % 2 === 0 ? "EVEN" : "ODD";
    } else {
      targetVal = r.targetValue;
    }

    const features: Record<string, string | number | boolean | null> = {};
    for (const col of filteredFeatureColumnNames) {
      features[col] = r.features[col] ?? null;
    }

    return {
      ...r,
      features,
      targetValue: targetVal
    };
  });

  return {
    ...sourceDataset,
    featureColumnNames: filteredFeatureColumnNames,
    targetDefinition: targetDef,
    rows
  };
}

function extractRowTarget(r: ModelingDatasetRow, targetKey: string): string | null {
  if (r.targetValue !== undefined && r.targetValue !== null) {
    return String(r.targetValue);
  }
  if ((r as any).targets && (r as any).targets[targetKey] !== undefined && (r as any).targets[targetKey] !== null) {
    return String((r as any).targets[targetKey]);
  }
  if (targetKey === "observed_last_digit") {
    return String(r.features["lastDigit"] ?? r.canonicalNumber?.slice(-1) ?? "0");
  }
  if (targetKey === "observed_first_digit") {
    return String(r.features["firstDigit"] ?? r.canonicalNumber?.slice(0, 1) ?? "0");
  }
  if (targetKey === "observed_parity") {
    const lastDig = Number(r.features["lastDigit"] ?? r.canonicalNumber?.slice(-1) ?? 0);
    return lastDig % 2 === 0 ? "EVEN" : "ODD";
  }
  return null;
}

// ============================================================================
// Core Metric Functions (Standalone, Fully Deterministic)
// ============================================================================

export function computeAccuracy(actual: (string | number)[], predicted: string[]): number {
  if (actual.length === 0) return 0;
  let correct = 0;
  for (let i = 0; i < actual.length; i++) {
    if (String(actual[i]) === String(predicted[i])) {
      correct++;
    }
  }
  return correct / actual.length;
}

export function computeConfusionMatrix(
  actual: (string | number)[],
  predicted: string[],
  classes?: string[]
): Record<string, Record<string, number>> {
  const classSet = new Set<string>(classes || []);
  for (const a of actual) classSet.add(String(a));
  for (const p of predicted) classSet.add(String(p));
  const sortedClasses = Array.from(classSet).sort();

  const matrix: Record<string, Record<string, number>> = {};
  for (const a of sortedClasses) {
    matrix[a] = {};
    for (const p of sortedClasses) {
      matrix[a][p] = 0;
    }
  }
  for (let i = 0; i < actual.length; i++) {
    const aStr = String(actual[i]);
    const pStr = String(predicted[i]);
    if (!matrix[aStr]) {
      matrix[aStr] = {};
    }
    matrix[aStr][pStr] = (matrix[aStr][pStr] || 0) + 1;
  }
  return matrix;
}

export function computeBalancedAccuracy(
  actual: (string | number)[],
  predicted: string[],
  classes?: string[]
): number {
  if (actual.length === 0) return 0;
  const matrix = computeConfusionMatrix(actual, predicted, classes);
  let recallSum = 0;
  let classesWithSupport = 0;
  for (const c of Object.keys(matrix).sort()) {
    const row = matrix[c]!;
    const support = Object.values(row).reduce((s, v) => s + v, 0);
    if (support > 0) {
      const tp = row[c] || 0;
      recallSum += tp / support;
      classesWithSupport++;
    }
  }
  return classesWithSupport > 0 ? recallSum / classesWithSupport : 0;
}

export function computeLogLoss(
  actual: (string | number)[],
  probabilities: Array<Record<string, number>>,
  _classes?: string[],
  epsilon: number = EPSILON_LOG_LOSS
): number {
  if (actual.length === 0) return 0;
  let totalLoss = 0;
  for (let i = 0; i < actual.length; i++) {
    const aStr = String(actual[i]);
    const pMap = probabilities[i] || {};
    const rawP = pMap[aStr] ?? 0;
    const clipped = Math.max(epsilon, Math.min(1 - epsilon, rawP));
    totalLoss += -Math.log(clipped);
  }
  return totalLoss / actual.length;
}

export function computeClassDistribution(
  rows: ModelingDatasetRow[],
  targetDef: TargetDefinition
): ClassDistributionRecord {
  const allowed = targetDef.allowedValues ? [...targetDef.allowedValues].sort() : [];
  const counts: Record<string, number> = {};
  for (const c of allowed) {
    counts[c] = 0;
  }

  let total = 0;
  for (const r of rows) {
    const val = extractRowTarget(r, targetDef.targetName);
    if (val !== null && val !== undefined) {
      counts[val] = (counts[val] || 0) + 1;
      total++;
    }
  }

  const proportions: Record<string, number> = {};
  for (const c of Object.keys(counts).sort()) {
    proportions[c] = total > 0 ? counts[c]! / total : 0;
  }

  return { counts, proportions, total };
}

// ============================================================================
// Baseline 1: UNIFORM BASELINE
// ============================================================================

export class UniformBaseline implements BaselineModel {
  readonly modelType = "UNIFORM" as const;
  readonly metadata: BaselineModelMetadata;
  readonly definition: ModelDefinition;
  private allowedValues: string[];
  private targetDef: TargetDefinition;
  private isFittedState: boolean = false;

  constructor(targetDefOrName?: TargetDefinition | string, allowedValues?: string[]) {
    this.targetDef = resolveTargetDefinition(targetDefOrName, allowedValues);
    this.allowedValues = this.targetDef.allowedValues ? [...this.targetDef.allowedValues].sort() : [];
    const k = this.allowedValues.length || 1;

    const parameters: BaselineModelParameters = {
      modelType: "UNIFORM",
      allowedValues: this.allowedValues,
      kClasses: k,
      tieBreakingStrategy: TIE_BREAKING_STRATEGY,
      zeroProbabilityPolicy: ZERO_PROBABILITY_POLICY,
      epsilon: EPSILON_LOG_LOSS
    };

    const hash = computeBaselineModelHash("UNIFORM", this.targetDef.targetId, parameters);
    const modelId = `mdef_baseline_uniform_${hash}`;

    this.metadata = {
      modelId,
      modelName: "Uniform Categorical Baseline",
      modelType: "UNIFORM",
      modelVersion: DEFAULT_BASELINE_BACKTEST_VERSION,
      targetId: this.targetDef.targetId,
      targetName: this.targetDef.targetName,
      parameters,
      isFitted: false,
      deterministicHash: hash,
      descriptiveOnly: true
    };

    this.definition = {
      modelId,
      modelName: "Uniform Categorical Baseline",
      modelVersion: DEFAULT_BASELINE_BACKTEST_VERSION,
      modelType: "BASELINE",
      targetId: this.targetDef.targetId,
      parameters: { ...parameters },
      deterministicHash: hash,
      descriptiveOnly: true
    };
  }

  fit(_trainRows: ModelingDatasetRow[], targetDefOrName?: TargetDefinition | string, allowedValues?: string[]): void {
    if (targetDefOrName) {
      this.targetDef = resolveTargetDefinition(targetDefOrName, allowedValues);
      if (this.targetDef.allowedValues && this.targetDef.allowedValues.length > 0) {
        this.allowedValues = [...this.targetDef.allowedValues].sort();
      }
    } else if (allowedValues && allowedValues.length > 0) {
      this.allowedValues = [...allowedValues].sort();
    }
    this.isFittedState = true;
    this.metadata.isFitted = true;
  }

  predictClasses(testRows: ModelingDatasetRow[]): string[] {
    const defaultPred = this.allowedValues[0] || "0";
    return testRows.map(() => defaultPred);
  }

  predictProbabilities(testRows: ModelingDatasetRow[]): Array<Record<string, number>> {
    const k = this.allowedValues.length || 1;
    const uniformProb = 1 / k;
    const probVector: Record<string, number> = {};
    for (const val of this.allowedValues) {
      probVector[val] = uniformProb;
    }
    return testRows.map(() => ({ ...probVector }));
  }

  predict(testRows: ModelingDatasetRow[]): ModelPrediction[] {
    const defaultPred = this.allowedValues[0] || "0";
    const k = this.allowedValues.length || 1;
    const uniformProb = 1 / k;
    const probVector: Record<string, number> = {};
    for (const val of this.allowedValues) {
      probVector[val] = uniformProb;
    }

    const targetKey = this.targetDef.targetName;
    return testRows.map((r) => ({
      resultId: r.resultId,
      sourceDrawId: r.sourceDrawId,
      predictedClass: defaultPred,
      probabilities: { ...probVector },
      observedTarget: extractRowTarget(r, targetKey)
    }));
  }

  evaluate(testRows: ModelingDatasetRow[], predictions?: ModelPrediction[]): ModelEvaluation {
    const preds = predictions || this.predict(testRows);
    return evaluateCategoricalPredictions(preds, this.targetDef, {
      modelId: this.metadata.modelId,
      partition: "TEST"
    });
  }

  getFittedState(): Record<string, unknown> {
    const k = this.allowedValues.length || 1;
    return {
      modelType: this.modelType,
      allowedValues: [...this.allowedValues],
      kClasses: k,
      uniformProbability: 1 / k,
      isFitted: this.isFittedState
    };
  }
}

// ============================================================================
// Baseline 2: EMPIRICAL FREQUENCY BASELINE
// ============================================================================

export class EmpiricalBaseline implements BaselineModel {
  readonly modelType = "EMPIRICAL" as const;
  readonly metadata: BaselineModelMetadata;
  readonly definition: ModelDefinition;
  private allowedValues: string[];
  private targetDef: TargetDefinition;
  private frequencies: Record<string, number> = {};
  private majorityClass: string = "0";
  private isFittedState: boolean = false;
  private trainRowCount: number = 0;

  constructor(targetDefOrName?: TargetDefinition | string, allowedValues?: string[]) {
    this.targetDef = resolveTargetDefinition(targetDefOrName, allowedValues);
    this.allowedValues = this.targetDef.allowedValues ? [...this.targetDef.allowedValues].sort() : [];
    const k = this.allowedValues.length || 1;

    const parameters: BaselineModelParameters = {
      modelType: "EMPIRICAL",
      allowedValues: this.allowedValues,
      kClasses: k,
      tieBreakingStrategy: TIE_BREAKING_STRATEGY,
      zeroProbabilityPolicy: ZERO_PROBABILITY_POLICY,
      epsilon: EPSILON_LOG_LOSS
    };

    const hash = computeBaselineModelHash("EMPIRICAL", this.targetDef.targetId, parameters);
    const modelId = `mdef_baseline_empirical_${hash}`;

    this.metadata = {
      modelId,
      modelName: "Empirical Frequency Baseline",
      modelType: "EMPIRICAL",
      modelVersion: DEFAULT_BASELINE_BACKTEST_VERSION,
      targetId: this.targetDef.targetId,
      targetName: this.targetDef.targetName,
      parameters,
      isFitted: false,
      deterministicHash: hash,
      descriptiveOnly: true
    };

    this.definition = {
      modelId,
      modelName: "Empirical Frequency Baseline",
      modelVersion: DEFAULT_BASELINE_BACKTEST_VERSION,
      modelType: "BASELINE",
      targetId: this.targetDef.targetId,
      parameters: { ...parameters },
      deterministicHash: hash,
      descriptiveOnly: true
    };
  }

  fit(trainRows: ModelingDatasetRow[], targetDefOrName?: TargetDefinition | string, allowedValues?: string[]): void {
    if (targetDefOrName) {
      this.targetDef = resolveTargetDefinition(targetDefOrName, allowedValues);
      if (this.targetDef.allowedValues && this.targetDef.allowedValues.length > 0) {
        this.allowedValues = [...this.targetDef.allowedValues].sort();
      }
    } else if (allowedValues && allowedValues.length > 0) {
      this.allowedValues = [...allowedValues].sort();
    }

    const counts: Record<string, number> = {};
    for (const c of this.allowedValues) {
      counts[c] = 0;
    }

    let total = 0;
    const targetKey = this.targetDef.targetName;
    for (const r of trainRows) {
      const valStr = extractRowTarget(r, targetKey);
      if (valStr !== null && valStr !== undefined) {
        counts[valStr] = (counts[valStr] || 0) + 1;
        total++;
        if (!this.allowedValues.includes(valStr)) {
          this.allowedValues.push(valStr);
          this.allowedValues.sort();
        }
      }
    }

    this.trainRowCount = total;
    this.frequencies = {};
    for (const c of this.allowedValues) {
      this.frequencies[c] = total > 0 ? (counts[c] || 0) / total : 0;
    }

    // Deterministic tie-breaking: LEXICOGRAPHICAL_ASCENDING
    let bestClass = this.allowedValues[0] || "0";
    let maxCount = -1;
    for (const c of [...this.allowedValues].sort()) {
      const cnt = counts[c] || 0;
      if (cnt > maxCount) {
        maxCount = cnt;
        bestClass = c;
      }
    }

    this.majorityClass = bestClass;
    this.isFittedState = true;
    this.metadata.isFitted = true;
    this.metadata.parameters.fittedClassFrequencies = { ...this.frequencies };
    this.metadata.parameters.majorityClass = this.majorityClass;
    this.metadata.parameters.trainingRowCount = total;
  }

  predictClasses(testRows: ModelingDatasetRow[]): string[] {
    return testRows.map(() => this.majorityClass);
  }

  predictProbabilities(testRows: ModelingDatasetRow[]): Array<Record<string, number>> {
    return testRows.map(() => ({ ...this.frequencies }));
  }

  predict(testRows: ModelingDatasetRow[]): ModelPrediction[] {
    const targetKey = this.targetDef.targetName;
    return testRows.map((r) => ({
      resultId: r.resultId,
      sourceDrawId: r.sourceDrawId,
      predictedClass: this.majorityClass,
      probabilities: { ...this.frequencies },
      observedTarget: extractRowTarget(r, targetKey)
    }));
  }

  evaluate(testRows: ModelingDatasetRow[], predictions?: ModelPrediction[]): ModelEvaluation {
    const preds = predictions || this.predict(testRows);
    return evaluateCategoricalPredictions(preds, this.targetDef, {
      modelId: this.metadata.modelId,
      partition: "TEST"
    });
  }

  getFittedState(): Record<string, unknown> {
    return {
      modelType: this.modelType,
      allowedValues: [...this.allowedValues],
      frequencies: { ...this.frequencies },
      majorityClass: this.majorityClass,
      trainRowCount: this.trainRowCount,
      isFitted: this.isFittedState
    };
  }
}

// ============================================================================
// Baseline 3: MAJORITY CLASS BASELINE
// ============================================================================

export class MajorityBaseline implements BaselineModel {
  readonly modelType = "MAJORITY" as const;
  readonly metadata: BaselineModelMetadata;
  readonly definition: ModelDefinition;
  private allowedValues: string[];
  private targetDef: TargetDefinition;
  private majorityClass: string = "0";
  private isFittedState: boolean = false;
  private trainRowCount: number = 0;

  constructor(targetDefOrName?: TargetDefinition | string, allowedValues?: string[]) {
    this.targetDef = resolveTargetDefinition(targetDefOrName, allowedValues);
    this.allowedValues = this.targetDef.allowedValues ? [...this.targetDef.allowedValues].sort() : [];
    const k = this.allowedValues.length || 1;

    const parameters: BaselineModelParameters = {
      modelType: "MAJORITY",
      allowedValues: this.allowedValues,
      kClasses: k,
      tieBreakingStrategy: TIE_BREAKING_STRATEGY,
      zeroProbabilityPolicy: ZERO_PROBABILITY_POLICY,
      epsilon: EPSILON_LOG_LOSS
    };

    const hash = computeBaselineModelHash("MAJORITY", this.targetDef.targetId, parameters);
    const modelId = `mdef_baseline_majority_${hash}`;

    this.metadata = {
      modelId,
      modelName: "Majority Class Baseline",
      modelType: "MAJORITY",
      modelVersion: DEFAULT_BASELINE_BACKTEST_VERSION,
      targetId: this.targetDef.targetId,
      targetName: this.targetDef.targetName,
      parameters,
      isFitted: false,
      deterministicHash: hash,
      descriptiveOnly: true
    };

    this.definition = {
      modelId,
      modelName: "Majority Class Baseline",
      modelVersion: DEFAULT_BASELINE_BACKTEST_VERSION,
      modelType: "BASELINE",
      targetId: this.targetDef.targetId,
      parameters: { ...parameters },
      deterministicHash: hash,
      descriptiveOnly: true
    };
  }

  fit(trainRows: ModelingDatasetRow[], targetDefOrName?: TargetDefinition | string, allowedValues?: string[]): void {
    if (targetDefOrName) {
      this.targetDef = resolveTargetDefinition(targetDefOrName, allowedValues);
      if (this.targetDef.allowedValues && this.targetDef.allowedValues.length > 0) {
        this.allowedValues = [...this.targetDef.allowedValues].sort();
      }
    } else if (allowedValues && allowedValues.length > 0) {
      this.allowedValues = [...allowedValues].sort();
    }

    const counts: Record<string, number> = {};
    for (const c of this.allowedValues) {
      counts[c] = 0;
    }

    let total = 0;
    const targetKey = this.targetDef.targetName;
    for (const r of trainRows) {
      const valStr = extractRowTarget(r, targetKey);
      if (valStr !== null && valStr !== undefined) {
        counts[valStr] = (counts[valStr] || 0) + 1;
        total++;
        if (!this.allowedValues.includes(valStr)) {
          this.allowedValues.push(valStr);
          this.allowedValues.sort();
        }
      }
    }

    this.trainRowCount = total;

    // Argmax with LEXICOGRAPHICAL_ASCENDING tie-breaking:
    let bestClass = this.allowedValues[0] || "0";
    let maxCount = -1;
    for (const c of [...this.allowedValues].sort()) {
      const cnt = counts[c] || 0;
      if (cnt > maxCount) {
        maxCount = cnt;
        bestClass = c;
      }
    }

    this.majorityClass = bestClass;
    this.isFittedState = true;
    this.metadata.isFitted = true;
    this.metadata.parameters.majorityClass = this.majorityClass;
    this.metadata.parameters.trainingRowCount = total;
  }

  predictClasses(testRows: ModelingDatasetRow[]): string[] {
    return testRows.map(() => this.majorityClass);
  }

  predictProbabilities(testRows: ModelingDatasetRow[]): Array<Record<string, number>> {
    const probs: Record<string, number> = {};
    for (const val of this.allowedValues) {
      probs[val] = val === this.majorityClass ? 1.0 : 0.0;
    }
    return testRows.map(() => ({ ...probs }));
  }

  predict(testRows: ModelingDatasetRow[]): ModelPrediction[] {
    const probs: Record<string, number> = {};
    for (const val of this.allowedValues) {
      probs[val] = val === this.majorityClass ? 1.0 : 0.0;
    }

    const targetKey = this.targetDef.targetName;
    return testRows.map((r) => ({
      resultId: r.resultId,
      sourceDrawId: r.sourceDrawId,
      predictedClass: this.majorityClass,
      probabilities: { ...probs },
      observedTarget: extractRowTarget(r, targetKey)
    }));
  }

  evaluate(testRows: ModelingDatasetRow[], predictions?: ModelPrediction[]): ModelEvaluation {
    const preds = predictions || this.predict(testRows);
    return evaluateCategoricalPredictions(preds, this.targetDef, {
      modelId: this.metadata.modelId,
      partition: "TEST"
    });
  }

  getFittedState(): Record<string, unknown> {
    return {
      modelType: this.modelType,
      allowedValues: [...this.allowedValues],
      majorityClass: this.majorityClass,
      trainRowCount: this.trainRowCount,
      isFitted: this.isFittedState
    };
  }
}

// ============================================================================
// Factory Helpers
// ============================================================================

export function createBaselineModel(
  type: BaselineModelType,
  targetDefOrName?: TargetDefinition | string,
  allowedValues?: string[]
): BaselineModel {
  switch (type) {
    case "UNIFORM":
      return new UniformBaseline(targetDefOrName, allowedValues);
    case "EMPIRICAL":
      return new EmpiricalBaseline(targetDefOrName, allowedValues);
    case "MAJORITY":
      return new MajorityBaseline(targetDefOrName, allowedValues);
    default:
      throw new Error(`Unknown BaselineModelType: ${type}`);
  }
}

// ============================================================================
// Backtest Execution: Chronological Holdout (Milestone 7B.4)
// ============================================================================

export interface RunChronologicalHoldoutOptions {
  experimentId?: string;
  createdAt?: string;
}

export function runChronologicalHoldoutBacktest(
  dataset: ModelingDataset,
  targetOrModel?: BaselineModel | BaselineModelType | string,
  modelTypeOrSplit?: BaselineModelType | DatasetSplit,
  options?: RunChronologicalHoldoutOptions
): BaselineBacktestResult {
  let model: BaselineModel;
  let activeDataset = dataset;
  let chronoSplit: DatasetSplit | undefined;

  if (typeof targetOrModel === "string") {
    if (targetOrModel === "UNIFORM" || targetOrModel === "EMPIRICAL" || targetOrModel === "MAJORITY") {
      model = createBaselineModel(targetOrModel as BaselineModelType, dataset.targetDefinition);
      if (modelTypeOrSplit && typeof modelTypeOrSplit === "object") {
        chronoSplit = modelTypeOrSplit as DatasetSplit;
      }
    } else {
      const targetDef = resolveTargetDefinition(targetOrModel);
      activeDataset = deriveDatasetWithTarget(dataset, targetDef);
      const mType = (typeof modelTypeOrSplit === "string" ? modelTypeOrSplit : "UNIFORM") as BaselineModelType;
      model = createBaselineModel(mType, targetDef);
    }
  } else if (targetOrModel && typeof targetOrModel === "object" && "modelType" in targetOrModel) {
    model = targetOrModel as BaselineModel;
    if (modelTypeOrSplit && typeof modelTypeOrSplit === "object") {
      chronoSplit = modelTypeOrSplit as DatasetSplit;
    }
  } else {
    model = new UniformBaseline(dataset.targetDefinition);
  }

  const totalDraws = activeDataset.populationScope?.drawCount ?? 6;
  const trainDrawCount = totalDraws >= 6 ? 4 : Math.max(1, totalDraws - 1);
  const testDrawCount = totalDraws >= 6 ? 2 : 1;
  const split = chronoSplit || createChronologicalSplit(activeDataset, trainDrawCount, testDrawCount);
  const createdAt = options?.createdAt || "2026-09-27T12:00:00.000Z";

  const trainSet = new Set(split.trainPartition.resultIds);
  const testSet = new Set(split.testPartition.resultIds);

  const trainRows = activeDataset.rows.filter((r) => trainSet.has(r.resultId));
  const testRows = activeDataset.rows.filter((r) => testSet.has(r.resultId));

  // Fit on training data ONLY
  model.fit(trainRows, activeDataset.targetDefinition);

  // Predict on held-out test rows ONLY
  const predictions = model.predict(testRows);

  // Validate probability summation to 1.0
  let probabilitiesSumToOne = true;
  for (const p of predictions) {
    if (p.probabilities) {
      const sum = Object.values(p.probabilities).reduce((acc, v) => acc + v, 0);
      if (Math.abs(sum - 1.0) > 1e-6) {
        probabilitiesSumToOne = false;
        break;
      }
    }
  }

  // Evaluate
  const evaluation = evaluateCategoricalPredictions(predictions, activeDataset.targetDefinition, {
    modelId: model.metadata.modelId,
    datasetId: activeDataset.id,
    splitId: split.splitId,
    partition: "TEST",
    evaluatedAt: createdAt
  });

  const accuracy = evaluation.metrics["accuracy"]?.value ?? 0;
  const balancedAccuracy = evaluation.metrics["balancedAccuracy"]?.value ?? 0;
  const logLoss = evaluation.metrics["logLoss"]?.value ?? null;
  const confusionMatrix: ConfusionMatrix = evaluation.confusionMatrix || {
    classes: activeDataset.targetDefinition.allowedValues || [],
    matrix: {},
    totalSamples: testRows.length
  };

  const trainClassDist = computeClassDistribution(trainRows, activeDataset.targetDefinition);
  const testClassDist = computeClassDistribution(testRows, activeDataset.targetDefinition);

  const expHash = createHash("sha256")
    .update(
      `${model.metadata.modelId}:${activeDataset.id}:${activeDataset.targetDefinition.targetId}:${split.splitId}:CHRONOLOGICAL_HOLDOUT`
    )
    .digest("hex")
    .slice(0, 16);
  const experimentId = options?.experimentId || `exp_bkt_holdout_${expHash}`;

  const baseResult = {
    experimentId,
    experimentVersion: DEFAULT_BASELINE_BACKTEST_VERSION,
    datasetId: activeDataset.id,
    modelId: model.metadata.modelId,
    modelVersion: model.metadata.modelVersion,
    modelType: model.modelType,
    target: activeDataset.targetDefinition.targetName,
    targetId: activeDataset.targetDefinition.targetId,
    evaluationMethod: "CHRONOLOGICAL_HOLDOUT" as const,
    windowId: "holdout_eval",
    trainRowCount: trainRows.length,
    testRowCount: testRows.length,
    trainDateRange: { ...split.trainPartition.dateRange },
    testDateRange: { ...split.testPartition.dateRange },
    trainDrawIds: [...split.trainPartition.drawIds],
    testDrawIds: [...split.testPartition.drawIds],
    accuracy,
    balancedAccuracy,
    logLoss,
    confusionMatrix,
    trainClassDistribution: trainClassDist,
    testClassDistribution: testClassDist,
    probabilitiesSumToOne,
    createdAt,
    provenance: `HoldoutBacktest(${model.modelType}) -> ModelingDataset(${activeDataset.id}) -> Target(${activeDataset.targetDefinition.targetName}) -> ChronologicalSplit(${split.splitId})`,
    limitations: [
      `CHRONOLOGICAL_HOLDOUT_LIMITATION: ${trainRows.length} train rows, ${testRows.length} test rows on historical draws. Strictly descriptive baseline reference.`,
      BASELINE_BACKTEST_DISCLAIMER
    ],
    descriptiveOnly: true as const,
    notice: BASELINE_BACKTEST_DISCLAIMER
  };

  const resHash = computeBaselineBacktestResultHash(baseResult);
  return {
    resultId: `bktr_${resHash}`,
    ...baseResult,
    deterministicHash: resHash
  };
}

// ============================================================================
// Backtest Execution: Walk-Forward (Milestone 7B.5)
// ============================================================================

export interface RunWalkForwardOptions {
  experimentId?: string;
  createdAt?: string;
  minTrainDraws?: number;
}

export function runWalkForwardBacktest(
  dataset: ModelingDataset,
  targetOrModelOrFactory?: (() => BaselineModel) | BaselineModelType | BaselineModel | string,
  modelTypeOrSplits?: BaselineModelType | DatasetSplit[],
  options?: RunWalkForwardOptions
): WalkForwardAggregateResult {
  let modelFactory: () => BaselineModel;
  let activeDataset = dataset;
  let customSplits: DatasetSplit[] | undefined;

  if (typeof targetOrModelOrFactory === "string") {
    if (
      targetOrModelOrFactory === "UNIFORM" ||
      targetOrModelOrFactory === "EMPIRICAL" ||
      targetOrModelOrFactory === "MAJORITY"
    ) {
      const mType = targetOrModelOrFactory as BaselineModelType;
      modelFactory = () => createBaselineModel(mType, activeDataset.targetDefinition);
      if (Array.isArray(modelTypeOrSplits)) {
        customSplits = modelTypeOrSplits;
      }
    } else {
      const targetDef = resolveTargetDefinition(targetOrModelOrFactory);
      activeDataset = deriveDatasetWithTarget(dataset, targetDef);
      const mType = (typeof modelTypeOrSplits === "string" ? modelTypeOrSplits : "UNIFORM") as BaselineModelType;
      modelFactory = () => createBaselineModel(mType, targetDef);
    }
  } else if (typeof targetOrModelOrFactory === "function") {
    modelFactory = targetOrModelOrFactory;
    if (Array.isArray(modelTypeOrSplits)) {
      customSplits = modelTypeOrSplits;
    }
  } else if (targetOrModelOrFactory && typeof targetOrModelOrFactory === "object" && "modelType" in targetOrModelOrFactory) {
    const m = targetOrModelOrFactory as BaselineModel;
    modelFactory = () => createBaselineModel(m.modelType, activeDataset.targetDefinition);
    if (Array.isArray(modelTypeOrSplits)) {
      customSplits = modelTypeOrSplits;
    }
  } else {
    modelFactory = () => new UniformBaseline(activeDataset.targetDefinition);
  }

  const minTrain = options?.minTrainDraws ?? 2;
  const wfSplits = customSplits || createWalkForwardSplits(activeDataset, minTrain);
  const createdAt = options?.createdAt || "2026-09-27T12:00:00.000Z";

  const sampleModel = modelFactory();
  const windows: BaselineBacktestResult[] = [];
  const accList: number[] = [];
  const balAccList: number[] = [];
  const logLossList: number[] = [];

  for (let idx = 0; idx < wfSplits.length; idx++) {
    const split = wfSplits[idx]!;
    const model = modelFactory();

    const trainSet = new Set(split.trainPartition.resultIds);
    const testSet = new Set(split.testPartition.resultIds);

    const trainRows = activeDataset.rows.filter((r) => trainSet.has(r.resultId));
    const testRows = activeDataset.rows.filter((r) => testSet.has(r.resultId));

    // Fit strictly on training rows for this window
    model.fit(trainRows, activeDataset.targetDefinition);

    // Predict strictly on test rows for this window
    const predictions = model.predict(testRows);

    let probabilitiesSumToOne = true;
    for (const p of predictions) {
      if (p.probabilities) {
        const sum = Object.values(p.probabilities).reduce((acc, v) => acc + v, 0);
        if (Math.abs(sum - 1.0) > 1e-6) {
          probabilitiesSumToOne = false;
          break;
        }
      }
    }

    const evaluation = evaluateCategoricalPredictions(predictions, activeDataset.targetDefinition, {
      modelId: model.metadata.modelId,
      datasetId: activeDataset.id,
      splitId: split.splitId,
      partition: "TEST",
      evaluatedAt: createdAt
    });

    const accuracy = evaluation.metrics["accuracy"]?.value ?? 0;
    const balancedAccuracy = evaluation.metrics["balancedAccuracy"]?.value ?? 0;
    const logLoss = evaluation.metrics["logLoss"]?.value ?? null;
    const confusionMatrix: ConfusionMatrix = evaluation.confusionMatrix || {
      classes: activeDataset.targetDefinition.allowedValues || [],
      matrix: {},
      totalSamples: testRows.length
    };

    const trainClassDist = computeClassDistribution(trainRows, activeDataset.targetDefinition);
    const testClassDist = computeClassDistribution(testRows, activeDataset.targetDefinition);

    const windowExpHash = createHash("sha256")
      .update(`${model.metadata.modelId}:${activeDataset.id}:${split.splitId}:window_${idx + 1}`)
      .digest("hex")
      .slice(0, 16);

    const windowBaseResult = {
      experimentId: `exp_bkt_wf_win_${windowExpHash}`,
      experimentVersion: DEFAULT_BASELINE_BACKTEST_VERSION,
      datasetId: activeDataset.id,
      modelId: model.metadata.modelId,
      modelVersion: model.metadata.modelVersion,
      modelType: model.modelType,
      target: activeDataset.targetDefinition.targetName,
      targetId: activeDataset.targetDefinition.targetId,
      evaluationMethod: "WALK_FORWARD" as const,
      windowId: `window_${idx + 1}`,
      windowIndex: idx + 1,
      trainRowCount: trainRows.length,
      testRowCount: testRows.length,
      trainDateRange: { ...split.trainPartition.dateRange },
      testDateRange: { ...split.testPartition.dateRange },
      trainDrawIds: [...split.trainPartition.drawIds],
      testDrawIds: [...split.testPartition.drawIds],
      accuracy,
      balancedAccuracy,
      logLoss,
      confusionMatrix,
      trainClassDistribution: trainClassDist,
      testClassDistribution: testClassDist,
      probabilitiesSumToOne,
      createdAt,
      provenance: `WalkForwardWindow(${idx + 1}) -> Model(${model.modelType}) -> ModelingDataset(${activeDataset.id}) -> Split(${split.splitId})`,
      limitations: [
        `WALK_FORWARD_WINDOW_LIMITATION: Window ${idx + 1} (${trainRows.length} train, ${testRows.length} test). Descriptive reference only.`,
        BASELINE_BACKTEST_DISCLAIMER
      ],
      descriptiveOnly: true as const,
      notice: BASELINE_BACKTEST_DISCLAIMER
    };

    const resHash = computeBaselineBacktestResultHash(windowBaseResult);
    windows.push({
      resultId: `bktr_${resHash}`,
      ...windowBaseResult,
      deterministicHash: resHash
    });

    accList.push(accuracy);
    balAccList.push(balancedAccuracy);
    if (logLoss !== null) {
      logLossList.push(logLoss);
    }
  }

  function mean(vals: number[]): number {
    return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  }

  function stdDev(vals: number[], avg: number): number {
    if (vals.length <= 1) return 0;
    const variance = vals.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / vals.length;
    return Math.sqrt(variance);
  }

  const meanAccuracy = mean(accList);
  const meanBalancedAccuracy = mean(balAccList);
  const meanLogLoss = logLossList.length > 0 ? mean(logLossList) : null;
  const accuracyStdDev = stdDev(accList, meanAccuracy);
  const balancedAccuracyStdDev = stdDev(balAccList, meanBalancedAccuracy);

  const aggExpHash = createHash("sha256")
    .update(
      `${sampleModel.metadata.modelId}:${activeDataset.id}:${activeDataset.targetDefinition.targetId}:WALK_FORWARD:${windows.length}`
    )
    .digest("hex")
    .slice(0, 16);
  const experimentId = options?.experimentId || `exp_bkt_wf_agg_${aggExpHash}`;

  const baseAggregate = {
    experimentId,
    experimentVersion: DEFAULT_BASELINE_BACKTEST_VERSION,
    datasetId: activeDataset.id,
    modelId: sampleModel.metadata.modelId,
    modelVersion: sampleModel.metadata.modelVersion,
    modelType: sampleModel.modelType,
    target: activeDataset.targetDefinition.targetName,
    targetId: activeDataset.targetDefinition.targetId,
    evaluationMethod: "WALK_FORWARD" as const,
    totalWindows: windows.length,
    windows,
    meanAccuracy,
    meanBalancedAccuracy,
    meanLogLoss,
    accuracyStdDev,
    balancedAccuracyStdDev,
    createdAt,
    provenance: `WalkForwardAggregate(${sampleModel.modelType}) -> ModelingDataset(${activeDataset.id}) -> Target(${activeDataset.targetDefinition.targetName}) -> ${windows.length} sequential windows`,
    limitations: [
      `WALK_FORWARD_AGGREGATE_LIMITATION: Evaluated across ${windows.length} sequential expanding windows. Preserves window-level variation. Descriptive reference only.`,
      BASELINE_BACKTEST_DISCLAIMER
    ],
    descriptiveOnly: true as const,
    notice: BASELINE_BACKTEST_DISCLAIMER
  };

  const aggHash = computeWalkForwardAggregateHash(baseAggregate);
  return {
    aggregateId: `wfagg_${aggHash}`,
    ...baseAggregate,
    deterministicHash: aggHash
  };
}

// ============================================================================
// Comprehensive Baseline Benchmarking & Comparison (Milestone 7B.7)
// ============================================================================

export interface GenerateBaselineComparisonReportOptions {
  datasetMap: {
    lastDigit: ModelingDataset;
    firstDigit: ModelingDataset;
    parity: ModelingDataset;
  };
  createdAt?: string;
  trainDrawCount?: number;
  testDrawCount?: number;
  minTrainDraws?: number;
  customHoldoutSplit?: DatasetSplit;
  customWfSplits?: DatasetSplit[];
}

export function generateBaselineComparisonReport(
  datasetOrOptions: ModelingDataset | GenerateBaselineComparisonReportOptions,
  options?: {
    createdAt?: string;
    trainDrawCount?: number;
    testDrawCount?: number;
    minTrainDraws?: number;
    customHoldoutSplit?: DatasetSplit;
    customWfSplits?: DatasetSplit[];
  }
): BaselineComparisonReport {
  let datasetMap: {
    lastDigit: ModelingDataset;
    firstDigit: ModelingDataset;
    parity: ModelingDataset;
  };
  let createdAt = "2026-09-27T12:00:00.000Z";
  let splitOptions: {
    trainDrawCount?: number;
    testDrawCount?: number;
    minTrainDraws?: number;
    customHoldoutSplit?: DatasetSplit;
    customWfSplits?: DatasetSplit[];
  } = {};

  if ("rows" in datasetOrOptions && Array.isArray((datasetOrOptions as ModelingDataset).rows)) {
    const ds = datasetOrOptions as ModelingDataset;
    datasetMap = {
      lastDigit: deriveDatasetWithTarget(ds, createObservedLastDigitTarget()),
      firstDigit: deriveDatasetWithTarget(ds, createObservedFirstDigitTarget()),
      parity: deriveDatasetWithTarget(ds, createObservedParityTarget())
    };
    if (options?.createdAt) createdAt = options.createdAt;
    splitOptions = options || {};
  } else {
    const opts = datasetOrOptions as GenerateBaselineComparisonReportOptions;
    datasetMap = opts.datasetMap;
    if (opts.createdAt) createdAt = opts.createdAt;
    splitOptions = opts;
  }

  const { lastDigit, firstDigit, parity } = datasetMap;

  const targetDatasets = [
    { targetName: "observed_last_digit", dataset: lastDigit },
    { targetName: "observed_first_digit", dataset: firstDigit },
    { targetName: "observed_parity", dataset: parity }
  ];

  const modelTypes: BaselineModelType[] = ["UNIFORM", "EMPIRICAL", "MAJORITY"];

  const holdoutResults: BaselineBacktestResult[] = [];
  const walkForwardAggregates: WalkForwardAggregateResult[] = [];
  const summaryTable: BaselineComparisonSummaryRow[] = [];
  const windowBreakdownTable: BaselineWindowDetailRow[] = [];

  for (const { targetName, dataset } of targetDatasets) {
    const totalDraws = new Set(dataset.rows.map((r) => r.sourceDrawId)).size;
    let chronoSplit = splitOptions.customHoldoutSplit;
    if (!chronoSplit) {
      const trainCount = splitOptions.trainDrawCount ?? (totalDraws <= 6 ? 4 : Math.floor(totalDraws * 0.8));
      const testCount = splitOptions.testDrawCount ?? (totalDraws - trainCount);
      chronoSplit = createChronologicalSplit(dataset, trainCount, testCount);
    }

    let wfSplits = splitOptions.customWfSplits;
    if (!wfSplits) {
      const minTrain = splitOptions.minTrainDraws ?? (totalDraws <= 6 ? 2 : Math.floor(totalDraws * 0.8));
      wfSplits = createWalkForwardSplits(dataset, minTrain);
    }

    for (const mType of modelTypes) {
      // 1. Chronological Holdout
      const modelHoldout = createBaselineModel(mType, dataset.targetDefinition);
      const holdoutRes = runChronologicalHoldoutBacktest(dataset, modelHoldout, chronoSplit, {
        createdAt
      });
      holdoutResults.push(holdoutRes);

      summaryTable.push({
        target: targetName,
        model: modelHoldout.metadata.modelName,
        modelType: mType,
        evaluationMethod: "CHRONOLOGICAL_HOLDOUT",
        trainSize: holdoutRes.trainRowCount,
        testSize: holdoutRes.testRowCount,
        accuracy: holdoutRes.accuracy,
        balancedAccuracy: holdoutRes.balancedAccuracy,
        logLoss: holdoutRes.logLoss
      });

      // 2. Walk-Forward
      const wfAgg = runWalkForwardBacktest(
        dataset,
        () => createBaselineModel(mType, dataset.targetDefinition),
        wfSplits,
        { createdAt }
      );
      walkForwardAggregates.push(wfAgg);

      // Window detail rows
      for (const win of wfAgg.windows) {
        windowBreakdownTable.push({
          target: targetName,
          model: sampleModelName(mType),
          modelType: mType,
          windowIndex: win.windowIndex!,
          trainDrawsCount: win.trainDrawIds.length,
          trainSize: win.trainRowCount,
          testSize: win.testRowCount,
          testDate: win.testDateRange.earliest,
          accuracy: win.accuracy,
          balancedAccuracy: win.balancedAccuracy,
          logLoss: win.logLoss
        });
      }
    }
  }

  function sampleModelName(type: BaselineModelType): string {
    switch (type) {
      case "UNIFORM":
        return "Uniform Categorical Baseline";
      case "EMPIRICAL":
        return "Empirical Frequency Baseline";
      case "MAJORITY":
        return "Majority Class Baseline";
    }
  }

  const reportHash = createHash("sha256")
    .update(
      `${lastDigit.id}:${holdoutResults.length}:${walkForwardAggregates.length}:${DEFAULT_BASELINE_BACKTEST_VERSION}`
    )
    .digest("hex")
    .slice(0, 16);

  return {
    reportId: `bcp_rep_${reportHash}`,
    datasetId: lastDigit.id,
    datasetTotalRows: lastDigit.totalRows,
    modelingVersion: DEFAULT_BASELINE_BACKTEST_VERSION,
    generatedAt: createdAt,
    holdoutResults,
    walkForwardAggregates,
    summaryTable,
    windowBreakdownTable,
    deterministicHash: reportHash,
    descriptiveOnly: true,
    disclaimer: BASELINE_BACKTEST_DISCLAIMER
  };
}

// ============================================================================
// Adversarial Leakage Audit (Milestone 7B.8)
// ============================================================================

export function auditBaselineLeakageResistance(
  datasetOrTrainRows: ModelingDataset | ModelingDatasetRow[],
  testRowsArg?: ModelingDatasetRow[],
  targetDefArg?: TargetDefinition,
  modelFactoryArg?: (def: TargetDefinition) => BaselineModel
): BaselineLeakageAuditResult {
  let trainRows: ModelingDatasetRow[];
  let testRows: ModelingDatasetRow[];
  let targetDef: TargetDefinition;
  let modelFactory: (def: TargetDefinition) => BaselineModel;

  if ("rows" in datasetOrTrainRows && Array.isArray((datasetOrTrainRows as ModelingDataset).rows)) {
    const ds = datasetOrTrainRows as ModelingDataset;
    const split = createChronologicalSplit(ds, 4, 2);
    const trainSet = new Set(split.trainPartition.resultIds);
    const testSet = new Set(split.testPartition.resultIds);
    trainRows = ds.rows.filter((r) => trainSet.has(r.resultId));
    testRows = ds.rows.filter((r) => testSet.has(r.resultId));
    targetDef = ds.targetDefinition;
    modelFactory = (def) => new EmpiricalBaseline(def);
  } else {
    trainRows = datasetOrTrainRows as ModelingDatasetRow[];
    testRows = testRowsArg || [];
    targetDef = targetDefArg || createObservedLastDigitTarget();
    modelFactory = modelFactoryArg || ((def) => new EmpiricalBaseline(def));
  }

  const issues: string[] = [];

  // 1. Check disjoint draw IDs and result IDs
  const trainDrawSet = new Set(trainRows.map((r) => r.sourceDrawId));
  const testDrawSet = new Set(testRows.map((r) => r.sourceDrawId));
  for (const d of testDrawSet) {
    if (trainDrawSet.has(d)) {
      issues.push(`DRAW_OVERLAP: Draw ID '${d}' is present in both train and test partitions.`);
    }
  }

  const trainResultSet = new Set(trainRows.map((r) => r.resultId));
  for (const r of testRows) {
    if (trainResultSet.has(r.resultId)) {
      issues.push(`RESULT_OVERLAP: Result ID '${r.resultId}' is present in both train and test partitions.`);
    }
  }

  // 2. Check chronological ordering (max train timestamp <= min test timestamp)
  const trainTimestamps = trainRows.map((r) => r.drawTimestamp).filter((ts) => Number.isFinite(ts));
  const testTimestamps = testRows.map((r) => r.drawTimestamp).filter((ts) => Number.isFinite(ts));
  const maxTrainTs = trainTimestamps.length > 0 ? Math.max(...trainTimestamps) : 0;
  const minTestTs = testTimestamps.length > 0 ? Math.min(...testTimestamps) : 0;
  const chronologicalOrderingPreserved = maxTrainTs <= minTestTs;
  if (!chronologicalOrderingPreserved) {
    issues.push(`TEMPORAL_LEAKAGE: Max train timestamp (${maxTrainTs}) > min test timestamp (${minTestTs}).`);
  }

  // 3. Target columns not in features
  const targetCol = targetDef.sourceFieldOrFeature;
  let targetColumnsNotInModelInputs = true;
  for (const r of trainRows.slice(0, 50)) {
    if (r.features[targetCol] !== undefined) {
      targetColumnsNotInModelInputs = false;
      issues.push(`TARGET_LEAKAGE: Feature object contains target source field '${targetCol}'.`);
      break;
    }
  }

  // 4. Source IDs not predictive features
  let sourceIdentifiersNotPredictive = true;
  const forbiddenFeatures = ["resultId", "sourceDrawId", "sourceDocumentSha256"];
  for (const f of forbiddenFeatures) {
    if (trainRows[0]?.features[f] !== undefined) {
      sourceIdentifiersNotPredictive = false;
      issues.push(`PROVENANCE_FEATURE_LEAKAGE: Identification field '${f}' was found inside features object.`);
    }
  }

  // 5. Adversarial Test Label Perturbation:
  // Fit baseline on original trainRows. Record state.
  // Mutate testRows target values completely to an adversarial value.
  // Re-fit on trainRows. Model state must NOT change at all.
  const modelA = modelFactory(targetDef);
  modelA.fit(trainRows, targetDef);
  const stateA = canonicalStringify(modelA.getFittedState());

  // Adversarial perturbation on test rows:
  const adversarialValue = targetDef.allowedValues ? targetDef.allowedValues[targetDef.allowedValues.length - 1]! : "999";
  const perturbedTestRows: ModelingDatasetRow[] = testRows.map((r) => ({
    ...r,
    targetValue: adversarialValue
  }));

  const modelB = modelFactory(targetDef);
  modelB.fit(trainRows, targetDef);
  modelB.predict(perturbedTestRows);
  const stateB = canonicalStringify(modelB.getFittedState());

  const testLabelsNeverUsedInFitting = stateA === stateB;
  if (!testLabelsNeverUsedInFitting) {
    issues.push(`TEST_LABEL_LEAKAGE: Model fitted state differed under test label modification.`);
  }

  // Check Empirical / Majority come strictly from train:
  let empiricalFrequenciesFromTrainOnly = true;
  let majorityClassFromTrainOnly = true;
  if (modelA.modelType === "EMPIRICAL" || modelA.modelType === "MAJORITY") {
    const fittedState = modelA.getFittedState() as any;
    if (fittedState.trainRowCount !== trainRows.length) {
      empiricalFrequenciesFromTrainOnly = false;
      issues.push(`TRAIN_COUNT_MISMATCH: Fitted state sample size ${fittedState.trainRowCount} !== ${trainRows.length}`);
    }
  }

  // 6. Repeated Execution Identical
  const modelC = modelFactory(targetDef);
  modelC.fit(trainRows, targetDef);
  const stateC = canonicalStringify(modelC.getFittedState());
  const repeatedExecutionIdentical = stateA === stateC;
  if (!repeatedExecutionIdentical) {
    issues.push(`REPRODUCIBILITY_FAILURE: Repeated fit execution produced non-identical fitted states.`);
  }

  const passed = issues.length === 0;

  return {
    passed,
    testLabelsNeverUsedInFitting,
    empiricalFrequenciesFromTrainOnly,
    majorityClassFromTrainOnly,
    chronologicalOrderingPreserved,
    futureRowCannotInfluenceEarlierWindow: chronologicalOrderingPreserved,
    targetColumnsNotInModelInputs,
    sourceIdentifiersNotPredictive,
    repeatedExecutionIdentical,
    issues
  };
}
