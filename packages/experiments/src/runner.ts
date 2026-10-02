/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 9B: Deterministic Experiment Runner
 *
 * Implements:
 * - Deterministic experiment execution of formal baselines
 * - Strict temporal holdout partitioning
 * - Full leakage protection verification (assertNoTemporalLeakage + validateSplitLeakage)
 * - Seed-controlled reproducibility via Mulberry32 PRNG
 * - Comprehensive error handling and status tracking (PENDING, RUNNING, SUCCEEDED, FAILED)
 * - Result artifact generation with sample predictions and confusion matrix
 * - Absolute non-predictive scientific boundaries
 */

import {
  type ModelingDataset,
  type ModelPrediction,
  createChronologicalSplit,
  validateSplitLeakage,
  evaluateCategoricalPredictions,
  UniformBaseline,
  EmpiricalBaseline,
  MajorityBaseline
} from "@kerala-lottery/statistics";

import {
  type RegisteredExperimentDefinition,
  type ExperimentRun,
  type ResultArtifact,
  type PredictionSampleRow,
  type EvaluationWindowSummary,
  canonicalJsonStringify,
  computeSha256Short,
  deriveExperimentRunId,
  deriveResultArtifactId,
  SCIENTIFIC_EXPERIMENT_DISCLAIMER
} from "./types";

import { assertNoTemporalLeakage, createMulberry32 } from "./index";

export interface RunExperimentOptions {
  seed?: number;
  codeVersion?: string;
  testRatio?: number;
}

export interface ExperimentExecutionOutput {
  run: ExperimentRun;
  artifact?: ResultArtifact;
}

/**
 * Computes deterministic input fingerprint for reproducibility tracking.
 */
export function computeInputFingerprint(params: {
  definitionHash: string;
  datasetHash: string;
  corpusId: string;
  parameters: Record<string, unknown>;
  seed: number;
}): string {
  return computeSha256Short(
    canonicalJsonStringify({
      definitionHash: params.definitionHash,
      datasetHash: params.datasetHash,
      corpusId: params.corpusId,
      parameters: params.parameters,
      seed: params.seed
    })
  );
}

/**
 * Executes a registered experiment against a modeling dataset with full
 * temporal isolation, leakage auditing, and deterministic seed control.
 */
export function executeExperiment(
  definition: RegisteredExperimentDefinition,
  dataset: ModelingDataset,
  options: RunExperimentOptions = {}
): ExperimentExecutionOutput {
  const seed = options.seed ?? (definition.parameters.seed as number) ?? 42;
  const codeVersion = options.codeVersion ?? "9B.1.0-continuous-research";
  const startedAt = new Date().toISOString();

  const inputFingerprint = computeInputFingerprint({
    definitionHash: definition.deterministicHash,
    datasetHash: dataset.deterministicHash,
    corpusId: dataset.corpusId ?? "corpus_unknown",
    parameters: definition.parameters,
    seed
  });

  const baseReproducibility = {
    seed,
    codeVersion,
    inputFingerprint,
    parameters: { ...definition.parameters, seed },
    evaluationFormulae: {
      accuracy: "correct_predictions / total_samples",
      balancedAccuracy: "mean_recall_across_classes",
      logLoss: "-1/N * sum(log(max(eps, min(1-eps, p_observed))))"
    },
    runtimeEnvironment: {
      nodeVersion: process.version,
      platform: process.platform
    }
  };

  // 1. Determine Model Version
  let modelVersion = `mdef_${definition.modelType.toLowerCase()}_v1`;

  // Helper to construct failed run record
  const createFailedRun = (
    stage: "DATASET" | "EXECUTION" | "PERSISTENCE" | "LEAKAGE_VALIDATION",
    code: string,
    message: string,
    diagnostic?: Record<string, unknown>
  ): ExperimentRun => {
    const runId = deriveExperimentRunId({
      experimentId: definition.experimentId,
      experimentVersion: definition.version,
      datasetVersion: dataset.id,
      modelVersion,
      seed
    });

    return {
      runId,
      experimentId: definition.experimentId,
      experimentVersion: definition.version,
      corpusVersion: dataset.corpusId ?? "corpus_unknown",
      datasetVersion: dataset.id,
      featureVersion: dataset.sourceFeatureMatrixId,
      modelVersion,
      status: "FAILED",
      startedAt,
      completedAt: new Date().toISOString(),
      reproducibilityMetadata: baseReproducibility,
      error: {
        code,
        message,
        stage,
        timestamp: new Date().toISOString(),
        diagnostic
      },
      descriptiveOnly: true
    };
  };

  try {
    // 2. Validate Dataset
    if (!dataset.rows || dataset.rows.length === 0) {
      return {
        run: createFailedRun(
          "DATASET",
          "EMPTY_DATASET",
          `Dataset ${dataset.id} contains 0 rows.`
        )
      };
    }

    // 3. Compute Chronological Split
    const uniqueDraws = Array.from(new Set(dataset.rows.map((r) => r.sourceDrawId)));
    if (uniqueDraws.length < 2) {
      return {
        run: createFailedRun(
          "DATASET",
          "INSUFFICIENT_DRAWS",
          `Dataset contains only ${uniqueDraws.length} draws. Minimum required is 2.`
        )
      };
    }

    const testRatio =
      options.testRatio ?? definition.temporalPolicy.testRatio ?? 0.2;
    const testDrawCount = Math.max(1, Math.floor(uniqueDraws.length * testRatio));
    const trainDrawCount = uniqueDraws.length - testDrawCount;

    if (trainDrawCount < 1) {
      return {
        run: createFailedRun(
          "DATASET",
          "INSUFFICIENT_TRAIN_DRAWS",
          `Calculated trainDrawCount (${trainDrawCount}) is less than 1.`
        )
      };
    }

    const split = createChronologicalSplit(dataset, trainDrawCount, testDrawCount);

    // 4. Validate Temporal Leakage Protections (9B.5)
    // Validate split leakage using statistical engine guard
    const leakageCheck = validateSplitLeakage(split, dataset);
    if (!leakageCheck.passed) {
      return {
        run: createFailedRun(
          "LEAKAGE_VALIDATION",
          "LEAKAGE_DETECTED",
          `Temporal split failed leakage check: ${leakageCheck.issues.join("; ")}`,
          { issues: leakageCheck.issues }
        )
      };
    }

    // Validate using experiments leakage assertion
    const trainDates = dataset.rows
      .filter((r) => split.trainPartition.resultIds.includes(r.resultId))
      .map((r) => r.drawDateIso);
    const testCutoffIso = split.testPartition.dateRange.earliestIso;
    try {
      assertNoTemporalLeakage(trainDates, testCutoffIso);
    } catch (leakageErr) {
      return {
        run: createFailedRun(
          "LEAKAGE_VALIDATION",
          "TEMPORAL_LEAKAGE_VIOLATION",
          leakageErr instanceof Error ? leakageErr.message : String(leakageErr)
        )
      };
    }

    // 5. Build Training and Test Partitions
    const trainResultSet = new Set(split.trainPartition.resultIds);
    const testResultSet = new Set(split.testPartition.resultIds);

    const trainRows = dataset.rows.filter((r) => trainResultSet.has(r.resultId));
    const testRows = dataset.rows.filter((r) => testResultSet.has(r.resultId));

    if (trainRows.length === 0 || testRows.length === 0) {
      return {
        run: createFailedRun(
          "DATASET",
          "EMPTY_PARTITION",
          `Train partition (${trainRows.length} rows) or Test partition (${testRows.length} rows) is empty.`
        )
      };
    }

    // 6. Execute Baseline Model
    let predictions: ModelPrediction[];
    let modelInstance: UniformBaseline | EmpiricalBaseline | MajorityBaseline;

    switch (definition.modelType) {
      case "UNIFORM": {
        const uniform = new UniformBaseline(dataset.targetDefinition);
        uniform.fit(trainRows);
        modelVersion = uniform.metadata.modelId;
        modelInstance = uniform;

        // If stochastic prediction sampling is configured, use Mulberry32 PRNG
        if (definition.parameters.stochasticSampling === true) {
          const rng = createMulberry32(seed);
          const allowed = uniform.metadata.parameters.allowedValues || [
            "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"
          ];
          const k = allowed.length;
          const prob = 1 / k;
          const probMap: Record<string, number> = {};
          for (const c of allowed) {
            probMap[c] = prob;
          }

          predictions = testRows.map((r) => {
            const sampleIdx = Math.floor(rng() * k);
            return {
              resultId: r.resultId,
              sourceDrawId: r.sourceDrawId,
              predictedClass: allowed[sampleIdx] ?? allowed[0]!,
              probabilities: { ...probMap },
              observedTarget: r.targetValue
            };
          });
        } else {
          // Standard uniform categorical baseline
          predictions = uniform.predict(testRows);
        }
        break;
      }

      case "EMPIRICAL": {
        const empirical = new EmpiricalBaseline(dataset.targetDefinition);
        empirical.fit(trainRows);
        modelVersion = empirical.metadata.modelId;
        modelInstance = empirical;
        predictions = empirical.predict(testRows);
        break;
      }

      case "MAJORITY": {
        const majority = new MajorityBaseline(dataset.targetDefinition);
        majority.fit(trainRows);
        modelVersion = majority.metadata.modelId;
        modelInstance = majority;
        predictions = majority.predict(testRows);
        break;
      }

      default: {
        return {
          run: createFailedRun(
            "EXECUTION",
            "UNSUPPORTED_MODEL_FAMILY",
            `Unsupported model family: ${(definition as any).modelType}`
          )
        };
      }
    }

    // 7. Evaluate Categorical Predictions
    const evaluation = evaluateCategoricalPredictions(
      predictions,
      dataset.targetDefinition,
      {
        modelId: modelVersion,
        datasetId: dataset.id,
        splitId: split.splitId,
        partition: "TEST"
      }
    );

    const metrics = {
      accuracy:
        evaluation.metrics["accuracy"]?.value ??
        evaluation.metrics["ACCURACY"]?.value ??
        0,
      balancedAccuracy:
        evaluation.metrics["balancedAccuracy"]?.value ??
        evaluation.metrics["BALANCED_ACCURACY"]?.value ??
        0,
      logLoss:
        evaluation.metrics["logLoss"]?.value ??
        evaluation.metrics["LOG_LOSS"]?.value ??
        0,
      sampleSize:
        evaluation.metrics["sampleSize"]?.value ??
        evaluation.metrics["SAMPLE_SIZE"]?.value ??
        evaluation.totalPredictions
    };

    const evaluationWindow: EvaluationWindowSummary = {
      trainDrawCount: split.trainDrawCount,
      testDrawCount: split.testDrawCount,
      trainRowCount: trainRows.length,
      testRowCount: testRows.length,
      trainDateRange: split.trainPartition.dateRange,
      testDateRange: split.testPartition.dateRange
    };

    // 8. Derive Deterministic Run ID
    const runId = deriveExperimentRunId({
      experimentId: definition.experimentId,
      experimentVersion: definition.version,
      datasetVersion: dataset.id,
      modelVersion,
      seed
    });

    const run: ExperimentRun = {
      runId,
      experimentId: definition.experimentId,
      experimentVersion: definition.version,
      corpusVersion: dataset.corpusId ?? "corpus_unknown",
      datasetVersion: dataset.id,
      featureVersion: dataset.sourceFeatureMatrixId,
      modelVersion,
      status: "SUCCEEDED",
      startedAt,
      completedAt: new Date().toISOString(),
      metrics,
      evaluationWindow,
      reproducibilityMetadata: {
        ...baseReproducibility,
        parameters: {
          ...baseReproducibility.parameters,
          trainDrawCount,
          testDrawCount,
          modelParameters: modelInstance.metadata.parameters
        }
      },
      descriptiveOnly: true
    };

    // 9. Generate Deterministic Result Artifact
    const metricsHash = computeSha256Short(canonicalJsonStringify(metrics));
    const artifactId = deriveResultArtifactId({ runId, metricsHash });

    const predictionsSample: PredictionSampleRow[] = testRows.slice(0, 50).map((r, idx) => {
      const pred = predictions[idx];
      const predictedClass = (pred && pred.predictedClass) ? pred.predictedClass : "0";
      const observedTarget = String(r.targetValue);
      return {
        resultId: r.resultId,
        sourceDrawId: r.sourceDrawId,
        canonicalNumber: r.canonicalNumber,
        predictedClass,
        observedTarget,
        isHit: predictedClass === observedTarget
      };
    });

    const artifact: ResultArtifact = {
      artifactId,
      runId,
      experimentId: definition.experimentId,
      experimentVersion: definition.version,
      datasetVersion: dataset.id,
      corpusVersion: dataset.corpusId ?? "corpus_unknown",
      metrics,
      confusionMatrix: evaluation.confusionMatrix
        ? {
            classes: evaluation.confusionMatrix.classes,
            matrix: evaluation.confusionMatrix.matrix,
            totalSamples: evaluation.confusionMatrix.totalSamples
          }
        : undefined,
      predictionsSample,
      deterministicHash: computeSha256Short(
        canonicalJsonStringify({
          artifactId,
          runId,
          metrics,
          predictionsSampleCount: predictionsSample.length
        })
      ),
      createdAt: run.completedAt || new Date().toISOString(),
      disclaimer: SCIENTIFIC_EXPERIMENT_DISCLAIMER,
      descriptiveOnly: true
    };

    return { run, artifact };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const isLeakage =
      (err && typeof err === "object" && (err as any).code === "LEAKAGE_DETECTED") ||
      errorMsg.includes("LEAKAGE") ||
      errorMsg.includes("TEMPORAL_LEAKAGE");

    const stage = isLeakage ? "LEAKAGE_VALIDATION" : "EXECUTION";
    const code = isLeakage ? "LEAKAGE_DETECTED" : "UNCAUGHT_RUN_EXCEPTION";

    return {
      run: createFailedRun(stage, code, errorMsg)
    };
  }
}
