/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 8B — Scheduled Daily Ingestion Orchestrator
 *
 * Coordinates the full operational lifecycle of scheduled and manual daily ingestion:
 * 1. Enforces strict DEV environment isolation (8B.16)
 * 2. Generates deterministic operational run identity (8B.5)
 * 3. Enforces single-flight concurrency lock (8B.4)
 * 4. Executes the proven DailyIngestionEngine (8B.11)
 * 5. Classifies failures against the canonical 8B.8 failure taxonomy
 * 6. Records durable run audit state in Firestore repository (8B.9)
 * 7. Atomically releases lock on completion or failure
 */

import {
  ScheduledRunTrigger,
  RunStatus,
  FailureCategory,
  IngestionFailureError,
  IngestionRunRecord,
  ScheduledIngestionOrchestratorOptions,
  ScheduledRunExecutionResult
} from "./types";
import { IngestionLockManager, InMemoryIngestionLockManager } from "./concurrency-lock";
import { IngestionRunRepository, InMemoryIngestionRunRepository } from "./run-repository";
import { assertDevEnvironment } from "./environment-guard";
import { DailyIngestionEngine, DailyIngestionOptions, DailyIngestionResult } from "../daily-ingestion-engine";
import { calculateNextScheduledExecution } from "./health";

export interface ScheduledIngestionOrchestratorDependencies {
  lockManager?: IngestionLockManager;
  runRepository?: IngestionRunRepository;
  engineFactory?: (options?: DailyIngestionOptions) => DailyIngestionEngine;
}

export class ScheduledIngestionOrchestrator {
  private readonly lockManager: IngestionLockManager;
  private readonly runRepository: IngestionRunRepository;
  private readonly engineFactory: (options?: DailyIngestionOptions) => DailyIngestionEngine;

  constructor(deps?: ScheduledIngestionOrchestratorDependencies) {
    this.lockManager = deps?.lockManager ?? new InMemoryIngestionLockManager();
    this.runRepository = deps?.runRepository ?? new InMemoryIngestionRunRepository();
    this.engineFactory = deps?.engineFactory ?? ((opts) => new DailyIngestionEngine(opts));
  }

  /**
   * Executes a scheduled or manually triggered daily ingestion operation.
   */
  public async execute(
    trigger: ScheduledRunTrigger = "SCHEDULED",
    options?: ScheduledIngestionOrchestratorOptions & DailyIngestionOptions
  ): Promise<ScheduledRunExecutionResult> {
    const requestedAt = new Date().toISOString();
    const dryRun = options?.dryRun ?? false;
    const environment = options?.environment ?? "DEV";
    const lockTtlSeconds = options?.lockTtlSeconds ?? 900;

    // 1. Environment Safety Guard (Requirement 8B.16)
    try {
      assertDevEnvironment({
        projectId: options?.projectId,
        environment,
        allowOffline: options?.allowOffline
      });
    } catch (envErr: unknown) {
      const runId = `run_${trigger.toLowerCase()}_failed_env_${Date.now()}`;
      const failError =
        envErr instanceof IngestionFailureError
          ? envErr
          : new IngestionFailureError("CONFIGURATION_FAILURE", String(envErr));

      const failedRecord: IngestionRunRecord = {
        runId,
        environment,
        trigger,
        requestedAt,
        startedAt: requestedAt,
        completedAt: new Date().toISOString(),
        status: "FAILED",
        dryRun,
        candidateCount: 0,
        alreadyKnownCount: 0,
        downloadedCount: 0,
        validatedCount: 0,
        ingestedCount: 0,
        promotedCount: 0,
        rejectedCount: 0,
        conflictCount: 0,
        errorCount: 1,
        failureCategory: failError.category,
        failureSummary: failError.message,
        candidates: []
      };

      await this.runRepository.createRun(failedRecord);

      return {
        runId,
        status: "FAILED",
        trigger,
        record: failedRecord,
        candidateCount: 0,
        alreadyKnownCount: 0,
        downloadedCount: 0,
        validatedCount: 0,
        ingestedCount: 0,
        promotedCount: 0,
        rejectedCount: 0,
        conflictCount: 0,
        errorCount: 1,
        failureSummary: failError.message,
        lockAcquired: false,
        skippedLocked: false,
        failureCategory: failError.category,
        failureMessage: failError.message
      };
    }

    // 2. Generate Deterministic Operational Run ID (Requirement 8B.5)
    const runTimestamp = requestedAt.replace(/[:.]/g, "-");
    const runSuffix = Math.random().toString(36).substring(2, 8);
    const runId = `run_${trigger.toLowerCase()}_${runTimestamp}_${runSuffix}`;

    // 3. Register initial QUEUED run state (Requirement 8B.6)
    const initialRecord: IngestionRunRecord = {
      runId,
      environment,
      trigger,
      requestedAt,
      status: "QUEUED",
      dryRun,
      candidateCount: 0,
      alreadyKnownCount: 0,
      downloadedCount: 0,
      validatedCount: 0,
      ingestedCount: 0,
      promotedCount: 0,
      rejectedCount: 0,
      conflictCount: 0,
      errorCount: 0,
      candidates: []
    };
    await this.runRepository.createRun(initialRecord);

    // 4. Concurrency Control: Single-Flight Lease Acquisition (Requirement 8B.4)
    let lockAcquired = false;
    if (!options?.forceBypassLock) {
      lockAcquired = await this.lockManager.acquireLock(runId, {
        ttlSeconds: lockTtlSeconds,
        environment
      });

      if (!lockAcquired) {
        const skippedRecord: IngestionRunRecord = {
          ...initialRecord,
          completedAt: new Date().toISOString(),
          status: "SKIPPED_LOCKED",
          failureCategory: "LOCK_FAILURE",
          failureSummary: `Concurrent execution locked: Another ingestion run currently holds active lease.`
        };
        await this.runRepository.updateRun(runId, skippedRecord);

        return {
          runId,
          status: "SKIPPED_LOCKED",
          trigger,
          record: skippedRecord,
          candidateCount: 0,
          alreadyKnownCount: 0,
          downloadedCount: 0,
          validatedCount: 0,
          ingestedCount: 0,
          promotedCount: 0,
          rejectedCount: 0,
          conflictCount: 0,
          errorCount: 0,
          failureSummary: skippedRecord.failureSummary,
          lockAcquired: false,
          skippedLocked: true,
          failureCategory: "LOCK_FAILURE",
          failureMessage: skippedRecord.failureSummary
        };
      }
    } else {
      lockAcquired = true;
    }

    // 5. Execute Daily Ingestion Engine
    const startedAt = new Date().toISOString();
    await this.runRepository.updateRun(runId, {
      status: "RUNNING",
      startedAt
    });

    let engineResult: DailyIngestionResult | undefined;
    let finalStatus: RunStatus = "SUCCEEDED";
    let failureCategory: FailureCategory | undefined;
    let failureSummary: string | undefined;

    try {
      const engine = this.engineFactory({
        ...options,
        runId,
        dryRun
      });

      engineResult = await engine.execute();

      // Classify execution outcome
      if (!engineResult.success) {
        if (engineResult.summary.errors > 0 || engineResult.summary.conflicts > 0) {
          if (engineResult.summary.ingested > 0 || engineResult.summary.alreadyKnown > 0) {
            finalStatus = "PARTIAL_SUCCESS";
          } else {
            finalStatus = "FAILED";
          }
          failureCategory = engineResult.summary.conflicts > 0 ? "RESULT_VALIDATION_FAILURE" : "UNKNOWN_FAILURE";
          failureSummary = `Batch completed with ${engineResult.summary.errors} errors and ${engineResult.summary.conflicts} conflicts.`;
        } else {
          finalStatus = "FAILED";
          failureCategory = "PROMOTION_FAILURE";
          failureSummary = "Cross-document validation or downstream promotion failed.";
        }
      } else if (engineResult.summary.rejected > 0) {
        finalStatus = "PARTIAL_SUCCESS";
        failureSummary = `${engineResult.summary.rejected} candidate documents were rejected.`;
      } else {
        finalStatus = "SUCCEEDED";
      }
    } catch (execErr: unknown) {
      finalStatus = "FAILED";
      failureCategory = classifyError(execErr);
      failureSummary = execErr instanceof Error ? execErr.message : String(execErr);
    } finally {
      // 6. Release Single-Flight Lock
      if (lockAcquired && !options?.forceBypassLock) {
        try {
          await this.lockManager.releaseLock(runId);
        } catch {
          // Non-fatal
        }
      }
    }

    // 7. Update Durable Run Record (Requirement 8B.9)
    const completedAt = new Date().toISOString();
    const finalRecord: IngestionRunRecord = {
      runId,
      environment,
      trigger,
      requestedAt,
      startedAt,
      completedAt,
      status: finalStatus,
      dryRun,
      candidateCount: engineResult?.filesDiscovered ?? 0,
      alreadyKnownCount: engineResult?.summary.alreadyKnown ?? 0,
      downloadedCount: engineResult?.summary.downloaded ?? 0,
      validatedCount: engineResult?.summary.validated ?? 0,
      ingestedCount: engineResult?.summary.ingested ?? 0,
      promotedCount: engineResult?.summary.promoted ?? 0,
      rejectedCount: engineResult?.summary.rejected ?? 0,
      conflictCount: engineResult?.summary.conflicts ?? 0,
      errorCount: engineResult?.summary.errors ?? (finalStatus === "FAILED" ? 1 : 0),
      failureCategory,
      failureSummary,
      candidates: engineResult?.candidates ?? [],
      corpusSummary: engineResult?.corpus
        ? {
            id: engineResult.corpus.id,
            draws: engineResult.corpus.draws,
            results: engineResult.corpus.results,
            fullTicket: engineResult.corpus.fullTicket,
            suffix: engineResult.corpus.suffix
          }
        : undefined,
      nextScheduledExecution: calculateNextScheduledExecution()
    };

    await this.runRepository.updateRun(runId, finalRecord);

    return {
      runId,
      status: finalStatus,
      trigger,
      record: finalRecord,
      engineResult,
      candidateCount: finalRecord.candidateCount,
      alreadyKnownCount: finalRecord.alreadyKnownCount,
      downloadedCount: finalRecord.downloadedCount,
      validatedCount: finalRecord.validatedCount,
      ingestedCount: finalRecord.ingestedCount,
      promotedCount: finalRecord.promotedCount,
      rejectedCount: finalRecord.rejectedCount,
      conflictCount: finalRecord.conflictCount,
      errorCount: finalRecord.errorCount,
      failureSummary: finalRecord.failureSummary,
      lockAcquired,
      skippedLocked: false,
      failureCategory,
      failureMessage: failureSummary
    };
  }

  public getLockManager(): IngestionLockManager {
    return this.lockManager;
  }

  public getRunRepository(): IngestionRunRepository {
    return this.runRepository;
  }
}

/**
 * Classifies an unknown error into the 8B.8 FailureCategory taxonomy.
 */
export function classifyError(err: unknown): FailureCategory {
  if (err instanceof IngestionFailureError) {
    return err.category;
  }
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (msg.includes("lock") || msg.includes("lease") || msg.includes("concurrency")) {
    return "LOCK_FAILURE";
  }
  if (msg.includes("config") || msg.includes("environment") || msg.includes("project")) {
    return "CONFIGURATION_FAILURE";
  }
  if (msg.includes("portal") || msg.includes("discovery") || msg.includes("enotfound")) {
    return "SOURCE_DISCOVERY_FAILURE";
  }
  if (msg.includes("download") || msg.includes("fetch") || msg.includes("acquisition") || msg.includes("timeout")) {
    return "ACQUISITION_FAILURE";
  }
  if (msg.includes("pdf") || msg.includes("magic header") || msg.includes("corrupt")) {
    return "PDF_VALIDATION_FAILURE";
  }
  if (msg.includes("scheme") || msg.includes("authority")) {
    return "SCHEME_RESOLUTION_FAILURE";
  }
  if (msg.includes("prize") || msg.includes("result") || msg.includes("discrepancy")) {
    return "RESULT_VALIDATION_FAILURE";
  }
  if (msg.includes("storage") || msg.includes("firestore") || msg.includes("database")) {
    return "PERSISTENCE_FAILURE";
  }
  if (msg.includes("promotion") || msg.includes("corpus") || msg.includes("feature")) {
    return "PROMOTION_FAILURE";
  }
  return "UNKNOWN_FAILURE";
}
