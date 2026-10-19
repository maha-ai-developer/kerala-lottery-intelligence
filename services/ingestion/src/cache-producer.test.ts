/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Regression Test Suite — Cache Producer & Manifest Count Generator
 *
 * Verifies that the processed-cache manifest producer:
 * 1. Derives fullTicketCount, suffixCount, and totalResults directly from authoritative knowledge graph nodes.
 * 2. Classifies isSuffix === false as full-ticket results, and isSuffix === true as suffix results.
 * 3. Guarantees fullTicketCount + suffixCount = totalResults for every document.
 * 4. Corrects historical defects for BR-110 (20 full, 678 suffix, 698 total) and BR-111 (70 full, 594 suffix, 664 total).
 * 5. Guarantees determinism in manifest regeneration.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, cpSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DocumentCacheManager } from "./document-cache";
import { DailyIngestionEngine } from "./daily-ingestion-engine";
import type { LotteryKnowledgeGraph } from "@kerala-lottery/knowledge";

describe("Cache Producer — Manifest Count Generation & Determinism", () => {
  const BR110_SHA = "0a2d3bf52c34b0daf9743f2b6de95f31c530dae39e6aa6286efe4dd69d87aa06";
  const BR111_SHA = "f89bd80ca46cd5b0beab395f2d75f2eda81e83b6460f28dcb4f52eacf44511c3";

  let testCacheDir: string;
  let cacheManager: DocumentCacheManager;

  beforeEach(() => {
    testCacheDir = mkdtempSync(join(tmpdir(), "cache-producer-test-"));
    // Copy the real processed-cache data into the isolated test directory
    const realCacheDir = join(process.cwd(), "data/processed-cache");
    cpSync(realCacheDir, testCacheDir, { recursive: true });
    cacheManager = new DocumentCacheManager({ cacheDir: testCacheDir });
  });

  afterEach(() => {
    rmSync(testCacheDir, { recursive: true, force: true });
  });

  it("regression: correctly derives authoritative counts for BR-110 from graph nodes", () => {
    const graph = cacheManager.getGraph(BR110_SHA);
    expect(graph).not.toBeNull();

    const counts = DocumentCacheManager.deriveCountsFromGraph(graph!);
    expect(counts.fullTicketCount).toBe(20);
    expect(counts.suffixCount).toBe(678);
    expect(counts.totalResults).toBe(698);
    expect(counts.fullTicketCount + counts.suffixCount).toBe(counts.totalResults);
  });

  it("regression: correctly derives authoritative counts for BR-111 from graph nodes", () => {
    const graph = cacheManager.getGraph(BR111_SHA);
    expect(graph).not.toBeNull();

    const counts = DocumentCacheManager.deriveCountsFromGraph(graph!);
    expect(counts.fullTicketCount).toBe(70);
    expect(counts.suffixCount).toBe(594);
    expect(counts.totalResults).toBe(664);
    expect(counts.fullTicketCount + counts.suffixCount).toBe(counts.totalResults);
  });

  it("enforces classification: isSuffix === false -> full-ticket, isSuffix === true -> suffix", () => {
    const mockGraph: LotteryKnowledgeGraph = {
      documentSha256: "mock_sha_123",
      metadata: {
        graphVersion: "v1.0.0-knowledge-graph",
        extractedAt: "2026-10-02T00:00:00.000Z",
        nodeCount: 4,
        edgeCount: 0
      },
      nodes: [
        {
          id: "doc1",
          type: "SourceDocument",
          label: "Doc",
          properties: {},
          provenance: {} as any,
          createdAt: "2026-10-02T00:00:00.000Z"
        },
        {
          id: "r1",
          type: "WinningResult",
          label: "Result 1",
          properties: { isSuffix: false, canonicalNumber: "AB123456" },
          provenance: {} as any,
          createdAt: "2026-10-02T00:00:00.000Z"
        },
        {
          id: "r2",
          type: "WinningResult",
          label: "Result 2",
          properties: { isSuffix: false, canonicalNumber: "CD789012" },
          provenance: {} as any,
          createdAt: "2026-10-02T00:00:00.000Z"
        },
        {
          id: "r3",
          type: "WinningResult",
          label: "Result 3",
          properties: { isSuffix: true, canonicalNumber: "1234" },
          provenance: {} as any,
          createdAt: "2026-10-02T00:00:00.000Z"
        }
      ],
      edges: []
    };

    const counts = DocumentCacheManager.deriveCountsFromGraph(mockGraph);
    expect(counts.fullTicketCount).toBe(2);
    expect(counts.suffixCount).toBe(1);
    expect(counts.totalResults).toBe(3);
    expect(counts.fullTicketCount + counts.suffixCount).toBe(counts.totalResults);
  });

  it("saveValidGraph strictly overrides caller-supplied incorrect count metadata", () => {
    const graph = cacheManager.getGraph(BR110_SHA)!;

    // Simulate caller passing fullTicketCount = 0 (the old defect)
    cacheManager.saveValidGraph(graph, {
      fileName: "281-2279-18-07-2026.pdf",
      fileSize: 90697,
      lotteryName: "MONSOON BUMPER",
      lotteryCode: "MONSOON BUMPER",
      drawNumber: "BR-110th",
      drawDate: "18/07/2026",
      totalResults: 0,
      fullTicketCount: 0,
      suffixCount: 0,
      ingestedAt: "2026-09-28T05:26:18.416Z"
    });

    const record = cacheManager.getRecord(BR110_SHA);
    expect(record).toBeDefined();
    // Producer must derive 20 / 678 / 698 despite caller passing 0
    expect(record!.fullTicketCount).toBe(20);
    expect(record!.suffixCount).toBe(678);
    expect(record!.totalResults).toBe(698);
    expect(record!.fullTicketCount + record!.suffixCount).toBe(record!.totalResults);
  });

  it("regenerates manifest deterministically across the whole repository corpus", () => {
    const fixedTime = "2026-10-02T12:00:00.000Z";
    const manifest1 = cacheManager.regenerateManifest({ fixedUpdatedAt: fixedTime });
    const content1 = readFileSync(join(testCacheDir, "manifest.json"), "utf-8");

    // Regenerate second time
    const manifest2 = cacheManager.regenerateManifest({ fixedUpdatedAt: fixedTime });
    const content2 = readFileSync(join(testCacheDir, "manifest.json"), "utf-8");

    // Identical bit-for-bit
    expect(content1).toBe(content2);
    expect(manifest1.totalDocuments).toBe(manifest2.totalDocuments);
    expect(manifest1.validDocuments).toBe(manifest2.validDocuments);

    // Verify all valid documents satisfy total = full + suffix
    for (const doc of Object.values(manifest1.documents)) {
      if (doc.status === "VALID") {
        expect(doc.fullTicketCount + doc.suffixCount).toBe(doc.totalResults);
      }
    }

    // Verify BR-110 and BR-111 specifically
    expect(manifest1.documents[BR110_SHA]!.fullTicketCount).toBe(20);
    expect(manifest1.documents[BR110_SHA]!.suffixCount).toBe(678);
    expect(manifest1.documents[BR110_SHA]!.totalResults).toBe(698);

    expect(manifest1.documents[BR111_SHA]!.fullTicketCount).toBe(70);
    expect(manifest1.documents[BR111_SHA]!.suffixCount).toBe(594);
    expect(manifest1.documents[BR111_SHA]!.totalResults).toBe(664);
  });

  it("hydrates missing graphs deterministically from tracked PDFs without mutating manifest.json", async () => {
    const manifestBefore = readFileSync(join(testCacheDir, "manifest.json"), "utf-8");

    // Simulate missing BR-110 and BR-111 graphs (as on a clean checkout)
    rmSync(join(testCacheDir, "graphs", `${BR110_SHA}.json`), { force: true });
    rmSync(join(testCacheDir, "graphs", `${BR111_SHA}.json`), { force: true });

    const preVerify = new DocumentCacheManager({ cacheDir: testCacheDir }).verifyHydratedGraphs();
    expect(preVerify.valid).toBe(false);
    expect(preVerify.missingShas).toContain(BR110_SHA);
    expect(preVerify.missingShas).toContain(BR111_SHA);

    const engine = new DailyIngestionEngine({
      cacheDir: testCacheDir,
      silent: true,
      dryRun: true
    });

    const hydration1 = await engine.hydrateGraphCache();
    expect(hydration1.success).toBe(true);
    expect(hydration1.hydratedCount).toBe(2);
    expect(hydration1.verifiedGraphCount).toBe(hydration1.expectedValidDocuments);

    // Repeat call when all graphs are already cached must short-circuit with 0 hydrations
    const hydration2 = await engine.hydrateGraphCache();
    expect(hydration2.success).toBe(true);
    expect(hydration2.hydratedCount).toBe(0);
    expect(hydration2.alreadyCachedCount).toBe(hydration2.expectedValidDocuments);

    // Verify manifest.json is untouched bit-for-bit
    const manifestAfter = readFileSync(join(testCacheDir, "manifest.json"), "utf-8");
    expect(manifestAfter).toBe(manifestBefore);
  });

  it("fails fast with a clear diagnostic when required source PDFs or manifest records are missing", async () => {
    const emptySourceDir = mkdtempSync(join(tmpdir(), "empty-source-dir-"));
    try {
      rmSync(join(testCacheDir, "graphs", `${BR110_SHA}.json`), { force: true });
      const engineMissingPdf = new DailyIngestionEngine({
        sourceDir: emptySourceDir,
        cacheDir: testCacheDir,
        silent: true
      });
      await expect(engineMissingPdf.hydrateGraphCache()).rejects.toThrow(
        /Graph cache hydration failed: required source PDF/
      );

      const engineMissingDir = new DailyIngestionEngine({
        sourceDir: join(emptySourceDir, "non-existent-subdir"),
        cacheDir: testCacheDir,
        silent: true
      });
      await expect(engineMissingDir.hydrateGraphCache()).rejects.toThrow(
        /required source PDF directory does not exist/
      );

      writeFileSync(
        join(testCacheDir, "manifest.json"),
        JSON.stringify({
          version: "v1.0.0-ingestion-manifest",
          updatedAt: "2026-10-02T00:00:00.000Z",
          totalDocuments: 0,
          validDocuments: 0,
          quarantinedDocuments: 0,
          documents: {}
        }),
        "utf-8"
      );
      const engineEmptyManifest = new DailyIngestionEngine({
        cacheDir: testCacheDir,
        silent: true
      });
      await expect(engineEmptyManifest.hydrateGraphCache()).rejects.toThrow(
        /manifest\.json contains 0 VALID document records/
      );
    } finally {
      rmSync(emptySourceDir, { recursive: true, force: true });
    }
  });
});
