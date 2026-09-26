/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 5D: Statistical Experiment Framework Comprehensive Test Suite
 *
 * Verifies all 20 required quality gates:
 * 1. deterministic experiment ID
 * 2. deterministic repeated execution
 * 3. population isolation
 * 4. lottery isolation
 * 5. draw isolation
 * 6. prize-tier isolation
 * 7. FULL_TICKET vs SUFFIX isolation
 * 8. leading-zero preservation
 * 9. empty population rejection
 * 10. malformed population rejection
 * 11. heterogeneous population rejection
 * 12. baseline correctness
 * 13. statistic correctness
 * 14. expected-count correctness
 * 15. degrees-of-freedom correctness
 * 16. provenance preservation
 * 17. result reproducibility
 * 18. repository persistence
 * 19. Firestore authorization & repository contract
 * 20. descriptive-only invariant
 */

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
  computeExperimentDefinitionHash,
  computeExperimentResultHash,
  createLastDigitUniformityExperiment,
  createDigitPositionUniformityExperiment,
  resolveExperimentPopulation,
  resolveBaselineExpectedCounts,
  calculateChiSquareTest,
  executeStatisticalExperiment,
  createHistoricalExperimentRecord,
  InMemoryHistoricalExperimentRepository,
  HISTORICAL_EXPERIMENT_DISCLAIMER,
  StatisticalValidationError,
  type ExperimentDefinition
} from "./index";

describe("Milestone 5D — Statistical Experiment Framework", () => {
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

  // 1. Deterministic Experiment ID
  it("1. Deterministic experiment ID: identical definitions produce identical IDs, changing parameters alters ID", () => {
    const def1 = createLastDigitUniformityExperiment({ lotteryCode: "DHANALEKSHMI" });
    const def2 = createLastDigitUniformityExperiment({ lotteryCode: "DHANALEKSHMI" });
    const def3 = createLastDigitUniformityExperiment({ lotteryCode: "BHAGYATHARA" });

    expect(def1.id).toBe(def2.id);
    expect(def1.experimentId).toBe(def1.id);
    expect(def1.id).not.toBe(def3.id);
    expect(def1.id).toMatch(/^exp_[a-f0-9]{16}$/);
    expect(computeExperimentDefinitionHash(def1)).toBe(computeExperimentDefinitionHash(def2));
  });

  // 2. Deterministic Repeated Execution
  it("2. Deterministic repeated execution: identical corpus and experiment produce identical result", () => {
    const def = createLastDigitUniformityExperiment({ lotteryCode: "DHANALEKSHMI" });
    const fixedTime = "2026-09-26T12:00:00.000Z";

    const res1 = executeStatisticalExperiment(corpus, def, { executedAt: fixedTime });
    const res2 = executeStatisticalExperiment(corpus, def, { executedAt: fixedTime });

    expect(res1.id).toBe(res2.id);
    expect(res1.observedStatistic).toBe(res2.observedStatistic);
    expect(res1.sampleSize).toBe(res2.sampleSize);
    expect(res1.statisticalTest.degreesOfFreedom).toBe(res2.statisticalTest.degreesOfFreedom);
    expect(res1.populationScope.populationHash).toBe(res2.populationScope.populationHash);
    expect(res1.categoryDetails).toEqual(res2.categoryDetails);
  });

  // 3. Population Isolation
  it("3. Population isolation: PopulationResolver strictly adheres to explicit criteria and boundaries", () => {
    const dlPop = resolveExperimentPopulation(corpus, { lotteryCode: "DHANALEKSHMI" }, "LAST_DIGIT_DISTRIBUTION");
    expect(dlPop.lotteryCode).toBe("DHANALEKSHMI");
    expect(dlPop.drawCount).toBe(1);
    expect(dlPop.sampleSize).toBeGreaterThan(0);

    for (const item of dlPop.observedItems) {
      expect(item.canonicalNumber).toBeDefined();
      expect(item.extractedValue.length).toBe(1);
    }
  });

  // 4. Lottery Isolation
  it("4. Lottery isolation: lottery-scoped experiment contains only observations from that lottery", () => {
    const dlDef = createLastDigitUniformityExperiment({ lotteryCode: "DHANALEKSHMI" });
    const dlRes = executeStatisticalExperiment(corpus, dlDef);

    expect(dlRes.populationScope.lotteryCode).toBe("DHANALEKSHMI");
    expect(dlRes.populationScope.drawCount).toBe(1);

    // Cross-verify with total corpus size: total results in corpus is strictly greater than one draw
    const allDef = createLastDigitUniformityExperiment();
    const allRes = executeStatisticalExperiment(corpus, allDef);
    expect(allRes.sampleSize).toBeGreaterThan(dlRes.sampleSize);
  });

  // 5. Draw Isolation
  it("5. Draw isolation: draw-scoped experiment isolates observations strictly to the target drawId", () => {
    const firstDraw = corpus.draws[0]!;
    const drawDef = createLastDigitUniformityExperiment({ drawId: firstDraw.drawId });
    const drawRes = executeStatisticalExperiment(corpus, drawDef);

    expect(drawRes.populationScope.drawIds).toEqual([firstDraw.drawId]);
    expect(drawRes.populationScope.drawCount).toBe(1);
    expect(drawRes.sampleSize).toBe(firstDraw.totalResultsCount);
  });

  // 6. Prize-Tier Isolation
  it("6. Prize-tier isolation: isolates observations to a specific prize tier without bleed", () => {
    const tierDef = createLastDigitUniformityExperiment({ prizeTierRank: 7 }); // 7th prize tier
    const tierRes = executeStatisticalExperiment(corpus, tierDef);

    expect(tierRes.populationScope.prizeTierRank).toBe(7);
    expect(tierRes.sampleSize).toBeGreaterThan(0);
    // All observed items should have rank 7
    const pop = resolveExperimentPopulation(corpus, tierDef.populationCriteria, tierDef.targetMetric);
    for (const item of pop.observedItems) {
      expect(item.rank).toBe(7);
    }
  });

  // 7. FULL_TICKET vs SUFFIX Isolation
  it("7. FULL_TICKET vs SUFFIX isolation: strictly separates full tickets from suffix numbers", () => {
    const fullPop = resolveExperimentPopulation(corpus, { resultType: "FULL_TICKET" }, "LAST_DIGIT_DISTRIBUTION");
    const suffixPop = resolveExperimentPopulation(corpus, { resultType: "SUFFIX" }, "LAST_DIGIT_DISTRIBUTION");

    expect(fullPop.sampleSize).toBeGreaterThan(0);
    expect(suffixPop.sampleSize).toBeGreaterThan(0);
    expect(fullPop.sampleSize + suffixPop.sampleSize).toBe(corpus.combinedEntities.winningResults.length);

    for (const item of fullPop.observedItems) {
      expect(item.isSuffix).toBe(false);
    }
    for (const item of suffixPop.observedItems) {
      expect(item.isSuffix).toBe(true);
    }
  });

  // 8. Leading-Zero Preservation
  it("8. Leading-zero preservation: numbers like '0276' retain leading zero in population and digit testing", () => {
    // 4-digit numbers test at position 1 (first character from left)
    const pos1Def = createDigitPositionUniformityExperiment(1, 4);
    const pop = resolveExperimentPopulation(
      corpus,
      pos1Def.populationCriteria,
      pos1Def.targetMetric,
      pos1Def.configuration.positionIndex
    );

    // Verify there are numbers starting with '0'
    const numbersWithLeadingZero = pop.observedItems.filter((i) => i.canonicalNumber.startsWith("0"));
    expect(numbersWithLeadingZero.length).toBeGreaterThan(0);

    for (const item of numbersWithLeadingZero) {
      expect(item.canonicalNumber.length).toBe(4);
      expect(item.extractedValue).toBe("0"); // First digit is '0'
    }
  });

  // 9. Empty Population Rejection
  it("9. Empty population rejection: throws StatisticalValidationError when no results match criteria", () => {
    const nonexistentDef = createLastDigitUniformityExperiment({
      lotteryCode: "NON_EXISTENT_LOTTERY_NAME_12345"
    });

    expect(() => executeStatisticalExperiment(corpus, nonexistentDef)).toThrowError(
      StatisticalValidationError
    );
  });

  // 10. Malformed Population Rejection
  it("10. Malformed population rejection: throws StatisticalValidationError on invalid position or empty categories", () => {
    expect(() => createDigitPositionUniformityExperiment(5, 4)).toThrowError(
      StatisticalValidationError
    );

    const malformedDef = createLastDigitUniformityExperiment();
    (malformedDef.baseline as any).categories = [];

    expect(() => executeStatisticalExperiment(corpus, malformedDef)).toThrowError(
      StatisticalValidationError
    );
  });

  // 11. Heterogeneous Population Rejection
  it("11. Heterogeneous population rejection: throws StatisticalValidationError if digit position is run across mixed lengths", () => {
    // Specifying targetMetric = DIGIT_POSITION_DISTRIBUTION without numberLength
    const badDef: ExperimentDefinition = {
      ...createLastDigitUniformityExperiment(),
      targetMetric: "DIGIT_POSITION_DISTRIBUTION",
      configuration: {
        testType: "CHI_SQUARE_GOODNESS_OF_FIT",
        significanceLevel: 0.05,
        minExpectedCountPerCategory: 5,
        targetMetric: "DIGIT_POSITION_DISTRIBUTION",
        positionIndex: 2
      },
      statisticDefinition: {
        testType: "CHI_SQUARE_GOODNESS_OF_FIT",
        significanceLevel: 0.05,
        minExpectedCountPerCategory: 5,
        targetMetric: "DIGIT_POSITION_DISTRIBUTION",
        positionIndex: 2
      },
      populationCriteria: {
        resultType: "ALL" // Has mixed 4-digit and 6-digit results!
      }
    };

    expect(() => executeStatisticalExperiment(corpus, badDef)).toThrowError(
      StatisticalValidationError
    );
  });

  // 12. Baseline Correctness
  it("12. Baseline correctness: uniform baseline correctly calculates expected counts E_i = N * p_i", () => {
    const def = createLastDigitUniformityExperiment();
    const sampleSize = 100;
    const { expectedCounts } = resolveBaselineExpectedCounts(def.baseline, sampleSize);

    let sumExpected = 0;
    for (const cat of def.baseline.categories) {
      expect(expectedCounts[cat]).toBe(10); // 100 * 0.1
      sumExpected += expectedCounts[cat]!;
    }
    expect(sumExpected).toBe(sampleSize);
  });

  // 13. Statistic Correctness
  it("13. Statistic correctness: Chi-Square calculation strictly equals sum((O - E)^2 / E)", () => {
    const observed: Record<string, number> = {
      "0": 12, "1": 8, "2": 15, "3": 5, "4": 10,
      "5": 10, "6": 11, "7": 9, "8": 12, "9": 8
    };
    const expected: Record<string, number> = {
      "0": 10, "1": 10, "2": 10, "3": 10, "4": 10,
      "5": 10, "6": 10, "7": 10, "8": 10, "9": 10
    };
    const categories = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

    // Manual sum:
    // (12-10)^2/10 = 0.4
    // (8-10)^2/10  = 0.4
    // (15-10)^2/10 = 2.5
    // (5-10)^2/10  = 2.5
    // (10-10)^2/10 = 0.0
    // (10-10)^2/10 = 0.0
    // (11-10)^2/10 = 0.1
    // (9-10)^2/10  = 0.1
    // (12-10)^2/10 = 0.4
    // (8-10)^2/10  = 0.4
    // Total = 0.4 + 0.4 + 2.5 + 2.5 + 0 + 0 + 0.1 + 0.1 + 0.4 + 0.4 = 6.8
    const { testResult, categoryDetails } = calculateChiSquareTest(
      observed,
      expected,
      categories,
      0.05,
      5
    );

    expect(testResult.observedStatistic).toBe(6.8);
    expect(testResult.degreesOfFreedom).toBe(9);
    expect(testResult.criticalValue).toBe(16.919);
    expect(testResult.rejectsNullHypothesis).toBe(false); // 6.8 < 16.919
    expect(categoryDetails.length).toBe(10);
  });

  // 14. Expected-Count Correctness
  it("14. Expected-count correctness: category details contain non-negative expected counts summing to sample size", () => {
    const def = createLastDigitUniformityExperiment();
    const res = executeStatisticalExperiment(corpus, def);

    let sumExpected = 0;
    let sumObserved = 0;
    for (const d of res.categoryDetails) {
      expect(d.expectedCount).toBeGreaterThanOrEqual(5);
      expect(d.observedCount).toBeGreaterThanOrEqual(0);
      sumExpected += d.expectedCount;
      sumObserved += d.observedCount;
    }

    expect(Math.round(sumExpected)).toBe(res.sampleSize);
    expect(sumObserved).toBe(res.sampleSize);
  });

  // 15. Degrees-of-Freedom Correctness
  it("15. Degrees-of-freedom correctness: df = k - 1 where k is category count", () => {
    const def = createLastDigitUniformityExperiment();
    const res = executeStatisticalExperiment(corpus, def);

    expect(def.baseline.categories.length).toBe(10);
    expect(res.statisticalTest.degreesOfFreedom).toBe(9);
    expect(res.expectedStatistic).toBe(9);
  });

  // 16. Provenance Preservation
  it("16. Provenance preservation: full traceable chain from experiment result to source documents", () => {
    const def = createLastDigitUniformityExperiment();
    const res = executeStatisticalExperiment(corpus, def, { provenanceLimit: 5 });

    expect(res.provenanceSummary.documentSha256s.length).toBe(corpus.documentSha256s.length);
    expect(res.provenanceSummary.totalResultsTracked).toBe(res.sampleSize);
    expect(res.provenanceSummary.sampleProvenance.length).toBe(5);

    const firstProv = res.provenanceSummary.sampleProvenance[0]!;
    expect(firstProv.sourceDocumentSha256).toBeDefined();
    expect(firstProv.pageNumber).toBeGreaterThanOrEqual(1);
    expect(firstProv.sourceTextBlockOrders.length).toBeGreaterThan(0);
    expect(firstProv.canonicalNumber).toBeDefined();
  });

  // 17. Result Reproducibility
  it("17. Result reproducibility: two separate runs generate identical result IDs and hashes", () => {
    const def = createLastDigitUniformityExperiment({ lotteryCode: "BHAGYATHARA" });
    const fixedDate = "2026-09-26T10:00:00.000Z";

    const run1 = executeStatisticalExperiment(corpus, def, { executedAt: fixedDate });
    const run2 = executeStatisticalExperiment(corpus, def, { executedAt: fixedDate });

    expect(run1.id).toBe(run2.id);
    expect(run1.populationScope.populationHash).toBe(run2.populationScope.populationHash);
    expect(run1.observedStatistic).toBe(run2.observedStatistic);

    const hash1 = computeExperimentResultHash(run1.experimentId, run1.populationScope.populationHash, run1.observedStatistic, run1.testMetadata.degreesOfFreedom);
    const hash2 = computeExperimentResultHash(run2.experimentId, run2.populationScope.populationHash, run2.observedStatistic, run2.testMetadata.degreesOfFreedom);
    expect(hash1).toBe(hash2);
  });

  // 18. Repository Persistence
  it("18. Repository persistence: InMemoryHistoricalExperimentRepository saves, retrieves by ID, and lists records", async () => {
    const repo = new InMemoryHistoricalExperimentRepository();
    const def = createLastDigitUniformityExperiment({ lotteryCode: "STHREE-SAKTHI" });
    const res = executeStatisticalExperiment(corpus, def);
    const record = createHistoricalExperimentRecord(def, res);

    await repo.saveExperiment(record);

    const retrieved = await repo.getExperimentById(record.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(record.id);
    expect(retrieved?.experimentId).toBe(def.id);
    expect(retrieved?.result.observedStatistic).toBe(res.observedStatistic);

    const list = await repo.listExperiments(10);
    expect(list.length).toBe(1);
    expect(list[0]?.id).toBe(record.id);
  });

  // 19. Firestore Authorization & Repository Contract
  it("19. Firestore authorization & repository contract: verifies collection name and serialization semantics", async () => {
    // Verifies the contract expected by FirestoreRestHistoricalExperimentRepository
    const def = createLastDigitUniformityExperiment({ lotteryCode: "KARUNYA" });
    const res = executeStatisticalExperiment(corpus, def);
    const record = createHistoricalExperimentRecord(def, res);

    expect(record.id).toBe(def.id);
    expect(record.definition.descriptiveOnly).toBe(true);
    expect(record.result.descriptiveOnly).toBe(true);
    expect(record.result.status).toBe("COMPLETED");

    // Mock fetch to verify REST URL and payload structure
    let recordedUrl = "";
    let recordedMethod = "";
    let recordedBody: any = null;

    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = (async (url: string, init?: RequestInit) => {
        recordedUrl = url;
        recordedMethod = init?.method || "GET";
        if (init?.body) {
          recordedBody = JSON.parse(init.body as string);
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            fields: recordedBody?.fields || {}
          })
        } as any;
      }) as any;

      const { FirestoreRestHistoricalExperimentRepository } = await import("./repository");
      const restRepo = new FirestoreRestHistoricalExperimentRepository({
        projectId: "test-dev-project",
        getAccessToken: () => "mock-token"
      });

      await restRepo.saveExperiment(record);
      expect(recordedMethod).toBe("PATCH");
      expect(recordedUrl).toContain("historical_experiments");
      expect(recordedUrl).toContain(encodeURIComponent(record.id));
      expect(recordedBody.fields).toBeDefined();

      const fetched = await restRepo.getExperimentById(record.id);
      expect(fetched).toBeDefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // 20. Descriptive-Only Invariant
  it("20. Descriptive-only invariant: guarantees non-predictive notices, zero future claims, and rejection of non-descriptive defs", () => {
    const def = createLastDigitUniformityExperiment();
    expect(def.descriptiveOnly).toBe(true);

    const res = executeStatisticalExperiment(corpus, def);
    expect(res.descriptiveOnly).toBe(true);
    expect(res.limitations).toContain(HISTORICAL_EXPERIMENT_DISCLAIMER);
    expect(res.interpretation).toContain("HISTORICAL_FINDING");
    expect(res.interpretation).toContain("NON-PREDICTIVE NOTICE");

    // Tampering with descriptiveOnly throws validation error
    const illegalDef = { ...def, descriptiveOnly: false as any };
    expect(() => executeStatisticalExperiment(corpus, illegalDef)).toThrowError(
      StatisticalValidationError
    );
  });
});
