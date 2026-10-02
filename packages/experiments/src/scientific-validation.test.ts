/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 9C: Scientific Validation & Research Integrity Unit Tests
 *
 * Validates:
 * 1. Statistical inference contracts (Wilson score CI, Bootstrap CI, Permutation tests, Cohen's h)
 * 2. Null-model framework (Reproducible null distributions, Mulberry32 seed control, Empirical p-values)
 * 3. Multiple-comparison control (Bonferroni, Holm step-down, Family tracking)
 * 4. Temporal robustness & walk-forward expanding window (Temporal leakage assertions)
 * 5. Five-part Research Interpretation Contract
 * 6. Validation artifact determinism & bitwise reproducibility
 * 7. Failure safeguards & immutability violations
 */

import { describe, it, expect, beforeAll } from "vitest";
import { join } from "node:path";
import {
  type MultiDrawLotteryCorpus,
  type ModelingDataset,
  buildMultiDrawCorpus,
  extractCorpusFeatures,
  evaluateFeatureMatrix,
  buildModelFeatureMatrix,
  buildModelingDataset,
  createObservedLastDigitTarget
} from "@kerala-lottery/statistics";

import {
  EXP_001_UNIFORM_BASELINE,
  executeExperiment,
  ExperimentRepository,
  loadGraphsFromCache,
  computeWilsonScoreInterval,
  computeNormalConfidenceInterval,
  computeBootstrapEstimate,
  computePermutationTest,
  computeEffectSizes,
  computeUncertainty,
  evaluateAgainstNullModel,
  adjustMultipleComparisons,
  evaluateTemporalRobustness,
  validateExperimentRun,
  deriveValidationArtifactId
} from "./index";

describe("Milestone 9C — Scientific Validation & Research Integrity", () => {
  let dataset: ModelingDataset;

  beforeAll(() => {
    const cacheDir = join(process.cwd(), "data/processed-cache");
    const graphs = loadGraphsFromCache(cacheDir).slice(0, 10);
    const corpus: MultiDrawLotteryCorpus = buildMultiDrawCorpus(graphs);

    const features = extractCorpusFeatures(corpus);
    const report = evaluateFeatureMatrix(features, corpus);
    const { matrix: modelMatrix } = buildModelFeatureMatrix(features, report);
    const targetDef = createObservedLastDigitTarget();

    dataset = buildModelingDataset(modelMatrix, targetDef, {
      populationScopeType: "ALL_POPULATION"
    });
  });

  // ==========================================================================
  // 1. Statistical Inference Contracts
  // ==========================================================================
  describe("1. Statistical Inference Contracts", () => {
    it("computes Wilson score confidence interval correctly", () => {
      // 100 successes out of 1000 trials (p = 0.10)
      const ci = computeWilsonScoreInterval(100, 1000, 0.95);
      expect(ci.method).toBe("WILSON_SCORE");
      expect(ci.confidenceLevel).toBe(0.95);
      expect(ci.lower).toBeGreaterThan(0.08);
      expect(ci.lower).toBeLessThan(0.10);
      expect(ci.upper).toBeGreaterThan(0.10);
      expect(ci.upper).toBeLessThan(0.125);
    });

    it("computes normal confidence interval for continuous log loss", () => {
      const ci = computeNormalConfidenceInterval(2.3026, 0.01, 0.95);
      expect(ci.method).toBe("NORMAL_APPROXIMATION");
      expect(ci.lower).toBeCloseTo(2.3026 - 1.96 * 0.01, 2);
      expect(ci.upper).toBeCloseTo(2.3026 + 1.96 * 0.01, 2);
    });

    it("computes non-parametric bootstrap estimates with seed determinism", () => {
      const data = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // 1 hit in 10
      const b1 = computeBootstrapEstimate(data, 500, 42, 0.95);
      const b2 = computeBootstrapEstimate(data, 500, 42, 0.95);

      expect(b1.mean).toBe(b2.mean);
      expect(b1.confidenceInterval.lower).toBe(b2.confidenceInterval.lower);
      expect(b1.confidenceInterval.upper).toBe(b2.confidenceInterval.upper);
      expect(b1.confidenceInterval.method).toBe("BOOTSTRAP_PERCENTILE");
    });

    it("computes permutation test empirical p-value", () => {
      const predicted = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
      const actual = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"]; // 100% matches
      const perm = computePermutationTest(predicted, actual, 100, 42);

      expect(perm.observedStatistic).toBe(1.0);
      expect(perm.nullMean).toBeLessThan(0.3); // under permutation, matches are low
      expect(perm.empiricalPValue).toBeLessThan(0.05);
      expect(perm.isSignificantAt05).toBe(true);
    });

    it("computes Cohen's h effect size for proportions", () => {
      // Comparison of observed 10.13% vs null 10.00%
      const effects = computeEffectSizes(0.1013, 0.10);
      expect(effects.cohensH).toBeGreaterThan(0);
      expect(effects.cohensH).toBeLessThan(0.02); // trivial difference
      expect(effects.relativeAccuracyRatio).toBeCloseTo(1.013, 3);
      expect(effects.absoluteAccuracyDifference).toBeCloseTo(0.0013, 4);
    });

    it("computes uncertainty and standard error metadata", () => {
      const unc = computeUncertainty(785, 7850, 0.95);
      expect(unc.sampleSize).toBe(7850);
      expect(unc.standardError).toBeCloseTo(Math.sqrt((0.1 * 0.9) / 7850), 4);
      expect(unc.marginOfError).toBeCloseTo(1.96 * unc.standardError, 4);
    });
  });

  // ==========================================================================
  // 2. Null Model Framework
  // ==========================================================================
  describe("2. Null Model Framework", () => {
    it("generates reproducible null distribution with seed control", () => {
      const n1 = evaluateAgainstNullModel(0.1013, 1000, ["0"], {
        nullModelType: "DISCRETE_UNIFORM_NULL",
        iterations: 300,
        seed: 12345
      });

      const n2 = evaluateAgainstNullModel(0.1013, 1000, ["0"], {
        nullModelType: "DISCRETE_UNIFORM_NULL",
        iterations: 300,
        seed: 12345
      });

      expect(n1.mean).toBe(n2.mean);
      expect(n1.stdDev).toBe(n2.stdDev);
      expect(n1.empiricalPValue).toBe(n2.empiricalPValue);
      expect(n1.quantiles.p50).toBe(n2.quantiles.p50);
      expect(n1.mean).toBeCloseTo(0.10, 1);
    });

    it("produces distinct null distributions when seed varies", () => {
      const nA = evaluateAgainstNullModel(0.1013, 1000, ["0"], { seed: 101, iterations: 100 });
      const nB = evaluateAgainstNullModel(0.1013, 1000, ["0"], { seed: 999, iterations: 100 });
      expect(nA.mean).not.toBe(nB.mean);
    });
  });

  // ==========================================================================
  // 3. Multiple Comparison Control
  // ==========================================================================
  describe("3. Multiple Comparison Control", () => {
    it("applies Bonferroni single-step adjustment correctly", () => {
      const hypotheses = [
        { experimentId: "EXP-1", name: "Uniform", rawPValue: 0.02 },
        { experimentId: "EXP-2", name: "Empirical", rawPValue: 0.04 },
        { experimentId: "EXP-3", name: "Majority", rawPValue: 0.15 }
      ];

      const adj = adjustMultipleComparisons(hypotheses, {
        familyId: "FAMILY_BASELINES",
        method: "BONFERRONI",
        baseAlpha: 0.05
      });

      const h1 = adj.get("EXP-1")!;
      expect(h1.adjustedAlpha).toBeCloseTo(0.05 / 3, 4);
      expect(h1.adjustedPValue).toBeCloseTo(0.02 * 3, 4);
      expect(h1.isSignificant).toBe(false); // 0.06 >= 0.05 is not significant

      const h3 = adj.get("EXP-3")!;
      expect(h3.adjustedPValue).toBeCloseTo(0.45, 4);
    });

    it("applies Holm-Bonferroni step-down adjustment correctly", () => {
      const hypotheses = [
        { experimentId: "EXP-1", name: "Exp 1", rawPValue: 0.01 },
        { experimentId: "EXP-2", name: "Exp 2", rawPValue: 0.03 },
        { experimentId: "EXP-3", name: "Exp 3", rawPValue: 0.04 }
      ];

      const adj = adjustMultipleComparisons(hypotheses, {
        familyId: "FAMILY_BASELINES",
        method: "HOLM_BONFERRONI",
        baseAlpha: 0.05
      });

      // Rank 1: p1 = 0.01, factor = 3 -> p_adj = 0.03 < 0.05 -> Significant
      const h1 = adj.get("EXP-1")!;
      expect(h1.adjustedPValue).toBeCloseTo(0.03, 4);
      expect(h1.isSignificant).toBe(true);

      // Rank 2: p2 = 0.03, factor = 2 -> p_adj = max(0.03, 0.06) = 0.06 >= 0.05 -> Not Significant
      const h2 = adj.get("EXP-2")!;
      expect(h2.adjustedPValue).toBeCloseTo(0.06, 4);
      expect(h2.isSignificant).toBe(false);
    });
  });

  // ==========================================================================
  // 4. Temporal Robustness & Walk-Forward Evaluation
  // ==========================================================================
  describe("4. Temporal Robustness & Walk-Forward Evaluation", () => {
    it("executes expanding-window walk-forward evaluation with zero leakage", () => {
      const wf = evaluateTemporalRobustness(dataset, { windowCount: 2, minTrainRatio: 0.5 });
      expect(wf.strategy).toBe("EXPANDING_WINDOW_WALK_FORWARD");
      expect(wf.windowsCount).toBeGreaterThanOrEqual(2);
      expect(wf.zeroLeakageConfirmed).toBe(true);
      expect(wf.stabilityScore).toBeGreaterThanOrEqual(0);
      expect(wf.stabilityScore).toBeLessThanOrEqual(1);

      for (const w of wf.windowResults) {
        expect(w.zeroLeakageConfirmed).toBe(true);
        const trainLatest = new Date(w.trainDateRange.latestIso).getTime();
        const testEarliest = new Date(w.testDateRange.earliestIso).getTime();
        expect(trainLatest).toBeLessThan(testEarliest);
      }
    });
  });

  // ==========================================================================
  // 5. Validation Engine & Artifact Assembly
  // ==========================================================================
  describe("5. Validation Engine & Artifact Assembly", () => {
    it("assembles complete StatisticalValidationArtifact for succeeded run", () => {
      const out = executeExperiment(EXP_001_UNIFORM_BASELINE, dataset, { seed: 42 });
      expect(out.run.status).toBe("SUCCEEDED");

      const valArtifact = validateExperimentRun(out.run, out.artifact!, dataset, {
        seed: 42,
        bootstrapIterations: 200,
        nullModelIterations: 200
      });

      expect(valArtifact.validationId).toMatch(/^val_[a-f0-9]{16}$/);
      expect(valArtifact.runId).toBe(out.run.runId);
      expect(valArtifact.experimentId).toBe("EXP-001-UNIFORM-BASELINE");

      // Check 5-part interpretation contract
      const contract = valArtifact.interpretationContract;
      expect(contract.observation).toContain("Observed test accuracy");
      expect(contract.statisticalEvidence).toBeDefined();
      expect(contract.uncertainty.sampleSize).toBeGreaterThan(0);
      expect(contract.interpretation).toBeDefined();
      expect(contract.limitation).toContain("independent physical random processes");

      // Check non-predictive notice
      expect(valArtifact.nonPredictiveNotice).toContain("SCIENTIFIC RESEARCH INTEGRITY NOTICE");
    });

    it("REPRODUCIBILITY: Re-running validation with identical inputs yields identical artifactId and values", () => {
      const out = executeExperiment(EXP_001_UNIFORM_BASELINE, dataset, { seed: 42 });

      const v1 = validateExperimentRun(out.run, out.artifact!, dataset, {
        seed: 42,
        bootstrapIterations: 200,
        nullModelIterations: 200
      });

      const v2 = validateExperimentRun(out.run, out.artifact!, dataset, {
        seed: 42,
        bootstrapIterations: 200,
        nullModelIterations: 200
      });

      expect(v1.validationId).toBe(v2.validationId);
      expect(v1.deterministicHash).toBe(v2.deterministicHash);
      expect(v1.confidenceIntervals.accuracy.wilsonScoreInterval.lower).toBe(
        v2.confidenceIntervals.accuracy.wilsonScoreInterval.lower
      );
      expect(v1.nullModelComparison.empiricalPValue).toBe(v2.nullModelComparison.empiricalPValue);
    });

    it("derives deterministic validation artifact ID", () => {
      const id1 = deriveValidationArtifactId({
        runId: "run_test_123",
        validationMethod: "STATISTICAL_INFERENCE_V1",
        validationVersion: "1.0.0",
        seed: 42
      });
      const id2 = deriveValidationArtifactId({
        runId: "run_test_123",
        validationMethod: "STATISTICAL_INFERENCE_V1",
        validationVersion: "1.0.0",
        seed: 42
      });
      expect(id1).toBe(id2);
      expect(id1.startsWith("val_")).toBe(true);
    });
  });

  // ==========================================================================
  // 6. Repository Persistence & Failure Safeguards
  // ==========================================================================
  describe("6. Repository Persistence & Failure Safeguards", () => {
    it("saves and retrieves validation artifacts", () => {
      const repo = new ExperimentRepository({ inMemoryOnly: true });
      const out = executeExperiment(EXP_001_UNIFORM_BASELINE, dataset, { seed: 42 });
      const val = validateExperimentRun(out.run, out.artifact!, dataset, {
        seed: 42,
        bootstrapIterations: 100,
        nullModelIterations: 100
      });

      repo.saveValidation(val);
      const retrieved = repo.getValidation(val.validationId);
      expect(retrieved).toEqual(val);

      const byRun = repo.getValidationByRunId(out.run.runId);
      expect(byRun?.validationId).toBe(val.validationId);
    });

    it("IMMUTABILITY: Rejects mutating an existing validation with a differing hash", () => {
      const repo = new ExperimentRepository({ inMemoryOnly: true });
      const out = executeExperiment(EXP_001_UNIFORM_BASELINE, dataset, { seed: 42 });
      const val = validateExperimentRun(out.run, out.artifact!, dataset, {
        seed: 42,
        bootstrapIterations: 100,
        nullModelIterations: 100
      });

      repo.saveValidation(val);

      const corruptedVal = {
        ...val,
        deterministicHash: "tampered_hash_12345"
      };

      expect(() => {
        repo.saveValidation(corruptedVal);
      }).toThrowError(/IMMUTABILITY_VIOLATION/);
    });

    it("FAILS when attempting to validate a non-succeeded run", () => {
      const failedRun: any = {
        runId: "run_failed_mock",
        status: "FAILED",
        experimentId: "EXP-001-UNIFORM-BASELINE"
      };

      expect(() => {
        validateExperimentRun(failedRun, {} as any, dataset);
      }).toThrowError(/Cannot validate non-succeeded experiment run/);
    });

    it("FAILS when invalid iterations or parameters are passed", () => {
      expect(() => {
        evaluateAgainstNullModel(0.10, 100, ["0"], { iterations: -5 });
      }).toThrowError(/Null model iterations must be strictly positive/);
    });
  });
});
