/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 7A: Modeling Foundation Test Suite
 *
 * Tests all 23 non-negotiable requirements:
 * 1. dataset construction
 * 2. feature/target separation
 * 3. target definition
 * 4. chronological splitting
 * 5. walk-forward splitting
 * 6. temporal leakage detection
 * 7. overlapping draw detection
 * 8. overlapping result detection
 * 9. target leakage detection
 * 10. population isolation
 * 11. baseline determinism
 * 12. model identity determinism
 * 13. metric calculations
 * 14. confusion matrix
 * 15. insufficient population handling
 * 16. empty dataset handling
 * 17. provenance preservation
 * 18. leading-zero preservation
 * 19. repeated experiment determinism
 * 20. backtest contract validation
 * 21. future-date leakage
 * 22. train/test separation
 * 23. descriptive/research-only invariant
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
  extractCorpusFeatures,
  evaluateFeatureMatrix,
  buildModelFeatureMatrix,
  DEFAULT_FEATURE_SELECTION_VERSION,
  MultiDrawLotteryCorpus,
  FeatureMatrix,
  FeatureEvaluationReport,
  ModelFeatureMatrix,
  DEFAULT_MODELING_VERSION,
  HISTORICAL_MODELING_DISCLAIMER,
  ModelingValidationError,
  createObservedLastDigitTarget,
  createObservedFirstDigitTarget,
  createObservedParityTarget,
  buildModelingDataset,
  validateSplitLeakage,
  createChronologicalSplit,
  createWalkForwardSplits,
  evaluateCategoricalPredictions,
  UniformCategoricalBaseline,
  EmpiricalFrequencyBaseline,
  MajorityClassBaseline,
  executeModelRun,
  executeBacktest,
  InMemoryModelingDatasetRepository,
  InMemoryModelRunRepository,
  DatasetSplit,
  ModelingDataset
} from "./index";

describe("Milestone 7A: Modeling Foundation", () => {
  const LOTTERY_RESULTS_DIR = join(process.cwd(), "data/source-documents/lottery-results");
  let testCorpus: MultiDrawLotteryCorpus;
  let sourceMatrix: FeatureMatrix;
  let evaluationReport: FeatureEvaluationReport;
  let modelMatrix: ModelFeatureMatrix;
  let dataset: ModelingDataset;

  beforeAll(async () => {
    if (!existsSync(LOTTERY_RESULTS_DIR)) return;

    const files = readdirSync(LOTTERY_RESULTS_DIR)
      .filter((f) => f.endsWith(".pdf") && f !== "dhanalekshmi-dl-40.pdf")
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

    testCorpus = buildMultiDrawCorpus(graphs);
    sourceMatrix = extractCorpusFeatures(testCorpus);
    evaluationReport = evaluateFeatureMatrix(sourceMatrix, testCorpus);

    const result = buildModelFeatureMatrix(sourceMatrix, evaluationReport, {
      selectionVersion: DEFAULT_FEATURE_SELECTION_VERSION,
      evaluatedAt: "2026-09-26T12:00:00.000Z"
    });
    modelMatrix = result.matrix;

    const targetDef = createObservedLastDigitTarget();
    dataset = buildModelingDataset(modelMatrix, targetDef);
  });

  // 1. Dataset Construction
  it("1. Dataset Construction: constructs deterministic ModelingDataset with 2,270 rows and canonical ID", () => {
    expect(dataset.id).toMatch(/^mdset_[a-f0-9]{16}$/);
    expect(dataset.deterministicHash).toMatch(/^[a-f0-9]{16}$/);
    expect(dataset.totalRows).toBe(2270);
    expect(dataset.rows.length).toBe(2270);
    expect(dataset.fullTicketCount).toBe(84);
    expect(dataset.suffixCount).toBe(2186);
    expect(dataset.modelingVersion).toBe(DEFAULT_MODELING_VERSION);
  });

  // 2. Feature/Target Separation
  it("2. Feature/Target Separation: explicitly isolates target from feature columns preventing target leakage", () => {
    expect(dataset.targetDefinition.sourceFieldOrFeature).toBe("lastDigit");
    // Target field must NOT appear in dataset.featureColumnNames
    expect(dataset.featureColumnNames.includes("lastDigit")).toBe(false);
    // Source model feature matrix had 41 columns; dataset should have exactly 40 features
    expect(modelMatrix.selectedColumnNames.length).toBe(41);
    expect(dataset.featureColumnNames.length).toBe(40);

    // Each row must store targetValue separately from features object
    for (const r of dataset.rows.slice(0, 10)) {
      expect(r.targetValue).toBeDefined();
      expect(r.targetValue).not.toBeNull();
      expect(r.features["lastDigit"]).toBeUndefined();
    }
  });

  // 3. Target Definition
  it("3. Target Definition: creates deterministic, versioned, non-predictive targets", () => {
    const lastDigitTgt = createObservedLastDigitTarget();
    expect(lastDigitTgt.targetId).toBe("tgt_observed_last_digit");
    expect(lastDigitTgt.targetType).toBe("CATEGORICAL");
    expect(lastDigitTgt.allowedValues).toEqual(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
    expect(lastDigitTgt.descriptiveOnly).toBe(true);
    expect(lastDigitTgt.deterministicHash).toMatch(/^[a-f0-9]{16}$/);

    const firstDigitTgt = createObservedFirstDigitTarget();
    expect(firstDigitTgt.targetId).toBe("tgt_observed_first_digit");
    expect(firstDigitTgt.deterministicHash).toMatch(/^[a-f0-9]{16}$/);

    const parityTgt = createObservedParityTarget();
    expect(parityTgt.targetId).toBe("tgt_observed_parity");
    expect(parityTgt.allowedValues).toEqual(["EVEN", "ODD"]);
    expect(parityTgt.deterministicHash).toMatch(/^[a-f0-9]{16}$/);
  });

  // 4. Chronological Splitting
  it("4. Chronological Splitting: splits earlier draws to TRAIN and later draws to TEST deterministically", () => {
    const split = createChronologicalSplit(dataset, 4, 2);
    expect(split.strategy).toBe("CHRONOLOGICAL_HOLDOUT");
    expect(split.trainDrawCount).toBe(4);
    expect(split.testDrawCount).toBe(2);
    expect(split.trainPartition.drawIds.length).toBe(4);
    expect(split.testPartition.drawIds.length).toBe(2);
    expect(split.trainPartition.rowCount + split.testPartition.rowCount).toBe(2270);
    expect(split.splitId).toMatch(/^split_[a-f0-9]{16}$/);
  });

  // 5. Walk-Forward Splitting
  it("5. Walk-Forward Splitting: generates expanding train windows and sequential 1-draw test windows", () => {
    const splits = createWalkForwardSplits(dataset, 2);
    // 6 draws with minTrainDraws=2 -> steps for draw indices 2, 3, 4, 5 (4 splits)
    expect(splits.length).toBe(4);

    for (let i = 0; i < splits.length; i++) {
      const s = splits[i]!;
      expect(s.strategy).toBe("WALK_FORWARD");
      expect(s.trainPartition.drawIds.length).toBe(2 + i);
      expect(s.testPartition.drawIds.length).toBe(1);
    }
  });

  // 6. Temporal Leakage Detection
  it("6. Temporal Leakage Detection: rejects split if train draw date >= test draw date", () => {
    const validSplit = createChronologicalSplit(dataset, 4, 2);

    // Invert train and test partitions to create intentional temporal leakage
    const invertedSplit: DatasetSplit = {
      ...validSplit,
      trainPartition: validSplit.testPartition,
      testPartition: validSplit.trainPartition
    };

    const result = validateSplitLeakage(invertedSplit, dataset);
    expect(result.passed).toBe(false);
    expect(result.temporalLeakageDetected).toBe(true);
    expect(result.issues.some((iss) => iss.includes("TEMPORAL_LEAKAGE"))).toBe(true);
  });

  // 7. Overlapping Draw Detection
  it("7. Overlapping Draw Detection: rejects split if a drawId appears in both TRAIN and TEST", () => {
    const validSplit = createChronologicalSplit(dataset, 4, 2);

    const contaminatedSplit: DatasetSplit = {
      ...validSplit,
      trainPartition: {
        ...validSplit.trainPartition,
        drawIds: [...validSplit.trainPartition.drawIds, validSplit.testPartition.drawIds[0]!]
      }
    };

    const result = validateSplitLeakage(contaminatedSplit, dataset);
    expect(result.passed).toBe(false);
    expect(result.drawOverlapDetected).toBe(true);
    expect(result.issues.some((iss) => iss.includes("DRAW_OVERLAP"))).toBe(true);
  });

  // 8. Overlapping Result Detection
  it("8. Overlapping Result Detection: rejects split if a resultId appears in both TRAIN and TEST", () => {
    const validSplit = createChronologicalSplit(dataset, 4, 2);

    const contaminatedSplit: DatasetSplit = {
      ...validSplit,
      trainPartition: {
        ...validSplit.trainPartition,
        resultIds: [...validSplit.trainPartition.resultIds, validSplit.testPartition.resultIds[0]!]
      }
    };

    const result = validateSplitLeakage(contaminatedSplit, dataset);
    expect(result.passed).toBe(false);
    expect(result.resultIdOverlapDetected).toBe(true);
    expect(result.issues.some((iss) => iss.includes("RESULT_OVERLAP"))).toBe(true);
  });

  // 9. Target Leakage Detection
  it("9. Target Leakage Detection: rejects split if dataset featureColumnNames contains target field", () => {
    const validSplit = createChronologicalSplit(dataset, 4, 2);

    // Contaminate dataset by injecting target field into featureColumnNames
    const contaminatedDataset: ModelingDataset = {
      ...dataset,
      featureColumnNames: [...dataset.featureColumnNames, dataset.targetDefinition.sourceFieldOrFeature]
    };

    const result = validateSplitLeakage(validSplit, contaminatedDataset);
    expect(result.passed).toBe(false);
    expect(result.targetLeakageDetected).toBe(true);
    expect(result.issues.some((iss) => iss.includes("TARGET_LEAKAGE"))).toBe(true);
  });

  // 10. Population Isolation
  it("10. Population Isolation: enforces strict isolation for SIX_DIGIT_FULL_TICKET and FOUR_DIGIT_SUFFIX", () => {
    const targetDef = createObservedLastDigitTarget();

    const fullTicketDataset = buildModelingDataset(modelMatrix, targetDef, {
      populationScopeType: "SIX_DIGIT_FULL_TICKET"
    });
    expect(fullTicketDataset.totalRows).toBe(84);
    expect(fullTicketDataset.rows.every((r) => r.resultType === "FULL_TICKET")).toBe(true);
    expect(fullTicketDataset.rows.every((r) => r.numberLength === 6)).toBe(true);

    const suffixDataset = buildModelingDataset(modelMatrix, targetDef, {
      populationScopeType: "FOUR_DIGIT_SUFFIX"
    });
    expect(suffixDataset.totalRows).toBe(2186);
    expect(suffixDataset.rows.every((r) => r.resultType === "SUFFIX")).toBe(true);
    expect(suffixDataset.rows.every((r) => r.numberLength === 4)).toBe(true);
  });

  // 11. Baseline Determinism
  it("11. Baseline Determinism: baseline models produce deterministic probabilities and predictions", () => {
    const targetDef = createObservedLastDigitTarget();
    const split = createChronologicalSplit(dataset, 4, 2);

    const trainRows = dataset.rows.filter((r) => split.trainPartition.resultIds.includes(r.resultId));
    const testRows = dataset.rows.filter((r) => split.testPartition.resultIds.includes(r.resultId));

    // Uniform Baseline
    const uniform1 = new UniformCategoricalBaseline(targetDef);
    const uniform2 = new UniformCategoricalBaseline(targetDef);
    uniform1.fit(trainRows, targetDef);
    uniform2.fit(trainRows, targetDef);
    const predsU1 = uniform1.predict(testRows);
    const predsU2 = uniform2.predict(testRows);
    expect(predsU1).toEqual(predsU2);
    expect(predsU1[0]!.probabilities!["0"]).toBe(0.1);

    // Empirical Frequency Baseline
    const emp1 = new EmpiricalFrequencyBaseline(targetDef);
    const emp2 = new EmpiricalFrequencyBaseline(targetDef);
    emp1.fit(trainRows, targetDef);
    emp2.fit(trainRows, targetDef);
    const predsE1 = emp1.predict(testRows);
    const predsE2 = emp2.predict(testRows);
    expect(predsE1).toEqual(predsE2);

    // Majority Class Baseline
    const maj1 = new MajorityClassBaseline(targetDef);
    const maj2 = new MajorityClassBaseline(targetDef);
    maj1.fit(trainRows, targetDef);
    maj2.fit(trainRows, targetDef);
    const predsM1 = maj1.predict(testRows);
    const predsM2 = maj2.predict(testRows);
    expect(predsM1).toEqual(predsM2);
    expect(predsM1[0]!.probabilities![predsM1[0]!.predictedClass!]).toBe(1.0);
  });

  // 12. Model Identity Determinism
  it("12. Model Identity Determinism: identical model definitions produce identical deterministic IDs", () => {
    const targetDef = createObservedLastDigitTarget();
    const m1 = new UniformCategoricalBaseline(targetDef);
    const m2 = new UniformCategoricalBaseline(targetDef);

    expect(m1.definition.modelId).toMatch(/^mdef_[a-f0-9]{16}$/);
    expect(m1.definition.modelId).toBe(m2.definition.modelId);
    expect(m1.definition.deterministicHash).toBe(m2.definition.deterministicHash);
  });

  // 13. Metric Calculations
  it("13. Metric Calculations: computes exact accuracy, balanced accuracy, and log loss", () => {
    const targetDef = createObservedLastDigitTarget();
    const dummyPredictions = [
      {
        resultId: "r1",
        sourceDrawId: "d1",
        predictedClass: "0",
        probabilities: { "0": 0.8, "1": 0.2 },
        observedTarget: "0"
      },
      {
        resultId: "r2",
        sourceDrawId: "d1",
        predictedClass: "0",
        probabilities: { "0": 0.7, "1": 0.3 },
        observedTarget: "1"
      }
    ];

    const evalRes = evaluateCategoricalPredictions(dummyPredictions, targetDef);
    // Accuracy: 1 / 2 = 0.5
    expect(evalRes.metrics["accuracy"]!.value).toBe(0.5);
    // Recall for "0": 1/1 = 1.0; Recall for "1": 0/1 = 0.0 -> Balanced Acc = 0.5
    expect(evalRes.metrics["balancedAccuracy"]!.value).toBe(0.5);
    expect(evalRes.metrics["logLoss"]!.value).toBeGreaterThan(0);
    expect(evalRes.metrics["sampleSize"]!.value).toBe(2);
  });

  // 14. Confusion Matrix
  it("14. Confusion Matrix: maps observed actual outcomes against predicted classes accurately", () => {
    const targetDef = createObservedLastDigitTarget();
    const dummyPredictions = [
      { resultId: "r1", sourceDrawId: "d1", predictedClass: "3", observedTarget: "3" },
      { resultId: "r2", sourceDrawId: "d1", predictedClass: "5", observedTarget: "3" },
      { resultId: "r3", sourceDrawId: "d1", predictedClass: "3", observedTarget: "5" }
    ];

    const evalRes = evaluateCategoricalPredictions(dummyPredictions, targetDef);
    expect(evalRes.confusionMatrix).toBeDefined();
    const cm = evalRes.confusionMatrix!;
    expect(cm.matrix["3"]!["3"]).toBe(1);
    expect(cm.matrix["3"]!["5"]).toBe(1);
    expect(cm.matrix["5"]!["3"]).toBe(1);
    expect(cm.totalSamples).toBe(3);
  });

  // 15. Insufficient Population Handling
  it("15. Insufficient Population Handling: throws INSUFFICIENT_DATA when splits require more draws than available", () => {
    expect(() => {
      // Current dataset has 6 draws; requesting 5 train + 2 test = 7 draws must fail
      createChronologicalSplit(dataset, 5, 2);
    }).toThrowError(ModelingValidationError);

    expect(() => {
      // Walk forward with minTrainDraws >= totalDraws
      createWalkForwardSplits(dataset, 6);
    }).toThrowError(ModelingValidationError);
  });

  // 16. Empty Dataset Handling
  it("16. Empty Dataset Handling: throws EMPTY_DATASET error when population scope yields 0 rows", () => {
    const targetDef = createObservedLastDigitTarget();
    expect(() => {
      buildModelingDataset(modelMatrix, targetDef, {
        populationScopeType: "SINGLE_LOTTERY",
        targetLotteryCode: "NON_EXISTENT_LOTTERY"
      });
    }).toThrowError(ModelingValidationError);
  });

  // 17. Provenance Preservation
  it("17. Provenance Preservation: traces ModelRun back through ModelingDataset to source gazettes", () => {
    const split = createChronologicalSplit(dataset, 4, 2);
    const model = new UniformCategoricalBaseline(dataset.targetDefinition);
    const run = executeModelRun(model, dataset, split);

    expect(run.provenance).toContain("ModelRun");
    expect(run.provenance).toContain("ModelingDataset");
    expect(dataset.provenance).toContain("ModelFeatureMatrix");
    expect(dataset.provenance).toContain("WinningResults");
    expect(dataset.provenance).toContain("Official Gazette PDFs");
  });

  // 18. Leading-Zero Preservation
  it("18. Leading-Zero Preservation: preserves leading zeros intact in canonical number strings and features", () => {
    const zeroLeadingRow = dataset.rows.find((r) => r.canonicalNumber.startsWith("0"));
    expect(zeroLeadingRow).toBeDefined();
    expect(zeroLeadingRow!.canonicalNumber.startsWith("0")).toBe(true);
    expect(zeroLeadingRow!.features["canonicalNumber"]).toBe(zeroLeadingRow!.canonicalNumber);
  });

  // 19. Repeated Experiment Determinism
  it("19. Repeated Experiment Determinism: executing twice with identical config produces identical experiment IDs and hashes", () => {
    const split = createChronologicalSplit(dataset, 4, 2);
    const model1 = new EmpiricalFrequencyBaseline(dataset.targetDefinition);
    const model2 = new EmpiricalFrequencyBaseline(dataset.targetDefinition);

    const run1 = executeModelRun(model1, dataset, split, { executedAt: "2026-09-26T12:00:00.000Z" });
    const run2 = executeModelRun(model2, dataset, split, { executedAt: "2026-09-26T12:00:00.000Z" });

    expect(run1.runId).toBe(run2.runId);
    expect(run1.experimentId).toBe(run2.experimentId);
    expect(run1.deterministicHash).toBe(run2.deterministicHash);
    expect(run1.evaluation.evaluationId).toBe(run2.evaluation.evaluationId);
  });

  // 20. Backtest Contract Validation
  it("20. Backtest Contract Validation: executes walk-forward backtest producing reproducible window metrics", () => {
    const model = new UniformCategoricalBaseline(dataset.targetDefinition);
    const backtestDef = {
      backtestId: "bkt_test_walk_forward",
      backtestVersion: DEFAULT_MODELING_VERSION,
      datasetId: dataset.id,
      modelDefinition: model.definition,
      targetDefinition: dataset.targetDefinition,
      temporalStrategy: "WALK_FORWARD" as const,
      minTrainDraws: 3,
      metricTypes: ["ACCURACY" as const, "BALANCED_ACCURACY" as const],
      deterministicHash: "hash_01",
      descriptiveOnly: true as const,
      provenance: "test backtest"
    };

    const backtestRes = executeBacktest(dataset, () => new UniformCategoricalBaseline(dataset.targetDefinition), backtestDef);
    expect(backtestRes.totalWindows).toBe(3); // 6 draws - 3 minTrain = 3 windows
    expect(backtestRes.windows.length).toBe(3);
    expect(backtestRes.aggregateMetrics["meanAccuracy"]).toBeDefined();
    expect(backtestRes.descriptiveOnly).toBe(true);
  });

  // 21. Future-Date Leakage
  it("21. Future-Date Leakage: detects future date contamination in training partition rows", () => {
    const validSplit = createChronologicalSplit(dataset, 4, 2);

    // Contaminate dataset so a train row has a future timestamp
    const futureTimestamp = 9999999999999;
    const contaminatedDataset: ModelingDataset = {
      ...dataset,
      rows: dataset.rows.map((r, i) =>
        i === 0 ? { ...r, drawTimestamp: futureTimestamp } : r
      )
    };

    const result = validateSplitLeakage(validSplit, contaminatedDataset);
    expect(result.passed).toBe(false);
    expect(result.futureDateInTrainDetected).toBe(true);
  });

  // 22. Train/Test Separation
  it("22. Train/Test Separation: guarantees disjoint draw IDs and result IDs with zero intersection", () => {
    const split = createChronologicalSplit(dataset, 4, 2);
    const trainDraws = new Set(split.trainPartition.drawIds);
    const testDraws = new Set(split.testPartition.drawIds);
    for (const d of testDraws) {
      expect(trainDraws.has(d)).toBe(false);
    }

    const trainResults = new Set(split.trainPartition.resultIds);
    const testResults = new Set(split.testPartition.resultIds);
    for (const r of testResults) {
      expect(trainResults.has(r)).toBe(false);
    }
  });

  // 23. Descriptive/Research-Only Invariant
  it("23. Descriptive/Research-Only Invariant: enforces non-predictive disclaimers and flags", () => {
    expect(dataset.descriptiveOnly).toBe(true);
    expect(dataset.targetDefinition.descriptiveOnly).toBe(true);
    expect(dataset.limitations.some((l) => l.includes(HISTORICAL_MODELING_DISCLAIMER))).toBe(true);

    const split = createChronologicalSplit(dataset, 4, 2);
    const model = new MajorityClassBaseline(dataset.targetDefinition);
    const run = executeModelRun(model, dataset, split);
    expect(run.descriptiveOnly).toBe(true);
    expect(model.definition.descriptiveOnly).toBe(true);
  });

  // 24. In-Memory Repositories
  it("24. In-Memory Repositories: saves, retrieves by ID, and lists ModelingDatasets and ModelRuns", async () => {
    const dsRepo = new InMemoryModelingDatasetRepository();
    const runRepo = new InMemoryModelRunRepository();

    await dsRepo.saveDataset({
      id: dataset.id,
      dataset,
      createdAt: "2026-09-26T12:00:00.000Z"
    });

    const retrievedDs = await dsRepo.getDatasetById(dataset.id);
    expect(retrievedDs).not.toBeNull();
    expect(retrievedDs!.id).toBe(dataset.id);
    expect(await dsRepo.countDatasets()).toBe(1);

    const split = createChronologicalSplit(dataset, 4, 2);
    const model = new UniformCategoricalBaseline(dataset.targetDefinition);
    const run = executeModelRun(model, dataset, split);

    await runRepo.saveModelRun({
      id: run.runId,
      run,
      createdAt: "2026-09-26T12:00:00.000Z"
    });

    const retrievedRun = await runRepo.getModelRunById(run.runId);
    expect(retrievedRun).not.toBeNull();
    expect(retrievedRun!.run.runId).toBe(run.runId);
    expect(await runRepo.countModelRuns()).toBe(1);
  });
});
