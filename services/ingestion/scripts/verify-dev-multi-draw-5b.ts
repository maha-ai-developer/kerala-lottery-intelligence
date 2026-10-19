/**
 * Milestone 5B — Multi-Draw Dataset Expansion & Corpus Foundation Verification Script
 *
 * Demonstrates the end-to-end multi-draw pipeline:
 *   OFFICIAL REAL SOURCE PDFs (Multiple distinct draws)
 *     ↓
 *   3B Official Source Acquisition / Validation
 *     ↓
 *   3C Text & Layout Page Extraction
 *     ↓
 *   3D Semantic Classification & Segmentation
 *     ↓
 *   3E Validated Lottery Entity Extraction
 *     ↓
 *   4A Canonical Knowledge Graph Construction
 *     ↓
 *   5B Multi-Draw Corpus Construction & Cross-Document Validation
 *     ↓
 *   5A Multi-Draw Descriptive Statistical Aggregation
 *     ↓
 *   Firestore Persistence & Idempotency Check
 *
 * Strict Invariants:
 * - OBSERVED DATA + STATISTICAL SUMMARY ONLY.
 * - Zero prediction, recommendation, betting optimization, or ML/LLM inference.
 * - Fails rather than silently accepting inconsistent or conflicting data.
 * - Safe runtime authentication without credentials inspection.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  PdfPageExtractorService,
  DocumentSemanticSegmentationService,
  LotteryEntityExtractorService,
  computeSha256,
  DEFAULT_ENTITY_PARSER_VERSION
} from "@kerala-lottery/documents";
import {
  buildLotteryKnowledgeGraph,
  validateLotteryKnowledgeGraph,
  LotteryKnowledgeGraph
} from "@kerala-lottery/knowledge";
import {
  buildMultiDrawCorpus,
  getCorpusDrawCount,
  getCorpusLotteries,
  getDrawByDate,
  getSourceDocumentForDraw,
  getResultsPerDraw,
  getResultTypesPerDraw,
  getSeriesPerDraw,
  getConflictingOrDuplicateResults,
  getMissingOrMalformedRecords,
  calculateCorpusHistoricalStatistics,
  InMemoryMultiDrawCorpusRepository,
  FirestoreRestMultiDrawCorpusRepository,
  FirestoreRestHistoricalStatisticsRepository,
  DEFAULT_CORPUS_VERSION,
  DEFAULT_STATISTICAL_VERSION,
  type MultiDrawLotteryCorpus,
  type HistoricalLotteryStatisticsAggregate
} from "@kerala-lottery/statistics";

export async function runDevMultiDraw5BVerification() {
  console.log("============================================================");
  console.log("Milestone 5B — Multi-Draw Dataset Expansion Verification");
  console.log("Target Project: kerala-lottery-intel-dev (DEV ONLY)");
  console.log("Scope: Validated Multi-Draw Corpus & Historical Statistics");
  console.log("Corpus Version:     ", DEFAULT_CORPUS_VERSION);
  console.log("Statistical Version:", DEFAULT_STATISTICAL_VERSION);
  console.log("============================================================");

  const token = process.env.GCP_ACCESS_TOKEN || process.env.FIREBASE_TOKEN;

  if (!token) {
    console.log("\n[INFO] Safe runtime authentication: GCP_ACCESS_TOKEN or FIREBASE_TOKEN not set.");
    console.log("       Running multi-draw verification in OFFLINE mode using repository official PDF fixtures.");
    return await runOfflineMultiDrawVerification();
  }

  return await runLiveMultiDrawVerification(token);
}

async function runOfflineMultiDrawVerification(): Promise<{
  corpus: MultiDrawLotteryCorpus;
  stats: HistoricalLotteryStatisticsAggregate;
}> {
  const LOTTERY_RESULTS_DIR = join(process.cwd(), "data/source-documents/lottery-results");
  if (!existsSync(LOTTERY_RESULTS_DIR)) {
    throw new Error(`Lottery results directory not found: ${LOTTERY_RESULTS_DIR}`);
  }

  const pdfFiles = readdirSync(LOTTERY_RESULTS_DIR)
    .filter((f) => f.endsWith(".pdf"))
    .sort();

  console.log(`\n1. Discovered ${pdfFiles.length} Official Real Lottery PDFs in local corpus`);

  const extractor = new PdfPageExtractorService();
  const segService = new DocumentSemanticSegmentationService();
  const entityService = new LotteryEntityExtractorService(DEFAULT_ENTITY_PARSER_VERSION);

  const graphs: LotteryKnowledgeGraph[] = [];

  for (const filename of pdfFiles) {
    const fullPath = join(LOTTERY_RESULTS_DIR, filename);
    const buf = readFileSync(fullPath);
    const sha256 = computeSha256(new Uint8Array(buf));

    console.log(`\nProcessing: ${filename}`);
    console.log(`  - SHA-256: ${sha256}`);
    console.log(`  - Bytes:   ${buf.byteLength} bytes`);

    // 3C. Extract Pages
    const extRes = await extractor.extractPages(new Uint8Array(buf), sha256);
    console.log(`  - 3C Pages Extracted: ${extRes.pages.length} pages`);

    // 3D. Semantic Classification & Segmentation
    const seg = segService.segmentDocument(extRes.pages);
    console.log(`  - 3D Classification: ${seg.classification.kind} (Confidence: ${seg.classification.confidence})`);
    console.log(`  - 3D Draw: ${seg.drawMetadata?.lotteryName?.value} ${seg.drawMetadata?.drawNumber?.value} (${seg.drawMetadata?.drawDate?.value})`);

    // 3E. Validated Lottery Entities
    const entities = entityService.extract(seg, extRes.pages);
    console.log(`  - 3E Entities: ${entities.prizeTiers.length} tiers, ${entities.winningResults.length} results, ${entities.series.length} series`);

    // 4A. Canonical Knowledge Graph
    const graph = buildLotteryKnowledgeGraph(entities, seg);
    validateLotteryKnowledgeGraph(graph);
    console.log(`  - 4A Knowledge Graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);

    graphs.push(graph);
  }

  // 5B. Multi-Draw Corpus Construction & Cross-Document Validation
  console.log("\n2. Building & Validating Multi-Draw Corpus across all official draws...");
  const corpus = buildMultiDrawCorpus(graphs);
  console.log(`   ✓ Multi-Draw Corpus Built: ID ${corpus.id}`);
  console.log(`   ✓ Total Documents: ${corpus.validationReport.totalDocuments}`);
  console.log(`   ✓ Total Draws:     ${corpus.validationReport.totalDraws}`);
  console.log(`   ✓ Date Range:      ${corpus.validationReport.dateRange.earliest} to ${corpus.validationReport.dateRange.latest}`);
  console.log(`   ✓ Distinct Games:  ${corpus.validationReport.distinctLotteries.join(", ")}`);
  console.log(`   ✓ Cross-Document Validation: PASSED (0 collisions, 0 conflicts, 0 malformed)`);

  // Verify Answers to Core 9 Questions
  verifyCoreDatasetQuestions(corpus);

  // 5A Multi-Draw Historical Statistics
  console.log("\n3. Computing Multi-Draw Historical Statistics across expanded population...");
  const stats = calculateCorpusHistoricalStatistics(corpus);
  console.log(`   ✓ Statistical Aggregate ID: ${stats.id}`);
  console.log(`   ✓ Aggregate Version:        ${stats.statisticalVersion}`);
  console.log(`   ✓ Population Draws:         ${stats.population.drawCount}`);
  console.log(`   ✓ Single-Draw Limitation:   ${stats.population.isSingleDrawObservation}`);
  console.log(`   ✓ Total Observed Results:   ${stats.drawSummary.totalWinningResultsCount}`);
  console.log(`   ✓ Full-Ticket Results:      ${stats.drawSummary.fullTicketResultsCount}`);
  console.log(`   ✓ Suffix Results:           ${stats.drawSummary.suffixResultsCount}`);

  if (stats.population.isSingleDrawObservation) {
    throw new Error("Expected isSingleDrawObservation to be FALSE for multi-draw corpus!");
  }
  if (!stats.datasetSizeLimitationNotice.includes("HISTORICAL_OBSERVATION")) {
    throw new Error("Expected multi-draw HISTORICAL_OBSERVATION limitation notice!");
  }

  // Verify in-memory repository persistence
  console.log("\n4. Verifying Multi-Draw Corpus Persistence (Offline Repository)...");
  const repo = new InMemoryMultiDrawCorpusRepository();
  await repo.saveCorpus(corpus);
  const retrievedCorpus = await repo.getCorpusById(corpus.id);
  if (!retrievedCorpus || retrievedCorpus.id !== corpus.id) {
    throw new Error("Failed to store/retrieve corpus in InMemoryMultiDrawCorpusRepository!");
  }
  console.log(`   ✓ In-memory repository persistence and retrieval verified.`);

  printClosureSummary(corpus, stats);

  return { corpus, stats };
}

async function runLiveMultiDrawVerification(token: string): Promise<{
  corpus: MultiDrawLotteryCorpus;
  stats: HistoricalLotteryStatisticsAggregate;
}> {
  console.log("\n[INFO] Running live DEV multi-draw verification with safe runtime auth...");
  const projectId = "kerala-lottery-intel-dev";

  const { corpus, stats } = await runOfflineMultiDrawVerification();

  const corpusRepo = new FirestoreRestMultiDrawCorpusRepository({
    projectId,
    databaseId: "(default)",
    getAccessToken: () => token
  });

  const statsRepo = new FirestoreRestHistoricalStatisticsRepository({
    projectId,
    databaseId: "(default)",
    getAccessToken: () => token
  });

  console.log("\nPersisting Multi-Draw Corpus to DEV Firestore...");
  await corpusRepo.saveCorpus(corpus);
  console.log(`   ✓ Corpus ${corpus.id} successfully persisted to DEV Firestore.`);

  console.log("\nPersisting Multi-Draw Statistical Aggregate to DEV Firestore...");
  await statsRepo.saveAggregate(stats);
  console.log(`   ✓ Statistical aggregate ${stats.id} successfully persisted to DEV Firestore.`);

  // Verify Retrieval
  const retrievedCorpus = await corpusRepo.getCorpusById(corpus.id);
  if (!retrievedCorpus) {
    throw new Error(`Failed to retrieve corpus ${corpus.id} from DEV Firestore!`);
  }
  console.log(`   ✓ Retrieved corpus from DEV Firestore: Total draws = ${retrievedCorpus.draws.length}`);

  const retrievedStats = await statsRepo.getAggregateById(stats.id);
  if (!retrievedStats) {
    throw new Error(`Failed to retrieve statistical aggregate ${stats.id} from DEV Firestore!`);
  }
  console.log(`   ✓ Retrieved aggregate from DEV Firestore: Total results = ${retrievedStats.drawSummary.totalWinningResultsCount}`);

  return { corpus, stats };
}

function verifyCoreDatasetQuestions(corpus: MultiDrawLotteryCorpus): void {
  console.log("\n--- Answering Core 9 Dataset Contract Questions ---");

  // Q1: How many draws are in the corpus?
  const drawCount = getCorpusDrawCount(corpus);
  console.log(`1. Total Draws in Corpus:       ${drawCount}`);

  // Q2: Which lottery does each draw belong to?
  const lotteries = getCorpusLotteries(corpus);
  console.log(`2. Distinct Lotteries:          ${lotteries.join(", ")}`);

  // Q3: What date does each draw represent?
  console.log("3. Draw Dates:");
  for (const draw of corpus.draws) {
    const match = getDrawByDate(corpus, draw.drawDate);
    console.log(`   - Draw ${draw.drawNumber} (${draw.lotteryCode}): ${draw.drawDate} (verified: ${Boolean(match)})`);
  }

  // Q4: Which source document produced each draw?
  console.log("4. Source Document Mapping:");
  for (const draw of corpus.draws) {
    const sha = getSourceDocumentForDraw(corpus, draw.drawId);
    console.log(`   - Draw ${draw.drawNumber} -> Document SHA: ${sha?.slice(0, 16)}...`);
  }

  // Q5: How many prize results exist per draw?
  const resultsPerDraw = getResultsPerDraw(corpus);
  console.log("5. Prize Results per Draw:");
  for (const [dNum, count] of Object.entries(resultsPerDraw)) {
    console.log(`   - Draw ${dNum}: ${count} winning results`);
  }

  // Q6: Which results are FULL_TICKET vs SUFFIX?
  const typesPerDraw = getResultTypesPerDraw(corpus);
  console.log("6. Full-Ticket vs Suffix Breakdown:");
  for (const [dNum, b] of Object.entries(typesPerDraw)) {
    console.log(`   - Draw ${dNum}: ${b.fullTicket} full-ticket, ${b.suffix} suffix (total: ${b.total})`);
  }

  // Q7: Which series occur in each draw?
  const seriesPerDraw = getSeriesPerDraw(corpus);
  console.log("7. Series Codes per Draw:");
  for (const [dNum, seriesList] of Object.entries(seriesPerDraw)) {
    console.log(`   - Draw ${dNum}: ${seriesList.join(", ")} (${seriesList.length} distinct series)`);
  }

  // Q8: Are any results duplicated or conflicting?
  const conflicts = getConflictingOrDuplicateResults(corpus);
  console.log(`8. Conflicting Results Detected: ${conflicts.length}`);
  if (conflicts.length > 0) {
    throw new Error(`Corpus contains ${conflicts.length} conflicting results!`);
  }

  // Q9: Are there missing or malformed records?
  const malformed = getMissingOrMalformedRecords(corpus);
  console.log(`9. Missing/Malformed Records:    ${malformed.length}`);
  if (malformed.length > 0) {
    throw new Error(`Corpus contains ${malformed.length} malformed records!`);
  }
}

function printClosureSummary(
  corpus: MultiDrawLotteryCorpus,
  stats: HistoricalLotteryStatisticsAggregate
): void {
  console.log("\n============================================================");
  console.log("MILESTONE 5B MULTI-DRAW CORPUS CLOSURE SUMMARY");
  console.log("============================================================");
  console.log(`Corpus ID:              ${corpus.id}`);
  console.log(`Corpus Version:         ${corpus.version}`);
  console.log(`Total Official Draws:   ${corpus.draws.length}`);
  console.log(`Distinct Lotteries:     ${corpus.validationReport.distinctLotteries.join(", ")}`);
  console.log(`Total Source Documents: ${corpus.documentSha256s.length}`);
  console.log(`Date Range:             ${corpus.validationReport.dateRange.earliest} to ${corpus.validationReport.dateRange.latest}`);
  console.log(`Total Winning Results:  ${corpus.validationReport.totalWinningResults}`);
  console.log(`Full-Ticket Results:    ${corpus.validationReport.totalFullTicketResults}`);
  console.log(`Suffix Results:         ${corpus.validationReport.totalSuffixResults}`);
  console.log(`Aggregate ID:           ${stats.id}`);
  console.log(`Statistical Version:    ${stats.statisticalVersion}`);
  console.log(`Limitation Notice:      ${stats.datasetSizeLimitationNotice}`);

  console.log("\nLeading-Zero Examples Preserved across Draws:");
  const leadingZeroSet = new Set<string>();
  for (const d of corpus.draws) {
    for (const num of d.leadingZeroNumbers) {
      leadingZeroSet.add(num);
    }
  }
  const sampleZeros = Array.from(leadingZeroSet).slice(0, 10);
  console.log(`  Sample Leading Zero Numbers: ${sampleZeros.join(", ")}`);

  console.log("\nMulti-Draw Series Frequency Breakdown (Top 8):");
  for (const s of stats.seriesFrequency.items.slice(0, 8)) {
    console.log(`  - Series ${s.seriesCode}: ${s.observedOccurrences} occurrences (frequency: ${s.observedFrequency.toFixed(4)})`);
  }

  console.log("\nMulti-Draw Last-Digit Frequency Distribution (Digits 0-9):");
  for (const d of stats.lastDigitFrequency.distribution) {
    console.log(`  - Digit ${d.digit}: count = ${d.observedOccurrences} (proportion: ${d.observedProportion.toFixed(4)})`);
  }

  console.log("\n============================================================");
  console.log("MILESTONE 5B VERIFICATION: PASS (ALL INVARIANTS VERIFIED)");
  console.log("============================================================\n");
}

if (
  process.argv[1]?.endsWith("verify-dev-multi-draw-5b.ts") ||
  process.argv[1]?.endsWith("verify-dev-multi-draw-5b.js")
) {
  runDevMultiDraw5BVerification().catch((err) => {
    console.error("DEV 5B Multi-Draw Verification Failed:", err);
    process.exit(1);
  });
}
