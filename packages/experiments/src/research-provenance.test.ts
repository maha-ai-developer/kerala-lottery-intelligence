import { describe, it, expect, beforeEach } from "vitest";
import {
  generateResearchFinding,
  buildEvidenceBundle,
  buildResearchFindingLineage,
  verifyEvidenceBundleIntegrity,
  validateScientificClaimStatement,
  generatePublicationReport,
  ExperimentRepository,
  type ResearchFinding,
  type RegisteredExperimentDefinition,
  type ExperimentRun,
  type ResultArtifact,
  type StatisticalValidationArtifact
} from "./index";
import type { MultiDrawLotteryCorpus, ModelingDataset } from "@kerala-lottery/statistics";

describe("Milestone 9D: Research Provenance & Publication-Grade Evidence", () => {
  let mockCorpus: MultiDrawLotteryCorpus;
  let mockDataset: ModelingDataset;
  let mockDefinition: RegisteredExperimentDefinition;
  let mockRun: ExperimentRun;
  let mockArtifact: ResultArtifact;
  let mockValidation: StatisticalValidationArtifact;

  beforeEach(() => {
    mockCorpus = {
      id: "corpus_test_103_draws",
      corpusHash: "sha256_mock_corpus_hash",
      version: "1.0.0",
      computedAt: "2026-06-20T00:00:00.000Z",
      draws: [
        {
          drawId: "draw_001",
          drawNumber: "1",
          lotteryCode: "WIN-WIN",
          lotteryName: "WIN-WIN",
          drawDate: "2026-06-19",
          sourceDocumentSha256: "sha256_doc_001",
          totalResultsCount: 384,
          fullTicketResultsCount: 0,
          suffixResultsCount: 384,
          prizeTiersCount: 8,
          distinctSeries: [],
          seriesOccurrences: {},
          leadingZeroNumbers: [],
          graphNodeCount: 10,
          graphEdgeCount: 10,
          validationStatus: "VALID",
          validationErrors: []
        },
        {
          drawId: "draw_002",
          drawNumber: "2",
          lotteryCode: "STHREE-SAKTHI",
          lotteryName: "STHREE-SAKTHI",
          drawDate: "2026-06-20",
          sourceDocumentSha256: "sha256_doc_002",
          totalResultsCount: 384,
          fullTicketResultsCount: 0,
          suffixResultsCount: 384,
          prizeTiersCount: 8,
          distinctSeries: [],
          seriesOccurrences: {},
          leadingZeroNumbers: [],
          graphNodeCount: 10,
          graphEdgeCount: 10,
          validationStatus: "VALID",
          validationErrors: []
        }
      ],
      documentSha256s: ["sha256_doc_001", "sha256_doc_002"],
      validationReport: {
        totalDocuments: 2,
        totalDraws: 2,
        distinctLotteries: ["WIN-WIN", "STHREE-SAKTHI"],
        dateRange: { earliest: "2026-06-19", latest: "2026-06-20" },
        totalWinningResults: 768,
        totalFullTicketResults: 0,
        totalSuffixResults: 768,
        duplicateDrawsDetected: [],
        conflictingResultsDetected: [],
        malformedRecordsDetected: [],
        crossDocumentCollisions: [],
        isValid: true,
        validationErrors: []
      },
      knowledgeGraphs: [],
      combinedEntities: {} as any
    };

    mockDataset = {
      id: "mdset_test_001",
      sourceModelFeatureMatrixId: "mfm_test_001",
      sourceFeatureMatrixId: "fm_test_001",
      sourceFeatureEvaluationId: "feval_test_001",
      corpusId: "corpus_test_103_draws",
      modelingVersion: "1.0.0",
      populationScope: {
        corpusId: "corpus_test_103_draws",
        sourceFeatureMatrixId: "fm_test_001",
        sourceFeatureEvaluationId: "feval_test_001",
        sourceModelFeatureMatrixId: "mfm_test_001",
        totalRows: 768,
        fullTicketCount: 0,
        suffixCount: 768,
        drawIds: ["draw_001", "draw_002"],
        drawCount: 2,
        lotteryCodes: ["WIN-WIN", "STHREE-SAKTHI"],
        documentSha256s: ["sha256_doc_001", "sha256_doc_002"],
        dateRange: { earliest: "2026-06-19", latest: "2026-06-20" },
        populationScopeType: "ALL_POPULATION",
        populationScopeHash: "mock_scope_hash"
      },
      featureColumnNames: ["draw_day_of_week"],
      targetDefinition: {
        targetId: "tgt_observed_last_digit",
        targetName: "Observed Last Digit",
        targetVersion: "1.0.0",
        targetType: "CATEGORICAL",
        description: "Observed Last Digit",
        sourceFieldOrFeature: "last_digit",
        allowedValues: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
        derivationRule: "digit_0",
        descriptiveOnly: true,
        disclaimer: "descriptive only",
        deterministicHash: "tgt_hash_001"
      },
      totalRows: 768,
      fullTicketCount: 0,
      suffixCount: 768,
      rows: [],
      deterministicHash: "sha256_mock_dataset_hash",
      provenance: "test-provenance",
      limitations: ["descriptive only"],
      descriptiveOnly: true
    };

    mockDefinition = {
      experimentId: "EXP-001-UNIFORM-BASELINE",
      name: "Uniform Random Categorical Baseline",
      version: "1.0.0",
      description: "Baseline uniform discrete trial",
      methodology: "EXPANDING_WINDOW_HOLM_BONFERRONI_V1",
      targetId: "observed_last_digit",
      targetName: "Observed Last Digit",
      populationScope: "ALL_POPULATION",
      modelType: "UNIFORM",
      parameters: { seed: 42 },
      metrics: ["ACCURACY", "LOG_LOSS"],
      temporalPolicy: {
        strategy: "CHRONOLOGICAL_HOLDOUT",
        testRatio: 0.20
      },
      researchBoundary: "Descriptive retrospective baseline only",
      deterministicHash: "sha256_mock_definition_hash"
    };

    mockRun = {
      runId: "run_test_001",
      experimentId: "EXP-001-UNIFORM-BASELINE",
      experimentVersion: "1.0.0",
      corpusVersion: "corpus_test_103_draws",
      datasetVersion: "mdset_test_001",
      featureVersion: "fm_test_001",
      modelVersion: "1.0.0",
      status: "SUCCEEDED",
      startedAt: "2026-10-02T10:00:00.000Z",
      completedAt: "2026-10-02T10:00:05.000Z",
      metrics: {
        accuracy: 0.10127,
        balancedAccuracy: 0.10127,
        logLoss: 2.3026,
        sampleSize: 7850
      },
      evaluationWindow: {
        trainDrawCount: 83,
        testDrawCount: 20,
        trainRowCount: 31700,
        testRowCount: 7850,
        trainDateRange: { earliest: "2026-06-19", latest: "2026-09-17", earliestIso: "2026-06-19T00:00:00.000Z", latestIso: "2026-09-17T00:00:00.000Z" },
        testDateRange: { earliest: "2026-09-18", latest: "2026-10-01", earliestIso: "2026-09-18T00:00:00.000Z", latestIso: "2026-10-01T00:00:00.000Z" }
      },
      reproducibilityMetadata: {
        seed: 42,
        codeVersion: "9B.1.0-continuous-research",
        inputFingerprint: "fingerprint_test_001",
        parameters: { seed: 42 },
        evaluationFormulae: { accuracy: "correct / total" },
        runtimeEnvironment: { nodeVersion: "v22.0.0", platform: "linux" }
      },
      descriptiveOnly: true
    };

    mockArtifact = {
      artifactId: "art_test_001",
      runId: "run_test_001",
      experimentId: "EXP-001-UNIFORM-BASELINE",
      experimentVersion: "1.0.0",
      datasetVersion: "mdset_test_001",
      corpusVersion: "corpus_test_103_draws",
      metrics: {
        accuracy: 0.10127,
        balancedAccuracy: 0.10127,
        logLoss: 2.3026,
        sampleSize: 7850
      },
      predictionsSample: [],
      deterministicHash: "sha256_mock_artifact_hash",
      createdAt: "2026-10-02T10:00:05.000Z",
      disclaimer: "Descriptive only",
      descriptiveOnly: true as const
    };

    mockValidation = {
      validationId: "val_test_001",
      runId: "run_test_001",
      experimentId: "EXP-001-UNIFORM-BASELINE",
      experimentVersion: "1.0.0",
      corpusVersion: "corpus_test_103_draws",
      datasetVersion: "mdset_test_001",
      validationMethod: "EXPANDING_WINDOW_HOLM_BONFERRONI_V1",
      validationVersion: "1.0.0",
      confidenceIntervals: {
        accuracy: {
          wilsonScoreInterval: { lower: 0.0948, upper: 0.1081, confidenceLevel: 0.95, method: "WILSON_SCORE" as const },
          bootstrapInterval: { lower: 0.0945, upper: 0.1084, confidenceLevel: 0.95, method: "BOOTSTRAP_PERCENTILE" as const }
        },
        logLoss: {
          normalInterval: { lower: 2.3000, upper: 2.3052, confidenceLevel: 0.95, method: "NORMAL_APPROXIMATION" as const }
        }
      },
      uncertainty: {
        sampleSize: 7850,
        standardError: 0.003405,
        marginOfError: 0.006674,
        confidenceLevel: 0.95
      },
      nullModelComparison: {
        nullModelType: "DISCRETE_UNIFORM_NULL",
        iterations: 1000,
        observedValue: 0.10127,
        mean: 0.10005,
        stdDev: 0.00349,
        zScore: 0.349,
        empiricalPValue: 0.3696,
        seed: 42,
        min: 0.09,
        max: 0.11,
        quantiles: { p01: 0.09, p05: 0.095, p25: 0.098, p50: 0.10, p75: 0.102, p95: 0.105, p99: 0.11 }
      },
      multipleTestingCorrection: {
        familyId: "EXP_FAMILY_CANONICAL_BASELINES",
        designation: "CONFIRMATORY",
        totalHypothesesInFamily: 3,
        rankInFamily: 1,
        method: "HOLM_BONFERRONI",
        baseAlpha: 0.05,
        adjustedAlpha: 0.01667,
        rawPValue: 0.3696,
        adjustedPValue: 1.0000,
        isSignificant: false
      },
      effectSizes: {
        cohensH: 0.0042,
        relativeAccuracyRatio: 1.0127,
        absoluteAccuracyDifference: 0.00127
      },
      temporalRobustness: {
        strategy: "EXPANDING_WINDOW_WALK_FORWARD",
        windowsCount: 3,
        windowResults: [],
        stabilityScore: 0.975,
        zeroLeakageConfirmed: true,
        meanAccuracy: 0.101,
        stdDevAccuracy: 0.0025,
        minAccuracy: 0.098,
        maxAccuracy: 0.103
      },
      interpretationContract: {
        observation: "Observed test accuracy across N=7,850 holdout results is 10.13%.",
        statisticalEvidence: {
          pValue: 0.3696,
          adjustedPValue: 1.0,
          confidenceInterval: [0.0948, 0.1081],
          effectSize: 0.0042,
          effectSizeMetric: "COHENS_H",
          hypothesisTest: "Mulberry32 discrete uniform null simulation"
        },
        uncertainty: {
          standardError: 0.003405,
          sampleSize: 7850,
          confidenceLevel: 0.95,
          marginOfError: 0.006674
        },
        interpretation: "Deviations from uniform null are consistent with stochastic random chance.",
        limitation: "Physical lottery drawings are independent trials. Past frequencies possess zero predictive power."
      },
      createdAt: "2026-10-02T10:05:00.000Z",
      deterministicHash: "sha256_mock_validation_hash",
      nonPredictiveNotice: "Descriptive only",
      descriptiveOnly: true as const
    };
  });

  // ==========================================================================
  // 1. Deterministic Finding Generation
  // ==========================================================================

  describe("Deterministic Finding Generation (9D.5)", () => {
    it("generates identical finding IDs and deterministic hashes from identical inputs", () => {
      const finding1 = generateResearchFinding({
        run: mockRun,
        artifact: mockArtifact,
        validation: mockValidation,
        dataset: mockDataset,
        corpus: mockCorpus,
        definition: mockDefinition,
        claimType: "STATISTICAL_RESULT"
      });

      const finding2 = generateResearchFinding({
        run: mockRun,
        artifact: mockArtifact,
        validation: mockValidation,
        dataset: mockDataset,
        corpus: mockCorpus,
        definition: mockDefinition,
        claimType: "STATISTICAL_RESULT"
      });

      expect(finding1.findingId).toBe(finding2.findingId);
      expect(finding1.deterministicHash).toBe(finding2.deterministicHash);
      expect(finding1.statement).toBe(finding2.statement);
      expect(finding1.uncertainty.standardError).toBe(0.003405);
    });

    it("generates identical evidence bundle IDs and hashes from identical inputs", () => {
      const finding = generateResearchFinding({
        run: mockRun,
        artifact: mockArtifact,
        validation: mockValidation,
        dataset: mockDataset,
        corpus: mockCorpus,
        definition: mockDefinition,
        claimType: "STATISTICAL_RESULT"
      });

      const bundle1 = buildEvidenceBundle({
        finding,
        validation: mockValidation,
        run: mockRun,
        artifact: mockArtifact,
        dataset: mockDataset,
        corpus: mockCorpus,
        definition: mockDefinition
      });

      const bundle2 = buildEvidenceBundle({
        finding,
        validation: mockValidation,
        run: mockRun,
        artifact: mockArtifact,
        dataset: mockDataset,
        corpus: mockCorpus,
        definition: mockDefinition
      });

      expect(bundle1.evidenceBundleId).toBe(bundle2.evidenceBundleId);
      expect(bundle1.deterministicHash).toBe(bundle2.deterministicHash);
      expect(bundle1.isIntegrityVerified).toBe(true);
      expect(bundle1.integrityErrors).toHaveLength(0);
    });
  });

  // ==========================================================================
  // 2. Complete Lineage Verification (9D.3)
  // ==========================================================================

  describe("Complete Lineage DAG Verification (9D.3)", () => {
    it("constructs an unbroken 10-stage lineage chain connecting source documents to terminal finding", () => {
      const finding = generateResearchFinding({
        run: mockRun,
        artifact: mockArtifact,
        validation: mockValidation,
        dataset: mockDataset,
        corpus: mockCorpus,
        definition: mockDefinition,
        claimType: "STATISTICAL_RESULT"
      });

      const lineage = buildResearchFindingLineage({
        finding,
        validation: mockValidation,
        run: mockRun,
        artifact: mockArtifact,
        dataset: mockDataset,
        corpus: mockCorpus,
        definition: mockDefinition
      });

      expect(lineage.chain).toHaveLength(10);
      expect(lineage.isComplete).toBe(true);

      const expectedStages = [
        "SOURCE_DOCUMENTS",
        "DRAWS",
        "CORPUS",
        "FEATURE_MATRIX",
        "MODELING_DATASET",
        "EXPERIMENT_DEFINITION",
        "EXPERIMENT_RUN",
        "RESULT_ARTIFACT",
        "VALIDATION",
        "FINDING"
      ];

      lineage.chain.forEach((step, index) => {
        expect(step.stageNumber).toBe(index + 1);
        expect(step.step).toBe(expectedStages[index]);
        expect(step.identity).toBeDefined();
        expect(step.deterministicHash).toBeDefined();
      });
    });

    it("verifies source document count and draw IDs in lineage match the canonical corpus", () => {
      const finding = generateResearchFinding({
        run: mockRun,
        artifact: mockArtifact,
        validation: mockValidation,
        dataset: mockDataset,
        corpus: mockCorpus,
        definition: mockDefinition
      });

      const lineage = buildResearchFindingLineage({
        finding,
        validation: mockValidation,
        run: mockRun,
        artifact: mockArtifact,
        dataset: mockDataset,
        corpus: mockCorpus,
        definition: mockDefinition
      });

      expect(lineage.sourceDocumentCount).toBe(2);
      expect(lineage.sourceDocumentShas).toEqual(["sha256_doc_001", "sha256_doc_002"]);
      expect(lineage.drawCount).toBe(2);
      expect(lineage.drawIds).toEqual(["draw_001", "draw_002"]);
    });
  });

  // ==========================================================================
  // 3. Integrity Verification & No Silent Repair (9D.4)
  // ==========================================================================

  describe("Integrity Verification & 'No Silent Repair' (9D.4)", () => {
    it("passes integrity verification when all hashes match exactly", () => {
      const finding = generateResearchFinding({
        run: mockRun,
        artifact: mockArtifact,
        validation: mockValidation,
        dataset: mockDataset,
        corpus: mockCorpus,
        definition: mockDefinition
      });

      const bundle = buildEvidenceBundle({
        finding,
        validation: mockValidation,
        run: mockRun,
        artifact: mockArtifact,
        dataset: mockDataset,
        corpus: mockCorpus,
        definition: mockDefinition
      });

      const check = verifyEvidenceBundleIntegrity(bundle, {
        corpusHash: mockCorpus.corpusHash,
        datasetHash: mockDataset.deterministicHash,
        experimentHash: mockDefinition.deterministicHash,
        runHash: mockRun.reproducibilityMetadata.inputFingerprint,
        resultArtifactHash: mockArtifact.deterministicHash,
        validationHash: mockValidation.deterministicHash,
        findingHash: finding.deterministicHash
      });

      expect(check.valid).toBe(true);
      expect(check.errors).toHaveLength(0);
    });

    it("fails integrity check when any referenced artifact hash is modified (no silent repair)", () => {
      const finding = generateResearchFinding({
        run: mockRun,
        artifact: mockArtifact,
        validation: mockValidation,
        dataset: mockDataset,
        corpus: mockCorpus,
        definition: mockDefinition
      });

      const bundle = buildEvidenceBundle({
        finding,
        validation: mockValidation,
        run: mockRun,
        artifact: mockArtifact,
        dataset: mockDataset,
        corpus: mockCorpus,
        definition: mockDefinition
      });

      // Mutate corpus hash
      const check = verifyEvidenceBundleIntegrity(bundle, {
        corpusHash: "TAMPERED_CORPUS_HASH",
        datasetHash: mockDataset.deterministicHash,
        experimentHash: mockDefinition.deterministicHash,
        runHash: mockRun.reproducibilityMetadata.inputFingerprint,
        resultArtifactHash: mockArtifact.deterministicHash,
        validationHash: mockValidation.deterministicHash,
        findingHash: finding.deterministicHash
      });

      expect(check.valid).toBe(false);
      expect(check.errors.some((e) => e.includes("Hash mismatch for 'corpus'"))).toBe(true);
    });

    it("fails integrity check when a referenced artifact is completely missing", () => {
      const finding = generateResearchFinding({
        run: mockRun,
        artifact: mockArtifact,
        validation: mockValidation,
        dataset: mockDataset,
        corpus: mockCorpus,
        definition: mockDefinition
      });

      const bundle = buildEvidenceBundle({
        finding,
        validation: mockValidation,
        run: mockRun,
        artifact: mockArtifact,
        dataset: mockDataset,
        corpus: mockCorpus,
        definition: mockDefinition
      });

      const check = verifyEvidenceBundleIntegrity(bundle, {
        corpusHash: mockCorpus.corpusHash,
        // datasetHash omitted
        experimentHash: mockDefinition.deterministicHash,
        runHash: mockRun.reproducibilityMetadata.inputFingerprint,
        resultArtifactHash: mockArtifact.deterministicHash,
        validationHash: mockValidation.deterministicHash,
        findingHash: finding.deterministicHash
      });

      expect(check.valid).toBe(false);
      expect(check.errors.some((e) => e.includes("Missing artifact for 'dataset'"))).toBe(true);
    });
  });

  // ==========================================================================
  // 4. Provenance Invariants & Mismatch Rejection (9D.10)
  // ==========================================================================

  describe("Provenance Invariants & Rejection (9D.10)", () => {
    it("rejects non-succeeded runs", () => {
      const failedRun = { ...mockRun, status: "FAILED" as const };
      expect(() =>
        generateResearchFinding({
          run: failedRun,
          artifact: mockArtifact,
          validation: mockValidation,
          dataset: mockDataset,
          corpus: mockCorpus,
          definition: mockDefinition
        })
      ).toThrow("PROVENANCE_ERROR: Cannot generate finding for non-succeeded run");
    });

    it("rejects mismatched run vs validation IDs", () => {
      const mismatchedValidation = { ...mockValidation, runId: "other_run_id" };
      expect(() =>
        generateResearchFinding({
          run: mockRun,
          artifact: mockArtifact,
          validation: mismatchedValidation,
          dataset: mockDataset,
          corpus: mockCorpus,
          definition: mockDefinition
        })
      ).toThrow("PROVENANCE_MISMATCH: Validation runId 'other_run_id' does not match Run");
    });

    it("rejects mismatched dataset versions", () => {
      const mismatchedDataset = { ...mockDataset, id: "other_dataset_id" };
      expect(() =>
        generateResearchFinding({
          run: mockRun,
          artifact: mockArtifact,
          validation: mockValidation,
          dataset: mismatchedDataset,
          corpus: mockCorpus,
          definition: mockDefinition
        })
      ).toThrow("PROVENANCE_MISMATCH: Run datasetVersion");
    });

    it("rejects mismatched corpus versions", () => {
      const mismatchedCorpus = { ...mockCorpus, id: "other_corpus_id" };
      expect(() =>
        generateResearchFinding({
          run: mockRun,
          artifact: mockArtifact,
          validation: mockValidation,
          dataset: mockDataset,
          corpus: mismatchedCorpus,
          definition: mockDefinition
        })
      ).toThrow("PROVENANCE_MISMATCH: Run corpusVersion");
    });
  });

  // ==========================================================================
  // 5. Scientific Claim Taxonomy & Anti-Prediction Guardrails (9D.6)
  // ==========================================================================

  describe("Scientific Claim Taxonomy & Guardrails (9D.6)", () => {
    it("accepts valid scientific claim statements conforming to taxonomy", () => {
      expect(() =>
        validateScientificClaimStatement(
          "Observed holdout accuracy is 10.13% with log loss of 2.3026.",
          "OBSERVATION"
        )
      ).not.toThrow();

      expect(() =>
        validateScientificClaimStatement(
          "Holm-Bonferroni adjusted p = 1.0000 shows no statistically significant deviation from uniform null.",
          "STATISTICAL_RESULT"
        )
      ).not.toThrow();

      expect(() =>
        validateScientificClaimStatement(
          "Empirical deviations are consistent with uniform chance variation across independent draws.",
          "INTERPRETATION"
        )
      ).not.toThrow();

      expect(() =>
        validateScientificClaimStatement(
          "Physical lottery drawings operate as independent trials with zero predictive validity.",
          "LIMITATION"
        )
      ).not.toThrow();
    });

    it("rejects prohibited gambling, betting, and predictive claims", () => {
      const prohibitedClaims = [
        "This algorithm can predict future numbers for tomorrow.",
        "Guaranteed win strategy for next week draw.",
        "Hot numbers recommended for maximum profit.",
        "Betting recommendation based on historical frequency.",
        "Beat the lottery with our winning formula."
      ];

      for (const statement of prohibitedClaims) {
        expect(() =>
          validateScientificClaimStatement(statement, "STATISTICAL_RESULT")
        ).toThrow("prohibited predictive/gambling claim");
      }
    });

    it("rejects statements that violate semantic taxonomy constraints", () => {
      // OBSERVATION missing empirical observations
      expect(() =>
        validateScientificClaimStatement("This baseline performed reasonably well.", "OBSERVATION")
      ).toThrow("OBSERVATION statement must report empirical observation");

      // STATISTICAL_RESULT missing test statistics
      expect(() =>
        validateScientificClaimStatement("We ran the code and obtained output.", "STATISTICAL_RESULT")
      ).toThrow("STATISTICAL_RESULT statement must cite statistical tests");
    });
  });

  // ==========================================================================
  // 6. Publication Report Generator (9D.7)
  // ==========================================================================

  describe("Publication Report Generator (9D.7)", () => {
    it("generates deterministic academic markdown and structured JSON reports", () => {
      const finding = generateResearchFinding({
        run: mockRun,
        artifact: mockArtifact,
        validation: mockValidation,
        dataset: mockDataset,
        corpus: mockCorpus,
        definition: mockDefinition
      });

      const evidenceBundle = buildEvidenceBundle({
        finding,
        validation: mockValidation,
        run: mockRun,
        artifact: mockArtifact,
        dataset: mockDataset,
        corpus: mockCorpus,
        definition: mockDefinition
      });

      const lineage = buildResearchFindingLineage({
        finding,
        validation: mockValidation,
        run: mockRun,
        artifact: mockArtifact,
        dataset: mockDataset,
        corpus: mockCorpus,
        definition: mockDefinition
      });

      const report1 = generatePublicationReport({
        finding,
        evidenceBundle,
        lineage,
        validation: mockValidation
      });

      const report2 = generatePublicationReport({
        finding,
        evidenceBundle,
        lineage,
        validation: mockValidation
      });

      expect(report1.reportId).toBe(report2.reportId);
      expect(report1.deterministicHash).toBe(report2.deterministicHash);
      expect(report1.markdownContent).toContain("# Scientific Research Report");
      expect(report1.markdownContent).toContain("## 1. Scientific Claim & Taxonomy Classification");
      expect(report1.markdownContent).toContain("## 2. Evaluation Population & Canonical Corpus Grounding");
      expect(report1.markdownContent).toContain("## 3. Empirical Statistical Evidence & Uncertainty Quantification");
      expect(report1.markdownContent).toContain("## 4. Null-Hypothesis Significance Testing & Multiple-Comparison Control");
      expect(report1.markdownContent).toContain("## 5. Temporal Robustness & Expanding-Window Walk-Forward");
      expect(report1.markdownContent).toContain("## 6. Five-Part Research Interpretation Contract");
      expect(report1.markdownContent).toContain("Standard Error (SE)");
    });
  });

  // ==========================================================================
  // 7. Repository Immutability Invariants (9D.4)
  // ==========================================================================

  describe("Repository Immutability Invariants", () => {
    it("enforces immutability: rejects saving modified finding with differing hash", () => {
      const repo = new ExperimentRepository({ inMemoryOnly: true });

      const finding1 = generateResearchFinding({
        run: mockRun,
        artifact: mockArtifact,
        validation: mockValidation,
        dataset: mockDataset,
        corpus: mockCorpus,
        definition: mockDefinition
      });
      repo.saveFinding(finding1);

      // Attempt to save altered finding with same ID but different hash
      const mutatedFinding: ResearchFinding = {
        ...finding1,
        statement: "Observed test accuracy is 99.99% with altered loss.",
        deterministicHash: "tampered_finding_hash"
      };

      expect(() => repo.saveFinding(mutatedFinding)).toThrow("IMMUTABILITY_VIOLATION");
    });

    it("allows idempotent re-saving of identical finding", () => {
      const repo = new ExperimentRepository({ inMemoryOnly: true });

      const finding = generateResearchFinding({
        run: mockRun,
        artifact: mockArtifact,
        validation: mockValidation,
        dataset: mockDataset,
        corpus: mockCorpus,
        definition: mockDefinition
      });

      repo.saveFinding(finding);
      expect(() => repo.saveFinding(finding)).not.toThrow();
      expect(repo.getFinding(finding.findingId)).toBeDefined();
    });
  });
});
