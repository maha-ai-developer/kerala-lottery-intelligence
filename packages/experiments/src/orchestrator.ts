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

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
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
  createObservedLastDigitTarget,
  parseDrawDateToIso
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
import { validateExperimentRun } from "./validation-engine";
import {
  generateResearchFinding,
  buildEvidenceBundle,
  verifyEvidenceBundleIntegrity,
  buildResearchFindingLineage
} from "./findings-engine";
import { generatePublicationReport } from "./report-generator";
import type { StatisticalValidationArtifact } from "./validation-types";

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

export function resolveGraphsCacheDir(explicitCacheDir?: string): string {
  const cwd = process.cwd();
  const candidates = [
    explicitCacheDir,
    join(cwd, "data/processed-cache"),
    join(cwd, "..", "data/processed-cache"),
    join(cwd, "../..", "data/processed-cache"),
    join(cwd, "../../..", "data/processed-cache")
  ].filter((d): d is string => typeof d === "string" && existsSync(join(d, "graphs")));

  return candidates[0] || explicitCacheDir || join(cwd, "data/processed-cache");
}

/**
 * Loads knowledge graphs from the local processed-cache directory.
 */
export function loadGraphsFromCache(
  cacheDir?: string,
  options?: { v1BaselineOnly?: boolean }
): LotteryKnowledgeGraph[] {
  const resolvedCacheDir = resolveGraphsCacheDir(cacheDir);
  const graphsDir = join(resolvedCacheDir, "graphs");
  if (!existsSync(graphsDir)) {
    throw new Error(`Graphs directory not found at: ${graphsDir}`);
  }

  let validShasFromManifest: Set<string> | null = null;
  const manifestPath = join(resolvedCacheDir, "manifest.json");
  if (existsSync(manifestPath)) {
    try {
      const manifestRaw = JSON.parse(readFileSync(manifestPath, "utf-8"));
      if (manifestRaw && manifestRaw.documents && typeof manifestRaw.documents === "object") {
        const docs = Object.values(manifestRaw.documents) as Array<{ sha256?: string; status?: string }>;
        if (docs.length > 0) {
          validShasFromManifest = new Set(
            docs.filter((d) => d.status === "VALID" && typeof d.sha256 === "string").map((d) => d.sha256!)
          );
        }
      }
    } catch {
      validShasFromManifest = null;
    }
  }

  const files = readdirSync(graphsDir).filter((f) => f.endsWith(".json"));
  const graphs: LotteryKnowledgeGraph[] = [];

  for (const file of files) {
    try {
      const content = JSON.parse(
        readFileSync(join(graphsDir, file), "utf-8")
      ) as LotteryKnowledgeGraph;
      if (content && content.documentSha256 && Array.isArray(content.nodes) && Array.isArray(content.edges)) {
        if (validShasFromManifest && !validShasFromManifest.has(content.documentSha256)) {
          continue;
        }
        if (options?.v1BaselineOnly) {
          const drawNode = content.nodes.find((n) => n.type === "Draw");
          const rawDate = String(drawNode?.properties?.drawDate ?? "");
          const isoDate = parseDrawDateToIso(rawDate);
          if (!isoDate || isoDate > "2026-10-13") {
            continue;
          }
        }
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
 * Loads and constructs the canonical research corpus from knowledge graphs in cache.
 */
export function loadCanonicalResearchCorpus(
  cacheDir?: string,
  options?: { v1BaselineOnly?: boolean }
): MultiDrawLotteryCorpus {
  const graphs = loadGraphsFromCache(cacheDir, options);
  return buildMultiDrawCorpus(graphs);
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

export interface SynchronizeActiveCorpusResearchResult {
  refreshResult: RefreshResearchResult;
  activeCorpusVersion: string;
  activeDrawCount: number;
  activeTotalResults: number;
  validatedRunIds: string[];
  generatedFindingIds: string[];
  generatedBundleIds: string[];
  generatedReportIds: string[];
}

/**
 * End-to-end active corpus synchronization pipeline:
 * 1. Rebuilds canonical MultiDrawLotteryCorpus, FeatureMatrix, and ModelingDataset from active cache.
 * 2. Executes all eligible registered experiments against the active corpus (idempotent when unchanged).
 * 3. Computes StatisticalValidationArtifacts against the UniformRandomBaselineRun for each active run.
 * 4. Generates ResearchFindings, cryptographically verifiable EvidenceBundles, ResearchFindingLineages,
 *    and PublicationReports for the active corpus while preserving all historical runs and findings.
 */
export async function synchronizeActiveCorpusResearchArtifacts(
  options: RefreshResearchPipelineOptions = {}
): Promise<SynchronizeActiveCorpusResearchResult> {
  const repo = options.repository ?? defaultExperimentRepository;
  const corpus =
    options.corpus ??
    (options.graphs ? buildMultiDrawCorpus(options.graphs) : loadCanonicalResearchCorpus(options.cacheDir));
  const dataset = options.dataset ?? buildResearchModelingDataset(corpus).dataset;

  const refreshResult = await refreshResearchPipeline({
    ...options,
    corpus,
    dataset,
    repository: repo
  });

  const activeCorpusVersion = corpus.id;
  const activeRuns = [...refreshResult.executedRuns, ...refreshResult.skippedRuns].filter(
    (r) => r.corpusVersion === activeCorpusVersion && r.status === "SUCCEEDED"
  );

  const validatedRunIds: string[] = [];
  const generatedFindingIds: string[] = [];
  const generatedBundleIds: string[] = [];
  const generatedReportIds: string[] = [];

  if (activeRuns.length > 0) {
    // 1. Validate all active runs against the canonical null model
    const validationsByRunId = new Map<string, StatisticalValidationArtifact>();
    for (const run of activeRuns) {
      let validation = repo.getValidationByRunId(run.runId);
      const artifact = repo.getArtifactByRunId(run.runId);
      if ((!validation || options.force) && artifact) {
        validation = validateExperimentRun(run, artifact, dataset, {
          familyId: "EXP_FAMILY_CANONICAL_BASELINES",
          totalHypothesesInFamily: activeRuns.length
        });
        repo.saveValidation(validation);
      }
      if (validation) {
        validationsByRunId.set(run.runId, validation);
        validatedRunIds.push(run.runId);
      }
    }

    // 2. Generate ResearchFindings, EvidenceBundles, FindingLineages, and PublicationReports for each active run
    for (const run of activeRuns) {
      const def = getRegisteredExperimentById(run.experimentId);
      const artifact = repo.getArtifactByRunId(run.runId);
      const validation = validationsByRunId.get(run.runId);

      if (!def || !artifact || !validation) continue;

      const finding = generateResearchFinding({
        run,
        artifact,
        validation,
        dataset,
        corpus,
        definition: def,
        claimType: "STATISTICAL_RESULT"
      });

      const existingFinding = repo.getFinding(finding.findingId);
      const existingBundle = repo.getEvidenceBundleByFindingId(finding.findingId);

      if (!existingFinding || !existingBundle || options.force) {
        const evidenceBundle = buildEvidenceBundle({
          finding,
          validation,
          run,
          artifact,
          dataset,
          corpus,
          definition: def
        });

        const integrity = verifyEvidenceBundleIntegrity(evidenceBundle, {
          corpusHash: corpus.corpusHash,
          datasetHash: dataset.deterministicHash,
          experimentHash: def.deterministicHash,
          runHash: run.reproducibilityMetadata.inputFingerprint,
          resultArtifactHash: artifact.deterministicHash,
          validationHash: validation.deterministicHash,
          findingHash: finding.deterministicHash
        });
        if (!integrity.valid) {
          throw new Error(
            `Evidence bundle integrity check failed for ${finding.findingId}: ${integrity.errors.join("; ")}`
          );
        }

        const findingLineage = buildResearchFindingLineage({
          finding,
          validation,
          run,
          artifact,
          dataset,
          corpus,
          definition: def
        });

        const report = generatePublicationReport({
          finding,
          evidenceBundle,
          lineage: findingLineage,
          validation
        });

        repo.saveFinding(finding);
        repo.saveEvidenceBundle(evidenceBundle);
        repo.saveFindingLineage(findingLineage);
        repo.saveReport(report);

        generatedFindingIds.push(finding.findingId);
        generatedBundleIds.push(evidenceBundle.evidenceBundleId);
        generatedReportIds.push(report.reportId);
      } else {
        generatedFindingIds.push(existingFinding.findingId);
        generatedBundleIds.push(existingBundle.evidenceBundleId);
        const existingReport = repo.getReportByFindingId(existingFinding.findingId);
        if (existingReport) {
          generatedReportIds.push(existingReport.reportId);
        }
      }
    }
  }

  // Persist active-corpus-status.json in experiments directory for deterministic fast lookup
  try {
    const resolvedCacheDir = resolveGraphsCacheDir(options.cacheDir);
    const expDir = join(resolvedCacheDir, "experiments");
    if (!existsSync(expDir)) {
      mkdirSync(expDir, { recursive: true });
    }
    const statusPayload = {
      activeCorpusVersion,
      corpusLabel: `active-research-${corpus.draws.length}draws`,
      corpusHash: corpus.corpusHash,
      datasetVersion: dataset.id,
      featureVersion: dataset.sourceFeatureMatrixId,
      totalDraws: corpus.draws.length,
      totalDocuments: corpus.validationReport.totalDocuments,
      totalResults: corpus.combinedEntities.winningResults.length,
      fullTicketResults: corpus.validationReport.totalFullTicketResults,
      suffixResults: corpus.validationReport.totalSuffixResults,
      dateRange: corpus.validationReport.dateRange,
      activeRunIds: activeRuns.map((r) => r.runId),
      validatedRunIds,
      generatedFindingIds,
      generatedBundleIds,
      generatedReportIds,
      synchronizedAt: new Date().toISOString()
    };
    writeFileSync(
      join(expDir, "active-corpus-status.json"),
      JSON.stringify(statusPayload, null, 2),
      "utf-8"
    );
  } catch {
    // Ignore status write error in read-only environments
  }

  return {
    refreshResult,
    activeCorpusVersion,
    activeDrawCount: corpus.draws.length,
    activeTotalResults: corpus.combinedEntities.winningResults.length,
    validatedRunIds,
    generatedFindingIds,
    generatedBundleIds,
    generatedReportIds
  };
}
