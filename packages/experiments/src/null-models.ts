/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 9C: Null-Model Framework & Empirical P-Value Evaluation
 *
 * Implements:
 * - Discrete Uniform Null model generation ($P(c) = 1/K$)
 * - Label Permutation Null model generation (preserves exact marginals)
 * - Independent Bernoulli Null model generation
 * - Seed-controlled reproducibility via Mulberry32 PRNG
 * - Empirical p-value calculation with conservative finite-sample correction
 * - Full quantile distribution summary (p01 through p99)
 *
 * Non-Predictive Boundary:
 * Null models serve purely as descriptive baselines for physical randomness.
 */

import { createMulberry32 } from "./index";
import type {
  NullModelType,
  NullModelDistributionSummary
} from "./validation-types";

export interface GenerateNullDistributionOptions {
  nullModelType?: NullModelType;
  iterations?: number;
  seed?: number;
  numClasses?: number; // Default 10 for terminal digit (0-9)
  nullProbability?: number; // Default 0.10
}

/**
 * Computes quantiles from a sorted numeric array.
 */
function computeQuantiles(sortedValues: number[]): {
  p01: number;
  p05: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
  p99: number;
} {
  const n = sortedValues.length;
  const getQ = (q: number) => {
    const idx = Math.min(n - 1, Math.max(0, Math.floor(q * (n - 1))));
    return sortedValues[idx]!;
  };

  return {
    p01: getQ(0.01),
    p05: getQ(0.05),
    p25: getQ(0.25),
    p50: getQ(0.50),
    p75: getQ(0.75),
    p95: getQ(0.95),
    p99: getQ(0.99)
  };
}

/**
 * Generates reproducible null distribution and compares observed metric.
 */
export function evaluateAgainstNullModel(
  observedMetric: number,
  sampleSize: number,
  actualLabels: string[],
  options: GenerateNullDistributionOptions = {}
): NullModelDistributionSummary {
  const nullModelType = options.nullModelType ?? "DISCRETE_UNIFORM_NULL";
  const iterations = options.iterations ?? 1000;
  const seed = options.seed ?? 42;
  const numClasses = options.numClasses ?? 10;
  const nullProb = options.nullProbability ?? 1 / numClasses;

  if (iterations <= 0) {
    throw new Error(`Null model iterations must be strictly positive, received ${iterations}`);
  }
  if (sampleSize <= 0) {
    throw new Error(`Sample size must be strictly positive, received ${sampleSize}`);
  }

  const rng = createMulberry32(seed);
  const nullValues: number[] = new Array(iterations);
  let countGreaterOrEqual = 0;

  switch (nullModelType) {
    case "DISCRETE_UNIFORM_NULL": {
      // Simulate random uniform categorical classification
      for (let b = 0; b < iterations; b++) {
        let hits = 0;
        for (let i = 0; i < sampleSize; i++) {
          if (rng() < nullProb) hits++;
        }
        const val = hits / sampleSize;
        nullValues[b] = val;
        if (val >= observedMetric) countGreaterOrEqual++;
      }
      break;
    }

    case "LABEL_PERMUTATION_NULL": {
      if (!actualLabels || actualLabels.length === 0) {
        throw new Error("LABEL_PERMUTATION_NULL requires non-empty actualLabels array");
      }
      const n = actualLabels.length;
      const shuffled = [...actualLabels];
      // Fixed reference for evaluation (e.g. uniform guess or observed order)
      for (let b = 0; b < iterations; b++) {
        // Fisher-Yates shuffle
        for (let i = n - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          const tmp = shuffled[i]!;
          shuffled[i] = shuffled[j]!;
          shuffled[j] = tmp;
        }

        let hits = 0;
        for (let i = 0; i < n; i++) {
          if (actualLabels[i] === shuffled[i]) hits++;
        }
        const val = hits / n;
        nullValues[b] = val;
        if (val >= observedMetric) countGreaterOrEqual++;
      }
      break;
    }

    case "INDEPENDENT_BERNOULLI_NULL": {
      for (let b = 0; b < iterations; b++) {
        let hits = 0;
        for (let i = 0; i < sampleSize; i++) {
          if (rng() < nullProb) hits++;
        }
        const val = hits / sampleSize;
        nullValues[b] = val;
        if (val >= observedMetric) countGreaterOrEqual++;
      }
      break;
    }

    default:
      throw new Error(`Unsupported null model type: ${nullModelType}`);
  }

  // Calculate descriptive statistics of null distribution
  const sum = nullValues.reduce((acc, v) => acc + v, 0);
  const mean = sum / iterations;
  const variance =
    nullValues.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (iterations - 1 || 1);
  const stdDev = Math.sqrt(variance);

  // Exact finite-sample empirical p-value: (count + 1) / (B + 1)
  const empiricalPValue = (countGreaterOrEqual + 1) / (iterations + 1);

  // Z-score
  const zScore = stdDev > 0 ? (observedMetric - mean) / stdDev : 0;

  // Sorted values for quantiles
  const sortedValues = [...nullValues].sort((a, b) => a - b);
  const min = sortedValues[0]!;
  const max = sortedValues[sortedValues.length - 1]!;
  const quantiles = computeQuantiles(sortedValues);

  return {
    nullModelType,
    iterations,
    seed,
    mean,
    stdDev,
    min,
    max,
    quantiles,
    observedValue: observedMetric,
    zScore,
    empiricalPValue
  };
}
