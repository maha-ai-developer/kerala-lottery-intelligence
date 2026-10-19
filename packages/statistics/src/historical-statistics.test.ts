import { describe, it, expect, beforeEach } from "vitest";
import type { DocumentPage, TextBlock, WinningResult, PrizeTier, Draw, Lottery } from "@kerala-lottery/domain";
import {
  DocumentSemanticSegmentationService,
  extractLotteryEntitiesFromDocument
} from "@kerala-lottery/documents";
import {
  buildLotteryKnowledgeGraph,
  LotteryKnowledgeGraph
} from "@kerala-lottery/knowledge";
import {
  DEFAULT_STATISTICAL_VERSION,
  StatisticalValidationError,
  calculateHistoricalStatistics,
  InMemoryHistoricalStatisticsRepository
} from "./index";

const CANONICAL_SHA256 =
  "9bc76b6017edb26d3c13d415cd96280f4a2f066d24c41ce7a82b39b44dee557c";

function createBlock(order: number, text: string, y = 700): TextBlock {
  return {
    order,
    text,
    x: 57,
    y,
    width: 300,
    height: 11,
    top: 842 - y,
    fontName: "f1",
    fontSize: 10
  };
}

function createCanonical4PageDocumentFixture(): DocumentPage[] {
  const page1Blocks = [
    createBlock(0, "KERALA STATE LOTTERIES - RESULT", 750),
    createBlock(1, "www.statelottery.kerala.gov.in PHONE:- 0471-2305230 DIRECTOR:- 0471-2305193", 723),
    createBlock(2, "www.kerala.gov.in OFFICE:- 0471-2301740 EMAIL:- cru.dir.lotteries@kerala.gov.in", 709),
    createBlock(3, "DHANALEKSHMI LOTTERY NO.DL-40th DRAW held on:- 18/02/2026,3:00 PM", 695),
    createBlock(4, "AT GORKY BHAVAN, NEAR BAKERY JUNCTION, THIRUVANANTHAPURAM", 666),
    createBlock(5, "1st Prize Rs :10000000/- 1) DW 809210 (ERNAKULAM)", 632),
    createBlock(6, "Cons Prize-Rs :5000/- DN 809210 DO 809210 DP 809210 DR 809210 DS 809210", 605),
    createBlock(7, "DT 809210 DU 809210 DV 809210 DX 809210 DY 809210", 579),
    createBlock(8, "DZ 809210", 552),
    createBlock(9, "2nd Prize Rs :3000000/- 1) DO 503175 (PALAKKAD)", 526),
    createBlock(10, "3rd Prize Rs :500000/- 1) DX 475553 (ERNAKULAM)", 500),
    createBlock(11, "FOR THE TICKETS ENDING WITH THE FOLLOWING NUMBERS", 473),
    createBlock(12, "4th Prize-Rs :5000/- 0259 0375 0497 0701 2709", 447),
    createBlock(13, "3083 3362 4165 4255 5063", 420),
    createBlock(14, "5343 5347 5690 6421 6767", 394),
    createBlock(15, "6815 7800 9133 9626", 368),
    createBlock(16, "5th Prize-Rs :2000/- 2072 3709 6776 7476 7685", 341),
    createBlock(17, "9941", 315),
    createBlock(18, "6th Prize-Rs :1000/- 0273 0798 1084 1133 1629", 288),
    createBlock(19, "2962 3301 3523 3621 3992", 262),
    createBlock(20, "4581 4704 5125 5169 5217", 236),
    createBlock(21, "5505 5742 5766 6316 6332", 209),
    createBlock(22, "7023 7707 9141 9219 9281", 183),
    createBlock(23, "7th Prize-Rs :500/- 0191 0243 0535 0592 0603", 156),
    createBlock(24, "0636 0790 0833 0858 0887", 130),
    createBlock(25, "0978 1278 1439 1552 1598", 104),
    createBlock(26, "1671 1722 1786 1794 1882", 77)
  ];

  const page2Blocks = [
    createBlock(0, "8th Prize-Rs :100/- 0081 0134 0154 0212 0262", 807),
    createBlock(1, "0304 0352 0463 0511 0549", 781)
  ];

  const page3Blocks = [
    createBlock(0, "5012 5143 5298 5410 5582", 807),
    createBlock(1, "5674 5789 5890 5912 6023", 781)
  ];

  const page4Blocks = [
    createBlock(0, "9718 9749 9810 9850 9856", 807),
    createBlock(1, "9884 9889 9970", 781),
    createBlock(2, "The prize winners are advised to verify the winning numbers with the results published in the Kerala", 737),
    createBlock(3, "Government Gazette and surrender the winning tickets within 90 days.", 723),
    createBlock(4, "Sd/-", 709),
    createBlock(5, "RAJKAPOOR", 694),
    createBlock(6, "Joint Director", 680)
  ];

  const makePage = (num: number, blocks: TextBlock[]): DocumentPage => ({
    id: `${CANONICAL_SHA256}_${num}`,
    documentSha256: CANONICAL_SHA256,
    pageNumber: num,
    pageCount: 4,
    extractionMethod: "pdfjs-dist/v4-layout",
    extractionVersion: "v1.0.0-text-layout",
    extractionStatus: "TEXT_LAYER",
    text: blocks.map((b) => b.text).join("\n"),
    textBlocks: blocks,
    pageWidth: 595.28,
    pageHeight: 841.89,
    unit: "pt",
    hasImages: num === 1,
    createdAt: "2026-09-25T10:00:00Z",
    updatedAt: "2026-09-25T10:00:00Z"
  });

  return [
    makePage(1, page1Blocks),
    makePage(2, page2Blocks),
    makePage(3, page3Blocks),
    makePage(4, page4Blocks)
  ];
}

function createSampleSyntheticResults(): {
  winningResults: WinningResult[];
  prizeTiers: PrizeTier[];
  draws: Draw[];
  lotteries: Lottery[];
} {
  const draw1: Draw = {
    id: "draw_01",
    lotteryId: "lottery_KARUNYA",
    drawNumber: "KR-100",
    drawDate: "2026-01-10",
    sourceDocumentId: "sha_doc1",
    sourcePage: 1,
    status: "PARSED",
    createdAt: "2026-01-10T10:00:00Z",
    updatedAt: "2026-01-10T10:00:00Z"
  };

  const draw2: Draw = {
    id: "draw_02",
    lotteryId: "lottery_WIN_WIN",
    drawNumber: "W-200",
    drawDate: "2026-02-15",
    sourceDocumentId: "sha_doc2",
    sourcePage: 1,
    status: "PARSED",
    createdAt: "2026-02-15T10:00:00Z",
    updatedAt: "2026-02-15T10:00:00Z"
  };

  const lotteries: Lottery[] = [
    { id: "lottery_KARUNYA", code: "KARUNYA", name: "Karunya", state: "Kerala", active: true, createdAt: "2026-01-01T00:00:00Z" },
    { id: "lottery_WIN_WIN", code: "WIN-WIN", name: "Win-Win", state: "Kerala", active: true, createdAt: "2026-01-01T00:00:00Z" }
  ];

  const tier1: PrizeTier = {
    id: "tier_1st",
    documentSha256: "sha_doc1",
    pageId: "sha_doc1_1",
    pageNumber: 1,
    sourceTextBlockOrders: [1],
    rawSourceText: "1st Prize",
    boundingBox: { x: 0, y: 0, width: 100, height: 10, unit: "pt" },
    parserRule: "rule.test",
    parserVersion: "v1.0.0",
    name: "1st Prize",
    rank: 1,
    tierType: "RANKED",
    isSuffix: false,
    expectedLength: 6,
    confidence: 1.0,
    createdAt: "2026-01-10T10:00:00Z"
  };

  const tier4: PrizeTier = {
    id: "tier_4th",
    documentSha256: "sha_doc1",
    pageId: "sha_doc1_1",
    pageNumber: 1,
    sourceTextBlockOrders: [2],
    rawSourceText: "4th Prize",
    boundingBox: { x: 0, y: 0, width: 100, height: 10, unit: "pt" },
    parserRule: "rule.test",
    parserVersion: "v1.0.0",
    name: "4th Prize",
    rank: 4,
    tierType: "RANKED",
    isSuffix: true,
    expectedLength: 4,
    confidence: 1.0,
    createdAt: "2026-01-10T10:00:00Z"
  };

  const winningResults: WinningResult[] = [
    // Draw 1 full ticket
    {
      id: "res_01",
      documentSha256: "sha_doc1",
      pageId: "sha_doc1_1",
      pageNumber: 1,
      sourceTextBlockOrders: [1],
      rawSourceText: "KA 123456",
      boundingBox: { x: 0, y: 0, width: 100, height: 10, unit: "pt" },
      parserRule: "rule.test",
      parserVersion: "v1.0.0",
      drawId: "draw_01",
      prizeTierId: "tier_1st",
      prizeTierName: "1st Prize",
      rank: 1,
      series: "KA",
      canonicalNumber: "123456",
      numberLength: 6,
      isSuffix: false,
      confidence: 1.0,
      validationStatus: "VALID",
      createdAt: "2026-01-10T10:00:00Z"
    },
    // Draw 1 suffix
    {
      id: "res_02",
      documentSha256: "sha_doc1",
      pageId: "sha_doc1_1",
      pageNumber: 1,
      sourceTextBlockOrders: [2],
      rawSourceText: "0276",
      boundingBox: { x: 0, y: 0, width: 100, height: 10, unit: "pt" },
      parserRule: "rule.test",
      parserVersion: "v1.0.0",
      drawId: "draw_01",
      prizeTierId: "tier_4th",
      prizeTierName: "4th Prize",
      rank: 4,
      canonicalNumber: "0276",
      numberLength: 4,
      isSuffix: true,
      confidence: 1.0,
      validationStatus: "VALID",
      createdAt: "2026-01-10T10:00:00Z"
    },
    // Draw 2 full ticket with same series KA but different number
    {
      id: "res_03",
      documentSha256: "sha_doc2",
      pageId: "sha_doc2_1",
      pageNumber: 1,
      sourceTextBlockOrders: [1],
      rawSourceText: "KA 654321",
      boundingBox: { x: 0, y: 0, width: 100, height: 10, unit: "pt" },
      parserRule: "rule.test",
      parserVersion: "v1.0.0",
      drawId: "draw_02",
      prizeTierId: "tier_1st",
      prizeTierName: "1st Prize",
      rank: 1,
      series: "KA",
      canonicalNumber: "654321",
      numberLength: 6,
      isSuffix: false,
      confidence: 1.0,
      validationStatus: "VALID",
      createdAt: "2026-02-15T10:00:00Z"
    },
    // Draw 2 suffix with same number 0276 to test cross-draw frequency
    {
      id: "res_04",
      documentSha256: "sha_doc2",
      pageId: "sha_doc2_1",
      pageNumber: 1,
      sourceTextBlockOrders: [2],
      rawSourceText: "0276",
      boundingBox: { x: 0, y: 0, width: 100, height: 10, unit: "pt" },
      parserRule: "rule.test",
      parserVersion: "v1.0.0",
      drawId: "draw_02",
      prizeTierId: "tier_4th",
      prizeTierName: "4th Prize",
      rank: 4,
      canonicalNumber: "0276",
      numberLength: 4,
      isSuffix: true,
      confidence: 1.0,
      validationStatus: "VALID",
      createdAt: "2026-02-15T10:00:00Z"
    }
  ];

  return {
    winningResults,
    prizeTiers: [tier1, tier4],
    draws: [draw1, draw2],
    lotteries
  };
}

describe("Milestone 5A: Historical Statistical Foundation", () => {
  let canonicalGraph: LotteryKnowledgeGraph;

  beforeEach(() => {
    const pages = createCanonical4PageDocumentFixture();
    const segService = new DocumentSemanticSegmentationService();
    const segmentation = segService.segmentDocument(pages);
    const extractionResult = extractLotteryEntitiesFromDocument(segmentation, pages);
    canonicalGraph = buildLotteryKnowledgeGraph(extractionResult, segmentation);
  });

  // --------------------------------------------------------------------------
  // 1. Number Frequency
  // --------------------------------------------------------------------------
  it("1. calculates number frequency accurately with source references", () => {
    const sample = createSampleSyntheticResults();
    const stats = calculateHistoricalStatistics(sample);

    const numReport = stats.numberFrequency;
    expect(numReport.totalObservedResults).toBe(4);
    expect(numReport.distinctNumbersCount).toBe(3); // "0276" (count 2), "123456" (count 1), "654321" (count 1)

    // "0276" should be top frequency
    const topItem = numReport.items[0]!;
    expect(topItem.canonicalNumber).toBe("0276");
    expect(topItem.observedOccurrences).toBe(2);
    expect(topItem.observedFrequency).toBe(0.5);
    expect(topItem.sourceDrawIds).toEqual(["draw_01", "draw_02"]);
    expect(topItem.sourceResultIds).toEqual(["res_02", "res_04"]);
  });

  // --------------------------------------------------------------------------
  // 2. Series Frequency
  // --------------------------------------------------------------------------
  it("2. calculates series frequency for full-ticket results and excludes suffix results", () => {
    const sample = createSampleSyntheticResults();
    const stats = calculateHistoricalStatistics(sample);

    const seriesReport = stats.seriesFrequency;
    expect(seriesReport.totalFullTicketResults).toBe(2); // res_01 and res_03
    expect(seriesReport.distinctSeriesCount).toBe(1); // "KA"

    const kaSeries = seriesReport.items[0]!;
    expect(kaSeries.seriesCode).toBe("KA");
    expect(kaSeries.observedOccurrences).toBe(2);
    expect(kaSeries.observedFrequency).toBe(1.0);

    // Suffix results must NEVER receive synthetic series
    const suffixResults = sample.winningResults.filter((r) => r.isSuffix);
    for (const r of suffixResults) {
      expect(r.series).toBeUndefined();
    }
  });

  // --------------------------------------------------------------------------
  // 3. Last-Digit Distribution
  // --------------------------------------------------------------------------
  it("3. computes last-digit distribution across all 10 digits (0-9)", () => {
    const sample = createSampleSyntheticResults();
    const stats = calculateHistoricalStatistics(sample);

    const lastDigitReport = stats.lastDigitFrequency;
    expect(lastDigitReport.totalNumbersAnalyzed).toBe(4);

    // Results ends with:
    // "123456" -> 6
    // "0276" -> 6
    // "654321" -> 1
    // "0276" -> 6
    // So: digit '6' has count 3, digit '1' has count 1, all others 0.
    const distMap = new Map(lastDigitReport.distribution.map((d) => [d.digit, d]));

    expect(distMap.get("6")?.observedOccurrences).toBe(3);
    expect(distMap.get("6")?.observedProportion).toBe(0.75);
    expect(distMap.get("1")?.observedOccurrences).toBe(1);
    expect(distMap.get("1")?.observedProportion).toBe(0.25);
    expect(distMap.get("0")?.observedOccurrences).toBe(0);

    // Sum of proportions must equal 1.0
    const sumProportion = lastDigitReport.distribution.reduce((acc, d) => acc + d.observedProportion, 0);
    expect(sumProportion).toBeCloseTo(1.0, 5);
  });

  // --------------------------------------------------------------------------
  // 4. Digit-Position Distribution
  // --------------------------------------------------------------------------
  it("4. calculates digit-position distribution cleanly separated by number length", () => {
    const sample = createSampleSyntheticResults();
    const stats = calculateHistoricalStatistics(sample);

    // Length 4 reports (for "0276" x 2)
    const len4Report = stats.digitPositionFrequency[4];
    expect(len4Report).toBeDefined();
    expect(len4Report!.totalNumbersAnalyzed).toBe(2);
    expect(len4Report!.positions.length).toBe(4);

    // Position 1 (1st digit from left): '0' has count 2
    const pos1 = len4Report!.positions[0]!;
    expect(pos1.position).toBe(1);
    const pos1Zero = pos1.distribution.find((d) => d.digit === "0");
    expect(pos1Zero?.observedOccurrences).toBe(2);
    expect(pos1Zero?.observedProportion).toBe(1.0);

    // Position 2: '2' has count 2
    const pos2 = len4Report!.positions[1]!;
    expect(pos2.position).toBe(2);
    const pos2Two = pos2.distribution.find((d) => d.digit === "2");
    expect(pos2Two?.observedOccurrences).toBe(2);

    // Length 6 reports (for "123456" and "654321")
    const len6Report = stats.digitPositionFrequency[6];
    expect(len6Report).toBeDefined();
    expect(len6Report!.positions.length).toBe(6);
  });

  // --------------------------------------------------------------------------
  // 5. Suffix Distribution
  // --------------------------------------------------------------------------
  it("5. computes multi-length suffix distribution (2-digit, 3-digit, 4-digit)", () => {
    const sample = createSampleSyntheticResults();
    const stats = calculateHistoricalStatistics(sample);

    const suffix2 = stats.suffixFrequency[2];
    expect(suffix2).toBeDefined();
    // "123456" -> "56"
    // "0276" -> "76" (x2)
    // "654321" -> "21"
    const top2 = suffix2!.items.find((i) => i.suffix === "76");
    expect(top2?.observedOccurrences).toBe(2);
    expect(top2?.observedFrequency).toBe(0.5);

    const suffix3 = stats.suffixFrequency[3];
    expect(suffix3).toBeDefined();
    // "0276" -> "276" (x2)
    const top3 = suffix3!.items.find((i) => i.suffix === "276");
    expect(top3?.observedOccurrences).toBe(2);
  });

  // --------------------------------------------------------------------------
  // 6. Prize-Tier Filtering
  // --------------------------------------------------------------------------
  it("6. isolates population when filtering by prize tier rank", () => {
    const sample = createSampleSyntheticResults();
    const stats1st = calculateHistoricalStatistics(sample, { prizeTierRank: 1 });

    expect(stats1st.numberFrequency.totalObservedResults).toBe(2);
    for (const item of stats1st.numberFrequency.items) {
      expect(["123456", "654321"]).toContain(item.canonicalNumber);
    }

    const stats4th = calculateHistoricalStatistics(sample, { prizeTierRank: 4 });
    expect(stats4th.numberFrequency.totalObservedResults).toBe(2);
    expect(stats4th.numberFrequency.items[0]?.canonicalNumber).toBe("0276");
  });

  // --------------------------------------------------------------------------
  // 7. Lottery Filtering
  // --------------------------------------------------------------------------
  it("7. isolates population when filtering by lottery code", () => {
    const sample = createSampleSyntheticResults();
    const statsKarunya = calculateHistoricalStatistics(sample, { lotteryCode: "KARUNYA" });

    expect(statsKarunya.population.lotteryCode).toBe("KARUNYA");
    expect(statsKarunya.numberFrequency.totalObservedResults).toBe(2);
    for (const item of statsKarunya.numberFrequency.items) {
      expect(item.sourceDrawIds).toEqual(["draw_01"]);
    }
  });

  // --------------------------------------------------------------------------
  // 8. Date-Range Filtering
  // --------------------------------------------------------------------------
  it("8. isolates population when filtering by draw date range", () => {
    const sample = createSampleSyntheticResults();
    // Filter to January 2026 only
    const statsJan = calculateHistoricalStatistics(sample, {
      dateRange: { startDate: "2026-01-01", endDate: "2026-01-31" }
    });

    expect(statsJan.numberFrequency.totalObservedResults).toBe(2);
    for (const item of statsJan.numberFrequency.items) {
      expect(item.sourceDrawIds).toEqual(["draw_01"]);
    }
  });

  // --------------------------------------------------------------------------
  // 9. Population Isolation (Full-Ticket vs Suffix)
  // --------------------------------------------------------------------------
  it("9. strictly separates full-ticket and suffix populations", () => {
    const sample = createSampleSyntheticResults();

    const fullStats = calculateHistoricalStatistics(sample, { resultType: "FULL_TICKET" });
    expect(fullStats.population.resultType).toBe("FULL_TICKET");
    expect(fullStats.numberFrequency.totalObservedResults).toBe(2);
    expect(fullStats.drawSummary.suffixResultsCount).toBe(0);
    expect(fullStats.drawSummary.fullTicketResultsCount).toBe(2);

    const suffixStats = calculateHistoricalStatistics(sample, { resultType: "SUFFIX" });
    expect(suffixStats.population.resultType).toBe("SUFFIX");
    expect(suffixStats.numberFrequency.totalObservedResults).toBe(2);
    expect(suffixStats.drawSummary.fullTicketResultsCount).toBe(0);
    expect(suffixStats.drawSummary.suffixResultsCount).toBe(2);
    expect(suffixStats.seriesFrequency.totalFullTicketResults).toBe(0);
    expect(suffixStats.seriesFrequency.items.length).toBe(0);
  });

  // --------------------------------------------------------------------------
  // 10. Leading-Zero Preservation
  // --------------------------------------------------------------------------
  it("10. preserves leading zeros as exact string tokens ('0259', not 259)", () => {
    const stats = calculateHistoricalStatistics(canonicalGraph);

    // Verify leading-zero numbers in canonical graph
    const zeroPrefixed = ["0259", "0375", "0497", "0701", "0081", "0134", "0154"];

    const freqMap = new Map(stats.numberFrequency.items.map((i) => [i.canonicalNumber, i]));

    for (const expectedNum of zeroPrefixed) {
      const item = freqMap.get(expectedNum);
      expect(item).toBeDefined();
      expect(item?.canonicalNumber).toBe(expectedNum);
      expect(typeof item?.canonicalNumber).toBe("string");
      expect(item?.canonicalNumber.startsWith("0")).toBe(true);
    }

    // Verify position 1 for 4-digit numbers includes '0'
    const len4Report = stats.digitPositionFrequency[4];
    expect(len4Report).toBeDefined();
    const pos1Zero = len4Report!.positions[0]?.distribution.find((d) => d.digit === "0");
    expect(pos1Zero?.observedOccurrences).toBeGreaterThan(0);
  });

  // --------------------------------------------------------------------------
  // 11. Duplicate Handling
  // --------------------------------------------------------------------------
  it("11. handles duplicates explicitly: deduplicates identical entities, rejects conflicts", () => {
    const sample = createSampleSyntheticResults();

    // Duplicate identical result
    const withDuplicate = {
      ...sample,
      winningResults: [...sample.winningResults, sample.winningResults[0]!]
    };
    const stats = calculateHistoricalStatistics(withDuplicate);
    expect(stats.duplicateResultsDetectedCount).toBe(1);
    expect(stats.numberFrequency.totalObservedResults).toBe(4);

    // Conflicting result with same ID but different canonicalNumber
    const conflicting = {
      ...sample,
      winningResults: [
        ...sample.winningResults,
        {
          ...sample.winningResults[0]!,
          canonicalNumber: "999999" // Conflicts with "123456"
        }
      ]
    };
    expect(() => calculateHistoricalStatistics(conflicting)).toThrow(StatisticalValidationError);
  });

  // --------------------------------------------------------------------------
  // 12. Empty Dataset Handling
  // --------------------------------------------------------------------------
  it("12. handles empty datasets explicitly without crashing or uncaught errors", () => {
    const emptyInput = { winningResults: [] };

    // Default throws
    expect(() => calculateHistoricalStatistics(emptyInput)).toThrow(StatisticalValidationError);

    // allowEmpty: true returns zeroed reports
    const zeroedStats = calculateHistoricalStatistics(emptyInput, undefined, { allowEmpty: true });
    expect(zeroedStats.numberFrequency.totalObservedResults).toBe(0);
    expect(zeroedStats.numberFrequency.items.length).toBe(0);
    expect(zeroedStats.seriesFrequency.totalFullTicketResults).toBe(0);
    expect(zeroedStats.lastDigitFrequency.totalNumbersAnalyzed).toBe(0);
  });

  // --------------------------------------------------------------------------
  // 13. Deterministic Repeat Execution
  // --------------------------------------------------------------------------
  it("13. guarantees identical output for identical input across multiple executions", () => {
    const run1 = calculateHistoricalStatistics(canonicalGraph, undefined, {
      computedAt: "2026-09-26T00:00:00.000Z"
    });
    const run2 = calculateHistoricalStatistics(canonicalGraph, undefined, {
      computedAt: "2026-09-26T00:00:00.000Z"
    });

    expect(run1.id).toBe(run2.id);
    expect(run1.numberFrequency.totalObservedResults).toBe(run2.numberFrequency.totalObservedResults);
    expect(run1.numberFrequency.items).toEqual(run2.numberFrequency.items);
    expect(run1.seriesFrequency.items).toEqual(run2.seriesFrequency.items);
    expect(run1.lastDigitFrequency.distribution).toEqual(run2.lastDigitFrequency.distribution);
  });

  // --------------------------------------------------------------------------
  // 14. Statistical Versioning
  // --------------------------------------------------------------------------
  it("14. records and enforces statistical versioning in population scope and IDs", () => {
    const statsDefault = calculateHistoricalStatistics(canonicalGraph);
    expect(statsDefault.metadata.statisticVersion).toBe(DEFAULT_STATISTICAL_VERSION);
    expect(statsDefault.population.statisticalVersion).toBe(DEFAULT_STATISTICAL_VERSION);

    const customVersion = "v2.0.0-custom-stats";
    const statsCustom = calculateHistoricalStatistics(canonicalGraph, undefined, {
      statisticalVersion: customVersion
    });
    expect(statsCustom.metadata.statisticVersion).toBe(customVersion);
    expect(statsCustom.id).not.toBe(statsDefault.id);
  });

  // --------------------------------------------------------------------------
  // 15. Canonical Knowledge Graph Real Dataset & Limitation Notice
  // --------------------------------------------------------------------------
  it("15. aggregates real canonical document graph with explicit single-draw limitation notice", () => {
    const stats = calculateHistoricalStatistics(canonicalGraph);

    expect(stats.population.documentIds).toContain(CANONICAL_SHA256);
    expect(stats.population.isSingleDrawObservation).toBe(true);
    expect(stats.population.datasetSizeLimitationNotice).toContain("SINGLE_DRAW_OBSERVATION");
    expect(stats.population.datasetSizeLimitationNotice).toContain("single lottery draw only");

    // Check full-ticket results from 1st prize and consolation
    expect(stats.drawSummary.fullTicketResultsCount).toBeGreaterThan(0);
    expect(stats.drawSummary.suffixResultsCount).toBeGreaterThan(0);

    // Number 809210 (1st Prize & Consolation)
    const item809210 = stats.numberFrequency.items.find((i) => i.canonicalNumber === "809210");
    expect(item809210).toBeDefined();
    // 1st prize (DW) + Cons prizes (DN, DO, DP, DR, DS, DT, DU, DV, DX, DY, DZ) = 12 total
    expect(item809210?.observedOccurrences).toBe(12);

    // Verify Repository save and query
    const repo = new InMemoryHistoricalStatisticsRepository();
    repo.saveAggregate(stats);

    const retrieved = repo.getAggregateById(stats.id);
    expect(retrieved).toBeDefined();
  });
});
