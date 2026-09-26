/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 7A: Modeling Foundation Engine
 *
 * Implements:
 * - Deterministic transformation from 6C ModelFeatureMatrix to 7A ModelingDataset
 * - Target extraction and strict feature/target isolation (preventing target leakage)
 * - Temporal splitting: CHRONOLOGICAL_HOLDOUT and WALK_FORWARD
 * - Comprehensive leakage guards (temporal, draw, result, source-doc, future-date, target leakage)
 * - Baseline reference models (UniformCategoricalBaseline, EmpiricalFrequencyBaseline, MajorityClassBaseline)
 * - HistoricalModel abstraction
 * - Deterministic evaluation metrics (accuracy, balanced accuracy, log loss, confusion matrix)
 * - ModelRun execution and reproducible experiment IDs
 * - Temporal Backtest execution engine
 * - Sample limitation safeguards (INSUFFICIENT_DATA handling for small-data corpus)
 * - In-memory and Firestore-compatible repositories
 */

import { createHash } from "node:crypto";
import type { ModelFeatureMatrix } from "./feature-selection-types";
import {
  DEFAULT_MODELING_VERSION,
  HISTORICAL_MODELING_DISCLAIMER,
  type ModelingPopulationScopeType,
  type ModelingPopulationScope,
  type TargetDefinition,
  type ModelingDatasetRow,
  type ModelingDataset,
  type SplitPartition,
  type DatasetSplit,
  type LeakageValidationResult,
  type ModelDefinition,
  type ModelPrediction,
  type EvaluationMetric,
  type ConfusionMatrix,
  type ModelEvaluation,
  type ModelRun,
  type BacktestDefinition,
  type BacktestWindowResult,
  type BacktestResult,
  type HistoricalModel,
  type HistoricalModelingDatasetRecord,
  type HistoricalModelRunRecord,
  type ModelingDatasetRepository,
  type ModelRunRepository
} from "./modeling-types";

// ============================================================================
// Modeling Validation Error
// ============================================================================

export class ModelingValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ModelingValidationError";
  }
}

// ============================================================================
// Date Parsing & Normalization
// ============================================================================

export function parseDrawDateToIso(dateStr: string): string {
  if (!dateStr) return "";
  const trimmed = dateStr.trim();
  if (trimmed.includes("/")) {
    const parts = trimmed.split("/");
    if (parts.length === 3) {
      const day = parts[0]!.padStart(2, "0");
      const month = parts[1]!.padStart(2, "0");
      const year = parts[2]!;
      return `${year}-${month}-${day}`;
    }
  } else if (trimmed.includes("-")) {
    const parts = trimmed.split("-");
    if (parts.length === 3 && parts[0]!.length === 4) {
      return trimmed;
    }
  }
  return trimmed;
}

export function parseDrawDateToTimestamp(dateStr: string): number {
  const iso = parseDrawDateToIso(dateStr);
  if (!iso) return 0;
  const d = new Date(`${iso}T00:00:00.000Z`);
  return d.getTime();
}

// ============================================================================
// Deterministic Hash Functions
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

export function computeTargetDefinitionHash(
  def: Omit<TargetDefinition, "deterministicHash">
): string {
  const payload = {
    targetId: def.targetId,
    targetName: def.targetName,
    targetVersion: def.targetVersion,
    targetType: def.targetType,
    sourceFieldOrFeature: def.sourceFieldOrFeature,
    allowedValues: def.allowedValues ? [...def.allowedValues].sort() : null,
    derivationRule: def.derivationRule
  };
  return createHash("sha256").update(canonicalStringify(payload)).digest("hex").slice(0, 16);
}

export function computeModelingDatasetHash(
  ds: Omit<ModelingDataset, "id" | "deterministicHash">
): string {
  const payload = {
    sourceModelFeatureMatrixId: ds.sourceModelFeatureMatrixId,
    sourceFeatureMatrixId: ds.sourceFeatureMatrixId,
    sourceFeatureEvaluationId: ds.sourceFeatureEvaluationId,
    corpusId: ds.corpusId,
    modelingVersion: ds.modelingVersion,
    populationScopeHash: ds.populationScope.populationScopeHash,
    featureColumnNames: [...ds.featureColumnNames].sort(),
    targetDefinitionHash: ds.targetDefinition.deterministicHash,
    totalRows: ds.totalRows,
    fullTicketCount: ds.fullTicketCount,
    suffixCount: ds.suffixCount,
    rowSignatures: ds.rows.map((r) => `${r.resultId}:${r.targetValue}:${r.canonicalNumber}`).sort()
  };
  return createHash("sha256").update(canonicalStringify(payload)).digest("hex").slice(0, 16);
}

export function computeDatasetSplitHash(
  split: Omit<DatasetSplit, "splitId" | "deterministicHash">
): string {
  const payload = {
    strategy: split.strategy,
    splitVersion: split.splitVersion,
    trainDrawIds: [...split.trainPartition.drawIds].sort(),
    validationDrawIds: split.validationPartition ? [...split.validationPartition.drawIds].sort() : [],
    testDrawIds: [...split.testPartition.drawIds].sort(),
    totalDraws: split.totalDraws,
    trainDrawCount: split.trainDrawCount,
    testDrawCount: split.testDrawCount,
    seed: split.seed ?? null
  };
  return createHash("sha256").update(canonicalStringify(payload)).digest("hex").slice(0, 16);
}

export function computeModelDefinitionHash(
  modelDef: Omit<ModelDefinition, "modelId" | "deterministicHash">
): string {
  const payload = {
    modelName: modelDef.modelName,
    modelVersion: modelDef.modelVersion,
    modelType: modelDef.modelType,
    targetId: modelDef.targetId,
    parameters: modelDef.parameters
  };
  return createHash("sha256").update(canonicalStringify(payload)).digest("hex").slice(0, 16);
}

export function computeModelEvaluationHash(
  evalObj: Omit<ModelEvaluation, "evaluationId" | "deterministicHash">
): string {
  const payload = {
    modelId: evalObj.modelId,
    datasetId: evalObj.datasetId,
    splitId: evalObj.splitId,
    partitionEvaluated: evalObj.partitionEvaluated,
    metrics: evalObj.metrics,
    totalPredictions: evalObj.totalPredictions
  };
  return createHash("sha256").update(canonicalStringify(payload)).digest("hex").slice(0, 16);
}

export function computeModelRunHash(
  run: Omit<ModelRun, "runId" | "deterministicHash">
): string {
  const payload = {
    experimentId: run.experimentId,
    modelDefinitionHash: run.modelDefinition.deterministicHash,
    datasetId: run.datasetId,
    splitHash: run.split.deterministicHash,
    evaluationHash: run.evaluation.deterministicHash,
    executionVersion: run.executionVersion
  };
  return createHash("sha256").update(canonicalStringify(payload)).digest("hex").slice(0, 16);
}

export function computeBacktestDefinitionHash(
  bkt: Omit<BacktestDefinition, "backtestId" | "deterministicHash">
): string {
  const payload = {
    backtestVersion: bkt.backtestVersion,
    datasetId: bkt.datasetId,
    modelDefinitionHash: bkt.modelDefinition.deterministicHash,
    targetDefinitionHash: bkt.targetDefinition.deterministicHash,
    temporalStrategy: bkt.temporalStrategy,
    minTrainDraws: bkt.minTrainDraws,
    metricTypes: [...bkt.metricTypes].sort()
  };
  return createHash("sha256").update(canonicalStringify(payload)).digest("hex").slice(0, 16);
}

export function computeBacktestResultHash(
  res: Omit<BacktestResult, "deterministicHash">
): string {
  const payload = {
    backtestId: res.backtestId,
    totalWindows: res.totalWindows,
    aggregateMetrics: res.aggregateMetrics,
    windowHashes: res.windows.map((w) => `${w.windowIndex}:${w.testDrawId}:${w.evaluation.deterministicHash}`)
  };
  return createHash("sha256").update(canonicalStringify(payload)).digest("hex").slice(0, 16);
}

// ============================================================================
// Canonical Target Definitions
// ============================================================================

export function createObservedLastDigitTarget(): TargetDefinition {
  const base = {
    targetId: "tgt_observed_last_digit",
    targetName: "observed_last_digit",
    targetVersion: DEFAULT_MODELING_VERSION,
    targetType: "CATEGORICAL" as const,
    description:
      "Observed terminal digit of the canonical lottery number extracted from historical gazette records.",
    sourceFieldOrFeature: "lastDigit",
    allowedValues: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
    derivationRule: "EXTRACT_TERMINAL_DIGIT",
    descriptiveOnly: true as const,
    disclaimer: HISTORICAL_MODELING_DISCLAIMER
  };
  const hash = computeTargetDefinitionHash(base);
  return {
    ...base,
    deterministicHash: hash
  };
}

export function createObservedFirstDigitTarget(): TargetDefinition {
  const base = {
    targetId: "tgt_observed_first_digit",
    targetName: "observed_first_digit",
    targetVersion: DEFAULT_MODELING_VERSION,
    targetType: "CATEGORICAL" as const,
    description:
      "Observed leading digit of the canonical lottery number extracted from historical gazette records.",
    sourceFieldOrFeature: "firstDigit",
    allowedValues: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
    derivationRule: "EXTRACT_LEADING_DIGIT",
    descriptiveOnly: true as const,
    disclaimer: HISTORICAL_MODELING_DISCLAIMER
  };
  const hash = computeTargetDefinitionHash(base);
  return {
    ...base,
    deterministicHash: hash
  };
}

export function createObservedParityTarget(): TargetDefinition {
  const base = {
    targetId: "tgt_observed_parity",
    targetName: "observed_parity",
    targetVersion: DEFAULT_MODELING_VERSION,
    targetType: "CATEGORICAL" as const,
    description:
      "Observed even/odd parity of the terminal digit of the canonical lottery number.",
    sourceFieldOrFeature: "lastDigit",
    allowedValues: ["EVEN", "ODD"],
    derivationRule: "EVEN_ODD_PARITY_FROM_LAST_DIGIT",
    descriptiveOnly: true as const,
    disclaimer: HISTORICAL_MODELING_DISCLAIMER
  };
  const hash = computeTargetDefinitionHash(base);
  return {
    ...base,
    deterministicHash: hash
  };
}

// ============================================================================
// Modeling Dataset Transformation (6C ModelFeatureMatrix -> 7A ModelingDataset)
// ============================================================================

export interface BuildModelingDatasetOptions {
  populationScopeType?: ModelingPopulationScopeType;
  targetLotteryCode?: string;
  targetNumberLength?: number;
  excludeTargetFromFeatures?: boolean; // default true to prevent target leakage
  modelingVersion?: string;
}

export function buildModelingDataset(
  modelMatrix: ModelFeatureMatrix,
  targetDef: TargetDefinition,
  options?: BuildModelingDatasetOptions
): ModelingDataset {
  if (!modelMatrix || !modelMatrix.rows) {
    throw new ModelingValidationError(
      "Cannot build ModelingDataset from undefined or invalid ModelFeatureMatrix",
      "INVALID_SOURCE_MATRIX"
    );
  }

  const version = options?.modelingVersion || DEFAULT_MODELING_VERSION;
  const scopeType = options?.populationScopeType || "ALL_POPULATION";
  const excludeTarget = options?.excludeTargetFromFeatures ?? true;

  // 1. Filter rows by population scope
  let candidateRows = modelMatrix.rows;
  if (scopeType === "SIX_DIGIT_FULL_TICKET") {
    candidateRows = candidateRows.filter(
      (r) => r.resultType === "FULL_TICKET" && r.numberLength === 6
    );
  } else if (scopeType === "FOUR_DIGIT_SUFFIX") {
    candidateRows = candidateRows.filter(
      (r) => r.resultType === "SUFFIX" && r.numberLength === 4
    );
  } else if (scopeType === "SINGLE_LOTTERY") {
    if (!options?.targetLotteryCode) {
      throw new ModelingValidationError(
        "SINGLE_LOTTERY population scope requires targetLotteryCode",
        "MISSING_TARGET_LOTTERY_CODE"
      );
    }
    candidateRows = candidateRows.filter(
      (r) => String(r.values["lotteryCode"]) === options.targetLotteryCode
    );
  }

  // 2. Validate row count
  if (candidateRows.length === 0) {
    throw new ModelingValidationError(
      `EMPTY_DATASET: Population scope '${scopeType}' yielded 0 rows. A modeling dataset must contain observed records.`,
      "EMPTY_DATASET",
      { scopeType, targetLotteryCode: options?.targetLotteryCode }
    );
  }

  // 3. Exclude target feature from featureColumnNames to guarantee zero target leakage
  const targetSourceField = targetDef.sourceFieldOrFeature;
  const featureColumnNames = excludeTarget
    ? modelMatrix.selectedColumnNames.filter((name) => name !== targetSourceField)
    : [...modelMatrix.selectedColumnNames];
  featureColumnNames.sort();

  // 4. Transform rows with explicit target separation and chronological attributes
  let fullTicketCount = 0;
  let suffixCount = 0;
  const drawIdSet = new Set<string>();
  const lotteryCodeSet = new Set<string>();
  const docShaSet = new Set<string>();
  const drawDates: { raw: string; iso: string; ts: number }[] = [];

  const rows: ModelingDatasetRow[] = candidateRows.map((r) => {
    if (r.resultType === "FULL_TICKET") fullTicketCount++;
    if (r.resultType === "SUFFIX") suffixCount++;
    drawIdSet.add(r.sourceDrawId);
    docShaSet.add(r.sourceDocumentSha256);

    const rawLotteryCode = String(r.values["lotteryCode"] ?? "UNKNOWN");
    lotteryCodeSet.add(rawLotteryCode);

    const rawDrawDate = String(r.values["drawDate"] ?? "");
    const drawDateIso = parseDrawDateToIso(rawDrawDate);
    const drawTimestamp = parseDrawDateToTimestamp(rawDrawDate);

    if (rawDrawDate) {
      drawDates.push({ raw: rawDrawDate, iso: drawDateIso, ts: drawTimestamp });
    }

    // Extract target deterministically
    let targetVal: string | number | null = null;
    if (targetDef.targetName === "observed_last_digit") {
      targetVal = String(r.values["lastDigit"] ?? r.canonicalNumber.slice(-1));
    } else if (targetDef.targetName === "observed_first_digit") {
      targetVal = String(r.values["firstDigit"] ?? r.canonicalNumber.slice(0, 1));
    } else if (targetDef.targetName === "observed_parity") {
      const lastDig = Number(r.values["lastDigit"] ?? r.canonicalNumber.slice(-1));
      targetVal = lastDig % 2 === 0 ? "EVEN" : "ODD";
    } else {
      const rawVal = r.values[targetSourceField];
      if (rawVal !== undefined && rawVal !== null) {
        targetVal = targetDef.targetType === "NUMERIC" ? Number(rawVal) : String(rawVal);
      }
    }

    // Extract feature subset excluding target feature
    const features: Record<string, string | number | boolean | null> = {};
    for (const col of featureColumnNames) {
      features[col] = r.values[col] ?? null;
    }

    return {
      resultId: r.resultId,
      sourceDrawId: r.sourceDrawId,
      sourceDocumentSha256: r.sourceDocumentSha256,
      lotteryCode: rawLotteryCode,
      drawDate: rawDrawDate,
      drawDateIso,
      drawTimestamp,
      canonicalNumber: r.canonicalNumber,
      resultType: r.resultType,
      numberLength: r.numberLength,
      features,
      targetValue: targetVal
    };
  });

  // 5. Determine chronological bounds
  drawDates.sort((a, b) => a.ts - b.ts);
  const earliestDate = drawDates[0]?.raw;
  const latestDate = drawDates[drawDates.length - 1]?.raw;
  const earliestIso = drawDates[0]?.iso;
  const latestIso = drawDates[drawDates.length - 1]?.iso;

  // 6. Assemble population scope
  const drawIds = Array.from(drawIdSet).sort();
  const lotteryCodes = Array.from(lotteryCodeSet).sort();
  const documentSha256s = Array.from(docShaSet).sort();

  const scopePayload = {
    sourceFeatureMatrixId: modelMatrix.sourceFeatureMatrixId,
    sourceFeatureEvaluationId: modelMatrix.sourceFeatureEvaluationId,
    sourceModelFeatureMatrixId: modelMatrix.id,
    totalRows: rows.length,
    fullTicketCount,
    suffixCount,
    drawIds,
    drawCount: drawIds.length,
    lotteryCodes,
    documentSha256s,
    dateRange: { earliest: earliestDate, latest: latestDate, earliestIso, latestIso },
    populationScopeType: scopeType,
    targetLotteryCode: options?.targetLotteryCode,
    targetNumberLength: options?.targetNumberLength
  };

  const scopeHash = createHash("sha256")
    .update(canonicalStringify(scopePayload))
    .digest("hex")
    .slice(0, 16);

  const populationScope: ModelingPopulationScope = {
    corpusId: modelMatrix.metadata.corpusId,
    ...scopePayload,
    populationScopeHash: scopeHash
  };

  // 7. Establish limitations
  const limitations: string[] = [];
  if (drawIds.length <= 6) {
    limitations.push(
      `SMALL_SAMPLE_LIMITATION: Dataset contains only ${drawIds.length} historical draws (${rows.length} records). This sample size is insufficient for general-purpose predictive modeling or statistical claims beyond descriptive historical observation.`
    );
  }
  if (rows.length < 50) {
    limitations.push(
      "INSUFFICIENT_DATA: Observation count is below recommended threshold for statistical inference."
    );
  }
  limitations.push(HISTORICAL_MODELING_DISCLAIMER);

  // 8. Compute deterministic identity
  const baseDataset = {
    sourceModelFeatureMatrixId: modelMatrix.id,
    sourceFeatureMatrixId: modelMatrix.sourceFeatureMatrixId,
    sourceFeatureEvaluationId: modelMatrix.sourceFeatureEvaluationId,
    corpusId: modelMatrix.metadata.corpusId,
    modelingVersion: version,
    populationScope,
    featureColumnNames,
    targetDefinition: targetDef,
    totalRows: rows.length,
    fullTicketCount,
    suffixCount,
    rows,
    provenance: `ModelRun -> ModelingDataset(${scopeType}) -> ModelFeatureMatrix(${modelMatrix.id}) -> FeatureMatrix(${modelMatrix.sourceFeatureMatrixId}) -> WinningResults -> Draws -> Official Gazette PDFs`,
    limitations,
    descriptiveOnly: true as const
  };

  const dsHash = computeModelingDatasetHash(baseDataset);

  return {
    id: `mdset_${dsHash}`,
    ...baseDataset,
    deterministicHash: dsHash
  };
}

// ============================================================================
// Leakage Guards
// ============================================================================

export function validateSplitLeakage(
  split: DatasetSplit,
  dataset: ModelingDataset
): LeakageValidationResult {
  const issues: string[] = [];
  let temporalLeakageDetected = false;
  let drawOverlapDetected = false;
  let resultIdOverlapDetected = false;
  let futureDateInTrainDetected = false;
  let targetLeakageDetected = false;
  let sourceDocumentOverlapDetected = false;

  // 1. Draw Overlap Validation
  const trainDrawSet = new Set(split.trainPartition.drawIds);
  const testDrawSet = new Set(split.testPartition.drawIds);
  const valDrawSet = split.validationPartition ? new Set(split.validationPartition.drawIds) : null;

  for (const drawId of testDrawSet) {
    if (trainDrawSet.has(drawId)) {
      drawOverlapDetected = true;
      issues.push(`DRAW_OVERLAP: Draw ID '${drawId}' appears in both TRAIN and TEST partitions.`);
    }
    if (valDrawSet && valDrawSet.has(drawId)) {
      drawOverlapDetected = true;
      issues.push(`DRAW_OVERLAP: Draw ID '${drawId}' appears in both VALIDATION and TEST partitions.`);
    }
  }

  // 2. Result ID Overlap Validation
  const trainResultSet = new Set(split.trainPartition.resultIds);
  const testResultSet = new Set(split.testPartition.resultIds);
  const valResultSet = split.validationPartition ? new Set(split.validationPartition.resultIds) : null;

  for (const rId of testResultSet) {
    if (trainResultSet.has(rId)) {
      resultIdOverlapDetected = true;
      issues.push(`RESULT_OVERLAP: Result ID '${rId}' appears in both TRAIN and TEST partitions.`);
    }
    if (valResultSet && valResultSet.has(rId)) {
      resultIdOverlapDetected = true;
      issues.push(`RESULT_OVERLAP: Result ID '${rId}' appears in both VALIDATION and TEST partitions.`);
    }
  }

  // 3. Temporal Ordering Validation
  const trainMaxTs = parseDrawDateToTimestamp(split.trainPartition.dateRange.latestIso);
  const testMinTs = parseDrawDateToTimestamp(split.testPartition.dateRange.earliestIso);

  if (trainMaxTs >= testMinTs) {
    temporalLeakageDetected = true;
    issues.push(
      `TEMPORAL_LEAKAGE: Latest TRAIN date (${split.trainPartition.dateRange.latestIso}) >= Earliest TEST date (${split.testPartition.dateRange.earliestIso}). Train data must precede Test data chronologically.`
    );
  }

  if (split.validationPartition) {
    const valMinTs = parseDrawDateToTimestamp(split.validationPartition.dateRange.earliestIso);
    const valMaxTs = parseDrawDateToTimestamp(split.validationPartition.dateRange.latestIso);

    if (trainMaxTs >= valMinTs) {
      temporalLeakageDetected = true;
      issues.push(
        `TEMPORAL_LEAKAGE: Latest TRAIN date (${split.trainPartition.dateRange.latestIso}) >= Earliest VALIDATION date (${split.validationPartition.dateRange.earliestIso}).`
      );
    }
    if (valMaxTs >= testMinTs) {
      temporalLeakageDetected = true;
      issues.push(
        `TEMPORAL_LEAKAGE: Latest VALIDATION date (${split.validationPartition.dateRange.latestIso}) >= Earliest TEST date (${split.testPartition.dateRange.earliestIso}).`
      );
    }
  }

  // 4. Future Date in Training Partition Check
  const trainRowDates = dataset.rows
    .filter((r) => trainResultSet.has(r.resultId))
    .map((r) => r.drawTimestamp);
  for (const ts of trainRowDates) {
    if (ts >= testMinTs) {
      futureDateInTrainDetected = true;
      issues.push(
        `FUTURE_DATE_IN_TRAIN: Training row observed at timestamp ${ts} is on or after test boundary ${testMinTs}.`
      );
      break;
    }
  }

  // 5. Source Document Overlap Check
  const trainDocShas = new Set(
    dataset.rows.filter((r) => trainResultSet.has(r.resultId)).map((r) => r.sourceDocumentSha256)
  );
  const testDocShas = new Set(
    dataset.rows.filter((r) => testResultSet.has(r.resultId)).map((r) => r.sourceDocumentSha256)
  );
  for (const sha of testDocShas) {
    if (trainDocShas.has(sha)) {
      sourceDocumentOverlapDetected = true;
      issues.push(
        `SOURCE_DOCUMENT_OVERLAP: Document SHA-256 '${sha}' appears in both TRAIN and TEST partitions.`
      );
    }
  }

  // 6. Target Leakage Validation (Feature Contains Target)
  const targetField = dataset.targetDefinition.sourceFieldOrFeature;
  if (dataset.featureColumnNames.includes(targetField)) {
    targetLeakageDetected = true;
    issues.push(
      `TARGET_LEAKAGE: Feature column '${targetField}' is identical to target definition source field. Features must not include the target outcome.`
    );
  }

  const passed = issues.length === 0;
  return {
    passed,
    temporalLeakageDetected,
    drawOverlapDetected,
    resultIdOverlapDetected,
    futureDateInTrainDetected,
    targetLeakageDetected,
    sourceDocumentOverlapDetected,
    issues
  };
}

// ============================================================================
// Temporal Splitting Strategies
// ============================================================================

interface DrawSummary {
  drawId: string;
  drawDate: string;
  drawDateIso: string;
  drawTimestamp: number;
  resultIds: string[];
}

function extractSortedDraws(dataset: ModelingDataset): DrawSummary[] {
  const drawMap = new Map<string, DrawSummary>();
  for (const row of dataset.rows) {
    if (!drawMap.has(row.sourceDrawId)) {
      drawMap.set(row.sourceDrawId, {
        drawId: row.sourceDrawId,
        drawDate: row.drawDate,
        drawDateIso: row.drawDateIso,
        drawTimestamp: row.drawTimestamp,
        resultIds: []
      });
    }
    drawMap.get(row.sourceDrawId)!.resultIds.push(row.resultId);
  }

  const draws = Array.from(drawMap.values());
  draws.sort((a, b) => a.drawTimestamp - b.drawTimestamp);
  return draws;
}

export function createChronologicalSplit(
  dataset: ModelingDataset,
  trainDrawCount: number,
  testDrawCount: number,
  options?: { validationDrawCount?: number; splitVersion?: string; seed?: number }
): DatasetSplit {
  const draws = extractSortedDraws(dataset);
  const valCount = options?.validationDrawCount ?? 0;
  const totalRequired = trainDrawCount + valCount + testDrawCount;

  if (draws.length < 2) {
    throw new ModelingValidationError(
      `INSUFFICIENT_DATA: Chronological split requires at least 2 draws, but dataset has ${draws.length}.`,
      "INSUFFICIENT_DATA"
    );
  }

  if (draws.length < totalRequired) {
    throw new ModelingValidationError(
      `INSUFFICIENT_DATA: Dataset contains ${draws.length} draws, but split requires ${totalRequired} (train: ${trainDrawCount}, val: ${valCount}, test: ${testDrawCount}).`,
      "INSUFFICIENT_DATA",
      { totalDraws: draws.length, totalRequired }
    );
  }

  const trainDraws = draws.slice(0, trainDrawCount);
  const valDraws = valCount > 0 ? draws.slice(trainDrawCount, trainDrawCount + valCount) : [];
  const testDraws = draws.slice(trainDrawCount + valCount, totalRequired);

  function buildPartition(name: "TRAIN" | "VALIDATION" | "TEST", pDraws: DrawSummary[]): SplitPartition {
    const drawIds = pDraws.map((d) => d.drawId);
    const resultIds = pDraws.flatMap((d) => d.resultIds);
    return {
      name,
      drawIds,
      resultIds,
      rowCount: resultIds.length,
      dateRange: {
        earliest: pDraws[0]!.drawDate,
        latest: pDraws[pDraws.length - 1]!.drawDate,
        earliestIso: pDraws[0]!.drawDateIso,
        latestIso: pDraws[pDraws.length - 1]!.drawDateIso
      }
    };
  }

  const trainPartition = buildPartition("TRAIN", trainDraws);
  const validationPartition = valCount > 0 ? buildPartition("VALIDATION", valDraws) : undefined;
  const testPartition = buildPartition("TEST", testDraws);

  const baseSplit = {
    strategy: "CHRONOLOGICAL_HOLDOUT" as const,
    splitVersion: options?.splitVersion || DEFAULT_MODELING_VERSION,
    trainPartition,
    validationPartition,
    testPartition,
    totalDraws: draws.length,
    trainDrawCount,
    testDrawCount,
    seed: options?.seed
  };

  const splitHash = computeDatasetSplitHash(baseSplit);
  const split: DatasetSplit = {
    splitId: `split_${splitHash}`,
    ...baseSplit,
    deterministicHash: splitHash
  };

  // Run Leakage Guards
  const leakage = validateSplitLeakage(split, dataset);
  if (!leakage.passed) {
    throw new ModelingValidationError(
      `Split validation failed due to detected leakage: ${leakage.issues.join("; ")}`,
      "LEAKAGE_DETECTED",
      { leakage }
    );
  }

  return split;
}

export function createWalkForwardSplits(
  dataset: ModelingDataset,
  minTrainDraws: number = 2,
  options?: { splitVersion?: string }
): DatasetSplit[] {
  const draws = extractSortedDraws(dataset);

  if (draws.length < 2) {
    throw new ModelingValidationError(
      `INSUFFICIENT_DATA: Walk-forward splitting requires at least 2 draws, but dataset contains ${draws.length}.`,
      "INSUFFICIENT_DATA"
    );
  }

  if (draws.length <= minTrainDraws) {
    throw new ModelingValidationError(
      `INSUFFICIENT_DATA: Walk-forward splitting requires total draws (${draws.length}) > minTrainDraws (${minTrainDraws}).`,
      "INSUFFICIENT_DATA",
      { totalDraws: draws.length, minTrainDraws }
    );
  }

  const splits: DatasetSplit[] = [];
  for (let step = minTrainDraws; step < draws.length; step++) {
    const trainDraws = draws.slice(0, step);
    const testDraws = [draws[step]!];

    const trainPartition: SplitPartition = {
      name: "TRAIN",
      drawIds: trainDraws.map((d) => d.drawId),
      resultIds: trainDraws.flatMap((d) => d.resultIds),
      rowCount: trainDraws.flatMap((d) => d.resultIds).length,
      dateRange: {
        earliest: trainDraws[0]!.drawDate,
        latest: trainDraws[trainDraws.length - 1]!.drawDate,
        earliestIso: trainDraws[0]!.drawDateIso,
        latestIso: trainDraws[trainDraws.length - 1]!.drawDateIso
      }
    };

    const testPartition: SplitPartition = {
      name: "TEST",
      drawIds: testDraws.map((d) => d.drawId),
      resultIds: testDraws.flatMap((d) => d.resultIds),
      rowCount: testDraws.flatMap((d) => d.resultIds).length,
      dateRange: {
        earliest: testDraws[0]!.drawDate,
        latest: testDraws[0]!.drawDate,
        earliestIso: testDraws[0]!.drawDateIso,
        latestIso: testDraws[0]!.drawDateIso
      }
    };

    const baseSplit = {
      strategy: "WALK_FORWARD" as const,
      splitVersion: options?.splitVersion || DEFAULT_MODELING_VERSION,
      trainPartition,
      testPartition,
      totalDraws: draws.length,
      trainDrawCount: trainDraws.length,
      testDrawCount: 1
    };

    const splitHash = computeDatasetSplitHash(baseSplit);
    const split: DatasetSplit = {
      splitId: `split_${splitHash}`,
      ...baseSplit,
      deterministicHash: splitHash
    };

    const leakage = validateSplitLeakage(split, dataset);
    if (!leakage.passed) {
      throw new ModelingValidationError(
        `Walk-forward split step ${step} failed leakage check: ${leakage.issues.join("; ")}`,
        "LEAKAGE_DETECTED",
        { step, leakage }
      );
    }

    splits.push(split);
  }

  return splits;
}

// ============================================================================
// Evaluation Metrics Engine
// ============================================================================

export interface EvaluateCategoricalOptions {
  modelId?: string;
  datasetId?: string;
  splitId?: string;
  partition?: "TRAIN" | "VALIDATION" | "TEST";
  evaluatedAt?: string;
  metricVersion?: string;
}

export function evaluateCategoricalPredictions(
  predictions: ModelPrediction[],
  targetDef: TargetDefinition,
  options?: EvaluateCategoricalOptions
): ModelEvaluation {
  const version = options?.metricVersion || DEFAULT_MODELING_VERSION;
  const total = predictions.length;

  // 1. Gather all observed classes + target allowed values
  const classSet = new Set<string>(targetDef.allowedValues || []);
  for (const p of predictions) {
    if (p.observedTarget !== null && p.observedTarget !== undefined) {
      classSet.add(String(p.observedTarget));
    }
    if (p.predictedClass) {
      classSet.add(p.predictedClass);
    }
  }
  const classes = Array.from(classSet).sort();

  // 2. Build Confusion Matrix: matrix[actual][predicted]
  const matrix: Record<string, Record<string, number>> = {};
  for (const actual of classes) {
    matrix[actual] = {};
    for (const pred of classes) {
      matrix[actual][pred] = 0;
    }
  }

  let correctCount = 0;
  let validOutcomeCount = 0;
  let logLossSum = 0;
  let hasProbabilities = false;
  const EPSILON = 1e-15;

  for (const p of predictions) {
    if (p.observedTarget === null || p.observedTarget === undefined) {
      continue;
    }
    validOutcomeCount++;
    const actualStr = String(p.observedTarget);
    const predStr = p.predictedClass || "UNKNOWN";

    if (!matrix[actualStr]) {
      matrix[actualStr] = {};
    }
    matrix[actualStr][predStr] = (matrix[actualStr][predStr] || 0) + 1;

    if (actualStr === predStr) {
      correctCount++;
    }

    if (p.probabilities && typeof p.probabilities === "object") {
      hasProbabilities = true;
      const prob = p.probabilities[actualStr] ?? 0;
      const clipped = Math.max(EPSILON, Math.min(1 - EPSILON, prob));
      logLossSum += -Math.log(clipped);
    }
  }

  // 3. Compute Metrics
  const accuracyValue = validOutcomeCount > 0 ? correctCount / validOutcomeCount : 0;

  // Balanced Accuracy: mean of class recalls
  let classRecallSum = 0;
  let classesWithSupport = 0;
  for (const c of classes) {
    const rowCounts = matrix[c] || {};
    const support = Object.values(rowCounts).reduce((sum, v) => sum + v, 0);
    if (support > 0) {
      const tp = rowCounts[c] || 0;
      classRecallSum += tp / support;
      classesWithSupport++;
    }
  }
  const balancedAccuracyValue = classesWithSupport > 0 ? classRecallSum / classesWithSupport : 0;

  const metrics: Record<string, EvaluationMetric> = {
    accuracy: {
      metricType: "ACCURACY",
      metricName: "Accuracy",
      value: accuracyValue,
      formula: "correct_predictions / total_samples",
      sampleSize: validOutcomeCount,
      missingCount: total - validOutcomeCount,
      metricVersion: version
    },
    balancedAccuracy: {
      metricType: "BALANCED_ACCURACY",
      metricName: "Balanced Accuracy",
      value: balancedAccuracyValue,
      formula: "sum(recall_c) / classes_with_support",
      sampleSize: validOutcomeCount,
      missingCount: total - validOutcomeCount,
      metricVersion: version
    },
    sampleSize: {
      metricType: "SAMPLE_SIZE",
      metricName: "Sample Size",
      value: validOutcomeCount,
      formula: "count(valid_samples)",
      sampleSize: validOutcomeCount,
      missingCount: total - validOutcomeCount,
      metricVersion: version
    }
  };

  if (hasProbabilities && validOutcomeCount > 0) {
    metrics["logLoss"] = {
      metricType: "LOG_LOSS",
      metricName: "Categorical Log Loss",
      value: logLossSum / validOutcomeCount,
      formula: "-sum(log(p_true)) / N",
      sampleSize: validOutcomeCount,
      missingCount: total - validOutcomeCount,
      metricVersion: version
    };
  }

  const confusionMatrix: ConfusionMatrix = {
    classes,
    matrix,
    totalSamples: validOutcomeCount
  };

  const evalBase = {
    modelId: options?.modelId || "UNKNOWN_MODEL",
    datasetId: options?.datasetId || "UNKNOWN_DATASET",
    splitId: options?.splitId || "UNKNOWN_SPLIT",
    partitionEvaluated: options?.partition || "TEST",
    metrics,
    confusionMatrix,
    totalPredictions: total,
    evaluatedAt: options?.evaluatedAt || "2026-09-26T12:00:00.000Z"
  };

  const evalHash = computeModelEvaluationHash(evalBase);
  return {
    evaluationId: `meval_${evalHash}`,
    ...evalBase,
    deterministicHash: evalHash
  };
}

// ============================================================================
// Baseline Models (Historical Reference Models)
// ============================================================================

export class UniformCategoricalBaseline implements HistoricalModel {
  readonly definition: ModelDefinition;
  private allowedValues: string[];
  private targetDef?: TargetDefinition;

  constructor(targetDef: TargetDefinition) {
    this.allowedValues = targetDef.allowedValues ? [...targetDef.allowedValues].sort() : [];
    this.targetDef = targetDef;

    const baseDef = {
      modelName: "Uniform Categorical Baseline",
      modelVersion: DEFAULT_MODELING_VERSION,
      modelType: "BASELINE" as const,
      targetId: targetDef.targetId,
      parameters: { allowedValues: this.allowedValues },
      descriptiveOnly: true as const
    };
    const hash = computeModelDefinitionHash(baseDef);
    this.definition = {
      modelId: `mdef_${hash}`,
      ...baseDef,
      deterministicHash: hash
    };
  }

  fit(_trainRows: ModelingDatasetRow[], targetDef: TargetDefinition): void {
    this.targetDef = targetDef;
    if (targetDef.allowedValues && targetDef.allowedValues.length > 0) {
      this.allowedValues = [...targetDef.allowedValues].sort();
    }
  }

  predict(testRows: ModelingDatasetRow[]): ModelPrediction[] {
    const k = this.allowedValues.length || 1;
    const uniformProb = 1 / k;
    const probMap: Record<string, number> = {};
    for (const val of this.allowedValues) {
      probMap[val] = uniformProb;
    }
    const defaultPred = this.allowedValues[0] || "0";

    return testRows.map((r) => ({
      resultId: r.resultId,
      sourceDrawId: r.sourceDrawId,
      predictedClass: defaultPred,
      probabilities: { ...probMap },
      observedTarget: r.targetValue
    }));
  }

  evaluate(testRows: ModelingDatasetRow[], predictions?: ModelPrediction[]): ModelEvaluation {
    const preds = predictions || this.predict(testRows);
    return evaluateCategoricalPredictions(preds, this.targetDef!, {
      modelId: this.definition.modelId,
      partition: "TEST"
    });
  }
}

export class EmpiricalFrequencyBaseline implements HistoricalModel {
  readonly definition: ModelDefinition;
  private frequencies: Record<string, number> = {};
  private majorityClass: string = "0";
  private targetDef?: TargetDefinition;

  constructor(targetDef: TargetDefinition) {
    this.targetDef = targetDef;
    const baseDef = {
      modelName: "Empirical Frequency Baseline",
      modelVersion: DEFAULT_MODELING_VERSION,
      modelType: "BASELINE" as const,
      targetId: targetDef.targetId,
      parameters: { method: "TRAIN_EMPIRICAL_FREQUENCIES" },
      descriptiveOnly: true as const
    };
    const hash = computeModelDefinitionHash(baseDef);
    this.definition = {
      modelId: `mdef_${hash}`,
      ...baseDef,
      deterministicHash: hash
    };
  }

  fit(trainRows: ModelingDatasetRow[], targetDef: TargetDefinition): void {
    this.targetDef = targetDef;
    const counts: Record<string, number> = {};
    let total = 0;

    for (const r of trainRows) {
      if (r.targetValue !== null && r.targetValue !== undefined) {
        const valStr = String(r.targetValue);
        counts[valStr] = (counts[valStr] || 0) + 1;
        total++;
      }
    }

    this.frequencies = {};
    let bestCount = -1;
    let bestClass = "0";

    const keys = Object.keys(counts).sort();
    for (const k of keys) {
      const c = counts[k]!;
      this.frequencies[k] = total > 0 ? c / total : 0;
      if (c > bestCount) {
        bestCount = c;
        bestClass = k;
      }
    }

    // Ensure all allowed values have an entry
    if (targetDef.allowedValues) {
      for (const val of targetDef.allowedValues) {
        if (this.frequencies[val] === undefined) {
          this.frequencies[val] = 0;
        }
      }
    }

    this.majorityClass = bestClass;
  }

  predict(testRows: ModelingDatasetRow[]): ModelPrediction[] {
    return testRows.map((r) => ({
      resultId: r.resultId,
      sourceDrawId: r.sourceDrawId,
      predictedClass: this.majorityClass,
      probabilities: { ...this.frequencies },
      observedTarget: r.targetValue
    }));
  }

  evaluate(testRows: ModelingDatasetRow[], predictions?: ModelPrediction[]): ModelEvaluation {
    const preds = predictions || this.predict(testRows);
    return evaluateCategoricalPredictions(preds, this.targetDef!, {
      modelId: this.definition.modelId,
      partition: "TEST"
    });
  }
}

export class MajorityClassBaseline implements HistoricalModel {
  readonly definition: ModelDefinition;
  private majorityClass: string = "0";
  private targetDef?: TargetDefinition;

  constructor(targetDef: TargetDefinition) {
    this.targetDef = targetDef;
    const baseDef = {
      modelName: "Majority Class Baseline",
      modelVersion: DEFAULT_MODELING_VERSION,
      modelType: "BASELINE" as const,
      targetId: targetDef.targetId,
      parameters: { strategy: "ARGMAX_TRAIN_CLASS" },
      descriptiveOnly: true as const
    };
    const hash = computeModelDefinitionHash(baseDef);
    this.definition = {
      modelId: `mdef_${hash}`,
      ...baseDef,
      deterministicHash: hash
    };
  }

  fit(trainRows: ModelingDatasetRow[], targetDef: TargetDefinition): void {
    this.targetDef = targetDef;
    const counts: Record<string, number> = {};
    for (const r of trainRows) {
      if (r.targetValue !== null && r.targetValue !== undefined) {
        const valStr = String(r.targetValue);
        counts[valStr] = (counts[valStr] || 0) + 1;
      }
    }

    let bestCount = -1;
    let bestClass = "0";
    for (const k of Object.keys(counts).sort()) {
      const c = counts[k]!;
      if (c > bestCount) {
        bestCount = c;
        bestClass = k;
      }
    }
    this.majorityClass = bestClass;
  }

  predict(testRows: ModelingDatasetRow[]): ModelPrediction[] {
    const probs: Record<string, number> = {};
    if (this.targetDef?.allowedValues) {
      for (const val of this.targetDef.allowedValues) {
        probs[val] = val === this.majorityClass ? 1.0 : 0.0;
      }
    } else {
      probs[this.majorityClass] = 1.0;
    }

    return testRows.map((r) => ({
      resultId: r.resultId,
      sourceDrawId: r.sourceDrawId,
      predictedClass: this.majorityClass,
      probabilities: { ...probs },
      observedTarget: r.targetValue
    }));
  }

  evaluate(testRows: ModelingDatasetRow[], predictions?: ModelPrediction[]): ModelEvaluation {
    const preds = predictions || this.predict(testRows);
    return evaluateCategoricalPredictions(preds, this.targetDef!, {
      modelId: this.definition.modelId,
      partition: "TEST"
    });
  }
}

// ============================================================================
// Model Run & Backtest Execution Engine
// ============================================================================

export interface ExecuteModelRunOptions {
  experimentId?: string;
  executionVersion?: string;
  executedAt?: string;
}

export function executeModelRun(
  model: HistoricalModel,
  dataset: ModelingDataset,
  split: DatasetSplit,
  options?: ExecuteModelRunOptions
): ModelRun {
  const version = options?.executionVersion || DEFAULT_MODELING_VERSION;
  const executedAt = options?.executedAt || "2026-09-26T12:00:00.000Z";

  // Filter train and test rows
  const trainSet = new Set(split.trainPartition.resultIds);
  const testSet = new Set(split.testPartition.resultIds);

  const trainRows = dataset.rows.filter((r) => trainSet.has(r.resultId));
  const testRows = dataset.rows.filter((r) => testSet.has(r.resultId));

  // Fit model on training partition only
  model.fit(trainRows, dataset.targetDefinition);

  // Predict on held-out test partition only
  const predictions = model.predict(testRows);

  // Evaluate on held-out test partition only
  const evaluation = evaluateCategoricalPredictions(predictions, dataset.targetDefinition, {
    modelId: model.definition.modelId,
    datasetId: dataset.id,
    splitId: split.splitId,
    partition: "TEST",
    evaluatedAt: executedAt
  });

  // Deterministic experiment ID
  const expHash = createHash("sha256")
    .update(
      `${model.definition.modelId}:${dataset.id}:${dataset.targetDefinition.targetId}:${split.splitId}`
    )
    .digest("hex")
    .slice(0, 16);
  const experimentId = options?.experimentId || `exp_${expHash}`;

  const baseRun = {
    experimentId,
    modelDefinition: model.definition,
    datasetId: dataset.id,
    split,
    predictions,
    evaluation,
    executionVersion: version,
    executedAt,
    provenance: `ModelRun(${model.definition.modelId}) -> ModelingDataset(${dataset.id}) -> Split(${split.splitId}) -> Held-Out Test Evaluation`,
    limitations: [...dataset.limitations],
    descriptiveOnly: true as const
  };

  const runHash = computeModelRunHash(baseRun);
  return {
    runId: `mrun_${runHash}`,
    ...baseRun,
    deterministicHash: runHash
  };
}

export function executeBacktest(
  dataset: ModelingDataset,
  modelFactory: () => HistoricalModel,
  backtestDef: BacktestDefinition,
  options?: { executedAt?: string }
): BacktestResult {
  const executedAt = options?.executedAt || "2026-09-26T12:00:00.000Z";
  const splits = createWalkForwardSplits(dataset, backtestDef.minTrainDraws);

  const windows: BacktestWindowResult[] = [];
  const accValues: number[] = [];
  const balAccValues: number[] = [];
  const logLossValues: number[] = [];

  for (let idx = 0; idx < splits.length; idx++) {
    const split = splits[idx]!;
    const model = modelFactory();
    const run = executeModelRun(model, dataset, split, { executedAt });

    windows.push({
      windowIndex: idx + 1,
      trainDrawIds: split.trainPartition.drawIds,
      testDrawId: split.testPartition.drawIds[0]!,
      testDrawDate: split.testPartition.dateRange.earliest,
      trainRowCount: split.trainPartition.rowCount,
      testRowCount: split.testPartition.rowCount,
      evaluation: run.evaluation
    });

    if (run.evaluation.metrics["accuracy"]) {
      accValues.push(run.evaluation.metrics["accuracy"].value);
    }
    if (run.evaluation.metrics["balancedAccuracy"]) {
      balAccValues.push(run.evaluation.metrics["balancedAccuracy"].value);
    }
    if (run.evaluation.metrics["logLoss"]) {
      logLossValues.push(run.evaluation.metrics["logLoss"].value);
    }
  }

  function mean(vals: number[]): number {
    return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  }

  const aggregateMetrics: Record<string, number> = {
    meanAccuracy: mean(accValues),
    meanBalancedAccuracy: mean(balAccValues)
  };
  if (logLossValues.length > 0) {
    aggregateMetrics["meanLogLoss"] = mean(logLossValues);
  }

  const baseResult = {
    backtestId: backtestDef.backtestId,
    windows,
    aggregateMetrics,
    totalWindows: windows.length,
    executedAt,
    limitations: [
      `BACKTEST_SAMPLE_LIMITATION: Evaluated across ${windows.length} sequential walk-forward windows on ${splits[0]?.totalDraws || 6} historical draws. Descriptive reference only.`,
      HISTORICAL_MODELING_DISCLAIMER
    ],
    descriptiveOnly: true as const
  };

  const resHash = computeBacktestResultHash(baseResult);
  return {
    ...baseResult,
    deterministicHash: resHash
  };
}

// ============================================================================
// In-Memory Repositories
// ============================================================================

export class InMemoryModelingDatasetRepository implements ModelingDatasetRepository {
  private readonly datasetsById = new Map<string, HistoricalModelingDatasetRecord>();

  async saveDataset(record: HistoricalModelingDatasetRecord): Promise<void> {
    this.datasetsById.set(record.id, JSON.parse(JSON.stringify(record)));
  }

  async getDatasetById(id: string): Promise<HistoricalModelingDatasetRecord | null> {
    const item = this.datasetsById.get(id);
    return item ? JSON.parse(JSON.stringify(item)) : null;
  }

  async listDatasets(limit = 10): Promise<HistoricalModelingDatasetRecord[]> {
    return Array.from(this.datasetsById.values())
      .slice(0, limit)
      .map((item) => JSON.parse(JSON.stringify(item)));
  }

  async countDatasets(): Promise<number> {
    return this.datasetsById.size;
  }
}

export class InMemoryModelRunRepository implements ModelRunRepository {
  private readonly runsById = new Map<string, HistoricalModelRunRecord>();

  async saveModelRun(record: HistoricalModelRunRecord): Promise<void> {
    this.runsById.set(record.id, JSON.parse(JSON.stringify(record)));
  }

  async getModelRunById(id: string): Promise<HistoricalModelRunRecord | null> {
    const item = this.runsById.get(id);
    return item ? JSON.parse(JSON.stringify(item)) : null;
  }

  async listModelRuns(limit = 10): Promise<HistoricalModelRunRecord[]> {
    return Array.from(this.runsById.values())
      .slice(0, limit)
      .map((item) => JSON.parse(JSON.stringify(item)));
  }

  async countModelRuns(): Promise<number> {
    return this.runsById.size;
  }
}
