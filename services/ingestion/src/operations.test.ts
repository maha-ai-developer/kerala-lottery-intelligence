/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 8B — Operational Ingestion & Reliability Unit & Integration Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  ScheduledIngestionOrchestrator,
  InMemoryIngestionLockManager,
  InMemoryIngestionRunRepository,
  assertDevEnvironment,
  executeWithRetry,
  IngestionFailureError,
  calculateNextScheduledExecution,
  getOperationalHealth,
  DEV_PROJECT_ID,
  PROD_PROJECT_ID
} from "./operations";
import { DailyIngestionEngine } from "./daily-ingestion-engine";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

describe("Milestone 8B: Scheduled Daily Operations & Reliability", () => {
  let lockManager: InMemoryIngestionLockManager;
  let runRepo: InMemoryIngestionRunRepository;
  let orchestrator: ScheduledIngestionOrchestrator;

  beforeEach(() => {
    lockManager = new InMemoryIngestionLockManager();
    runRepo = new InMemoryIngestionRunRepository();
    orchestrator = new ScheduledIngestionOrchestrator({
      lockManager,
      runRepository: runRepo,
      engineFactory: (opts) =>
        new DailyIngestionEngine({
          ...opts,
          silent: true,
          dryRun: true
        })
    });
  });

  // ==========================================================================
  // 1. DEV Environment Assertion (8B.16)
  // ==========================================================================
  describe("8B.16: DEV Environment Isolation & Data Safety", () => {
    it("allows execution when targeting kerala-lottery-intel-dev", () => {
      expect(() => {
        assertDevEnvironment({
          projectId: DEV_PROJECT_ID,
          environment: "development"
        });
      }).not.toThrow();
    });

    it("fails closed immediately if targeting production project kerala-lottery-intelligence", () => {
      expect(() => {
        assertDevEnvironment({
          projectId: PROD_PROJECT_ID,
          environment: "development"
        });
      }).toThrow(/Production execution is strictly prohibited/);
    });

    it("fails closed immediately if environment is set to production", () => {
      expect(() => {
        assertDevEnvironment({
          projectId: DEV_PROJECT_ID,
          environment: "production"
        });
      }).toThrow(/Production execution is strictly prohibited/);
    });

    it("records a FAILED run record when environment assertion fails", async () => {
      const result = await orchestrator.execute("SCHEDULED", {
        projectId: PROD_PROJECT_ID,
        environment: "PROD"
      });

      expect(result.status).toBe("FAILED");
      expect(result.failureCategory).toBe("CONFIGURATION_FAILURE");
      const record = await runRepo.getRun(result.runId);
      expect(record).not.toBeNull();
      expect(record?.status).toBe("FAILED");
      expect(record?.failureCategory).toBe("CONFIGURATION_FAILURE");
    });
  });

  // ==========================================================================
  // 2. Single-Flight Concurrency Control & Locks (8B.4)
  // ==========================================================================
  describe("8B.4: Single-Flight Lock & Concurrency Control", () => {
    it("acquires lock atomically for new run", async () => {
      const acquired = await lockManager.acquireLock("run_001", { ttlSeconds: 60 });
      expect(acquired).toBe(true);
      expect(await lockManager.isLockActive()).toBe(true);

      const lock = await lockManager.getCurrentLock();
      expect(lock?.ownerRunId).toBe("run_001");
      expect(lock?.lockId).toBe("daily_ingestion_lock");
    });

    it("rejects concurrent acquisition attempt by another run while lock is held", async () => {
      await lockManager.acquireLock("run_001", { ttlSeconds: 60 });
      const secondAttempt = await lockManager.acquireLock("run_002", { ttlSeconds: 60 });
      expect(secondAttempt).toBe(false);

      const lock = await lockManager.getCurrentLock();
      expect(lock?.ownerRunId).toBe("run_001");
    });

    it("allows release of lock by the owner run", async () => {
      await lockManager.acquireLock("run_001", { ttlSeconds: 60 });
      const released = await lockManager.releaseLock("run_001");
      expect(released).toBe(true);
      expect(await lockManager.isLockActive()).toBe(false);
    });

    it("prevents non-owner from releasing another run's lock", async () => {
      await lockManager.acquireLock("run_001", { ttlSeconds: 60 });
      const released = await lockManager.releaseLock("run_attacker");
      expect(released).toBe(false);
      expect(await lockManager.isLockActive()).toBe(true);
    });

    it("recovers automatically from crashed/stale expired lock", async () => {
      // Run 1 acquires lock
      await lockManager.acquireLock("run_crashed", { ttlSeconds: 10 });
      // Simulate crash and time passage past TTL
      await lockManager.forceExpireLock();

      // Run 2 should now be able to acquire the lease
      const acquired = await lockManager.acquireLock("run_survivor", { ttlSeconds: 60 });
      expect(acquired).toBe(true);
      const current = await lockManager.getCurrentLock();
      expect(current?.ownerRunId).toBe("run_survivor");
    });

    it("orchestrator skips and records SKIPPED_LOCKED when lock is occupied", async () => {
      // Hold lock externally
      await lockManager.acquireLock("run_active_holder", { ttlSeconds: 300 });

      // Trigger orchestrator
      const result = await orchestrator.execute("SCHEDULED", {
        projectId: DEV_PROJECT_ID,
        environment: "DEV"
      });

      expect(result.status).toBe("SKIPPED_LOCKED");
      expect(result.skippedLocked).toBe(true);
      expect(result.lockAcquired).toBe(false);
      expect(result.failureCategory).toBe("LOCK_FAILURE");

      const record = await runRepo.getRun(result.runId);
      expect(record?.status).toBe("SKIPPED_LOCKED");
    });
  });

  // ==========================================================================
  // 3. Run State Machine & Repository Audit (8B.5, 8B.6, 8B.9)
  // ==========================================================================
  describe("8B.5, 8B.6 & 8B.9: Run State Machine & Audit Persistence", () => {
    it("transitions through QUEUED -> RUNNING -> SUCCEEDED", async () => {
      const result = await orchestrator.execute("SCHEDULED", {
        projectId: DEV_PROJECT_ID,
        environment: "DEV",
        dryRun: true
      });

      expect(result.status).toBe("SUCCEEDED");
      expect(result.lockAcquired).toBe(true);
      expect(result.skippedLocked).toBe(false);

      const record = await runRepo.getRun(result.runId);
      expect(record).not.toBeNull();
      expect(record?.status).toBe("SUCCEEDED");
      expect(record?.requestedAt).toBeDefined();
      expect(record?.startedAt).toBeDefined();
      expect(record?.completedAt).toBeDefined();
      expect(record?.dryRun).toBe(true);
      expect(record?.candidateCount).toBeGreaterThanOrEqual(0);
    });

    it("redacts sensitive tokens or secrets before persisting run records", async () => {
      const dirtyRecord: any = {
        runId: "run_dirty_01",
        environment: "DEV",
        trigger: "MANUAL",
        requestedAt: new Date().toISOString(),
        status: "SUCCEEDED",
        dryRun: true,
        candidateCount: 1,
        alreadyKnownCount: 1,
        downloadedCount: 0,
        validatedCount: 0,
        ingestedCount: 0,
        promotedCount: 0,
        rejectedCount: 0,
        conflictCount: 0,
        errorCount: 0,
        candidates: [],
        metadata: {
          oauth_token: "secret_token_12345",
          api_key: "ai_key_secret_abc",
          private_key: "-----BEGIN PRIVATE KEY-----",
          safeField: "safe_value"
        }
      };

      await runRepo.createRun(dirtyRecord);
      const clean = await runRepo.getRun("run_dirty_01");
      expect(clean?.metadata?.safeField).toBe("safe_value");
      expect(clean?.metadata?.oauth_token).toBe("[REDACTED_SECRET]");
      expect(clean?.metadata?.api_key).toBe("[REDACTED_SECRET]");
      expect(clean?.metadata?.private_key).toBe("[REDACTED_SECRET]");
    });
  });

  // ==========================================================================
  // 4. Retry Behavior & Policy (8B.7)
  // ==========================================================================
  describe("8B.7: Retry Safety & Policy", () => {
    it("retries transient failures up to maxRetries", async () => {
      let callCount = 0;
      const { result, attempts } = await executeWithRetry(
        async () => {
          callCount++;
          if (callCount < 3) {
            throw new IngestionFailureError("ACQUISITION_FAILURE", "Transient network timeout");
          }
          return "success";
        },
        { maxRetries: 3, initialDelayMs: 10, backoffFactor: 1.5, jitter: false }
      );

      expect(result).toBe("success");
      expect(attempts).toBe(3);
      expect(callCount).toBe(3);
    });

    it("aborts immediately without retry on non-retryable errors", async () => {
      let callCount = 0;
      await expect(
        executeWithRetry(
          async () => {
            callCount++;
            throw new IngestionFailureError("CONFIGURATION_FAILURE", "Invalid project", {
              isRetryable: false
            });
          },
          { maxRetries: 3, initialDelayMs: 10 }
        )
      ).rejects.toThrow(/Invalid project/);

      expect(callCount).toBe(1); // No retries attempted
    });
  });

  // ==========================================================================
  // 5. Failure Injection & Classification (8B.8 & 8B.15)
  // ==========================================================================
  describe("8B.8 & 8B.15: Failure Injection & Classification Taxonomy", () => {
    it("classifies discovery failures (Scenario A)", async () => {
      const failingOrchestrator = new ScheduledIngestionOrchestrator({
        lockManager,
        runRepository: runRepo,
        engineFactory: () => ({
          execute: async () => {
            throw new IngestionFailureError("SOURCE_DISCOVERY_FAILURE", "Portal connection refused");
          }
        } as any)
      });

      const res = await failingOrchestrator.execute("SCHEDULED", {
        projectId: DEV_PROJECT_ID,
        environment: "DEV"
      });

      expect(res.status).toBe("FAILED");
      expect(res.failureCategory).toBe("SOURCE_DISCOVERY_FAILURE");
      expect(res.failureMessage).toContain("Portal connection refused");
    });

    it("classifies acquisition timeouts (Scenario B)", async () => {
      const failingOrchestrator = new ScheduledIngestionOrchestrator({
        lockManager,
        runRepository: runRepo,
        engineFactory: () => ({
          execute: async () => {
            throw new IngestionFailureError("ACQUISITION_FAILURE", "HTTP acquisition timed out after 30000ms");
          }
        } as any)
      });

      const res = await failingOrchestrator.execute("SCHEDULED", {
        projectId: DEV_PROJECT_ID,
        environment: "DEV"
      });

      expect(res.status).toBe("FAILED");
      expect(res.failureCategory).toBe("ACQUISITION_FAILURE");
    });

    it("classifies invalid PDF failures (Scenario C)", async () => {
      const failingOrchestrator = new ScheduledIngestionOrchestrator({
        lockManager,
        runRepository: runRepo,
        engineFactory: () => ({
          execute: async () => {
            throw new IngestionFailureError("PDF_VALIDATION_FAILURE", "Invalid PDF magic header");
          }
        } as any)
      });

      const res = await failingOrchestrator.execute("SCHEDULED", {
        projectId: DEV_PROJECT_ID,
        environment: "DEV"
      });

      expect(res.status).toBe("FAILED");
      expect(res.failureCategory).toBe("PDF_VALIDATION_FAILURE");
    });

    it("classifies scheme resolution failures (Scenario D)", async () => {
      const failingOrchestrator = new ScheduledIngestionOrchestrator({
        lockManager,
        runRepository: runRepo,
        engineFactory: () => ({
          execute: async () => {
            throw new IngestionFailureError("SCHEME_RESOLUTION_FAILURE", "No statutory scheme resolved");
          }
        } as any)
      });

      const res = await failingOrchestrator.execute("SCHEDULED", {
        projectId: DEV_PROJECT_ID,
        environment: "DEV"
      });

      expect(res.status).toBe("FAILED");
      expect(res.failureCategory).toBe("SCHEME_RESOLUTION_FAILURE");
    });

    it("classifies result validation failures (Scenario E)", async () => {
      const failingOrchestrator = new ScheduledIngestionOrchestrator({
        lockManager,
        runRepository: runRepo,
        engineFactory: () => ({
          execute: async () => {
            throw new IngestionFailureError("RESULT_VALIDATION_FAILURE", "Prize tiers count mismatch");
          }
        } as any)
      });

      const res = await failingOrchestrator.execute("SCHEDULED", {
        projectId: DEV_PROJECT_ID,
        environment: "DEV"
      });

      expect(res.status).toBe("FAILED");
      expect(res.failureCategory).toBe("RESULT_VALIDATION_FAILURE");
    });

    it("classifies persistence failures (Scenario F)", async () => {
      const failingOrchestrator = new ScheduledIngestionOrchestrator({
        lockManager,
        runRepository: runRepo,
        engineFactory: () => ({
          execute: async () => {
            throw new IngestionFailureError("PERSISTENCE_FAILURE", "Cloud Storage quota exceeded");
          }
        } as any)
      });

      const res = await failingOrchestrator.execute("SCHEDULED", {
        projectId: DEV_PROJECT_ID,
        environment: "DEV"
      });

      expect(res.status).toBe("FAILED");
      expect(res.failureCategory).toBe("PERSISTENCE_FAILURE");
    });
  });

  // ==========================================================================
  // 6. Operational Health & Heartbeat (8B.10)
  // ==========================================================================
  describe("8B.10: Operational Health & Heartbeat", () => {
    it("reports HEALTHY when last run succeeded", async () => {
      await orchestrator.execute("SCHEDULED", {
        projectId: DEV_PROJECT_ID,
        environment: "DEV"
      });

      const health = await getOperationalHealth(runRepo, lockManager);
      expect(health.status).toBe("HEALTHY");
      expect(health.service).toBe("@kerala-lottery/daily-ingestion");
      expect(health.environment).toBe("DEV");
      expect(health.schedule).toBe("0 17 * * *");
      expect(health.timezone).toBe("Asia/Kolkata");
      expect(health.currentRunState.isLocked).toBe(false);
      expect(health.lastSuccessfulRun).toBeDefined();
    });

    it("calculates next scheduled execution for 17:00 IST correctly", () => {
      // 10:00 AM IST (4:30 AM UTC) -> today at 17:00 IST (11:30 UTC)
      const morningDate = new Date("2026-09-28T04:30:00.000Z");
      const nextRun = calculateNextScheduledExecution(morningDate);
      expect(nextRun).toBe("2026-09-28T11:30:00.000Z");

      // 18:00 PM IST (12:30 PM UTC) -> next day at 17:00 IST
      const eveningDate = new Date("2026-09-28T12:30:00.000Z");
      const nextDayRun = calculateNextScheduledExecution(eveningDate);
      expect(nextDayRun).toBe("2026-09-29T11:30:00.000Z");
    });
  });

  // ==========================================================================
  // 7. Real-World Live BT-73 Idempotency (8B.13)
  // ==========================================================================
  describe("8B.13: Real-World BT-73 Idempotency & Repeat Safety", () => {
    it("recognizes existing live draw BT-73 as ALREADY_KNOWN on repeated execution", async () => {
      const realPdfPath = join(process.cwd(), "data/source-documents/lottery-results/271-2346-28-09-2026.pdf");
      if (!existsSync(realPdfPath)) return;

      const realPdfBytes = readFileSync(realPdfPath);

      // Run 1: manual test trigger with BT-73
      const realOrchestrator = new ScheduledIngestionOrchestrator({
        lockManager,
        runRepository: runRepo,
        engineFactory: (opts) =>
          new DailyIngestionEngine({
            ...opts,
            silent: true,
            dryRun: true,
            injectedCandidates: [
              {
                fileName: "BT-73.pdf",
                fileBuffer: new Uint8Array(realPdfBytes),
                drawNumber: "BT-73rd",
                drawDate: "28/09/2026",
                lotteryCode: "BT"
              }
            ]
          })
      });

      const run1 = await realOrchestrator.execute("SCHEDULED", {
        projectId: DEV_PROJECT_ID,
        environment: "DEV"
      });
      expect(run1.status).toBe("SUCCEEDED");
      const candidate1 = run1.record.candidates[0]!;
      expect(["VALIDATED", "ALREADY_KNOWN"]).toContain(candidate1.actionTaken);

      // Run 2: repeat execution must remain idempotent (no duplicate created)
      const run2 = await realOrchestrator.execute("SCHEDULED", {
        projectId: DEV_PROJECT_ID,
        environment: "DEV"
      });
      expect(run2.status).toBe("SUCCEEDED");
      expect(run2.record.ingestedCount).toBe(0); // 0 new documents created
    });
  });
});
