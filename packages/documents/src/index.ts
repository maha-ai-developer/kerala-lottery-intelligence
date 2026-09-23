import { createHash } from "node:crypto";
import type { DocumentType, SourceDocument } from "@kerala-lottery/domain";

export type { SourceDocument, DocumentType };

/**
 * Deterministic synthetic PDF fixture for DEV testing & integration verification.
 */
export const DEV_SYNTHETIC_FIXTURE_BYTES: Uint8Array = new Uint8Array(
  Buffer.from(
    "%PDF-1.4\n" +
    "% Kerala State Lottery Intelligence DEV Synthetic Ingestion Fixture\n" +
    "% Milestone 3A Invariant Verification Fixture\n" +
    "1 0 obj\n" +
    "<< /Type /Catalog /Pages 2 0 R >>\n" +
    "endobj\n" +
    "2 0 obj\n" +
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n" +
    "endobj\n" +
    "3 0 obj\n" +
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\n" +
    "endobj\n" +
    "trailer\n" +
    "<< /Root 1 0 R >>\n" +
    "%%EOF"
  )
);

export const DEV_SYNTHETIC_FIXTURE_SHA256 =
  "2b8ed894e0e6da419e81b54d760322c574cf88a61f8d892bd309ad9148fc3acf";

export class DocumentValidationError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "DocumentValidationError";
  }
}

/**
 * Computes deterministic lowercase hexadecimal SHA-256 hash of a Uint8Array or Buffer.
 */
export function computeSha256(data: Uint8Array): string {
  if (!(data instanceof Uint8Array)) {
    throw new DocumentValidationError(
      `Data must be an instance of Uint8Array or Buffer, received ${typeof data}`,
      "INVALID_DATA_TYPE"
    );
  }
  return createHash("sha256").update(data).digest("hex").toLowerCase();
}

/**
 * Derives canonical immutable storage path for a source document from its SHA-256.
 * Format: source-documents/{sha256}.pdf
 */
export function getSourceStoragePath(sha256: string): string {
  if (typeof sha256 !== "string") {
    throw new DocumentValidationError(
      `Expected sha256 to be string, received ${typeof sha256}`,
      "INVALID_SHA256_TYPE"
    );
  }
  const normalized = sha256.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    throw new DocumentValidationError(
      `Invalid SHA-256 hash: '${sha256}'. Expected 64 lowercase hexadecimal characters.`,
      "INVALID_SHA256_FORMAT"
    );
  }
  return `source-documents/${normalized}.pdf`;
}

/**
 * Validates raw PDF buffer prior to ingestion.
 * Ensures data is non-empty, of valid type, and starts with the standard '%PDF-' magic header.
 */
export function validatePdfBuffer(data: unknown): void {
  if (!(data instanceof Uint8Array)) {
    throw new DocumentValidationError(
      `Expected PDF data to be Uint8Array or Buffer, received ${typeof data}`,
      "INVALID_BUFFER_TYPE"
    );
  }
  if (data.byteLength === 0) {
    throw new DocumentValidationError("PDF buffer cannot be empty (0 bytes)", "EMPTY_BUFFER");
  }
  if (data.byteLength < 5) {
    throw new DocumentValidationError("Buffer is too small to be a valid PDF", "INVALID_PDF_HEADER");
  }

  // Check '%PDF-' magic bytes: 0x25, 0x50, 0x44, 0x46, 0x2D
  const header = Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString("latin1", 0, 5);
  if (header !== "%PDF-") {
    throw new DocumentValidationError(
      `Invalid PDF magic header. Expected '%PDF-', received '${header}'`,
      "INVALID_PDF_HEADER"
    );
  }
}

/**
 * Validates a SourceDocument domain entity ensuring cryptographic identity and provenance consistency.
 */
export function validateSourceDocument(doc: SourceDocument): void {
  if (!doc || typeof doc !== "object") {
    throw new DocumentValidationError("SourceDocument must be a valid object", "INVALID_DOCUMENT");
  }
  if (!doc.id || typeof doc.id !== "string") {
    throw new DocumentValidationError("Document ID must be a non-empty string", "INVALID_ID");
  }
  if (!/^[a-f0-9]{64}$/.test(doc.sha256)) {
    throw new DocumentValidationError(
      `Document sha256 must be a 64-character lowercase hex string, received '${doc.sha256}'`,
      "INVALID_SHA256"
    );
  }
  // Architectural Invariant: Document ID MUST be the full 64-character SHA-256
  if (doc.id !== doc.sha256) {
    throw new DocumentValidationError(
      `Document id ('${doc.id}') must match its sha256 hash ('${doc.sha256}')`,
      "ID_HASH_MISMATCH"
    );
  }
  if (doc.mimeType !== "application/pdf") {
    throw new DocumentValidationError(
      `Document mimeType must be 'application/pdf', received '${doc.mimeType}'`,
      "INVALID_MIME_TYPE"
    );
  }
  if (typeof doc.fileSize !== "number" || doc.fileSize <= 0 || !Number.isInteger(doc.fileSize)) {
    throw new DocumentValidationError(
      `Document fileSize must be a positive integer, received ${doc.fileSize}`,
      "INVALID_FILE_SIZE"
    );
  }
  const expectedPath = getSourceStoragePath(doc.sha256);
  if (doc.storagePath !== expectedPath) {
    throw new DocumentValidationError(
      `Document storagePath must be '${expectedPath}', received '${doc.storagePath}'`,
      "INVALID_STORAGE_PATH"
    );
  }
  if (!doc.sourceOrganization || typeof doc.sourceOrganization !== "string" || doc.sourceOrganization.trim() === "") {
    throw new DocumentValidationError(
      "Document sourceOrganization must be a non-empty string",
      "INVALID_ORGANIZATION"
    );
  }
  if (!doc.retrievedAt || isNaN(Date.parse(doc.retrievedAt))) {
    throw new DocumentValidationError(
      `Document retrievedAt must be a valid ISO 8601 timestamp, received '${doc.retrievedAt}'`,
      "INVALID_RETRIEVED_AT"
    );
  }
  if (!doc.ingestionVersion || typeof doc.ingestionVersion !== "string" || doc.ingestionVersion.trim() === "") {
    throw new DocumentValidationError(
      "Document ingestionVersion must be a non-empty string",
      "INVALID_INGESTION_VERSION"
    );
  }
  if (!doc.createdAt || isNaN(Date.parse(doc.createdAt))) {
    throw new DocumentValidationError(
      `Document createdAt must be a valid ISO 8601 timestamp, received '${doc.createdAt}'`,
      "INVALID_CREATED_AT"
    );
  }
}


export interface DocumentClassificationResult {
  detectedType: DocumentType;
  confidence: number;
  extractedTitle?: string;
  gazetteNumber?: string;
  drawDate?: string;
  drawNumber?: string;
}

/**
 * Heuristic document classifier based on text snippets and layout markers.
 */
export function classifyDocumentText(extractedText: string): DocumentClassificationResult {
  const upper = extractedText.toUpperCase();

  if (
    upper.includes("KERALA STATE LOTTERIES") &&
    (upper.includes("DRAW NO") || upper.includes("RESULTS") || upper.includes("PRIZE"))
  ) {
    return {
      detectedType: "LOTTERY_RESULT",
      confidence: 0.95
    };
  }

  if (
    upper.includes("KERALA PAPER LOTTERIES (REGULATION) RULES") ||
    upper.includes("LOTTERY RULES")
  ) {
    return {
      detectedType: "RULE",
      confidence: 0.9
    };
  }

  if (upper.includes("USER MANUAL") || upper.includes("AGENT USER MANUAL")) {
    return {
      detectedType: "MANUAL",
      confidence: 0.95
    };
  }

  if (upper.includes("AMENDMENT") || upper.includes("S.R.O.")) {
    return {
      detectedType: "AMENDMENT",
      confidence: 0.85
    };
  }

  return {
    detectedType: "OTHER",
    confidence: 0.5
  };
}
