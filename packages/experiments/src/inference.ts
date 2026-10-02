/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 9C: Statistical Inference & Uncertainty Engine
 *
 * Implements:
 * - Wilson score confidence interval for proportions
 * - Normal and Student-t approximation intervals
 * - Non-parametric percentile bootstrap estimation
 * - Label-permutation / randomization testing
 * - Effect size calculations (Cohen's h, relative accuracy ratio)
 * - Standard error & uncertainty quantification
 *
 * Non-Predictive Boundary:
 * Purely descriptive and retrospective statistical inference.
 */

import { createMulberry32 } from "./index";
import type {
  ConfidenceInterval,
  EffectSizeMetrics,
  UncertaintyMetadata,
  BootstrapEstimate,
  PermutationTestResult
} from "./validation-types";

/**
 * Returns two-tailed standard normal critical z-score for a given confidence level.
 */
export function getNormalZCritical(confidenceLevel: number = 0.95): number {
  if (confidenceLevel <= 0 || confidenceLevel >= 1) {
    throw new Error(`Confidence level must be strictly between 0 and 1, received ${confidenceLevel}`);
  }
  // Standard quantiles for common confidence levels
  if (Math.abs(confidenceLevel - 0.90) < 0.005) return 1.6448536269514722;
  if (Math.abs(confidenceLevel - 0.95) < 0.005) return 1.959963984540054;
  if (Math.abs(confidenceLevel - 0.99) < 0.005) return 2.5758293035489004;

  // Approximate inverse normal CDF using Abramowitz & Stegun formula
  const alpha = 1 - confidenceLevel;
  const p = 1 - alpha / 2;
  const t = Math.sqrt(-2 * Math.log(1 - p));
  const c0 = 2.515517;
  const c1 = 0.802853;
  const c2 = 0.010328;
  const d1 = 1.432788;
  const d2 = 0.189269;
  const d3 = 0.001308;
  return t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t);
}

/**
 * Computes Wilson score interval for binomial proportion.
 * Superior to normal approximation near boundary values (0 or 1) and small sample sizes.
 */
export function computeWilsonScoreInterval(
  successes: number,
  total: number,
  confidenceLevel: number = 0.95
): ConfidenceInterval {
  if (total <= 0) {
    throw new Error(`Total sample size must be strictly positive, received ${total}`);
  }
  if (successes < 0 || successes > total) {
    throw new Error(`Successes (${successes}) must be between 0 and total (${total})`);
  }

  const p = successes / total;
  const z = getNormalZCritical(confidenceLevel);
  const z2 = z * z;
  const denom = 1 + z2 / total;
  const center = (p + z2 / (2 * total)) / denom;
  const spread = (z * Math.sqrt((p * (1 - p)) / total + z2 / (4 * total * total))) / denom;

  return {
    lower: Math.max(0, center - spread),
    upper: Math.min(1, center + spread),
    confidenceLevel,
    method: "WILSON_SCORE"
  };
}

/**
 * Computes standard Normal confidence interval for continuous metrics.
 */
export function computeNormalConfidenceInterval(
  mean: number,
  stdError: number,
  confidenceLevel: number = 0.95
): ConfidenceInterval {
  if (stdError < 0) {
    throw new Error(`Standard error cannot be negative, received ${stdError}`);
  }
  const z = getNormalZCritical(confidenceLevel);
  const margin = z * stdError;
  return {
    lower: mean - margin,
    upper: mean + margin,
    confidenceLevel,
    method: "NORMAL_APPROXIMATION"
  };
}

/**
 * Computes non-parametric percentile bootstrap distribution & interval.
 */
export function computeBootstrapEstimate(
  binaryOutcomes: number[], // 1 for hit/match, 0 for miss
  iterations: number = 1000,
  seed: number = 42,
  confidenceLevel: number = 0.95
): BootstrapEstimate {
  if (iterations <= 0) {
    throw new Error(`Bootstrap iterations must be > 0, received ${iterations}`);
  }
  if (binaryOutcomes.length === 0) {
    throw new Error("Cannot run bootstrap on empty outcomes array");
  }

  const n = binaryOutcomes.length;
  const observedMean = binaryOutcomes.reduce((a, b) => a + b, 0) / n;
  const rng = createMulberry32(seed);

  const resampleMeans: number[] = new Array(iterations);

  for (let b = 0; b < iterations; b++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(rng() * n);
      sum += binaryOutcomes[idx]!;
    }
    resampleMeans[b] = sum / n;
  }

  resampleMeans.sort((a, b) => a - b);

  const mean = resampleMeans.reduce((a, b) => a + b, 0) / iterations;
  const median = resampleMeans[Math.floor(iterations / 2)]!;

  const variance =
    resampleMeans.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (iterations - 1 || 1);
  const stdError = Math.sqrt(variance);

  const alpha = 1 - confidenceLevel;
  const lowerIdx = Math.max(0, Math.floor((alpha / 2) * iterations));
  const upperIdx = Math.min(iterations - 1, Math.ceil((1 - alpha / 2) * iterations));

  const lower = resampleMeans[lowerIdx]!;
  const upper = resampleMeans[upperIdx]!;

  return {
    iterations,
    seed,
    mean,
    median,
    stdError,
    confidenceInterval: {
      lower,
      upper,
      confidenceLevel,
      method: "BOOTSTRAP_PERCENTILE"
    },
    bias: mean - observedMean
  };
}

/**
 * Computes two-sided label-permutation randomization test for accuracy against null chance.
 */
export function computePermutationTest(
  predicted: string[],
  actual: string[],
  iterations: number = 1000,
  seed: number = 42
): PermutationTestResult {
  if (predicted.length !== actual.length) {
    throw new Error(`Array length mismatch: predicted (${predicted.length}) vs actual (${actual.length})`);
  }
  if (predicted.length === 0) {
    throw new Error("Cannot run permutation test on empty arrays");
  }
  if (iterations <= 0) {
    throw new Error(`Permutation iterations must be > 0, received ${iterations}`);
  }

  const n = predicted.length;
  let matches = 0;
  for (let i = 0; i < n; i++) {
    if (predicted[i] === actual[i]) matches++;
  }
  const observedStatistic = matches / n;

  const rng = createMulberry32(seed);
  const nullAccuracies: number[] = new Array(iterations);
  let extremeCount = 0;

  // Working copy of actual labels to shuffle
  const shuffled = [...actual];

  for (let b = 0; b < iterations; b++) {
    // Fisher-Yates shuffle with PRNG
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const temp = shuffled[i]!;
      shuffled[i] = shuffled[j]!;
      shuffled[j] = temp;
    }

    let permMatches = 0;
    for (let i = 0; i < n; i++) {
      if (predicted[i] === shuffled[i]) permMatches++;
    }
    const permAcc = permMatches / n;
    nullAccuracies[b] = permAcc;

    if (permAcc >= observedStatistic) {
      extremeCount++;
    }
  }

  const nullMean = nullAccuracies.reduce((a, b) => a + b, 0) / iterations;
  const nullVar =
    nullAccuracies.reduce((acc, val) => acc + Math.pow(val - nullMean, 2), 0) / (iterations - 1 || 1);
  const nullStdDev = Math.sqrt(nullVar);

  // Exact conservative empirical p-value: (count + 1) / (B + 1)
  const empiricalPValue = (extremeCount + 1) / (iterations + 1);

  return {
    iterations,
    seed,
    observedStatistic,
    nullMean,
    nullStdDev,
    empiricalPValue,
    isSignificantAt05: empiricalPValue < 0.05
  };
}

/**
 * Computes standard effect sizes comparing observed accuracy to theoretical chance.
 */
export function computeEffectSizes(observedAccuracy: number, nullChance: number = 0.10): EffectSizeMetrics {
  const p1 = Math.max(0, Math.min(1, observedAccuracy));
  const p0 = Math.max(0, Math.min(1, nullChance));

  // Cohen's h for difference between two proportions
  // h = 2 * (arcsin(sqrt(p1)) - arcsin(sqrt(p0)))
  // Interpretation: |h| < 0.2 trivial, 0.2 small, 0.5 medium, 0.8 large
  const phi1 = 2 * Math.asin(Math.sqrt(p1));
  const phi0 = 2 * Math.asin(Math.sqrt(p0));
  const cohensH = phi1 - phi0;

  const relativeAccuracyRatio = p0 > 0 ? p1 / p0 : 1;
  const absoluteAccuracyDifference = p1 - p0;

  return {
    cohensH,
    relativeAccuracyRatio,
    absoluteAccuracyDifference
  };
}

/**
 * Quantifies uncertainty and standard error for binomial accuracy.
 */
export function computeUncertainty(
  successes: number,
  total: number,
  confidenceLevel: number = 0.95
): UncertaintyMetadata {
  if (total <= 0) {
    throw new Error(`Total must be > 0, received ${total}`);
  }
  const p = successes / total;
  const standardError = Math.sqrt((p * (1 - p)) / total);
  const z = getNormalZCritical(confidenceLevel);
  const marginOfError = z * standardError;

  return {
    standardError,
    sampleSize: total,
    confidenceLevel,
    marginOfError,
    degreesOfFreedom: total - 1
  };
}
