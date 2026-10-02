/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 9B: Experiment Repository & Provenance Lineage
 *
 * Implements:
 * - Immutable persistence for ExperimentRun, ResultArtifact, and ExperimentLineage
 * - Typed Lineage DAG construction:
 *   SourceDocuments -> Draws -> Corpus -> FeatureMatrix -> ModelingDataset -> ExperimentDefinition -> ExperimentRun -> ResultArtifact
 * - Protection against overwriting successful runs with failed runs
 * - Idempotent writes for identical deterministic executions
 * - File system storage under `data/processed-cache/experiments/`
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { MultiDrawLotteryCorpus, ModelingDataset } from "@kerala-lottery/statistics";

import {
  type ExperimentRun,
  type ResultArtifact,
  type ExperimentLineage,
  type ExperimentLineageStep,
  type RegisteredExperimentDefinition,
  type ExperimentRunStatus
} from "./types";

export interface ExperimentRepositoryOptions {
  baseDir?: string;
  inMemoryOnly?: boolean;
}

/**
 * Builds complete typed lineage DAG for an experiment execution.
 */
export function buildExperimentLineage(params: {
  run: ExperimentRun;
  dataset: ModelingDataset;
  corpus: MultiDrawLotteryCorpus;
  definition: RegisteredExperimentDefinition;
  artifact?: ResultArtifact;
}): ExperimentLineage {
  const { run, dataset, corpus, definition, artifact } = params;

  // Extract source document SHAs and draw IDs from the canonical corpus
  const sourceDocumentShas = Array.from(
    new Set(corpus.draws.map((d) => d.sourceDocumentSha256).filter(Boolean))
  ).sort();

  const drawIds = corpus.draws.map((d) => d.drawId).sort();

  const chain: ExperimentLineageStep[] = [
    {
      step: "SOURCE_DOCUMENTS",
      identity: `${sourceDocumentShas.length} source documents`,
      attributes: {
        count: sourceDocumentShas.length,
        shas: sourceDocumentShas
      }
    },
    {
      step: "DRAWS",
      identity: `${drawIds.length} draws`,
      attributes: {
        count: drawIds.length,
        drawIds
      }
    },
    {
      step: "CORPUS",
      identity: corpus.id,
      attributes: {
        corpusId: corpus.id,
        drawCount: corpus.draws.length,
        totalResults: corpus.validationReport.totalWinningResults,
        sha256Hash: corpus.corpusHash
      }
    },
    {
      step: "FEATURE_MATRIX",
      identity: dataset.sourceFeatureMatrixId,
      attributes: {
        featureMatrixId: dataset.sourceFeatureMatrixId
      }
    },
    {
      step: "MODELING_DATASET",
      identity: dataset.id,
      attributes: {
        datasetId: dataset.id,
        totalRows: dataset.totalRows,
        fullTicketCount: dataset.fullTicketCount,
        suffixCount: dataset.suffixCount,
        targetId: dataset.targetDefinition.targetId
      }
    },
    {
      step: "EXPERIMENT_DEFINITION",
      identity: definition.experimentId,
      attributes: {
        experimentId: definition.experimentId,
        version: definition.version,
        name: definition.name,
        modelType: definition.modelType,
        deterministicHash: definition.deterministicHash
      }
    },
    {
      step: "EXPERIMENT_RUN",
      identity: run.runId,
      attributes: {
        runId: run.runId,
        status: run.status,
        modelVersion: run.modelVersion,
        seed: run.reproducibilityMetadata.seed,
        inputFingerprint: run.reproducibilityMetadata.inputFingerprint
      }
    }
  ];

  if (artifact) {
    chain.push({
      step: "RESULT_ARTIFACT",
      identity: artifact.artifactId,
      attributes: {
        artifactId: artifact.artifactId,
        metrics: artifact.metrics,
        deterministicHash: artifact.deterministicHash
      }
    });
  }

  const isComplete =
    chain.length === 8 && run.status === "SUCCEEDED" && artifact !== undefined;

  return {
    runId: run.runId,
    experimentId: definition.experimentId,
    experimentVersion: definition.version,
    corpusVersion: corpus.id,
    featureVersion: dataset.sourceFeatureMatrixId,
    datasetVersion: dataset.id,
    artifactId: artifact?.artifactId,
    sourceDocumentCount: sourceDocumentShas.length,
    sourceDocumentShas,
    drawCount: drawIds.length,
    drawIds,
    chain,
    isComplete
  };
}

export class ExperimentRepository {
  private readonly baseDir: string;
  private readonly runsDir: string;
  private readonly artifactsDir: string;
  private readonly lineageDir: string;
  private readonly inMemoryOnly: boolean;

  // In-memory backing stores
  private readonly runsMemory = new Map<string, ExperimentRun>();
  private readonly artifactsMemory = new Map<string, ResultArtifact>();
  private readonly lineageMemory = new Map<string, ExperimentLineage>();

  constructor(options: ExperimentRepositoryOptions = {}) {
    this.inMemoryOnly = options.inMemoryOnly ?? false;
    this.baseDir =
      options.baseDir ??
      join(process.cwd(), "data/processed-cache/experiments");
    this.runsDir = join(this.baseDir, "runs");
    this.artifactsDir = join(this.baseDir, "artifacts");
    this.lineageDir = join(this.baseDir, "lineage");

    if (!this.inMemoryOnly) {
      this.ensureDirectories();
    }
  }

  private ensureDirectories(): void {
    if (!existsSync(this.runsDir)) mkdirSync(this.runsDir, { recursive: true });
    if (!existsSync(this.artifactsDir)) mkdirSync(this.artifactsDir, { recursive: true });
    if (!existsSync(this.lineageDir)) mkdirSync(this.lineageDir, { recursive: true });
  }

  /**
   * Saves an experiment run.
   * INVARIANT: A failed or partial run must NEVER overwrite an existing SUCCEEDED run.
   */
  public saveRun(run: ExperimentRun): void {
    const existing = this.getRun(run.runId);
    if (existing && existing.status === "SUCCEEDED" && run.status !== "SUCCEEDED") {
      throw new Error(
        `IMMUTABILITY_VIOLATION: Cannot overwrite SUCCEEDED run ${run.runId} with status ${run.status}.`
      );
    }

    this.runsMemory.set(run.runId, run);

    if (!this.inMemoryOnly) {
      this.ensureDirectories();
      const filePath = join(this.runsDir, `${run.runId}.json`);
      writeFileSync(filePath, JSON.stringify(run, null, 2), "utf-8");
    }
  }

  /**
   * Retrieves an experiment run by ID.
   */
  public getRun(runId: string): ExperimentRun | null {
    if (this.runsMemory.has(runId)) {
      return this.runsMemory.get(runId)!;
    }

    if (!this.inMemoryOnly) {
      const filePath = join(this.runsDir, `${runId}.json`);
      if (existsSync(filePath)) {
        try {
          const content = JSON.parse(readFileSync(filePath, "utf-8")) as ExperimentRun;
          this.runsMemory.set(runId, content);
          return content;
        } catch {
          return null;
        }
      }
    }

    return null;
  }

  /**
   * Lists experiment runs with optional filtering.
   */
  public listRuns(filters?: {
    experimentId?: string;
    status?: ExperimentRunStatus;
    corpusVersion?: string;
  }): ExperimentRun[] {
    const allRuns: ExperimentRun[] = [];

    // Load from disk if not in-memory only
    if (!this.inMemoryOnly && existsSync(this.runsDir)) {
      const files = readdirSync(this.runsDir).filter((f) => f.endsWith(".json"));
      for (const file of files) {
        const runId = file.replace(".json", "");
        if (!this.runsMemory.has(runId)) {
          try {
            const content = JSON.parse(
              readFileSync(join(this.runsDir, file), "utf-8")
            ) as ExperimentRun;
            this.runsMemory.set(runId, content);
          } catch {
            // Skip unparseable files
          }
        }
      }
    }

    for (const run of this.runsMemory.values()) {
      if (filters?.experimentId && run.experimentId !== filters.experimentId) {
        continue;
      }
      if (filters?.status && run.status !== filters.status) {
        continue;
      }
      if (filters?.corpusVersion && run.corpusVersion !== filters.corpusVersion) {
        continue;
      }
      allRuns.push(run);
    }

    return allRuns.sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  }

  /**
   * Saves a result artifact.
   */
  public saveArtifact(artifact: ResultArtifact): void {
    this.artifactsMemory.set(artifact.artifactId, artifact);

    if (!this.inMemoryOnly) {
      this.ensureDirectories();
      const filePath = join(this.artifactsDir, `${artifact.artifactId}.json`);
      writeFileSync(filePath, JSON.stringify(artifact, null, 2), "utf-8");
    }
  }

  /**
   * Retrieves a result artifact by artifact ID.
   */
  public getArtifact(artifactId: string): ResultArtifact | null {
    if (this.artifactsMemory.has(artifactId)) {
      return this.artifactsMemory.get(artifactId)!;
    }

    if (!this.inMemoryOnly) {
      const filePath = join(this.artifactsDir, `${artifactId}.json`);
      if (existsSync(filePath)) {
        try {
          const content = JSON.parse(readFileSync(filePath, "utf-8")) as ResultArtifact;
          this.artifactsMemory.set(artifactId, content);
          return content;
        } catch {
          return null;
        }
      }
    }

    return null;
  }

  /**
   * Retrieves a result artifact by run ID.
   */
  public getArtifactByRunId(runId: string): ResultArtifact | null {
    // Check in-memory
    for (const artifact of this.artifactsMemory.values()) {
      if (artifact.runId === runId) return artifact;
    }

    // Check disk
    if (!this.inMemoryOnly && existsSync(this.artifactsDir)) {
      const files = readdirSync(this.artifactsDir).filter((f) => f.endsWith(".json"));
      for (const file of files) {
        try {
          const content = JSON.parse(
            readFileSync(join(this.artifactsDir, file), "utf-8")
          ) as ResultArtifact;
          this.artifactsMemory.set(content.artifactId, content);
          if (content.runId === runId) return content;
        } catch {
          // ignore
        }
      }
    }

    return null;
  }

  /**
   * Lists all result artifacts.
   */
  public listArtifacts(): ResultArtifact[] {
    if (!this.inMemoryOnly && existsSync(this.artifactsDir)) {
      const files = readdirSync(this.artifactsDir).filter((f) => f.endsWith(".json"));
      for (const file of files) {
        const artifactId = file.replace(".json", "");
        if (!this.artifactsMemory.has(artifactId)) {
          try {
            const content = JSON.parse(
              readFileSync(join(this.artifactsDir, file), "utf-8")
            ) as ResultArtifact;
            this.artifactsMemory.set(artifactId, content);
          } catch {
            // ignore
          }
        }
      }
    }

    return Array.from(this.artifactsMemory.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Saves experiment lineage.
   */
  public saveLineage(lineage: ExperimentLineage): void {
    this.lineageMemory.set(lineage.runId, lineage);

    if (!this.inMemoryOnly) {
      this.ensureDirectories();
      const filePath = join(this.lineageDir, `${lineage.runId}.json`);
      writeFileSync(filePath, JSON.stringify(lineage, null, 2), "utf-8");
    }
  }

  /**
   * Retrieves experiment lineage by run ID.
   */
  public getLineage(runId: string): ExperimentLineage | null {
    if (this.lineageMemory.has(runId)) {
      return this.lineageMemory.get(runId)!;
    }

    if (!this.inMemoryOnly) {
      const filePath = join(this.lineageDir, `${runId}.json`);
      if (existsSync(filePath)) {
        try {
          const content = JSON.parse(readFileSync(filePath, "utf-8")) as ExperimentLineage;
          this.lineageMemory.set(runId, content);
          return content;
        } catch {
          return null;
        }
      }
    }

    return null;
  }
}

export const defaultExperimentRepository = new ExperimentRepository();
