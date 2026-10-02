/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 9B: Continuous Research & Experimentation Orchestrator
 *
 * Implements:
 * - End-to-end continuous scientific research pipeline:
 *   New validated draw / cache -> Canonical corpus -> Feature matrix -> Modeling dataset -> Registered experiments -> Run execution -> Metrics/Result persistence -> Lineage DAG
 * - Idempotency: unchanged corpus skips unnecessary duplicate runs
 * - Deterministic provenance preservation
 * - Safe failure handling without corrupting existing successful results
 * - Strict non-predictive research boundaries
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { LotteryKnowledgeGraph } from "@kerala-lottery/knowledge";
import {
  type MultiDrawLotteryCorpus,
  type FeatureMatrix,
  type ModelingDataset,
  buildMultiDrawCorpus,
  extractCorpusFeatures,
  evaluateFeatureMatrix,
  buildModelFeatureMatrix,
  buildModelingDataset,
  createObservedLastDigitTarget
} from "@kerala-lottery/statistics";

import {
  type RegisteredExperimentDefinition,
  type ExperimentRun,
  type ResultArtifact,
  type ExperimentLineage
} from "./types";

import { getRegisteredExperiments, getRegisteredExperimentById } from "./registry";
import { executeExperiment } from "./runner";
import {
  ExperimentRepository,
  defaultExperimentRepository,
  buildExperimentLineage
} from "./repository";

export interface RefreshResearchPipelineOptions {
  cacheDir?: string;
  graphs?: LotteryKnowledgeGraph[];
  corpus?: MultiDrawLotteryCorpus;
  dataset?: ModelingDataset;
  experimentIds?: string[];
  force?: boolean;
  seed?: number;
  repository?: ExperimentRepository;
  codeVersion?: string;
}

export interface RefreshResearchResult {
  status: "REFRESHED" | "UNCHANGED" | "PARTIAL_FAILURE";
  corpusVersion: string;
  featureVersion: string;
  datasetVersion: string;
  executedRuns: ExperimentRun[];
  skippedRuns: ExperimentRun[];
  failedRuns: ExperimentRun[];
  lineageIds: string[];
  message: string;
}

/**
 * Loads knowledge graphs from the local processed-cache directory.
 */
export function loadGraphsFromCache(
  cacheDir: string = join(process.cwd(), "data/processed-cache")
): LotteryKnowledgeGraph[] {
  const graphsDir = join(cacheDir, "graphs");
  if (!existsSync(graphsDir)) {
    throw new Error(`Graphs directory not found at: ${graphsDir}`);
  }

  const files = readdirSync(graphsDir).filter((f) => f.endsWith(".json"));
  const graphs: LotteryKnowledgeGraph[] = [];

  for (const file of files) {
    try {
      const content = JSON.parse(
        readFileSync(join(graphsDir, file), "utf-8")
      ) as LotteryKnowledgeGraph;
      if (content && content.documentSha256 && Array.isArray(content.nodes) && Array.isArray(content.edges)) {
        graphs.push(content);
      }
    } catch {
      // Ignore unparseable graph files
    }
  }

  if (graphs.length === 0) {
    throw new Error(`No valid LotteryKnowledgeGraph files discovered in: ${graphsDir}`);
  }

  return graphs;
}

/**
 * Builds the canonical feature matrix and modeling dataset from a MultiDrawLotteryCorpus.
 */
export function buildResearchModelingDataset(
  corpus: MultiDrawLotteryCorpus
): {
  featureMatrix: FeatureMatrix;
  dataset: ModelingDataset;
} {
  const featureMatrix = extractCorpusFeatures(corpus);
  const evaluationReport = evaluateFeatureMatrix(featureMatrix, corpus);
  const { matrix: modelMatrix } = buildModelFeatureMatrix(featureMatrix, evaluationReport);
  const targetDef = createObservedLastDigitTarget();
  const dataset = buildModelingDataset(modelMatrix, targetDef, {
    populationScopeType: "ALL_POPULATION"
  });

  return { featureMatrix, dataset };
}

/**
 * Runs the continuous research pipeline.
 *
 * Sequence:
 * 1. Detect / build canonical corpus
 * 2. Check if runs for this corpus already exist (idempotent skip if not forced)
 * 3. Refresh feature matrix & modeling dataset
 * 4. Discover registered experiments
 * 5. Execute each experiment deterministically
 * 6. Persist runs, result artifacts, and complete lineage DAG
 */
export async function refreshResearchPipeline(
  options: RefreshResearchPipelineOptions = {}
): Promise<RefreshResearchResult> {
  const repo = options.repository ?? defaultExperimentRepository;
  const seed = options.seed ?? 42;
  const force = options.force ?? false;
  const codeVersion = options.codeVersion ?? "9B.1.0-continuous-research";

  // 1. Obtain Canonical Corpus
  let corpus = options.corpus;
  if (!corpus) {
    const graphs = options.graphs ?? loadGraphsFromCache(options.cacheDir);
    corpus = buildMultiDrawCorpus(graphs);
  }
  const corpusVersion = corpus.id;

  // 2. Discover Registered Experiments
  let targetExperiments: RegisteredExperimentDefinition[];
  if (options.experimentIds && options.experimentIds.length > 0) {
    targetExperiments = [];
    for (const expId of options.experimentIds) {
      const exp = getRegisteredExperimentById(expId);
      if (!exp) {
        throw new Error(`Registered experiment not found: ${expId}`);
      }
      targetExperiments.push(exp);
    }
  } else {
    targetExperiments = getRegisteredExperiments();
  }

  // 3. Check for Idempotency: Have all experiments already succeeded for this corpusVersion?
  const existingRuns = repo.listRuns({ corpusVersion, status: "SUCCEEDED" });
  const existingRunMap = new Map<string, ExperimentRun>();
  for (const r of existingRuns) {
    existingRunMap.set(r.experimentId, r);
  }

  const allAlreadyRan =
    !force &&
    targetExperiments.every((exp) => existingRunMap.has(exp.experimentId));

  if (allAlreadyRan) {
    const skippedRuns = targetExperiments.map((exp) => existingRunMap.get(exp.experimentId)!);
    const firstRun = skippedRuns[0]!;
    return {
      status: "UNCHANGED",
      corpusVersion,
      featureVersion: firstRun.featureVersion,
      datasetVersion: firstRun.datasetVersion,
      executedRuns: [],
      skippedRuns,
      failedRuns: [],
      lineageIds: skippedRuns.map((r) => r.runId),
      message: `Idempotent skip: All ${targetExperiments.length} experiments are already executed and up to date for corpus ${corpusVersion}.`
    };
  }

  // 4. Feature Refresh & Modeling Dataset Refresh
  let dataset = options.dataset;
  let featureVersion: string;
  if (!dataset) {
    const built = buildResearchModelingDataset(corpus);
    dataset = built.dataset;
    featureVersion = built.featureMatrix.id;
  } else {
    featureVersion = dataset.sourceFeatureMatrixId;
  }
  const datasetVersion = dataset.id;

  // 5. Execute Experiments
  const executedRuns: ExperimentRun[] = [];
  const skippedRuns: ExperimentRun[] = [];
  const failedRuns: ExperimentRun[] = [];
  const lineageIds: string[] = [];

  for (const exp of targetExperiments) {
    // Check if this specific experiment already has a successful run for this datasetVersion
    const existing = repo.getRun(
      // Check existing run from memory/disk
      existingRunMap.get(exp.experimentId)?.runId ?? ""
    );

    if (
      !force &&
      existing &&
      existing.status === "SUCCEEDED" &&
      existing.datasetVersion === datasetVersion
    ) {
      skippedRuns.push(existing);
      lineageIds.push(existing.runId);
      continue;
    }

    try {
      const { run, artifact } = executeExperiment(exp, dataset, {
        seed,
        codeVersion
      });

      repo.saveRun(run);

      if (artifact) {
        repo.saveArtifact(artifact);
      }

      // Build & Persist Lineage
      const lineage = buildExperimentLineage({
        run,
        dataset,
        corpus,
        definition: exp,
        artifact
      });
      repo.saveLineage(lineage);
      lineageIds.push(run.runId);

      if (run.status === "SUCCEEDED") {
        executedRuns.push(run);
      } else {
        failedRuns.push(run);
      }
    } catch (execErr) {
      const errorMsg = execErr instanceof Error ? execErr.message : String(execErr);
      const failedRun: ExperimentRun = {
        runId: `run_failed_${exp.experimentId}_${Date.now()}`,
        experimentId: exp.experimentId,
        experimentVersion: exp.version,
        corpusVersion,
        datasetVersion,
        featureVersion,
        modelVersion: "unknown",
        status: "FAILED",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        reproducibilityMetadata: {
          seed,
          codeVersion,
          inputFingerprint: "error",
          parameters: exp.parameters,
          evaluationFormulae: {},
          runtimeEnvironment: {
            nodeVersion: process.version,
            platform: process.platform
          }
        },
        error: {
          code: "ORCHESTRATOR_EXECUTION_FAILURE",
          message: errorMsg,
          stage: "EXECUTION",
          timestamp: new Date().toISOString()
        },
        descriptiveOnly: true
      };

      try {
        repo.saveRun(failedRun);
      } catch {
        // preserve failure
      }
      failedRuns.push(failedRun);
    }
  }

  const overallStatus =
    failedRuns.length === 0
      ? "REFRESHED"
      : executedRuns.length > 0
      ? "PARTIAL_FAILURE"
      : "PARTIAL_FAILURE";

  return {
    status: overallStatus,
    corpusVersion,
    featureVersion,
    datasetVersion,
    executedRuns,
    skippedRuns,
    failedRuns,
    lineageIds,
    message: `Orchestration complete: ${executedRuns.length} executed, ${skippedRuns.length} skipped, ${failedRuns.length} failed.`
  };
}

/**
 * Runs a single experiment by ID.
 */
export async function runSingleExperiment(
  experimentId: string,
  options: Omit<RefreshResearchPipelineOptions, "experimentIds"> = {}
): Promise<RefreshResearchResult> {
  return refreshResearchPipeline({
    ...options,
    experimentIds: [experimentId]
  });
}

/**
 * Inspects an experiment run and its lineage.
 */
export function inspectExperimentRun(
  runId: string,
  repository: ExperimentRepository = defaultExperimentRepository
): {
  run: ExperimentRun | null;
  artifact: ResultArtifact | null;
  lineage: ExperimentLineage | null;
} {
  const run = repository.getRun(runId);
  const artifact = repository.getArtifactByRunId(runId);
  const lineage = repository.getLineage(runId);

  return { run, artifact, lineage };
}
