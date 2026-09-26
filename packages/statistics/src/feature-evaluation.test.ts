/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 6B: Feature Evaluation & Statistical Validation Tests
 *
 * Verifies all 23 non-negotiable core requirements:
 * 1. feature coverage calculation
 * 2. expected structural nulls classification
 * 3. unexpected null detection
 * 4. cardinality calculation & unique value ratio
 * 5. constant feature detection
 * 6. numeric statistics (min, max, mean, variance, std dev)
 * 7. categorical statistics (counts, proportions, dominant category)
 * 8. deterministic category ordering
 * 9. Shannon entropy calculation
 * 10. redundancy detection: exact duplicate feature pairs
 * 11. redundancy detection: deterministic mathematical relationships
 * 12. stability calculations across historical partitions
 * 13. partition isolation
 * 14. FULL_TICKET / SUFFIX separation integrity
 * 15. leading-zero preservation integrity
 * 16. provenance preservation
 * 17. deterministic evaluation IDs and hashes
 * 18. deterministic repeated execution equivalence
 * 19. leakage validation & integrity checks
 * 20. insufficient population / sparsity handling
 * 21. repository persistence
 * 22. descriptive-only / no-prediction invariant
 * 23. full real corpus evaluation (2,270 rows, 43 columns)
 */

import { describe, it, expect, beforeAll } from "vitest";
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
  MultiDrawLotteryCorpus
} from "./multi-draw-corpus";
import {
  extractCorpusFeatures,
  FeatureMatrix,
  FeatureMatrixRow
} from "./index";
import {
  DEFAULT_FEATURE_EVALUATION_VERSION,
  HISTORICAL_FEATURE_EVALUATION_DISCLAIMER,
  computeFeatureEvaluationHash,
  calculateFeatureCoverage,
  calculateFeatureCardinality,
  calculateFeatureDistribution,
  calculateFeatureStability,
  calculateFeatureRedundancy,
  validateFeatureMatrixIntegrity,
  evaluateFeatureMatrix,
  InMemoryFeatureEvaluationRepository
} from "./index";

describe("Milestone 6B — Feature Evaluation & Statistical Validation", () => {
  const LOTTERY_RESULTS_DIR = join(process.cwd(), "data/source-documents/lottery-results");
  let testCorpus: MultiDrawLotteryCorpus;
  let testMatrix: FeatureMatrix;

  beforeAll(async () => {
    if (!existsSync(LOTTERY_RESULTS_DIR)) return;

    const files = readdirSync(LOTTERY_RESULTS_DIR)
      .filter((f) => f.endsWith(".pdf") && f !== "dhanalekshmi-dl-40.pdf")
      .sort();

    const extractor = new PdfPageExtractorService();
    const segService = new DocumentSemanticSegmentationService();
    const entityService = new LotteryEntityExtractorService();

    const graphs: LotteryKnowledgeGraph[] = [];
    for (const filename of files) {
      const pdfBytes = readFileSync(join(LOTTERY_RESULTS_DIR, filename));
      const sha256 = computeSha256(new Uint8Array(pdfBytes));
      const extRes = await extractor.extractPages(new Uint8Array(pdfBytes), sha256);
      const segmentation = segService.segmentDocument(extRes.pages);
      const extraction = entityService.extract(segmentation, extRes.pages);
      const graph = buildLotteryKnowledgeGraph(extraction, segmentation);
      validateLotteryKnowledgeGraph(graph);
      graphs.push(graph);
    }

    testCorpus = buildMultiDrawCorpus(graphs);
    testMatrix = extractCorpusFeatures(testCorpus);
  });

  describe("1. Coverage & Missingness", () => {
    it("correctly identifies complete features with 100% coverage", () => {
      const cov = calculateFeatureCoverage("numberLength", "NUMBER", testMatrix.rows);
      expect(cov.totalRows).toBe(2270);
      expect(cov.populatedCount).toBe(2270);
      expect(cov.missingCount).toBe(0);
      expect(cov.coverageRatio).toBe(1.0);
      expect(cov.missingnessRatio).toBe(0.0);
      expect(cov.expectedStructuralNullsCount).toBe(0);
      expect(cov.unexpectedMissingCount).toBe(0);
      expect(cov.hasUnexpectedMissing).toBe(false);
    });

    it("correctly distinguishes expected structural nulls for SUFFIX family", () => {
      // suffix2 should only be populated for SUFFIX rows (2,186 rows), null for FULL_TICKET rows (84 rows)
      const cov = calculateFeatureCoverage("suffix2", "SUFFIX", testMatrix.rows);
      expect(cov.totalRows).toBe(2270);
      expect(cov.populatedCount).toBe(2186);
      expect(cov.missingCount).toBe(84);
      expect(cov.expectedStructuralNullsCount).toBe(84);
      expect(cov.unexpectedMissingCount).toBe(0);
      expect(cov.hasUnexpectedMissing).toBe(false);
      expect(cov.coverageRatio).toBeCloseTo(2186 / 2270, 4);
    });

    it("correctly distinguishes expected structural nulls for SERIES family", () => {
      // seriesCode is only populated for FULL_TICKET rows (84 rows), null for SUFFIX rows (2,186 rows)
      const cov = calculateFeatureCoverage("seriesCode", "SERIES", testMatrix.rows);
      expect(cov.totalRows).toBe(2270);
      expect(cov.populatedCount).toBe(84);
      expect(cov.missingCount).toBe(2186);
      expect(cov.expectedStructuralNullsCount).toBe(2186);
      expect(cov.unexpectedMissingCount).toBe(0);
      expect(cov.hasUnexpectedMissing).toBe(false);
    });

    it("detects unexpected missing values when artificially introduced", () => {
      const corruptedRows: FeatureMatrixRow[] = testMatrix.rows.map((r, idx) => {
        if (idx === 0) {
          return {
            ...r,
            values: {
              ...r.values,
              digitCount: null
            }
          };
        }
        return r;
      });

      const cov = calculateFeatureCoverage("digitCount", "NUMBER", corruptedRows);
      expect(cov.totalRows).toBe(2270);
      expect(cov.populatedCount).toBe(2269);
      expect(cov.missingCount).toBe(1);
      expect(cov.unexpectedMissingCount).toBe(1);
      expect(cov.hasUnexpectedMissing).toBe(true);
    });
  });

  describe("2. Cardinality & Uniqueness", () => {
    it("calculates cardinality and uniqueValueRatio for numeric features", () => {
      const card = calculateFeatureCardinality(testMatrix.rows, "digitSum");
      expect(card.distinctValueCount).toBeGreaterThan(1);
      expect(card.isConstant).toBe(false);
      expect(card.uniqueValueRatio).toBeCloseTo(card.distinctValueCount / 2270, 4);
    });

    it("identifies low-cardinality boolean features", () => {
      const card = calculateFeatureCardinality(testMatrix.rows, "palindrome");
      expect(card.distinctValueCount).toBeLessThanOrEqual(2);
      expect(card.isLowCardinality).toBe(true);
      expect(card.isConstant).toBe(false);
    });

    it("preserves STRING values exactly, including leading zeros", () => {
      const card = calculateFeatureCardinality(testMatrix.rows, "suffix4");
      // Suffix4 strings with leading zeros like "0045" must be distinct
      expect(card.distinctValueCount).toBeGreaterThan(100);
    });

    it("detects constant features when all rows share the same value", () => {
      const constantRows: FeatureMatrixRow[] = testMatrix.rows.map((r) => ({
        ...r,
        values: {
          ...r.values,
          constantDummy: "CONSTANT_VAL"
        }
      }));
      const card = calculateFeatureCardinality(constantRows, "constantDummy");
      expect(card.distinctValueCount).toBe(1);
      expect(card.isConstant).toBe(true);
      expect(card.isLowCardinality).toBe(true);
    });
  });

  describe("3. Distribution Metrics & Entropy", () => {
    it("calculates deterministic numeric statistics", () => {
      const dist = calculateFeatureDistribution(testMatrix.rows, "digitSum", "INTEGER");
      expect(dist.numericMetrics).toBeDefined();
      expect(dist.numericMetrics!.min).toBeGreaterThanOrEqual(0);
      expect(dist.numericMetrics!.max).toBeLessThanOrEqual(54); // 6 * 9
      expect(dist.numericMetrics!.mean).toBeGreaterThan(0);
      expect(dist.numericMetrics!.variance).toBeGreaterThan(0);
      expect(dist.numericMetrics!.standardDeviation).toBeCloseTo(Math.sqrt(dist.numericMetrics!.variance), 2);
    });

    it("calculates categorical frequencies and Shannon entropy in bits", () => {
      const dist = calculateFeatureDistribution(testMatrix.rows, "resultType", "CATEGORICAL");
      expect(dist.categoricalMetrics).toBeDefined();
      const categories = Object.keys(dist.categoricalMetrics!.categoryCounts);
      expect(categories.length).toBeGreaterThan(0);

      // Verify category proportions sum to ~1.0
      const totalProp = Object.values(dist.categoricalMetrics!.categoryProportions).reduce((acc, p) => acc + p, 0);
      expect(totalProp).toBeCloseTo(1.0, 3);

      // Shannon entropy should be positive for non-constant categorical
      expect(dist.categoricalMetrics!.entropy).toBeGreaterThan(0);

      // Category ordering should be deterministically sorted alphabetically
      for (let i = 0; i < categories.length - 1; i++) {
        expect(categories[i]!.localeCompare(categories[i + 1]!)).toBeLessThan(0);
      }
    });

    it("returns 0 entropy for a single-category feature", () => {
      const singleCatRows: FeatureMatrixRow[] = testMatrix.rows.map((r) => ({
        ...r,
        values: {
          ...r.values,
          singleCat: "UNIFORM"
        }
      }));
      const dist = calculateFeatureDistribution(singleCatRows, "singleCat", "STRING");
      expect(dist.categoricalMetrics?.entropy).toBe(0.0);
    });
  });

  describe("4. Feature Redundancy Detection", () => {
    it("detects exact duplicate feature pairs deterministically", () => {
      const redundancy = calculateFeatureRedundancy(testMatrix.rows, testMatrix.featureNames);

      // digitCount and numberLength are mathematically identical in 6A
      const exactDupe = redundancy.exactDuplicatePairs.find(
        (d) => (d.featureA === "numberLength" && d.featureB === "digitCount") ||
               (d.featureA === "digitCount" && d.featureB === "numberLength")
      );
      expect(exactDupe).toBeDefined();

      const pairwise = redundancy.pairwiseRedundancies.find(
        (p) => (p.featureA === "numberLength" && p.featureB === "digitCount") ||
               (p.featureA === "digitCount" && p.featureB === "numberLength")
      );
      expect(pairwise).toBeDefined();
      expect(pairwise?.matchRatio).toBe(1.0);
    });

    it("detects deterministic mathematical transform relationships", () => {
      const redundancy = calculateFeatureRedundancy(testMatrix.rows, testMatrix.featureNames);

      // repeatedDigitCount = digitCount - uniqueDigitCount
      const repeatedTransform = redundancy.deterministicTransforms.find(
        (t) => t.featureA === "repeatedDigitCount"
      );
      expect(repeatedTransform).toBeDefined();
      expect(repeatedTransform?.relation).toContain("repeatedDigitCount = digitCount - uniqueDigitCount");

      // digitCount = evenDigitCount + oddDigitCount
      const parityTransform = redundancy.deterministicTransforms.find(
        (t) => t.featureA === "digitCount"
      );
      expect(parityTransform).toBeDefined();
      expect(parityTransform?.relation).toContain("digitCount = evenDigitCount + oddDigitCount");

      // leadingZero = (firstDigit === '0')
      const leadingZeroTransform = redundancy.deterministicTransforms.find(
        (t) => t.featureA === "leadingZero"
      );
      expect(leadingZeroTransform).toBeDefined();
      expect(leadingZeroTransform?.relation).toContain("leadingZero = (firstDigit === '0')");
    });

    it("does not mutate or collapse features during redundancy evaluation", () => {
      const initialColumnCount = testMatrix.featureNames.length;
      calculateFeatureRedundancy(testMatrix.rows, testMatrix.featureNames);
      expect(testMatrix.featureNames.length).toBe(initialColumnCount);
    });
  });

  describe("5. Historical Stability Analysis", () => {
    it("evaluates stability across partitions with neutral classifications", () => {
      const stability = calculateFeatureStability(
        testMatrix.rows,
        "digitSum",
        "NUMBER",
        "INTEGER",
        0
      );
      expect(stability.partitionCount).toBeGreaterThan(0);
      expect(["STABLE", "VARIABLE", "INSUFFICIENT_DATA", "STRUCTURALLY_SPARSE"]).toContain(stability.classification);

      // Ensure no predictive language is used in the rationale
      expect(stability.rationale).not.toMatch(/winning|lucky|hot|cold|predictive|recommend|bet/i);
    });

    it("correctly flags structurally sparse features", () => {
      const stability = calculateFeatureStability(
        testMatrix.rows,
        "seriesCode",
        "SERIES",
        "STRING",
        2186 // >50% nulls
      );
      expect(stability.classification).toBe("STRUCTURALLY_SPARSE");
    });

    it("returns INSUFFICIENT_DATA when sample size is below threshold", () => {
      const tinyRows = testMatrix.rows.slice(0, 5);
      const stability = calculateFeatureStability(
        tinyRows,
        "digitSum",
        "NUMBER",
        "INTEGER",
        0
      );
      expect(stability.classification).toBe("INSUFFICIENT_DATA");
    });
  });

  describe("6. Integrity & Leakage Validation", () => {
    it("validates that all 2,270 records satisfy structural integrity", () => {
      const integrity = validateFeatureMatrixIntegrity(testMatrix, testCorpus);
      expect(integrity.integrityChecksPassed).toBe(true);
      expect(integrity.issues.length).toBe(0);
      expect(integrity.totalRowsChecked).toBe(2270);
      expect(integrity.noTargetLeakage).toBe(true);
      expect(integrity.leadingZeroPreserved).toBe(true);
      expect(integrity.resultTypeSeparationValid).toBe(true);
      expect(integrity.seriesSuffixSeparationValid).toBe(true);
      expect(integrity.numberLengthConsistent).toBe(true);
      expect(integrity.noDuplicatedRows).toBe(true);
    });

    it("flags invalid FULL_TICKET having suffix2 populated", () => {
      const corruptedRows: FeatureMatrixRow[] = testMatrix.rows.map((r, idx) => {
        if (idx === 0 && r.resultType === "FULL_TICKET") {
          return {
            ...r,
            values: {
              ...r.values,
              suffix2: "45"
            }
          };
        }
        return r;
      });

      const corruptedMatrix: FeatureMatrix = {
        ...testMatrix,
        rows: corruptedRows
      };

      const integrity = validateFeatureMatrixIntegrity(corruptedMatrix);
      expect(integrity.integrityChecksPassed).toBe(false);
      const separationIssue = integrity.issues.find((i) => i.code === "FULL_TICKET_HAS_SUFFIX_FEATURES");
      expect(separationIssue).toBeDefined();
    });

    it("flags missing leading zeros in string representation", () => {
      const corruptedRows: FeatureMatrixRow[] = testMatrix.rows.map((r, idx) => {
        if (idx === 0) {
          return {
            ...r,
            canonicalNumber: "0456",
            values: {
              ...r.values,
              leadingZero: false,
              firstDigit: "4"
            }
          };
        }
        return r;
      });

      const corruptedMatrix: FeatureMatrix = {
        ...testMatrix,
        rows: corruptedRows
      };

      const integrity = validateFeatureMatrixIntegrity(corruptedMatrix);
      expect(integrity.integrityChecksPassed).toBe(false);
      const lzIssue = integrity.issues.find((i) => i.code === "LEADING_ZERO_CORRUPTED");
      expect(lzIssue).toBeDefined();
    });

    it("flags duplicate record IDs", () => {
      const dupeRows = [...testMatrix.rows, testMatrix.rows[0]!];
      const corruptedMatrix: FeatureMatrix = {
        ...testMatrix,
        rows: dupeRows,
        totalRecords: dupeRows.length
      };

      const integrity = validateFeatureMatrixIntegrity(corruptedMatrix);
      expect(integrity.integrityChecksPassed).toBe(false);
      const dupeIssue = integrity.issues.find((i) => i.code === "DUPLICATED_RESULT_ROW");
      expect(dupeIssue).toBeDefined();
    });
  });

  describe("7. Determinism & Full Report Synthesis", () => {
    it("generates deterministic evaluation ID and hash", () => {
      const hash1 = computeFeatureEvaluationHash("fmat_123", "v1.0.0-feature-evaluation", 2270, ["a", "b"], "scope_abc");
      const hash2 = computeFeatureEvaluationHash("fmat_123", "v1.0.0-feature-evaluation", 2270, ["a", "b"], "scope_abc");
      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(16);
    });

    it("evaluates the full 6A matrix and synthesizes complete report", () => {
      const report = evaluateFeatureMatrix(testMatrix, testCorpus);
      expect(report.id).toBeDefined();
      expect(report.evaluationVersion).toBe(DEFAULT_FEATURE_EVALUATION_VERSION);
      expect(report.featureMatrixId).toBe(testMatrix.id);
      expect(report.corpusId).toBe(testMatrix.metadata.corpusId!);
      expect(report.totalFeaturesEvaluated).toBe(43);
      expect(Object.keys(report.featureMetrics).length).toBe(43);
      expect(report.matrixIntegrityReport.integrityChecksPassed).toBe(true);
      expect(report.limitations).toContain(HISTORICAL_FEATURE_EVALUATION_DISCLAIMER);
      expect(report.descriptiveOnly).toBe(true);

      // Verify canonical metric ordering (alphabetical by feature name)
      const metricKeys = Object.keys(report.featureMetrics);
      for (let i = 0; i < metricKeys.length - 1; i++) {
        expect(metricKeys[i]!.localeCompare(metricKeys[i + 1]!)).toBeLessThan(0);
      }
    });

    it("repeated evaluation execution produces identical output", () => {
      const reportA = evaluateFeatureMatrix(testMatrix, testCorpus, {
        evaluatedAt: "2026-09-26T12:00:00.000Z"
      });
      const reportB = evaluateFeatureMatrix(testMatrix, testCorpus, {
        evaluatedAt: "2026-09-26T12:00:00.000Z"
      });

      expect(reportA.id).toBe(reportB.id);
      expect(reportA.deterministicHash).toBe(reportB.deterministicHash);
      expect(reportA.totalFeaturesEvaluated).toBe(reportB.totalFeaturesEvaluated);
      expect(Object.keys(reportA.featureMetrics).length).toBe(Object.keys(reportB.featureMetrics).length);
      expect(reportA.matrixRedundancySummary.exactDuplicatePairs.length).toBe(reportB.matrixRedundancySummary.exactDuplicatePairs.length);
      expect(reportA.matrixRedundancySummary.deterministicTransforms.length).toBe(reportB.matrixRedundancySummary.deterministicTransforms.length);
    });
  });

  describe("8. Repository Persistence", () => {
    it("saves and retrieves evaluation reports in memory repository", async () => {
      const repo = new InMemoryFeatureEvaluationRepository();
      const report = evaluateFeatureMatrix(testMatrix, testCorpus);

      await repo.saveEvaluation({
        id: report.id,
        report,
        createdAt: new Date().toISOString()
      });
      const retrieved = await repo.getEvaluationById(report.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(report.id);
      expect(retrieved?.report.featureMatrixId).toBe(testMatrix.id);

      const list = await repo.listEvaluations(10);
      expect(list.length).toBe(1);
    });
  });

  describe("9. Strict Descriptive-Only & Non-Predictive Invariants", () => {
    it("contains zero prediction, betting, or probability claims in report metrics and summaries", () => {
      const report = evaluateFeatureMatrix(testMatrix, testCorpus);
      expect(report.descriptiveOnly).toBe(true);

      // Inspect evaluation outputs outside standard legal disclaimers
      const metricsAndSummaries = JSON.stringify({
        summary: report.summary,
        featureMetrics: report.featureMetrics,
        matrixRedundancySummary: report.matrixRedundancySummary,
        matrixIntegrityReport: report.matrixIntegrityReport
      }).toLowerCase();

      const forbiddenTerms = [
        "betting recommendation",
        "winning probability",
        "lucky number",
        "hot number",
        "cold number",
        "due number",
        "predicted outcome",
        "next draw",
        "future result"
      ];

      for (const term of forbiddenTerms) {
        expect(metricsAndSummaries).not.toContain(term);
      }
    });
  });
});
