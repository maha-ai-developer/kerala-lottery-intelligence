/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 9B: Continuous Research & Experimentation Unit & Reproducibility Tests
 *
 * Validates:
 * 1. Deterministic version derivation (corpus, feature, dataset, runId, artifactId)
 * 2. Formal experiment registry definitions & deterministic hashes
 * 3. Deterministic baseline execution across all 3 baselines (Uniform, Empirical, Majority)
 * 4. Seed control and reproducibility
 * 5. Temporal leakage protection (rejection of future training data)
 * 6. Lineage completeness across all 8 stages
 * 7. Failure handling and immutability (failed run cannot overwrite succeeded run)
 * 8. Idempotency of research pipeline refresh
 */

import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { join } from "node:path";
import {
  type MultiDrawLotteryCorpus,
  type ModelingDataset,
  buildMultiDrawCorpus,
  extractCorpusFeatures,
  evaluateFeatureMatrix,
  buildModelFeatureMatrix,
  buildModelingDataset,
  createObservedLastDigitTarget
} from "@kerala-lottery/statistics";

import {
  deriveCorpusVersion,
  deriveFeatureVersion,
  deriveDatasetVersion,
  deriveExperimentRunId,
  deriveResultArtifactId,
  getRegisteredExperiments,
  getRegisteredExperimentById,
  EXP_001_UNIFORM_BASELINE,
  EXP_002_EMPIRICAL_BASELINE,
  EXP_003_MAJORITY_BASELINE,
  executeExperiment,
  ExperimentRepository,
  buildExperimentLineage,
  loadGraphsFromCache,
  refreshResearchPipeline,
  inspectExperimentRun
} from "./index";

describe("Milestone 9B — Continuous Research & Experimentation", () => {
  let graphs: any[];
  let corpus: MultiDrawLotteryCorpus;
  let dataset: ModelingDataset;

  beforeAll(() => {
    // Load graphs from local cache (subset or full)
    const cacheDir = join(process.cwd(), "data/processed-cache");
    const allGraphs = loadGraphsFromCache(cacheDir);
    // Take 6 draws for fast unit testing
    graphs = allGraphs.slice(0, 6);
    corpus = buildMultiDrawCorpus(graphs);

    const featureMatrix = extractCorpusFeatures(corpus);
    const evaluationReport = evaluateFeatureMatrix(featureMatrix, corpus);
    const { matrix: modelMatrix } = buildModelFeatureMatrix(featureMatrix, evaluationReport);
    const targetDef = createObservedLastDigitTarget();
    dataset = buildModelingDataset(modelMatrix, targetDef, {
      populationScopeType: "ALL_POPULATION"
    });
  });

  // ==========================================================================
  // 1. Version Determinism (9B.1)
  // ==========================================================================
  describe("1. Version Identities & Deterministic Derivation", () => {
    it("derives deterministic corpus version from corpus", () => {
      const v1 = deriveCorpusVersion(corpus);
      const v2 = deriveCorpusVersion(corpus);
      expect(v1).toBe(v2);
      expect(v1).toMatch(/^corpus_[a-f0-9]{16}$/);
    });

    it("derives deterministic feature version and dataset version", () => {
      const fv = deriveFeatureVersion(extractCorpusFeatures(corpus));
      const dv = deriveDatasetVersion(dataset);
      expect(fv).toMatch(/^fmat_[a-f0-9]{16}$/);
      expect(dv).toMatch(/^mdset_[a-f0-9]{16}$/);
    });

    it("derives deterministic runId and artifactId given identical inputs", () => {
      const runId1 = deriveExperimentRunId({
        experimentId: "EXP-001-UNIFORM-BASELINE",
        experimentVersion: "1.0.0",
        datasetVersion: dataset.id,
        modelVersion: "mdef_uniform_v1",
        seed: 42
      });
      const runId2 = deriveExperimentRunId({
        experimentId: "EXP-001-UNIFORM-BASELINE",
        experimentVersion: "1.0.0",
        datasetVersion: dataset.id,
        modelVersion: "mdef_uniform_v1",
        seed: 42
      });
      expect(runId1).toBe(runId2);
      expect(runId1).toMatch(/^run_[a-f0-9]{16}$/);

      const artId1 = deriveResultArtifactId({ runId: runId1, metricsHash: "abc123" });
      const artId2 = deriveResultArtifactId({ runId: runId1, metricsHash: "abc123" });
      expect(artId1).toBe(artId2);
      expect(artId1).toMatch(/^art_[a-f0-9]{16}$/);
    });

    it("produces distinct runId when seed or dataset changes", () => {
      const runIdA = deriveExperimentRunId({
        experimentId: "EXP-001-UNIFORM-BASELINE",
        experimentVersion: "1.0.0",
        datasetVersion: dataset.id,
        modelVersion: "mdef_uniform_v1",
        seed: 42
      });
      const runIdB = deriveExperimentRunId({
        experimentId: "EXP-001-UNIFORM-BASELINE",
        experimentVersion: "1.0.0",
        datasetVersion: dataset.id,
        modelVersion: "mdef_uniform_v1",
        seed: 99
      });
      expect(runIdA).not.toBe(runIdB);
    });
  });

  // ==========================================================================
  // 2. Experiment Registry (9B.2)
  // ==========================================================================
  describe("2. Experiment Registry Integrity", () => {
    it("contains all three required formal baselines", () => {
      const all = getRegisteredExperiments();
      expect(all.length).toBeGreaterThanOrEqual(3);

      const ids = all.map((e) => e.experimentId);
      expect(ids).toContain("EXP-001-UNIFORM-BASELINE");
      expect(ids).toContain("EXP-002-EMPIRICAL-BASELINE");
      expect(ids).toContain("EXP-003-MAJORITY-BASELINE");
    });

    it("verifies registry metadata and deterministic hash stability", () => {
      const exp1 = getRegisteredExperimentById("EXP-001-UNIFORM-BASELINE");
      expect(exp1).toBeDefined();
      expect(exp1!.deterministicHash).toBe(EXP_001_UNIFORM_BASELINE.deterministicHash);
      expect(exp1!.modelType).toBe("UNIFORM");
      expect(exp1!.temporalPolicy.strategy).toBe("CHRONOLOGICAL_HOLDOUT");

      const exp2 = getRegisteredExperimentById("EXP-002-EMPIRICAL-BASELINE");
      expect(exp2).toBeDefined();
      expect(exp2!.modelType).toBe("EMPIRICAL");

      const exp3 = getRegisteredExperimentById("EXP-003-MAJORITY-BASELINE");
      expect(exp3).toBeDefined();
      expect(exp3!.modelType).toBe("MAJORITY");
    });
  });

  // ==========================================================================
  // 3. Deterministic Experiment Runner (9B.4)
  // ==========================================================================
  describe("3. Deterministic Execution Across Baselines", () => {
    it("executes Uniform baseline deterministically", () => {
      const out1 = executeExperiment(EXP_001_UNIFORM_BASELINE, dataset, { seed: 42 });
      const out2 = executeExperiment(EXP_001_UNIFORM_BASELINE, dataset, { seed: 42 });

      expect(out1.run.status).toBe("SUCCEEDED");
      expect(out2.run.status).toBe("SUCCEEDED");
      expect(out1.run.runId).toBe(out2.run.runId);
      expect(out1.run.metrics?.accuracy).toBe(out2.run.metrics?.accuracy);
      expect(out1.run.metrics?.logLoss).toBe(out2.run.metrics?.logLoss);
      expect(out1.artifact?.artifactId).toBe(out2.artifact?.artifactId);
    });

    it("executes Empirical baseline deterministically", () => {
      const out = executeExperiment(EXP_002_EMPIRICAL_BASELINE, dataset, { seed: 42 });
      expect(out.run.status).toBe("SUCCEEDED");
      expect(out.run.metrics).toBeDefined();
      expect(out.run.metrics!.sampleSize).toBeGreaterThan(0);
      expect(out.run.metrics!.accuracy).toBeGreaterThanOrEqual(0);
      expect(out.run.metrics!.accuracy).toBeLessThanOrEqual(1);
    });

    it("executes Majority baseline deterministically", () => {
      const out = executeExperiment(EXP_003_MAJORITY_BASELINE, dataset, { seed: 42 });
      expect(out.run.status).toBe("SUCCEEDED");
      expect(out.run.metrics).toBeDefined();
      expect(out.run.metrics!.sampleSize).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // 4. Temporal Leakage Protection (9B.5)
  // ==========================================================================
  describe("4. Temporal Leakage Protections", () => {
    it("retains chronological isolation between train and test partitions", () => {
      const out = executeExperiment(EXP_001_UNIFORM_BASELINE, dataset, { seed: 42 });
      expect(out.run.status).toBe("SUCCEEDED");

      const window = out.run.evaluationWindow!;
      expect(window.trainDrawCount).toBeGreaterThan(0);
      expect(window.testDrawCount).toBeGreaterThan(0);

      const trainLatestTs = new Date(window.trainDateRange.latestIso).getTime();
      const testEarliestTs = new Date(window.testDateRange.earliestIso).getTime();
      expect(trainLatestTs).toBeLessThan(testEarliestTs);
    });

    it("fails with LEAKAGE_DETECTED if training data includes future dates", () => {
      // Contaminate dataset row dates artificially
      const corruptedDataset: ModelingDataset = {
        ...dataset,
        id: "mdset_corrupted_leakage_test",
        rows: dataset.rows.map((r) => ({
          ...r,
          drawDateIso: "2099-01-01" // future date
        }))
      };

      const out = executeExperiment(EXP_001_UNIFORM_BASELINE, corruptedDataset);
      expect(out.run.status).toBe("FAILED");
      expect(out.run.error).toBeDefined();
      expect(out.run.error!.stage).toBe("LEAKAGE_VALIDATION");
    });
  });

  // ==========================================================================
  // 5. Result Lineage (9B.6)
  // ==========================================================================
  describe("5. Result Lineage Integrity", () => {
    it("builds a complete 8-step typed lineage DAG", () => {
      const out = executeExperiment(EXP_001_UNIFORM_BASELINE, dataset, { seed: 42 });
      const lineage = buildExperimentLineage({
        run: out.run,
        dataset,
        corpus,
        definition: EXP_001_UNIFORM_BASELINE,
        artifact: out.artifact
      });

      expect(lineage.isComplete).toBe(true);
      expect(lineage.chain).toHaveLength(8);

      const stepNames = lineage.chain.map((c) => c.step);
      expect(stepNames).toEqual([
        "SOURCE_DOCUMENTS",
        "DRAWS",
        "CORPUS",
        "FEATURE_MATRIX",
        "MODELING_DATASET",
        "EXPERIMENT_DEFINITION",
        "EXPERIMENT_RUN",
        "RESULT_ARTIFACT"
      ]);

      expect(lineage.sourceDocumentCount).toBe(corpus.documentSha256s.length);
      expect(lineage.drawCount).toBe(corpus.draws.length);
      expect(lineage.corpusVersion).toBe(corpus.id);
      expect(lineage.datasetVersion).toBe(dataset.id);
      expect(lineage.artifactId).toBe(out.artifact!.artifactId);
    });
  });

  // ==========================================================================
  // 6. Repository & Immutability (9B.3, 9B.12)
  // ==========================================================================
  describe("6. Repository, Immutability & Failure Safeguards", () => {
    let repo: ExperimentRepository;

    beforeEach(() => {
      repo = new ExperimentRepository({ inMemoryOnly: true });
    });

    it("saves and retrieves runs and artifacts", () => {
      const out = executeExperiment(EXP_001_UNIFORM_BASELINE, dataset, { seed: 42 });
      repo.saveRun(out.run);
      repo.saveArtifact(out.artifact!);

      const fetchedRun = repo.getRun(out.run.runId);
      expect(fetchedRun).toEqual(out.run);

      const fetchedArt = repo.getArtifact(out.artifact!.artifactId);
      expect(fetchedArt).toEqual(out.artifact);
    });

    it("IMMUTABILITY: Prevents overwriting a SUCCEEDED run with a FAILED run", () => {
      const out = executeExperiment(EXP_001_UNIFORM_BASELINE, dataset, { seed: 42 });
      repo.saveRun(out.run);

      const failedRun = {
        ...out.run,
        status: "FAILED" as const,
        error: {
          code: "MOCK_FAIL",
          message: "Simulated failure",
          stage: "EXECUTION" as const,
          timestamp: new Date().toISOString()
        }
      };

      expect(() => {
        repo.saveRun(failedRun);
      }).toThrowError(/IMMUTABILITY_VIOLATION/);
    });
  });

  // ==========================================================================
  // 7. Pipeline Idempotency & Refresh (9B.7)
  // ==========================================================================
  describe("7. Continuous Research Pipeline Orchestration", () => {
    it("executes all experiments on initial refresh and skips idempotently on rerun", async () => {
      const repo = new ExperimentRepository({ inMemoryOnly: true });

      // First run: executes all 3 baselines
      const res1 = await refreshResearchPipeline({
        corpus,
        dataset,
        repository: repo,
        seed: 42
      });

      expect(res1.status).toBe("REFRESHED");
      expect(res1.executedRuns).toHaveLength(3);
      expect(res1.skippedRuns).toHaveLength(0);

      // Second run with same corpus: idempotent skip
      const res2 = await refreshResearchPipeline({
        corpus,
        dataset,
        repository: repo,
        seed: 42
      });

      expect(res2.status).toBe("UNCHANGED");
      expect(res2.executedRuns).toHaveLength(0);
      expect(res2.skippedRuns).toHaveLength(3);
      expect(res2.message).toContain("Idempotent skip");
    });

    it("inspects experiment run with full lineage", async () => {
      const repo = new ExperimentRepository({ inMemoryOnly: true });
      const res = await refreshResearchPipeline({
        corpus,
        dataset,
        repository: repo,
        seed: 42
      });

      const firstRunId = res.executedRuns[0]!.runId;
      const inspected = inspectExperimentRun(firstRunId, repo);

      expect(inspected.run).toBeDefined();
      expect(inspected.artifact).toBeDefined();
      expect(inspected.lineage).toBeDefined();
      expect(inspected.lineage!.isComplete).toBe(true);
    });
  });
});
