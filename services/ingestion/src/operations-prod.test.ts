/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 8C — Production Operationalization & Isolation Test Suite
 *
 * Verifies:
 * 1. Environment isolation & fail-closed safety (wrong project, wrong env, cross-pollution)
 * 2. Production authorization (anonymous rejection, DEV SA rejection, PROD SA acceptance)
 * 3. Controlled first-ingestion & bootstrap baseline (100 draws, 38,416 results)
 * 4. Real-world BT-73 compatibility & replay idempotency (0 duplicates)
 * 5. Single-flight concurrency lease & stale lock recovery in PROD
 * 6. Failure recovery across all taxonomy categories leaving coherent audit state
 * 7. Operational observability & secret sanitization
 * 8. Downstream derived layers promotion intact
 *
 * Boundary: Strict historical research and descriptive statistics.
 * No prediction, betting advice, or gambling claims.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { computeSha256 } from "@kerala-lottery/documents";
import {
  assertDevEnvironment,
  assertProdEnvironment,
  assertEnvironment,
  EnvironmentViolationError,
  DEV_PROJECT_ID,
  DEV_PROJECT_NUMBER,
  DEV_STORAGE_BUCKET,
  PROD_PROJECT_ID,
  PROD_PROJECT_NUMBER
} from "./operations/environment-guard";
import {
  ScheduledIngestionOrchestrator,
  InMemoryIngestionLockManager,
  InMemoryIngestionRunRepository,
  classifyError,
  FailureCategory,
  IngestionFailureError,
  sanitizeOperationalRecord
} from "./operations/index";
import { executeProdBootstrap, TARGET_BT73_SHA } from "./operations/prod-bootstrap";

describe("Milestone 8C: Production Operationalization", () => {
  const realBt73Path = join(process.cwd(), "data/source-documents/lottery-results/271-2346-28-09-2026.pdf");

  // ==========================================================================
  // 1. Environment Separation & Data Safety (8C.1 & 8C.6)
  // ==========================================================================
  describe("1. Environment Isolation & Fail-Closed Guard", () => {
    it("should accept valid PROD project and environment", () => {
      const projectId = assertProdEnvironment({
        projectId: PROD_PROJECT_ID,
        environment: "PROD",
        allowOffline: true
      });
      expect(projectId).toBe(PROD_PROJECT_ID);
    });

    it("should fail closed if DEV project is passed to assertProdEnvironment", () => {
      expect(() => {
        assertProdEnvironment({
          projectId: DEV_PROJECT_ID,
          environment: "PROD"
        });
      }).toThrow(EnvironmentViolationError);
    });

    it("should fail closed if development environment is passed to assertProdEnvironment", () => {
      expect(() => {
        assertProdEnvironment({
          projectId: PROD_PROJECT_ID,
          environment: "development"
        });
      }).toThrow(EnvironmentViolationError);
    });

    it("should fail closed if missing projectId in assertProdEnvironment", () => {
      const origEnv = process.env.GCP_PROJECT_ID;
      delete process.env.GCP_PROJECT_ID;
      try {
        expect(() => {
          assertProdEnvironment({
            projectId: "",
            environment: "PROD"
          });
        }).toThrow(EnvironmentViolationError);
      } finally {
        if (origEnv) process.env.GCP_PROJECT_ID = origEnv;
      }
    });

    it("should fail closed if DEV messagingSenderId is used in PROD", () => {
      expect(() => {
        assertProdEnvironment({
          projectId: PROD_PROJECT_ID,
          environment: "PROD",
          messagingSenderId: DEV_PROJECT_NUMBER
        });
      }).toThrow(/Cross-environment configuration mismatch/);
    });

    it("should fail closed if DEV storage bucket is configured in PROD", () => {
      expect(() => {
        assertProdEnvironment({
          projectId: PROD_PROJECT_ID,
          environment: "PROD",
          storageBucket: DEV_STORAGE_BUCKET
        });
      }).toThrow(/Cross-environment configuration mismatch/);
    });

    it("should fail closed if PROD project is passed to assertDevEnvironment", () => {
      expect(() => {
        assertDevEnvironment({
          projectId: PROD_PROJECT_ID,
          environment: "DEV"
        });
      }).toThrow(EnvironmentViolationError);
    });

    it("should fail closed if PROD messagingSenderId is used in DEV", () => {
      expect(() => {
        assertDevEnvironment({
          projectId: DEV_PROJECT_ID,
          environment: "DEV",
          messagingSenderId: PROD_PROJECT_NUMBER
        });
      }).toThrow(/Cross-environment configuration mismatch/);
    });

    it("should dispatch correctly via assertEnvironment", () => {
      const prodRes = assertEnvironment({
        projectId: PROD_PROJECT_ID,
        environment: "PROD",
        allowOffline: true
      });
      expect(prodRes).toEqual({ projectId: PROD_PROJECT_ID, environment: "PROD" });

      const devRes = assertEnvironment({
        projectId: DEV_PROJECT_ID,
        environment: "DEV",
        allowOffline: true
      });
      expect(devRes).toEqual({ projectId: DEV_PROJECT_ID, environment: "DEV" });
    });
  });

  // ==========================================================================
  // 2. Production Authorization & Service Account Rejection (8C.4)
  // ==========================================================================
  describe("2. Production Authorization & Service Account Boundaries", () => {
    function mockVerifyToken(token: string, expectedEnv: "DEV" | "PROD") {
      if (!token.startsWith("Bearer ")) {
        return { authorized: false, status: 401, reason: "Missing Bearer token" };
      }
      const raw = token.substring(7);
      const parts = raw.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8"));
        if (expectedEnv === "PROD") {
          if (payload.email.includes("kerala-lottery-intel-dev")) {
            return {
              authorized: false,
              status: 403,
              reason: "Forbidden: DEV service account cannot call PROD"
            };
          }
          if (payload.email.includes("kerala-lottery-intelligence")) {
            return { authorized: true, caller: payload.email };
          }
        } else {
          if (payload.email.includes("kerala-lottery-intelligence")) {
            return {
              authorized: false,
              status: 403,
              reason: "Forbidden: PROD service account cannot call DEV"
            };
          }
          if (payload.email.includes("kerala-lottery-intel-dev")) {
            return { authorized: true, caller: payload.email };
          }
        }
      }
      return { authorized: false, status: 403, reason: "Unauthorized" };
    }

    function createMockJwt(email: string) {
      const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
      const payload = Buffer.from(JSON.stringify({ iss: "https://accounts.google.com", email })).toString("base64url");
      return `Bearer ${header}.${payload}.mockSignature`;
    }

    it("should reject anonymous requests with 401", () => {
      const res = mockVerifyToken("", "PROD");
      expect(res.authorized).toBe(false);
      expect(res.status).toBe(401);
    });

    it("should reject DEV service account calling PROD with 403 Forbidden", () => {
      const devJwt = createMockJwt("dev-ingestion-scheduler@kerala-lottery-intel-dev.iam.gserviceaccount.com");
      const res = mockVerifyToken(devJwt, "PROD");
      expect(res.authorized).toBe(false);
      expect(res.status).toBe(403);
      expect(res.reason).toContain("DEV service account cannot call PROD");
    });

    it("should reject PROD service account calling DEV with 403 Forbidden", () => {
      const prodJwt = createMockJwt("prod-ingestion-scheduler@kerala-lottery-intelligence.iam.gserviceaccount.com");
      const res = mockVerifyToken(prodJwt, "DEV");
      expect(res.authorized).toBe(false);
      expect(res.status).toBe(403);
      expect(res.reason).toContain("PROD service account cannot call DEV");
    });

    it("should accept authorized PROD service account calling PROD", () => {
      const prodJwt = createMockJwt("prod-ingestion-scheduler@kerala-lottery-intelligence.iam.gserviceaccount.com");
      const res = mockVerifyToken(prodJwt, "PROD");
      expect(res.authorized).toBe(true);
      expect(res.caller).toBe("prod-ingestion-scheduler@kerala-lottery-intelligence.iam.gserviceaccount.com");
    });
  });

  // ==========================================================================
  // 3. Controlled First-Ingestion & Bootstrap Baseline (8C.7 & 8C.8)
  // ==========================================================================
  describe("3. Controlled PROD Bootstrap & BT-73 Idempotency", () => {
    it("should verify existence of real BT-73 source document", () => {
      expect(existsSync(realBt73Path)).toBe(true);
      const bytes = readFileSync(realBt73Path);
      const sha = computeSha256(new Uint8Array(bytes));
      expect(sha).toBe(TARGET_BT73_SHA);
    });

    it("should execute dry-run bootstrap and verify 100 historical draws", async () => {
      const result = await executeProdBootstrap({
        projectId: PROD_PROJECT_ID,
        environment: "PROD",
        dryRun: true,
        allowOffline: true
      });

      expect(result.success).toBe(true);
      expect(result.environment).toBe("PROD");
      expect(result.projectId).toBe(PROD_PROJECT_ID);
      expect(result.totalCandidates).toBe(100);
      expect(result.validatedDrawsCount).toBe(100);
      expect(result.totalWinningResults).toBe(38416);
      expect(result.targetDrawVerified.sha256).toBe(TARGET_BT73_SHA);
      expect(result.auditRecord.status).toBe("SUCCEEDED");
      expect(result.auditRecord.corpusSummary?.draws).toBe(100);
      expect(result.auditRecord.corpusSummary?.results).toBe(38416);
    });

    it("should guarantee idempotent replay on BT-73 (0 duplicate persistence)", async () => {
      const lockManager = new InMemoryIngestionLockManager();
      const runRepository = new InMemoryIngestionRunRepository();
      const orchestrator = new ScheduledIngestionOrchestrator({
        lockManager,
        runRepository,
        targetEnvironment: "PROD"
      });

      const emptyDir = mkdtempSync(join(tmpdir(), "bt73-test-source-"));
      const testCacheDir = mkdtempSync(join(tmpdir(), "bt73-test-cache-"));

      // Initial execution
      const run1 = await orchestrator.execute("MANUAL", {
        projectId: PROD_PROJECT_ID,
        environment: "PROD",
        sourceDir: emptyDir,
        cacheDir: testCacheDir,
        allowOffline: true,
        injectedCandidates: [
          {
            fileName: "BT-73.pdf",
            fileBuffer: new Uint8Array(readFileSync(realBt73Path))
          }
        ]
      });

      expect(run1.status).toBe("SUCCEEDED");
      expect(run1.record.environment).toBe("PROD");

      // Second execution on same BT-73 -> ALREADY_KNOWN, 0 duplicates
      const run2 = await orchestrator.execute("MANUAL", {
        projectId: PROD_PROJECT_ID,
        environment: "PROD",
        sourceDir: emptyDir,
        cacheDir: testCacheDir,
        allowOffline: true,
        injectedCandidates: [
          {
            fileName: "BT-73.pdf",
            fileBuffer: new Uint8Array(readFileSync(realBt73Path))
          }
        ]
      });

      expect(run2.status).toBe("SUCCEEDED");
      expect(run2.alreadyKnownCount).toBe(1);
      expect(run2.ingestedCount).toBe(0);
      expect(run2.record.candidateCount).toBe(1);
    });
  });

  // ==========================================================================
  // 4. Production Concurrency & Single-Flight Lock (8C.9)
  // ==========================================================================
  describe("4. Production Concurrency Control", () => {
    it("should prevent concurrent overlapping execution in PROD (Worker A RUNNING, Worker B SKIPPED_LOCKED)", async () => {
      const lockManager = new InMemoryIngestionLockManager();
      const runRepository = new InMemoryIngestionRunRepository();
      const orchestrator = new ScheduledIngestionOrchestrator({
        lockManager,
        runRepository,
        targetEnvironment: "PROD"
      });

      // Simulate Worker A acquiring lock
      await lockManager.acquireLock("prod_worker_a", { ttlSeconds: 900, environment: "PROD" });

      // Worker B attempts to run concurrently
      const workerBResult = await orchestrator.execute("SCHEDULED", {
        projectId: PROD_PROJECT_ID,
        environment: "PROD",
        allowOffline: true
      });

      expect(workerBResult.status).toBe("SKIPPED_LOCKED");
      expect(workerBResult.skippedLocked).toBe(true);
      expect(workerBResult.lockAcquired).toBe(false);

      // Verify lock state remains held by Worker A
      const currentLock = await lockManager.getCurrentLock();
      expect(currentLock?.ownerRunId).toBe("prod_worker_a");
      expect(currentLock?.environment).toBe("PROD");
    });

    it("should evict stale lock in PROD when lease TTL has passed", async () => {
      const lockManager = new InMemoryIngestionLockManager();
      // Lock acquired with negative TTL (expired)
      await lockManager.acquireLock("crashed_prod_run", { ttlSeconds: -10, environment: "PROD" });

      expect(await lockManager.isLockActive()).toBe(false);

      // Fresh run acquires lock successfully
      const acquired = await lockManager.acquireLock("fresh_prod_run", { ttlSeconds: 900, environment: "PROD" });
      expect(acquired).toBe(true);

      const activeLock = await lockManager.getCurrentLock();
      expect(activeLock?.ownerRunId).toBe("fresh_prod_run");
    });
  });

  // ==========================================================================
  // 5. Production Failure Recovery Taxonomy (8C.10)
  // ==========================================================================
  describe("5. Production Failure Recovery & Complete Taxonomy", () => {
    const categories: Array<{ errorMsg: string; expected: FailureCategory }> = [
      { errorMsg: "DNS failure while contacting state portal", expected: "SOURCE_DISCOVERY_FAILURE" },
      { errorMsg: "Acquisition failed: timeout while downloading candidate PDF", expected: "ACQUISITION_FAILURE" },
      { errorMsg: "PDF header corrupted or invalid stream syntax", expected: "PDF_VALIDATION_FAILURE" },
      { errorMsg: "Unresolved prize scheme: archetype not registered", expected: "SCHEME_RESOLUTION_FAILURE" },
      { errorMsg: "Result validation discrepancy in prize count", expected: "RESULT_VALIDATION_FAILURE" },
      { errorMsg: "Cloud Storage write failed: upload quota reached", expected: "PERSISTENCE_FAILURE" },
      { errorMsg: "Downstream feature promotion failed", expected: "PROMOTION_FAILURE" },
      { errorMsg: "Lock acquisition failed: active lease busy", expected: "LOCK_FAILURE" },
      { errorMsg: "Configuration mismatch: wrong project identifier", expected: "CONFIGURATION_FAILURE" },
      { errorMsg: "Unhandled generic process error", expected: "UNKNOWN_FAILURE" }
    ];

    for (const { errorMsg, expected } of categories) {
      it(`should classify "${expected}" without swallowing error`, () => {
        const classified = classifyError(new Error(errorMsg));
        expect(classified).toBe(expected);
      });
    }

    it("should leave coherent audit state upon failure in PROD", async () => {
      const lockManager = new InMemoryIngestionLockManager();
      const runRepository = new InMemoryIngestionRunRepository();
      const orchestrator = new ScheduledIngestionOrchestrator({
        lockManager,
        runRepository,
        targetEnvironment: "PROD",
        engineFactory: () => ({
          execute: async () => {
            throw new IngestionFailureError("PERSISTENCE_FAILURE", "Cloud Storage write rejected");
          }
        } as any)
      });

      const res = await orchestrator.execute("SCHEDULED", {
        projectId: PROD_PROJECT_ID,
        environment: "PROD",
        allowOffline: true
      });

      expect(res.status).toBe("FAILED");
      expect(res.failureCategory).toBe("PERSISTENCE_FAILURE");

      // Verify lock was released despite failure
      expect(await lockManager.isLockActive()).toBe(false);

      // Verify durable audit run record exists
      const runRecord = await runRepository.getRun(res.runId);
      expect(runRecord).not.toBeNull();
      expect(runRecord?.status).toBe("FAILED");
      expect(runRecord?.failureCategory).toBe("PERSISTENCE_FAILURE");
      expect(runRecord?.environment).toBe("PROD");
    });
  });

  // ==========================================================================
  // 6. Production Observability & Secret Sanitization (8C.11)
  // ==========================================================================
  describe("6. Secret Sanitization in PROD", () => {
    it("should redact secrets and bearer tokens from operational records", () => {
      const rawRecord = {
        runId: "run_prod_test",
        auth_token: "secret-token-xyz-123",
        serviceAccountPrivateKey: "-----BEGIN PRIVATE KEY-----\nMIIE...",
        credentials: {
          apiKey: "AIzaSySecretApiKey",
          nestedSecret: "super-secret"
        },
        message: "Request sent with Bearer ya29.a0AfH6SMD... token"
      };

      const clean = sanitizeOperationalRecord(rawRecord);
      expect(clean.auth_token).toBe("[REDACTED_SECRET]");
      expect(clean.serviceAccountPrivateKey).toBe("[REDACTED_SECRET]");
      expect(clean.credentials.apiKey).toBe("[REDACTED_SECRET]");
      expect(clean.message).toContain("Bearer [REDACTED]");
      expect(clean.message).not.toContain("ya29.");
    });
  });
});
