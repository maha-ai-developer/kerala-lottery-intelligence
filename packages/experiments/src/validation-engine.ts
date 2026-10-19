/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 9C: Statistical Validation Engine
 *
 * Implements:
 * - End-to-end execution of statistical validation for an experiment run
 * - Integration of Inference, Null-Model, Multiple-Testing, and Walk-Forward modules
 * - Assembly of the 5-Part Research Interpretation Contract
 * - Deterministic, immutable StatisticalValidationArtifact generation
 *
 * Non-Predictive Boundary:
 * Rigorously grounded in descriptive statistics and physical trial independence.
 */

import type { ModelingDataset } from "@kerala-lottery/statistics";
import {
  type ExperimentRun,
  type ResultArtifact,
  canonicalJsonStringify,
  computeSha256Short
} from "./types";
import {
  type StatisticalValidationArtifact,
  type ResearchInterpretationContract,
  DEFAULT_VALIDATION_METHOD,
  DEFAULT_VALIDATION_VERSION,
  SCIENTIFIC_VALIDATION_DISCLAIMER,
  deriveValidationArtifactId
} from "./validation-types";
import {
  computeWilsonScoreInterval,
  computeNormalConfidenceInterval,
  computeBootstrapEstimate,
  computeEffectSizes,
  computeUncertainty
} from "./inference";
import { evaluateAgainstNullModel } from "./null-models";
import { adjustSingleHypothesis } from "./multiple-testing";
import { evaluateTemporalRobustness } from "./walk-forward";

export interface ValidateRunOptions {
  seed?: number;
  bootstrapIterations?: number;
  nullModelIterations?: number;
  confidenceLevel?: number;
  familyId?: string;
  totalHypothesesInFamily?: number;
}

/**
 * Validates an experiment run against rigorous statistical inference standards.
 */
export function validateExperimentRun(
  run: ExperimentRun,
  artifact: ResultArtifact,
  dataset: ModelingDataset,
  options: ValidateRunOptions = {}
): StatisticalValidationArtifact {
  if (run.status !== "SUCCEEDED") {
    throw new Error(`Cannot validate non-succeeded experiment run. Run ${run.runId} has status: ${run.status}`);
  }

  const seed = options.seed ?? run.reproducibilityMetadata?.seed ?? 42;
  const bootstrapIterations = options.bootstrapIterations ?? 1000;
  const nullModelIterations = options.nullModelIterations ?? 1000;
  const confidenceLevel = options.confidenceLevel ?? 0.95;
  const familyId = options.familyId ?? "FAMILY_CANONICAL_BASELINES";
  const totalHypothesesInFamily = options.totalHypothesesInFamily ?? 3;

  const sampleSize = artifact.metrics.sampleSize || 7850;
  const accuracy = artifact.metrics.accuracy;
  const successes = Math.round(accuracy * sampleSize);

  // 1. Inference Calculations
  const wilsonScoreInterval = computeWilsonScoreInterval(successes, sampleSize, confidenceLevel);

  // Synthesize binary hit array for bootstrap (based on observed sample predictions or accurate ratio)
  const binaryOutcomes: number[] = new Array(sampleSize);
  for (let i = 0; i < sampleSize; i++) {
    binaryOutcomes[i] = i < successes ? 1 : 0;
  }
  const bootstrap = computeBootstrapEstimate(
    binaryOutcomes,
    bootstrapIterations,
    seed,
    confidenceLevel
  );

  const uncertainty = computeUncertainty(successes, sampleSize, confidenceLevel);

  const normalLogLossInterval = computeNormalConfidenceInterval(
    artifact.metrics.logLoss,
    artifact.metrics.logLoss / Math.sqrt(sampleSize),
    confidenceLevel
  );

  const effectSizes = computeEffectSizes(accuracy, 0.10);

  // 2. Null Model Evaluation
  const actualLabelsSample = artifact.predictionsSample.map((s) => s.observedTarget);
  const nullModelComparison = evaluateAgainstNullModel(
    accuracy,
    sampleSize,
    actualLabelsSample.length > 0 ? actualLabelsSample : ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
    {
      nullModelType: "DISCRETE_UNIFORM_NULL",
      iterations: nullModelIterations,
      seed,
      numClasses: 10,
      nullProbability: 0.10
    }
  );

  // 3. Multiple Testing Correction
  const multipleTestingCorrection = adjustSingleHypothesis(
    run.experimentId,
    nullModelComparison.empiricalPValue,
    totalHypothesesInFamily,
    familyId,
    "HOLM_BONFERRONI",
    "CONFIRMATORY",
    1 - confidenceLevel
  );

  // 4. Temporal Robustness
  const temporalRobustness = evaluateTemporalRobustness(dataset);

  // 5. Research Interpretation Contract
  const interpretationContract: ResearchInterpretationContract = {
    observation: `Observed test accuracy across N=${sampleSize.toLocaleString()} holdout results is ${(accuracy * 100).toFixed(2)}% with cross-entropy log loss of ${artifact.metrics.logLoss.toFixed(4)}.`,
    statisticalEvidence: {
      pValue: nullModelComparison.empiricalPValue,
      adjustedPValue: multipleTestingCorrection.adjustedPValue,
      confidenceInterval: [wilsonScoreInterval.lower, wilsonScoreInterval.upper],
      effectSize: effectSizes.cohensH,
      effectSizeMetric: "COHENS_H",
      hypothesisTest: `Holm-Bonferroni adjusted discrete uniform null hypothesis test (${familyId})`
    },
    uncertainty: {
      standardError: uncertainty.standardError,
      sampleSize: uncertainty.sampleSize,
      confidenceLevel: uncertainty.confidenceLevel,
      marginOfError: uncertainty.marginOfError
    },
    interpretation:
      multipleTestingCorrection.adjustedPValue > (1 - confidenceLevel)
        ? `Observed accuracy does not statistically deviate from uniform random physical chance (p_adj = ${multipleTestingCorrection.adjustedPValue.toFixed(4)} > 0.05). Consistent with independent physical lottery draw trials.`
        : `Observed metric exhibits statistical anomaly relative to discrete uniform null (p_adj = ${multipleTestingCorrection.adjustedPValue.toFixed(4)} <= 0.05), warranting further physical process investigation.`,
    limitation:
      "Evaluated retrospectively on canonical historical gazetted publications. State lottery draws are independent physical random processes; historical digit frequencies possess zero predictive validity for future drawings."
  };

  const validationId = deriveValidationArtifactId({
    runId: run.runId,
    validationMethod: DEFAULT_VALIDATION_METHOD,
    validationVersion: DEFAULT_VALIDATION_VERSION,
    seed
  });

  const payloadToHash = {
    validationId,
    runId: run.runId,
    experimentId: run.experimentId,
    accuracy,
    wilsonScoreInterval,
    bootstrapInterval: bootstrap.confidenceInterval,
    effectSizes,
    nullPValue: nullModelComparison.empiricalPValue,
    adjustedPValue: multipleTestingCorrection.adjustedPValue,
    stabilityScore: temporalRobustness.stabilityScore
  };

  const deterministicHash = computeSha256Short(canonicalJsonStringify(payloadToHash));

  return {
    validationId,
    runId: run.runId,
    experimentId: run.experimentId,
    experimentVersion: run.experimentVersion,
    datasetVersion: run.datasetVersion,
    corpusVersion: run.corpusVersion,
    validationMethod: DEFAULT_VALIDATION_METHOD,
    validationVersion: DEFAULT_VALIDATION_VERSION,
    createdAt: new Date().toISOString(),

    confidenceIntervals: {
      accuracy: {
        wilsonScoreInterval,
        bootstrapInterval: bootstrap.confidenceInterval
      },
      logLoss: {
        normalInterval: normalLogLossInterval
      }
    },
    effectSizes,
    uncertainty,
    nullModelComparison,
    multipleTestingCorrection,
    temporalRobustness,
    interpretationContract,
    deterministicHash,
    nonPredictiveNotice: SCIENTIFIC_VALIDATION_DISCLAIMER,
    descriptiveOnly: true
  };
}
