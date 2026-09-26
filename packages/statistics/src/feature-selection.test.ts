/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 6C: Feature Selection & Modeling Representation Tests
 *
 * Verifies all 24 non-negotiable core requirements:
 * 1. deterministic selection
 * 2. deterministic IDs (mfmat_${hash})
 * 3. duplicate feature handling (digitCount excluded, numberLength retained)
 * 4. mathematical relationship handling (derived features retained with clear rationale)
 * 5. structural sparsity handling (distinguishing structural applicability from missing data)
 * 6. variable-feature handling (prizeTierRank retained with explanation)
 * 7. all 43 features accounted for
 * 8. no unexplained exclusions
 * 9. row preservation (2,270 rows)
 * 10. result ID preservation (all result IDs match)
 * 11. leading-zero preservation (leading zeros intact as strings)
 * 12. FULL_TICKET / SUFFIX separation
 * 13. series / suffix semantics
 * 14. number-length preservation
 * 15. provenance
 * 16. source document SHA preservation
 * 17. source draw preservation
 * 18. leakage validation (zero future leakage, zero predictive/betting semantics)
 * 19. repeated execution equivalence (identical ID, hash, and content)
 * 20. descriptive-only invariant (descriptiveOnly = true)
 * 21. canonical column ordering (alphabetical selected column names)
 * 22. matrix hash determinism
 * 23. empty/invalid input handling
 * 24. incompatible population handling
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
  FeatureMatrix
} from "./index";
import { FeatureValidationError } from "./feature-types";
import {
  evaluateFeatureMatrix,
  FeatureEvaluationReport
} from "./index";
import {
  DEFAULT_FEATURE_SELECTION_VERSION,
  DEFAULT_FEATURE_SELECTION_POLICY,
  HISTORICAL_FEATURE_SELECTION_DISCLAIMER,
  buildModelFeatureMatrix,
  InMemoryModelFeatureRepository,
  ModelFeatureMatrix,
  FeatureSelectionReport
} from "./index";

describe("Milestone 6C — Feature Selection & Modeling Representation", () => {
  const LOTTERY_RESULTS_DIR = join(process.cwd(), "data/source-documents/lottery-results");
  let testCorpus: MultiDrawLotteryCorpus;
  let sourceMatrix: FeatureMatrix;
  let evaluationReport: FeatureEvaluationReport;
  let modelMatrix: ModelFeatureMatrix;
  let selectionReport: FeatureSelectionReport;

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
    sourceMatrix = extractCorpusFeatures(testCorpus);
    evaluationReport = evaluateFeatureMatrix(sourceMatrix, testCorpus);

    const result = buildModelFeatureMatrix(sourceMatrix, evaluationReport, {
      selectionVersion: DEFAULT_FEATURE_SELECTION_VERSION,
      evaluatedAt: "2026-09-26T12:00:00.000Z"
    });
    modelMatrix = result.matrix;
    selectionReport = result.report;
  });

  describe("1. Deterministic Selection & IDs", () => {
    it("generates deterministic model matrix ID and hash with mfmat_ prefix", () => {
      expect(modelMatrix.id).toMatch(/^mfmat_[a-f0-9]{16}$/);
      expect(modelMatrix.deterministicHash).toMatch(/^[a-f0-9]{16}$/);
      expect(modelMatrix.id).toBe(`mfmat_${modelMatrix.deterministicHash}`);
    });

    it("generates deterministic report ID with fsel_ prefix", () => {
      expect(selectionReport.reportId).toMatch(/^fsel_[a-f0-9]{16}$/);
      expect(selectionReport.selectionVersion).toBe(DEFAULT_FEATURE_SELECTION_VERSION);
    });

    it("produces identical output upon repeated execution", () => {
      const repeat = buildModelFeatureMatrix(sourceMatrix, evaluationReport, {
        selectionVersion: DEFAULT_FEATURE_SELECTION_VERSION,
        evaluatedAt: "2026-09-26T12:00:00.000Z"
      });

      expect(repeat.matrix.id).toBe(modelMatrix.id);
      expect(repeat.matrix.deterministicHash).toBe(modelMatrix.deterministicHash);
      expect(repeat.report.reportId).toBe(selectionReport.reportId);
      expect(repeat.report.deterministicHash).toBe(selectionReport.deterministicHash);
    });
  });

  describe("2. Selection Policy & Decision Coverage", () => {
    it("evaluates explicit selection decisions for all 43 source features", () => {
      expect(sourceMatrix.featureNames.length).toBe(43);
      expect(selectionReport.totalFeaturesEvaluated).toBe(43);
      expect(Object.keys(selectionReport.decisions).length).toBe(43);

      for (const fn of sourceMatrix.featureNames) {
        const decision = selectionReport.decisions[fn]!;
        expect(decision).toBeDefined();
        expect(decision.featureName).toBe(fn);
        expect(decision.sourceFeatureMatrixId).toBe(sourceMatrix.id);
        expect(decision.sourceFeatureEvaluationId).toBe(evaluationReport.id);
        expect(["RETAINED", "EXCLUDED_REDUNDANT", "EXCLUDED_STRUCTURALLY_SPARSE", "RETAINED_WITH_TRANSFORMATION", "INSUFFICIENT_EVIDENCE"]).toContain(decision.selectionStatus);
        expect(decision.selectionReason.length).toBeGreaterThan(10);
      }
    });

    it("excludes no features without documented rationale", () => {
      expect(selectionReport.validation.noUnexplainedExclusions).toBe(true);
      for (const excluded of modelMatrix.excludedDecisions) {
        expect(excluded.selectionReason).toBeDefined();
        expect(excluded.selectionReason.trim().length).toBeGreaterThan(0);
      }
    });

    it("sorts selected columns in canonical alphabetical order", () => {
      const colNames = modelMatrix.selectedColumnNames;
      for (let i = 0; i < colNames.length - 1; i++) {
        expect(colNames[i]!.localeCompare(colNames[i + 1]!)).toBeLessThan(0);
      }
    });
  });

  describe("3. Duplicate Feature Resolution", () => {
    it("resolves exact duplicate digitCount ↔ numberLength deterministically", () => {
      const digitCountDecision = selectionReport.decisions["digitCount"]!;
      const numberLengthDecision = selectionReport.decisions["numberLength"]!;

      expect(digitCountDecision.selectionStatus).toBe("EXCLUDED_REDUNDANT");
      expect(digitCountDecision.selectionReason).toContain("numberLength");

      expect(numberLengthDecision.selectionStatus).toBe("RETAINED");
      expect(modelMatrix.selectedColumnNames).toContain("numberLength");
      expect(modelMatrix.selectedColumnNames).not.toContain("digitCount");
    });

    it("excludes trivial formatting derivative seriesCharacters", () => {
      const seriesCharsDecision = selectionReport.decisions["seriesCharacters"]!;
      expect(seriesCharsDecision.selectionStatus).toBe("EXCLUDED_REDUNDANT");
      expect(seriesCharsDecision.selectionReason).toContain("seriesCode");
      expect(modelMatrix.selectedColumnNames).not.toContain("seriesCharacters");

      // seriesCode remains retained
      const seriesCodeDecision = selectionReport.decisions["seriesCode"]!;
      expect(seriesCodeDecision.selectionStatus).toBe("RETAINED");
      expect(modelMatrix.selectedColumnNames).toContain("seriesCode");
    });
  });

  describe("4. Mathematical Transform Handling", () => {
    it("retains both primitive and derived features with explicit rationale", () => {
      const rep = selectionReport.decisions["repeatedDigitCount"]!;
      const unq = selectionReport.decisions["uniqueDigitCount"]!;
      expect(rep.selectionStatus).toBe("RETAINED");
      expect(unq.selectionStatus).toBe("RETAINED");
      expect(rep.transformation).toBe("repeatedDigitCount = digitCount - uniqueDigitCount");

      const even = selectionReport.decisions["evenDigitCount"]!;
      const odd = selectionReport.decisions["oddDigitCount"]!;
      expect(even.selectionStatus).toBe("RETAINED");
      expect(odd.selectionStatus).toBe("RETAINED");

      const lz = selectionReport.decisions["leadingZero"]!;
      const fd = selectionReport.decisions["firstDigit"]!;
      expect(lz.selectionStatus).toBe("RETAINED");
      expect(fd.selectionStatus).toBe("RETAINED");
      expect(lz.transformation).toBe("leadingZero = (firstDigit === '0')");
    });
  });

  describe("5. Structural Sparsity & Population Handling", () => {
    it("distinguishes structural inapplicability from poor-quality data", () => {
      const seriesCode = selectionReport.decisions["seriesCode"]!;
      expect(seriesCode.selectionStatus).toBe("RETAINED");
      expect(seriesCode.structuralApplicability).toBe("FULL_TICKET_ONLY");

      const pos5Left = selectionReport.decisions["digitPositionFromLeft_5"]!;
      expect(pos5Left.selectionStatus).toBe("RETAINED");
      expect(pos5Left.structuralApplicability).toBe("FULL_TICKET_ONLY");

      const pos6Left = selectionReport.decisions["digitPositionFromLeft_6"]!;
      expect(pos6Left.selectionStatus).toBe("RETAINED");
      expect(pos6Left.structuralApplicability).toBe("FULL_TICKET_ONLY");

      const suffix4 = selectionReport.decisions["suffix4"]!;
      expect(suffix4.selectionStatus).toBe("RETAINED");
      expect(suffix4.structuralApplicability).toBe("SUFFIX_ONLY");
    });

    it("supports EXCLUDE_STRUCTURALLY_SPARSE policy when requested", () => {
      const customPolicy = {
        ...DEFAULT_FEATURE_SELECTION_POLICY,
        structuralSparsityHandling: "EXCLUDE_STRUCTURALLY_SPARSE" as const
      };

      const custom = buildModelFeatureMatrix(sourceMatrix, evaluationReport, {
        policy: customPolicy
      });

      expect(custom.report.decisions["seriesCode"]?.selectionStatus).toBe("EXCLUDED_STRUCTURALLY_SPARSE");
      expect(custom.report.decisions["digitPositionFromLeft_5"]?.selectionStatus).toBe("EXCLUDED_STRUCTURALLY_SPARSE");
      expect(custom.matrix.selectedColumnNames).not.toContain("seriesCode");
    });
  });

  describe("6. Variable Feature Handling", () => {
    it("retains prizeTierRank with explicit historical structure justification", () => {
      const ptr = selectionReport.decisions["prizeTierRank"]!;
      expect(ptr.selectionStatus).toBe("RETAINED");
      expect(ptr.selectionReason).toContain("prize schedule hierarchy");
      expect(modelMatrix.selectedColumnNames).toContain("prizeTierRank");
    });
  });

  describe("7. Information & Provenance Preservation", () => {
    it("preserves exactly 2,270 rows with 1:1 aligned result IDs", () => {
      expect(modelMatrix.rows.length).toBe(2270);
      expect(modelMatrix.totalRecords).toBe(2270);
      expect(selectionReport.validation.rowCountPreserved).toBe(true);
      expect(selectionReport.validation.resultIdsAligned).toBe(true);

      for (let i = 0; i < 20; i++) {
        expect(modelMatrix.rows[i]!.resultId).toBe(sourceMatrix.rows[i]!.resultId);
      }
    });

    it("preserves leading zero strings intact", () => {
      expect(selectionReport.validation.leadingZerosPreserved).toBe(true);
      const lzRows = modelMatrix.rows.filter((r) => r.canonicalNumber.startsWith("0"));
      expect(lzRows.length).toBeGreaterThan(0);
      for (const r of lzRows) {
        expect(typeof r.canonicalNumber).toBe("string");
        expect(r.canonicalNumber.startsWith("0")).toBe(true);
      }
    });

    it("preserves FULL_TICKET / SUFFIX separation without zero-imputation", () => {
      expect(selectionReport.validation.fullTicketSuffixSeparationPreserved).toBe(true);

      const ftRow = modelMatrix.rows.find((r) => r.resultType === "FULL_TICKET")!;
      const sxRow = modelMatrix.rows.find((r) => r.resultType === "SUFFIX")!;

      // FULL_TICKET has seriesCode, null suffix features
      expect(ftRow.values["seriesCode"]).toBeDefined();
      expect(ftRow.values["seriesCode"]).not.toBeNull();
      expect(ftRow.values["suffix2"]).toBeNull();

      // SUFFIX has null seriesCode, populated suffix features
      expect(sxRow.values["seriesCode"]).toBeNull();
      expect(sxRow.values["suffix2"]).not.toBeNull();
    });

    it("preserves complete provenance chain to sourceDrawId and sourceDocumentSha256", () => {
      expect(selectionReport.validation.provenancePreserved).toBe(true);
      for (const r of modelMatrix.rows) {
        expect(r.sourceDrawId).toBeDefined();
        expect(r.sourceDocumentSha256.length).toBe(64);
      }
    });
  });

  describe("8. Target & Leakage Safety / Descriptive-Only Invariant", () => {
    it("ensures zero predictive or target leakage", () => {
      expect(selectionReport.validation.noTargetLeakage).toBe(true);
      expect(modelMatrix.descriptiveOnly).toBe(true);
      expect(selectionReport.descriptiveOnly).toBe(true);
      expect(modelMatrix.limitations).toContain(HISTORICAL_FEATURE_SELECTION_DISCLAIMER);

      const payload = JSON.stringify({
        selectedColumnNames: modelMatrix.selectedColumnNames,
        summary: selectionReport.summary
      }).toLowerCase();

      const forbidden = [
        "predict",
        "winner",
        "target",
        "label",
        "future",
        "hot",
        "cold",
        "due",
        "winning odds",
        "betting"
      ];

      for (const term of forbidden) {
        expect(payload).not.toContain(term);
      }
    });
  });

  describe("9. Repository Persistence", () => {
    it("persists and retrieves ModelFeatureMatrix in InMemoryModelFeatureRepository", async () => {
      const repo = new InMemoryModelFeatureRepository();

      await repo.saveModelMatrix({
        id: modelMatrix.id,
        matrix: modelMatrix,
        report: selectionReport,
        createdAt: "2026-09-26T12:00:00.000Z"
      });

      const retrieved = await repo.getModelMatrixById(modelMatrix.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(modelMatrix.id);
      expect(retrieved?.matrix.totalRecords).toBe(2270);
      expect(retrieved?.report.totalFeaturesEvaluated).toBe(43);

      const count = await repo.countModelMatrices();
      expect(count).toBe(1);

      const list = await repo.listModelMatrices(10);
      expect(list.length).toBe(1);
    });
  });

  describe("10. Edge Cases & Validation Failures", () => {
    it("throws FeatureValidationError when source matrix is empty", () => {
      const emptyMatrix = { ...sourceMatrix, rows: [], totalRecords: 0 };
      expect(() => buildModelFeatureMatrix(emptyMatrix, evaluationReport)).toThrow(FeatureValidationError);
    });

    it("throws FeatureValidationError when matrix ID and evaluation report do not match", () => {
      const mismatchedReport = { ...evaluationReport, featureMatrixId: "fmat_other_id" };
      expect(() => buildModelFeatureMatrix(sourceMatrix, mismatchedReport)).toThrow(FeatureValidationError);
    });
  });
});
