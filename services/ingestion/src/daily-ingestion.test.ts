/**
 * Unit & Integration Tests for Milestone 7A.5:
 * Incremental Daily Ingestion, Document Cache, and Cross-Document Validation
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rmSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CrossDocumentValidator } from "./cross-document-validator";
import { DocumentCacheManager } from "./document-cache";
import { DailyIngestionEngine } from "./daily-ingestion-engine";
import type { LotteryKnowledgeGraph } from "@kerala-lottery/knowledge";

describe("Milestone 7A.5 — Incremental Daily Ingestion & Cross-Document Validation", () => {
  const testCacheDir = join(process.cwd(), "tmp/test-cache-7a5");
  const testSourceDir = join(process.cwd(), "tmp/test-sources-7a5");

  beforeEach(() => {
    if (existsSync(testCacheDir)) rmSync(testCacheDir, { recursive: true, force: true });
    if (existsSync(testSourceDir)) rmSync(testSourceDir, { recursive: true, force: true });
    mkdirSync(testCacheDir, { recursive: true });
    mkdirSync(testSourceDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testCacheDir)) rmSync(testCacheDir, { recursive: true, force: true });
    if (existsSync(testSourceDir)) rmSync(testSourceDir, { recursive: true, force: true });
  });

  function createMockGraph(
    sha: string,
    lottery: string,
    drawNumber: string,
    drawDate: string,
    results: Array<{ canonicalNumber: string; isSuffix: boolean; series?: string; amount?: number }>
  ): LotteryKnowledgeGraph {
    const drawId = `draw_${lottery}_${drawNumber}_${sha.slice(0, 8)}`;
    const nodes: any[] = [
      {
        id: `lottery_${lottery}`,
        type: "Lottery",
        label: lottery,
        properties: { name: lottery, code: lottery }
      },
      {
        id: drawId,
        type: "Draw",
        label: `Draw ${drawNumber}`,
        properties: { drawNumber, drawDate, lotteryName: lottery }
      },
      {
        id: `tier_1st_${drawId}`,
        type: "PrizeTier",
        label: "1st Prize",
        properties: { rank: "1", name: "1st Prize", amount: 100000 }
      }
    ];

    results.forEach((r, idx) => {
      nodes.push({
        id: `res_${drawId}_${idx}`,
        type: "WinningResult",
        label: `Result ${r.canonicalNumber}`,
        properties: {
          canonicalNumber: r.canonicalNumber,
          rawNumber: r.canonicalNumber,
          isSuffix: r.isSuffix,
          series: r.series,
          amount: r.amount ?? 5000,
          rank: "1",
          documentSha256: sha,
          drawId
        }
      });
    });

    return {
      documentSha256: sha,
      nodes,
      edges: [],
      metadata: {
        nodeCount: nodes.length,
        edgeCount: 0,
        extractedAt: "2026-09-27T00:00:00.000Z",
        graphVersion: "v1.0.0-knowledge-graph"
      }
    };
  }

  describe("CrossDocumentValidator", () => {
    it("accepts a clean batch of unique graphs", () => {
      const g1 = createMockGraph(
        "1111111111111111111111111111111111111111111111111111111111111111",
        "STHREE_SAKTHI",
        "101",
        "2026-09-01",
        [{ canonicalNumber: "123456", isSuffix: false, series: "SA" }]
      );
      const g2 = createMockGraph(
        "2222222222222222222222222222222222222222222222222222222222222222",
        "BHAGYATHARA",
        "102",
        "2026-09-02",
        [{ canonicalNumber: "654321", isSuffix: false, series: "BA" }]
      );

      const report = CrossDocumentValidator.validateBatch([g1, g2]);
      expect(report.isValid).toBe(true);
      expect(report.errors).toHaveLength(0);
      expect(report.totalGraphs).toBe(2);
      expect(report.totalDraws).toBe(2);
      expect(report.totalWinningResults).toBe(2);
    });

    it("rejects duplicate SHA-256 within the batch", () => {
      const sha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
      const g1 = createMockGraph(sha, "WIN_WIN", "1", "2026-09-01", [{ canonicalNumber: "1234", isSuffix: true }]);
      const g2 = createMockGraph(sha, "WIN_WIN", "2", "2026-09-02", [{ canonicalNumber: "5678", isSuffix: true }]);

      const report = CrossDocumentValidator.validateBatch([g1, g2]);
      expect(report.isValid).toBe(false);
      expect(report.errors.some((e) => e.type === "DUPLICATE_SHA")).toBe(true);
      expect(report.quarantinedShas).toContain(sha);
    });

    it("rejects conflicting draw numbers across different lotteries", () => {
      const g1 = createMockGraph(
        "3333333333333333333333333333333333333333333333333333333333333333",
        "LOTTERY_A",
        "500",
        "2026-09-01",
        [{ canonicalNumber: "1111", isSuffix: true }]
      );
      const g2 = createMockGraph(
        "4444444444444444444444444444444444444444444444444444444444444444",
        "LOTTERY_B",
        "500",
        "2026-09-02",
        [{ canonicalNumber: "2222", isSuffix: true }]
      );

      const report = CrossDocumentValidator.validateBatch([g1, g2]);
      expect(report.isValid).toBe(false);
      expect(report.errors.some((e) => e.type === "CONFLICTING_DRAW")).toBe(true);
    });

    it("rejects suffix results containing series", () => {
      const g1 = createMockGraph(
        "5555555555555555555555555555555555555555555555555555555555555555",
        "SAMRUDHI",
        "701",
        "2026-09-01",
        [{ canonicalNumber: "1234", isSuffix: true, series: "SM" }] // illegal series on suffix
      );

      const report = CrossDocumentValidator.validateBatch([g1]);
      expect(report.isValid).toBe(false);
      expect(report.errors.some((e) => e.type === "SERIES_SUFFIX_VIOLATION")).toBe(true);
    });

    it("rejects malformed non-numeric results", () => {
      const g1 = createMockGraph(
        "6666666666666666666666666666666666666666666666666666666666666666",
        "KARUNYA",
        "801",
        "2026-09-01",
        [{ canonicalNumber: "12A456", isSuffix: false, series: "KA" }] // illegal non-digit
      );

      const report = CrossDocumentValidator.validateBatch([g1]);
      expect(report.isValid).toBe(false);
      expect(report.errors.some((e) => e.type === "MALFORMED_NUMBER")).toBe(true);
    });
  });

  describe("DocumentCacheManager", () => {
    it("saves and reloads knowledge graphs and maintains manifest", () => {
      const cacheManager = new DocumentCacheManager({ cacheDir: testCacheDir });
      const sha = "7777777777777777777777777777777777777777777777777777777777777777";
      const g = createMockGraph(sha, "WIN_WIN", "901", "2026-09-01", [
        { canonicalNumber: "9999", isSuffix: true }
      ]);

      expect(cacheManager.has(sha)).toBe(false);

      cacheManager.saveValidGraph(g, {
        fileName: "test-draw.pdf",
        fileSize: 1024,
        lotteryName: "WIN_WIN",
        lotteryCode: "WIN_WIN",
        drawNumber: "901",
        drawDate: "2026-09-01",
        totalResults: 1,
        fullTicketCount: 0,
        suffixCount: 1,
        ingestedAt: new Date().toISOString()
      });

      expect(cacheManager.has(sha)).toBe(true);
      const loaded = cacheManager.getGraph(sha);
      expect(loaded).not.toBeNull();
      expect(loaded?.documentSha256).toBe(sha);

      const manifest = cacheManager.getManifest();
      expect(manifest.validDocuments).toBe(1);
      expect(manifest.documents[sha]?.status).toBe("VALID");
    });

    it("records quarantined documents in manifest", () => {
      const cacheManager = new DocumentCacheManager({ cacheDir: testCacheDir });
      const sha = "8888888888888888888888888888888888888888888888888888888888888888";

      cacheManager.recordQuarantine(sha, {
        fileName: "corrupt.pdf",
        fileSize: 10,
        reason: "Invalid PDF header"
      });

      expect(cacheManager.has(sha)).toBe(true);
      const record = cacheManager.getRecord(sha);
      expect(record?.status).toBe("QUARANTINED");
      expect(record?.quarantineReason).toBe("Invalid PDF header");
    });
  });

  describe("DailyIngestionEngine Quarantine Handling", () => {
    it("quarantines malformed non-PDF files without crashing", async () => {
      // Put a non-PDF file with .pdf extension into test source dir
      const corruptFile = join(testSourceDir, "corrupt-file.pdf");
      writeFileSync(corruptFile, Buffer.from("NOT_A_VALID_PDF_HEADER"));

      const engine = new DailyIngestionEngine({
        sourceDir: testSourceDir,
        cacheDir: testCacheDir,
        silent: true
      });

      const result = await engine.execute();
      expect(result.filesDiscovered).toBe(1);
      expect(result.invalidDocuments).toBe(1);
      expect(result.newDocuments).toBe(0);
    });
  });
});
