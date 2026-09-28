/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 7C: Canonical Historical Modeling Dataset & Backtest Refresh Unit Tests
 *
 * Verifies:
 * A. Complete corpus discovery (99 PDFs in data/source-documents/lottery-results)
 * B. SHA duplicate detection & idempotency (prevents double-counting)
 * C. Draw duplicate detection (catches duplicate draw keys)
 * D. New-draw incorporation (new PDF expands corpus cleanly)
 * E. Canonical dataset generation (end-to-end pipeline)
 * F. Deterministic feature matrix (fmat_ hash reproducibility)
 * G. Deterministic modeling dataset (mdset_ isolation of target)
 * H. Chronological splitting (draw-level temporal separation, max train <= min test)
 * I. Leakage exclusions (all 9 leakage checks pass, zero future contamination)
 * J. Baseline refresh (Uniform, Empirical, Majority on canonical dataset)
 * K. Walk-forward refresh (sequential expanding windows)
 * L. Idempotent rerun (bit-for-bit identical IDs across repeated runs)
 * M. Real-world input traceability (277-2342-27-09-2026.pdf lineage)
 *
 * Strict Invariants:
 * - Scientific benchmarking only (zero predictive or gambling claims).
 * - Full data pipeline: SOURCE -> DATA -> KNOWLEDGE -> FEATURES -> MODELING DATASET -> BACKTEST.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
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
  createAuthoritativePrizeSchemeRegistry,
  validateDrawAgainstPrizeScheme
} from "@kerala-lottery/domain";
import {
  buildMultiDrawCorpus,
  extractCorpusFeatures,
  evaluateFeatureMatrix,
  buildModelFeatureMatrix,
  buildModelingDataset,
  createObservedLastDigitTarget,
  createObservedFirstDigitTarget,
  createObservedParityTarget,
  createChronologicalSplit,
  createWalkForwardSplits,
  runChronologicalHoldoutBacktest,
  runWalkForwardBacktest,
  generateBaselineComparisonReport,
  auditBaselineLeakageResistance,
  DEFAULT_FEATURE_SELECTION_VERSION,
  CANONICAL_6_BASELINE_FILES,
  CANONICAL_7C_NEW_INPUT_PDF,
  CANONICAL_7C_NEW_INPUT_SHA,
  ModelingDataset,
  MultiDrawLotteryCorpus
} from "./index";

describe("Milestone 7C: Canonical Historical Modeling Dataset & Backtest Refresh", () => {
  const LOTTERY_RESULTS_DIR = join(process.cwd(), "data/source-documents/lottery-results");
  let baselineCorpus: MultiDrawLotteryCorpus;
  let expandedCorpus: MultiDrawLotteryCorpus;
  let canonicalDataset: ModelingDataset;
  let newPdfGraph: LotteryKnowledgeGraph;
  let newExtraction: any;

  beforeAll(async () => {
    if (!existsSync(LOTTERY_RESULTS_DIR)) return;

    const extractor = new PdfPageExtractorService();
    const segService = new DocumentSemanticSegmentationService();
    const entityService = new LotteryEntityExtractorService();

    // Ingest the 6 canonical baseline files
    const baselineGraphs: LotteryKnowledgeGraph[] = [];
    for (const filename of CANONICAL_6_BASELINE_FILES) {
      const pdfBytes = readFileSync(join(LOTTERY_RESULTS_DIR, filename));
      const sha256 = computeSha256(new Uint8Array(pdfBytes));
      const extRes = await extractor.extractPages(new Uint8Array(pdfBytes), sha256);
      const segmentation = segService.segmentDocument(extRes.pages);
      const extraction = entityService.extract(segmentation, extRes.pages);
      const graph = buildLotteryKnowledgeGraph(extraction, segmentation);
      validateLotteryKnowledgeGraph(graph);
      baselineGraphs.push(graph);
    }
    baselineCorpus = buildMultiDrawCorpus(baselineGraphs);

    // Ingest the new real-world input PDF: 277-2342-27-09-2026.pdf
    const newPdfPath = join(LOTTERY_RESULTS_DIR, CANONICAL_7C_NEW_INPUT_PDF);
    if (existsSync(newPdfPath)) {
      const newBytes = readFileSync(newPdfPath);
      const newSha = computeSha256(new Uint8Array(newBytes));
      const newExt = await extractor.extractPages(new Uint8Array(newBytes), newSha);
      const newSeg = segService.segmentDocument(newExt.pages);
      newExtraction = entityService.extract(newSeg, newExt.pages);
      newPdfGraph = buildLotteryKnowledgeGraph(newExtraction, newSeg);
      validateLotteryKnowledgeGraph(newPdfGraph);

      // Expanded corpus combining baseline + new real-world PDF
      expandedCorpus = buildMultiDrawCorpus([...baselineGraphs, newPdfGraph]);

      // Build model matrix and dataset on expanded corpus for test assertions
      const sourceMatrix = extractCorpusFeatures(expandedCorpus);
      const evaluationReport = evaluateFeatureMatrix(sourceMatrix, expandedCorpus, {
        evaluatedAt: "2026-09-28T00:00:00.000Z"
      });
      const { matrix: modelMatrix } = buildModelFeatureMatrix(sourceMatrix, evaluationReport, {
        selectionVersion: DEFAULT_FEATURE_SELECTION_VERSION,
        evaluatedAt: "2026-09-28T00:00:00.000Z"
      });
      canonicalDataset = buildModelingDataset(modelMatrix, createObservedLastDigitTarget());
    }
  });

  // --------------------------------------------------------------------------
  // A. Complete Corpus Discovery
  // --------------------------------------------------------------------------
  describe("7C.1 & 7C.9A: Complete Corpus Discovery", () => {
    it("discovers all 99 PDF files in data/source-documents/lottery-results", () => {
      const files = readdirSync(LOTTERY_RESULTS_DIR).filter((f) => f.endsWith(".pdf")).sort();
      expect(files.length).toBe(99);
      expect(files).toContain(CANONICAL_7C_NEW_INPUT_PDF);
      for (const bFile of CANONICAL_6_BASELINE_FILES) {
        expect(files).toContain(bFile);
      }
    });

    it("verifies all 99 files have valid non-empty byte sizes", () => {
      const files = readdirSync(LOTTERY_RESULTS_DIR).filter((f) => f.endsWith(".pdf"));
      for (const file of files) {
        const bytes = readFileSync(join(LOTTERY_RESULTS_DIR, file));
        expect(bytes.length).toBeGreaterThan(1000);
      }
    });
  });

  // --------------------------------------------------------------------------
  // B. SHA Duplicate Detection
  // --------------------------------------------------------------------------
  describe("7C.1 & 7C.9B: SHA Duplicate Detection", () => {
    it("detects exact duplicate SHA-256 and prevents double-counting", () => {
      // Re-adding the new PDF graph to an existing graph array should trigger error or deduplication
      expect(() => {
        buildMultiDrawCorpus([newPdfGraph, newPdfGraph], { allowEmpty: false });
      }).toThrow(/DUPLICATE_DOCUMENT|DUPLICATE_DRAW|conflicting/i);
    });

    it("verifies all 99 physical PDF files have 99 unique SHA-256 hashes", () => {
      const files = readdirSync(LOTTERY_RESULTS_DIR).filter((f) => f.endsWith(".pdf"));
      const shaSet = new Set<string>();
      for (const file of files) {
        const bytes = readFileSync(join(LOTTERY_RESULTS_DIR, file));
        const sha = computeSha256(new Uint8Array(bytes));
        expect(shaSet.has(sha)).toBe(false);
        shaSet.add(sha);
      }
      expect(shaSet.size).toBe(99);
    });
  });

  // --------------------------------------------------------------------------
  // C. Draw Duplicate Detection
  // --------------------------------------------------------------------------
  describe("7C.1 & 7C.9C: Draw Duplicate Detection", () => {
    it("rejects duplicate draw keys even with distinct dummy SHAs", () => {
      const modifiedGraph: LotteryKnowledgeGraph = {
        ...newPdfGraph,
        documentSha256: "0000000000000000000000000000000000000000000000000000000000000000"
      };
      expect(() => {
        buildMultiDrawCorpus([newPdfGraph, modifiedGraph], { allowEmpty: false });
      }).toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // D. New-Draw Incorporation
  // --------------------------------------------------------------------------
  describe("7C.1 & 7C.9D: New-Draw Incorporation", () => {
    it("incorporating the newly supplied PDF cleanly increases draw count by 1", () => {
      expect(expandedCorpus.draws.length).toBe(baselineCorpus.draws.length + 1);
      expect(expandedCorpus.draws.length).toBe(7);
    });

    it("incorporating the newly supplied PDF increases winning results by exactly 382", () => {
      const baselineResults = baselineCorpus.combinedEntities.winningResults.length;
      const expandedResults = expandedCorpus.combinedEntities.winningResults.length;
      expect(expandedResults - baselineResults).toBe(382);
    });

    it("incorporating the newly supplied PDF preserves full-ticket (14) and suffix (368) breakdown", () => {
      const baselineFull = baselineCorpus.validationReport.totalFullTicketResults;
      const expandedFull = expandedCorpus.validationReport.totalFullTicketResults;
      expect(expandedFull - baselineFull).toBe(14);

      const baselineSuffix = baselineCorpus.validationReport.totalSuffixResults;
      const expandedSuffix = expandedCorpus.validationReport.totalSuffixResults;
      expect(expandedSuffix - baselineSuffix).toBe(368);
    });
  });

  // --------------------------------------------------------------------------
  // E. Canonical Dataset Generation
  // --------------------------------------------------------------------------
  describe("7C.4 & 7C.9E: Canonical Dataset Generation", () => {
    it("generates a valid ModelingDataset with full provenance", () => {
      expect(canonicalDataset.id).toMatch(/^mdset_[a-f0-9]{16}$/);
      expect(canonicalDataset.deterministicHash).toMatch(/^[a-f0-9]{16}$/);
      expect(canonicalDataset.totalRows).toBe(2270 + 382);
      expect(canonicalDataset.fullTicketCount).toBe(84 + 14);
      expect(canonicalDataset.suffixCount).toBe(2186 + 368);
      expect(canonicalDataset.featureColumnNames.length).toBe(40);
      expect(canonicalDataset.targetDefinition.targetName).toBe("observed_last_digit");
      expect(canonicalDataset.descriptiveOnly).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // F. Deterministic Feature Matrix
  // --------------------------------------------------------------------------
  describe("7C.3 & 7C.9F: Deterministic Feature Matrix", () => {
    it("produces identical feature matrix hash across repeated feature extractions", () => {
      const matrix1 = extractCorpusFeatures(expandedCorpus);
      const matrix2 = extractCorpusFeatures(expandedCorpus);
      expect(matrix1.id).toBe(matrix2.id);
      expect(matrix1.deterministicHash).toBe(matrix2.deterministicHash);
      expect(matrix1.totalRecords).toBe(matrix2.totalRecords);
      expect(matrix1.featureNames).toEqual(matrix2.featureNames);
    });

    it("preserves exact 43 feature names in alphabetical order", () => {
      const matrix = extractCorpusFeatures(expandedCorpus);
      expect(matrix.featureNames.length).toBe(43);
      const sortedNames = [...matrix.featureNames].sort();
      expect(matrix.featureNames).toEqual(sortedNames);
    });
  });

  // --------------------------------------------------------------------------
  // G. Deterministic Modeling Dataset
  // --------------------------------------------------------------------------
  describe("7C.4 & 7C.9G: Deterministic Modeling Dataset", () => {
    it("produces identical dataset ID and hash across repeated constructions", () => {
      const matrix = extractCorpusFeatures(expandedCorpus);
      const report = evaluateFeatureMatrix(matrix, expandedCorpus, {
        evaluatedAt: "2026-09-28T00:00:00.000Z"
      });
      const { matrix: modelMatrix } = buildModelFeatureMatrix(matrix, report, {
        selectionVersion: DEFAULT_FEATURE_SELECTION_VERSION,
        evaluatedAt: "2026-09-28T00:00:00.000Z"
      });

      const ds1 = buildModelingDataset(modelMatrix, createObservedLastDigitTarget());
      const ds2 = buildModelingDataset(modelMatrix, createObservedLastDigitTarget());
      expect(ds1.id).toBe(ds2.id);
      expect(ds1.deterministicHash).toBe(ds2.deterministicHash);
      expect(ds1.rows.length).toBe(ds2.rows.length);
    });

    it("supports all 3 canonical target definitions", () => {
      const matrix = extractCorpusFeatures(expandedCorpus);
      const report = evaluateFeatureMatrix(matrix, expandedCorpus, {
        evaluatedAt: "2026-09-28T00:00:00.000Z"
      });
      const { matrix: modelMatrix } = buildModelFeatureMatrix(matrix, report, {
        selectionVersion: DEFAULT_FEATURE_SELECTION_VERSION,
        evaluatedAt: "2026-09-28T00:00:00.000Z"
      });

      const dsLast = buildModelingDataset(modelMatrix, createObservedLastDigitTarget());
      const dsFirst = buildModelingDataset(modelMatrix, createObservedFirstDigitTarget());
      const dsParity = buildModelingDataset(modelMatrix, createObservedParityTarget());

      expect(dsLast.targetDefinition.targetName).toBe("observed_last_digit");
      expect(dsFirst.targetDefinition.targetName).toBe("observed_first_digit");
      expect(dsParity.targetDefinition.targetName).toBe("observed_parity");
      expect(dsLast.totalRows).toBe(dsFirst.totalRows);
      expect(dsFirst.totalRows).toBe(dsParity.totalRows);
    });
  });

  // --------------------------------------------------------------------------
  // H. Chronological Splitting
  // --------------------------------------------------------------------------
  describe("7C.5 & 7C.9H: Chronological Splitting", () => {
    it("partitions draws strictly chronologically with no temporal inversion", () => {
      // 7 draws total: 5 train, 2 test
      const split = createChronologicalSplit(canonicalDataset, 5, 2);
      expect(split.trainDrawCount).toBe(5);
      expect(split.testDrawCount).toBe(2);

      const trainIso = split.trainPartition.dateRange.latestIso!;
      const testIso = split.testPartition.dateRange.earliestIso!;
      expect(trainIso <= testIso).toBe(true);
    });

    it("verifies zero draw ID and result ID overlap between train and test partitions", () => {
      const split = createChronologicalSplit(canonicalDataset, 5, 2);
      const trainDraws = new Set(split.trainPartition.drawIds);
      const testDraws = new Set(split.testPartition.drawIds);
      for (const d of testDraws) {
        expect(trainDraws.has(d)).toBe(false);
      }

      const trainResults = new Set(split.trainPartition.resultIds);
      const testResults = new Set(split.testPartition.resultIds);
      for (const r of testResults) {
        expect(trainResults.has(r)).toBe(false);
      }
    });
  });

  // --------------------------------------------------------------------------
  // I. Leakage Exclusions
  // --------------------------------------------------------------------------
  describe("7C.4 & 7C.9I: Leakage Exclusions", () => {
    it("passes all 9 leakage audit checks including adversarial perturbation", () => {
      const audit = auditBaselineLeakageResistance(canonicalDataset);
      expect(audit.passed).toBe(true);
      expect(audit.testLabelsNeverUsedInFitting).toBe(true);
      expect(audit.empiricalFrequenciesFromTrainOnly).toBe(true);
      expect(audit.majorityClassFromTrainOnly).toBe(true);
      expect(audit.chronologicalOrderingPreserved).toBe(true);
      expect(audit.futureRowCannotInfluenceEarlierWindow).toBe(true);
      expect(audit.targetColumnsNotInModelInputs).toBe(true);
      expect(audit.sourceIdentifiersNotPredictive).toBe(true);
      expect(audit.repeatedExecutionIdentical).toBe(true);
      expect(audit.issues).toEqual([]);
    });

    it("guarantees target columns and source IDs are never in model features", () => {
      const forbidden = [
        canonicalDataset.targetDefinition.sourceFieldOrFeature,
        "resultId",
        "sourceDrawId",
        "sourceDocumentSha256"
      ];
      for (const col of forbidden) {
        expect(canonicalDataset.featureColumnNames).not.toContain(col);
      }
    });
  });

  // --------------------------------------------------------------------------
  // J. Baseline Refresh
  // --------------------------------------------------------------------------
  describe("7C.6 & 7C.9J: Baseline Refresh", () => {
    it("evaluates Uniform, Empirical, and Majority baselines with valid metrics", () => {
      const split = createChronologicalSplit(canonicalDataset, 5, 2);
      const models = ["UNIFORM", "EMPIRICAL", "MAJORITY"] as const;

      for (const mType of models) {
        const res = runChronologicalHoldoutBacktest(
          canonicalDataset,
          mType,
          split
        );
        expect(res.accuracy).toBeGreaterThanOrEqual(0);
        expect(res.accuracy).toBeLessThanOrEqual(1);
        expect(res.balancedAccuracy).toBeGreaterThanOrEqual(0);
        expect(res.balancedAccuracy).toBeLessThanOrEqual(1);
        expect(res.logLoss).toBeGreaterThan(0);
        expect(res.testRowCount).toBe(split.testPartition.rowCount);
      }
    });
  });

  // --------------------------------------------------------------------------
  // K. Walk-Forward Refresh
  // --------------------------------------------------------------------------
  describe("7C.5 & 7C.9K: Walk-Forward Refresh", () => {
    it("generates sequential expanding windows with monotonically increasing train size", () => {
      const totalDraws = new Set(canonicalDataset.rows.map((r) => r.sourceDrawId)).size;
      const wfSplits = createWalkForwardSplits(canonicalDataset, 3);
      expect(wfSplits.length).toBe(totalDraws - 3);

      let prevTrainRows = 0;
      for (const win of wfSplits) {
        expect(win.trainPartition.rowCount).toBeGreaterThan(prevTrainRows);
        expect(win.testDrawCount).toBe(1);
        const trainLatest = win.trainPartition.dateRange.latestIso!;
        const testDate = win.testPartition.dateRange.earliestIso!;
        expect(trainLatest <= testDate).toBe(true);
        prevTrainRows = win.trainPartition.rowCount;
      }
    });

    it("executes walk-forward backtest aggregate with descriptive metrics", () => {
      const wfSplits = createWalkForwardSplits(canonicalDataset, 3);
      const wfAgg = runWalkForwardBacktest(
        canonicalDataset,
        "EMPIRICAL",
        wfSplits
      );
      expect(wfAgg.totalWindows).toBe(wfSplits.length);
      expect(wfAgg.meanAccuracy).toBeGreaterThan(0);
      expect(wfAgg.meanBalancedAccuracy).toBeGreaterThan(0);
      expect(wfAgg.descriptiveOnly).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // L. Idempotent Rerun
  // --------------------------------------------------------------------------
  describe("7C.8 & 7C.9L: Idempotent Rerun", () => {
    it("running the canonical comparison report twice produces bit-for-bit identical IDs and metrics", () => {
      const rep1 = generateBaselineComparisonReport(canonicalDataset, {
        trainDrawCount: 5,
        testDrawCount: 2,
        minTrainDraws: 3
      });
      const rep2 = generateBaselineComparisonReport(canonicalDataset, {
        trainDrawCount: 5,
        testDrawCount: 2,
        minTrainDraws: 3
      });

      expect(rep1.reportId).toBe(rep2.reportId);
      expect(rep1.deterministicHash).toBe(rep2.deterministicHash);
      expect(rep1.summaryTable.length).toBe(rep2.summaryTable.length);
      expect(rep1.summaryTable).toEqual(rep2.summaryTable);
      expect(rep1.walkForwardAggregates.map((w) => w.aggregateId))
        .toEqual(rep2.walkForwardAggregates.map((w) => w.aggregateId));
    });
  });

  // --------------------------------------------------------------------------
  // M. Real-World Input Traceability
  // --------------------------------------------------------------------------
  describe("7C.7 & 7C.9M: Real-World Input Traceability", () => {
    it("traces 277-2342-27-09-2026.pdf through the full canonical pipeline", () => {
      const pdfPath = join(LOTTERY_RESULTS_DIR, CANONICAL_7C_NEW_INPUT_PDF);
      expect(existsSync(pdfPath)).toBe(true);

      const bytes = readFileSync(pdfPath);
      const computedSha = computeSha256(new Uint8Array(bytes));
      expect(computedSha).toBe(CANONICAL_7C_NEW_INPUT_SHA);

      const registry = createAuthoritativePrizeSchemeRegistry();
      const resolution = registry.resolveSchemeForDraw({
        lotteryName: "SAMRUDHI",
        drawDate: "27/09/2026"
      });

      expect(resolution.status).toBe("SCHEME_RESOLVED");
      expect(resolution.authorityLevel).toBe("OFFICIAL_SCHEME");
      expect(resolution.schemeVersion?.id).toBe("scheme_ver_sm_v2025-11-sro1293");

      // Validate draw against resolved scheme
      const validation = validateDrawAgainstPrizeScheme(
        {
          id: "SM-74th",
          lotteryName: "SAMRUDHI",
          drawDate: "27/09/2026",
          prizeTiers: newExtraction.prizeTiers,
          winningResults: newExtraction.winningResults
        },
        resolution.schemeVersion!
      );

      expect(validation.isValid).toBe(true);
      expect(validation.discrepancies).toEqual([]);

      // Verify the new draw is present in the canonical dataset rows
      const rowsFromNewDraw = canonicalDataset.rows.filter(
        (r) => r.sourceDocumentSha256 === CANONICAL_7C_NEW_INPUT_SHA
      );
      expect(rowsFromNewDraw.length).toBe(382);
    });
  });
});
