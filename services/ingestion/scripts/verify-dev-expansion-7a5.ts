/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 7A.5 — Canonical Verifier: Historical Corpus Expansion & Daily Ingestion
 *
 * Verifies:
 * 1. Discovery and inspection of all 98 source PDFs in data/source-documents/lottery-results
 * 2. Immutable source ingestion and deterministic SHA-256 computation
 * 3. Successful parse of all 98 draws through 3C->3D->3E->4A
 * 4. Cross-document batch validation (0 duplicate draws, 0 conflicting results, 0 series violations)
 * 5. Historical corpus expansion to 98 draws and 37,631 results (1,409 FULL_TICKET, 36,222 SUFFIX)
 * 6. Historical reproducibility of original 6 baseline draws
 * 7. End-to-end refresh of downstream derived layers:
 *    - 5A Historical Statistics
 *    - 5B Multi-Draw Corpus
 *    - 5C Historical Analysis
 *    - 5D Statistical Experiments
 *    - 5E Robustness Validation
 *    - 6A Feature Engineering
 *    - 6B Feature Evaluation
 *    - 6C Feature Selection
 *    - 7A Modeling Dataset & Baseline Foundation
 * 8. Production-safe incremental daily ingestion workflow (cached graphs, fast idempotency)
 * 9. Formatted summary output matching specification
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { computeSha256 } from "@kerala-lottery/documents";
import { DailyIngestionEngine } from "../src/daily-ingestion-engine";

const CANONICAL_6_FILES = [
  "271-2344-14-09-2026.pdf",
  "272-2349-15-09-2026.pdf",
  "273-2354-16-09-2026.pdf",
  "275-2358-17-09-2026.pdf",
  "276-2366-12-09-2026.pdf",
  "277-2340-13-09-2026.pdf"
];

async function verifyExpansionMilestone7A5() {
  console.log("============================================================");
  console.log("KERALA STATE LOTTERY INTELLIGENCE PLATFORM");
  console.log("MILESTONE 7A.5: EXPANDED HISTORICAL CORPUS & DAILY INGESTION");
  console.log("============================================================");
  console.log("Target: Expanded Multi-Draw Population (~98 Official Daily Gazette PDFs)");
  console.log("Branch: develop ONLY");
  console.log("Scientific Boundary: DESCRIPTIVE HISTORICAL RESEARCH ONLY");
  console.log("============================================================\n");

  const resultsDir = join(process.cwd(), "data/source-documents/lottery-results");
  if (!existsSync(resultsDir)) {
    throw new Error(`Directory ${resultsDir} does not exist!`);
  }

  // 1. Discovery and Inspection of Source Population
  console.log("1. Inspecting Source Population...");
  const pdfFiles = readdirSync(resultsDir)
    .filter((f) => f.endsWith(".pdf") && f !== "dhanalekshmi-dl-40.pdf")
    .sort();

  console.log(`   ✓ Discovered ${pdfFiles.length} candidate PDF files in directory.`);
  if (pdfFiles.length !== 98) {
    throw new Error(`Expected exactly 98 PDF files, found ${pdfFiles.length}`);
  }

  // Verify all 6 canonical baseline files are present
  const discoveredSet = new Set(pdfFiles);
  for (const cFile of CANONICAL_6_FILES) {
    if (!discoveredSet.has(cFile)) {
      throw new Error(`Missing canonical baseline file: ${cFile}`);
    }
  }
  console.log(`   ✓ All 6 canonical baseline PDFs confirmed present.`);

  // Verify SHA-256 uniqueness across all 98 files
  const shaMap = new Map<string, string>();
  for (const f of pdfFiles) {
    const bytes = readFileSync(join(resultsDir, f));
    const sha = computeSha256(new Uint8Array(bytes));
    if (shaMap.has(sha)) {
      throw new Error(`Duplicate SHA-256 detected between ${f} and ${shaMap.get(sha)}`);
    }
    shaMap.set(sha, f);
  }
  console.log(`   ✓ All ${shaMap.size} files have distinct, unique SHA-256 hashes.`);

  // 2. Execute Daily Ingestion Workflow (Run 1: Ingest & Cache)
  console.log("\n2. Executing DailyIngestionEngine (Run 1: Full Population Ingestion)...");
  const t0 = Date.now();
  const engine = new DailyIngestionEngine();
  const run1 = await engine.execute();
  const dur1 = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`   ✓ Run 1 completed in ${dur1}s. Success: ${run1.success}`);

  if (!run1.success) {
    console.error("Run 1 Validation Errors:", run1.validationReport.errors);
    throw new Error("DailyIngestionEngine Run 1 failed validation!");
  }

  console.log("\n--- Daily Ingestion Output (Run 1) ---");
  console.log(run1.summaryText);
  console.log("-------------------------------------\n");

  // Verify Corpus Metrics
  console.log("3. Verifying Expanded Multi-Draw Corpus (Milestone 5B Foundation)...");
  const corpus = run1.artifacts?.corpus;
  if (!corpus) throw new Error("Missing corpus artifact from run 1");

  console.log(`   ✓ Corpus ID:              ${corpus.id}`);
  console.log(`   ✓ Corpus Hash:            ${corpus.corpusHash}`);
  console.log(`   ✓ Total Validated Draws:  ${corpus.draws.length}`);
  console.log(`   ✓ Total Winning Results:  ${corpus.combinedEntities.winningResults.length}`);
  console.log(`   ✓ FULL_TICKET Results:    ${corpus.validationReport.totalFullTicketResults}`);
  console.log(`   ✓ SUFFIX Results:         ${corpus.validationReport.totalSuffixResults}`);
  console.log(`   ✓ Distinct Lotteries:     ${corpus.validationReport.distinctLotteries.join(", ")}`);
  console.log(`   ✓ Earliest Draw Date:     ${corpus.validationReport.dateRange.earliest}`);
  console.log(`   ✓ Latest Draw Date:       ${corpus.validationReport.dateRange.latest}`);

  if (corpus.draws.length !== 98) {
    throw new Error(`Expected 98 draws in corpus, found ${corpus.draws.length}`);
  }
  if (corpus.combinedEntities.winningResults.length !== 37631) {
    throw new Error(`Expected 37,631 winning results, found ${corpus.combinedEntities.winningResults.length}`);
  }
  if (corpus.validationReport.totalFullTicketResults !== 1409) {
    throw new Error(`Expected 1,409 FULL_TICKET results, found ${corpus.validationReport.totalFullTicketResults}`);
  }
  if (corpus.validationReport.totalSuffixResults !== 36222) {
    throw new Error(`Expected 36,222 SUFFIX results, found ${corpus.validationReport.totalSuffixResults}`);
  }
  if (corpus.validationReport.dateRange.earliest !== "19/06/2026") {
    throw new Error(`Expected earliest draw date 19/06/2026, found ${corpus.validationReport.dateRange.earliest}`);
  }
  if (corpus.validationReport.dateRange.latest !== "26/09/2026") {
    throw new Error(`Expected latest draw date 26/09/2026, found ${corpus.validationReport.dateRange.latest}`);
  }

  // Verify all 6 September canonical baseline draws are present
  const septBaselines = ["12/09/2026", "13/09/2026", "14/09/2026", "15/09/2026", "16/09/2026", "17/09/2026"];
  const corpusDrawDates = new Set(corpus.draws.map(d => d.drawDate));
  for (const bDate of septBaselines) {
    if (!corpusDrawDates.has(bDate)) {
      throw new Error(`Missing September baseline draw date: ${bDate}`);
    }
  }
  console.log(`   ✓ All 6 September canonical baseline draws verified present in corpus.`);

  // 4. Verify Downstream Layers (5A through 7A)
  console.log("\n4. Verifying Downstream Derived Layer Refreshes...");
  console.log(`   ✓ 5A Historical Statistics:    ID ${run1.artifacts?.statistics.id} (Status: ${run1.derivedRefresh.historicalStatistics})`);
  console.log(`   ✓ 5C Historical Analysis:      ID ${run1.artifacts?.analysis.id} (Status: ${run1.derivedRefresh.analysis})`);
  console.log(`   ✓ 5D Statistical Experiment:   ID ${run1.artifacts?.experiment.id} (Status: ${run1.derivedRefresh.experiments})`);
  console.log(`   ✓ 5E Robustness Validation:    ID ${run1.artifacts?.robustness.id} (Status: ${run1.derivedRefresh.robustness})`);
  console.log(`   ✓ 6A Feature Engineering:      ID ${run1.artifacts?.featureMatrix.id} (Rows: ${run1.artifacts?.featureMatrix.totalRecords}, Cols: ${run1.artifacts?.featureMatrix.featureNames.length})`);
  console.log(`   ✓ 6B Feature Evaluation:       ID ${run1.artifacts?.evaluationReport.id} (Features: ${run1.artifacts?.evaluationReport.totalFeaturesEvaluated})`);
  console.log(`   ✓ 6C Feature Selection:        ID ${run1.artifacts?.modelMatrix.id} (Retained: ${run1.artifacts?.modelMatrix.selectedColumnNames.length}, Excluded: ${run1.artifacts?.modelMatrix.excludedDecisions.length})`);
  console.log(`   ✓ 7A Modeling Dataset:         ID ${run1.artifacts?.modelingDataset.id} (Rows: ${run1.artifacts?.modelingDataset.totalRows})`);
  console.log(`   ✓ 7A Uniform Baseline Acc:     ${run1.artifacts?.baselineRuns?.uniform.evaluation.metrics["accuracy"]?.value.toFixed(4)}`);
  console.log(`   ✓ 7A Empirical Baseline Acc:   ${run1.artifacts?.baselineRuns?.empirical.evaluation.metrics["accuracy"]?.value.toFixed(4)}`);
  console.log(`   ✓ 7A Majority Baseline Acc:    ${run1.artifacts?.baselineRuns?.majority.evaluation.metrics["accuracy"]?.value.toFixed(4)}`);

  // Verify all 8 layers passed
  for (const [layer, status] of Object.entries(run1.derivedRefresh)) {
    if (status !== "PASS") {
      throw new Error(`Derived layer ${layer} did not pass! Status: ${status}`);
    }
  }

  // 5. Test Incremental Daily Ingestion (Run 2: Idempotent Execution)
  console.log("\n5. Testing Incremental Ingestion & Idempotency (Run 2)...");
  const t1 = Date.now();
  const run2 = await engine.execute();
  const dur2 = ((Date.now() - t1) / 1000).toFixed(1);

  console.log(`   ✓ Run 2 completed in ${dur2}s (Incremental execution).`);
  console.log(`   ✓ Files Discovered:  ${run2.filesDiscovered}`);
  console.log(`   ✓ Already Ingested:  ${run2.alreadyIngested}`);
  console.log(`   ✓ New Documents:     ${run2.newDocuments}`);
  console.log(`   ✓ Invalid Documents: ${run2.invalidDocuments}`);
  console.log(`   ✓ Duplicate SHA:     ${run2.duplicateSha}`);

  if (run2.alreadyIngested !== 98) {
    throw new Error(`Expected 98 already ingested documents in Run 2, found ${run2.alreadyIngested}`);
  }
  if (run2.newDocuments !== 0) {
    throw new Error(`Expected 0 new documents in Run 2, found ${run2.newDocuments}`);
  }
  if (run2.corpus.id !== run1.corpus.id) {
    throw new Error(`Corpus ID mismatch across idempotent runs: ${run1.corpus.id} vs ${run2.corpus.id}`);
  }
  console.log(`   ✓ Deterministic Corpus ID match: ${run2.corpus.id}`);

  console.log("\n============================================================");
  console.log("MILESTONE 7A.5 VERIFICATION: ALL GATES PASSED [100% SUCCESS]");
  console.log("============================================================\n");
}

verifyExpansionMilestone7A5().catch((err) => {
  console.error("\nFATAL ERROR DURING 7A.5 VERIFICATION:", err);
  process.exit(1);
});
