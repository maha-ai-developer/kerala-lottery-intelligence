import { describe, it, expect, beforeAll } from "vitest";
import { join } from "node:path";
import { readFileSync, existsSync } from "node:fs";
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
  MultiDrawLotteryCorpus
} from "./multi-draw-corpus";
import {
  analyzeByLottery,
  analyzeByDraw,
  analyzeByPrizeTier,
  analyzeByResultType,
  analyzeBySeries,
  analyzeByLastDigit,
  analyzeByDigitPosition,
  analyzeByNumberFrequency,
  analyzeBySuffixFrequency,
  compareCrossDraws,
  compareCrossLotteries,
  comparePopulationLevels,
  runComprehensiveHistoricalAnalysis,
  buildAnalysisPopulationScope,
  InMemoryHistoricalAnalysisRepository,
  HISTORICAL_ANALYSIS_DISCLAIMER
} from "./index";
import { StatisticalValidationError } from "./statistical-engine";

describe("Milestone 5C — Historical Statistical Analysis Engine", () => {
  const LOTTERY_RESULTS_DIR = join(process.cwd(), "data/source-documents/lottery-results");
  let corpus: MultiDrawLotteryCorpus;

  beforeAll(async () => {
    const pdfFiles = [
      "271-2344-14-09-2026.pdf", // BHAGYATHARA (BT-71)
      "272-2349-15-09-2026.pdf", // STHREE-SAKTHI (SS-537)
      "273-2354-16-09-2026.pdf", // DHANALEKSHMI (DL-69)
      "276-2366-12-09-2026.pdf"  // KARUNYA (KR-768)
    ];

    const extractor = new PdfPageExtractorService();
    const segService = new DocumentSemanticSegmentationService();
    const entityService = new LotteryEntityExtractorService();

    const graphs: LotteryKnowledgeGraph[] = [];
    for (const filename of pdfFiles) {
      const filePath = join(LOTTERY_RESULTS_DIR, filename);
      if (!existsSync(filePath)) continue;

      const pdfBytes = readFileSync(filePath);
      const sha256 = computeSha256(new Uint8Array(pdfBytes));
      const extRes = await extractor.extractPages(new Uint8Array(pdfBytes), sha256);
      const segmentation = segService.segmentDocument(extRes.pages);
      const extraction = entityService.extract(segmentation, extRes.pages);
      const graph = buildLotteryKnowledgeGraph(extraction, segmentation);
      validateLotteryKnowledgeGraph(graph);
      graphs.push(graph);
    }

    corpus = buildMultiDrawCorpus(graphs);
  });

  // 1. Deterministic Output Invariant
  it("1. Invariant: Deterministic Output & Identical IDs across repeated executions", () => {
    const suite1 = runComprehensiveHistoricalAnalysis(corpus, {
      computedAt: "2026-09-26T12:00:00.000Z"
    });
    const suite2 = runComprehensiveHistoricalAnalysis(corpus, {
      computedAt: "2026-09-26T12:00:00.000Z"
    });

    expect(suite1.id).toBe(suite2.id);
    expect(suite1.scopeHash).toBe(suite2.scopeHash);
    expect(suite1.lotteryAnalysis.id).toBe(suite2.lotteryAnalysis.id);
    expect(suite1.drawAnalysis.id).toBe(suite2.drawAnalysis.id);
    expect(suite1.lastDigitAnalysis.id).toBe(suite2.lastDigitAnalysis.id);
    expect(suite1.crossDrawComparison.id).toBe(suite2.crossDrawComparison.id);
    expect(suite1.crossLotteryComparison.id).toBe(suite2.crossLotteryComparison.id);
    expect(suite1.levelComparison.id).toBe(suite2.levelComparison.id);
  });

  // 2. Population Isolation & Explicit Scope
  it("2. Invariant: Population isolation preserves explicit scope and boundaries", () => {
    const allScope = buildAnalysisPopulationScope(corpus, { level: "ALL_LOTTERIES" });
    expect(allScope.level).toBe("ALL_LOTTERIES");
    expect(allScope.drawCount).toBe(corpus.draws.length);
    expect(allScope.lotteryCode).toBe("ALL_LOTTERIES");
    expect(allScope.isDescriptiveOnly).toBe(true);
    expect(allScope.descriptiveNotice).toContain("HISTORICAL_OBSERVATION");

    const singleDrawId = corpus.draws[0]!.drawId;
    const drawScope = buildAnalysisPopulationScope(corpus, { drawId: singleDrawId });
    expect(drawScope.level).toBe("SINGLE_DRAW");
    expect(drawScope.drawCount).toBe(1);
    expect(drawScope.drawIds).toEqual([singleDrawId]);
    expect(drawScope.lotteryCode).toBe(corpus.draws[0]!.lotteryCode);
  });

  // 3. Lottery Isolation Analysis
  it("3. Invariant: Lottery dimensional analysis isolates observations by lottery game", () => {
    const report = analyzeByLottery(corpus);
    expect(report.distinctLotteriesCount).toBe(corpus.draws.length);
    expect(report.lotteries.length).toBe(corpus.draws.length);

    for (const lot of report.lotteries) {
      expect(lot.drawCount).toBeGreaterThan(0);
      expect(lot.totalResultsCount).toBeGreaterThan(300);
      expect(lot.fullTicketCount).toBe(14);
      expect(lot.suffixCount).toBeGreaterThan(350);
      expect(lot.distinctSeries.length).toBe(12);
      expect(lot.prizeTierRanks.length).toBe(10);
      expect(lot.sourceDocumentSha256s.length).toBe(1);
    }
  });

  // 4. Draw Isolation Analysis
  it("4. Invariant: Draw dimensional analysis isolates observations per draw", () => {
    const report = analyzeByDraw(corpus);
    expect(report.totalDraws).toBe(corpus.draws.length);

    for (const draw of report.draws) {
      expect(draw.drawId).toBeDefined();
      expect(draw.drawDate).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
      expect(draw.totalResultsCount).toBe(draw.fullTicketCount + draw.suffixCount);
      expect(draw.fullTicketCount).toBe(14);
      expect(draw.series.length).toBe(12);
      expect(draw.leadingZeroCount).toBeGreaterThan(0);
      expect(draw.tierCount).toBe(10);
    }
  });

  // 5. Prize Tier Isolation Analysis
  it("5. Invariant: Prize tier dimensional analysis separates and isolates tiers", () => {
    const report = analyzeByPrizeTier(corpus);
    expect(report.totalTiersAnalyzed).toBe(10);
    expect(report.totalResultsCount).toBe(corpus.combinedEntities.winningResults.length);

    const firstPrize = report.tiers.find((t) => t.tierRank === 1);
    expect(firstPrize).toBeDefined();
    expect(firstPrize!.isSuffix).toBe(false);
    expect(firstPrize!.expectedLength).toBe(6);
    expect(firstPrize!.observedResultsCount).toBe(corpus.draws.length * 1); // 1 per draw

    const consolation = report.tiers.find((t) => t.tierRank === 0);
    expect(consolation).toBeDefined();
    expect(consolation!.isSuffix).toBe(false);
    expect(consolation!.expectedLength).toBe(6);
    expect(consolation!.observedResultsCount).toBe(corpus.draws.length * 11); // 11 series per draw for consolation

    const secondPrize = report.tiers.find((t) => t.tierRank === 2);
    expect(secondPrize).toBeDefined();
    expect(secondPrize!.isSuffix).toBe(false);
    expect(secondPrize!.expectedLength).toBe(6);

    const fourthPrize = report.tiers.find((t) => t.tierRank === 4);
    expect(fourthPrize).toBeDefined();
    expect(fourthPrize!.isSuffix).toBe(true);
    expect(fourthPrize!.expectedLength).toBe(4);
  });

  // 6. FULL_TICKET vs SUFFIX Separation
  it("6. Invariant: Strict separation between FULL_TICKET and SUFFIX result types", () => {
    const report = analyzeByResultType(corpus);
    expect(report.totalResults).toBe(corpus.combinedEntities.winningResults.length);

    // FULL_TICKET invariants
    expect(report.fullTicket.resultType).toBe("FULL_TICKET");
    expect(report.fullTicket.resultsCount).toBe(corpus.draws.length * 14);
    expect(report.fullTicket.hasSeries).toBe(true);
    expect(report.fullTicket.distinctSeriesCount).toBeGreaterThan(0);
    expect(report.fullTicket.numberLengths).toEqual([6]);

    // SUFFIX invariants
    expect(report.suffix.resultType).toBe("SUFFIX");
    expect(report.suffix.resultsCount).toBeGreaterThan(1000);
    expect(report.suffix.hasSeries).toBe(false);
    expect(report.suffix.distinctSeriesCount).toBe(0);
    expect(report.suffix.numberLengths).toEqual([4]);
  });

  // 7. Series Analysis
  it("7. Invariant: Series analysis accurately indexes series codes from full ticket results", () => {
    const report = analyzeBySeries(corpus);
    expect(report.totalFullTicketResults).toBe(corpus.draws.length * 14);
    expect(report.distinctSeriesCount).toBeGreaterThan(20);

    for (const s of report.series) {
      expect(s.seriesCode).toMatch(/^[A-Z]{2}$/);
      expect(s.observedOccurrences).toBeGreaterThan(0);
      expect(s.observedProportion).toBeGreaterThan(0);
      expect(s.drawsPresent.length).toBeGreaterThan(0);
      expect(s.lotteriesPresent.length).toBeGreaterThan(0);
    }
  });

  // 8. Last Digit & Uniformity Analysis
  it("8. Invariant: Last digit analysis calculates 0-9 distribution and uniformity stats", () => {
    const report = analyzeByLastDigit(corpus);
    expect(report.totalNumbersAnalyzed).toBe(corpus.combinedEntities.winningResults.length);
    expect(report.distribution.length).toBe(10);

    const sumCounts = report.distribution.reduce((acc, item) => acc + item.count, 0);
    expect(sumCounts).toBe(report.totalNumbersAnalyzed);

    const sumProportions = report.distribution.reduce((acc, item) => acc + item.proportion, 0);
    expect(sumProportions).toBeCloseTo(1.0, 4);

    expect(report.chiSquareUniformity.degreesOfFreedom).toBe(9);
    expect(typeof report.chiSquareUniformity.chiSquare).toBe("number");
    expect(typeof report.chiSquareUniformity.isUniformBaseline).toBe("boolean");
  });

  // 9. Leading Zeros & Digit Position Analysis
  it("9. Invariant: Leading zeros preserved and digit positions computed accurately", () => {
    const posReport4 = analyzeByDigitPosition(corpus, 4);
    expect(posReport4.numberLength).toBe(4);
    expect(posReport4.positions.length).toBe(4);

    for (let i = 0; i < 4; i++) {
      const pos = posReport4.positions[i]!;
      expect(pos.positionFromLeft).toBe(i + 1);
      expect(pos.positionFromRight).toBe(4 - i);
      expect(pos.digits.length).toBe(10);
      expect(pos.dominantDigit).toMatch(/^[0-9]$/);
    }

    // Number frequency preserves leading zeros as strings
    const numReport = analyzeByNumberFrequency(corpus);
    const leadingZeroItem = numReport.topNumbers.find((n) => n.canonicalNumber.startsWith("0"));
    expect(leadingZeroItem).toBeDefined();
    expect(typeof leadingZeroItem!.canonicalNumber).toBe("string");
    expect(leadingZeroItem!.canonicalNumber.startsWith("0")).toBe(true);
    expect(leadingZeroItem!.numberLength).toBe(leadingZeroItem!.canonicalNumber.length);
  });

  // 10. Suffix Frequency Analysis
  it("10. Invariant: Suffix frequency extracts 2, 3, and 4 digit terminal suffixes", () => {
    const report2 = analyzeBySuffixFrequency(corpus, 2);
    expect(report2.suffixLength).toBe(2);
    expect(report2.distinctSuffixesCount).toBeGreaterThan(0);
    expect(report2.topSuffixes[0]!.suffix.length).toBe(2);

    const report3 = analyzeBySuffixFrequency(corpus, 3);
    expect(report3.suffixLength).toBe(3);
    expect(report3.topSuffixes[0]!.suffix.length).toBe(3);

    const report4 = analyzeBySuffixFrequency(corpus, 4);
    expect(report4.suffixLength).toBe(4);
    expect(report4.topSuffixes[0]!.suffix.length).toBe(4);
  });

  // 11. Cross-Draw Comparison
  it("11. Invariant: Cross-draw comparison evaluates metrics and repeated numbers across draws", () => {
    const comparison = compareCrossDraws(corpus);
    expect(comparison.comparedDrawCount).toBe(corpus.draws.length);
    expect(comparison.drawRows.length).toBe(corpus.draws.length);

    for (const row of comparison.drawRows) {
      expect(row.drawId).toBeDefined();
      expect(row.totalResults).toBeGreaterThan(350);
      expect(row.fullTicketCount).toBe(14);
      expect(row.suffixCount).toBeGreaterThan(350);
      expect(Object.keys(row.lastDigitCounts).length).toBe(10);
    }

    expect(comparison.crossDrawConsistencySummary.averageResultsPerDraw).toBeGreaterThan(350);
    expect(typeof comparison.crossDrawConsistencySummary.standardDeviationResults).toBe("number");
  });

  // 12. Cross-Lottery Comparison
  it("12. Invariant: Cross-lottery comparison compares game structures and series allocations", () => {
    const comparison = compareCrossLotteries(corpus);
    expect(comparison.comparedLotteryCount).toBe(corpus.draws.length);
    expect(comparison.lotteryRows.length).toBe(corpus.draws.length);

    for (const row of comparison.lotteryRows) {
      expect(row.lotteryCode).toBeDefined();
      expect(row.drawCount).toBeGreaterThan(0);
      expect(row.avgResultsPerDraw).toBeGreaterThan(350);
      expect(row.fullTicketProportion).toBeGreaterThan(0);
      expect(row.suffixProportion).toBeGreaterThan(0);
      expect(row.prizeTierCount).toBe(10);
      expect(Object.keys(row.lastDigitDistribution).length).toBe(10);
    }

    expect(comparison.lotteryComparisonSummary.resultStructureVariationDescription).toBeDefined();
  });

  // 13. Population Level Comparison (ALL LOTTERIES vs ONE LOTTERY vs ONE DRAW)
  it("13. Invariant: Multi-level comparison evaluates ALL vs ONE LOTTERY vs ONE DRAW without boundary loss", () => {
    const levelComp = comparePopulationLevels(corpus);
    expect(levelComp.allLotteriesSummary.level).toBe("ALL_LOTTERIES");
    expect(levelComp.allLotteriesSummary.drawCount).toBe(corpus.draws.length);
    expect(levelComp.allLotteriesSummary.totalResults).toBe(corpus.combinedEntities.winningResults.length);

    expect(levelComp.singleLotterySummary.level).toBe("SINGLE_LOTTERY");
    expect(levelComp.singleLotterySummary.drawCount).toBe(1);
    expect(levelComp.singleLotterySummary.totalResults).toBeLessThan(levelComp.allLotteriesSummary.totalResults);

    expect(levelComp.singleDrawSummary.level).toBe("SINGLE_DRAW");
    expect(levelComp.singleDrawSummary.drawCount).toBe(1);
    expect(levelComp.singleDrawSummary.drawId).toBeDefined();
  });

  // 14. Provenance Tracking & Traceability
  it("14. Invariant: Full provenance traceability from analysis back to PDF and SHA-256", () => {
    const suite = runComprehensiveHistoricalAnalysis(corpus);
    expect(suite.provenanceSummary.totalResultsTracked).toBe(corpus.combinedEntities.winningResults.length);
    expect(suite.provenanceSummary.totalDrawsTracked).toBe(corpus.draws.length);
    expect(suite.provenanceSummary.documentSha256s).toEqual(
      expect.arrayContaining(corpus.documentSha256s)
    );

    const sample = suite.provenanceSummary.provenanceSample;
    expect(sample.length).toBeGreaterThan(0);

    for (const record of sample) {
      expect(record.resultId).toBeDefined();
      expect(record.canonicalNumber).toBeDefined();
      expect(record.prizeTierId).toBeDefined();
      expect(record.drawId).toBeDefined();
      expect(record.sourceDocumentSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(record.pageId).toBeDefined();
      expect(record.pageNumber).toBeGreaterThanOrEqual(1);
      expect(record.boundingBox).toBeDefined();
    }
  });

  // 15. Repository Persistence & Retrieval
  it("15. Invariant: Historical analysis suite persists and retrieves from InMemory repository", async () => {
    const repo = new InMemoryHistoricalAnalysisRepository();
    const suite = runComprehensiveHistoricalAnalysis(corpus);

    await repo.saveAnalysis(suite);
    const retrieved = await repo.getAnalysisById(suite.id);

    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(suite.id);
    expect(retrieved!.corpusId).toBe(corpus.id);
    expect(retrieved!.population.drawCount).toBe(corpus.draws.length);
    expect(retrieved!.descriptiveLimitations).toContain(HISTORICAL_ANALYSIS_DISCLAIMER);

    const list = await repo.listAnalyses();
    expect(list.length).toBe(1);
    expect(list[0]!.id).toBe(suite.id);
  });

  // 16. Empty Population Safety
  it("16. Invariant: Throws StatisticalValidationError when executing on empty corpus", () => {
    const emptyCorpus: MultiDrawLotteryCorpus = {
      id: "corpus_empty",
      corpusHash: "empty",
      version: "v1",
      computedAt: "2026-09-26T00:00:00Z",
      draws: [],
      documentSha256s: [],
      validationReport: {
        totalDocuments: 0,
        totalDraws: 0,
        distinctLotteries: [],
        dateRange: {},
        totalWinningResults: 0,
        totalFullTicketResults: 0,
        totalSuffixResults: 0,
        duplicateDrawsDetected: [],
        conflictingResultsDetected: [],
        malformedRecordsDetected: [],
        crossDocumentCollisions: [],
        isValid: true,
        validationErrors: []
      },
      knowledgeGraphs: [],
      combinedEntities: {
        winningResults: [],
        prizeTiers: [],
        draws: [],
        lotteries: [],
        documentSha256s: []
      }
    };

    expect(() => runComprehensiveHistoricalAnalysis(emptyCorpus)).toThrow(
      StatisticalValidationError
    );
  });
});
