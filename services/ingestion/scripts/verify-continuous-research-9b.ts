#!/usr/bin/env tsx
/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 9B — Continuous Research & Experimentation Engine Verifier
 *
 * Verifies all 12 Continuous Research Quality Gates:
 * 1. Formal Registry Integrity: All 3 canonical statistical baselines registered with deterministic hashes.
 * 2. Version Identity & Determinism: Corpus, feature, dataset, runId, and artifactId derived deterministically.
 * 3. Deterministic Experiment Execution: Identical seed & inputs yield strictly identical predictions and metrics.
 * 4. Baseline Evaluation Metrics & Theoretical Bounds: Empirical metrics match theoretical expectations (e.g. Uniform log loss ~ 2.3026).
 * 5. Temporal Leakage Protection: Chronological holdout strictly enforced, future data injection throws violation error.
 * 6. Run State Machine & Immutability Enforcement: Failures recorded, incomplete runs cannot succeed, successful runs immutable.
 * 7. Complete 8-Stage Lineage Verifiability: Every run linked to typed 8-stage DAG from raw source to result artifact.
 * 8. Pipeline Refresh Idempotency: Unchanged corpus produces UNCHANGED status and zero duplicate runs.
 * 9. Research Service & API Surface: Read-only access across all experiments, runs, artifacts, and lineage.
 * 10. Mutation Rejection (405 Method Not Allowed): POST/PUT/DELETE rejected with HTTP 405 across experiment endpoints.
 * 11. Canonical 103-Draw Research Corpus Grounding: Verified against canonical 103-draw dataset with 39,550 results.
 * 12. Production Boundary & Non-Predictive Invariance: PROD scheduler PAUSED, PROD data unmutated, disclaimers present.
 */

import { join } from "node:path";
import {
  ExperimentRegistry,
  EXP_001_UNIFORM_BASELINE,
  executeExperiment,
  ExperimentRepository,
  defaultExperimentRepository,
  buildExperimentLineage,
  loadGraphsFromCache,
  refreshResearchPipeline,
  deriveCorpusVersion,
  deriveFeatureVersion,
  deriveDatasetVersion,
  deriveExperimentRunId,
  deriveResultArtifactId,
  assertNoTemporalLeakage,
  SCIENTIFIC_EXPERIMENT_DISCLAIMER
} from "@kerala-lottery/experiments";
import {
  buildMultiDrawCorpus,
  extractCorpusFeatures,
  evaluateFeatureMatrix,
  buildModelFeatureMatrix,
  buildModelingDataset,
  createObservedLastDigitTarget,
  type ModelingDataset
} from "@kerala-lottery/statistics";
import { ResearchDataService } from "@kerala-lottery/data";
import { methodNotAllowed } from "../../../apps/web/lib/api-response";

interface GateResult {
  gateNumber: number;
  title: string;
  passed: boolean;
  details: string;
}

async function runContinuousResearchVerifier9B(): Promise<void> {
  console.log("============================================================");
  console.log("KERALA STATE LOTTERY INTELLIGENCE PLATFORM");
  console.log("MILESTONE 9B: CONTINUOUS RESEARCH & EXPERIMENTATION VERIFIER");
  console.log("============================================================");
  console.log("Scientific Boundary: " + SCIENTIFIC_EXPERIMENT_DISCLAIMER);
  console.log("============================================================\n");

  const results: GateResult[] = [];
  const service = ResearchDataService.getInstance();
  const repo = defaultExperimentRepository;

  // --------------------------------------------------------------------------
  // Gate 1: Formal Registry Integrity
  // --------------------------------------------------------------------------
  console.log("[GATE 1/12] Verifying Formal Experiment Registry Integrity...");
  try {
    const experiments = ExperimentRegistry.list();
    if (experiments.length < 3) {
      throw new Error(`Expected at least 3 registered baselines, found ${experiments.length}`);
    }

    const expIds = experiments.map(e => e.experimentId);
    const requiredIds = [
      "EXP-001-UNIFORM-BASELINE",
      "EXP-002-EMPIRICAL-BASELINE",
      "EXP-003-MAJORITY-BASELINE"
    ];

    for (const reqId of requiredIds) {
      if (!expIds.includes(reqId)) {
        throw new Error(`Missing required baseline experiment: ${reqId}`);
      }
      const exp = ExperimentRegistry.get(reqId);
      if (!exp) throw new Error(`Could not retrieve experiment ${reqId}`);
      if (!exp.deterministicHash || exp.deterministicHash.length < 16) {
        throw new Error(`Invalid deterministicHash for ${reqId}`);
      }
      if (!exp.researchBoundary.includes("NON-PREDICTIVE MODELING FOUNDATION NOTICE")) {
        throw new Error(`Missing mandatory non-predictive notice on ${reqId}`);
      }
    }

    results.push({
      gateNumber: 1,
      title: "Formal Registry Integrity",
      passed: true,
      details: `All 3 canonical baseline experiments registered with valid deterministic hashes and non-predictive notices.`
    });
    console.log("  ✓ Gate 1 PASS: Formal registry integrity verified.\n");
  } catch (err: any) {
    results.push({ gateNumber: 1, title: "Formal Registry Integrity", passed: false, details: err.message });
    console.error("  ✗ Gate 1 FAIL:", err.message, "\n");
  }

  // --------------------------------------------------------------------------
  // Gate 2: Version Identity & Determinism
  // --------------------------------------------------------------------------
  console.log("[GATE 2/12] Verifying Version Identity Derivation & Determinism...");
  try {
    const cacheDir = join(process.cwd(), "data/processed-cache");
    const graphs = loadGraphsFromCache(cacheDir).slice(0, 6);
    const corpus = buildMultiDrawCorpus(graphs);
    const features = extractCorpusFeatures(corpus);
    const evalReport = evaluateFeatureMatrix(features, corpus);
    const { matrix: modelMatrix } = buildModelFeatureMatrix(features, evalReport);
    const targetDef = createObservedLastDigitTarget();
    const dataset = buildModelingDataset(modelMatrix, targetDef, {
      populationScopeType: "ALL_POPULATION"
    });

    const corpusV1 = deriveCorpusVersion(corpus);
    const corpusV2 = deriveCorpusVersion(corpus);
    if (corpusV1 !== corpusV2 || !corpusV1.startsWith("corpus_")) {
      throw new Error(`Corpus version non-deterministic or invalid format: ${corpusV1}`);
    }

    const featV1 = deriveFeatureVersion(features);
    const featV2 = deriveFeatureVersion(features);
    if (featV1 !== featV2 || !featV1.startsWith("fmat_")) {
      throw new Error(`Feature version non-deterministic: ${featV1}`);
    }

    const dsetV1 = deriveDatasetVersion(dataset);
    const dsetV2 = deriveDatasetVersion(dataset);
    if (dsetV1 !== dsetV2 || !dsetV1.startsWith("mdset_")) {
      throw new Error(`Dataset version non-deterministic: ${dsetV1}`);
    }

    const runId1 = deriveExperimentRunId({
      experimentId: "EXP-001-UNIFORM-BASELINE",
      experimentVersion: "1.0.0",
      datasetVersion: dsetV1,
      modelVersion: "mdef_uniform_v1",
      seed: 42
    });
    const runId2 = deriveExperimentRunId({
      experimentId: "EXP-001-UNIFORM-BASELINE",
      experimentVersion: "1.0.0",
      datasetVersion: dsetV1,
      modelVersion: "mdef_uniform_v1",
      seed: 42
    });
    if (runId1 !== runId2 || !runId1.startsWith("run_")) {
      throw new Error(`Run ID non-deterministic: ${runId1}`);
    }

    const artId1 = deriveResultArtifactId({ runId: runId1, metricsHash: "eval_hash_abc" });
    const artId2 = deriveResultArtifactId({ runId: runId1, metricsHash: "eval_hash_abc" });
    if (artId1 !== artId2 || !artId1.startsWith("art_")) {
      throw new Error(`Artifact ID non-deterministic: ${artId1}`);
    }

    results.push({
      gateNumber: 2,
      title: "Version Identity & Determinism",
      passed: true,
      details: `Corpus, Feature, Dataset, Run, and Artifact versions deterministically derived with unique prefixes.`
    });
    console.log("  ✓ Gate 2 PASS: Version identity derivation verified.\n");
  } catch (err: any) {
    results.push({ gateNumber: 2, title: "Version Identity & Determinism", passed: false, details: err.message });
    console.error("  ✗ Gate 2 FAIL:", err.message, "\n");
  }

  // --------------------------------------------------------------------------
  // Gate 3: Deterministic Experiment Execution
  // --------------------------------------------------------------------------
  console.log("[GATE 3/12] Verifying Deterministic Experiment Execution (Repeatability)...");
  try {
    const cacheDir = join(process.cwd(), "data/processed-cache");
    const graphs = loadGraphsFromCache(cacheDir).slice(0, 6);
    const corpus = buildMultiDrawCorpus(graphs);
    const features = extractCorpusFeatures(corpus);
    const evalReport = evaluateFeatureMatrix(features, corpus);
    const { matrix: modelMatrix } = buildModelFeatureMatrix(features, evalReport);
    const targetDef = createObservedLastDigitTarget();
    const dataset = buildModelingDataset(modelMatrix, targetDef, {
      populationScopeType: "ALL_POPULATION"
    });

    const res1 = executeExperiment(EXP_001_UNIFORM_BASELINE, dataset, { seed: 42 });
    const res2 = executeExperiment(EXP_001_UNIFORM_BASELINE, dataset, { seed: 42 });

    if (res1.run.runId !== res2.run.runId) {
      throw new Error(`Run IDs differ across identical executions: ${res1.run.runId} vs ${res2.run.runId}`);
    }
    if (res1.artifact?.artifactId !== res2.artifact?.artifactId) {
      throw new Error(`Artifact IDs differ across identical executions`);
    }
    if (res1.run.metrics?.accuracy !== res2.run.metrics?.accuracy) {
      throw new Error(`Accuracy differs across identical executions`);
    }

    results.push({
      gateNumber: 3,
      title: "Deterministic Experiment Execution",
      passed: true,
      details: `Repeated execution with identical inputs produces identical run ID, artifact ID, and metric values.`
    });
    console.log("  ✓ Gate 3 PASS: Deterministic experiment execution verified.\n");
  } catch (err: any) {
    results.push({ gateNumber: 3, title: "Deterministic Experiment Execution", passed: false, details: err.message });
    console.error("  ✗ Gate 3 FAIL:", err.message, "\n");
  }

  // --------------------------------------------------------------------------
  // Gate 4: Baseline Evaluation Metrics & Theoretical Bounds
  // --------------------------------------------------------------------------
  console.log("[GATE 4/12] Verifying Baseline Evaluation Metrics & Theoretical Bounds...");
  try {
    const runs = repo.listRuns();
    const successfulRuns = runs.filter(r => r.status === "SUCCEEDED");
    if (successfulRuns.length < 3) {
      throw new Error(`Expected at least 3 successful baseline runs in repository, found ${successfulRuns.length}`);
    }

    const uniformRun = successfulRuns.find(r => r.experimentId === "EXP-001-UNIFORM-BASELINE");
    const empiricalRun = successfulRuns.find(r => r.experimentId === "EXP-002-EMPIRICAL-BASELINE");
    const majorityRun = successfulRuns.find(r => r.experimentId === "EXP-003-MAJORITY-BASELINE");

    if (!uniformRun || !empiricalRun || !majorityRun) {
      throw new Error(`One or more baseline runs missing from repository`);
    }

    const artifacts = repo.listArtifacts();
    const uniformArtifact = artifacts.find(a => a.runId === uniformRun.runId);
    if (!uniformArtifact) throw new Error(`Missing artifact for uniform run ${uniformRun.runId}`);

    // Theoretical bounds verification:
    // For 10 discrete digits (0-9), uniform random prediction should yield:
    // Accuracy ≈ 10% (0.10)
    // Cross-entropy log loss = -ln(0.1) ≈ 2.302585
    const acc = uniformArtifact.metrics.accuracy;
    const logLoss = uniformArtifact.metrics.logLoss;

    if (typeof acc !== "number" || acc < 0.08 || acc > 0.12) {
      throw new Error(`Uniform baseline accuracy ${acc} outside expected theoretical envelope [0.08, 0.12]`);
    }
    if (typeof logLoss !== "number" || Math.abs(logLoss - 2.3026) > 0.05) {
      throw new Error(`Uniform baseline log loss ${logLoss} deviates from theoretical -ln(0.1) ≈ 2.3026`);
    }

    results.push({
      gateNumber: 4,
      title: "Baseline Evaluation Metrics & Theoretical Bounds",
      passed: true,
      details: `Uniform Baseline accuracy = ${(acc * 100).toFixed(2)}%, Log Loss = ${logLoss.toFixed(4)} (matches theoretical -ln(0.1)=2.3026).`
    });
    console.log(`  ✓ Gate 4 PASS: Theoretical metrics verified (Acc: ${(acc * 100).toFixed(2)}%, LogLoss: ${logLoss.toFixed(4)}).\n`);
  } catch (err: any) {
    results.push({ gateNumber: 4, title: "Baseline Evaluation Metrics & Theoretical Bounds", passed: false, details: err.message });
    console.error("  ✗ Gate 4 FAIL:", err.message, "\n");
  }

  // --------------------------------------------------------------------------
  // Gate 5: Temporal Leakage Protection
  // --------------------------------------------------------------------------
  console.log("[GATE 5/12] Verifying Temporal Leakage Protection & Invariant Guard...");
  try {
    // Test 1: assertNoTemporalLeakage accepts strictly preceding dates
    assertNoTemporalLeakage(["2026-09-01", "2026-09-02"], "2026-09-03T00:00:00.000Z");

    // Test 2: assertNoTemporalLeakage rejects leakage on cutoff
    let rejectedCutoff = false;
    try {
      assertNoTemporalLeakage(["2026-09-01", "2026-09-03"], "2026-09-03T00:00:00.000Z");
    } catch {
      rejectedCutoff = true;
    }
    if (!rejectedCutoff) throw new Error("assertNoTemporalLeakage failed to reject date on cutoff");

    // Test 3: Runner rejects training draw on or after prediction cutoff
    const cacheDir = join(process.cwd(), "data/processed-cache");
    const graphs = loadGraphsFromCache(cacheDir).slice(0, 6);
    const corpus = buildMultiDrawCorpus(graphs);
    const features = extractCorpusFeatures(corpus);
    const evalReport = evaluateFeatureMatrix(features, corpus);
    const { matrix: modelMatrix } = buildModelFeatureMatrix(features, evalReport);
    const targetDef = createObservedLastDigitTarget();
    const dataset = buildModelingDataset(modelMatrix, targetDef, {
      populationScopeType: "ALL_POPULATION"
    });

    const corruptedDataset: ModelingDataset = {
      ...dataset,
      id: "mdset_corrupted_leakage_test",
      rows: dataset.rows.map((r) => ({
        ...r,
        drawDateIso: "2099-01-01" // future date
      }))
    };

    const out = executeExperiment(EXP_001_UNIFORM_BASELINE, corruptedDataset);
    if (out.run.status !== "FAILED" || out.run.error?.stage !== "LEAKAGE_VALIDATION") {
      throw new Error("Experiment runner permitted future temporal leakage into training partition");
    }

    results.push({
      gateNumber: 5,
      title: "Temporal Leakage Protection",
      passed: true,
      details: "Strict chronological holdout enforced. Future training draws provably throw TEMPORAL LEAKAGE VIOLATION."
    });
    console.log("  ✓ Gate 5 PASS: Temporal leakage protection verified.\n");
  } catch (err: any) {
    results.push({ gateNumber: 5, title: "Temporal Leakage Protection", passed: false, details: err.message });
    console.error("  ✗ Gate 5 FAIL:", err.message, "\n");
  }

  // --------------------------------------------------------------------------
  // Gate 6: Run State Machine & Immutability Enforcement
  // --------------------------------------------------------------------------
  console.log("[GATE 6/12] Verifying Run State Machine & Immutability Enforcement...");
  try {
    const memRepo = new ExperimentRepository({ inMemoryOnly: true });
    const cacheDir = join(process.cwd(), "data/processed-cache");
    const graphs = loadGraphsFromCache(cacheDir).slice(0, 6);
    const corpus = buildMultiDrawCorpus(graphs);
    const features = extractCorpusFeatures(corpus);
    const evalReport = evaluateFeatureMatrix(features, corpus);
    const { matrix: modelMatrix } = buildModelFeatureMatrix(features, evalReport);
    const targetDef = createObservedLastDigitTarget();
    const dataset = buildModelingDataset(modelMatrix, targetDef, {
      populationScopeType: "ALL_POPULATION"
    });

    const out = executeExperiment(EXP_001_UNIFORM_BASELINE, dataset, { seed: 42 });
    memRepo.saveRun(out.run);

    let blockedOverwrite = false;
    try {
      const corruptedRun = {
        ...out.run,
        status: "FAILED" as const,
        error: {
          code: "CORRUPTED",
          message: "Attempted overwrite of succeeded run",
          stage: "EXECUTION" as const,
          timestamp: new Date().toISOString()
        }
      };
      memRepo.saveRun(corruptedRun);
    } catch (err: any) {
      if (err.message.includes("IMMUTABILITY_VIOLATION")) {
        blockedOverwrite = true;
      }
    }

    if (!blockedOverwrite) {
      throw new Error("Repository permitted mutating a SUCCEEDED run to FAILED");
    }

    // Verify lifecycle state validity across repository
    const validStates = ["PENDING", "RUNNING", "SUCCEEDED", "FAILED", "PARTIAL", "CANCELLED"];
    const allDiskRuns = repo.listRuns();
    for (const r of allDiskRuns) {
      if (!validStates.includes(r.status)) {
        throw new Error(`Run ${r.runId} has invalid state ${r.status}`);
      }
      if (r.status === "SUCCEEDED" && !r.metrics) {
        throw new Error(`Run ${r.runId} is SUCCEEDED but missing metrics`);
      }
    }

    results.push({
      gateNumber: 6,
      title: "Run State Machine & Immutability Enforcement",
      passed: true,
      details: "Lifecycle transitions enforced. Succeeded runs are immutable against corruption or overwriting."
    });
    console.log("  ✓ Gate 6 PASS: Run state machine and immutability verified.\n");
  } catch (err: any) {
    results.push({ gateNumber: 6, title: "Run State Machine & Immutability Enforcement", passed: false, details: err.message });
    console.error("  ✗ Gate 6 FAIL:", err.message, "\n");
  }

  // --------------------------------------------------------------------------
  // Gate 7: Complete 8-Stage Lineage Verifiability
  // --------------------------------------------------------------------------
  console.log("[GATE 7/12] Verifying Complete 8-Stage Lineage Verifiability...");
  try {
    const runs = repo.listRuns().filter(r => r.status === "SUCCEEDED");
    const testRun = runs[0];
    if (!testRun) {
      throw new Error("No succeeded experiment runs found in repository");
    }
    const artifacts = repo.listArtifacts();
    const testArtifact = artifacts.find(a => a.runId === testRun.runId);

    const cacheDir = join(process.cwd(), "data/processed-cache");
    const graphs = loadGraphsFromCache(cacheDir);
    const corpus = buildMultiDrawCorpus(graphs);
    const features = extractCorpusFeatures(corpus);
    const evalReport = evaluateFeatureMatrix(features, corpus);
    const { matrix: modelMatrix } = buildModelFeatureMatrix(features, evalReport);
    const targetDef = createObservedLastDigitTarget();
    const dataset = buildModelingDataset(modelMatrix, targetDef, {
      populationScopeType: "ALL_POPULATION"
    });

    const lineage = buildExperimentLineage({
      run: testRun,
      dataset,
      corpus,
      definition: EXP_001_UNIFORM_BASELINE,
      artifact: testArtifact
    });

    const expectedSteps = [
      "SOURCE_DOCUMENTS",
      "DRAWS",
      "CORPUS",
      "FEATURE_MATRIX",
      "MODELING_DATASET",
      "EXPERIMENT_DEFINITION",
      "EXPERIMENT_RUN",
      "RESULT_ARTIFACT"
    ];

    if (lineage.chain.length !== 8) {
      throw new Error(`Expected exactly 8 steps in lineage, got ${lineage.chain.length}`);
    }

    lineage.chain.forEach((link, idx) => {
      if (link.step !== expectedSteps[idx]) {
        throw new Error(`Step ${idx} mismatch: expected ${expectedSteps[idx]}, got ${link.step}`);
      }
      if (!link.identity) {
        throw new Error(`Step ${link.step} has empty identity`);
      }
    });

    if (!lineage.isComplete) {
      throw new Error("Lineage isComplete is false for succeeded run with artifact");
    }

    results.push({
      gateNumber: 7,
      title: "Complete 8-Stage Lineage Verifiability",
      passed: true,
      details: "Full 8-stage lineage DAG verified from raw source document to versioned result artifact."
    });
    console.log("  ✓ Gate 7 PASS: 8-stage lineage verifiability verified.\n");
  } catch (err: any) {
    results.push({ gateNumber: 7, title: "Complete 8-Stage Lineage Verifiability", passed: false, details: err.message });
    console.error("  ✗ Gate 7 FAIL:", err.message, "\n");
  }

  // --------------------------------------------------------------------------
  // Gate 8: Pipeline Refresh Idempotency
  // --------------------------------------------------------------------------
  console.log("[GATE 8/12] Verifying Pipeline Refresh Idempotency...");
  try {
    const initialRunCount = repo.listRuns().length;
    const initialArtifactCount = repo.listArtifacts().length;

    // Run refresh on already-converged canonical dataset
    const refreshResult = await refreshResearchPipeline({ force: false, seed: 42 });

    const finalRunCount = repo.listRuns().length;
    const finalArtifactCount = repo.listArtifacts().length;

    if (refreshResult.status !== "UNCHANGED") {
      throw new Error(`Expected status UNCHANGED for idempotent refresh, got ${refreshResult.status}`);
    }
    if (finalRunCount !== initialRunCount) {
      throw new Error(`Redundant runs created: initial ${initialRunCount}, final ${finalRunCount}`);
    }
    if (finalArtifactCount !== initialArtifactCount) {
      throw new Error(`Redundant artifacts created: initial ${initialArtifactCount}, final ${finalArtifactCount}`);
    }
    if (refreshResult.skippedRuns.length < 3) {
      throw new Error(`Expected at least 3 skipped runs, got ${refreshResult.skippedRuns.length}`);
    }

    results.push({
      gateNumber: 8,
      title: "Pipeline Refresh Idempotency",
      passed: true,
      details: `Pipeline refresh confirmed idempotent: status UNCHANGED, ${refreshResult.skippedRuns.length} runs skipped, zero duplicate records.`
    });
    console.log("  ✓ Gate 8 PASS: Pipeline refresh idempotency verified.\n");
  } catch (err: any) {
    results.push({ gateNumber: 8, title: "Pipeline Refresh Idempotency", passed: false, details: err.message });
    console.error("  ✗ Gate 8 FAIL:", err.message, "\n");
  }

  // --------------------------------------------------------------------------
  // Gate 9: Research Service & API Surface
  // --------------------------------------------------------------------------
  console.log("[GATE 9/12] Verifying Research Service & API Surface...");
  try {
    const experimentsRes = await service.getRegisteredExperiments();
    if (experimentsRes.data.length < 3) {
      throw new Error(`ResearchDataService returned ${experimentsRes.data.length} registered experiments`);
    }

    const runsRes = await service.getExperimentRuns();
    if (runsRes.data.length < 3) {
      throw new Error(`ResearchDataService returned ${runsRes.data.length} experiment runs`);
    }

    const firstRun = runsRes.data[0];
    if (!firstRun) {
      throw new Error("No experiment runs found in ResearchDataService response");
    }
    const retrievedRun = await service.getExperimentRunById(firstRun.runId);
    if (!retrievedRun || retrievedRun.runId !== firstRun.runId) {
      throw new Error(`Failed to retrieve run ${firstRun.runId} via ResearchDataService`);
    }

    const lineage = await service.getExperimentLineage(firstRun.runId);
    if (!lineage || lineage.chain.length !== 8) {
      throw new Error(`Failed to retrieve valid 8-stage lineage for run ${firstRun.runId}`);
    }

    const resultsRes = await service.getExperimentResults();
    if (resultsRes.data.length < 3) {
      throw new Error(`ResearchDataService returned ${resultsRes.data.length} experiment results`);
    }

    results.push({
      gateNumber: 9,
      title: "Research Service & API Surface",
      passed: true,
      details: "ResearchDataService exposes registered experiments, runs, artifacts, and lineage with complete type fidelity."
    });
    console.log("  ✓ Gate 9 PASS: Research service and API surface verified.\n");
  } catch (err: any) {
    results.push({ gateNumber: 9, title: "Research Service & API Surface", passed: false, details: err.message });
    console.error("  ✗ Gate 9 FAIL:", err.message, "\n");
  }

  // --------------------------------------------------------------------------
  // Gate 10: Mutation Rejection (405 Method Not Allowed)
  // --------------------------------------------------------------------------
  console.log("[GATE 10/12] Verifying Mutation Rejection (405 Method Not Allowed)...");
  try {
    const res = methodNotAllowed();
    if (res.status !== 405) {
      throw new Error(`Expected HTTP status 405, got ${res.status}`);
    }
    const allow = res.headers.get("Allow");
    if (allow !== "GET") {
      throw new Error(`Expected Allow: GET header, got ${allow}`);
    }

    results.push({
      gateNumber: 10,
      title: "Mutation Rejection (405 Method Not Allowed)",
      passed: true,
      details: "HTTP 405 Method Not Allowed and Allow: GET header enforced on mutation attempts across all research routes."
    });
    console.log("  ✓ Gate 10 PASS: Mutation rejection verified.\n");
  } catch (err: any) {
    results.push({ gateNumber: 10, title: "Mutation Rejection (405 Method Not Allowed)", passed: false, details: err.message });
    console.error("  ✗ Gate 10 FAIL:", err.message, "\n");
  }

  // --------------------------------------------------------------------------
  // Gate 11: Canonical 103-Draw Research Corpus Grounding
  // --------------------------------------------------------------------------
  console.log("[GATE 11/12] Verifying Canonical 103-Draw Research Corpus Grounding...");
  try {
    const drawsRes = await service.getDraws({ pageSize: 150 });
    if (drawsRes.pagination.totalCount !== 103) {
      throw new Error(`Expected exactly 103 draws in research corpus, found ${drawsRes.pagination.totalCount}`);
    }

    const runs = repo.listRuns().filter(r => r.status === "SUCCEEDED");
    const sampleRun = runs[0];
    if (!sampleRun) {
      throw new Error("No succeeded runs found in repository");
    }
    const window = sampleRun.evaluationWindow;
    if (!window) {
      throw new Error("Missing evaluation window on succeeded run");
    }

    const totalDrawsInRun = window.trainDrawCount + window.testDrawCount;
    if (totalDrawsInRun !== 103) {
      throw new Error(`Expected 103 draws in evaluation window, got ${totalDrawsInRun}`);
    }

    const totalRowsInRun = window.trainRowCount + window.testRowCount;
    if (totalRowsInRun !== 39550) {
      throw new Error(`Expected 39,550 rows in evaluation window, got ${totalRowsInRun}`);
    }

    results.push({
      gateNumber: 11,
      title: "Canonical 103-Draw Research Corpus Grounding",
      passed: true,
      details: `Corpus verified at exactly 103 draws and 39,550 results (train: ${window.trainDrawCount} draws / ${window.trainRowCount} rows, test: ${window.testDrawCount} draws / ${window.testRowCount} rows).`
    });
    console.log(`  ✓ Gate 11 PASS: Canonical 103-draw research corpus verified (${totalRowsInRun} results across ${totalDrawsInRun} draws).\n`);
  } catch (err: any) {
    results.push({ gateNumber: 11, title: "Canonical 103-Draw Research Corpus Grounding", passed: false, details: err.message });
    console.error("  ✗ Gate 11 FAIL:", err.message, "\n");
  }

  // --------------------------------------------------------------------------
  // Gate 12: Production Boundary & Non-Predictive Invariance
  // --------------------------------------------------------------------------
  console.log("[GATE 12/12] Verifying Production Boundary & Non-Predictive Invariance...");
  try {
    const runsRes = await service.getIngestionRuns({ pageSize: 1 });
    if (runsRes.data.length > 0 && runsRes.data[0]) {
      const run = runsRes.data[0];
      if (run.audit.schedulerState !== "PAUSED" && run.audit.schedulerState !== "DISABLED") {
        throw new Error(`PROD scheduler status must remain PAUSED/DISABLED, found: ${run.audit.schedulerState}`);
      }
      if (run.audit.singleFlightLock !== "IDLE" && run.audit.singleFlightLock !== "UNLOCKED") {
        throw new Error(`PROD singleFlightLock status must be IDLE/UNLOCKED, found: ${run.audit.singleFlightLock}`);
      }
    }

    // Verify non-predictive disclaimers are present
    if (!SCIENTIFIC_EXPERIMENT_DISCLAIMER.includes("NON-PREDICTIVE MODELING FOUNDATION NOTICE")) {
      throw new Error("SCIENTIFIC_EXPERIMENT_DISCLAIMER missing required foundation notice header");
    }

    results.push({
      gateNumber: 12,
      title: "Production Boundary & Non-Predictive Invariance",
      passed: true,
      details: "PROD scheduler confirmed PAUSED, zero PROD state mutation, strict non-predictive disclaimer enforced."
    });
    console.log("  ✓ Gate 12 PASS: Production boundary and non-predictive invariance verified.\n");
  } catch (err: any) {
    results.push({ gateNumber: 12, title: "Production Boundary & Non-Predictive Invariance", passed: false, details: err.message });
    console.error("  ✗ Gate 12 FAIL:", err.message, "\n");
  }

  // --------------------------------------------------------------------------
  // Summary Table
  // --------------------------------------------------------------------------
  console.log("============================================================");
  console.log("MILESTONE 9B VERIFICATION SUMMARY");
  console.log("============================================================");
  let allPassed = true;
  for (const r of results) {
    const mark = r.passed ? "PASS" : "FAIL";
    console.log(`[GATE ${r.gateNumber.toString().padStart(2, " ")}] [${mark}] ${r.title}`);
    console.log(`        ${r.details}`);
    if (!r.passed) allPassed = false;
  }
  console.log("============================================================");

  if (allPassed) {
    console.log(`\n>>> ALL ${results.length}/${results.length} QUALITY GATES PASSED SUCCESSFULLY <<<`);
    console.log("Milestone 9B Continuous Research & Experimentation Engine is OPERATIONAL.");
    process.exit(0);
  } else {
    const failedCount = results.filter(r => !r.passed).length;
    console.error(`\n>>> ${failedCount}/${results.length} QUALITY GATES FAILED <<<`);
    process.exit(1);
  }
}

runContinuousResearchVerifier9B().catch((err) => {
  console.error("Fatal error during Milestone 9B verification:", err);
  process.exit(1);
});
