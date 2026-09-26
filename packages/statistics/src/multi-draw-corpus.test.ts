import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync, existsSync } from "node:fs";
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
  getCorpusDrawCount,
  getCorpusLotteries,
  getDrawsByLottery,
  getDrawByDate,
  getSourceDocumentForDraw,
  getResultsPerDraw,
  getResultTypesPerDraw,
  getSeriesPerDraw,
  getConflictingOrDuplicateResults,
  getMissingOrMalformedRecords,
  calculateCorpusHistoricalStatistics,
  InMemoryMultiDrawCorpusRepository,
  DEFAULT_CORPUS_VERSION,
  DEFAULT_STATISTICAL_VERSION,
  StatisticalValidationError
} from "./index";

describe("Milestone 5B — Multi-Draw Dataset Expansion & Corpus Foundation", () => {
  const LOTTERY_RESULTS_DIR = join(process.cwd(), "data/source-documents/lottery-results");

  let graphs: LotteryKnowledgeGraph[] = [];

  beforeEach(async () => {
    // Build real knowledge graphs from the real official Kerala State Lottery PDFs in the repository
    const pdfFiles = [
      "271-2344-14-09-2026.pdf", // BHAGYATHARA (BT-71)
      "272-2349-15-09-2026.pdf", // STHREE-SAKTHI (SS-537)
      "273-2354-16-09-2026.pdf", // DHANALEKSHMI (DL-69)
      "275-2358-17-09-2026.pdf"  // KARUNYA PLUS (KN-641)
    ];

    const extractor = new PdfPageExtractorService();
    const segService = new DocumentSemanticSegmentationService();
    const entityService = new LotteryEntityExtractorService();

    graphs = [];

    for (const filename of pdfFiles) {
      const fullPath = join(LOTTERY_RESULTS_DIR, filename);
      if (!existsSync(fullPath)) continue;

      const buf = readFileSync(fullPath);
      const sha = computeSha256(new Uint8Array(buf));
      const extRes = await extractor.extractPages(new Uint8Array(buf), sha);
      const seg = segService.segmentDocument(extRes.pages);
      const entities = entityService.extract(seg, extRes.pages);
      const graph = buildLotteryKnowledgeGraph(entities, seg);
      validateLotteryKnowledgeGraph(graph);
      graphs.push(graph);
    }
  });

  // 1. Multi-draw population construction
  it("1. Invariant: Constructs validated multi-draw corpus across distinct official draws", () => {
    expect(graphs.length).toBeGreaterThanOrEqual(4);

    const corpus = buildMultiDrawCorpus(graphs);

    expect(corpus.draws.length).toBe(graphs.length);
    expect(corpus.documentSha256s.length).toBe(graphs.length);
    expect(corpus.validationReport.isValid).toBe(true);
    expect(corpus.validationReport.totalDraws).toBe(graphs.length);
    expect(corpus.validationReport.distinctLotteries.length).toBeGreaterThanOrEqual(3);
    expect(corpus.version).toBe(DEFAULT_CORPUS_VERSION);
  });

  // 2. Deterministic ordering
  it("2. Invariant: Produces deterministic corpus identity and ordering regardless of input array order", () => {
    const forwardGraphs = graphs.slice();
    const reversedGraphs = graphs.slice().reverse();

    const corpus1 = buildMultiDrawCorpus(forwardGraphs);
    const corpus2 = buildMultiDrawCorpus(reversedGraphs);

    expect(corpus1.id).toBe(corpus2.id);
    expect(corpus1.corpusHash).toBe(corpus2.corpusHash);
    expect(corpus1.documentSha256s).toEqual(corpus2.documentSha256s);
    expect(corpus1.draws.map((d) => d.drawId)).toEqual(corpus2.draws.map((d) => d.drawId));
  });

  // 3. Duplicate draw detection
  it("3. Invariant: Detects duplicate draw numbers across distinct documents", () => {
    if (graphs.length < 2) return;

    // Simulate duplicate draw publication by duplicating first graph with different document SHA
    const original = graphs[0]!;
    const duplicateGraph: LotteryKnowledgeGraph = {
      ...original,
      documentSha256: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
    };

    expect(() =>
      buildMultiDrawCorpus([...graphs, duplicateGraph], { allowEmpty: false })
    ).toThrow(StatisticalValidationError);
  });

  // 4. Conflicting duplicate detection
  it("4. Invariant: Detects conflicting winning results across different source documents", () => {
    if (graphs.length < 1) return;

    const baseGraph = graphs[0]!;
    // Clone nodes and mutate a winning result amount to create a conflict
    const mutatedNodes = baseGraph.nodes.map((n) => {
      if (n.type === "WinningResult" && n.properties.amount) {
        return {
          ...n,
          properties: {
            ...n.properties,
            amount: 999999999 // conflicting amount
          }
        };
      }
      return n;
    });

    const conflictingGraph: LotteryKnowledgeGraph = {
      ...baseGraph,
      documentSha256: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      nodes: mutatedNodes
    };

    expect(() =>
      buildMultiDrawCorpus([baseGraph, conflictingGraph], { allowEmpty: false })
    ).toThrow(StatisticalValidationError);
  });

  // 5. Cross-document provenance
  it("5. Invariant: Preserves complete provenance linking every result back to its source document and draw", () => {
    const corpus = buildMultiDrawCorpus(graphs);

    for (const draw of corpus.draws) {
      expect(draw.sourceDocumentSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(draw.drawId).toBeTruthy();
      expect(draw.drawNumber).toBeTruthy();
      expect(draw.lotteryCode).toBeTruthy();
      expect(draw.prizeTiersCount).toBeGreaterThan(0);
      expect(draw.totalResultsCount).toBeGreaterThan(0);
    }

    for (const r of corpus.combinedEntities.winningResults) {
      expect(corpus.documentSha256s).toContain(r.documentSha256);
      expect(r.drawId).toBeTruthy();
    }
  });

  // 6. Leading-zero preservation
  it("6. Invariant: Preserves string digits with leading zeros across all draws (e.g. '0259', '0081')", () => {
    const corpus = buildMultiDrawCorpus(graphs);

    let zeroFound = false;
    for (const draw of corpus.draws) {
      if (draw.leadingZeroNumbers.length > 0) {
        zeroFound = true;
        for (const num of draw.leadingZeroNumbers) {
          expect(num.startsWith("0")).toBe(true);
          expect(typeof num).toBe("string");
          expect(num.length).toBeGreaterThanOrEqual(4);
        }
      }
    }
    expect(zeroFound).toBe(true);
  });

  // 7. FULL_TICKET vs SUFFIX separation
  it("7. Invariant: Enforces strict separation between FULL_TICKET and SUFFIX results per draw", () => {
    const corpus = buildMultiDrawCorpus(graphs);

    for (const draw of corpus.draws) {
      expect(draw.fullTicketResultsCount).toBeGreaterThan(0);
      expect(draw.suffixResultsCount).toBeGreaterThan(0);
      expect(draw.totalResultsCount).toBe(
        draw.fullTicketResultsCount + draw.suffixResultsCount
      );

      // Verify that suffix results never contain series
      for (const s of Object.keys(draw.seriesOccurrences)) {
        expect(s.length).toBe(2); // Valid 2-letter series code
      }
    }
  });

  // 8. Multi-draw aggregation
  it("8. Invariant: Executes deterministic 5A statistical aggregation over multi-draw population", () => {
    const corpus = buildMultiDrawCorpus(graphs);
    const agg = calculateCorpusHistoricalStatistics(corpus);

    expect(agg.population.drawCount).toBe(graphs.length);
    expect(agg.population.isSingleDrawObservation).toBe(false);
    expect(agg.datasetSizeLimitationNotice).toContain("HISTORICAL_OBSERVATION");
    expect(agg.datasetSizeLimitationNotice).toContain(`${graphs.length} lottery draws`);
    expect(agg.drawSummary.drawCount).toBe(graphs.length);
    expect(agg.drawSummary.totalWinningResultsCount).toBe(
      corpus.validationReport.totalWinningResults
    );
    expect(agg.statisticalVersion).toBe(DEFAULT_STATISTICAL_VERSION);
  });

  // 9. Answers all 9 dataset contract questions via query API
  it("9. Query API: Answers all 9 dataset contract questions deterministically", () => {
    const corpus = buildMultiDrawCorpus(graphs);

    // Q1: How many draws are in the corpus?
    expect(getCorpusDrawCount(corpus)).toBe(graphs.length);

    // Q2: Which lottery does each draw belong to?
    const lotteries = getCorpusLotteries(corpus);
    expect(lotteries.length).toBeGreaterThanOrEqual(3);
    for (const lot of lotteries) {
      const drawsForLot = getDrawsByLottery(corpus, lot);
      expect(drawsForLot.length).toBeGreaterThanOrEqual(1);
    }

    // Q3: What date does each draw represent?
    for (const draw of corpus.draws) {
      const match = getDrawByDate(corpus, draw.drawDate);
      expect(match).toBeDefined();
      expect(match?.drawId).toBe(draw.drawId);
    }

    // Q4: Which source document produced each draw?
    for (const draw of corpus.draws) {
      const sha = getSourceDocumentForDraw(corpus, draw.drawId);
      expect(sha).toBe(draw.sourceDocumentSha256);
    }

    // Q5: How many prize results exist per draw?
    const resultsMap = getResultsPerDraw(corpus);
    for (const draw of corpus.draws) {
      expect(resultsMap[draw.drawNumber]).toBe(draw.totalResultsCount);
    }

    // Q6: Which results are FULL_TICKET vs SUFFIX?
    const typeBreakdown = getResultTypesPerDraw(corpus);
    for (const draw of corpus.draws) {
      const b = typeBreakdown[draw.drawNumber]!;
      expect(b.fullTicket).toBe(draw.fullTicketResultsCount);
      expect(b.suffix).toBe(draw.suffixResultsCount);
      expect(b.total).toBe(draw.totalResultsCount);
    }

    // Q7: Which series occur in each draw?
    const seriesPerDraw = getSeriesPerDraw(corpus);
    for (const draw of corpus.draws) {
      expect(seriesPerDraw[draw.drawNumber]).toEqual(draw.distinctSeries);
    }

    // Q8: Are any results duplicated or conflicting?
    const conflicts = getConflictingOrDuplicateResults(corpus);
    expect(conflicts).toHaveLength(0);

    // Q9: Are there missing or malformed records?
    const malformed = getMissingOrMalformedRecords(corpus);
    expect(malformed).toHaveLength(0);
  });

  // 10. Empty and malformed handling
  it("10. Invariant: Rejects empty graph list unless explicitly allowed", () => {
    expect(() => buildMultiDrawCorpus([])).toThrow(StatisticalValidationError);

    const emptyCorpus = buildMultiDrawCorpus([], { allowEmpty: true });
    expect(emptyCorpus.draws.length).toBe(0);
    expect(emptyCorpus.validationReport.totalDraws).toBe(0);

    expect(() => calculateCorpusHistoricalStatistics(emptyCorpus)).toThrow(
      StatisticalValidationError
    );
  });

  // 11. MultiDrawCorpusRepository persistence
  it("11. Invariant: Persists and retrieves MultiDrawLotteryCorpus via InMemory repository", async () => {
    const corpus = buildMultiDrawCorpus(graphs);
    const repo = new InMemoryMultiDrawCorpusRepository();

    await repo.saveCorpus(corpus);
    const retrieved = await repo.getCorpusById(corpus.id);

    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(corpus.id);
    expect(retrieved?.corpusHash).toBe(corpus.corpusHash);
    expect(retrieved?.draws.length).toBe(corpus.draws.length);

    const list = await repo.listCorpora();
    expect(list.length).toBe(1);
    expect(list[0]?.id).toBe(corpus.id);
  });
});
