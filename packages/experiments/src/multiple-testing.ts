/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 9C: Multiple-Comparison Control (Bonferroni & Holm Step-Down)
 *
 * Implements:
 * - Bonferroni single-step family-wise error rate (FWER) control
 * - Holm-Bonferroni uniformly more powerful step-down procedure
 * - Experiment family tracking with exploratory vs confirmatory designations
 * - Adjusted significance thresholds and adjusted p-values
 *
 * Non-Predictive Boundary:
 * Rigorously prevents p-hacking or false positive claims across multiple statistical tests.
 */

import type {
  MultipleTestingMethod,
  ExperimentFamilyDesignation,
  MultipleTestingAdjustment
} from "./validation-types";

export interface HypothesisTestInput {
  experimentId: string;
  name: string;
  rawPValue: number;
}

export interface AdjustFamilyOptions {
  familyId: string;
  designation?: ExperimentFamilyDesignation;
  method?: MultipleTestingMethod;
  baseAlpha?: number;
}

/**
 * Adjusts a family of hypotheses using Bonferroni or Holm-Bonferroni correction.
 */
export function adjustMultipleComparisons(
  hypotheses: HypothesisTestInput[],
  options: AdjustFamilyOptions
): Map<string, MultipleTestingAdjustment> {
  const familyId = options.familyId;
  const designation = options.designation ?? "CONFIRMATORY";
  const method = options.method ?? "HOLM_BONFERRONI";
  const baseAlpha = options.baseAlpha ?? 0.05;

  if (baseAlpha <= 0 || baseAlpha >= 1) {
    throw new Error(`baseAlpha must be between 0 and 1, received ${baseAlpha}`);
  }
  if (!hypotheses || hypotheses.length === 0) {
    throw new Error("Cannot adjust empty family of hypotheses");
  }

  const m = hypotheses.length;
  const results = new Map<string, MultipleTestingAdjustment>();

  // Validate p-values
  for (const h of hypotheses) {
    if (isNaN(h.rawPValue) || h.rawPValue < 0 || h.rawPValue > 1) {
      throw new Error(`Invalid raw p-value for ${h.experimentId}: ${h.rawPValue}`);
    }
  }

  if (method === "BONFERRONI") {
    // Single-step Bonferroni: alpha_adj = alpha / m
    const adjustedAlpha = baseAlpha / m;
    hypotheses.forEach((h, idx) => {
      const adjustedPValue = Math.min(1, h.rawPValue * m);
      const isSignificant = adjustedPValue < baseAlpha; // equivalently rawPValue < adjustedAlpha
      results.set(h.experimentId, {
        familyId,
        designation,
        method: "BONFERRONI",
        baseAlpha,
        adjustedAlpha,
        rawPValue: h.rawPValue,
        adjustedPValue,
        isSignificant,
        totalHypothesesInFamily: m,
        rankInFamily: idx + 1
      });
    });
    return results;
  }

  // Holm-Bonferroni Step-Down Procedure
  // 1. Sort hypotheses ascending by raw p-value: p_(1) <= p_(2) <= ... <= p_(m)
  const sorted = [...hypotheses].sort((a, b) => a.rawPValue - b.rawPValue);

  // 2. Compute step-down adjusted p-values:
  // p_adj_(k) = max_{j <= k} min(1, (m - j + 1) * p_(j))
  const adjustedPValues: number[] = new Array(m);
  let runningMax = 0;

  for (let k = 0; k < m; k++) {
    const unadjusted = sorted[k]!.rawPValue;
    const factor = m - k;
    const cand = Math.min(1, unadjusted * factor);
    runningMax = Math.max(runningMax, cand);
    adjustedPValues[k] = runningMax;
  }

  // Re-map to output structure
  for (let k = 0; k < m; k++) {
    const item = sorted[k]!;
    const rank = k + 1;
    const adjustedAlpha = baseAlpha / (m - k); // critical threshold at rank k
    const adjustedPValue = adjustedPValues[k]!;
    const isSignificant = adjustedPValue < baseAlpha;

    results.set(item.experimentId, {
      familyId,
      designation,
      method: "HOLM_BONFERRONI",
      baseAlpha,
      adjustedAlpha,
      rawPValue: item.rawPValue,
      adjustedPValue,
      isSignificant,
      totalHypothesesInFamily: m,
      rankInFamily: rank
    });
  }

  return results;
}

/**
 * Convenience single-hypothesis adjuster when family size is known.
 */
export function adjustSingleHypothesis(
  experimentId: string,
  rawPValue: number,
  totalHypothesesInFamily: number = 3,
  familyId: string = "FAMILY_CANONICAL_BASELINES",
  method: MultipleTestingMethod = "HOLM_BONFERRONI",
  designation: ExperimentFamilyDesignation = "CONFIRMATORY",
  baseAlpha: number = 0.05
): MultipleTestingAdjustment {
  const dummyFamily: HypothesisTestInput[] = [
    { experimentId, name: experimentId, rawPValue }
  ];

  // Fill dummy family up to total hypotheses with typical baseline p-values
  for (let i = 1; i < totalHypothesesInFamily; i++) {
    dummyFamily.push({
      experimentId: `DUMMY-${i}`,
      name: `Dummy Baseline ${i}`,
      rawPValue: 0.50
    });
  }

  const map = adjustMultipleComparisons(dummyFamily, {
    familyId,
    designation,
    method,
    baseAlpha
  });

  return map.get(experimentId)!;
}
