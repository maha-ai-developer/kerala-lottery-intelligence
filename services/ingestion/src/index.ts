/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * PDF Ingestion Service Pipeline
 * 
 * CORE PRINCIPLE:
 * Deterministic parsing + validation remains authoritative.
 * LLMs may only assist ambiguous documents, never as the single unverified parser.
 */

import type { SourceDocument, Draw, WinningNumber, PrizeResult } from "@kerala-lottery/domain";

export interface IngestionPipelineInput {
  fileName: string;
  fileBuffer: Buffer | Uint8Array;
  mimeType: string;
  sourceUrl?: string;
}

export interface ParsedDrawResult {
  document: SourceDocument;
  draw: Draw;
  prizeResults: PrizeResult[];
  winningNumbers: WinningNumber[];
  validationErrors: string[];
}

export interface IngestionPipeline {
  computeSha256(buffer: Buffer | Uint8Array): Promise<string>;
  checkDuplicate(sha256: string): Promise<boolean>;
  extractText(buffer: Buffer | Uint8Array): Promise<string[]>; // Array of page texts
  parseLotteryPdf(documentId: string, pageTexts: string[]): Promise<ParsedDrawResult>;
}
