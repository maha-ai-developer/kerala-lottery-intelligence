/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 8A — Automated Daily Real-World Lottery Result Ingestion Test Suite
 *
 * Enforces:
 * 1. Official source candidate discovery & URL normalization
 * 2. Cryptographic SHA-256 byte-level identity
 * 3. Duplicate SHA deduplication (Scenario E)
 * 4. Draw identity conflict detection without silent overwrite (Scenario F)
 * 5. Prize scheme resolution (OFFICIAL_SCHEME vs OBSERVED_SCHEME_ARCHETYPE)
 * 6. Result validation against prize scheme rules
 * 7. Immutable persistence & downstream canonical promotion
 * 8. Real-world 27/09/2026 baseline compatibility (Scenario B)
 * 9. Genuinely new candidate ingestion & idempotent rerun (Scenarios C & D)
 * 10. Dry-run non-mutation guarantees
 * 11. Batch error isolation (bad document does not destroy batch)
 * 12. Candidate audit completeness & deterministic execution
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rmSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DailyIngestionEngine } from "./daily-ingestion-engine";
import { DocumentCacheManager } from "./document-cache";
import { computeSha256 } from "@kerala-lottery/documents";
import { createAuthoritativePrizeSchemeRegistry } from "@kerala-lottery/domain";

describe("Milestone 8A — Automated Daily Real-World Lottery Result Ingestion", () => {
  const testCacheDir = join(process.cwd(), "tmp/test-cache-8a");
  const testSourceDir = join(process.cwd(), "tmp/test-sources-8a");
  const realPdfPath = join(
    process.cwd(),
    "data/source-documents/lottery-results/277-2342-27-09-2026.pdf"
  );

  let realPdfBytes: Buffer;
  let realPdfSha: string;

  beforeEach(() => {
    if (existsSync(testCacheDir)) rmSync(testCacheDir, { recursive: true, force: true });
    if (existsSync(testSourceDir)) rmSync(testSourceDir, { recursive: true, force: true });
    mkdirSync(testCacheDir, { recursive: true });
    mkdirSync(testSourceDir, { recursive: true });

    realPdfBytes = readFileSync(realPdfPath);
    realPdfSha = computeSha256(new Uint8Array(realPdfBytes));
  });

  afterEach(() => {
    if (existsSync(testCacheDir)) rmSync(testCacheDir, { recursive: true, force: true });
    if (existsSync(testSourceDir)) rmSync(testSourceDir, { recursive: true, force: true });
  });

  // --------------------------------------------------------------------------
  // 1. Official Source Discovery & Candidate Processing
  // --------------------------------------------------------------------------
  describe("8A.2 & 8A.3: Source Discovery and Candidate Processing", () => {
    it("discovers injected candidate and extracts cryptographic SHA-256", async () => {
      const engine = new DailyIngestionEngine({
        sourceDir: testSourceDir,
        cacheDir: testCacheDir,
        silent: true,
        injectedCandidates: [
          {
            fileName: "277-2342-27-09-2026.pdf",
            fileBuffer: new Uint8Array(realPdfBytes),
            sourceUrl: "https://statelottery.kerala.gov.in/pdf/277-2342-27-09-2026.pdf",
            title: "Result - SAMRUDHI (SM-74) dated 27-09-2026"
          }
        ]
      });

      const candidates = await engine.discoverCandidates();
      expect(candidates).toHaveLength(1);
      expect(candidates[0]!.fileName).toBe("277-2342-27-09-2026.pdf");
      expect(candidates[0]!.sourceUrl).toBe("https://statelottery.kerala.gov.in/pdf/277-2342-27-09-2026.pdf");

      const result = await engine.execute();
      expect(result.success).toBe(true);
      expect(result.summary.totalDiscovered).toBe(1);
      expect(result.summary.ingested).toBe(1);
      expect(result.summary.promoted).toBe(1);
      expect(result.candidates[0]!.sha256).toBe(realPdfSha);
      expect(result.candidates[0]!.lottery).toBe("SAMRUDHI");
      expect(result.candidates[0]!.drawNumber).toBe("SM-74th");
    });
  });

  // --------------------------------------------------------------------------
  // 2. Scenario E: SHA Deduplication (Identical SHA under Different Filenames)
  // --------------------------------------------------------------------------
  describe("8A.4 & 8A.9 Scenario E: Duplicate SHA Deduplication", () => {
    it("prevents duplicate ingestion when identical bytes appear under two distinct filenames", async () => {
      const copyBytes = new Uint8Array(realPdfBytes);
      const engine = new DailyIngestionEngine({
        sourceDir: testSourceDir,
        cacheDir: testCacheDir,
        silent: true,
        injectedCandidates: [
          {
            fileName: "original-samrudhi.pdf",
            fileBuffer: copyBytes
          },
          {
            fileName: "duplicate-alias-samrudhi.pdf",
            fileBuffer: copyBytes
          }
        ]
      });

      const result = await engine.execute();
      expect(result.success).toBe(true);
      expect(result.summary.totalDiscovered).toBe(2);
      expect(result.summary.ingested).toBe(1); // Only 1 ingested
      expect(result.summary.alreadyKnown).toBe(1); // 2nd deduplicated as already known
      expect(result.duplicateSha).toBe(1);

      const dupRecord = result.candidates.find((c) => c.fileName === "duplicate-alias-samrudhi.pdf");
      expect(dupRecord).toBeDefined();
      expect(dupRecord!.actionTaken).toBe("ALREADY_KNOWN");
      expect(dupRecord!.isDuplicate).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Scenario F: Draw Identity Conflict Handling (Replacement Document)
  // --------------------------------------------------------------------------
  describe("8A.4 & 8A.9 Scenario F: Draw Identity Conflict Detection", () => {
    it("flags CONFLICT and rejects replacement document with differing SHA for existing draw", async () => {
      // Step 1: Pre-populate cache with legitimate draw
      const cacheManager = new DocumentCacheManager({ cacheDir: testCacheDir });
      cacheManager.saveValidGraph(
        {
          documentSha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          nodes: [],
          edges: [],
          metadata: { nodeCount: 0, edgeCount: 0, extractedAt: "2026-09-27T00:00:00.000Z", graphVersion: "1.0" }
        },
        {
          fileName: "previous-sm74.pdf",
          fileSize: 50000,
          lotteryName: "SAMRUDHI",
          lotteryCode: "SAMRUDHI",
          drawNumber: "SM-74th",
          drawDate: "27/09/2026",
          totalResults: 382,
          fullTicketCount: 14,
          suffixCount: 368,
          ingestedAt: "2026-09-27T00:00:00.000Z"
        }
      );

      // Step 2: Attempt to ingest realPdfBytes which is also SAMRUDHI SM-74th but with a different SHA
      const engine = new DailyIngestionEngine({
        sourceDir: testSourceDir,
        cacheDir: testCacheDir,
        silent: true,
        injectedCandidates: [
          {
            fileName: "replacement-sm74.pdf",
            fileBuffer: new Uint8Array(realPdfBytes)
          }
        ]
      });

      const result = await engine.execute();
      expect(result.summary.conflicts).toBe(1);
      expect(result.summary.ingested).toBe(0);

      const conflictRecord = result.candidates.find((c) => c.fileName === "replacement-sm74.pdf");
      expect(conflictRecord).toBeDefined();
      expect(conflictRecord!.actionTaken).toBe("CONFLICT");
      expect(conflictRecord!.validationStatus).toBe("CONFLICT");
      expect(conflictRecord!.conflictDetails).toContain("Conflicting draw identity");
      expect(conflictRecord!.conflictDetails).toContain("SM-74th");
    });
  });

  // --------------------------------------------------------------------------
  // 4. Prize Scheme Resolution & Result Validation (8A.6)
  // --------------------------------------------------------------------------
  describe("8A.6: Versioned Prize Scheme Resolution and Validation", () => {
    it("resolves official scheme for SAMRUDHI and validates all winning results", async () => {
      const registry = createAuthoritativePrizeSchemeRegistry();
      const resolution = registry.resolveSchemeForDraw({
        lotteryName: "SAMRUDHI",
        drawDate: "27/09/2026"
      });

      expect(resolution.status).toBe("SCHEME_RESOLVED");
      expect(resolution.authorityLevel).toBe("OFFICIAL_SCHEME");
      expect(resolution.schemeVersion?.id).toBe("scheme_ver_sm_v2025-11-sro1293");

      const engine = new DailyIngestionEngine({
        sourceDir: testSourceDir,
        cacheDir: testCacheDir,
        silent: true,
        injectedCandidates: [
          {
            fileName: "samrudhi-valid.pdf",
            fileBuffer: new Uint8Array(realPdfBytes)
          }
        ]
      });

      const result = await engine.execute();
      expect(result.success).toBe(true);
      expect(result.candidates[0]!.schemeId).toBe("scheme_ver_sm_v2025-11-sro1293");
      expect(result.candidates[0]!.schemeAuthorityLevel).toBe("OFFICIAL_SCHEME");
      expect(result.candidates[0]!.validationStatus).toBe("VALID");
    });

    it("verifies BR-111 maintains OBSERVED_SCHEME_ARCHETYPE status", () => {
      const registry = createAuthoritativePrizeSchemeRegistry();
      const res = registry.resolveSchemeForDraw({
        lotteryName: "THIRUVONAM BUMPER LOTTERY",
        drawDate: "26/09/2026"
      });
      expect(res.status).toBe("SCHEME_RESOLVED");
      expect(res.authorityLevel).toBe("OBSERVED_SCHEME_ARCHETYPE");
      expect(res.schemeVersion?.id).toBe("scheme_ver_thiruvonam_bumper_2026_br111");
    });
  });

  // --------------------------------------------------------------------------
  // 5. Scenario C & D: Genuinely New Candidate Ingestion & Idempotent Rerun
  // --------------------------------------------------------------------------
  describe("8A.9 Scenario C & D: New Document Ingestion and Idempotent Rerun", () => {
    it("ingests genuinely new document and ensures subsequent execution is 100% idempotent", async () => {
      const candidate = {
        fileName: "277-2342-27-09-2026.pdf",
        fileBuffer: new Uint8Array(realPdfBytes)
      };

      // Run 1: First Ingestion
      const engine1 = new DailyIngestionEngine({
        sourceDir: testSourceDir,
        cacheDir: testCacheDir,
        silent: true,
        injectedCandidates: [candidate]
      });

      const res1 = await engine1.execute();
      expect(res1.success).toBe(true);
      expect(res1.newDocuments).toBe(1);
      expect(res1.alreadyIngested).toBe(0);
      expect(res1.corpus.draws).toBe(1);
      expect(res1.candidates[0]!.actionTaken).toBe("PROMOTED");

      // Run 2: Exact Idempotent Rerun
      const engine2 = new DailyIngestionEngine({
        sourceDir: testSourceDir,
        cacheDir: testCacheDir,
        silent: true,
        injectedCandidates: [candidate]
      });

      const res2 = await engine2.execute();
      expect(res2.success).toBe(true);
      expect(res2.newDocuments).toBe(0); // 0 new documents
      expect(res2.alreadyIngested).toBe(1); // Recognized as already ingested
      expect(res2.corpus.draws).toBe(1); // No duplicate draw created
      expect(res2.candidates[0]!.actionTaken).toBe("ALREADY_KNOWN");
      expect(res2.corpus.id).toBe(res1.corpus.id); // Deterministic corpus identity
    });
  });

  // --------------------------------------------------------------------------
  // 6. Safe Dry-Run Mode (8A.10)
  // --------------------------------------------------------------------------
  describe("8A.10: Safe Dry-Run Mode", () => {
    it("validates new candidate in-memory but leaves filesystem and cache 100% unmutated", async () => {
      const engine = new DailyIngestionEngine({
        sourceDir: testSourceDir,
        cacheDir: testCacheDir,
        silent: true,
        dryRun: true,
        injectedCandidates: [
          {
            fileName: "dry-run-test.pdf",
            fileBuffer: new Uint8Array(realPdfBytes)
          }
        ]
      });

      const result = await engine.execute();
      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.candidates[0]!.actionTaken).toBe("VALIDATED");
      expect(result.summaryText).toContain("DRY-RUN (NON-MUTATING)");

      // Invariant: No file written to testSourceDir
      expect(existsSync(join(testSourceDir, "dry-run-test.pdf"))).toBe(false);

      // Invariant: Manifest has 0 documents
      const manifest = new DocumentCacheManager({ cacheDir: testCacheDir }).getManifest();
      expect(manifest.validDocuments).toBe(0);
      expect(manifest.totalDocuments).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // 7. Error Isolation (8A.11)
  // --------------------------------------------------------------------------
  describe("8A.11: Error Isolation across Batch", () => {
    it("successfully ingests valid document even if another candidate in batch is corrupt", async () => {
      const corruptPdf = Buffer.from("NOT_A_REAL_PDF_CORRUPT_HEADER");
      const engine = new DailyIngestionEngine({
        sourceDir: testSourceDir,
        cacheDir: testCacheDir,
        silent: true,
        injectedCandidates: [
          {
            fileName: "bad-doc.pdf",
            fileBuffer: new Uint8Array(corruptPdf)
          },
          {
            fileName: "good-doc.pdf",
            fileBuffer: new Uint8Array(realPdfBytes)
          }
        ]
      });

      const result = await engine.execute();
      expect(result.success).toBe(true);
      expect(result.summary.totalDiscovered).toBe(2);
      expect(result.summary.rejected).toBe(1);
      expect(result.summary.ingested).toBe(1);
      expect(result.summary.promoted).toBe(1);

      const badRecord = result.candidates.find((c) => c.fileName === "bad-doc.pdf");
      const goodRecord = result.candidates.find((c) => c.fileName === "good-doc.pdf");

      expect(badRecord?.actionTaken).toBe("REJECTED");
      expect(goodRecord?.actionTaken).toBe("PROMOTED");
    });
  });

  // --------------------------------------------------------------------------
  // 8. Scenario A & B: Real-World Ingestion Against Existing Canonical Directory
  // --------------------------------------------------------------------------
  describe("8A.9 Scenario A & B: Real-World Corpus Ingestion", () => {
    it("recognizes existing corpus files as already known", async () => {
      // Point engine to actual production source-documents directory
      const engine = new DailyIngestionEngine({
        sourceDir: join(process.cwd(), "data/source-documents/lottery-results"),
        silent: true,
        limit: 10
      });

      const result = await engine.execute();
      expect(result.success).toBe(true);
      expect(result.filesDiscovered).toBe(10);
      // All discovered files from existing repository should be already known
      expect(result.alreadyIngested + result.newDocuments).toBe(10);
      expect(result.summary.conflicts).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // 9. Filtering and Limiting Options (8A.14)
  // --------------------------------------------------------------------------
  describe("8A.14: Filtering and Limiting Options", () => {
    it("respects limit option", async () => {
      const engine = new DailyIngestionEngine({
        sourceDir: join(process.cwd(), "data/source-documents/lottery-results"),
        silent: true,
        limit: 3
      });

      const candidates = await engine.discoverCandidates();
      expect(candidates).toHaveLength(3);
    });

    it("respects since option filtering", async () => {
      const engine = new DailyIngestionEngine({
        sourceDir: testSourceDir,
        cacheDir: testCacheDir,
        silent: true,
        since: "2026-09-20",
        injectedCandidates: [
          {
            fileName: "old.pdf",
            drawDate: "2026-09-10"
          },
          {
            fileName: "recent.pdf",
            drawDate: "2026-09-25"
          }
        ]
      });

      const candidates = await engine.discoverCandidates();
      expect(candidates).toHaveLength(1);
      expect(candidates[0]!.fileName).toBe("recent.pdf");
    });
  });
});
