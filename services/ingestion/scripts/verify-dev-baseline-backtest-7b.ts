/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 7B: Canonical Baseline Models & Historical Backtesting Verifier
 *
 * Validates the complete 7B Baseline & Backtesting architecture:
 *
 * 7A MODELING DATASET (mdset_857801355c1fb31e, 2,270 rows, 40 features)
 *   ↓
 * 7B.1 BASELINE DEFINITIONS (Uniform, Empirical, Majority)
 *   ↓
 * 7B.4 CHRONOLOGICAL HOLDOUT BACKTEST (1,516 Train, 754 Test)
 *   ↓
 * 7B.5 WALK-FORWARD BACKTEST (4 Sequential Expanding Windows)
 *   ↓
 * 7B.6 RESULT SCHEMAS & REPRODUCIBILITY
 *   ↓
 * 7B.7 BASELINE COMPARISON REPORT (3 Targets × 3 Models)
 *   ↓
 * 7B.8 LEAKAGE AUDIT & ADVERSARIAL PERTURBATION
 *
 * Quality Gates:
 * 1. Dataset identity
 * 2. Target coverage
 * 3. Baseline definitions
 * 4. Chronological split
 * 5. Walk-forward windows
 * 6. Model outputs
 * 7. Metric validity
 * 8. Leakage invariants
 * 9. Reproducibility
 * 10. Result integrity
 */

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
  createObservedLastDigitTarget,
  buildModelingDataset,
  CANONICAL_6_BASELINE_FILES
} from "@kerala-lottery/statistics";
import {
  UniformBaseline,
  EmpiricalBaseline,
  MajorityBaseline,
  runChronologicalHoldoutBacktest,
  runWalkForwardBacktest,
  generateBaselineComparisonReport,
  auditBaselineLeakageResistance,
  BASELINE_BACKTEST_DISCLAIMER,
  ZERO_PROBABILITY_POLICY,
  TIE_BREAKING_STRATEGY,
  DEFAULT_BASELINE_BACKTEST_VERSION
} from "@kerala-lottery/statistics";

async function runDevBaselineBacktest7B(): Promise<void> {
  console.log("============================================================");
  console.log("KERALA STATE LOTTERY INTELLIGENCE PLATFORM");
  console.log("MILESTONE 7B: BASELINE MODELS & HISTORICAL BACKTESTING VERIFIER");
  console.log("============================================================");
  console.log(`Version:    ${DEFAULT_BASELINE_BACKTEST_VERSION}`);
  console.log(`Disclaim:   ${BASELINE_BACKTEST_DISCLAIMER}`);
  console.log(`Tie-Break:  ${TIE_BREAKING_STRATEGY}`);
  console.log(`Zero-Prob:  ${ZERO_PROBABILITY_POLICY}`);
  console.log("============================================================\n");

  const resultsDir = join(process.cwd(), "data/source-documents/lottery-results");
  if (!existsSync(resultsDir)) {
    throw new Error(`Directory ${resultsDir} does not exist!`);
  }

  // Build 7A canonical dataset
  console.log("Step 1: Ingesting Canonical 6-Draw Baseline Corpus...");
  const canonicalSet = new Set<string>(CANONICAL_6_BASELINE_FILES);
  const files = readdirSync(resultsDir)
    .filter((f) => canonicalSet.has(f))
    .sort();

  if (files.length !== 6) {
    throw new Error(`Expected 6 canonical files, found ${files.length}`);
  }

  const extractor = new PdfPageExtractorService();
  const segService = new DocumentSemanticSegmentationService();
  const entityService = new LotteryEntityExtractorService();

  const graphs: LotteryKnowledgeGraph[] = [];
  for (const filename of files) {
    const pdfBytes = readFileSync(join(resultsDir, filename));
    const sha256 = computeSha256(new Uint8Array(pdfBytes));
    const extRes = await extractor.extractPages(new Uint8Array(pdfBytes), sha256);
    const segmentation = segService.segmentDocument(extRes.pages);
    const extraction = entityService.extract(segmentation, extRes.pages);
    const graph = buildLotteryKnowledgeGraph(extraction, segmentation);
    validateLotteryKnowledgeGraph(graph);
    graphs.push(graph);
  }

  const corpus = buildMultiDrawCorpus(graphs);
  const sourceMatrix = extractCorpusFeatures(corpus);
  const evaluationReport = evaluateFeatureMatrix(sourceMatrix, corpus);
  const result = buildModelFeatureMatrix(sourceMatrix, evaluationReport, {
    selectionVersion: DEFAULT_FEATURE_SELECTION_VERSION,
    evaluatedAt: "2026-09-26T12:00:00.000Z"
  });
  const modelMatrix = result.matrix;
  const dataset = buildModelingDataset(modelMatrix, createObservedLastDigitTarget());

  console.log(`   - Corpus draws:   ${corpus.draws.length}`);
  console.log(`   - Model Matrix:   ${modelMatrix.id} (${modelMatrix.rows.length} rows, ${modelMatrix.selectedColumnNames.length} features)`);
  console.log(`   - Dataset ID:     ${dataset.id} (${dataset.totalRows} rows, ${dataset.featureColumnNames.length} features)\n`);

  console.log("------------------------------------------------------------");
  console.log("VERIFYING 10 CANONICAL QUALITY GATES:");
  console.log("------------------------------------------------------------\n");

  // ==========================================================================
  // Gate 1: Dataset Identity
  // ==========================================================================
  console.log("1. Validating Dataset Identity...");
  if (dataset.id !== "mdset_857801355c1fb31e") {
    throw new Error(`Gate 1 Failed: Expected dataset id 'mdset_857801355c1fb31e', got '${dataset.id}'`);
  }
  if (dataset.sourceModelFeatureMatrixId !== "mfmat_9c93e90052bfb2c0") {
    throw new Error(`Gate 1 Failed: Expected sourceModelFeatureMatrixId 'mfmat_9c93e90052bfb2c0', got '${dataset.sourceModelFeatureMatrixId}'`);
  }
  if (dataset.totalRows !== 2270) {
    throw new Error(`Gate 1 Failed: Expected 2,270 rows, got ${dataset.totalRows}`);
  }
  if (dataset.featureColumnNames.length !== 40) {
    throw new Error(`Gate 1 Failed: Expected 40 features, got ${dataset.featureColumnNames.length}`);
  }
  console.log("   ✓ Gate 1 Passed: Dataset identity mdset_857801355c1fb31e with 2,270 rows and 40 features confirmed.\n");

  // ==========================================================================
  // Gate 2: Target Coverage
  // ==========================================================================
  console.log("2. Validating Target Coverage across All 3 Targets...");
  const targets = ["observed_last_digit", "observed_first_digit", "observed_parity"] as const;
  for (const t of targets) {
    const holdoutUniform = runChronologicalHoldoutBacktest(dataset, t, "UNIFORM");
    if (holdoutUniform.trainRowCount !== 1516 || holdoutUniform.testRowCount !== 754) {
      throw new Error(`Gate 2 Failed: Target ${t} holdout partition row count mismatch`);
    }
    if (t === "observed_parity") {
      const allowed = holdoutUniform.confusionMatrix.classes.sort();
      if (allowed.length !== 2 || allowed[0] !== "EVEN" || allowed[1] !== "ODD") {
        throw new Error(`Gate 2 Failed: Parity target classes mismatch: ${allowed.join(", ")}`);
      }
    } else {
      if (holdoutUniform.confusionMatrix.classes.length !== 10) {
        throw new Error(`Gate 2 Failed: Digit target ${t} must have 10 classes`);
      }
    }
  }
  console.log("   ✓ Gate 2 Passed: Full target coverage confirmed for observed_last_digit, observed_first_digit, observed_parity.\n");

  // ==========================================================================
  // Gate 3: Baseline Definitions
  // ==========================================================================
  console.log("3. Validating Baseline Model Definitions...");
  const uModel = new UniformBaseline("observed_last_digit");
  const eModel = new EmpiricalBaseline("observed_last_digit");
  const mModel = new MajorityBaseline("observed_last_digit");

  if (uModel.modelType !== "UNIFORM" || eModel.modelType !== "EMPIRICAL" || mModel.modelType !== "MAJORITY") {
    throw new Error("Gate 3 Failed: Baseline modelType mismatch");
  }
  if (TIE_BREAKING_STRATEGY !== "LEXICOGRAPHICAL_ASCENDING") {
    throw new Error("Gate 3 Failed: Tie-breaking strategy must be LEXICOGRAPHICAL_ASCENDING");
  }
  if (ZERO_PROBABILITY_POLICY !== "CLIPPED_EPSILON_1E_15") {
    throw new Error("Gate 3 Failed: Zero-probability policy must be CLIPPED_EPSILON_1E_15");
  }
  console.log("   ✓ Gate 3 Passed: Deterministic baseline definitions (Uniform, Empirical, Majority) validated.\n");

  // ==========================================================================
  // Gate 4: Chronological Split
  // ==========================================================================
  console.log("4. Validating Chronological Split (1,516 Train, 754 Test)...");
  const holdoutRes = runChronologicalHoldoutBacktest(dataset, "observed_last_digit", "EMPIRICAL");
  if (holdoutRes.trainRowCount !== 1516) {
    throw new Error(`Gate 4 Failed: Expected 1516 train rows, got ${holdoutRes.trainRowCount}`);
  }
  if (holdoutRes.testRowCount !== 754) {
    throw new Error(`Gate 4 Failed: Expected 754 test rows, got ${holdoutRes.testRowCount}`);
  }
  if (holdoutRes.trainDateRange.latestIso > holdoutRes.testDateRange.earliestIso) {
    throw new Error("Gate 4 Failed: Training dates overlap or follow test dates");
  }
  console.log("   ✓ Gate 4 Passed: Chronological split strictly verified (1,516 train rows strictly preceding 754 test rows).\n");

  // ==========================================================================
  // Gate 5: Walk-Forward Windows
  // ==========================================================================
  console.log("5. Validating Walk-Forward Windows (4 Sequential Expanding Windows)...");
  const wfRes = runWalkForwardBacktest(dataset, "observed_last_digit", "EMPIRICAL");
  if (wfRes.totalWindows !== 4) {
    throw new Error(`Gate 5 Failed: Expected 4 walk-forward windows, got ${wfRes.totalWindows}`);
  }
  let prevTrain = 0;
  for (const win of wfRes.windows) {
    if (win.trainRowCount <= prevTrain) {
      throw new Error("Gate 5 Failed: Training window size is not expanding");
    }
    prevTrain = win.trainRowCount;
    if (win.testRowCount <= 0) {
      throw new Error("Gate 5 Failed: Window test size is 0");
    }
    if (win.trainDateRange.latestIso > win.testDateRange.earliestIso) {
      throw new Error("Gate 5 Failed: Window training date exceeds test date");
    }
  }
  console.log("   ✓ Gate 5 Passed: 4 sequential expanding walk-forward windows validated with expanding train sizes.\n");

  // ==========================================================================
  // Gate 6: Model Outputs
  // ==========================================================================
  console.log("6. Validating Model Outputs & Probability Normalization...");
  if (!holdoutRes.probabilitiesSumToOne) {
    throw new Error("Gate 6 Failed: Holdout probabilities do not sum to 1.0");
  }
  for (const win of wfRes.windows) {
    if (!win.probabilitiesSumToOne) {
      throw new Error(`Gate 6 Failed: Window ${win.windowIndex} probabilities do not sum to 1.0`);
    }
  }
  console.log("   ✓ Gate 6 Passed: Deterministic predictions and strict 1.0 probability summation verified.\n");

  // ==========================================================================
  // Gate 7: Metric Validity
  // ==========================================================================
  console.log("7. Validating Metric Validity (Accuracy, Balanced Accuracy, Log Loss, Confusion Matrix)...");
  if (holdoutRes.accuracy < 0 || holdoutRes.accuracy > 1) {
    throw new Error(`Gate 7 Failed: Accuracy out of bounds: ${holdoutRes.accuracy}`);
  }
  if (holdoutRes.balancedAccuracy < 0 || holdoutRes.balancedAccuracy > 1) {
    throw new Error(`Gate 7 Failed: Balanced accuracy out of bounds: ${holdoutRes.balancedAccuracy}`);
  }
  if (holdoutRes.logLoss === null || !Number.isFinite(holdoutRes.logLoss) || holdoutRes.logLoss <= 0) {
    throw new Error(`Gate 7 Failed: Log loss must be positive finite number, got ${holdoutRes.logLoss}`);
  }
  let cmTotal = 0;
  for (const row of Object.values(holdoutRes.confusionMatrix.matrix)) {
    for (const cnt of Object.values(row)) {
      cmTotal += cnt;
    }
  }
  if (cmTotal !== 754) {
    throw new Error(`Gate 7 Failed: Confusion matrix sample count ${cmTotal} !== 754 test rows`);
  }
  console.log("   ✓ Gate 7 Passed: Valid metric ranges and exact confusion matrix conservation verified.\n");

  // ==========================================================================
  // Gate 8: Leakage Invariants & Adversarial Resistance
  // ==========================================================================
  console.log("8. Validating Leakage Invariants & Adversarial Perturbation Resistance...");
  const audit = auditBaselineLeakageResistance(dataset);
  if (!audit.passed) {
    throw new Error(`Gate 8 Failed: Leakage audit failed with issues: ${audit.issues.join("; ")}`);
  }
  if (!audit.testLabelsNeverUsedInFitting) {
    throw new Error("Gate 8 Failed: testLabelsNeverUsedInFitting invariant violated");
  }
  if (!audit.empiricalFrequenciesFromTrainOnly) {
    throw new Error("Gate 8 Failed: empiricalFrequenciesFromTrainOnly invariant violated");
  }
  if (!audit.majorityClassFromTrainOnly) {
    throw new Error("Gate 8 Failed: majorityClassFromTrainOnly invariant violated");
  }
  if (!audit.chronologicalOrderingPreserved) {
    throw new Error("Gate 8 Failed: chronologicalOrderingPreserved invariant violated");
  }
  if (!audit.targetColumnsNotInModelInputs) {
    throw new Error("Gate 8 Failed: targetColumnsNotInModelInputs invariant violated");
  }
  if (!audit.sourceIdentifiersNotPredictive) {
    throw new Error("Gate 8 Failed: sourceIdentifiersNotPredictive invariant violated");
  }
  console.log("   ✓ Gate 8 Passed: Zero leakage confirmed across all 9 leakage checks including adversarial perturbation.\n");

  // ==========================================================================
  // Gate 9: Reproducibility
  // ==========================================================================
  console.log("9. Validating Deterministic Reproducibility Across Executions...");
  const repeatHoldout = runChronologicalHoldoutBacktest(dataset, "observed_last_digit", "EMPIRICAL");
  if (repeatHoldout.resultId !== holdoutRes.resultId || repeatHoldout.deterministicHash !== holdoutRes.deterministicHash) {
    throw new Error("Gate 9 Failed: Holdout backtest result ID / hash mismatch on repeated execution");
  }
  if (repeatHoldout.accuracy !== holdoutRes.accuracy || repeatHoldout.logLoss !== holdoutRes.logLoss) {
    throw new Error("Gate 9 Failed: Holdout metric variance detected across repeated execution");
  }

  const repeatWf = runWalkForwardBacktest(dataset, "observed_last_digit", "EMPIRICAL");
  if (repeatWf.aggregateId !== wfRes.aggregateId || repeatWf.deterministicHash !== wfRes.deterministicHash) {
    throw new Error("Gate 9 Failed: Walk-forward aggregate ID / hash mismatch on repeated execution");
  }
  console.log("   ✓ Gate 9 Passed: 100% deterministic reproducibility verified for IDs, hashes, and metrics.\n");

  // ==========================================================================
  // Gate 10: Result Integrity & Comprehensive Comparison Report
  // ==========================================================================
  console.log("10. Validating Result Integrity & Generating Comparison Report...");
  const report = generateBaselineComparisonReport(dataset);
  if (report.holdoutResults.length !== 9) {
    throw new Error(`Gate 10 Failed: Expected 9 holdout results (3 targets × 3 models), got ${report.holdoutResults.length}`);
  }
  if (report.walkForwardAggregates.length !== 9) {
    throw new Error(`Gate 10 Failed: Expected 9 walk-forward aggregates, got ${report.walkForwardAggregates.length}`);
  }
  if (report.summaryTable.length !== 9) {
    throw new Error(`Gate 10 Failed: Expected 9 summary table rows, got ${report.summaryTable.length}`);
  }
  if (report.windowBreakdownTable.length !== 36) { // 9 aggregates × 4 windows
    throw new Error(`Gate 10 Failed: Expected 36 window detail rows, got ${report.windowBreakdownTable.length}`);
  }
  if (!report.descriptiveOnly) {
    throw new Error("Gate 10 Failed: descriptiveOnly must be strictly true");
  }

  console.log("\n============================================================");
  console.log("BASELINE BACKTEST COMPARISON REPORT (DESCRIPTIVE MEASUREMENTS)");
  console.log("============================================================");
  console.table(
    report.summaryTable.map((r) => ({
      Target: r.target,
      Model: r.modelType,
      Accuracy: r.accuracy.toFixed(4),
      BalancedAcc: r.balancedAccuracy.toFixed(4),
      LogLoss: r.logLoss !== null ? r.logLoss.toFixed(4) : "N/A"
    }))
  );

  console.log("\nWALK-FORWARD AGGREGATE SUMMARY (4 EXPANDING WINDOWS):");
  console.table(
    report.walkForwardAggregates.map((w) => ({
      Target: w.target,
      Model: w.modelType,
      Windows: w.totalWindows,
      MeanAcc: w.meanAccuracy.toFixed(4),
      MeanBalAcc: w.meanBalancedAccuracy.toFixed(4),
      MeanLogLoss: w.meanLogLoss !== null ? w.meanLogLoss.toFixed(4) : "N/A"
    }))
  );

  console.log("   ✓ Gate 10 Passed: Result integrity confirmed, report generated with 0 predictive claims.\n");

  console.log("============================================================");
  console.log("MILESTONE 7B VERIFICATION COMPLETED SUCCESSFULLY!");
  console.log("Status: ALL 10 QUALITY GATES PASSED");
  console.log("============================================================\n");
}

runDevBaselineBacktest7B().catch((err) => {
  console.error("\n❌ Milestone 7B Verification Failed:", err);
  process.exit(1);
});
