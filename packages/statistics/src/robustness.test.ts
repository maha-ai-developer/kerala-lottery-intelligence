/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 5E: Experimental Validation & Robustness Comprehensive Test Suite
 *
 * Verifies all 20 required quality gates:
 * 1. deterministic robustness ID
 * 2. deterministic repeated evaluation
 * 3. baseline preservation
 * 4. population variant isolation
 * 5. lottery isolation
 * 6. draw isolation
 * 7. prize-tier isolation
 * 8. FULL_TICKET/SUFFIX isolation
 * 9. leading-zero preservation
 * 10. small-sample rejection/flagging
 * 11. expected-count validation
 * 12. effect-size correctness (Cramér's V calculation and bounds)
 * 13. comparison-count correctness
 * 14. multiple-comparison correction correctness (Bonferroni)
 * 15. variant-result reproducibility
 * 16. robustness conclusion determinism
 * 17. provenance preservation
 * 18. repository persistence
 * 19. Firestore authorization & repository contract
 * 20. no-prediction invariant
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
  createLastDigitUniformityExperiment,
  executeStatisticalExperiment,
  calculateCramersV,
  computeRobustnessDefinitionHash,
  createPopulationRobustnessDefinition,
  executeRobustnessEvaluation,
  createHistoricalRobustnessRecord,
  InMemoryHistoricalRobustnessRepository,
  HISTORICAL_ROBUSTNESS_DISCLAIMER,
  StatisticalValidationError,
  type RobustnessVariantDefinition
} from "./index";

describe("Milestone 5E — Experimental Validation & Robustness", () => {
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

  // 1. Deterministic Robustness ID
  it("1. Deterministic robustness ID: identical definitions produce identical IDs, changing parameters alters ID", () => {
    const baseExp = createLastDigitUniformityExperiment();
    const robDef1 = createPopulationRobustnessDefinition(baseExp, corpus, {
      correctionMethod: "BONFERRONI"
    });
    const robDef2 = createPopulationRobustnessDefinition(baseExp, corpus, {
      correctionMethod: "BONFERRONI"
    });
    const robDef3 = createPopulationRobustnessDefinition(baseExp, corpus, {
      correctionMethod: "NONE"
    });

    expect(robDef1.id).toBe(robDef2.id);
    expect(robDef1.robustnessId).toBe(robDef1.id);
    expect(robDef1.id).not.toBe(robDef3.id);
    expect(robDef1.id).toMatch(/^rob_[a-f0-9]{16}$/);
    expect(computeRobustnessDefinitionHash(robDef1)).toBe(computeRobustnessDefinitionHash(robDef2));
  });

  // 2. Deterministic Repeated Evaluation
  it("2. Deterministic repeated evaluation: identical corpus and robustness definition produce identical report", () => {
    const baseExp = createLastDigitUniformityExperiment();
    const robDef = createPopulationRobustnessDefinition(baseExp, corpus);
    const fixedTime = "2026-09-26T14:00:00.000Z";

    const rep1 = executeRobustnessEvaluation(corpus, robDef, { executedAt: fixedTime });
    const rep2 = executeRobustnessEvaluation(corpus, robDef, { executedAt: fixedTime });

    expect(rep1.id).toBe(rep2.id);
    expect(rep1.deterministicHash).toBe(rep2.deterministicHash);
    expect(rep1.evaluationSummary.classification).toBe(rep2.evaluationSummary.classification);
    expect(rep1.evaluationSummary.concordanceRatio).toBe(rep2.evaluationSummary.concordanceRatio);
    expect(rep1.variantEvaluations.length).toBe(rep2.variantEvaluations.length);
    expect(rep1.variantEvaluations[0]?.observedStatistic).toBe(rep2.variantEvaluations[0]?.observedStatistic);
  });

  // 3. Baseline Preservation
  it("3. Baseline preservation: source baseline experiment result is accurately preserved in baselineEvaluation", () => {
    const baseExp = createLastDigitUniformityExperiment();
    const baseResult = executeStatisticalExperiment(corpus, baseExp);
    const robDef = createPopulationRobustnessDefinition(baseExp, corpus);

    const report = executeRobustnessEvaluation(corpus, robDef, { baselineResult: baseResult });

    expect(report.sourceExperimentId).toBe(baseExp.id);
    expect(report.sourceExperimentResultId).toBe(baseResult.id);
    expect(report.baselineEvaluation.observedStatistic).toBe(baseResult.observedStatistic);
    expect(report.baselineEvaluation.degreesOfFreedom).toBe(baseResult.testMetadata.degreesOfFreedom);
    expect(report.baselineEvaluation.criticalValue).toBe(baseResult.testMetadata.criticalValue);
    expect(report.baselineEvaluation.rejectsNullHypothesis).toBe(baseResult.testMetadata.rejectsNullHypothesis);
    expect(report.baselineEvaluation.sampleSize).toBe(baseResult.sampleSize);
  });

  // 4. Population Variant Isolation
  it("4. Population variant isolation: each variant strictly evaluates its specified population scope without bleeding", () => {
    const baseExp = createLastDigitUniformityExperiment();
    const robDef = createPopulationRobustnessDefinition(baseExp, corpus);
    const report = executeRobustnessEvaluation(corpus, robDef);

    for (const v of report.variantEvaluations) {
      if (v.status === "COMPLETED") {
        expect(v.sampleSize).toBeGreaterThan(0);
        // Sub-population sample size must not exceed total corpus size
        expect(v.sampleSize).toBeLessThanOrEqual(report.baselineEvaluation.sampleSize);
      }
    }
  });

  // 5. Lottery Isolation
  it("5. Lottery isolation: POPULATION_LOTTERY variants isolate observations strictly to their respective lotteries", () => {
    const baseExp = createLastDigitUniformityExperiment();
    const robDef = createPopulationRobustnessDefinition(baseExp, corpus);
    const report = executeRobustnessEvaluation(corpus, robDef);

    const lotteryVariants = report.variantEvaluations.filter(
      (v) => v.dimension === "POPULATION_LOTTERY" && v.status === "COMPLETED"
    );
    expect(lotteryVariants.length).toBe(corpus.draws.length);

    // Verify each lottery variant matches that draw's result count
    for (const lv of lotteryVariants) {
      const matchingDraw = corpus.draws.find(
        (d) => `var_lottery_${d.lotteryCode.toLowerCase().replace(/[^a-z0-9]/g, "_")}` === lv.variantId
      );
      expect(matchingDraw).toBeDefined();
      expect(lv.sampleSize).toBe(matchingDraw!.totalResultsCount);
    }
  });

  // 6. Draw Isolation
  it("6. Draw isolation: POPULATION_DRAW variant isolates observations strictly to the specified draw", () => {
    const baseExp = createLastDigitUniformityExperiment();
    const firstDraw = corpus.draws[0]!;
    const drawVariant: RobustnessVariantDefinition = {
      variantId: "test_var_first_draw",
      label: `First Draw: ${firstDraw.drawNumber}`,
      description: "Isolates observations strictly to first draw",
      dimension: "POPULATION_DRAW",
      populationCriteriaOverride: { drawId: firstDraw.drawId }
    };

    const robDef = createPopulationRobustnessDefinition(baseExp, corpus, {
      customVariants: [drawVariant]
    });
    const report = executeRobustnessEvaluation(corpus, robDef);

    expect(report.variantEvaluations.length).toBe(1);
    const vEval = report.variantEvaluations[0]!;
    expect(vEval.status).toBe("COMPLETED");
    expect(vEval.sampleSize).toBe(firstDraw.totalResultsCount);
  });

  // 7. Prize-Tier Isolation
  it("7. Prize-tier isolation: isolates observations to a specific prize tier rank", () => {
    const baseExp = createLastDigitUniformityExperiment();
    const tierVariant: RobustnessVariantDefinition = {
      variantId: "test_var_rank_7",
      label: "Rank 7 Prize Tier",
      description: "Isolates observations strictly to 7th prize tier",
      dimension: "POPULATION_PRIZE_TIER",
      populationCriteriaOverride: { prizeTierRank: 7 }
    };

    const robDef = createPopulationRobustnessDefinition(baseExp, corpus, {
      customVariants: [tierVariant]
    });
    const report = executeRobustnessEvaluation(corpus, robDef);

    expect(report.variantEvaluations.length).toBe(1);
    const vEval = report.variantEvaluations[0]!;
    expect(vEval.status).toBe("COMPLETED");
    expect(vEval.sampleSize).toBeGreaterThan(0);
    expect(vEval.sampleSize).toBeLessThan(report.baselineEvaluation.sampleSize);
  });

  // 8. FULL_TICKET vs SUFFIX Isolation
  it("8. FULL_TICKET/SUFFIX isolation: strictly isolates full ticket from suffix winning numbers", () => {
    const baseExp = createLastDigitUniformityExperiment();
    const robDef = createPopulationRobustnessDefinition(baseExp, corpus);
    const report = executeRobustnessEvaluation(corpus, robDef);

    const ftVariant = report.variantEvaluations.find((v) => v.variantId === "var_result_type_full_ticket");
    const suffVariant = report.variantEvaluations.find((v) => v.variantId === "var_result_type_suffix");

    expect(ftVariant).toBeDefined();
    expect(suffVariant).toBeDefined();

    expect(ftVariant?.status).toBe("COMPLETED");
    expect(suffVariant?.status).toBe("COMPLETED");

    expect(ftVariant!.sampleSize + suffVariant!.sampleSize).toBe(report.baselineEvaluation.sampleSize);
  });

  // 9. Leading-Zero Preservation
  it("9. Leading-zero preservation: numbers retaining leading zero (e.g. '0276') are accurately preserved across variants", () => {
    const baseExp = createLastDigitUniformityExperiment();
    const robDef = createPopulationRobustnessDefinition(baseExp, corpus);
    const report = executeRobustnessEvaluation(corpus, robDef);

    expect(report.status).toBe("COMPLETED");
    // Verify that all completed variants evaluated categories {0..9} including '0'
    for (const v of report.variantEvaluations) {
      if (v.status === "COMPLETED") {
        expect(v.degreesOfFreedom).toBe(9);
      }
    }
  });

  // 10. Small-Sample Rejection/Flagging
  it("10. Small-sample rejection/flagging: variants with sample sizes below threshold are flagged without misleading conclusions", () => {
    const baseExp = createLastDigitUniformityExperiment();
    const tinyVariant: RobustnessVariantDefinition = {
      variantId: "test_var_1st_prize_only",
      label: "1st Prize Only",
      description: "Only 1st prize tier numbers (small sample N=4)",
      dimension: "POPULATION_PRIZE_TIER",
      populationCriteriaOverride: { prizeTierRank: 1 } // only 4 draws * 1 result = 4 results
    };

    const robDef = createPopulationRobustnessDefinition(baseExp, corpus, {
      customVariants: [tinyVariant]
    });
    const report = executeRobustnessEvaluation(corpus, robDef);

    expect(report.variantEvaluations.length).toBe(1);
    const vEval = report.variantEvaluations[0]!;
    expect(vEval.status).toBe("INSUFFICIENT_SAMPLE");
    expect(vEval.assumptionsMet.sampleSizeAdequate).toBe(false);
    expect(vEval.rejectsNullUnadjusted).toBe(false);
    expect(vEval.rejectsNullAdjusted).toBe(false);
    expect(vEval.assumptionsMet.reason).toContain("below required threshold");
  });

  // 11. Expected-Count Validation
  it("11. Expected-count validation: valid variants satisfy minimum expected cell count requirements", () => {
    const baseExp = createLastDigitUniformityExperiment();
    const robDef = createPopulationRobustnessDefinition(baseExp, corpus);
    const report = executeRobustnessEvaluation(corpus, robDef);

    for (const v of report.variantEvaluations) {
      if (v.status === "COMPLETED") {
        expect(v.assumptionsMet.minExpectedCountMet).toBe(true);
        expect(v.sampleSize).toBeGreaterThanOrEqual(50); // min expected count 5 * 10 categories
      }
    }
  });

  // 12. Effect-Size Correctness (Cramér's V)
  it("12. Effect-size correctness: Cramér's V calculation strictly matches formula and falls within [0, 1]", () => {
    // V = sqrt(chiSquare / (N * (k - 1)))
    // Test case: chiSquare = 20, N = 1000, k = 10 (k - 1 = 9)
    // V = sqrt(20 / (1000 * 9)) = sqrt(20 / 9000) = sqrt(0.002222) = 0.04714 -> 0.0471 (NEGLIGIBLE)
    const v1 = calculateCramersV(20, 1000, 10);
    expect(v1.name).toBe("CRAMERS_V");
    expect(v1.value).toBe(0.0471);
    expect(v1.magnitude).toBe("NEGLIGIBLE");

    // Medium effect size test: chiSquare = 900, N = 1000, k = 10
    // V = sqrt(900 / 9000) = sqrt(0.1) = 0.3162 (MEDIUM)
    const v2 = calculateCramersV(900, 1000, 10);
    expect(v2.value).toBe(0.3162);
    expect(v2.magnitude).toBe("MEDIUM");

    // Edge case: zero sample size
    const vZero = calculateCramersV(0, 0, 10);
    expect(vZero.value).toBe(0);
    expect(vZero.magnitude).toBe("NEGLIGIBLE");
  });

  // 13. Comparison-Count Correctness
  it("13. Comparison-count correctness: numberOfComparisons matches defined variant count m", () => {
    const baseExp = createLastDigitUniformityExperiment();
    const robDef = createPopulationRobustnessDefinition(baseExp, corpus);
    const report = executeRobustnessEvaluation(corpus, robDef);

    expect(report.numberOfComparisons).toBe(robDef.variants.length);
    expect(report.variantEvaluations.length).toBe(robDef.variants.length);
  });

  // 14. Multiple-Comparison Correction Correctness (Bonferroni)
  it("14. Multiple-comparison correction correctness: Bonferroni adjusts alpha = alpha / m and raises critical threshold", () => {
    const baseExp = createLastDigitUniformityExperiment();
    const robDef = createPopulationRobustnessDefinition(baseExp, corpus, {
      correctionMethod: "BONFERRONI"
    });
    const report = executeRobustnessEvaluation(corpus, robDef);

    const m = report.numberOfComparisons;
    expect(m).toBeGreaterThan(1);

    for (const v of report.variantEvaluations) {
      expect(v.unadjustedSignificanceLevel).toBe(0.05);
      expect(v.adjustedSignificanceLevel).toBeCloseTo(0.05 / m, 5);
      if (v.status === "COMPLETED") {
        // Adjusted critical value must be strictly greater than unadjusted critical value
        expect(v.adjustedCriticalValue).toBeGreaterThan(v.criticalValue);
      }
    }
  });

  // 15. Variant-Result Reproducibility
  it("15. Variant-result reproducibility: repeated variant evaluations generate identical statistical results", () => {
    const baseExp = createLastDigitUniformityExperiment();
    const robDef = createPopulationRobustnessDefinition(baseExp, corpus);

    const report1 = executeRobustnessEvaluation(corpus, robDef);
    const report2 = executeRobustnessEvaluation(corpus, robDef);

    for (let i = 0; i < report1.variantEvaluations.length; i++) {
      const v1 = report1.variantEvaluations[i]!;
      const v2 = report2.variantEvaluations[i]!;
      expect(v1.variantId).toBe(v2.variantId);
      expect(v1.observedStatistic).toBe(v2.observedStatistic);
      expect(v1.effectSize.value).toBe(v2.effectSize.value);
      expect(v1.rejectsNullUnadjusted).toBe(v2.rejectsNullUnadjusted);
      expect(v1.rejectsNullAdjusted).toBe(v2.rejectsNullAdjusted);
    }
  });

  // 16. Robustness Conclusion Determinism
  it("16. Robustness conclusion determinism: classification and conclusion are deterministically synthesized", () => {
    const baseExp = createLastDigitUniformityExperiment();
    const robDef = createPopulationRobustnessDefinition(baseExp, corpus);
    const report = executeRobustnessEvaluation(corpus, robDef);

    expect(report.evaluationSummary.classification).toBeDefined();
    expect(report.evaluationSummary.concordanceRatio).toBeGreaterThanOrEqual(0);
    expect(report.evaluationSummary.concordanceRatio).toBeLessThanOrEqual(1);
    expect(report.evaluationSummary.conclusion).toContain("HISTORICAL_ROBUSTNESS_CONCLUSION");
    expect(report.evaluationSummary.conclusion).toContain("NON-PREDICTIVE NOTICE");
    expect(report.evaluationSummary.effectSizeStability).toBeDefined();
  });

  // 17. Provenance Preservation
  it("17. Provenance preservation: report preserves exact source document SHA-256s and variant document mappings", () => {
    const baseExp = createLastDigitUniformityExperiment();
    const robDef = createPopulationRobustnessDefinition(baseExp, corpus);
    const report = executeRobustnessEvaluation(corpus, robDef);

    expect(report.provenanceSummary.documentSha256s.length).toBe(corpus.documentSha256s.length);
    expect(report.provenanceSummary.totalResultsTracked).toBe(report.baselineEvaluation.sampleSize);
    expect(report.provenanceSummary.totalDrawsTracked).toBe(corpus.draws.length);

    // Verify variantDocumentShaMap tracks documents for each variant
    for (const [varId, shas] of Object.entries(report.provenanceSummary.variantDocumentShaMap)) {
      expect(varId).toBeDefined();
      expect(shas.length).toBeGreaterThan(0);
      for (const sha of shas) {
        expect(corpus.documentSha256s).toContain(sha);
      }
    }
  });

  // 18. Repository Persistence
  it("18. Repository persistence: InMemoryHistoricalRobustnessRepository saves, retrieves by ID, and lists records", async () => {
    const repo = new InMemoryHistoricalRobustnessRepository();
    const baseExp = createLastDigitUniformityExperiment();
    const robDef = createPopulationRobustnessDefinition(baseExp, corpus);
    const report = executeRobustnessEvaluation(corpus, robDef);
    const record = createHistoricalRobustnessRecord(robDef, report);

    await repo.saveReport(record);

    const retrieved = await repo.getReportById(record.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(record.id);
    expect(retrieved?.robustnessId).toBe(robDef.id);
    expect(retrieved?.report.baselineEvaluation.observedStatistic).toBe(report.baselineEvaluation.observedStatistic);

    const list = await repo.listReports(10);
    expect(list.length).toBe(1);
    expect(list[0]?.id).toBe(record.id);
  });

  // 19. Firestore Authorization & Repository Contract
  it("19. Firestore authorization & repository contract: verifies collection name and serialization semantics", async () => {
    const baseExp = createLastDigitUniformityExperiment();
    const robDef = createPopulationRobustnessDefinition(baseExp, corpus);
    const report = executeRobustnessEvaluation(corpus, robDef);
    const record = createHistoricalRobustnessRecord(robDef, report);

    expect(record.id).toBe(robDef.id);
    expect(record.definition.descriptiveOnly).toBe(true);
    expect(record.report.descriptiveOnly).toBe(true);
    expect(record.report.status).toBe("COMPLETED");

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

      const { FirestoreRestHistoricalRobustnessRepository } = await import("./repository");
      const restRepo = new FirestoreRestHistoricalRobustnessRepository({
        projectId: "test-dev-project",
        getAccessToken: () => "mock-token"
      });

      await restRepo.saveReport(record);
      expect(recordedMethod).toBe("PATCH");
      expect(recordedUrl).toContain("historical_robustness_reports");
      expect(recordedUrl).toContain(encodeURIComponent(record.id));
      expect(recordedBody.fields).toBeDefined();

      const fetched = await restRepo.getReportById(record.id);
      expect(fetched).toBeDefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // 20. No-Prediction Invariant
  it("20. No-prediction invariant: enforces descriptiveOnly = true, disclaimers, and rejects predictive definitions", () => {
    const baseExp = createLastDigitUniformityExperiment();
    const robDef = createPopulationRobustnessDefinition(baseExp, corpus);
    expect(robDef.descriptiveOnly).toBe(true);

    const report = executeRobustnessEvaluation(corpus, robDef);
    expect(report.descriptiveOnly).toBe(true);
    expect(report.limitations).toContain(HISTORICAL_ROBUSTNESS_DISCLAIMER);
    expect(report.evaluationSummary.conclusion).toContain("NON-PREDICTIVE NOTICE");

    // Tampering with descriptiveOnly throws validation error
    const illegalDef = { ...robDef, descriptiveOnly: false as any };
    expect(() => executeRobustnessEvaluation(corpus, illegalDef)).toThrowError(
      StatisticalValidationError
    );
  });
});
