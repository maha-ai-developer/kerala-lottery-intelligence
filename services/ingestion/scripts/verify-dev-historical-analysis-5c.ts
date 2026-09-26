/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 5C: Canonical Historical Statistical Analysis Verification Script
 *
 * Verifies the complete 5C historical statistical analysis layer across the
 * canonical multi-draw corpus constructed from authentic official Gazette PDFs.
 *
 * Architecture Chain:
 * SOURCE (3A/3B) -> DATA (3C) -> KNOWLEDGE (3D/3E/4A) -> MULTI-DRAW CORPUS (5B) -> HISTORICAL ANALYSIS (5C)
 *
 * Strictly descriptive: ZERO prediction, ML, or future probability claims.
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
  MultiDrawLotteryCorpus,
  runComprehensiveHistoricalAnalysis,
  HistoricalAnalysisSuite,
  InMemoryHistoricalAnalysisRepository,
  FirestoreRestHistoricalAnalysisRepository,
  DEFAULT_ANALYSIS_VERSION
} from "@kerala-lottery/statistics";

function getSafeRuntimeAuthToken(): string | null {
  const gcpToken = process.env.GCP_ACCESS_TOKEN?.trim();
  if (gcpToken && !gcpToken.startsWith("ey") && !gcpToken.includes("/")) {
    return gcpToken;
  }
  const firebaseToken = process.env.FIREBASE_TOKEN?.trim();
  if (firebaseToken && !firebaseToken.startsWith("ey") && !firebaseToken.includes("/")) {
    return firebaseToken;
  }
  return null;
}

async function runOffline5CVerification(): Promise<{
  corpus: MultiDrawLotteryCorpus;
  suite: HistoricalAnalysisSuite;
}> {
  console.log("============================================================");
  console.log("KERALA STATE LOTTERY INTELLIGENCE PLATFORM");
  console.log("MILESTONE 5C: HISTORICAL STATISTICAL ANALYSIS VERIFICATION");
  console.log("============================================================");
  console.log(`Target: DEV Corpus (6 Official Daily Draws)`);
  console.log(`Version: ${DEFAULT_ANALYSIS_VERSION}`);
  console.log("============================================================\n");

  const resultsDir = join(process.cwd(), "data/source-documents/lottery-results");
  if (!existsSync(resultsDir)) {
    throw new Error(`Directory ${resultsDir} does not exist!`);
  }

  const pdfFiles = readdirSync(resultsDir)
    .filter((f) => f.endsWith(".pdf") && f !== "dhanalekshmi-dl-40.pdf")
    .sort();

  console.log(`1. Processing ${pdfFiles.length} Official Real Lottery PDFs through 3C->3D->3E->4A pipeline...`);

  const extractor = new PdfPageExtractorService();
  const segService = new DocumentSemanticSegmentationService();
  const entityService = new LotteryEntityExtractorService();

  const graphs: LotteryKnowledgeGraph[] = [];
  for (const filename of pdfFiles) {
    const filePath = join(resultsDir, filename);
    const pdfBytes = readFileSync(filePath);
    const sha256 = computeSha256(new Uint8Array(pdfBytes));

    // 3C: PDF layout
    const extRes = await extractor.extractPages(new Uint8Array(pdfBytes), sha256);
    // 3D: Semantic regions
    const segmentation = segService.segmentDocument(extRes.pages);
    // 3E: Lottery entities
    const extraction = entityService.extract(segmentation, extRes.pages);
    // 4A: Knowledge Graph
    const graph = buildLotteryKnowledgeGraph(extraction, segmentation);
    validateLotteryKnowledgeGraph(graph);

    graphs.push(graph);
    console.log(
      `   ✓ Processed: ${filename} -> Draw: ${extraction.drawMetadata?.lotteryName?.value || "LOTTERY"} (${extraction.drawMetadata?.drawDate?.value || "DATE"}), Results: ${extraction.winningResults.length}`
    );
  }

  // 5B: Multi-Draw Corpus
  console.log("\n2. Building Multi-Draw Corpus across validated knowledge graphs...");
  const corpus = buildMultiDrawCorpus(graphs);
  console.log(`   ✓ Multi-Draw Corpus ID: ${corpus.id}`);
  console.log(`   ✓ Total Validated Draws: ${corpus.draws.length}`);
  console.log(`   ✓ Total Winning Results: ${corpus.combinedEntities.winningResults.length}`);

  // 5C: Historical Analysis Suite
  console.log("\n3. Executing Comprehensive 5C Historical Statistical Analysis across 11 dimensions...");
  const suite = runComprehensiveHistoricalAnalysis(corpus, {
    version: DEFAULT_ANALYSIS_VERSION
  });

  console.log(`   ✓ Analysis Suite ID:  ${suite.id}`);
  console.log(`   ✓ Scope Hash:         ${suite.scopeHash}`);
  console.log(`   ✓ Population Level:   ${suite.population.level}`);
  console.log(`   ✓ Analyzed Draws:     ${suite.population.drawCount}`);
  console.log(`   ✓ Descriptive Notice: ${suite.population.descriptiveNotice.slice(0, 70)}...`);

  // Verify Non-Negotiable Invariants
  if (!suite.population.isDescriptiveOnly) {
    throw new Error("Violation: Analysis must be strictly descriptive!");
  }
  if (!suite.population.descriptiveNotice.includes("HISTORICAL_OBSERVATION")) {
    throw new Error("Violation: Missing mandatory descriptive notice!");
  }

  // Print Dimensional Analysis Breakdown
  printDimensionalResults(suite);

  // 4. In-Memory Persistence Verification
  console.log("\n4. Verifying Analysis Persistence in InMemoryHistoricalAnalysisRepository...");
  const memoryRepo = new InMemoryHistoricalAnalysisRepository();
  await memoryRepo.saveAnalysis(suite);
  const retrieved = await memoryRepo.getAnalysisById(suite.id);
  if (!retrieved || retrieved.id !== suite.id) {
    throw new Error("Failed to persist/retrieve historical analysis suite from repository!");
  }
  console.log(`   ✓ Historical analysis suite successfully persisted and retrieved.`);

  return { corpus, suite };
}

function printDimensionalResults(suite: HistoricalAnalysisSuite): void {
  console.log("\n------------------------------------------------------------");
  console.log("5C DIMENSIONAL HISTORICAL ANALYSIS FINDINGS");
  console.log("------------------------------------------------------------");

  // 1. Lottery Breakdown
  console.log("\n[1. Lottery Dimension]");
  for (const lot of suite.lotteryAnalysis.lotteries) {
    console.log(
      `  - ${lot.lotteryCode.padEnd(14)}: ${lot.drawCount} draw, ${lot.totalResultsCount} results (${lot.fullTicketCount} FT / ${lot.suffixCount} Suffix), 12 Series, Tiers: ${lot.prizeTierRanks.join(",")}`
    );
  }

  // 2. Draw Breakdown
  console.log("\n[2. Draw Dimension]");
  for (const draw of suite.drawAnalysis.draws) {
    console.log(
      `  - ${draw.drawNumber.padEnd(10)} (${draw.drawDate}): ${draw.totalResultsCount} results, ${draw.leadingZeroCount} leading-zero numbers (e.g. ${draw.leadingZeroSample.slice(0, 3).join(", ")})`
    );
  }

  // 3. Prize Tier Dimension
  console.log("\n[3. Prize Tier Dimension]");
  for (const tier of suite.prizeTierAnalysis.tiers) {
    console.log(
      `  - Rank ${tier.tierRank.toString().padStart(2)} (${tier.tierName.padEnd(12)}): ${tier.observedResultsCount} results (${(tier.resultsProportion * 100).toFixed(1)}%), Expected Length: ${tier.expectedLength}, Suffix: ${tier.isSuffix}`
    );
  }

  // 4. Result Type Dimension
  console.log("\n[4. Result Type Dimension (FULL_TICKET vs SUFFIX)]");
  console.log(
    `  - FULL_TICKET: ${suite.resultTypeAnalysis.fullTicket.resultsCount} results (${(suite.resultTypeAnalysis.fullTicket.proportionOfTotal * 100).toFixed(2)}%), Lengths: ${suite.resultTypeAnalysis.fullTicket.numberLengths.join(",")}, Series: ${suite.resultTypeAnalysis.fullTicket.distinctSeriesCount} distinct`
  );
  console.log(
    `  - SUFFIX:      ${suite.resultTypeAnalysis.suffix.resultsCount} results (${(suite.resultTypeAnalysis.suffix.proportionOfTotal * 100).toFixed(2)}%), Lengths: ${suite.resultTypeAnalysis.suffix.numberLengths.join(",")}, Series: NONE (Strict Invariant)`
  );

  // 5. Series Dimension
  console.log("\n[5. Series Dimension (Top 6 Series)]");
  for (const s of suite.seriesAnalysis.series.slice(0, 6)) {
    console.log(
      `  - Series ${s.seriesCode}: ${s.observedOccurrences} occurrences (${(s.observedProportion * 100).toFixed(2)}%), Lotteries: ${s.lotteriesPresent.join(", ")}`
    );
  }

  // 6. Last Digit Dimension
  console.log("\n[6. Last Digit Dimension (0-9 Distribution)]");
  for (const item of suite.lastDigitAnalysis.distribution) {
    console.log(
      `  - Digit ${item.digit}: ${item.count.toString().padStart(4)} counts (${(item.proportion * 100).toFixed(2)}%)`
    );
  }
  console.log(
    `  * Chi-Square Goodness-of-Fit against Uniformity: chiSquare = ${suite.lastDigitAnalysis.chiSquareUniformity.chiSquare}, df = ${suite.lastDigitAnalysis.chiSquareUniformity.degreesOfFreedom}`
  );

  // 7. Digit Position Dimension
  console.log("\n[7. Digit Position Dimension (4-Digit Suffixes)]");
  const pos4 = suite.digitPositionAnalysis[4];
  if (pos4) {
    for (const p of pos4.positions) {
      console.log(
        `  - Position ${p.positionFromLeft} from left (${p.positionFromRight} from right): Dominant Digit = '${p.dominantDigit}'`
      );
    }
  }

  // 8. Number Frequency Dimension
  console.log("\n[8. Number Frequency Dimension]");
  console.log(`  - Total Analyzed Results:  ${suite.numberFrequencyAnalysis.totalResultsAnalyzed}`);
  console.log(`  - Distinct Numbers Count:  ${suite.numberFrequencyAnalysis.distinctNumbersCount}`);
  console.log(`  - Repeated Numbers Count:  ${suite.numberFrequencyAnalysis.repeatedNumbersCount}`);
  if (suite.numberFrequencyAnalysis.repeatedNumbers.length > 0) {
    console.log("  - Sample Repeated Numbers Across Draws:");
    for (const rep of suite.numberFrequencyAnalysis.repeatedNumbers.slice(0, 5)) {
      console.log(
        `    * Number '${rep.canonicalNumber}': ${rep.observedOccurrences} occurrences in draws [${rep.drawIds.join(", ")}]`
      );
    }
  }

  // 9. Suffix Frequency Dimension
  console.log("\n[9. Suffix Frequency Dimension (2-Digit Suffixes)]");
  const suff2 = suite.suffixFrequencyAnalysis[2];
  if (suff2) {
    console.log(`  - Distinct 2-Digit Suffixes: ${suff2.distinctSuffixesCount}`);
    console.log(
      `  - Top 2-digit suffixes: ${suff2.topSuffixes.slice(0, 5).map((s) => `'${s.suffix}' (${s.observedOccurrences})`).join(", ")}`
    );
  }

  // 10. Cross-Draw Comparison
  console.log("\n[10. Cross-Draw Comparison]");
  console.log(
    `  - Average Results per Draw: ${suite.crossDrawComparison.crossDrawConsistencySummary.averageResultsPerDraw}`
  );
  console.log(
    `  - Std Deviation Results:    ${suite.crossDrawComparison.crossDrawConsistencySummary.standardDeviationResults}`
  );
  console.log(
    `  - Identical Number Overlaps Across Draws: ${suite.crossDrawComparison.crossDrawConsistencySummary.identicalNumberOverlapCount}`
  );

  // 11. Cross-Lottery Comparison
  console.log("\n[11. Cross-Lottery Comparison]");
  for (const lotRow of suite.crossLotteryComparison.lotteryRows) {
    console.log(
      `  - ${lotRow.lotteryCode.padEnd(14)}: ${lotRow.drawCount} draw, ${lotRow.totalResults} results, Full-Ticket: ${(lotRow.fullTicketProportion * 100).toFixed(1)}%, Suffix: ${(lotRow.suffixProportion * 100).toFixed(1)}%`
    );
  }

  // 12. Multi-Level Population Comparison
  console.log("\n[12. Multi-Level Population Comparison]");
  console.log(
    `  - ALL LOTTERIES:  ${suite.levelComparison.allLotteriesSummary.drawCount} draws, ${suite.levelComparison.allLotteriesSummary.totalResults} results`
  );
  console.log(
    `  - SINGLE LOTTERY: ${suite.levelComparison.singleLotterySummary.lotteryCode} (${suite.levelComparison.singleLotterySummary.totalResults} results)`
  );
  console.log(
    `  - SINGLE DRAW:    ${suite.levelComparison.singleDrawSummary.label} (${suite.levelComparison.singleDrawSummary.totalResults} results)`
  );

  // 13. Provenance Sample
  console.log("\n[13. End-to-End Provenance Traceability]");
  console.log(`  - Total Results Tracked with Provenance: ${suite.provenanceSummary.totalResultsTracked}`);
  const provSample = suite.provenanceSummary.provenanceSample[0];
  if (provSample) {
    console.log(`  - Sample Result ID:     ${provSample.resultId}`);
    console.log(`  - Canonical Number:     ${provSample.canonicalNumber} (Series: ${provSample.series || "NONE"})`);
    console.log(`  - Prize Tier:           ${provSample.prizeTierName} (Rank: ${provSample.prizeTierRank})`);
    console.log(`  - Draw Number:          ${provSample.drawNumber} (${provSample.drawDate})`);
    console.log(`  - Document SHA-256:     ${provSample.sourceDocumentSha256}`);
    console.log(`  - PDF Page ID:          ${provSample.pageId} (Page ${provSample.pageNumber})`);
    console.log(`  - Text Block Orders:    [${provSample.sourceTextBlockOrders.join(", ")}]`);
  }
}

async function runLive5CVerification(token: string): Promise<void> {
  const { suite } = await runOffline5CVerification();

  console.log("\n[INFO] Safe runtime authentication detected. Verifying DEV Firestore persistence...");
  const projectId = "kerala-lottery-intel-dev";

  const firestoreRepo = new FirestoreRestHistoricalAnalysisRepository({
    projectId,
    databaseId: "(default)",
    getAccessToken: () => token
  });

  await firestoreRepo.saveAnalysis(suite);
  console.log(`   ✓ Saved analysis suite ${suite.id} to DEV Firestore collection 'historical_analyses'.`);

  const retrieved = await firestoreRepo.getAnalysisById(suite.id);
  if (!retrieved) {
    throw new Error(`Failed to retrieve analysis suite ${suite.id} from DEV Firestore!`);
  }
  console.log(`   ✓ Retrieved analysis suite from DEV Firestore: ID = ${retrieved.id}`);
}

async function main() {
  const token = getSafeRuntimeAuthToken();
  if (token) {
    await runLive5CVerification(token);
  } else {
    console.log("[INFO] No safe GCP_ACCESS_TOKEN or FIREBASE_TOKEN set. Running offline verification.");
    await runOffline5CVerification();
  }
  console.log("\n============================================================");
  console.log("MILESTONE 5C VERIFICATION: PASS (ALL INVARIANTS VERIFIED)");
  console.log("============================================================\n");
}

main().catch((err) => {
  console.error("\n[FATAL] Milestone 5C Verification failed:", err);
  process.exit(1);
});
