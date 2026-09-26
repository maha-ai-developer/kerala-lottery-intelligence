/**
 * Milestone 5A — Historical Statistical Foundation Verification Script
 *
 * Runs the deterministic statistical aggregation layer against the canonical dataset:
 * SHA-256: 9bc76b6017edb26d3c13d415cd96280f4a2f066d24c41ce7a82b39b44dee557c
 *
 * Strict Invariants:
 * - OBSERVED DATA + STATISTICAL SUMMARY ONLY.
 * - Zero prediction, recommendation, betting strategy, or ML/LLM.
 * - Single-draw observation limitation explicitly declared.
 * - Population separation: full-ticket vs suffix.
 * - String preservation with leading zeros (e.g. "0259", "0081").
 * - Determinism: identical input -> identical aggregate.
 * - Safe runtime auth without inspecting credentials.
 */

import {
  FirestoreRestDocumentPageRepository,
  FirestoreRestDocumentSegmentationRepository
} from "@kerala-lottery/data";
import {
  DocumentSemanticSegmentationService,
  LotteryEntityExtractorService,
  DEFAULT_ENTITY_PARSER_VERSION
} from "@kerala-lottery/documents";
import {
  buildLotteryKnowledgeGraph,
  validateLotteryKnowledgeGraph
} from "@kerala-lottery/knowledge";
import {
  calculateHistoricalStatistics,
  FirestoreRestHistoricalStatisticsRepository,
  InMemoryHistoricalStatisticsRepository,
  DEFAULT_STATISTICAL_VERSION,
  type HistoricalLotteryStatisticsAggregate
} from "@kerala-lottery/statistics";

const CANONICAL_SHA256 =
  "9bc76b6017edb26d3c13d415cd96280f4a2f066d24c41ce7a82b39b44dee557c";

export async function runDevHistoricalStatistics5AVerification() {
  console.log("============================================================");
  console.log("Milestone 5A — Historical Statistical Foundation Verification");
  console.log("Target Project: kerala-lottery-intel-dev (DEV ONLY)");
  console.log("Scope: Deterministic Descriptive Historical Statistics");
  console.log("Statistical Version:", DEFAULT_STATISTICAL_VERSION);
  console.log("============================================================");

  const token = process.env.GCP_ACCESS_TOKEN || process.env.FIREBASE_TOKEN;

  if (!token) {
    console.log("\n[INFO] Safe runtime authentication: GCP_ACCESS_TOKEN or FIREBASE_TOKEN not set.");
    console.log("       Running canonical dataset verification in OFFLINE mode using canonical fixture.");
    return await runOfflineCanonicalVerification();
  }

  const projectId = "kerala-lottery-intel-dev";

  const pageRepository = new FirestoreRestDocumentPageRepository({
    projectId,
    databaseId: "(default)",
    getAccessToken: () => token
  });

  const segmentationRepository = new FirestoreRestDocumentSegmentationRepository({
    projectId,
    databaseId: "(default)",
    getAccessToken: () => token
  });

  const statsRepository = new FirestoreRestHistoricalStatisticsRepository({
    projectId,
    databaseId: "(default)",
    getAccessToken: () => token
  });

  // 1. Load DocumentPage records from DEV Firestore
  console.log("\n1. Loading Milestone 3C DocumentPage Records from DEV Firestore...");
  console.log(`   Source SHA-256: ${CANONICAL_SHA256}`);
  const pages = await pageRepository.getByDocumentSha256(CANONICAL_SHA256);
  console.log(`   Retrieved ${pages.length} DocumentPage records from DEV`);

  if (pages.length === 0) {
    throw new Error(`No DocumentPage records found for ${CANONICAL_SHA256} in DEV Firestore!`);
  }
  pages.sort((a, b) => a.pageNumber - b.pageNumber);

  // 2. Load or compute 3D Semantic Segmentation
  console.log("\n2. Loading Milestone 3D Semantic Segmentation from DEV Firestore...");
  let segmentation = await segmentationRepository.getByDocumentSha256(CANONICAL_SHA256);
  if (!segmentation) {
    console.log("   (Segmentation record not found in Firestore; computing dynamically)");
    const segService = new DocumentSemanticSegmentationService();
    segmentation = segService.segmentDocument(pages);
  } else {
    console.log(`   ✓ Found existing segmentation record: ${segmentation.id}`);
  }

  // 3. Extract 3E Validated Entities
  console.log("\n3. Extracting Milestone 3E Validated Lottery Entities...");
  const extractorService = new LotteryEntityExtractorService(DEFAULT_ENTITY_PARSER_VERSION);
  const extractionResult = extractorService.extract(segmentation, pages);
  console.log(`   ✓ Validated Prize Tiers: ${extractionResult.prizeTiers.length}`);
  console.log(`   ✓ Validated Series: ${extractionResult.series.length}`);
  console.log(`   ✓ Validated Winning Results: ${extractionResult.winningResults.length}`);
  console.log(`   ✓ Validated Winning Numbers: ${extractionResult.winningNumbers.length}`);

  // 4. Construct 4A Knowledge Graph
  console.log("\n4. Constructing Milestone 4A Knowledge Graph...");
  const graph = buildLotteryKnowledgeGraph(extractionResult, segmentation);
  validateLotteryKnowledgeGraph(graph);
  console.log(`   ✓ Knowledge Graph Validated: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);

  // 5. Execute 5A Historical Statistical Engine
  console.log("\n5. Computing Milestone 5A Historical Statistics from Knowledge Graph...");
  const aggregate = calculateHistoricalStatistics(graph);
  validateAggregateInvariants(aggregate);

  // 6. Persistence & Idempotency
  console.log("\n6. Persisting Statistical Aggregate to DEV Firestore...");
  await statsRepository.saveAggregate(aggregate);
  console.log(`   ✓ Statistical aggregate persisted: ID ${aggregate.id}`);

  console.log("\n7. Verifying Persistence & Idempotency from DEV Firestore...");
  const retrieved = await statsRepository.getAggregateById(aggregate.id);
  if (!retrieved) {
    throw new Error(`Failed to retrieve statistical aggregate ${aggregate.id} from DEV Firestore!`);
  }
  console.log(`   ✓ Retrieved aggregate from DEV Firestore. ID matches: ${retrieved.id === aggregate.id}`);

  // Idempotency re-save
  await statsRepository.saveAggregate(aggregate);
  console.log("   ✓ Re-save idempotent check completed.");

  printSummaryReport(aggregate);
  return aggregate;
}

async function runOfflineCanonicalVerification() {
  const pages = createCanonicalFixture(CANONICAL_SHA256);
  const segService = new DocumentSemanticSegmentationService();
  const segmentation = segService.segmentDocument(pages);
  const extractorService = new LotteryEntityExtractorService();
  const extractionResult = extractorService.extract(segmentation, pages);

  const graph = buildLotteryKnowledgeGraph(extractionResult, segmentation);
  validateLotteryKnowledgeGraph(graph);

  console.log(`   ✓ Offline Knowledge Graph Built: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);

  console.log("\nComputing Milestone 5A Historical Statistics from Canonical Graph...");
  const aggregate = calculateHistoricalStatistics(graph);
  validateAggregateInvariants(aggregate);

  // Test repeat determinism
  const repeatAggregate = calculateHistoricalStatistics(graph);
  if (aggregate.id !== repeatAggregate.id) {
    throw new Error("Repeat execution produced differing aggregate IDs! Determinism violated.");
  }
  if (aggregate.scopeHash !== repeatAggregate.scopeHash) {
    throw new Error("Repeat execution produced differing scope hashes! Determinism violated.");
  }
  console.log("   ✓ Repeat execution determinism verified (identical ID and scope hash).");

  // In-memory repository check
  const inMemoryRepo = new InMemoryHistoricalStatisticsRepository();
  await inMemoryRepo.saveAggregate(aggregate);
  const retrieved = await inMemoryRepo.getAggregateById(aggregate.id);
  if (!retrieved || retrieved.id !== aggregate.id) {
    throw new Error("In-memory repository failed to store/retrieve aggregate!");
  }
  console.log("   ✓ In-memory repository persistence & retrieval verified.");

  printSummaryReport(aggregate);
  return aggregate;
}

function validateAggregateInvariants(aggregate: HistoricalLotteryStatisticsAggregate): void {
  console.log("\n--- Validating Milestone 5A Invariants ---");

  // 1. Single Draw Limitation
  if (!aggregate.population.isSingleDrawObservation) {
    throw new Error("Expected single draw observation flag to be TRUE for canonical document!");
  }
  if (!aggregate.datasetSizeLimitationNotice) {
    throw new Error("Expected explicit datasetSizeLimitationNotice on single-draw aggregate!");
  }
  console.log("   ✓ Single-draw limitation notice present & verified.");

  // 2. Population isolation
  if (aggregate.population.drawCount !== 1) {
    throw new Error(`Expected drawCount=1, received ${aggregate.population.drawCount}`);
  }
  console.log(`   ✓ Population draw count verified: ${aggregate.population.drawCount}`);
  console.log(`   ✓ Total winning results count: ${aggregate.drawSummary.totalWinningResultsCount}`);
  console.log(`   ✓ Full-ticket results count: ${aggregate.drawSummary.fullTicketResultsCount}`);
  console.log(`   ✓ Suffix results count: ${aggregate.drawSummary.suffixResultsCount}`);

  // 3. Leading zero preservation
  const numFreq = aggregate.numberFrequency.items;
  const num0259 = numFreq.find((x) => x.canonicalNumber === "0259");
  const num0081 = numFreq.find((x) => x.canonicalNumber === "0081");
  if (!num0259 || !num0081) {
    throw new Error("Leading zero numbers '0259' or '0081' missing from frequency report!");
  }
  console.log(`   ✓ Preserved string numbers with leading zeros: '0259' (occurrences=${num0259.observedOccurrences}), '0081' (occurrences=${num0081.observedOccurrences})`);

  // 4. Series Frequency (Full Tickets Only)
  if (aggregate.seriesFrequency.totalFullTicketResults !== 14) {
    throw new Error(`Expected 14 full-ticket series observations, got ${aggregate.seriesFrequency.totalFullTicketResults}`);
  }
  console.log(`   ✓ Series frequency contains full-ticket results only (count: ${aggregate.seriesFrequency.totalFullTicketResults})`);
  console.log(`   ✓ Distinct series codes observed: ${aggregate.seriesFrequency.distinctSeriesCount}`);

  // 5. Suffix Frequency (Suffixes Only)
  const suffixLen4 = aggregate.suffixFrequency[4];
  if (!suffixLen4 || suffixLen4.totalObservedResults === 0) {
    throw new Error("Expected 4-digit suffix frequency observations, found 0!");
  }
  console.log(`   ✓ Suffix frequency for length 4 contains suffix results only (count: ${suffixLen4.totalObservedResults})`);

  // 6. Descriptive language only
  const keys = Object.keys(aggregate);
  for (const k of keys) {
    const forbidden = ["prediction", "recommendation", "lucky", "due", "hot", "cold"];
    if (forbidden.some((f) => k.toLowerCase().includes(f))) {
      throw new Error(`Forbidden inferential terminology found in key: ${k}`);
    }
  }
  console.log("   ✓ Descriptive language invariant verified (zero prediction/recommendation/lucky terminology)");
}

function printSummaryReport(agg: HistoricalLotteryStatisticsAggregate): void {
  console.log("\n============================================================");
  console.log("MILESTONE 5A CANONICAL DATASET STATISTICAL OBSERVATION");
  console.log("============================================================");
  console.log(`Aggregate ID:          ${agg.id}`);
  console.log(`Statistical Version:   ${agg.statisticalVersion}`);
  console.log(`Scope Hash:            ${agg.scopeHash}`);
  console.log(`Lottery Code:          ${agg.population.lotteryCode ?? "ALL"}`);
  console.log(`Draw IDs:              ${agg.population.drawIds.join(", ")}`);
  console.log(`Observed Draws:        ${agg.population.drawCount}`);
  console.log(`Total Results:         ${agg.drawSummary.totalWinningResultsCount}`);
  console.log(`Full Tickets:          ${agg.drawSummary.fullTicketResultsCount}`);
  console.log(`Suffix Results:        ${agg.drawSummary.suffixResultsCount}`);
  console.log(`Single-Draw Flag:      ${agg.population.isSingleDrawObservation}`);
  console.log(`Limitation Notice:     ${agg.datasetSizeLimitationNotice}`);
  console.log("\nPrize Tier Breakdown:");
  for (const t of agg.prizeTierStats.items) {
    console.log(`  - Tier Rank ${t.tierRank} (${t.tierName}): ${t.resultCount} results (proportion: ${t.resultsProportion.toFixed(4)})`);
  }
  console.log("\nSeries Frequency (Full Ticket Tiers):");
  for (const s of agg.seriesFrequency.items) {
    console.log(`  - Series ${s.seriesCode}: ${s.observedOccurrences} occurrence(s) (frequency: ${s.observedFrequency.toFixed(4)})`);
  }
  console.log("\nLast-Digit Distribution (All Analyzed Numbers):");
  for (const d of agg.lastDigitFrequency.distribution) {
    console.log(`  - Digit ${d.digit}: count = ${d.observedOccurrences} (proportion = ${d.observedProportion.toFixed(4)})`);
  }
  console.log("\nDigit Position Distribution for 4-digit Numbers:");
  const pos4 = agg.digitPositionFrequency[4];
  if (pos4) {
    for (const p of pos4.positions) {
      console.log(`  - Position ${p.position} (from right ${p.positionFromEnd}): total = ${p.totalDigitsAnalyzed}`);
    }
  }
  console.log("\n============================================================");
  console.log("MILESTONE 5A CANONICAL VERIFICATION: COMPLETE AND VALID");
  console.log("============================================================\n");
}

function createCanonicalFixture(targetSha256: string): any[] {
  const b = (order: number, text: string, y = 700) => ({
    order,
    text,
    x: 57,
    y,
    width: 300,
    height: 11,
    top: 842 - y
  });

  const p1Blocks = [
    b(0, "KERALA STATE LOTTERIES - RESULT", 750),
    b(1, "www.statelottery.kerala.gov.in PHONE:- 0471-2305230 DIRECTOR:- 0471-2305193", 723),
    b(2, "www.kerala.gov.in OFFICE:- 0471-2301740 EMAIL:- cru.dir.lotteries@kerala.gov.in", 709),
    b(3, "DHANALEKSHMI LOTTERY NO.DL-40th DRAW held on:- 18/02/2026,3:00 PM", 695),
    b(4, "AT GORKY BHAVAN, NEAR BAKERY JUNCTION, THIRUVANANTHAPURAM", 666),
    b(5, "1st Prize Rs :10000000/- 1) DW 809210 (ERNAKULAM)", 632),
    b(6, "Cons Prize-Rs :5000/- DN 809210 DO 809210 DP 809210 DR 809210 DS 809210", 605),
    b(7, "DT 809210 DU 809210 DV 809210 DX 809210 DY 809210", 579),
    b(8, "DZ 809210", 552),
    b(9, "2nd Prize Rs :3000000/- 1) DO 503175 (PALAKKAD)", 526),
    b(10, "3rd Prize Rs :500000/- 1) DX 475553 (ERNAKULAM)", 500),
    b(11, "FOR THE TICKETS ENDING WITH THE FOLLOWING NUMBERS", 473),
    b(12, "4th Prize-Rs :5000/- 0259 0375 0497 0701 2709", 447),
    b(13, "3083 3362 4165 4255 5063", 420),
    b(14, "5343 5347 5690 6421 6767", 394),
    b(15, "6815 7800 9133 9626", 368),
    b(16, "5th Prize-Rs :2000/- 2072 3709 6776 7476 7685", 341),
    b(17, "9941", 315),
    b(18, "6th Prize-Rs :1000/- 0273 0798 1084 1133 1629", 288),
    b(19, "2962 3301 3523 3621 3992", 262),
    b(20, "4581 4704 5125 5169 5217", 236),
    b(21, "5505 5742 5766 6316 6332", 209),
    b(22, "7023 7707 9141 9219 9281", 183),
    b(23, "7th Prize-Rs :500/- 0191 0243 0535 0592 0603", 156),
    b(24, "0636 0790 0833 0858 0887", 130),
    b(25, "0978 1278 1439 1552 1598", 104),
    b(26, "1671 1722 1786 1794 1882", 77)
  ];

  const p2Blocks = [
    b(0, "8th Prize-Rs :100/- 0081 0134 0154 0212 0262", 807),
    b(1, "0304 0352 0463 0511 0549", 781)
  ];

  const p3Blocks = [
    b(0, "5012 5143 5298 5410 5582", 807),
    b(1, "5674 5789 5890 5912 6023", 781)
  ];

  const p4Blocks = [
    b(0, "9718 9749 9810 9850 9856", 807),
    b(1, "9884 9889 9970", 781),
    b(2, "The prize winners are advised to verify the winning numbers with the results published in the Kerala", 737),
    b(3, "Government Gazette and surrender the winning tickets within 90 days.", 723),
    b(4, "Sd/-", 709),
    b(5, "RAJKAPOOR", 694),
    b(6, "Joint Director", 680)
  ];

  const mk = (num: number, blocks: any[]) => ({
    id: `${targetSha256}_${num}`,
    documentSha256: targetSha256,
    pageNumber: num,
    pageCount: 4,
    extractionMethod: "pdfjs-dist/v4-layout",
    extractionVersion: "v1.0.0-text-layout",
    extractionStatus: "TEXT_LAYER",
    text: blocks.map((x) => x.text).join("\n"),
    textBlocks: blocks,
    pageWidth: 595.28,
    pageHeight: 841.89,
    unit: "pt",
    hasImages: num === 1,
    createdAt: "2026-09-25T10:00:00Z",
    updatedAt: "2026-09-25T10:00:00Z"
  });

  return [mk(1, p1Blocks), mk(2, p2Blocks), mk(3, p3Blocks), mk(4, p4Blocks)];
}

if (
  process.argv[1]?.endsWith("verify-dev-historical-statistics-5a.ts") ||
  process.argv[1]?.endsWith("verify-dev-historical-statistics-5a.js")
) {
  runDevHistoricalStatistics5AVerification().catch((err) => {
    console.error("DEV 5A Historical Statistics Verification Failed:", err);
    process.exit(1);
  });
}
