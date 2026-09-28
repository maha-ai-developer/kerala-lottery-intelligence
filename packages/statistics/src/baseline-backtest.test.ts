/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 7B: Baseline Models & Historical Backtesting Test Suite
 *
 * Dedicated tests for 7B requirements:
 * A. Uniform probabilities
 * B. Empirical probabilities
 * C. Majority selection
 * D. Tie-breaking
 * E. Probability normalization
 * F. Accuracy
 * G. Balanced accuracy
 * H. Log loss
 * I. Confusion matrix
 * J. Chronological splitting
 * K. Training-only fitting
 * L. Walk-forward evaluation
 * M. Deterministic reproducibility
 * N. Leakage resistance (adversarial tests)
 * O. Result identity/hash stability
 *
 * Edge cases:
 * - empty class in training
 * - single-class training
 * - ties
 * - unknown test class
 * - zero-probability class
 * - minimal dataset
 * - identical repeated execution
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  PdfPageExtractorService,
  DocumentSemanticSegmentationService,
  LotteryEntityExtractorService,
  computeSha256
} from "@kerala-lottery/documents";
import {
  buildLotteryKnowledgeGraph,
  validateLotteryKnowledgeGraph,
  LotteryKnowledgeGraph
} from "@kerala-lottery/knowledge";
import {
  buildMultiDrawCorpus,
  CANONICAL_6_BASELINE_FILES,
  extractCorpusFeatures,
  evaluateFeatureMatrix,
  buildModelFeatureMatrix,
  DEFAULT_FEATURE_SELECTION_VERSION,
  createObservedLastDigitTarget,
  buildModelingDataset,
  ModelingDataset,
  ModelingDatasetRow
} from "./index";
import {
  UniformBaseline,
  EmpiricalBaseline,
  MajorityBaseline,
  computeLogLoss,
  computeConfusionMatrix,
  computeAccuracy,
  computeBalancedAccuracy,
  runChronologicalHoldoutBacktest,
  runWalkForwardBacktest,
  generateBaselineComparisonReport,
  auditBaselineLeakageResistance,
  ZERO_PROBABILITY_POLICY,
  TIE_BREAKING_STRATEGY,
  BASELINE_BACKTEST_DISCLAIMER
} from "./baseline-backtest-engine";

describe("Milestone 7B: Baseline Models & Historical Backtesting", () => {
  const LOTTERY_RESULTS_DIR = join(process.cwd(), "data/source-documents/lottery-results");
  let realDataset: ModelingDataset;

  beforeAll(async () => {
    if (!existsSync(LOTTERY_RESULTS_DIR)) return;

    const canonicalSet = new Set<string>(CANONICAL_6_BASELINE_FILES);
    const files = readdirSync(LOTTERY_RESULTS_DIR)
      .filter((f) => canonicalSet.has(f))
      .sort();

    const extractor = new PdfPageExtractorService();
    const segService = new DocumentSemanticSegmentationService();
    const entityService = new LotteryEntityExtractorService();

    const graphs: LotteryKnowledgeGraph[] = [];
    for (const filename of files) {
      const pdfBytes = readFileSync(join(LOTTERY_RESULTS_DIR, filename));
      const sha256 = computeSha256(new Uint8Array(pdfBytes));
      const extRes = await extractor.extractPages(new Uint8Array(pdfBytes), sha256);
      const segmentation = segService.segmentDocument(extRes.pages);
      const extraction = entityService.extract(segmentation, extRes.pages);
      const graph = buildLotteryKnowledgeGraph(extraction, segmentation);
      validateLotteryKnowledgeGraph(graph);
      graphs.push(graph);
    }

    const testCorpus = buildMultiDrawCorpus(graphs);
    const sourceMatrix = extractCorpusFeatures(testCorpus);
    const evaluationReport = evaluateFeatureMatrix(sourceMatrix, testCorpus);

    const result = buildModelFeatureMatrix(sourceMatrix, evaluationReport, {
      selectionVersion: DEFAULT_FEATURE_SELECTION_VERSION,
      evaluatedAt: "2026-09-26T12:00:00.000Z"
    });
    const modelMatrix = result.matrix;

    const targetDef = createObservedLastDigitTarget();
    realDataset = buildModelingDataset(modelMatrix, targetDef);
  });

  // Helper to make mock rows
  function createMockRow(id: string, drawId: string, drawDate: string, targetVal: string): ModelingDatasetRow {
    return {
      resultId: id,
      sourceDrawId: drawId,
      sourceDocumentSha256: `sha_${drawId}`,
      lotteryCode: "TEST",
      drawDate,
      drawDateIso: drawDate,
      drawTimestamp: new Date(drawDate).getTime(),
      canonicalNumber: `12345${targetVal.slice(-1)}`,
      resultType: "FULL_TICKET",
      numberLength: 6,
      features: { test_feature: 1 },
      targetValue: targetVal
    };
  }

  // --------------------------------------------------------------------------
  // A. Uniform Baseline Probabilities
  // --------------------------------------------------------------------------
  describe("7B.1A: Uniform Baseline", () => {
    it("assigns 1/K probability to every class and sums to 1.0", () => {
      const model = new UniformBaseline();
      const trainRows = [
        createMockRow("r1", "d1", "2024-01-01", "0"),
        createMockRow("r2", "d1", "2024-01-01", "1")
      ];
      const allowed = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
      model.fit(trainRows, "observed_last_digit", allowed);

      const testRows = [createMockRow("r3", "d2", "2024-01-02", "5")];
      const probs = model.predictProbabilities(testRows);

      expect(probs).toHaveLength(1);
      const probMap = probs[0]!;
      expect(Object.keys(probMap)).toHaveLength(10);
      for (const cls of allowed) {
        expect(probMap[cls]).toBeCloseTo(0.1, 10);
      }
      const sum = Object.values(probMap).reduce((s, p) => s + p, 0);
      expect(sum).toBeCloseTo(1.0, 10);
    });

    it("evaluates binary parity target with K=2 and probability 0.5 each", () => {
      const model = new UniformBaseline();
      const trainRows = [createMockRow("r1", "d1", "2024-01-01", "EVEN")];
      const allowed = ["EVEN", "ODD"];
      model.fit(trainRows, "observed_parity", allowed);

      const testRows = [createMockRow("r2", "d2", "2024-01-02", "ODD")];
      const probs = model.predictProbabilities(testRows);
      expect(probs[0]!["EVEN"]).toBeCloseTo(0.5, 10);
      expect(probs[0]!["ODD"]).toBeCloseTo(0.5, 10);
    });

    it("predicts the lexicographically lowest allowed class deterministically", () => {
      const model = new UniformBaseline();
      model.fit([], "observed_last_digit", ["9", "3", "0", "5"]);
      const preds = model.predictClasses([createMockRow("r1", "d1", "2024-01-01", "9")]);
      expect(preds[0]).toBe("0");
    });
  });

  // --------------------------------------------------------------------------
  // B. Empirical Baseline Probabilities
  // --------------------------------------------------------------------------
  describe("7B.1B: Empirical Baseline", () => {
    it("calculates training-only frequencies count_train(c) / N_train", () => {
      const model = new EmpiricalBaseline();
      const trainRows = [
        createMockRow("r1", "d1", "2024-01-01", "0"),
        createMockRow("r2", "d1", "2024-01-01", "0"),
        createMockRow("r3", "d1", "2024-01-01", "1"),
        createMockRow("r4", "d1", "2024-01-01", "2")
      ];
      const allowed = ["0", "1", "2", "3"];
      model.fit(trainRows, "observed_last_digit", allowed);

      const probs = model.predictProbabilities([createMockRow("r5", "d2", "2024-01-02", "0")]);
      const p = probs[0]!;

      expect(p["0"]).toBeCloseTo(2 / 4, 10);
      expect(p["1"]).toBeCloseTo(1 / 4, 10);
      expect(p["2"]).toBeCloseTo(1 / 4, 10);
      expect(p["3"]).toBe(0); // empty in training
      const sum = Object.values(p).reduce((s, v) => s + v, 0);
      expect(sum).toBeCloseTo(1.0, 10);
    });

    it("predicts argmax with lexicographical tie-breaking", () => {
      const model = new EmpiricalBaseline();
      // Tied at 2 occurrences each: "B" and "A"
      const trainRows = [
        createMockRow("r1", "d1", "2024-01-01", "B"),
        createMockRow("r2", "d1", "2024-01-01", "B"),
        createMockRow("r3", "d1", "2024-01-01", "A"),
        createMockRow("r4", "d1", "2024-01-01", "A")
      ];
      model.fit(trainRows, "observed_last_digit", ["A", "B"]);
      const preds = model.predictClasses([createMockRow("r5", "d2", "2024-01-02", "A")]);
      expect(preds[0]).toBe("A"); // "A" sorts before "B"
    });
  });

  // --------------------------------------------------------------------------
  // C. Majority Baseline & Representation
  // --------------------------------------------------------------------------
  describe("7B.1C: Majority Baseline", () => {
    it("selects the most frequent class in training data only", () => {
      const model = new MajorityBaseline();
      const trainRows = [
        createMockRow("r1", "d1", "2024-01-01", "7"),
        createMockRow("r2", "d1", "2024-01-01", "7"),
        createMockRow("r3", "d1", "2024-01-01", "3")
      ];
      model.fit(trainRows, "observed_last_digit", ["3", "7"]);
      const preds = model.predictClasses([createMockRow("r4", "d2", "2024-01-02", "3")]);
      expect(preds[0]).toBe("7");
    });

    it("represents probability as 1.0 on majority class and 0.0 on others (sums to 1.0)", () => {
      const model = new MajorityBaseline();
      const trainRows = [
        createMockRow("r1", "d1", "2024-01-01", "EVEN"),
        createMockRow("r2", "d1", "2024-01-01", "EVEN"),
        createMockRow("r3", "d1", "2024-01-01", "ODD")
      ];
      model.fit(trainRows, "observed_parity", ["EVEN", "ODD"]);
      const probs = model.predictProbabilities([createMockRow("r4", "d2", "2024-01-02", "ODD")]);
      expect(probs[0]!["EVEN"]).toBe(1.0);
      expect(probs[0]!["ODD"]).toBe(0.0);
      expect((probs[0]!["EVEN"] ?? 0) + (probs[0]!["ODD"] ?? 0)).toBe(1.0);
    });
  });

  // --------------------------------------------------------------------------
  // D. Tie-breaking Determinism
  // --------------------------------------------------------------------------
  describe("7B.1D: Deterministic Tie-breaking (LEXICOGRAPHICAL_ASCENDING)", () => {
    it("breaks ties by picking the lexicographically ascending class", () => {
      const empirical = new EmpiricalBaseline();
      const majority = new MajorityBaseline();

      const trainRows = [
        createMockRow("r1", "d1", "2024-01-01", "9"),
        createMockRow("r2", "d1", "2024-01-01", "1"),
        createMockRow("r3", "d1", "2024-01-01", "5")
      ];
      const classes = ["1", "5", "9"];

      empirical.fit(trainRows, "observed_last_digit", classes);
      majority.fit(trainRows, "observed_last_digit", classes);

      const test = [createMockRow("r4", "d2", "2024-01-02", "9")];
      expect(empirical.predictClasses(test)[0]).toBe("1");
      expect(majority.predictClasses(test)[0]).toBe("1");
      expect(TIE_BREAKING_STRATEGY).toBe("LEXICOGRAPHICAL_ASCENDING");
    });
  });

  // --------------------------------------------------------------------------
  // E. Probability Normalization
  // --------------------------------------------------------------------------
  describe("7B.3E: Probability Normalization", () => {
    it("ensures probabilities sum strictly to 1.0 across all baselines", () => {
      const trainRows = [
        createMockRow("r1", "d1", "2024-01-01", "0"),
        createMockRow("r2", "d1", "2024-01-01", "1"),
        createMockRow("r3", "d1", "2024-01-01", "2")
      ];
      const classes = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
      const testRows = [createMockRow("t1", "d2", "2024-01-02", "3")];

      const u = new UniformBaseline();
      u.fit(trainRows, "observed_last_digit", classes);
      const uProbs = u.predictProbabilities(testRows)[0]!;
      const uSum = Object.values(uProbs).reduce((s, p) => s + p, 0);
      expect(uSum).toBeCloseTo(1.0, 10);

      const e = new EmpiricalBaseline();
      e.fit(trainRows, "observed_last_digit", classes);
      const eProbs = e.predictProbabilities(testRows)[0]!;
      const eSum = Object.values(eProbs).reduce((s, p) => s + p, 0);
      expect(eSum).toBeCloseTo(1.0, 10);

      const m = new MajorityBaseline();
      m.fit(trainRows, "observed_last_digit", classes);
      const mProbs = m.predictProbabilities(testRows)[0]!;
      const mSum = Object.values(mProbs).reduce((s, p) => s + p, 0);
      expect(mSum).toBeCloseTo(1.0, 10);
    });
  });

  // --------------------------------------------------------------------------
  // F, G, H, I: Metrics (Accuracy, Balanced Accuracy, Log Loss, Confusion Matrix)
  // --------------------------------------------------------------------------
  describe("7B.3 Metrics", () => {
    it("calculates exact Accuracy", () => {
      const actual = ["0", "1", "2", "3"];
      const pred = ["0", "1", "0", "3"];
      expect(computeAccuracy(actual, pred)).toBe(0.75);
    });

    it("calculates exact Balanced Accuracy (mean recall across actual classes)", () => {
      const actual = ["A", "A", "B"];
      const pred = ["A", "B", "B"];
      expect(computeBalancedAccuracy(actual, pred)).toBe(0.75);
    });

    it("calculates exact Log Loss and handles zero-probability via CLIPPED_EPSILON_1E_15", () => {
      expect(ZERO_PROBABILITY_POLICY).toBe("CLIPPED_EPSILON_1E_15");

      // Perfect prediction
      const actualPerf = ["0", "1"];
      const probsPerf = [
        { "0": 1.0, "1": 0.0 },
        { "0": 0.0, "1": 1.0 }
      ];
      const lossPerf = computeLogLoss(actualPerf, probsPerf, ["0", "1"]);
      expect(lossPerf).toBeLessThan(1e-10);

      // Uniform prediction for K=2: loss = -ln(0.5) ≈ 0.693147
      const actualUnif = ["0", "1"];
      const probsUnif = [
        { "0": 0.5, "1": 0.5 },
        { "0": 0.5, "1": 0.5 }
      ];
      const lossUnif = computeLogLoss(actualUnif, probsUnif, ["0", "1"]);
      expect(lossUnif).toBeCloseTo(Math.log(2), 5);

      // Zero probability without crashing
      const actualZero = ["1"];
      const probsZero = [{ "0": 1.0, "1": 0.0 }];
      const lossZero = computeLogLoss(actualZero, probsZero, ["0", "1"]);
      expect(Number.isFinite(lossZero)).toBe(true);
      expect(lossZero).toBeCloseTo(-Math.log(1e-15), 2); // ~34.54
    });

    it("calculates exact Confusion Matrix", () => {
      const actual = ["0", "0", "1", "1"];
      const pred = ["0", "1", "1", "1"];
      const matrix = computeConfusionMatrix(actual, pred);

      expect(matrix["0"]!["0"]).toBe(1);
      expect(matrix["0"]!["1"]).toBe(1);
      expect(matrix["1"]!["0"]).toBe(0);
      expect(matrix["1"]!["1"]).toBe(2);
    });
  });

  // --------------------------------------------------------------------------
  // J & K: Chronological Splitting & Training-Only Fitting
  // --------------------------------------------------------------------------
  describe("7B.4: Chronological Holdout Backtest", () => {
    it("runs chronological holdout backtest on real 7A dataset (1,516 train, 754 test)", () => {
      expect(realDataset).toBeDefined();
      expect(realDataset.totalRows).toBe(2270);

      const targets = [
        "observed_last_digit",
        "observed_first_digit",
        "observed_parity"
      ] as const;

      for (const target of targets) {
        for (const modelType of ["UNIFORM", "EMPIRICAL", "MAJORITY"] as const) {
          const res = runChronologicalHoldoutBacktest(realDataset, target, modelType);

          expect(res.trainRowCount).toBe(1516);
          expect(res.testRowCount).toBe(754);
          expect(res.evaluationMethod).toBe("CHRONOLOGICAL_HOLDOUT");
          expect(res.target).toBe(target);
          expect(res.modelType).toBe(modelType);
          expect(res.descriptiveOnly).toBe(true);
          expect(res.notice).toBe(BASELINE_BACKTEST_DISCLAIMER);
          expect(Number.isFinite(res.accuracy)).toBe(true);
          expect(Number.isFinite(res.balancedAccuracy)).toBe(true);
          expect(Number.isFinite(res.logLoss)).toBe(true);
          expect(res.logLoss).toBeGreaterThan(0);
        }
      }
    });

    it("verifies training rows strictly precede test rows in holdout", () => {
      const res = runChronologicalHoldoutBacktest(realDataset, "observed_last_digit", "UNIFORM");
      expect(res.trainDateRange.latestIso <= res.testDateRange.earliestIso).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // L. Walk-Forward Evaluation
  // --------------------------------------------------------------------------
  describe("7B.5: Walk-Forward Backtest", () => {
    it("runs 4-window walk-forward backtest preserving per-window metrics and aggregate", () => {
      const agg = runWalkForwardBacktest(realDataset, "observed_last_digit", "EMPIRICAL");

      expect(agg.totalWindows).toBe(4);
      expect(agg.windows).toHaveLength(4);
      expect(agg.descriptiveOnly).toBe(true);
      expect(agg.target).toBe("observed_last_digit");
      expect(agg.modelType).toBe("EMPIRICAL");

      let prevTrainRows = 0;
      for (const win of agg.windows) {
        expect(win.trainRowCount).toBeGreaterThan(prevTrainRows);
        prevTrainRows = win.trainRowCount;
        expect(win.testRowCount).toBeGreaterThan(0);
        expect(win.accuracy).toBeGreaterThanOrEqual(0);
        expect(win.balancedAccuracy).toBeGreaterThanOrEqual(0);
        expect(win.logLoss).toBeGreaterThan(0);
        expect(win.trainDateRange.latestIso <= win.testDateRange.earliestIso).toBe(true);
      }

      expect(agg.meanAccuracy).toBeGreaterThanOrEqual(0);
      expect(agg.meanAccuracy).toBeLessThanOrEqual(1);
    });
  });

  // --------------------------------------------------------------------------
  // M & O: Reproducibility and Identity/Hash Stability
  // --------------------------------------------------------------------------
  describe("7B.6 & 7B.10: Reproducibility & Result Identity", () => {
    it("produces identical result ID, hashes, and metrics on repeated execution", () => {
      const res1 = runChronologicalHoldoutBacktest(realDataset, "observed_parity", "EMPIRICAL");
      const res2 = runChronologicalHoldoutBacktest(realDataset, "observed_parity", "EMPIRICAL");

      expect(res1.resultId).toBe(res2.resultId);
      expect(res1.deterministicHash).toBe(res2.deterministicHash);
      expect(res1.accuracy).toBe(res2.accuracy);
      expect(res1.balancedAccuracy).toBe(res2.balancedAccuracy);
      expect(res1.logLoss).toBe(res2.logLoss);
      expect(res1.confusionMatrix).toEqual(res2.confusionMatrix);
    });

    it("generates deterministic comprehensive comparison report", () => {
      const rep1 = generateBaselineComparisonReport(realDataset);
      const rep2 = generateBaselineComparisonReport(realDataset);

      expect(rep1.reportId).toBe(rep2.reportId);
      expect(rep1.deterministicHash).toBe(rep2.deterministicHash);
      expect(rep1.datasetId).toBe("mdset_857801355c1fb31e");
      expect(rep1.holdoutResults).toHaveLength(9); // 3 targets * 3 models
      expect(rep1.walkForwardAggregates).toHaveLength(9);
      expect(rep1.descriptiveOnly).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // N: Leakage Resistance (Adversarial Testing)
  // --------------------------------------------------------------------------
  describe("7B.8 & 7B.11N: Leakage Resistance", () => {
    it("passes all 9 leakage checks including adversarial perturbation", () => {
      const audit = auditBaselineLeakageResistance(realDataset);
      expect(audit.passed).toBe(true);
      expect(audit.testLabelsNeverUsedInFitting).toBe(true);
      expect(audit.empiricalFrequenciesFromTrainOnly).toBe(true);
      expect(audit.majorityClassFromTrainOnly).toBe(true);
      expect(audit.chronologicalOrderingPreserved).toBe(true);
      expect(audit.futureRowCannotInfluenceEarlierWindow).toBe(true);
      expect(audit.targetColumnsNotInModelInputs).toBe(true);
      expect(audit.sourceIdentifiersNotPredictive).toBe(true);
      expect(audit.repeatedExecutionIdentical).toBe(true);
    });

    it("adversarial test: modifying test labels leaves fitted model state completely unchanged", () => {
      const trainRows = [
        createMockRow("r1", "d1", "2024-01-01", "0"),
        createMockRow("r2", "d1", "2024-01-01", "0"),
        createMockRow("r3", "d1", "2024-01-01", "1")
      ];
      const model = new EmpiricalBaseline();
      model.fit(trainRows, "observed_last_digit", ["0", "1", "2"]);

      const stateBefore = model.getFittedState();

      const adversarialTestRows = [
        createMockRow("r4", "d2", "2024-01-02", "999"),
        createMockRow("r5", "d2", "2024-01-02", "COMPLETELY_DIFFERENT")
      ];
      model.predictClasses(adversarialTestRows);
      const stateAfter = model.getFittedState();

      expect(stateBefore).toEqual(stateAfter);
    });
  });

  // --------------------------------------------------------------------------
  // Edge Cases
  // --------------------------------------------------------------------------
  describe("7B.11 Edge Cases", () => {
    it("handles empty class in training (frequency = 0)", () => {
      const model = new EmpiricalBaseline();
      const train = [createMockRow("r1", "d1", "2024-01-01", "A")];
      model.fit(train, "observed_last_digit", ["A", "B", "C"]);

      const probs = model.predictProbabilities([createMockRow("r2", "d2", "2024-01-02", "B")])[0]!;
      expect(probs["A"]).toBe(1.0);
      expect(probs["B"]).toBe(0.0);
      expect(probs["C"]).toBe(0.0);

      const res = model.evaluate([createMockRow("r2", "d2", "2024-01-02", "B")]);
      const acc = res.metrics["accuracy"]?.value;
      const logLoss = res.metrics["logLoss"]?.value;
      expect(acc).toBe(0);
      expect(Number.isFinite(logLoss)).toBe(true);
    });

    it("handles single-class training partition", () => {
      const model = new MajorityBaseline();
      const train = [
        createMockRow("r1", "d1", "2024-01-01", "ONLY_CLASS"),
        createMockRow("r2", "d1", "2024-01-01", "ONLY_CLASS")
      ];
      model.fit(train, "observed_last_digit", ["ONLY_CLASS"]);
      expect(model.getFittedState().majorityClass).toBe("ONLY_CLASS");
    });

    it("handles minimal dataset (2 train rows, 1 test row)", () => {
      const miniDataset: ModelingDataset = {
        id: "mdset_mini",
        deterministicHash: "mini_hash",
        sourceModelFeatureMatrixId: "mfmat_mini",
        sourceFeatureMatrixId: "fmat_mini",
        sourceFeatureEvaluationId: "feval_mini",
        modelingVersion: "v1.0.0-modeling",
        populationScope: {
          sourceFeatureMatrixId: "fmat_mini",
          sourceFeatureEvaluationId: "feval_mini",
          sourceModelFeatureMatrixId: "mfmat_mini",
          populationScopeType: "ALL_POPULATION",
          totalRows: 3,
          fullTicketCount: 3,
          suffixCount: 0,
          drawIds: ["d1", "d2"],
          drawCount: 2,
          lotteryCodes: ["TEST"],
          documentSha256s: ["sha1", "sha2"],
          dateRange: { earliest: "2024-01-01", latest: "2024-01-02", earliestIso: "2024-01-01", latestIso: "2024-01-02" },
          populationScopeHash: "scope_hash"
        },
        totalRows: 3,
        fullTicketCount: 3,
        suffixCount: 0,
        featureColumnNames: ["test_feature"],
        targetDefinition: createObservedLastDigitTarget(),
        rows: [
          createMockRow("r1", "d1", "2024-01-01", "0"),
          createMockRow("r2", "d1", "2024-01-01", "1"),
          createMockRow("r3", "d2", "2024-01-02", "0")
        ],
        provenance: "test",
        limitations: ["test"],
        descriptiveOnly: true
      };

      const res = runChronologicalHoldoutBacktest(miniDataset, "observed_last_digit", "UNIFORM");
      expect(res.trainRowCount).toBe(2);
      expect(res.testRowCount).toBe(1);
      expect(res.accuracy).toBe(1); // test actual is "0", uniform tie-break predicts "0"
    });
  });
});
