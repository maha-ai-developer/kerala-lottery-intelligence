/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 6B: Canonical Feature Evaluation & Statistical Validation Verifier
 *
 * Executes real DEV feature evaluation over the validated 6A Feature Matrix
 * and 5B Multi-Draw Corpus across the full architectural chain:
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
 * FEATURE EVALUATION & STATISTICAL VALIDATION (6B)
 *
 * Proves:
 * - 2,270 feature rows evaluated
 * - 43 feature columns accounted for
 * - no rows omitted
 * - no unexpected duplicates
 * - expected structural nulls remain valid
 * - leading zeros remain preserved
 * - FULL_TICKET / SUFFIX separation remains valid
 * - provenance is complete
 * - deterministic rerun produces identical evaluation output
 * - descriptive-only invariant holds
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
  DEFAULT_FEATURE_EVALUATION_VERSION,
  InMemoryFeatureEvaluationRepository
} from "@kerala-lottery/statistics";

async function runDevFeatureEvaluation6B(): Promise<void> {
  console.log("============================================================");
  console.log("KERALA STATE LOTTERY INTELLIGENCE PLATFORM");
  console.log("MILESTONE 6B: FEATURE EVALUATION & VALIDATION VERIFIER");
  console.log("============================================================");
  console.log("Target: DEV Multi-Draw Corpus (6 Official Daily Draws)");
  console.log(`Version: ${DEFAULT_FEATURE_EVALUATION_VERSION}`);
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

  // 4. Feature Evaluation (6B)
  console.log("\n4. Executing Feature Evaluation & Statistical Validation (Milestone 6B)...");
  const fixedTimestamp = "2026-09-26T12:00:00.000Z";
  const evaluationReport = evaluateFeatureMatrix(featureMatrix, corpus, {
    evaluatedAt: fixedTimestamp
  });

  console.log(`   ✓ Evaluation Report ID:      ${evaluationReport.id}`);
  console.log(`   ✓ Evaluation Version:        ${evaluationReport.evaluationVersion}`);
  console.log(`   ✓ Status:                    ${evaluationReport.status}`);
  console.log(`   ✓ Deterministic Eval Hash:   ${evaluationReport.deterministicHash}`);
  console.log(`   ✓ Total Features Evaluated:  ${evaluationReport.totalFeaturesEvaluated}`);
  console.log(`   ✓ Population Scope Hash:     ${evaluationReport.populationScope.populationScopeHash}`);

  // 5. Print Coverage & Distribution Summary Table
  console.log("\n5. Feature Quality, Coverage & Distribution Summary:");
  console.log("   ┌──────────────────────────────┬────────┬──────────┬──────────┬──────────┬──────────┬────────────────────────┐");
  console.log("   │ Feature Name                 │ Family │ Populated│ Missing  │ Exp.Null │ Unexp.Mis│ Distribution / Entropy │");
  console.log("   ├──────────────────────────────┼────────┼──────────┼──────────┼──────────┼──────────┼────────────────────────┤");

  for (const fn of featureMatrix.featureNames) {
    const metric = evaluationReport.featureMetrics[fn]!;
    const name = fn.padEnd(28);
    const family = metric.featureFamily.padEnd(6);
    const pop = String(metric.coverage.populatedCount).padStart(8);
    const mis = String(metric.coverage.missingCount).padStart(8);
    const expNull = String(metric.coverage.expectedStructuralNullsCount).padStart(8);
    const unexp = String(metric.coverage.unexpectedMissingCount).padStart(8);

    let distStr = "";
    if (metric.distribution.numericMetrics) {
      const num = metric.distribution.numericMetrics;
      distStr = `min:${num.min} max:${num.max} mean:${num.mean.toFixed(1)}`;
    } else if (metric.distribution.categoricalMetrics) {
      const cat = metric.distribution.categoricalMetrics;
      distStr = `H:${cat.entropy.toFixed(2)}b mode:${cat.dominantCategory}`;
    }
    const dist = distStr.padEnd(22);

    console.log(`   │ ${name} │ ${family} │ ${pop} │ ${mis} │ ${expNull} │ ${unexp} │ ${dist} │`);
  }
  console.log("   └──────────────────────────────┴────────┴──────────┴──────────┴──────────┴──────────┴────────────────────────┘");

  // 6. Print Redundancy Summary
  console.log("\n6. Feature Redundancy Findings:");
  console.log(`   ✓ Total Pairwise Comparisons:         ${evaluationReport.matrixRedundancySummary.totalPairsEvaluated}`);
  console.log(`   ✓ Exact Duplicate Pairs Count:        ${evaluationReport.matrixRedundancySummary.exactDuplicatePairs.length}`);
  for (const pair of evaluationReport.matrixRedundancySummary.exactDuplicatePairs) {
    console.log(`     - EXACT DUPLICATE: '${pair.featureA}' <==> '${pair.featureB}' (100% pairwise value identity)`);
  }

  console.log(`   ✓ Deterministic Mathematical Transforms: ${evaluationReport.matrixRedundancySummary.deterministicTransforms.length}`);
  for (const dt of evaluationReport.matrixRedundancySummary.deterministicTransforms) {
    console.log(`     - DETERMINISTIC FORMULA: ${dt.relation}`);
  }

  // 7. Print Stability Summary
  console.log("\n7. Partition Stability Classifications:");
  console.log(`   ✓ STABLE Features:              ${evaluationReport.summary.stableFeaturesCount}`);
  console.log(`   ✓ VARIABLE Features:            ${evaluationReport.summary.variableFeaturesCount}`);
  console.log(`   ✓ STRUCTURALLY SPARSE Features: ${evaluationReport.summary.structurallySparseCount}`);
  console.log(`   ✓ INSUFFICIENT DATA Features:   ${evaluationReport.summary.insufficientDataCount}`);

  // 8. Print Integrity Report
  console.log("\n8. Feature Matrix Integrity & Leakage Validation:");
  const ir = evaluationReport.matrixIntegrityReport;
  console.log(`   ✓ Total Rows Evaluated:         ${ir.totalRowsChecked}`);
  console.log(`   ✓ Source Result ID Consistent:  ${ir.sourceResultIdConsistent}`);
  console.log(`   ✓ Source Document SHA Consistent:${ir.sourceDocumentShaConsistent}`);
  console.log(`   ✓ Source Draw ID Consistent:    ${ir.sourceDrawConsistent}`);
  console.log(`   ✓ Result Type Separation Valid: ${ir.resultTypeSeparationValid}`);
  console.log(`   ✓ Series/Suffix Separation Valid:${ir.seriesSuffixSeparationValid}`);
  console.log(`   ✓ Leading Zeros Preserved:      ${ir.leadingZeroPreserved}`);
  console.log(`   ✓ Number Length Consistent:     ${ir.numberLengthConsistent}`);
  console.log(`   ✓ No Duplicated Rows:           ${ir.noDuplicatedRows}`);
  console.log(`   ✓ Zero Target/Outcome Leakage:  ${ir.noTargetLeakage}`);
  console.log(`   ✓ OVERALL INTEGRITY PASSED:     ${ir.integrityChecksPassed}`);

  // 9. Rigorous Verification of Canonical Invariants
  console.log("\n9. Verifying Non-Negotiable Milestone 6B Invariants...");

  // Invariant 1: 2,270 feature rows evaluated
  if (ir.totalRowsChecked !== 2270) {
    throw new Error(`Invariant Failure: Expected 2270 rows evaluated, got ${ir.totalRowsChecked}`);
  }
  console.log("   ✓ Invariant 1: Exactly 2,270 feature rows evaluated.");

  // Invariant 2: 43 feature columns accounted for
  if (evaluationReport.totalFeaturesEvaluated !== 43) {
    throw new Error(`Invariant Failure: Expected 43 feature columns, got ${evaluationReport.totalFeaturesEvaluated}`);
  }
  console.log("   ✓ Invariant 2: Exactly 43 feature columns accounted for.");

  // Invariant 3: No rows omitted
  if (featureMatrix.rows.length !== corpus.combinedEntities.winningResults.length) {
    throw new Error("Invariant Failure: Row count discrepancy between corpus and feature matrix!");
  }
  console.log("   ✓ Invariant 3: Zero rows omitted.");

  // Invariant 4: No unexpected duplicates
  if (!ir.noDuplicatedRows) {
    throw new Error("Invariant Failure: Unexpected duplicate rows detected!");
  }
  console.log("   ✓ Invariant 4: Zero unexpected duplicates.");

  // Invariant 5: Expected structural nulls remain valid (0 unexpected missing)
  if (evaluationReport.summary.unexpectedMissingValuesTotal !== 0) {
    throw new Error(`Invariant Failure: Found ${evaluationReport.summary.unexpectedMissingValuesTotal} unexpected missing values!`);
  }
  console.log("   ✓ Invariant 5: Expected structural nulls classified accurately (0 unexpected missing).");

  // Invariant 6: Leading zeros remain preserved
  if (!ir.leadingZeroPreserved) {
    throw new Error("Invariant Failure: Leading zero preservation failed!");
  }
  console.log("   ✓ Invariant 6: Leading zero preservation confirmed.");

  // Invariant 7: FULL_TICKET / SUFFIX separation remains strictly valid
  if (!ir.resultTypeSeparationValid || !ir.seriesSuffixSeparationValid) {
    throw new Error("Invariant Failure: FULL_TICKET/SUFFIX separation failed!");
  }
  console.log("   ✓ Invariant 7: FULL_TICKET/SUFFIX separation strictly confirmed.");

  // Invariant 8: Provenance is complete
  if (!ir.sourceDocumentShaConsistent || !ir.sourceDrawConsistent) {
    throw new Error("Invariant Failure: Provenance chain broken!");
  }
  console.log("   ✓ Invariant 8: Complete provenance to source document SHA-256 and draw verified.");

  // Invariant 9: Deterministic rerun produces identical evaluation output
  const repeatEval = evaluateFeatureMatrix(featureMatrix, corpus, {
    evaluatedAt: fixedTimestamp
  });
  if (
    repeatEval.id !== evaluationReport.id ||
    repeatEval.deterministicHash !== evaluationReport.deterministicHash ||
    repeatEval.populationScope.populationScopeHash !== evaluationReport.populationScope.populationScopeHash
  ) {
    throw new Error("Invariant Failure: Deterministic rerun produced divergent report hash!");
  }
  console.log("   ✓ Invariant 9: Deterministic repeated execution verified (identical report ID and hash).");

  // Invariant 10: Descriptive-only invariant holds
  if (!evaluationReport.descriptiveOnly) {
    throw new Error("Invariant Failure: descriptiveOnly flag must be true!");
  }
  if (!evaluationReport.limitations.some((l) => l.includes("NON-PREDICTIVE FEATURE EVALUATION NOTICE"))) {
    throw new Error("Invariant Failure: Missing mandatory historical evaluation disclaimer!");
  }
  console.log("   ✓ Invariant 10: Descriptive-only invariant strictly holds (zero predictive claims).");

  // 10. Repository Persistence Test
  console.log("\n10. Testing Repository Architecture...");
  const memRepo = new InMemoryFeatureEvaluationRepository();
  await memRepo.saveEvaluation({
    id: evaluationReport.id,
    report: evaluationReport,
    createdAt: fixedTimestamp
  });
  const retrieved = await memRepo.getEvaluationById(evaluationReport.id);
  if (!retrieved || retrieved.report.id !== evaluationReport.id) {
    throw new Error("Invariant Failure: Repository retrieval failed!");
  }
  console.log(`   ✓ Repository successfully persisted and retrieved report: ${retrieved.id}`);

  console.log("\n============================================================");
  console.log("MILESTONE 6B CANONICAL DEV VERIFICATION COMPLETE");
  console.log("ALL 10 CANONICAL INVARIANTS SATISFIED & VERIFIED");
  console.log("============================================================\n");
}

runDevFeatureEvaluation6B().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
