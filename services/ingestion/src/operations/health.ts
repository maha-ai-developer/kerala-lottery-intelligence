/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 8B — Operational Health & Heartbeat Status
 *
 * Provides operational visibility into ingestion reliability, locks,
 * last success/failure timestamps, and upcoming scheduled executions.
 */

import { OperationalHealthStatus } from "./types";
import { IngestionRunRepository } from "./run-repository";
import { IngestionLockManager } from "./concurrency-lock";

export const DEFAULT_SCHEDULE_CRON = "0 17 * * *";
export const DEFAULT_SCHEDULE_TIMEZONE = "Asia/Kolkata";

/**
 * Calculates the next scheduled execution timestamp for 17:00 IST (Asia/Kolkata).
 * Supports both:
 * - calculateNextScheduledExecution(now?: Date, timezone?: string)
 * - calculateNextScheduledExecution(schedule?: string, timezone?: string, now?: Date)
 */
export function calculateNextScheduledExecution(
  scheduleOrNow?: string | Date,
  _timezoneOrNow?: string | Date,
  nowArg?: Date
): string {
  let now: Date = new Date();

  if (typeof scheduleOrNow === "string") {
    // scheduleOrNow is cron string e.g. "0 17 * * *"
    if (nowArg instanceof Date) {
      now = nowArg;
    }
  } else if (scheduleOrNow instanceof Date) {
    now = scheduleOrNow;
  }

  // IST is UTC+5:30 (330 minutes)
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffsetMs);

  const istYear = istNow.getUTCFullYear();
  const istMonth = istNow.getUTCMonth();
  const istDate = istNow.getUTCDate();
  const istHours = istNow.getUTCHours();
  const istMinutes = istNow.getUTCMinutes();

  let nextIstDate = istDate;
  // If current IST time is on or after 17:00, schedule for next day
  if (istHours > 17 || (istHours === 17 && istMinutes >= 0)) {
    nextIstDate += 1;
  }

  // Construct target 17:00:00 IST
  const targetIst = new Date(Date.UTC(istYear, istMonth, nextIstDate, 17, 0, 0, 0));
  // Convert back to UTC ISO string
  const targetUtc = new Date(targetIst.getTime() - istOffsetMs);
  return targetUtc.toISOString();
}

/**
 * Derives the system health and heartbeat record from current repository and lock states.
 */
export async function getOperationalHealth(
  runRepo: IngestionRunRepository,
  lockManager: IngestionLockManager,
  options?: {
    environment?: "DEV" | "PROD";
    now?: Date;
  }
): Promise<OperationalHealthStatus> {
  const environment = options?.environment ?? "DEV";
  const now = options?.now ?? new Date();

  const currentLock = await lockManager.getCurrentLock();
  const lastSuccess = await runRepo.getLastSuccessfulRun();
  const lastAttempt = await runRepo.getLastAttemptedRun();

  // Find last failure
  const recentRuns = await runRepo.listRuns(10);
  const lastFailureRecord = recentRuns.find((r) => r.status === "FAILED");

  // Determine overall status
  let status: "HEALTHY" | "DEGRADED" | "UNHEALTHY" = "HEALTHY";
  if (lastAttempt && lastAttempt.status === "FAILED") {
    status = "DEGRADED";
  }
  if (recentRuns.length >= 3 && recentRuns.slice(0, 3).every((r) => r.status === "FAILED")) {
    status = "UNHEALTHY";
  }

  return {
    status,
    service: "@kerala-lottery/daily-ingestion",
    environment,
    schedule: DEFAULT_SCHEDULE_CRON,
    timezone: DEFAULT_SCHEDULE_TIMEZONE,
    nextScheduledExecution: calculateNextScheduledExecution(now),
    currentRunState: {
      isLocked: currentLock !== null,
      currentRunId: currentLock?.ownerRunId,
      lockExpiresAt: currentLock?.expiresAt
    },
    lastSuccessfulRun: lastSuccess
      ? {
          runId: lastSuccess.runId,
          completedAt: lastSuccess.completedAt || lastSuccess.requestedAt,
          drawsCount: lastSuccess.corpusSummary?.draws ?? 0,
          resultsCount: lastSuccess.corpusSummary?.results ?? 0
        }
      : undefined,
    lastAttemptedRun: lastAttempt
      ? {
          runId: lastAttempt.runId,
          startedAt: lastAttempt.startedAt || lastAttempt.requestedAt,
          status: lastAttempt.status
        }
      : undefined,
    lastFailure: lastFailureRecord
      ? {
          runId: lastFailureRecord.runId,
          failedAt: lastFailureRecord.completedAt || lastFailureRecord.requestedAt,
          failureCategory: lastFailureRecord.failureCategory || "UNKNOWN_FAILURE",
          failureSummary: lastFailureRecord.failureSummary || "Unknown execution failure"
        }
      : undefined,
    evaluatedAt: now.toISOString()
  };
}
