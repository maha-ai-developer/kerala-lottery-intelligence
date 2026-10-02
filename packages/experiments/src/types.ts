/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 9B: Continuous Research & Experimentation Contracts
 *
 * Defines versioned, deterministic, provenance-preserving contracts for:
 * - Version identities (CorpusVersion, FeatureVersion, DatasetVersion, ExperimentVersion, RunId, ResultArtifactId)
 * - Formal Experiment Registry definitions
 * - Experiment Run lifecycle (PENDING, RUNNING, SUCCEEDED, FAILED, PARTIAL, CANCELLED)
 * - Result Artifact representation
 * - Strict Lineage DAG traversal
 *
 * Scientific Boundaries:
 * - Purely descriptive historical modeling and benchmark comparisons.
 * - ZERO predictive claims, gambling advice, or betting recommendations.
 * - Strict temporal isolation with zero future data leakage.
 */

import { createHash } from "node:crypto";
import type {
  MultiDrawLotteryCorpus,
  FeatureMatrix,
  ModelingDataset,
  EvaluationMetricType
} from "@kerala-lottery/statistics";

export const DEFAULT_EXPERIMENT_VERSION = "v1.0.0-continuous-research";

export const SCIENTIFIC_EXPERIMENT_DISCLAIMER =
  "NON-PREDICTIVE MODELING FOUNDATION NOTICE: This experiment evaluates reproducible mathematical baselines on historical Kerala State Lottery publications for empirical statistical study only. State lotteries operate as physically stochastic, independent trials where historical digit distributions have zero predictive validity for future drawings. Any gambling or predictive claims are strictly prohibited and scientifically unfounded.";

// ============================================================================
// 1. Version Identities & Hashes (9B.1)
// ============================================================================

export function canonicalJsonStringify(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map((item) => canonicalJsonStringify(item)).join(",")}]`;
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = keys.map(
    (k) => `${JSON.stringify(k)}:${canonicalJsonStringify((obj as Record<string, unknown>)[k])}`
  );
  return `{${pairs.join(",")}}`;
}

export function computeSha256Short(data: string, length = 16): string {
  return createHash("sha256").update(data).digest("hex").slice(0, length);
}

/**
 * Derives the immutable corpus version string from a MultiDrawLotteryCorpus.
 */
export function deriveCorpusVersion(corpus: MultiDrawLotteryCorpus): string {
  return corpus.id; // Form: `corpus_${corpusHash}`
}

/**
 * Derives the immutable feature version string from a FeatureMatrix.
 */
export function deriveFeatureVersion(featureMatrix: FeatureMatrix): string {
  return featureMatrix.id; // Form: `fmat_${deterministicHash}`
}

/**
 * Derives the immutable modeling dataset version string from a ModelingDataset.
 */
export function deriveDatasetVersion(dataset: ModelingDataset): string {
  return dataset.id; // Form: `mdset_${deterministicHash}`
}

/**
 * Derives the deterministic experiment run ID from its core input parameters.
 */
export function deriveExperimentRunId(params: {
  experimentId: string;
  experimentVersion: string;
  datasetVersion: string;
  modelVersion: string;
  seed: number;
}): string {
  const hash = computeSha256Short(
    [
      params.experimentId,
      params.experimentVersion,
      params.datasetVersion,
      params.modelVersion,
      params.seed.toString()
    ].join("::")
  );
  return `run_${hash}`;
}

/**
 * Derives the deterministic result artifact ID.
 */
export function deriveResultArtifactId(params: {
  runId: string;
  metricsHash: string;
}): string {
  const hash = computeSha256Short(`${params.runId}::${params.metricsHash}`);
  return `art_${hash}`;
}

// ============================================================================
// 2. Experiment Registry Definitions (9B.2)
// ============================================================================

export type BaselineModelFamily = "UNIFORM" | "EMPIRICAL" | "MAJORITY";

export interface RegisteredExperimentDefinition {
  experimentId: string; // e.g. "EXP-001-UNIFORM-BASELINE"
  name: string;
  version: string; // e.g. "1.0.0"
  description: string;
  methodology: string;
  targetId: string;
  targetName: string;
  populationScope: "ALL_POPULATION" | "SIX_DIGIT_FULL_TICKET" | "FOUR_DIGIT_SUFFIX";
  modelType: BaselineModelFamily;
  parameters: Record<string, unknown>;
  metrics: EvaluationMetricType[];
  temporalPolicy: {
    strategy: "CHRONOLOGICAL_HOLDOUT";
    testRatio?: number; // e.g. 0.20 (last 20% draws)
    minTrainDraws?: number;
    testDrawCount?: number;
  };
  researchBoundary: string;
  deterministicHash: string;
}

// ============================================================================
// 3. Experiment Run Contracts & Lifecycle (9B.3)
// ============================================================================

export type ExperimentRunStatus =
  | "PENDING"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "PARTIAL"
  | "CANCELLED";

export interface ExperimentRunMetrics {
  accuracy: number;
  balancedAccuracy: number;
  logLoss: number;
  sampleSize: number;
  top3Accuracy?: number;
  brierScore?: number;
  ece?: number;
}

export interface EvaluationWindowSummary {
  trainDrawCount: number;
  testDrawCount: number;
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
}

export interface ReproducibilityMetadata {
  seed: number;
  codeVersion: string;
  inputFingerprint: string;
  parameters: Record<string, unknown>;
  evaluationFormulae: Record<string, string>;
  runtimeEnvironment: {
    nodeVersion: string;
    platform: string;
  };
}

export interface ExperimentRunError {
  code: string;
  message: string;
  stage: "DATASET" | "EXECUTION" | "PERSISTENCE" | "LEAKAGE_VALIDATION";
  timestamp: string;
  diagnostic?: Record<string, unknown>;
}

export interface ExperimentRun {
  runId: string; // Deterministic: `run_${hash}`
  experimentId: string;
  experimentVersion: string;
  corpusVersion: string;
  datasetVersion: string;
  featureVersion: string;
  modelVersion: string;
  status: ExperimentRunStatus;
  startedAt: string;
  completedAt?: string;
  metrics?: ExperimentRunMetrics;
  evaluationWindow?: EvaluationWindowSummary;
  reproducibilityMetadata: ReproducibilityMetadata;
  error?: ExperimentRunError;
  descriptiveOnly: true;
}

// ============================================================================
// 4. Result Artifact Representation (9B.1)
// ============================================================================

export interface PredictionSampleRow {
  resultId: string;
  sourceDrawId: string;
  canonicalNumber: string;
  predictedClass: string;
  observedTarget: string;
  isHit: boolean;
}

export interface ResultArtifact {
  artifactId: string; // Deterministic: `art_${hash}`
  runId: string;
  experimentId: string;
  experimentVersion: string;
  datasetVersion: string;
  corpusVersion: string;
  metrics: ExperimentRunMetrics;
  confusionMatrix?: {
    classes: string[];
    matrix: Record<string, Record<string, number>>;
    totalSamples: number;
  };
  predictionsSample: PredictionSampleRow[];
  deterministicHash: string;
  createdAt: string;
  disclaimer: string;
  descriptiveOnly: true;
}

// ============================================================================
// 5. Lineage Graph Contract (9B.6)
// ============================================================================

export interface ExperimentLineageStep {
  step:
    | "SOURCE_DOCUMENTS"
    | "DRAWS"
    | "CORPUS"
    | "FEATURE_MATRIX"
    | "MODELING_DATASET"
    | "EXPERIMENT_DEFINITION"
    | "EXPERIMENT_RUN"
    | "RESULT_ARTIFACT";
  identity: string;
  attributes: Record<string, unknown>;
}

export interface ExperimentLineage {
  runId: string;
  experimentId: string;
  experimentVersion: string;
  corpusVersion: string;
  featureVersion: string;
  datasetVersion: string;
  artifactId?: string;
  sourceDocumentCount: number;
  sourceDocumentShas: string[];
  drawCount: number;
  drawIds: string[];
  chain: ExperimentLineageStep[];
  isComplete: boolean;
}
