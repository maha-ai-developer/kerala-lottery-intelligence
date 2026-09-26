import { createHash } from "node:crypto";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import type {
  DocumentType,
  SourceDocument,
  OfficialSource,
  DocumentProvenance,
  HttpProvenanceMetadata,
  DocumentPage,
  TextBlock,
  PageExtractionStatus,
  PageGeometry
} from "@kerala-lottery/domain";

export type {
  SourceDocument,
  DocumentType,
  OfficialSource,
  DocumentProvenance,
  HttpProvenanceMetadata,
  DocumentPage,
  TextBlock,
  PageExtractionStatus,
  PageGeometry
};

/**
 * Official Kerala State Lottery Government Portal Descriptor.
 * Primary authoritative source for official result publications.
 */
export const KERALA_STATE_LOTTERY_PORTAL: OfficialSource = {
  sourceId: "KERALA_STATE_LOTTERY_PORTAL",
  sourceName: "Directorate of Kerala State Lotteries Official Portal",
  organization: "Directorate of Kerala State Lotteries",
  baseUrl: "https://statelottery.kerala.gov.in",
  discoveryUrl: "https://statelottery.kerala.gov.in/English/index.php/lottery-result-view",
  allowedDomains: [
    "statelottery.kerala.gov.in",
    "www.statelottery.kerala.gov.in",
    "result.keralalotteries.com"
  ],
  authorityEvidence: [
    "Domain registered under apex Government of Kerala namespace (.kerala.gov.in) managed by National Informatics Centre (NIC) and Government of India",
    "Official administrative body: Directorate of Kerala State Lotteries, Vikas Bhavan, Thiruvananthapuram, Kerala 695033",
    "Official result viewing domain: result.keralalotteries.com, officially framed and linked on statelottery.kerala.gov.in for live Gazette draw publications",
    "Developed and maintained by KELTRON (Kerala State Electronics Development Corporation Limited, a Government of Kerala undertaking) Software Group",
    "Referenced by apex Kerala Government portal (https://kerala.gov.in) as the official Directorate portal",
    "Official contact and notification endpoint: cru.dir.lotteries@kerala.gov.in, Ph: 0471-2305193"
  ],
  enabled: true,
  notes: "Primary official web portal publishing daily and bumper draw results under the Lotteries (Regulation) Act, 1998 and Kerala Paper Lotteries (Regulation) Rules, 2005."
};

export const OFFICIAL_SOURCES: Record<string, OfficialSource> = {
  [KERALA_STATE_LOTTERY_PORTAL.sourceId]: KERALA_STATE_LOTTERY_PORTAL
};

/**
 * Validates an OfficialSource descriptor ensuring all required authority and network fields are valid.
 */
export function validateOfficialSource(source: OfficialSource): void {
  if (!source || typeof source !== "object") {
    throw new DocumentValidationError("OfficialSource must be a valid object", "INVALID_SOURCE");
  }
  if (!source.sourceId || typeof source.sourceId !== "string" || source.sourceId.trim() === "") {
    throw new DocumentValidationError("OfficialSource sourceId must be a non-empty string", "INVALID_SOURCE_ID");
  }
  if (!source.organization || typeof source.organization !== "string" || source.organization.trim() === "") {
    throw new DocumentValidationError("OfficialSource organization must be a non-empty string", "INVALID_ORGANIZATION");
  }
  if (!source.sourceName || typeof source.sourceName !== "string" || source.sourceName.trim() === "") {
    throw new DocumentValidationError("OfficialSource sourceName must be a non-empty string", "INVALID_SOURCE_NAME");
  }
  if (!source.baseUrl || typeof source.baseUrl !== "string") {
    throw new DocumentValidationError("OfficialSource baseUrl must be a valid URL string", "INVALID_BASE_URL");
  }
  try {
    const parsedBase = new URL(source.baseUrl);
    if (!["http:", "https:"].includes(parsedBase.protocol)) {
      throw new Error("Invalid protocol");
    }
  } catch {
    throw new DocumentValidationError(`OfficialSource baseUrl '${source.baseUrl}' is not a valid HTTP(S) URL`, "INVALID_BASE_URL");
  }
  if (!source.discoveryUrl || typeof source.discoveryUrl !== "string") {
    throw new DocumentValidationError("OfficialSource discoveryUrl must be a valid URL string", "INVALID_DISCOVERY_URL");
  }
  try {
    const parsedDisc = new URL(source.discoveryUrl);
    if (!["http:", "https:"].includes(parsedDisc.protocol)) {
      throw new Error("Invalid protocol");
    }
  } catch {
    throw new DocumentValidationError(`OfficialSource discoveryUrl '${source.discoveryUrl}' is not a valid HTTP(S) URL`, "INVALID_DISCOVERY_URL");
  }
  if (!Array.isArray(source.allowedDomains) || source.allowedDomains.length === 0) {
    throw new DocumentValidationError("OfficialSource allowedDomains must be a non-empty array of domain strings", "INVALID_ALLOWED_DOMAINS");
  }
  for (const domain of source.allowedDomains) {
    if (typeof domain !== "string" || domain.trim() === "") {
      throw new DocumentValidationError("Each allowedDomain must be a non-empty string", "INVALID_ALLOWED_DOMAINS");
    }
  }
  if (!Array.isArray(source.authorityEvidence) || source.authorityEvidence.length === 0) {
    throw new DocumentValidationError("OfficialSource authorityEvidence must be a non-empty array of evidence statements", "INVALID_AUTHORITY_EVIDENCE");
  }
}

/**
 * Validates a target URL against SSRF, private networks, unsupported protocols,
 * and restricts requests strictly to configured official allowed domains.
 */
export function validateSafeUrl(urlStr: string, allowedDomains: string[]): URL {
  if (typeof urlStr !== "string" || urlStr.trim() === "") {
    throw new DocumentValidationError("Target URL must be a non-empty string", "INVALID_URL");
  }

  let parsed: URL;
  try {
    parsed = new URL(urlStr.trim());
  } catch {
    throw new DocumentValidationError(`Malformed URL: '${urlStr}'`, "MALFORMED_URL");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new DocumentValidationError(
      `Unsupported protocol '${parsed.protocol}'. Only HTTP and HTTPS are permitted.`,
      "UNSUPPORTED_PROTOCOL"
    );
  }

  const hostname = parsed.hostname.toLowerCase();

  // SSRF & Private Network Protection
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname === "metadata.google.internal" ||
    /^10\./.test(hostname) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^169\.254\./.test(hostname)
  ) {
    throw new DocumentValidationError(
      `Access to private/loopback network address '${hostname}' is strictly forbidden`,
      "SSRF_PROHIBITED_HOST"
    );
  }

  // Restrict to allowed domains
  const normalizedAllowed = allowedDomains.map((d) => d.toLowerCase().trim());
  const isAllowed = normalizedAllowed.some(
    (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`)
  );

  if (!isAllowed) {
    throw new DocumentValidationError(
      `Host '${hostname}' is not in the list of verified official allowed domains: [${allowedDomains.join(", ")}]`,
      "UNAUTHORIZED_HOST"
    );
  }

  return parsed;
}

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
  if (doc.provenance) {
    if (typeof doc.provenance !== "object") {
      throw new DocumentValidationError("Document provenance must be an object", "INVALID_PROVENANCE");
    }
    if (!doc.provenance.sourceId || typeof doc.provenance.sourceId !== "string") {
      throw new DocumentValidationError("Provenance sourceId must be a non-empty string", "INVALID_PROVENANCE_SOURCE_ID");
    }
    if (!doc.provenance.requestedUrl || typeof doc.provenance.requestedUrl !== "string") {
      throw new DocumentValidationError("Provenance requestedUrl must be a non-empty string", "INVALID_PROVENANCE_URL");
    }
    if (!doc.provenance.finalUrl || typeof doc.provenance.finalUrl !== "string") {
      throw new DocumentValidationError("Provenance finalUrl must be a non-empty string", "INVALID_PROVENANCE_URL");
    }
    if (!doc.provenance.httpMetadata || typeof doc.provenance.httpMetadata !== "object") {
      throw new DocumentValidationError("Provenance httpMetadata must be an object", "INVALID_PROVENANCE_HTTP_META");
    }
    if (doc.provenance.httpMetadata.sha256 !== doc.sha256) {
      throw new DocumentValidationError(
        `Provenance httpMetadata sha256 ('${doc.provenance.httpMetadata.sha256}') must match document sha256 ('${doc.sha256}')`,
        "PROVENANCE_SHA_MISMATCH"
      );
    }
    if (doc.provenance.httpMetadata.byteSize !== doc.fileSize) {
      throw new DocumentValidationError(
        `Provenance httpMetadata byteSize (${doc.provenance.httpMetadata.byteSize}) must match document fileSize (${doc.fileSize})`,
        "PROVENANCE_SIZE_MISMATCH"
      );
    }
  }
}


export interface HeuristicClassificationResult {
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
export function classifyDocumentText(extractedText: string): HeuristicClassificationResult {
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

// ============================================================================
// Milestone 3C: PDF Layout Extraction, Text Segmentation & Page Observation
// ============================================================================

export const DEFAULT_EXTRACTION_VERSION = "v1.0.0-text-layout";
export const DEFAULT_EXTRACTION_METHOD = "PDFJS_TEXT_LAYOUT";

/**
 * Deterministic multi-page synthetic PDF fixture for Milestone 3C layout tests.
 * Contains 3 pages:
 * - Page 1: 2 structured text blocks with known coordinates and typography
 * - Page 2: 1 structured text block
 * - Page 3: 0 text blocks (scanned / image-only test page)
 * Page dimensions: 612 x 792 pt (US Letter).
 * Free from misleading lottery numbers.
 */
export const DEV_SYNTHETIC_LAYOUT_FIXTURE_BYTES: Uint8Array = new Uint8Array(
  Buffer.from(
    "%PDF-1.4\n" +
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" +
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R 4 0 R 5 0 R] /Count 3 >>\nendobj\n" +
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 7 0 R /Resources << /Font << /F1 6 0 R >> >> >>\nendobj\n" +
    "4 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 8 0 R /Resources << /Font << /F1 6 0 R >> >> >>\nendobj\n" +
    "5 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 9 0 R >>\nendobj\n" +
    "6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n" +
    "7 0 obj\n<< /Length 99 >>\nstream\nBT\n/F1 14 Tf\n100 700 Td\n(KERALA STATE LOTTERIES) Tj\n0 -50 Td\n(Milestone 3C Layout Extraction) Tj\nET\nendstream\nendobj\n" +
    "8 0 obj\n<< /Length 58 >>\nstream\nBT\n/F1 12 Tf\n120 720 Td\n(Physical Observation Layer) Tj\nET\nendstream\nendobj\n" +
    "9 0 obj\n<< /Length 0 >>\nstream\n\nendstream\nendobj\n" +
    "xref\n0 10\n0000000000 65535 f \n" +
    "0000000009 00000 n \n" +
    "0000000058 00000 n \n" +
    "0000000127 00000 n \n" +
    "0000000253 00000 n \n" +
    "0000000379 00000 n \n" +
    "0000000466 00000 n \n" +
    "0000000536 00000 n \n" +
    "0000000685 00000 n \n" +
    "0000000793 00000 n \n" +
    "trailer\n<< /Size 10 /Root 1 0 R >>\nstartxref\n842\n%%EOF",
    "utf8"
  )
);

export const DEV_SYNTHETIC_LAYOUT_FIXTURE_SHA256 =
  "dc0f9293b5cb75220e1bea359fe13c734b0e2b09d61534a0fae06601d24f2856";

/**
 * Returns deterministic Firestore document ID for a page: `${documentSha256}_${pageNumber}`.
 */
export function getDocumentPageId(documentSha256: string, pageNumber: number): string {
  if (!documentSha256 || typeof documentSha256 !== "string") {
    throw new DocumentValidationError("documentSha256 must be a non-empty string", "INVALID_SHA256");
  }
  const normalizedSha = documentSha256.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalizedSha)) {
    throw new DocumentValidationError(
      `Invalid documentSha256 '${documentSha256}'. Expected 64 lowercase hexadecimal characters.`,
      "INVALID_SHA256"
    );
  }
  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    throw new DocumentValidationError(
      `pageNumber must be a positive 1-based integer, received ${pageNumber}`,
      "INVALID_PAGE_NUMBER"
    );
  }
  return `${normalizedSha}_${pageNumber}`;
}

/**
 * Validates a TextBlock structural invariant.
 */
export function validateTextBlock(block: TextBlock): void {
  if (!block || typeof block !== "object") {
    throw new DocumentValidationError("TextBlock must be a valid object", "INVALID_TEXT_BLOCK");
  }
  if (typeof block.order !== "number" || block.order < 0 || !Number.isInteger(block.order)) {
    throw new DocumentValidationError(
      `TextBlock order must be a non-negative integer, received ${block.order}`,
      "INVALID_BLOCK_ORDER"
    );
  }
  if (typeof block.text !== "string") {
    throw new DocumentValidationError("TextBlock text must be a string", "INVALID_BLOCK_TEXT");
  }
  if (typeof block.x !== "number" || isNaN(block.x)) {
    throw new DocumentValidationError(`TextBlock x coordinate must be a valid number, received ${block.x}`, "INVALID_COORDINATE");
  }
  if (typeof block.y !== "number" || isNaN(block.y)) {
    throw new DocumentValidationError(`TextBlock y coordinate must be a valid number, received ${block.y}`, "INVALID_COORDINATE");
  }
  if (typeof block.width !== "number" || block.width < 0 || isNaN(block.width)) {
    throw new DocumentValidationError(`TextBlock width must be a non-negative number, received ${block.width}`, "INVALID_DIMENSION");
  }
  if (typeof block.height !== "number" || block.height < 0 || isNaN(block.height)) {
    throw new DocumentValidationError(`TextBlock height must be a non-negative number, received ${block.height}`, "INVALID_DIMENSION");
  }
}

/**
 * Validates a DocumentPage entity ensuring deterministic identity, provenance, and geometry invariants.
 */
export function validateDocumentPage(page: DocumentPage): void {
  if (!page || typeof page !== "object") {
    throw new DocumentValidationError("DocumentPage must be a valid object", "INVALID_PAGE");
  }
  if (!page.documentSha256 || !/^[a-f0-9]{64}$/.test(page.documentSha256)) {
    throw new DocumentValidationError(
      `DocumentPage documentSha256 must be a 64-character lowercase hex string, received '${page.documentSha256}'`,
      "INVALID_SHA256"
    );
  }
  if (!Number.isInteger(page.pageNumber) || page.pageNumber < 1) {
    throw new DocumentValidationError(
      `DocumentPage pageNumber must be a positive integer (1-based), received ${page.pageNumber}`,
      "INVALID_PAGE_NUMBER"
    );
  }
  if (!Number.isInteger(page.pageCount) || page.pageCount < 1) {
    throw new DocumentValidationError(
      `DocumentPage pageCount must be a positive integer, received ${page.pageCount}`,
      "INVALID_PAGE_COUNT"
    );
  }
  if (page.pageNumber > page.pageCount) {
    throw new DocumentValidationError(
      `DocumentPage pageNumber (${page.pageNumber}) exceeds pageCount (${page.pageCount})`,
      "PAGE_NUMBER_OUT_OF_BOUNDS"
    );
  }
  const expectedId = getDocumentPageId(page.documentSha256, page.pageNumber);
  if (page.id !== expectedId) {
    throw new DocumentValidationError(
      `DocumentPage id ('${page.id}') must match deterministic page ID ('${expectedId}')`,
      "PAGE_ID_MISMATCH"
    );
  }
  if (!page.extractionMethod || typeof page.extractionMethod !== "string") {
    throw new DocumentValidationError("DocumentPage extractionMethod must be a non-empty string", "INVALID_EXTRACTION_METHOD");
  }
  if (!page.extractionVersion || typeof page.extractionVersion !== "string") {
    throw new DocumentValidationError("DocumentPage extractionVersion must be a non-empty string", "INVALID_EXTRACTION_VERSION");
  }
  const validStatuses: PageExtractionStatus[] = ["TEXT_LAYER", "IMAGE_ONLY", "MIXED", "FAILED"];
  if (!validStatuses.includes(page.extractionStatus)) {
    throw new DocumentValidationError(
      `DocumentPage extractionStatus must be one of [${validStatuses.join(", ")}], received '${page.extractionStatus}'`,
      "INVALID_EXTRACTION_STATUS"
    );
  }
  if (typeof page.text !== "string") {
    throw new DocumentValidationError("DocumentPage text must be a string", "INVALID_PAGE_TEXT");
  }
  if (!Array.isArray(page.textBlocks)) {
    throw new DocumentValidationError("DocumentPage textBlocks must be an array", "INVALID_TEXT_BLOCKS");
  }
  for (const block of page.textBlocks) {
    validateTextBlock(block);
  }
  if (typeof page.pageWidth !== "number" || page.pageWidth <= 0) {
    throw new DocumentValidationError(`DocumentPage pageWidth must be a positive number, received ${page.pageWidth}`, "INVALID_DIMENSION");
  }
  if (typeof page.pageHeight !== "number" || page.pageHeight <= 0) {
    throw new DocumentValidationError(`DocumentPage pageHeight must be a positive number, received ${page.pageHeight}`, "INVALID_DIMENSION");
  }
  if (page.unit !== "pt") {
    throw new DocumentValidationError(`DocumentPage unit must be 'pt', received '${page.unit}'`, "INVALID_UNIT");
  }
  if (typeof page.hasImages !== "boolean") {
    throw new DocumentValidationError("DocumentPage hasImages must be a boolean", "INVALID_HAS_IMAGES");
  }
  if (!page.createdAt || isNaN(Date.parse(page.createdAt))) {
    throw new DocumentValidationError(`DocumentPage createdAt must be a valid ISO 8601 string, received '${page.createdAt}'`, "INVALID_CREATED_AT");
  }
}

export interface PageExtractionOptions {
  extractionVersion?: string;
  extractionMethod?: string;
}

export interface ExtractionResult {
  documentSha256: string;
  pageCount: number;
  pages: DocumentPage[];
  extractionVersion: string;
  extractionMethod: string;
}

/**
 * Server-side PDF extraction engine built on pdfjs-dist.
 *
 * Observes page structure, dimensions, layout text blocks, and coordinates
 * without any semantic lottery interpretation.
 */
export class PdfPageExtractorService {
  constructor(
    public readonly defaultVersion: string = DEFAULT_EXTRACTION_VERSION,
    public readonly defaultMethod: string = DEFAULT_EXTRACTION_METHOD
  ) {}

  async extractPages(
    pdfBuffer: Uint8Array,
    documentSha256: string,
    options?: PageExtractionOptions
  ): Promise<ExtractionResult> {
    validatePdfBuffer(pdfBuffer);

    if (!documentSha256 || typeof documentSha256 !== "string") {
      throw new DocumentValidationError("documentSha256 must be a non-empty string", "INVALID_SHA256");
    }
    const normalizedSha = documentSha256.trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(normalizedSha)) {
      throw new DocumentValidationError(
        `Invalid documentSha256 '${documentSha256}'. Expected 64 lowercase hexadecimal characters.`,
        "INVALID_SHA256"
      );
    }

    const extractionVersion = options?.extractionVersion || this.defaultVersion;
    const extractionMethod = options?.extractionMethod || this.defaultMethod;
    const now = new Date().toISOString();

    let doc: any;
    try {
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(pdfBuffer),
        useSystemFonts: true,
        disableFontFace: true,
        isEvalSupported: false
      });
      doc = await loadingTask.promise;
    } catch (err: any) {
      throw new DocumentValidationError(
        `Failed to parse PDF document structure: ${err?.message || String(err)}`,
        "PDF_PARSE_FAILED"
      );
    }

    const pageCount = doc.numPages;
    if (typeof pageCount !== "number" || pageCount < 1) {
      throw new DocumentValidationError(
        `Extracted page count is invalid: ${pageCount}`,
        "INVALID_PAGE_COUNT"
      );
    }

    const pages: DocumentPage[] = [];

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      try {
        const page = await doc.getPage(pageNumber);
        const vp = page.getViewport({ scale: 1.0 });
        const pageWidth = Number(vp.width.toFixed(2));
        const pageHeight = Number(vp.height.toFixed(2));

        // Detect raster and vector image operators
        const ops = await page.getOperatorList();
        const OPS = pdfjsLib.OPS;
        const hasImages = ops.fnArray.some(
          (fn: number) =>
            fn === OPS.paintImageXObject ||
            fn === OPS.paintInlineImageXObject ||
            fn === OPS.paintImageMaskXObject
        );

        const textContent = await page.getTextContent();
        const rawItems: Array<{
          str: string;
          x: number;
          y: number;
          width: number;
          height: number;
          fontName?: string;
          fontSize?: number;
        }> = [];

        for (const item of textContent.items) {
          if (!("str" in item) || typeof item.str !== "string" || !item.str.trim()) {
            continue;
          }
          const tx = item.transform[4];
          const ty = item.transform[5];
          const fontSize = Math.abs(item.transform[3]) || item.height || 10;
          const height = fontSize;
          const width = item.width;
          const fontName = item.fontName
            ? item.fontName.replace(/^g_d\d+_/, "")
            : undefined;

          rawItems.push({
            str: item.str,
            x: tx,
            y: ty,
            width,
            height,
            fontName,
            fontSize
          });
        }

        // Sort items in natural reading order: top-to-bottom (y descending in PDF coords), left-to-right (x ascending)
        const sorted = [...rawItems].sort((a, b) => {
          if (Math.abs(a.y - b.y) > 3) {
            return b.y - a.y; // Higher y is visually higher on the page in standard PDF
          }
          return a.x - b.x;
        });

        // Group horizontally adjacent text items into coherent line text blocks
        const textBlocks: TextBlock[] = [];
        let currentLine: {
          str: string;
          x: number;
          y: number;
          width: number;
          height: number;
          fontName?: string;
          fontSize?: number;
        } | null = null;

        for (const it of sorted) {
          if (!currentLine) {
            currentLine = { ...it };
          } else if (Math.abs(currentLine.y - it.y) <= 3) {
            // Same horizontal line: merge bounding boxes and concatenate string
            currentLine.str += (currentLine.str.endsWith(" ") ? "" : " ") + it.str;
            const minX = Math.min(currentLine.x, it.x);
            const maxX = Math.max(currentLine.x + currentLine.width, it.x + it.width);
            const minY = Math.min(currentLine.y, it.y);
            const maxY = Math.max(currentLine.y + currentLine.height, it.y + it.height);
            currentLine.x = minX;
            currentLine.y = minY;
            currentLine.width = maxX - minX;
            currentLine.height = maxY - minY;
          } else {
            // New line encountered: commit previous line block
            const blockTop = Number((pageHeight - (currentLine.y + currentLine.height)).toFixed(2));
            textBlocks.push({
              order: textBlocks.length,
              text: currentLine.str,
              x: Number(currentLine.x.toFixed(2)),
              y: Number(currentLine.y.toFixed(2)),
              width: Number(currentLine.width.toFixed(2)),
              height: Number(currentLine.height.toFixed(2)),
              top: blockTop,
              fontName: currentLine.fontName,
              fontSize: currentLine.fontSize ? Number(currentLine.fontSize.toFixed(2)) : undefined
            });
            currentLine = { ...it };
          }
        }
        if (currentLine) {
          const blockTop = Number((pageHeight - (currentLine.y + currentLine.height)).toFixed(2));
          textBlocks.push({
            order: textBlocks.length,
            text: currentLine.str,
            x: Number(currentLine.x.toFixed(2)),
            y: Number(currentLine.y.toFixed(2)),
            width: Number(currentLine.width.toFixed(2)),
            height: Number(currentLine.height.toFixed(2)),
            top: blockTop,
            fontName: currentLine.fontName,
            fontSize: currentLine.fontSize ? Number(currentLine.fontSize.toFixed(2)) : undefined
          });
        }

        const pageText = textBlocks.map((b) => b.text).join("\n");

        let extractionStatus: PageExtractionStatus;
        if (textBlocks.length > 0 && !hasImages) {
          extractionStatus = "TEXT_LAYER";
        } else if (textBlocks.length > 0 && hasImages) {
          extractionStatus = "MIXED";
        } else {
          extractionStatus = "IMAGE_ONLY";
        }

        const pageDoc: DocumentPage = {
          id: getDocumentPageId(normalizedSha, pageNumber),
          documentSha256: normalizedSha,
          pageNumber,
          pageCount,
          extractionMethod,
          extractionVersion,
          extractionStatus,
          text: pageText,
          textBlocks,
          pageWidth,
          pageHeight,
          unit: "pt",
          hasImages,
          createdAt: now,
          updatedAt: now
        };

        validateDocumentPage(pageDoc);
        pages.push(pageDoc);
      } catch (pageErr: any) {
        // Build a failed page record rather than silently omitting or losing metadata
        const failedDoc: DocumentPage = {
          id: getDocumentPageId(normalizedSha, pageNumber),
          documentSha256: normalizedSha,
          pageNumber,
          pageCount,
          extractionMethod,
          extractionVersion,
          extractionStatus: "FAILED",
          text: "",
          textBlocks: [],
          pageWidth: 595.28,
          pageHeight: 841.89,
          unit: "pt",
          hasImages: false,
          createdAt: now,
          updatedAt: now,
          errorMessage: pageErr?.message || String(pageErr)
        };
        pages.push(failedDoc);
      }
    }

    return {
      documentSha256: normalizedSha,
      pageCount,
      pages,
      extractionVersion,
      extractionMethod
    };
  }
}

/**
 * Convenience function to extract pages from raw PDF bytes.
 */
export async function extractPdfPages(
  pdfBuffer: Uint8Array,
  documentSha256: string,
  options?: PageExtractionOptions
): Promise<ExtractionResult> {
  const extractor = new PdfPageExtractorService(
    options?.extractionVersion,
    options?.extractionMethod
  );
  return extractor.extractPages(pdfBuffer, documentSha256, options);
}

// ============================================================================
// Milestone 3D Re-Exports: Semantic Classification & Region Segmentation
// ============================================================================

export {
  classifyDocumentPages,
  extractDrawMetadata,
  segmentDocumentRegions,
  DocumentSemanticSegmentationService,
  validateSemanticRegion,
  validateSemanticField,
  validateDocumentSemanticSegmentation,
  RULE_CLASSIFICATION_HEADER,
  RULE_CLASSIFICATION_DRAW_HEADING,
  RULE_CLASSIFICATION_PORTAL,
  RULE_REGION_HEADER,
  RULE_REGION_DRAW_METADATA,
  RULE_REGION_PRIZE_STRUCTURE,
  RULE_REGION_LEGAL_CLAIMS_FOOTER,
  RULE_REGION_CERTIFICATION,
  RULE_DRAW_METADATA_REGEX,
  DEFAULT_SEMANTIC_VERSION
} from "./semantic-segmentation";

export type {
  SemanticSegmentationOptions,
  SemanticDocumentKind,
  SemanticRegionType,
  RegionBoundingBox,
  SemanticRegion,
  SemanticField,
  DrawMetadata,
  ClassificationEvidence,
  DocumentClassificationResult,
  DocumentSemanticSegmentation
} from "./semantic-segmentation";

// ============================================================================
// Milestone 3E Re-Exports: Validated Lottery Entities & Provenance
// ============================================================================

export {
  extractLotteryEntitiesFromDocument,
  LotteryEntityExtractorService,
  validatePrizeTier,
  validateSeries,
  validateWinningResult,
  validateLotteryEntityExtractionResult,
  RULE_TIER_DECLARATION,
  RULE_SERIES_EXTRACTION,
  RULE_RESULT_FULL_TICKET,
  RULE_RESULT_SUFFIX_NUMBER,
  RULE_VALIDATION_REGION,
  RULE_VALIDATION_FORMAT,
  DEFAULT_ENTITY_PARSER_VERSION
} from "./lottery-entity-extraction";

export type {
  LotteryEntityExtractionOptions
} from "./lottery-entity-extraction";


