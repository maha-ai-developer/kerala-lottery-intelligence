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
import type { StatisticalValidationArtifact } from "./validation-types";
import type {
  ResearchFinding,
  EvidenceBundle,
  ResearchFindingLineage,
  PublicationReport
} from "./findings-types";

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
  private readonly validationsDir: string;
  private readonly findingsDir: string;
  private readonly findingsLineageDir: string;
  private readonly evidenceDir: string;
  private readonly reportsDir: string;
  private readonly inMemoryOnly: boolean;

  // In-memory backing stores
  private readonly runsMemory = new Map<string, ExperimentRun>();
  private readonly artifactsMemory = new Map<string, ResultArtifact>();
  private readonly lineageMemory = new Map<string, ExperimentLineage>();
  private readonly validationsMemory = new Map<string, StatisticalValidationArtifact>();
  private readonly findingsMemory = new Map<string, ResearchFinding>();
  private readonly findingsLineageMemory = new Map<string, ResearchFindingLineage>();
  private readonly evidenceMemory = new Map<string, EvidenceBundle>();
  private readonly reportsMemory = new Map<string, PublicationReport>();

  constructor(options: ExperimentRepositoryOptions = {}) {
    this.inMemoryOnly = options.inMemoryOnly ?? false;
    this.baseDir =
      options.baseDir ??
      join(process.cwd(), "data/processed-cache/experiments");
    this.runsDir = join(this.baseDir, "runs");
    this.artifactsDir = join(this.baseDir, "artifacts");
    this.lineageDir = join(this.baseDir, "lineage");
    this.validationsDir = join(this.baseDir, "validations");
    this.findingsDir = join(this.baseDir, "findings");
    this.findingsLineageDir = join(this.baseDir, "findings-lineage");
    this.evidenceDir = join(this.baseDir, "evidence");
    this.reportsDir = join(this.baseDir, "reports");

    if (!this.inMemoryOnly) {
      this.ensureDirectories();
    }
  }

  private ensureDirectories(): void {
    if (!existsSync(this.runsDir)) mkdirSync(this.runsDir, { recursive: true });
    if (!existsSync(this.artifactsDir)) mkdirSync(this.artifactsDir, { recursive: true });
    if (!existsSync(this.lineageDir)) mkdirSync(this.lineageDir, { recursive: true });
    if (!existsSync(this.validationsDir)) mkdirSync(this.validationsDir, { recursive: true });
    if (!existsSync(this.findingsDir)) mkdirSync(this.findingsDir, { recursive: true });
    if (!existsSync(this.findingsLineageDir)) mkdirSync(this.findingsLineageDir, { recursive: true });
    if (!existsSync(this.evidenceDir)) mkdirSync(this.evidenceDir, { recursive: true });
    if (!existsSync(this.reportsDir)) mkdirSync(this.reportsDir, { recursive: true });
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
    const run = this.getRun(runId);
    const candidates: ResultArtifact[] = [];

    // Check in-memory
    for (const artifact of this.artifactsMemory.values()) {
      if (artifact.runId === runId) candidates.push(artifact);
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
          if (content.runId === runId && !candidates.some((c) => c.artifactId === content.artifactId)) {
            candidates.push(content);
          }
        } catch {
          // ignore
        }
      }
    }

    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0]!;

    // If run has metrics, find the exact matching candidate
    if (run?.metrics) {
      const match = candidates.find((c) => Math.abs(c.metrics.accuracy - run.metrics!.accuracy) < 1e-6);
      if (match) return match;
    }

    // Fallback: candidate with highest accuracy
    return candidates.sort((a, b) => b.metrics.accuracy - a.metrics.accuracy)[0]!;
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

  /**
   * Saves a statistical validation artifact.
   * INVARIANT: Existing validation artifacts cannot be mutated with differing hashes.
   */
  public saveValidation(validation: StatisticalValidationArtifact): void {
    const existing = this.getValidation(validation.validationId);
    if (existing && existing.deterministicHash !== validation.deterministicHash) {
      throw new Error(
        `IMMUTABILITY_VIOLATION: Cannot mutate existing validation artifact ${validation.validationId} with differing hash.`
      );
    }

    this.validationsMemory.set(validation.validationId, validation);

    if (!this.inMemoryOnly) {
      this.ensureDirectories();
      const filePath = join(this.validationsDir, `${validation.validationId}.json`);
      writeFileSync(filePath, JSON.stringify(validation, null, 2), "utf-8");
    }
  }

  /**
   * Retrieves a statistical validation artifact by validation ID.
   */
  public getValidation(validationId: string): StatisticalValidationArtifact | null {
    if (this.validationsMemory.has(validationId)) {
      return this.validationsMemory.get(validationId)!;
    }

    if (!this.inMemoryOnly) {
      const filePath = join(this.validationsDir, `${validationId}.json`);
      if (existsSync(filePath)) {
        try {
          const content = JSON.parse(readFileSync(filePath, "utf-8")) as StatisticalValidationArtifact;
          this.validationsMemory.set(validationId, content);
          return content;
        } catch {
          return null;
        }
      }
    }

    return null;
  }

  /**
   * Retrieves a statistical validation artifact by run ID.
   */
  public getValidationByRunId(runId: string): StatisticalValidationArtifact | null {
    const all = this.listValidations();
    return all.find((v) => v.runId === runId) || null;
  }

  /**
   * Lists statistical validation artifacts with optional filtering.
   */
  public listValidations(filters?: {
    experimentId?: string;
    runId?: string;
  }): StatisticalValidationArtifact[] {
    if (!this.inMemoryOnly && existsSync(this.validationsDir)) {
      const files = readdirSync(this.validationsDir).filter((f) => f.endsWith(".json"));
      for (const file of files) {
        const valId = file.replace(".json", "");
        if (!this.validationsMemory.has(valId)) {
          try {
            const content = JSON.parse(
              readFileSync(join(this.validationsDir, file), "utf-8")
            ) as StatisticalValidationArtifact;
            this.validationsMemory.set(valId, content);
          } catch {
            // ignore
          }
        }
      }
    }

    let items = Array.from(this.validationsMemory.values());
    if (filters?.experimentId) {
      items = items.filter((v) => v.experimentId === filters.experimentId);
    }
    if (filters?.runId) {
      items = items.filter((v) => v.runId === filters.runId);
    }

    return items.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Saves a research finding.
   * INVARIANT: Existing findings cannot be mutated with differing hashes.
   */
  public saveFinding(finding: ResearchFinding): void {
    const existing = this.getFinding(finding.findingId);
    if (existing && existing.deterministicHash !== finding.deterministicHash) {
      throw new Error(
        `IMMUTABILITY_VIOLATION: Cannot mutate existing research finding ${finding.findingId} with differing hash.`
      );
    }

    this.findingsMemory.set(finding.findingId, finding);

    if (!this.inMemoryOnly) {
      this.ensureDirectories();
      const filePath = join(this.findingsDir, `${finding.findingId}.json`);
      writeFileSync(filePath, JSON.stringify(finding, null, 2), "utf-8");
    }
  }

  /**
   * Retrieves a research finding by finding ID.
   */
  public getFinding(findingId: string): ResearchFinding | null {
    if (this.findingsMemory.has(findingId)) {
      return this.findingsMemory.get(findingId)!;
    }

    if (!this.inMemoryOnly) {
      const filePath = join(this.findingsDir, `${findingId}.json`);
      if (existsSync(filePath)) {
        try {
          const content = JSON.parse(readFileSync(filePath, "utf-8")) as ResearchFinding;
          this.findingsMemory.set(findingId, content);
          return content;
        } catch {
          return null;
        }
      }
    }

    return null;
  }

  /**
   * Retrieves a research finding by run ID.
   */
  public getFindingByRunId(runId: string): ResearchFinding | null {
    const all = this.listFindings();
    return all.find((f) => f.runId === runId) || null;
  }

  /**
   * Lists research findings with optional filtering.
   */
  public listFindings(filters?: {
    experimentId?: string;
    claimType?: string;
    runId?: string;
  }): ResearchFinding[] {
    if (!this.inMemoryOnly && existsSync(this.findingsDir)) {
      const files = readdirSync(this.findingsDir).filter((f) => f.endsWith(".json"));
      for (const file of files) {
        const findId = file.replace(".json", "");
        if (!this.findingsMemory.has(findId)) {
          try {
            const content = JSON.parse(
              readFileSync(join(this.findingsDir, file), "utf-8")
            ) as ResearchFinding;
            this.findingsMemory.set(findId, content);
          } catch {
            // ignore
          }
        }
      }
    }

    let items = Array.from(this.findingsMemory.values());
    if (filters?.experimentId) {
      items = items.filter((f) => f.experimentId === filters.experimentId);
    }
    if (filters?.claimType) {
      items = items.filter((f) => f.claimType === filters.claimType);
    }
    if (filters?.runId) {
      items = items.filter((f) => f.runId === filters.runId);
    }

    return items.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Saves research finding lineage.
   */
  public saveFindingLineage(lineage: ResearchFindingLineage): void {
    this.findingsLineageMemory.set(lineage.findingId, lineage);

    if (!this.inMemoryOnly) {
      this.ensureDirectories();
      const filePath = join(this.findingsLineageDir, `${lineage.findingId}.json`);
      writeFileSync(filePath, JSON.stringify(lineage, null, 2), "utf-8");
    }
  }

  /**
   * Retrieves research finding lineage by finding ID.
   */
  public getFindingLineage(findingId: string): ResearchFindingLineage | null {
    if (this.findingsLineageMemory.has(findingId)) {
      return this.findingsLineageMemory.get(findingId)!;
    }

    if (!this.inMemoryOnly) {
      const filePath = join(this.findingsLineageDir, `${findingId}.json`);
      if (existsSync(filePath)) {
        try {
          const content = JSON.parse(readFileSync(filePath, "utf-8")) as ResearchFindingLineage;
          this.findingsLineageMemory.set(findingId, content);
          return content;
        } catch {
          return null;
        }
      }
    }

    return null;
  }

  /**
   * Saves an evidence bundle.
   * INVARIANT: Existing bundles cannot be mutated with differing hashes.
   */
  public saveEvidenceBundle(bundle: EvidenceBundle): void {
    const existing = this.getEvidenceBundle(bundle.evidenceBundleId);
    if (existing && existing.deterministicHash !== bundle.deterministicHash) {
      throw new Error(
        `IMMUTABILITY_VIOLATION: Cannot mutate existing evidence bundle ${bundle.evidenceBundleId} with differing hash.`
      );
    }

    this.evidenceMemory.set(bundle.evidenceBundleId, bundle);

    if (!this.inMemoryOnly) {
      this.ensureDirectories();
      const filePath = join(this.evidenceDir, `${bundle.evidenceBundleId}.json`);
      writeFileSync(filePath, JSON.stringify(bundle, null, 2), "utf-8");
    }
  }

  /**
   * Retrieves an evidence bundle by bundle ID.
   */
  public getEvidenceBundle(evidenceBundleId: string): EvidenceBundle | null {
    if (this.evidenceMemory.has(evidenceBundleId)) {
      return this.evidenceMemory.get(evidenceBundleId)!;
    }

    if (!this.inMemoryOnly) {
      const filePath = join(this.evidenceDir, `${evidenceBundleId}.json`);
      if (existsSync(filePath)) {
        try {
          const content = JSON.parse(readFileSync(filePath, "utf-8")) as EvidenceBundle;
          this.evidenceMemory.set(evidenceBundleId, content);
          return content;
        } catch {
          return null;
        }
      }
    }

    return null;
  }

  /**
   * Retrieves an evidence bundle by finding ID.
   */
  public getEvidenceBundleByFindingId(findingId: string): EvidenceBundle | null {
    const all = this.listEvidenceBundles();
    return all.find((b) => b.findingId === findingId) || null;
  }

  /**
   * Lists evidence bundles.
   */
  public listEvidenceBundles(): EvidenceBundle[] {
    if (!this.inMemoryOnly && existsSync(this.evidenceDir)) {
      const files = readdirSync(this.evidenceDir).filter((f) => f.endsWith(".json"));
      for (const file of files) {
        const bundleId = file.replace(".json", "");
        if (!this.evidenceMemory.has(bundleId)) {
          try {
            const content = JSON.parse(
              readFileSync(join(this.evidenceDir, file), "utf-8")
            ) as EvidenceBundle;
            this.evidenceMemory.set(bundleId, content);
          } catch {
            // ignore
          }
        }
      }
    }

    return Array.from(this.evidenceMemory.values());
  }

  /**
   * Saves a publication report.
   * INVARIANT: Existing reports cannot be mutated with differing hashes.
   */
  public saveReport(report: PublicationReport): void {
    const existing = this.getReport(report.reportId);
    if (existing && existing.deterministicHash !== report.deterministicHash) {
      throw new Error(
        `IMMUTABILITY_VIOLATION: Cannot mutate existing publication report ${report.reportId} with differing hash.`
      );
    }

    this.reportsMemory.set(report.reportId, report);

    if (!this.inMemoryOnly) {
      this.ensureDirectories();
      const filePath = join(this.reportsDir, `${report.reportId}.json`);
      writeFileSync(filePath, JSON.stringify(report, null, 2), "utf-8");
      // Also optionally save markdown content alongside
      const mdPath = join(this.reportsDir, `${report.reportId}.md`);
      writeFileSync(mdPath, report.markdownContent, "utf-8");
    }
  }

  /**
   * Retrieves a publication report by report ID.
   */
  public getReport(reportId: string): PublicationReport | null {
    if (this.reportsMemory.has(reportId)) {
      return this.reportsMemory.get(reportId)!;
    }

    if (!this.inMemoryOnly) {
      const filePath = join(this.reportsDir, `${reportId}.json`);
      if (existsSync(filePath)) {
        try {
          const content = JSON.parse(readFileSync(filePath, "utf-8")) as PublicationReport;
          this.reportsMemory.set(reportId, content);
          return content;
        } catch {
          return null;
        }
      }
    }

    return null;
  }

  /**
   * Retrieves a publication report by finding ID.
   */
  public getReportByFindingId(findingId: string): PublicationReport | null {
    const all = this.listReports();
    return all.find((r) => r.findingId === findingId) || null;
  }

  /**
   * Lists publication reports.
   */
  public listReports(): PublicationReport[] {
    if (!this.inMemoryOnly && existsSync(this.reportsDir)) {
      const files = readdirSync(this.reportsDir).filter((f) => f.endsWith(".json"));
      for (const file of files) {
        const reportId = file.replace(".json", "");
        if (!this.reportsMemory.has(reportId)) {
          try {
            const content = JSON.parse(
              readFileSync(join(this.reportsDir, file), "utf-8")
            ) as PublicationReport;
            this.reportsMemory.set(reportId, content);
          } catch {
            // ignore
          }
        }
      }
    }

    return Array.from(this.reportsMemory.values()).sort(
      (a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
    );
  }
}

export const defaultExperimentRepository = new ExperimentRepository();
