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

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { POST as checkPost, GET as checkGet } from "../apps/web/app/api/ops/ingestion/check/route";
import { POST as dryRunPost, GET as dryRunGet } from "../apps/web/app/api/ops/ingestion/dry-run/route";
import { POST as downloadPost, GET as downloadGet } from "../apps/web/app/api/ops/ingestion/download/route";
import { POST as uploadPost, GET as uploadGet } from "../apps/web/app/api/ops/ingestion/upload/route";
import { GET as runsGet, POST as runsPost } from "../apps/web/app/api/ops/ingestion/runs/route";
import { GET as integrityGet, POST as integrityPost } from "../apps/web/app/api/ops/ingestion/storage-integrity/route";
import { setStorageIntegrityDependenciesForTesting } from "../apps/web/lib/storage-integrity";
import {
  GET as v1RunsGet,
  POST as v1RunsPost,
  PUT as v1RunsPut,
  DELETE as v1RunsDelete,
  PATCH as v1RunsPatch
} from "../apps/web/app/api/v1/ingestion/runs/route";
import { getOpsLockManager } from "../apps/web/lib/ops-guard";
import { isFirebaseConfigured } from "../apps/web/lib/firebase";
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

  afterEach(() => {
    setStorageIntegrityDependenciesForTesting(null);
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

    it("accepts valid PDF in DEV and enforces fail-closed cloud persistence", async () => {
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
      if (!isFirebaseConfigured) {
        // Phase 2: strictly fail-closed when Firebase is unconfigured, zero in-memory persistence
        expect(res.status).toBe(503);
        const json = await res.json();
        expect(json.error).toBe("FIREBASE_NOT_CONFIGURED");
        expect(json.message).toContain("Authoritative Firebase backend is not configured");
      } else {
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.success).toBe(true);
        expect(json.environment).toBe("DEV");
        expect(json.sha256).toBe(sampleSha);
        expect(json.cloudStoragePath).toBe(`source-documents/${sampleSha}.pdf`);
        expect(json.firestoreDocumentId).toBe(sampleSha);
        expect(json.alreadyKnown).toBeGreaterThanOrEqual(1);
      }
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
    it("GET /api/ops/ingestion/storage-integrity returns valid local count metadata and explicit UNVERIFIED when cloud is unconfigured", async () => {
      setStorageIntegrityDependenciesForTesting({
        isCloudConfigured: () => false
      });

      const req = new NextRequest("http://localhost:3000/api/ops/ingestion/storage-integrity?verify=true", { method: "GET" });
      const res = await integrityGet(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.counts).toBeDefined();
      expect(json.counts.localDocumentCount).toBe(114);
      expect(json.counts.localGraphCount).toBe(114);
      expect(json.counts.localManifestCount).toBe(114);
      expect(json.counts.cloudStorageDocumentCount).toBeNull();
      expect(json.counts.firestoreDocumentCount).toBeNull();
      expect(json.counts.researchDrawCount).toBe(114);
      expect(json.counts.prodDrawCount).toBe(100);
      expect(json.operationalGuards.schedulerState).toBe("PAUSED");
      expect(json.operationalGuards.mutationState).toBe("PROD_LOCKED_DEV_ALLOWED");
      expect(json.verification).toBeDefined();
      expect(json.verification.integrityStatus).toBe("UNVERIFIED");
      expect(json.verification.matchedCount).toBe(0);
      expect(json.verification.unverifiedCount).toBe(114);
    });

    it("GET /api/ops/ingestion/storage-integrity?verify=true calculates Storage and Firestore counts independently and returns VERIFIED when all 114 match", async () => {
      const manifestRaw = JSON.parse(
        readFileSync(join(process.cwd(), "data/processed-cache/manifest.json"), "utf-8")
      );
      const allShas = Object.keys(manifestRaw.documents || {});
      expect(allShas.length).toBe(114);

      setStorageIntegrityDependenciesForTesting({
        isCloudConfigured: () => true,
        listCloudStorageObjectShas: async () => new Set(allShas),
        listFirestoreDocumentShas: async () => new Set(allShas)
      });

      const req = new NextRequest("http://localhost:3000/api/ops/ingestion/storage-integrity?verify=true", { method: "GET" });
      const res = await integrityGet(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.counts.cloudStorageDocumentCount).toBe(114);
      expect(json.counts.firestoreDocumentCount).toBe(114);
      expect(json.verification).toBeDefined();
      expect(json.verification.integrityStatus).toBe("VERIFIED");
      expect(json.verification.matchedCount).toBe(114);
      expect(json.verification.mismatchCount).toBe(0);
      expect(json.verification.items.length).toBeGreaterThan(0);
      expect(json.verification.reconciliationBasis).toContain("SHA-256");
    });

    it("GET /api/ops/ingestion/storage-integrity?verify=true reports DISCREPANCY_DETECTED and distinct counts when Cloud Storage and Firestore diverge", async () => {
      const manifestRaw = JSON.parse(
        readFileSync(join(process.cwd(), "data/processed-cache/manifest.json"), "utf-8")
      );
      const allShas = Object.keys(manifestRaw.documents || {});
      const missingStorageSha = allShas[0]!;
      const storageSubset = new Set(allShas.slice(1)); // 113 in Storage
      const firestoreFull = new Set(allShas); // 114 in Firestore

      setStorageIntegrityDependenciesForTesting({
        isCloudConfigured: () => true,
        listCloudStorageObjectShas: async () => storageSubset,
        listFirestoreDocumentShas: async () => firestoreFull
      });

      const req = new NextRequest("http://localhost:3000/api/ops/ingestion/storage-integrity?verify=true", { method: "GET" });
      const res = await integrityGet(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      // Prove Cloud Storage count is NOT copied from Firestore count
      expect(json.counts.cloudStorageDocumentCount).toBe(113);
      expect(json.counts.firestoreDocumentCount).toBe(114);
      expect(json.verification.integrityStatus).toBe("DISCREPANCY_DETECTED");
      expect(json.verification.matchedCount).toBe(113);
      expect(json.verification.mismatchCount).toBe(1);

      const discrepancyItem = json.verification.items.find(
        (item: { sha256: string }) => item.sha256 === missingStorageSha
      );
      expect(discrepancyItem).toBeDefined();
      expect(discrepancyItem.inCloudStore).toBe(false);
      expect(discrepancyItem.inFirestore).toBe(true);
      expect(discrepancyItem.residencyCategory).toBe("CLOUD_PARITY_MISMATCH");
      expect(discrepancyItem.identityVerified).toBe(false);
    });

    it("accurately classifies the actual DEV cloud inventory (100 PROD baseline outside DEV, 11 DEV catch-up, 3 local-only catch-up, 2 additional DEV test items) and returns DISCREPANCY_DETECTED", async () => {
      const manifestRaw = JSON.parse(
        readFileSync(join(process.cwd(), "data/processed-cache/manifest.json"), "utf-8")
      );
      const docs = Object.values<any>(manifestRaw.documents || {});
      expect(docs.length).toBe(114);

      const localOnlyThreeShas = [
        "351176188dbb5264f22715eef8cab489e584d67455125c36e8778edc6aff431e", // SS-539th (29/09/2026)
        "37e35a7760e98eecc7062e10c9512070f8809d759e72963d5857374ea28a09fc", // KN-643rd (01/10/2026)
        "8670c8a0cdb9174d81c57a21b38e279c969088b4dc5020a16ef3f5a59e787174"  // DL-71st  (30/09/2026)
      ].sort();

      const milestoneTestExtraShas = [
        "2b8ed894e0e6da419e81b54d760322c574cf88a61f8d892bd309ad9148fc3acf", // Milestone 3A synthetic fixture
        "9bc76b6017edb26d3c13d415cd96280f4a2f066d24c41ce7a82b39b44dee557c"  // Milestone 3B Feb 2026 sample draw
      ].sort();

      const devCatchup11Shas = docs
        .filter((d) => {
          const [dd, mm, yyyy] = String(d.drawDate).split("/");
          const iso = `${yyyy}-${mm}-${dd}`;
          return iso > "2026-09-28" && !localOnlyThreeShas.includes(d.sha256);
        })
        .map((d) => String(d.sha256));
      expect(devCatchup11Shas.length).toBe(11);

      const actualDev13Shas = new Set([...devCatchup11Shas, ...milestoneTestExtraShas]);
      expect(actualDev13Shas.size).toBe(13);

      setStorageIntegrityDependenciesForTesting({
        isCloudConfigured: () => true,
        listCloudStorageObjectShas: async () => actualDev13Shas,
        listFirestoreDocumentShas: async () => actualDev13Shas
      });

      const req = new NextRequest(
        "http://localhost:3000/api/ops/ingestion/storage-integrity?verify=true",
        { method: "GET" }
      );
      const res = await integrityGet(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.counts.localManifestCount).toBe(114);
      expect(json.counts.prodBaselineManifestCount).toBe(100);
      expect(json.counts.devCatchupManifestCount).toBe(14);
      expect(json.counts.cloudStorageDocumentCount).toBe(13);
      expect(json.counts.firestoreDocumentCount).toBe(13);

      expect(json.verification.totalAudited).toBe(116);
      expect(json.verification.matchedCount).toBe(11);
      expect(json.verification.mismatchCount).toBe(105);
      expect(json.verification.integrityStatus).toBe("DISCREPANCY_DETECTED");

      const breakdown = json.verification.residencyBreakdown;
      expect(breakdown).toBeDefined();
      expect(breakdown.prodBaselineManifestCount).toBe(100);
      expect(breakdown.devCatchupManifestCount).toBe(14);
      expect(breakdown.environmentOwnedProdCount).toBe(0);
      expect(breakdown.prodBaselineOutsideDevCount).toBe(100);
      expect(breakdown.environmentOwnedDevCount).toBe(11);
      expect(breakdown.localOnlyMissingDevCount).toBe(3);
      expect(breakdown.localOnlyCatchupShas).toEqual(localOnlyThreeShas);
      expect(breakdown.additionalCloudOutsideManifestCount).toBe(2);
      expect(breakdown.additionalCloudOutsideManifestShas).toEqual(milestoneTestExtraShas);
      expect(breakdown.cloudParityMismatchCount).toBe(0);
      expect(breakdown.localArtifactMismatchCount).toBe(0);
    });

    it("evaluates split PROD (100 baseline) + DEV (11 catch-up + 2 test items) cloud inventories and never returns VERIFIED while local-only or non-manifest cloud records exist", async () => {
      const manifestRaw = JSON.parse(
        readFileSync(join(process.cwd(), "data/processed-cache/manifest.json"), "utf-8")
      );
      const docs = Object.values<any>(manifestRaw.documents || {});

      const localOnlyThreeShas = [
        "351176188dbb5264f22715eef8cab489e584d67455125c36e8778edc6aff431e",
        "37e35a7760e98eecc7062e10c9512070f8809d759e72963d5857374ea28a09fc",
        "8670c8a0cdb9174d81c57a21b38e279c969088b4dc5020a16ef3f5a59e787174"
      ].sort();

      const milestoneTestExtraShas = [
        "2b8ed894e0e6da419e81b54d760322c574cf88a61f8d892bd309ad9148fc3acf",
        "9bc76b6017edb26d3c13d415cd96280f4a2f066d24c41ce7a82b39b44dee557c"
      ].sort();

      const prod100Shas = new Set(
        docs
          .filter((d) => {
            const [dd, mm, yyyy] = String(d.drawDate).split("/");
            return `${yyyy}-${mm}-${dd}` <= "2026-09-28";
          })
          .map((d) => String(d.sha256))
      );
      expect(prod100Shas.size).toBe(100);

      const dev14CatchupShas = docs
        .filter((d) => {
          const [dd, mm, yyyy] = String(d.drawDate).split("/");
          return `${yyyy}-${mm}-${dd}` > "2026-09-28";
        })
        .map((d) => String(d.sha256));
      expect(dev14CatchupShas.length).toBe(14);

      const actualDev13Shas = new Set([
        ...dev14CatchupShas.filter((sha) => !localOnlyThreeShas.includes(sha)),
        ...milestoneTestExtraShas
      ]);
      expect(actualDev13Shas.size).toBe(13);

      // 1. Current split state: 100 PROD + 13 DEV (11 catch-up + 2 test records, 3 local-only) -> DISCREPANCY_DETECTED
      setStorageIntegrityDependenciesForTesting({
        isCloudConfigured: () => true,
        listCloudStorageObjectShas: async () => actualDev13Shas,
        listFirestoreDocumentShas: async () => actualDev13Shas,
        listProdCloudStorageObjectShas: async () => prod100Shas,
        listProdFirestoreDocumentShas: async () => prod100Shas
      });

      const reqCurrent = new NextRequest(
        "http://localhost:3000/api/ops/ingestion/storage-integrity?verify=true",
        { method: "GET" }
      );
      const resCurrent = await integrityGet(reqCurrent);
      const jsonCurrent = await resCurrent.json();

      expect(jsonCurrent.counts.prodCloudStorageDocumentCount).toBe(100);
      expect(jsonCurrent.counts.prodFirestoreDocumentCount).toBe(100);
      expect(jsonCurrent.counts.cloudStorageDocumentCount).toBe(13);
      expect(jsonCurrent.counts.firestoreDocumentCount).toBe(13);
      expect(jsonCurrent.verification.totalAudited).toBe(116);
      expect(jsonCurrent.verification.matchedCount).toBe(111);
      expect(jsonCurrent.verification.mismatchCount).toBe(5);
      expect(jsonCurrent.verification.residencyBreakdown.environmentOwnedProdCount).toBe(100);
      expect(jsonCurrent.verification.residencyBreakdown.prodBaselineOutsideDevCount).toBe(0);
      expect(jsonCurrent.verification.residencyBreakdown.environmentOwnedDevCount).toBe(11);
      expect(jsonCurrent.verification.residencyBreakdown.localOnlyMissingDevCount).toBe(3);
      expect(jsonCurrent.verification.residencyBreakdown.additionalCloudOutsideManifestCount).toBe(2);
      expect(jsonCurrent.verification.integrityStatus).toBe("DISCREPANCY_DETECTED");

      // 2. Clean split state: 100 PROD + 14 DEV catch-up + 0 extra records -> VERIFIED
      setStorageIntegrityDependenciesForTesting({
        isCloudConfigured: () => true,
        listCloudStorageObjectShas: async () => new Set(dev14CatchupShas),
        listFirestoreDocumentShas: async () => new Set(dev14CatchupShas),
        listProdCloudStorageObjectShas: async () => prod100Shas,
        listProdFirestoreDocumentShas: async () => prod100Shas
      });

      const reqReconciled = new NextRequest(
        "http://localhost:3000/api/ops/ingestion/storage-integrity?verify=true",
        { method: "GET" }
      );
      const resReconciled = await integrityGet(reqReconciled);
      const jsonReconciled = await resReconciled.json();

      expect(jsonReconciled.verification.totalAudited).toBe(114);
      expect(jsonReconciled.verification.matchedCount).toBe(114);
      expect(jsonReconciled.verification.mismatchCount).toBe(0);
      expect(jsonReconciled.verification.residencyBreakdown.environmentOwnedProdCount).toBe(100);
      expect(jsonReconciled.verification.residencyBreakdown.environmentOwnedDevCount).toBe(14);
      expect(jsonReconciled.verification.residencyBreakdown.localOnlyMissingDevCount).toBe(0);
      expect(jsonReconciled.verification.residencyBreakdown.additionalCloudOutsideManifestCount).toBe(0);
      expect(jsonReconciled.verification.integrityStatus).toBe("VERIFIED");
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
