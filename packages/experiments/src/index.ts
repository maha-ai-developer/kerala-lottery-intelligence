/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Experiment Engine & Walk-Forward Backtesting Framework
 * 
 * CORE PRINCIPLE:
 * Strict scientific temporal validity.
 * Zero future leakage across predictionCutoff.
 * Every predictive experiment must compare against a random baseline.
 */


export type StrategyName =
  | "uniformRandom"
  | "frequency"
  | "recency"
  | "frequencyRecency"
  | "suffixFrequency"
  | "digitModel"
  | "transitionModel"
  | "logisticRegression"
  | "randomForest"
  | "gradientBoosting"
  | "neuralNetwork";

export interface ExperimentConfig {
  id: string;
  name: string;
  strategy: StrategyName;
  datasetVersion: string;
  featureVersion: string;
  modelVersion: string;
  parameters: Record<string, unknown>;
  randomSeed: number;
  codeVersion: string;
  createdAt: string;
}

export interface PredictionRecord {
  id: string;
  experimentId: string;
  trainingStart: string; // ISO date
  trainingEnd: string; // ISO date
  predictionCutoff: string; // Mandatory cut-off timestamp
  targetDrawId: string;
  targetDrawDate: string;
  predictedNumbers: string[]; // Canonical string representation
  actualNumbers?: string[]; // Actual drawn numbers
  featuresUsed: string[];
  metrics: {
    hit: boolean;
    exactMatches: number;
    suffixMatches: number;
  };
}

/**
 * Validates that training draws strictly precede the prediction cut-off date.
 * Throws an error if temporal leakage is detected.
 */
export function assertNoTemporalLeakage(trainingDrawDates: string[], predictionCutoff: string): void {
  const cutoffTime = new Date(predictionCutoff).getTime();

  for (const drawDate of trainingDrawDates) {
    const drawTime = new Date(drawDate).getTime();
    if (drawTime >= cutoffTime) {
      throw new Error(
        `TEMPORAL LEAKAGE VIOLATION: Training draw date (${drawDate}) is on or after prediction cutoff (${predictionCutoff}).`
      );
    }
  }
}

/**
 * Deterministic pseudo-random number generator (Mulberry32) for reproducible experiments.
 */
export function createMulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Baseline Uniform Random Candidate Generator:
 * Generates canonical lottery number strings with leading zeros preserved.
 */
export function generateUniformRandomCandidate(
  rng: () => number,
  digitLength: number = 4
): string {
  const max = Math.pow(10, digitLength);
  const val = Math.floor(rng() * max);
  return val.toString().padStart(digitLength, "0");
}
