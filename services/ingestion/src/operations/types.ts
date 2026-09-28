/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 8B — Scheduled Daily Operations Runtime Contracts & Types
 *
 * Operational reliability contracts for scheduled DEV execution.
 * Preserves strict descriptive-only scientific benchmarking boundaries.
 */

import type { CandidateAuditRecord, DailyIngestionResult } from "../daily-ingestion-engine";

// ============================================================================
// 1. Run Triggers & Execution Identifiers
// ============================================================================

export type ScheduledRunTrigger = "SCHEDULED" | "MANUAL" | "TEST";

export type RunStatus =
  | "QUEUED"
  | "RUNNING"
  | "SUCCEEDED"
  | "PARTIAL_SUCCESS"
  | "FAILED"
  | "SKIPPED_LOCKED";

// ============================================================================
// 2. Canonical Failure Taxonomy (Requirement 8B.8)
// ============================================================================

export type FailureCategory =
  | "SOURCE_DISCOVERY_FAILURE"
  | "ACQUISITION_FAILURE"
  | "PDF_VALIDATION_FAILURE"
  | "SCHEME_RESOLUTION_FAILURE"
  | "RESULT_VALIDATION_FAILURE"
  | "PERSISTENCE_FAILURE"
  | "PROMOTION_FAILURE"
  | "LOCK_FAILURE"
  | "CONFIGURATION_FAILURE"
  | "UNKNOWN_FAILURE";

export class IngestionFailureError extends Error {
  public readonly category: FailureCategory;
  public readonly isRetryable: boolean;
  public readonly details?: Record<string, unknown>;
  public readonly causeError?: Error;

  constructor(
    category: FailureCategory,
    message: string,
    options?: {
      isRetryable?: boolean;
      details?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(`[${category}] ${message}`);
    this.name = "IngestionFailureError";
    this.category = category;
    this.isRetryable = options?.isRetryable ?? isCategoryRetryable(category);
    this.details = options?.details;
    this.causeError = options?.cause;
    if (options?.cause && options.cause.stack) {
      this.stack = `${this.stack}\nCaused by: ${options.cause.stack}`;
    }
  }
}

export function isCategoryRetryable(category: FailureCategory): boolean {
  switch (category) {
    case "SOURCE_DISCOVERY_FAILURE":
    case "ACQUISITION_FAILURE":
      return true;
    case "PDF_VALIDATION_FAILURE":
    case "SCHEME_RESOLUTION_FAILURE":
    case "RESULT_VALIDATION_FAILURE":
    case "LOCK_FAILURE":
    case "CONFIGURATION_FAILURE":
    case "PERSISTENCE_FAILURE":
    case "PROMOTION_FAILURE":
    case "UNKNOWN_FAILURE":
    default:
      return false;
  }
}

// ============================================================================
// 3. Durable Run Audit Record (Requirement 8B.5, 8B.6, 8B.9)
// ============================================================================

export interface IngestionRunRecord {
  runId: string;
  environment: "DEV" | "PROD";
  trigger: ScheduledRunTrigger;
  requestedAt: string; // ISO 8601
  startedAt?: string;  // ISO 8601
  completedAt?: string; // ISO 8601
  status: RunStatus;
  dryRun: boolean;

  // Execution Summary Counts
  candidateCount: number;
  alreadyKnownCount: number;
  downloadedCount: number;
  validatedCount: number;
  ingestedCount: number;
  promotedCount: number;
  rejectedCount: number;
  conflictCount: number;
  errorCount: number;

  // Failure metadata (if any)
  failureCategory?: FailureCategory;
  failureSummary?: string;

  // Candidate Level Audit Breakdown
  candidates: CandidateAuditRecord[];

  // Downstream Corpus Snapshot
  corpusSummary?: {
    id: string;
    draws: number;
    results: number;
    fullTicket: number;
    suffix: number;
  };

  // Observability & Metadata
  nextScheduledExecution?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// 4. Single-Flight Concurrency Lease/Lock Record (Requirement 8B.4)
// ============================================================================

export interface IngestionLockRecord {
  lockId: string;
  ownerRunId: string;
  acquiredAt: string; // ISO 8601
  expiresAt: string;  // ISO 8601
  ttlSeconds: number;
  renewedAt?: string;
  environment: "DEV" | "PROD";
}

// ============================================================================
// 5. Operational Health & Heartbeat Status (Requirement 8B.10)
// ============================================================================

export interface OperationalHealthStatus {
  status: "HEALTHY" | "DEGRADED" | "UNHEALTHY";
  service: string;
  environment: "DEV" | "PROD";
  schedule: string;
  timezone: string;
  nextScheduledExecution: string;
  currentRunState: {
    isLocked: boolean;
    currentRunId?: string;
    lockExpiresAt?: string;
  };
  lastSuccessfulRun?: {
    runId: string;
    completedAt: string;
    drawsCount: number;
    resultsCount: number;
  };
  lastAttemptedRun?: {
    runId: string;
    startedAt: string;
    status: RunStatus;
  };
  lastFailure?: {
    runId: string;
    failedAt: string;
    failureCategory: FailureCategory;
    failureSummary: string;
  };
  evaluatedAt: string;
}

// ============================================================================
// 6. Orchestration Options & Result
// ============================================================================

export interface ScheduledIngestionOrchestratorOptions {
  environment?: "DEV" | "PROD";
  projectId?: string;
  lockTtlSeconds?: number;
  dryRun?: boolean;
  verbose?: boolean;
  since?: string;
  limit?: number;
  allowOffline?: boolean;
  forceBypassLock?: boolean;
}

export interface ScheduledRunExecutionResult {
  runId: string;
  status: RunStatus;
  trigger: ScheduledRunTrigger;
  record: IngestionRunRecord;
  engineResult?: DailyIngestionResult;
  candidateCount?: number;
  alreadyKnownCount?: number;
  downloadedCount?: number;
  validatedCount?: number;
  ingestedCount?: number;
  promotedCount?: number;
  rejectedCount?: number;
  conflictCount?: number;
  errorCount?: number;
  failureSummary?: string | null;
  lockAcquired: boolean;
  skippedLocked: boolean;
  failureCategory?: FailureCategory;
  failureMessage?: string;
}
