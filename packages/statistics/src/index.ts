/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 5A: Historical Statistical Foundation
 *
 * Deterministic statistical aggregation engine, contracts, and repositories
 * for historical lottery observations.
 */

export * from "./statistical-types";
export * from "./statistical-engine";
export * from "./repository";
export * from "./multi-draw-corpus";
export * from "./historical-analysis-types";
export * from "./historical-analysis-engine";

// ============================================================================
// Core Statistical Math Utilities (Legacy & Mathematical Primitives)
// ============================================================================

export interface DistributionResult {
  counts: Record<string, number>;
  frequencies: Record<string, number>;
  total: number;
}

/**
 * Calculates absolute counts and relative frequencies of items deterministically.
 */
export function calculateFrequency(items: string[]): DistributionResult {
  const counts: Record<string, number> = {};
  const total = items.length;

  for (const item of items) {
    counts[item] = (counts[item] ?? 0) + 1;
  }

  const frequencies: Record<string, number> = {};
  for (const key of Object.keys(counts).sort()) {
    const count = counts[key]!;
    frequencies[key] = total > 0 ? count / total : 0;
  }

  return { counts, frequencies, total };
}

/**
 * Calculates digit distribution across all positions for canonical lottery number strings.
 */
export function calculateDigitDistribution(canonicalNumbers: string[]): Record<number, Record<string, number>> {
  const positionDistributions: Record<number, Record<string, number>> = {};

  for (const num of canonicalNumbers) {
    for (let pos = 0; pos < num.length; pos++) {
      const char = num[pos];
      if (!char) continue;
      if (!positionDistributions[pos]) {
        positionDistributions[pos] = {};
      }
      const dist = positionDistributions[pos]!;
      dist[char] = (dist[char] ?? 0) + 1;
    }
  }

  return positionDistributions;
}

/**
 * Calculates Shannon Entropy in bits for a discrete distribution.
 */
export function calculateEntropy(frequencies: number[]): number {
  let entropy = 0;
  for (const p of frequencies) {
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }
  return entropy;
}

/**
 * Performs Pearson's Chi-Square Goodness-of-Fit Test against expected uniform distribution.
 */
export function calculateChiSquareUniform(observed: number[]): { chiSquare: number; degreesOfFreedom: number } {
  const k = observed.length;
  if (k <= 1) {
    return { chiSquare: 0, degreesOfFreedom: 0 };
  }

  const total = observed.reduce((sum, val) => sum + val, 0);
  const expected = total / k;

  let chiSquare = 0;
  for (const obs of observed) {
    const diff = obs - expected;
    chiSquare += (diff * diff) / (expected || 1);
  }

  return {
    chiSquare,
    degreesOfFreedom: k - 1
  };
}

/**
 * Wald-Wolfowitz Runs Test for randomness on binary or dichotomized sequences.
 */
export function calculateRunsTest(sequence: number[]): { runs: number; n1: number; n2: number; zScore: number } {
  if (sequence.length === 0) {
    return { runs: 0, n1: 0, n2: 0, zScore: 0 };
  }

  const median = [...sequence].sort((a, b) => a - b)[Math.floor(sequence.length / 2)] ?? 0;
  const signs = sequence.map((x) => (x >= median ? 1 : 0));

  let runs = 1;
  let n1 = signs[0] === 1 ? 1 : 0;
  let n2 = signs[0] === 0 ? 1 : 0;

  for (let i = 1; i < signs.length; i++) {
    if (signs[i] !== signs[i - 1]) {
      runs++;
    }
    if (signs[i] === 1) n1++;
    else n2++;
  }

  const total = n1 + n2;
  const mean = total > 0 ? (2 * n1 * n2) / total + 1 : 0;
  const varianceDenominator = total * total * (total - 1);
  const variance =
    varianceDenominator > 0 ? (2 * n1 * n2 * (2 * n1 * n2 - total)) / varianceDenominator : 0;
  const stdDev = Math.sqrt(Math.max(0, variance));
  const zScore = stdDev > 0 ? (runs - mean) / stdDev : 0;

  return { runs, n1, n2, zScore };
}
