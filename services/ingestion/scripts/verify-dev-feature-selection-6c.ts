/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 6C: Canonical Feature Selection & Modeling Representation Verifier
 *
 * Executes real DEV feature selection over the validated 6A Feature Matrix
 * and 6B Feature Evaluation Report across the complete architectural chain:
 *
 * SOURCE (3A/3B)
 *   ↓
 * DATA (3C)
 *   ↓
 * KNOWLEDGE (3D/3E/4A)
 *   ↓
 * MULTI-DRAW CORPUS (5B)
 *   ↓
 * HISTORICAL ANALYSIS (5C)
 *   ↓
 * STATISTICAL EXPERIMENT (5D)
 *   ↓
 * ROBUSTNESS VALIDATION (5E)
 *   ↓
 * FEATURE ENGINEERING & REPRESENTATION (6A)
 *   ↓
 * FEATURE EVALUATION & VALIDATION (6B)
 *   ↓
 * FEATURE SELECTION & MODELING REPRESENTATION (6C)
 *
 * Proves:
 * - source matrix = fmat_d34ef4229e8e1b05
 * - source evaluation = feval_579fca9ce9f2a4bc
 * - 2,270 rows preserved
 * - 43 source features accounted for
 * - every feature has a selection decision
 * - no unexplained exclusion
 * - deterministic selection
 * - deterministic model matrix
 * - leading zeros preserved
 * - FULL_TICKET / SUFFIX separation preserved
 * - provenance complete
 * - no leakage
 * - descriptive-only invariant
 * - repeated execution produces identical model feature matrix
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
  DEFAULT_FEATURE_SELECTION_VERSION,
  buildModelFeatureMatrix,
  InMemoryModelFeatureRepository
} from "@kerala-lottery/statistics";

async function runDevFeatureSelection6C(): Promise<void> {
  console.log("============================================================");
  console.log("KERALA STATE LOTTERY INTELLIGENCE PLATFORM");
  console.log("MILESTONE 6C: FEATURE SELECTION & REPRESENTATION VERIFIER");
  console.log("============================================================");
  console.log("Target: DEV Multi-Draw Corpus (6 Official Daily Draws)");
  console.log(`Version: ${DEFAULT_FEATURE_SELECTION_VERSION}`);
  console.log("============================================================\n");

  const resultsDir = join(process.cwd(), "data/source-documents/lottery-results");
  if (!existsSync(resultsDir)) {
    throw new Error(`Directory ${resultsDir} does not exist!`);
  }

  const pdfFiles = readdirSync(resultsDir)
    .filter((f) => f.endsWith(".pdf") && f !== "dhanalekshmi-dl-40.pdf")
    .sort();

  console.log(`1. Ingesting & processing ${pdfFiles.length} Official Real Gazette PDFs through 3C->3D->3E->4A...`);

  const extractor = new PdfPageExtractorService();
  const segService = new DocumentSemanticSegmentationService();
  const entityService = new LotteryEntityExtractorService();

  const graphs: LotteryKnowledgeGraph[] = [];
  for (const filename of pdfFiles) {
    const filePath = join(resultsDir, filename);
    const pdfBytes = readFileSync(filePath);
    const sha256 = computeSha256(new Uint8Array(pdfBytes));

    const extRes = await extractor.extractPages(new Uint8Array(pdfBytes), sha256);
    const segmentation = segService.segmentDocument(extRes.pages);
    const extraction = entityService.extract(segmentation, extRes.pages);
    const graph = buildLotteryKnowledgeGraph(extraction, segmentation);
    validateLotteryKnowledgeGraph(graph);

    graphs.push(graph);
    console.log(
      `   ✓ ${filename.padEnd(26)} -> Draw: ${extraction.drawMetadata?.lotteryName?.value || "LOTTERY"} (${extraction.drawMetadata?.drawDate?.value || "DATE"}), Results: ${extraction.winningResults.length}`
    );
  }

  // 2. Multi-Draw Corpus (5B)
  console.log("\n2. Assembling Validated Multi-Draw Corpus (Milestone 5B)...");
  const corpus = buildMultiDrawCorpus(graphs);
  console.log(`   ✓ Multi-Draw Corpus ID:      ${corpus.id}`);
  console.log(`   ✓ Total Validated Draws:     ${corpus.draws.length}`);
  console.log(`   ✓ Total Winning Results:     ${corpus.combinedEntities.winningResults.length}`);

  if (corpus.combinedEntities.winningResults.length !== 2270) {
    throw new Error(`Corpus Size Error: Expected 2270 results, found ${corpus.combinedEntities.winningResults.length}`);
  }

  // 3. Feature Extraction (6A)
  console.log("\n3. Extracting 6A Feature Matrix (43 Feature Columns, 2,270 Rows)...");
  const featureMatrix = extractCorpusFeatures(corpus);
  console.log(`   ✓ Feature Matrix ID:         ${featureMatrix.id}`);
  console.log(`   ✓ Total Records Extracted:   ${featureMatrix.totalRecords}`);
  console.log(`   ✓ Total Feature Columns:     ${featureMatrix.featureNames.length}`);
  console.log(`   ✓ Deterministic Matrix Hash: ${featureMatrix.deterministicHash}`);

  // Invariant: Source Matrix ID verification
  const EXPECTED_MATRIX_ID = "fmat_d34ef4229e8e1b05";
  if (featureMatrix.id !== EXPECTED_MATRIX_ID) {
    throw new Error(`Source Matrix ID Mismatch: Expected ${EXPECTED_MATRIX_ID}, got ${featureMatrix.id}`);
  }
  console.log(`   ✓ Source Feature Matrix ID verified: ${EXPECTED_MATRIX_ID}`);

  // 4. Feature Evaluation (6B)
  console.log("\n4. Evaluating 6A Features via 6B Statistical Engine...");
  const evaluationReport = evaluateFeatureMatrix(featureMatrix, corpus, {
    evaluatedAt: "2026-09-26T12:00:00.000Z"
  });

  console.log(`   ✓ Evaluation Report ID:      ${evaluationReport.id}`);
  console.log(`   ✓ Evaluation Version:        ${evaluationReport.evaluationVersion}`);
  console.log(`   ✓ Evaluation Status:         ${evaluationReport.status}`);
  console.log(`   ✓ Deterministic Eval Hash:   ${evaluationReport.deterministicHash}`);

  const EXPECTED_EVAL_ID = "feval_579fca9ce9f2a4bc";
  if (evaluationReport.id !== EXPECTED_EVAL_ID) {
    throw new Error(`Evaluation Report ID Mismatch: Expected ${EXPECTED_EVAL_ID}, got ${evaluationReport.id}`);
  }
  console.log(`   ✓ Source Evaluation Report ID verified: ${EXPECTED_EVAL_ID}`);

  // 5. Feature Selection (6C)
  console.log("\n5. Executing Deterministic Feature Selection & Representation (Milestone 6C)...");
  const fixedTimestamp = "2026-09-26T12:00:00.000Z";
  const { matrix: modelMatrix, report: selectionReport } = buildModelFeatureMatrix(
    featureMatrix,
    evaluationReport,
    {
      selectionVersion: DEFAULT_FEATURE_SELECTION_VERSION,
      evaluatedAt: fixedTimestamp
    }
  );

  console.log(`   ✓ Model Feature Matrix ID:   ${modelMatrix.id}`);
  console.log(`   ✓ Model Matrix Hash:         ${modelMatrix.deterministicHash}`);
  console.log(`   ✓ Selection Report ID:       ${selectionReport.reportId}`);
  console.log(`   ✓ Total Input Features:      ${selectionReport.totalFeaturesEvaluated}`);
  console.log(`   ✓ Retained Feature Columns:  ${modelMatrix.selectedColumnNames.length}`);
  console.log(`   ✓ Excluded Decisions Count:  ${modelMatrix.excludedDecisions.length}`);

  // 6. Complete 43-Feature Decision Table
  console.log("\n6. Complete 43-Feature Selection Decision Report:");
  console.log("   ┌──────────────────────────────┬────────────┬────────────────────────────┬────────────────────────────┬──────────────────┐");
  console.log("   │ Feature Name                 │ Family     │ 6B Stability / Status      │ 6C Decision                │ Applicability    │");
  console.log("   ├──────────────────────────────┼────────────┼────────────────────────────┼────────────────────────────┼──────────────────┤");

  for (const fn of featureMatrix.featureNames) {
    const dec = selectionReport.decisions[fn]!;
    const metric = evaluationReport.featureMetrics[fn];
    const name = fn.padEnd(28);
    const family = dec.featureFamily.padEnd(10);
    const status6b = (metric ? metric.stability.classification : "EVALUATED").padEnd(26);
    const decision6c = dec.selectionStatus.padEnd(26);
    const app = dec.structuralApplicability.padEnd(16);

    console.log(`   │ ${name} │ ${family} │ ${status6b} │ ${decision6c} │ ${app} │`);
  }
  console.log("   └──────────────────────────────┴────────────┴────────────────────────────┴────────────────────────────┴──────────────────┘");

  // 7. Excluded Features Rationale
  console.log("\n7. Excluded Feature Decisions Rationale:");
  for (const exc of modelMatrix.excludedDecisions) {
    console.log(`   - [${exc.selectionStatus}] Feature '${exc.featureName}':`);
    console.log(`     Reason: ${exc.selectionReason}`);
  }

  // 8. Sample Record Inspection (Full Ticket vs Suffix)
  console.log("\n8. Sample Model Record Inspection (Full Ticket vs Suffix)...");
  const sampleFT = modelMatrix.rows.find((r) => r.resultType === "FULL_TICKET")!;
  const sampleSX = modelMatrix.rows.find((r) => r.resultType === "SUFFIX")!;

  console.log("   [Sample FULL_TICKET Model Row]");
  console.log(`     ID:                  ${sampleFT.resultId}`);
  console.log(`     Canonical Number:    ${sampleFT.canonicalNumber} (Length: ${sampleFT.numberLength})`);
  console.log(`     Series Code:         ${sampleFT.values["seriesCode"]}`);
  console.log(`     Digit Positions 1..6:[${sampleFT.values["digitPositionFromLeft_1"]}, ${sampleFT.values["digitPositionFromLeft_2"]}, ${sampleFT.values["digitPositionFromLeft_3"]}, ${sampleFT.values["digitPositionFromLeft_4"]}, ${sampleFT.values["digitPositionFromLeft_5"]}, ${sampleFT.values["digitPositionFromLeft_6"]}]`);
  console.log(`     Suffix 2..4:         [${sampleFT.values["suffix2"]}, ${sampleFT.values["suffix3"]}, ${sampleFT.values["suffix4"]}] (Preserved Structural Nulls)`);

  console.log("\n   [Sample SUFFIX Model Row]");
  console.log(`     ID:                  ${sampleSX.resultId}`);
  console.log(`     Canonical Number:    ${sampleSX.canonicalNumber} (Length: ${sampleSX.numberLength})`);
  console.log(`     Series Code:         ${sampleSX.values["seriesCode"]} (Preserved Structural Null)`);
  console.log(`     Digit Positions 1..4:[${sampleSX.values["digitPositionFromLeft_1"]}, ${sampleSX.values["digitPositionFromLeft_2"]}, ${sampleSX.values["digitPositionFromLeft_3"]}, ${sampleSX.values["digitPositionFromLeft_4"]}]`);
  console.log(`     Digit Positions 5..6:[${sampleSX.values["digitPositionFromLeft_5"]}, ${sampleSX.values["digitPositionFromLeft_6"]}] (Preserved Structural Nulls)`);
  console.log(`     Suffix 2..4:         ['${sampleSX.values["suffix2"]}', '${sampleSX.values["suffix3"]}', '${sampleSX.values["suffix4"]}']`);

  // 9. Rigorous Verification of Canonical Invariants
  console.log("\n9. Verifying Non-Negotiable Milestone 6C Invariants...");

  // Invariant 1: Source Matrix ID matches fmat_d34ef4229e8e1b05
  if (modelMatrix.sourceFeatureMatrixId !== EXPECTED_MATRIX_ID) {
    throw new Error(`Invariant Failure: Expected source matrix ID ${EXPECTED_MATRIX_ID}, got ${modelMatrix.sourceFeatureMatrixId}`);
  }
  console.log(`   ✓ Invariant 1: Source Matrix ID confirmed (${EXPECTED_MATRIX_ID}).`);

  // Invariant 2: Source Evaluation ID matches feval_579fca9ce9f2a4bc
  if (modelMatrix.sourceFeatureEvaluationId !== EXPECTED_EVAL_ID) {
    throw new Error(`Invariant Failure: Expected source eval ID ${EXPECTED_EVAL_ID}, got ${modelMatrix.sourceFeatureEvaluationId}`);
  }
  console.log(`   ✓ Invariant 2: Source Evaluation ID confirmed (${EXPECTED_EVAL_ID}).`);

  // Invariant 3: Exactly 2,270 rows preserved
  if (modelMatrix.rows.length !== 2270 || modelMatrix.totalRecords !== 2270) {
    throw new Error(`Invariant Failure: Expected 2270 rows, got ${modelMatrix.rows.length}`);
  }
  console.log("   ✓ Invariant 3: Exactly 2,270 rows preserved without loss or omission.");

  // Invariant 4: All 43 source features accounted for
  if (selectionReport.totalFeaturesEvaluated !== 43) {
    throw new Error(`Invariant Failure: Expected 43 features, got ${selectionReport.totalFeaturesEvaluated}`);
  }
  console.log("   ✓ Invariant 4: All 43 source features accounted for.");

  // Invariant 5: Every feature has an explicit selection decision
  for (const fn of featureMatrix.featureNames) {
    if (!selectionReport.decisions[fn]) {
      throw new Error(`Invariant Failure: Feature '${fn}' has no selection decision!`);
    }
  }
  console.log("   ✓ Invariant 5: Every feature has an explicit selection decision.");

  // Invariant 6: No unexplained exclusions
  if (!selectionReport.validation.noUnexplainedExclusions) {
    throw new Error("Invariant Failure: Unexplained exclusions detected!");
  }
  console.log("   ✓ Invariant 6: Zero unexplained exclusions (all exclusions fully documented).");

  // Invariant 7: Leading zeros preserved
  if (!selectionReport.validation.leadingZerosPreserved) {
    throw new Error("Invariant Failure: Leading zero preservation failed!");
  }
  console.log("   ✓ Invariant 7: Leading zero strings preserved intact without numeric truncation.");

  // Invariant 8: FULL_TICKET / SUFFIX separation preserved
  if (!selectionReport.validation.fullTicketSuffixSeparationPreserved) {
    throw new Error("Invariant Failure: FULL_TICKET/SUFFIX separation failed!");
  }
  console.log("   ✓ Invariant 8: FULL_TICKET/SUFFIX separation strictly maintained.");

  // Invariant 9: Complete provenance chain preserved
  if (!selectionReport.validation.provenancePreserved) {
    throw new Error("Invariant Failure: Provenance chain broken!");
  }
  console.log("   ✓ Invariant 9: Complete end-to-end provenance to source draws and document SHA-256s verified.");

  // Invariant 10: Zero target or outcome leakage
  if (!selectionReport.validation.noTargetLeakage) {
    throw new Error("Invariant Failure: Target leakage detected!");
  }
  console.log("   ✓ Invariant 10: Target leakage validation passed (zero predictive or outcome-derived features).");

  // Invariant 11: Descriptive-only invariant
  if (!modelMatrix.descriptiveOnly || !selectionReport.descriptiveOnly) {
    throw new Error("Invariant Failure: descriptiveOnly flag must be true!");
  }
  console.log("   ✓ Invariant 11: Descriptive-only invariant confirmed.");

  // Invariant 12: Repeated execution equivalence
  const repeat = buildModelFeatureMatrix(featureMatrix, evaluationReport, {
    selectionVersion: DEFAULT_FEATURE_SELECTION_VERSION,
    evaluatedAt: fixedTimestamp
  });
  if (repeat.matrix.id !== modelMatrix.id || repeat.matrix.deterministicHash !== modelMatrix.deterministicHash) {
    throw new Error("Invariant Failure: Repeated execution produced divergent ModelFeatureMatrix ID or Hash!");
  }
  console.log("   ✓ Invariant 12: Repeated execution equivalence confirmed (identical ID and hash).");

  // 10. Repository Persistence Verification
  console.log("\n10. Testing Repository Architecture...");
  const memRepo = new InMemoryModelFeatureRepository();
  await memRepo.saveModelMatrix({
    id: modelMatrix.id,
    matrix: modelMatrix,
    report: selectionReport,
    createdAt: fixedTimestamp
  });
  const retrieved = await memRepo.getModelMatrixById(modelMatrix.id);
  if (!retrieved || retrieved.id !== modelMatrix.id || retrieved.matrix.totalRecords !== 2270) {
    throw new Error("Invariant Failure: Repository retrieval failed!");
  }
  console.log(`   ✓ InMemoryModelFeatureRepository verified for matrix ${retrieved.id}`);

  console.log("\n============================================================");
  console.log("MILESTONE 6C CANONICAL DEV VERIFICATION COMPLETE");
  console.log(`CANONICAL MODEL FEATURE MATRIX ID:   ${modelMatrix.id}`);
  console.log(`CANONICAL DETERMINISTIC MATRIX HASH: ${modelMatrix.deterministicHash}`);
  console.log(`CANONICAL SELECTION REPORT ID:       ${selectionReport.reportId}`);
  console.log(`RETAINED FEATURES: ${modelMatrix.selectedColumnNames.length} | EXCLUDED FEATURES: ${modelMatrix.excludedDecisions.length}`);
  console.log("ALL 12 CANONICAL INVARIANTS SATISFIED & VERIFIED");
  console.log("============================================================\n");
}

runDevFeatureSelection6C().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
