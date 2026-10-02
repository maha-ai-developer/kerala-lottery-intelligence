/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 7A.5 — Incremental Ingestion Document Cache & Manifest Manager
 *
 * Implements deterministic local caching of validated knowledge graphs and
 * document ingestion records to ensure:
 * 1. Previously validated source documents are NOT reparsed unnecessarily.
 * 2. Daily runs operate in seconds rather than minute-long full reparsing.
 * 3. Document provenance and ingestion timestamps are preserved immutably.
 * 4. Quarantined or invalid documents are tracked explicitly.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { LotteryKnowledgeGraph } from "@kerala-lottery/knowledge";

export interface IngestedDocumentRecord {
  sha256: string;
  fileName: string;
  canonicalFilename?: string;
  sourceResponseFilename?: string;
  sourceUrl?: string;
  fileSize: number;
  lotteryName: string;
  lotteryCode: string;
  drawNumber: string;
  drawDate: string;
  totalResults: number;
  fullTicketCount: number;
  suffixCount: number;
  ingestedAt: string;
  status: "VALID" | "QUARANTINED";
  quarantineReason?: string;
}

export interface IngestionManifest {
  version: string;
  updatedAt: string;
  totalDocuments: number;
  validDocuments: number;
  quarantinedDocuments: number;
  documents: Record<string, IngestedDocumentRecord>;
}

export interface DocumentCacheOptions {
  cacheDir?: string;
}

export class DocumentCacheManager {
  private readonly baseDir: string;
  private readonly graphsDir: string;
  private readonly manifestPath: string;
  private manifest: IngestionManifest;

  constructor(options?: DocumentCacheOptions) {
    this.baseDir = options?.cacheDir ?? join(process.cwd(), "data/processed-cache");
    this.graphsDir = join(this.baseDir, "graphs");
    this.manifestPath = join(this.baseDir, "manifest.json");

    this.ensureDirs();
    this.manifest = this.loadManifest();
  }

  private ensureDirs(): void {
    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true });
    }
    if (!existsSync(this.graphsDir)) {
      mkdirSync(this.graphsDir, { recursive: true });
    }
  }

  private loadManifest(): IngestionManifest {
    if (existsSync(this.manifestPath)) {
      try {
        const raw = readFileSync(this.manifestPath, "utf-8");
        return JSON.parse(raw) as IngestionManifest;
      } catch {
        // Fall back to clean manifest if corrupted
      }
    }
    return {
      version: "v1.0.0-ingestion-manifest",
      updatedAt: new Date().toISOString(),
      totalDocuments: 0,
      validDocuments: 0,
      quarantinedDocuments: 0,
      documents: {}
    };
  }

  public persistManifest(fixedUpdatedAt?: string): void {
    if (fixedUpdatedAt) {
      this.manifest.updatedAt = fixedUpdatedAt;
    } else if (!this.manifest.updatedAt) {
      this.manifest.updatedAt = new Date().toISOString();
    }
    const docKeys = Object.keys(this.manifest.documents).sort();
    const sortedDocs: Record<string, IngestedDocumentRecord> = {};
    for (const k of docKeys) {
      const doc = this.manifest.documents[k];
      if (doc) {
        sortedDocs[k] = doc;
      }
    }
    this.manifest.documents = sortedDocs;

    const docValues = Object.values(this.manifest.documents);
    this.manifest.totalDocuments = docValues.length;
    this.manifest.validDocuments = docValues.filter((d) => d.status === "VALID").length;
    this.manifest.quarantinedDocuments = docValues.filter((d) => d.status === "QUARANTINED").length;

    writeFileSync(this.manifestPath, JSON.stringify(this.manifest, null, 2) + "\n", "utf-8");
  }

  public static deriveCountsFromGraph(graph: LotteryKnowledgeGraph): {
    totalResults: number;
    fullTicketCount: number;
    suffixCount: number;
  } {
    let fullTicketCount = 0;
    let suffixCount = 0;

    for (const node of graph.nodes) {
      if (node.type === "WinningResult") {
        if (node.properties?.isSuffix === false) {
          fullTicketCount++;
        } else if (node.properties?.isSuffix === true) {
          suffixCount++;
        }
      }
    }

    return {
      totalResults: fullTicketCount + suffixCount,
      fullTicketCount,
      suffixCount
    };
  }

  public has(sha256: string): boolean {
    const record = this.manifest.documents[sha256];
    if (!record) return false;
    if (record.status === "QUARANTINED") return true;
    const graphFile = join(this.graphsDir, `${sha256}.json`);
    return existsSync(graphFile);
  }

  public getRecord(sha256: string): IngestedDocumentRecord | undefined {
    return this.manifest.documents[sha256];
  }

  public getGraph(sha256: string): LotteryKnowledgeGraph | null {
    const graphFile = join(this.graphsDir, `${sha256}.json`);
    if (!existsSync(graphFile)) return null;
    try {
      const raw = readFileSync(graphFile, "utf-8");
      return JSON.parse(raw) as LotteryKnowledgeGraph;
    } catch {
      return null;
    }
  }

  public saveValidGraph(
    graph: LotteryKnowledgeGraph,
    meta: Omit<IngestedDocumentRecord, "status" | "sha256" | "totalResults" | "fullTicketCount" | "suffixCount"> &
      Partial<Pick<IngestedDocumentRecord, "totalResults" | "fullTicketCount" | "suffixCount">>
  ): void {
    const sha = graph.documentSha256;
    const graphFile = join(this.graphsDir, `${sha}.json`);
    writeFileSync(graphFile, JSON.stringify(graph, null, 2), "utf-8");

    // CRITICAL: Always derive authoritative counts from graph nodes directly
    const counts = DocumentCacheManager.deriveCountsFromGraph(graph);

    this.manifest.documents[sha] = {
      ...meta,
      sha256: sha,
      totalResults: counts.totalResults,
      fullTicketCount: counts.fullTicketCount,
      suffixCount: counts.suffixCount,
      status: "VALID"
    };
    this.persistManifest();
  }

  public recordQuarantine(sha256: string, meta: { fileName: string; fileSize: number; reason: string }): void {
    this.manifest.documents[sha256] = {
      sha256,
      fileName: meta.fileName,
      fileSize: meta.fileSize,
      lotteryName: "UNKNOWN",
      lotteryCode: "UNKNOWN",
      drawNumber: "UNKNOWN",
      drawDate: "UNKNOWN",
      totalResults: 0,
      fullTicketCount: 0,
      suffixCount: 0,
      ingestedAt: new Date().toISOString(),
      status: "QUARANTINED",
      quarantineReason: meta.reason
    };
    this.persistManifest();
  }

  public regenerateManifest(options?: { fixedUpdatedAt?: string }): IngestionManifest {
    if (!existsSync(this.graphsDir)) {
      return this.manifest;
    }

    const files = readdirSync(this.graphsDir)
      .filter((f) => f.endsWith(".json"))
      .sort();

    const updatedDocuments: Record<string, IngestedDocumentRecord> = {};

    // Preserve quarantined records
    for (const [sha, doc] of Object.entries(this.manifest.documents)) {
      if (doc.status === "QUARANTINED") {
        updatedDocuments[sha] = { ...doc };
      }
    }

    for (const file of files) {
      const sha = file.replace(/\.json$/, "");
      const graph = this.getGraph(sha);
      if (!graph) continue;

      const counts = DocumentCacheManager.deriveCountsFromGraph(graph);

      // Extract metadata from graph nodes if missing
      const lotteryNode = graph.nodes.find((n) => n.type === "Lottery");
      const drawNode = graph.nodes.find((n) => n.type === "Draw");
      const docNode = graph.nodes.find((n) => n.type === "SourceDocument");

      const existing = this.manifest.documents[sha];

      const lotteryName = existing?.lotteryName || (lotteryNode?.properties?.name as string) || "UNKNOWN";
      const lotteryCode = existing?.lotteryCode || (lotteryNode?.properties?.code as string) || "UNKNOWN";
      const drawNumber = existing?.drawNumber || (drawNode?.properties?.drawNumber as string) || "UNKNOWN";
      const drawDate = existing?.drawDate || (drawNode?.properties?.drawDate as string) || "UNKNOWN";
      const fileName = existing?.fileName || `${sha}.pdf`;
      const fileSize = existing?.fileSize || (docNode?.properties?.fileSize as number) || 0;
      const ingestedAt = existing?.ingestedAt || graph.nodes[0]?.createdAt || new Date().toISOString();

      updatedDocuments[sha] = {
        sha256: sha,
        fileName,
        canonicalFilename: existing?.canonicalFilename,
        sourceResponseFilename: existing?.sourceResponseFilename,
        sourceUrl: existing?.sourceUrl,
        fileSize,
        lotteryName,
        lotteryCode,
        drawNumber,
        drawDate,
        totalResults: counts.totalResults,
        fullTicketCount: counts.fullTicketCount,
        suffixCount: counts.suffixCount,
        ingestedAt,
        status: "VALID"
      };
    }

    this.manifest.documents = updatedDocuments;
    this.persistManifest(options?.fixedUpdatedAt);
    return this.manifest;
  }

  public getAllValidGraphs(): LotteryKnowledgeGraph[] {
    const graphs: LotteryKnowledgeGraph[] = [];
    for (const [sha, doc] of Object.entries(this.manifest.documents)) {
      if (doc.status === "VALID") {
        const g = this.getGraph(sha);
        if (g) graphs.push(g);
      }
    }
    return graphs;
  }

  public getManifest(): IngestionManifest {
    return this.manifest;
  }
}
