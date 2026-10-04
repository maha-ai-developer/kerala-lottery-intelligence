/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Operational Ingestion Console API & Security Boundary Tests
 *
 * Verifies:
 * 1. Research API immutability: /api/v1/ingestion/runs is GET-only (405 for POST/PUT/DELETE/PATCH).
 * 2. Operational Environment Guards: PROD mutations are rejected with 403 Forbidden.
 * 3. Official Source Discovery: /api/ops/ingestion/check maps candidate states (ALREADY_KNOWN, NEW, PENDING).
 * 4. Dry-Run Non-Mutation Guarantee: /api/ops/ingestion/dry-run computes reports with zero persistent side effects.
 * 5. PDF Magic Header Validation: rejects non-PDF files with 400 Bad Request.
 * 6. SHA-256 & Idempotency: duplicate SHA recognized as ALREADY_KNOWN.
 * 7. Single-Flight Concurrency Lease: rejects concurrent runs with 409 Conflict.
 * 8. Storage Integrity & Reconciliation: reconciles local cache vs cloud by SHA-256 and draw identity.
 * 9. Operational Runs History: GET /api/ops/ingestion/runs returns sanitized audit records.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { POST as checkPost, GET as checkGet } from "../apps/web/app/api/ops/ingestion/check/route";
import { POST as dryRunPost, GET as dryRunGet } from "../apps/web/app/api/ops/ingestion/dry-run/route";
import { POST as downloadPost, GET as downloadGet } from "../apps/web/app/api/ops/ingestion/download/route";
import { POST as uploadPost, GET as uploadGet } from "../apps/web/app/api/ops/ingestion/upload/route";
import { GET as runsGet, POST as runsPost } from "../apps/web/app/api/ops/ingestion/runs/route";
import { GET as integrityGet, POST as integrityPost } from "../apps/web/app/api/ops/ingestion/storage-integrity/route";
import {
  GET as v1RunsGet,
  POST as v1RunsPost,
  PUT as v1RunsPut,
  DELETE as v1RunsDelete,
  PATCH as v1RunsPatch
} from "../apps/web/app/api/v1/ingestion/runs/route";
import { getOpsLockManager } from "../apps/web/lib/ops-guard";
import { computeSha256 } from "@kerala-lottery/documents";

describe("Operational Ingestion Console: API & Security Boundary Tests", () => {
  const samplePdfPath = join(process.cwd(), "data/source-documents/lottery-results/271-2346-28-09-2026.pdf");
  let samplePdfBuffer: Buffer;
  let sampleSha: string;

  beforeEach(() => {
    if (existsSync(samplePdfPath)) {
      samplePdfBuffer = readFileSync(samplePdfPath);
      sampleSha = computeSha256(new Uint8Array(samplePdfBuffer));
    }
  });

  // ==========================================================================
  // 1. Research API Read-Only Immutability
  // ==========================================================================
  describe("1. Research API Read-Only Boundary", () => {
    it("GET /api/v1/ingestion/runs returns 200 with audited runs", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/ingestion/runs", { method: "GET" });
      const res = await v1RunsGet(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toBeDefined();
      expect(Array.isArray(json.data)).toBe(true);
    });

    it("rejects POST on /api/v1/ingestion/runs with 405 Method Not Allowed", async () => {
      const res = await v1RunsPost();
      expect(res.status).toBe(405);
      expect(res.headers.get("Allow")).toBe("GET");
    });

    it("rejects PUT on /api/v1/ingestion/runs with 405 Method Not Allowed", async () => {
      const res = await v1RunsPut();
      expect(res.status).toBe(405);
    });

    it("rejects DELETE on /api/v1/ingestion/runs with 405 Method Not Allowed", async () => {
      const res = await v1RunsDelete();
      expect(res.status).toBe(405);
    });

    it("rejects PATCH on /api/v1/ingestion/runs with 405 Method Not Allowed", async () => {
      const res = await v1RunsPatch();
      expect(res.status).toBe(405);
    });
  });

  // ==========================================================================
  // 2. Production Environment Mutation Safety Guard
  // ==========================================================================
  describe("2. Production Mutation Safety Guard", () => {
    it("strictly rejects PROD mutation on download with 403 Forbidden", async () => {
      const req = new NextRequest("http://localhost:3000/api/ops/ingestion/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment: "PROD",
          candidate: { fileName: "test-candidate.pdf", sourceUrl: "http://example.com/test.pdf" }
        })
      });

      const res = await downloadPost(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe("FORBIDDEN_PROD_MUTATION");
      expect(json.message).toContain("PROD mutations are strictly forbidden");
    });

    it("strictly rejects PROD mutation on upload with 403 Forbidden", async () => {
      const req = new NextRequest("http://localhost:3000/api/ops/ingestion/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment: "PROD",
          fileName: "uploaded.pdf",
          fileBase64: samplePdfBuffer.toString("base64")
        })
      });

      const res = await uploadPost(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe("FORBIDDEN_PROD_MUTATION");
      expect(json.message).toContain("PROD mutations are strictly forbidden");
    });
  });

  // ==========================================================================
  // 3. Official Source Discovery Check (/api/ops/ingestion/check)
  // ==========================================================================
  describe("3. Official Source Discovery Check", () => {
    it("POST /api/ops/ingestion/check returns discovered candidate states", async () => {
      const req = new NextRequest("http://localhost:3000/api/ops/ingestion/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ environment: "DEV", since: "2026-06-01" })
      });

      const res = await checkPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.environment).toBe("DEV");
      expect(json.candidates).toBeDefined();
      expect(Array.isArray(json.candidates)).toBe(true);
      expect(json.candidates.length).toBeGreaterThan(0);

      // Verify state classification exists on candidates
      const states = json.candidates.map((c: any) => c.state);
      expect(states.some((s: string) => s === "ALREADY_KNOWN" || s === "PENDING" || s === "NEW")).toBe(true);
    });

    it("rejects GET on /api/ops/ingestion/check with 405 Method Not Allowed", async () => {
      const res = await checkGet();
      expect(res.status).toBe(405);
      expect(res.headers.get("Allow")).toBe("POST");
    });
  });

  // ==========================================================================
  // 4. Dry-Run Non-Mutation Guarantee (/api/ops/ingestion/dry-run)
  // ==========================================================================
  describe("4. Dry-Run Non-Mutation Guarantee", () => {
    it("POST /api/ops/ingestion/dry-run previews validation report without persistent mutations", async () => {
      const req = new NextRequest("http://localhost:3000/api/ops/ingestion/dry-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment: "DEV",
          candidate: {
            fileName: "271-2346-28-09-2026.pdf",
            fileBase64: samplePdfBuffer.toString("base64")
          }
        })
      });

      const res = await dryRunPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.dryRun).toBe(true);
      expect(json.storageMutated).toBe(false);
      expect(json.firestoreMutated).toBe(false);
      expect(json.sha256).toBe(sampleSha);
      expect(json.validation).toBeDefined();
      expect(json.validation.resultCount).toBeGreaterThan(0);
    });

    it("rejects GET on /api/ops/ingestion/dry-run with 405 Method Not Allowed", async () => {
      const res = await dryRunGet();
      expect(res.status).toBe(405);
      expect(res.headers.get("Allow")).toBe("POST");
    });
  });

  // ==========================================================================
  // 5. PDF Format Validation & Manual Upload
  // ==========================================================================
  describe("5. PDF Format & Upload Validation", () => {
    it("rejects non-PDF payload with 400 Bad Request (magic header check)", async () => {
      const malformedText = "This is not a PDF file.";
      const malformedBase64 = Buffer.from(malformedText).toString("base64");

      const req = new NextRequest("http://localhost:3000/api/ops/ingestion/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: "invalid.pdf",
          fileBase64: malformedBase64,
          environment: "DEV"
        })
      });

      const res = await uploadPost(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("INVALID_PDF");
      expect(json.message).toContain("PDF Validation Failed");
    });

    it("accepts valid PDF in DEV and handles idempotent deduplication", async () => {
      const req = new NextRequest("http://localhost:3000/api/ops/ingestion/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: "271-2346-28-09-2026.pdf",
          fileBase64: samplePdfBuffer.toString("base64"),
          environment: "DEV"
        })
      });

      const res = await uploadPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.environment).toBe("DEV");
      expect(json.sha256).toBe(sampleSha);
      expect(json.cloudStoragePath).toBe(`source-documents/${sampleSha}.pdf`);
      expect(json.firestoreDocumentId).toBe(sampleSha);
      expect(json.alreadyKnown).toBeGreaterThanOrEqual(1);
    });

    it("rejects GET on /api/ops/ingestion/upload with 405 Method Not Allowed", async () => {
      const res = await uploadGet();
      expect(res.status).toBe(405);
      expect(res.headers.get("Allow")).toBe("POST");
    });

    it("rejects GET on /api/ops/ingestion/download with 405 Method Not Allowed", async () => {
      const res = await downloadGet();
      expect(res.status).toBe(405);
      expect(res.headers.get("Allow")).toBe("POST");
    });
  });

  // ==========================================================================
  // 6. Single-Flight Concurrency Lease Guard
  // ==========================================================================
  describe("6. Single-Flight Concurrency Lease Guard", () => {
    it("rejects mutating operation with 409 Conflict when single-flight lock is actively held", async () => {
      const lockManager = getOpsLockManager();
      const mockRunId = "run_active_test_lock_holder";

      // Manually acquire lock
      const acquired = await lockManager.acquireLock(mockRunId, { ttlSeconds: 120, environment: "DEV" });
      expect(acquired).toBe(true);

      try {
        // Attempt mutating upload while lock is active
        const req = new NextRequest("http://localhost:3000/api/ops/ingestion/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: "271-2346-28-09-2026.pdf",
            fileBase64: samplePdfBuffer.toString("base64"),
            environment: "DEV"
          })
        });

        const res = await uploadPost(req);
        expect(res.status).toBe(409);
        const json = await res.json();
        expect(json.error).toBe("CONCURRENCY_LOCK_ACTIVE");
        expect(json.message).toContain("Single-flight lock acquisition rejected");
      } finally {
        // Release lock
        await lockManager.releaseLock(mockRunId);
      }
    });
  });

  // ==========================================================================
  // 7. Storage Integrity & Local ↔ Cloud Reconciliation
  // ==========================================================================
  describe("7. Storage Integrity & Reconciliation", () => {
    it("GET /api/ops/ingestion/storage-integrity returns valid count metadata", async () => {
      const req = new NextRequest("http://localhost:3000/api/ops/ingestion/storage-integrity", { method: "GET" });
      const res = await integrityGet(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.counts).toBeDefined();
      expect(json.counts.localDocumentCount).toBe(103);
      expect(json.counts.localGraphCount).toBe(103);
      expect(json.counts.localManifestCount).toBe(103);
      expect(json.counts.researchDrawCount).toBe(103);
      expect(json.counts.prodDrawCount).toBe(100);
      expect(json.operationalGuards.schedulerState).toBe("PAUSED");
      expect(json.operationalGuards.mutationState).toBe("PROD_LOCKED_DEV_ALLOWED");
    });

    it("GET /api/ops/ingestion/storage-integrity?verify=true reconciles SHA-256 and draw identities", async () => {
      const req = new NextRequest("http://localhost:3000/api/ops/ingestion/storage-integrity?verify=true", { method: "GET" });
      const res = await integrityGet(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.verification).toBeDefined();
      expect(json.verification.integrityStatus).toBe("VERIFIED");
      expect(json.verification.matchedCount).toBe(103);
      expect(json.verification.mismatchCount).toBe(0);
      expect(json.verification.items.length).toBeGreaterThan(0);
      expect(json.verification.reconciliationBasis).toContain("SHA-256");
    });

    it("rejects POST on /api/ops/ingestion/storage-integrity with 405 Method Not Allowed", async () => {
      const res = await integrityPost();
      expect(res.status).toBe(405);
      expect(res.headers.get("Allow")).toBe("GET");
    });
  });

  // ==========================================================================
  // 8. Operational Runs Telemetry
  // ==========================================================================
  describe("8. Operational Runs Telemetry", () => {
    it("GET /api/ops/ingestion/runs returns sanitized run history", async () => {
      const req = new NextRequest("http://localhost:3000/api/ops/ingestion/runs", { method: "GET" });
      const res = await runsGet(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data).toBeDefined();
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBeGreaterThan(0);

      // Verify secrecy scrubbing: no raw authorization tokens in records
      const rawText = JSON.stringify(json.data);
      expect(rawText).not.toContain("bearer test");
      expect(rawText).not.toContain("api_key_secret");
    });

    it("rejects POST on /api/ops/ingestion/runs with 405 Method Not Allowed", async () => {
      const res = await runsPost();
      expect(res.status).toBe(405);
      expect(res.headers.get("Allow")).toBe("GET");
    });
  });
});
