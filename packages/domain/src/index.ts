/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Core Domain Models & Invariants
 */

// ============================================================================
// User & Auth Entities
// ============================================================================

export type UserRole = "ADMIN" | "RESEARCHER" | "ANALYST" | "VIEWER";

export type UserStatus = "ACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION";

export interface UserProfile {
  uid: string;
  phoneNumber: string;
  displayName?: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  lastLoginAt?: string;
}

// ============================================================================
// Document Entities & Ingestion Status
// ============================================================================

export type DocumentType =
  | "LOTTERY_RESULT"
  | "ACT"
  | "RULE"
  | "AMENDMENT"
  | "MANUAL"
  | "FORM"
  | "OTHER";

export type DocumentStatus =
  | "UPLOADED"
  | "SEGMENTED"
  | "PARSED"
  | "NEEDS_REVIEW"
  | "APPROVED"
  | "REJECTED";

export interface OfficialSource {
  sourceId: string;
  sourceName: string;
  organization: string;
  baseUrl: string;
  discoveryUrl: string;
  allowedDomains: string[];
  authorityEvidence: string[];
  enabled: boolean;
  notes?: string;
}

export interface HttpProvenanceMetadata {
  statusCode: number;
  contentType: string;
  contentLength?: number;
  etag?: string;
  lastModified?: string;
  server?: string;
  sha256: string;
  byteSize: number;
}

export interface DocumentProvenance {
  sourceId: string;
  sourceOrganization: string;
  discoveryUrl?: string;
  requestedUrl: string;
  finalUrl: string;
  redirectCount: number;
  retrievedAt: string; // ISO 8601
  originalFileName?: string;
  httpMetadata: HttpProvenanceMetadata;
  contentTypeMismatch?: boolean;
  declaredContentType?: string;
}

export interface SourceDocument {
  id: string; // 64-character lowercase SHA-256 hash
  type: DocumentType;
  title: string;
  sourceUrl?: string;
  storagePath: string; // Cloud Storage path: source-documents/${sha256}.pdf
  sha256: string; // 64-character lowercase hex SHA-256
  mimeType: string; // e.g. "application/pdf"
  fileSize: number; // byte size of the raw source file
  sourceOrganization: string; // e.g. "Directorate of Kerala State Lotteries"
  publishedAt?: string; // ISO 8601
  retrievedAt: string; // ISO 8601
  ingestionVersion: string; // Ingestion pipeline version, e.g. "v1.0.0-source-foundation"
  parserVersion?: string; // Optional parser version when semantic parsing is added in later milestones
  status: DocumentStatus;
  createdAt: string; // ISO 8601
  provenance?: DocumentProvenance;
}

export interface SourceEvidence {
  id: string;
  documentId: string;
  pageNumber: number;
  sourceText: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  parserVersion: string;
  confidence: number;
  createdAt: string;
}

// ============================================================================
// Milestone 3C: PDF Page Observation & Text Layout Contracts
// ============================================================================

export type PageExtractionStatus =
  | "TEXT_LAYER"
  | "IMAGE_ONLY"
  | "MIXED"
  | "FAILED";

/**
 * Text block representing a physical, structural text segment on a PDF page.
 *
 * Coordinate Convention:
 * - Unit: PostScript points (pt), where 1 pt = 1/72 inch.
 * - Primary Origin: BOTTOM_LEFT of page (standard PDF user space coordinate system).
 *   - x: horizontal offset from left edge of page to left edge of text box (x-axis increases right).
 *   - y: vertical offset from bottom edge of page to bottom edge of text box (y-axis increases upwards).
 *   - width: width of bounding box in points.
 *   - height: height of bounding box in points.
 * - Derived Top-Down Coordinate (for Web/CSS overlays):
 *   - top: vertical offset from top edge of page (pageHeight - (y + height)).
 */
export interface TextBlock {
  id?: string;
  order: number; // 0-based extraction/reading order index
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  top?: number;
  fontName?: string;
  fontSize?: number;
  fontWeight?: string;
  rotation?: number;
}

export interface PageGeometry {
  width: number;
  height: number;
  unit: "pt";
  rotation: number;
  coordinateSystem: {
    origin: "BOTTOM_LEFT";
    xAxis: "RIGHT";
    yAxis: "UP";
    unit: "pt";
  };
}

/**
 * Physical observation layer representing an individual page of a source PDF.
 *
 * Invariants:
 * - documentSha256 + pageNumber = unique deterministic page identity.
 * - ID format: `${documentSha256}_${pageNumber}`
 * - Page numbering is 1-based (1 <= pageNumber <= pageCount).
 * - Pure observation of physical layout and text without semantic interpretation.
 */
export interface DocumentPage {
  id: string; // Deterministic: `${documentSha256}_${pageNumber}`
  documentSha256: string; // 64-character lowercase SHA-256 of source document
  pageNumber: number; // 1-based page number (1, 2, ... pageCount)
  pageCount: number; // Total number of pages in the source PDF
  extractionMethod: string; // e.g. "PDFJS_TEXT_LAYOUT"
  extractionVersion: string; // e.g. "v1.0.0-text-layout"
  extractionStatus: PageExtractionStatus;
  text: string; // Concatenated text content of the page
  textBlocks: TextBlock[]; // Structural text blocks with coordinates and typography
  pageWidth: number; // Width in points (pt)
  pageHeight: number; // Height in points (pt)
  unit: "pt"; // Measurement unit for coordinates and dimensions
  hasImages: boolean; // True if raster or vector image objects are present on the page
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  errorMessage?: string; // Descriptive error message if extractionStatus === "FAILED"
}

// ============================================================================
// Milestone 3D: Semantic Document Classification & Region Segmentation Contracts
// ============================================================================

export type SemanticDocumentKind = "LOTTERY_RESULT" | "UNCLASSIFIED";

export type SemanticRegionType =
  | "HEADER"
  | "DRAW_METADATA"
  | "PRIZE_STRUCTURE"
  | "CERTIFICATION"
  | "LEGAL_CLAIMS_FOOTER";

export interface RegionBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  top?: number;
  unit: "pt";
}

export interface SemanticRegion {
  id: string; // Deterministic: `${pageId}_${type}` or `${pageId}_${type}_${index}`
  documentSha256: string;
  pageId: string; // `${documentSha256}_${pageNumber}`
  pageNumber: number; // 1-based page number
  type: SemanticRegionType;
  textBlockOrders: number[]; // 0-based order indices of member TextBlocks
  boundingBox: RegionBoundingBox;
  confidence: number; // 1.0 for deterministic rule matches
  ruleId: string;
  evidence: string[]; // Structural tokens or markers that triggered this region
  summaryText?: string; // Text excerpt
}

export interface SemanticField<T = string> {
  name: string;
  value: T;
  rawText: string;
  sourceDocumentSha256: string;
  sourcePageId: string;
  sourcePageNumber: number;
  textBlockOrder: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
    top?: number;
  };
  ruleId: string;
  confidence: number;
}

export interface DrawMetadata {
  lotteryName?: SemanticField<string>;
  drawNumber?: SemanticField<string>;
  drawDate?: SemanticField<string>;
  drawTime?: SemanticField<string>;
  location?: SemanticField<string>;
}

export interface ClassificationEvidence {
  ruleId: string;
  description: string;
  matchedText: string;
  pageNumber: number;
  textBlockOrder: number;
}

export interface DocumentClassificationResult {
  documentSha256: string;
  kind: SemanticDocumentKind;
  confidence: number;
  evidence: ClassificationEvidence[];
  ruleId: string;
  semanticVersion: string;
}

export interface DocumentSemanticSegmentation {
  id: string; // Deterministic: `${documentSha256}`
  documentSha256: string;
  classification: DocumentClassificationResult;
  regions: SemanticRegion[];
  drawMetadata?: DrawMetadata;
  pageCount: number;
  extractionVersion: string;
  semanticVersion: string;
  createdAt: string;
}

export const DEFAULT_SEMANTIC_VERSION = "v1.0.0-semantic-regions";

// ============================================================================
// Milestone 3E: Validated Lottery Entities & Provenance Contracts
// ============================================================================

export type PrizeTierType = "RANKED" | "CONSOLATION" | "SPECIAL";

/**
 * Validated prize tier entity extracted from explicit PRIZE_STRUCTURE observations.
 */
export interface PrizeTier {
  id: string; // Deterministic: `${documentSha256}_tier_${tierCode}`
  documentSha256: string;
  pageId: string;
  pageNumber: number;
  sourceTextBlockOrders: number[];
  rawSourceText: string;
  boundingBox: RegionBoundingBox;
  parserRule: string;
  parserVersion: string;
  name: string; // e.g. "1st Prize", "Cons Prize", "2nd Prize", "4th Prize"
  rank: number; // 1 for 1st, 2 for 2nd, 0 for Consolation
  tierType: PrizeTierType;
  amount?: number; // Numeric prize amount in INR, e.g. 10000000, 5000
  currency?: "INR";
  isSuffix: boolean; // True for suffix tiers ("FOR THE TICKETS ENDING...")
  expectedLength: number; // 6 for full ticket, 4 for suffix
  confidence: number;
  createdAt: string; // ISO 8601
}

/**
 * Validated lottery series/prefix entity extracted from full ticket prize tiers.
 */
export interface Series {
  id: string; // Deterministic: `${documentSha256}_series_${code}_${pageNumber}_${order}`
  documentSha256: string;
  pageId: string;
  pageNumber: number;
  sourceTextBlockOrders: number[];
  rawSourceText: string;
  boundingBox: RegionBoundingBox;
  parserRule: string;
  parserVersion: string;
  code: string; // 2-letter uppercase alphabetic code e.g. "DW", "DO", "DN", "DB"
  confidence: number;
  createdAt: string; // ISO 8601
}

/**
 * Validated individual prize payout result entity linking tier, number, series, and provenance.
 */
export interface WinningResult {
  id: string; // Deterministic: `${prizeTierId}_result_${canonicalNumber}${series ? '_' + series : ''}`
  documentSha256: string;
  pageId: string;
  pageNumber: number;
  sourceTextBlockOrders: number[];
  rawSourceText: string;
  boundingBox: RegionBoundingBox;
  parserRule: string;
  parserVersion: string;
  drawId?: string;
  prizeTierId: string;
  prizeTierName: string;
  rank: number;
  amount?: number;
  series?: string;
  canonicalNumber: string; // Exact digits preserved as string, e.g. "0259", "809210"
  numberLength: number;
  isSuffix: boolean;
  location?: string; // Agency / location if present, e.g. "ERNAKULAM", "PALAKKAD"
  confidence: number;
  validationStatus: "VALID" | "FLAGGED" | "PENDING_REVIEW";
  createdAt: string; // ISO 8601
}

export type CandidateRejectionReason =
  | "OUTSIDE_PRIZE_STRUCTURE"
  | "UNASSOCIATED_TIER"
  | "INVALID_LENGTH"
  | "NON_NUMERIC"
  | "AMBIGUOUS"
  | "MALFORMED_SERIES";

export interface RejectedCandidate {
  reason: CandidateRejectionReason;
  rawText: string;
  pageNumber: number;
  textBlockOrder: number;
  boundingBox: RegionBoundingBox;
  ruleId: string;
  detail?: string;
}

export interface LotteryEntityExtractionResult {
  documentSha256: string;
  drawId: string;
  drawMetadata?: DrawMetadata;
  prizeTiers: PrizeTier[];
  series: Series[];
  winningResults: WinningResult[];
  winningNumbers: WinningNumber[];
  rejectedCandidates: RejectedCandidate[];
  parserVersion: string;
  extractionVersion: string;
  semanticVersion: string;
  createdAt: string;
}

export const DEFAULT_ENTITY_PARSER_VERSION = "v1.0.0-validated-entities";

// ============================================================================
// Kerala Lottery Core Data Model
// ============================================================================

export interface Lottery {
  id: string;
  code: string; // e.g., "WIN-WIN", "KARUNYA", "STHREE-SAKTHI"
  name: string;
  state: "Kerala";
  description?: string;
  active: boolean;
  createdAt: string;
}

export interface Scheme {
  id: string;
  lotteryId: string;
  name: string;
  pricePerTicket: number;
  effectiveFrom: string;
  effectiveTo?: string;
}

export type DrawStatus = "DRAFT" | "PARSED" | "VERIFIED" | "APPROVED" | "FLAGGED";

export interface Draw {
  id: string;
  lotteryId: string;
  drawNumber: string; // Draw series number, e.g. "W-780", "DL-69"
  drawDate: string; // YYYY-MM-DD
  drawTime?: string;
  location?: string;
  sourceDocumentId: string;
  sourcePage: number;
  status: DrawStatus;
  createdAt: string;
  updatedAt: string;
}

export type PrizeResultType = "PRIMARY" | "CONSOLATION" | "SUFFIX" | "OTHER";

export interface PrizeResult {
  id: string;
  drawId: string;
  rank: number; // 1 for 1st prize, 2 for 2nd, etc.
  amount: number; // INR
  resultType: PrizeResultType;
  description: string;
  sourceDocumentId: string;
  sourcePage: number;
  sourceText: string;
}

/**
 * CRITICAL NUMBER RULE:
 * Canonical lottery numbers MUST remain strings with preserved leading zeros.
 * Example: "0276" must NEVER be coerced to 276.
 */
export interface WinningNumber {
  id: string;
  documentSha256: string;
  pageId: string;
  pageNumber: number;
  sourceTextBlockOrders: number[];
  rawSourceText: string;
  boundingBox: RegionBoundingBox;
  parserRule: string;
  parserVersion: string;
  drawId?: string;
  prizeResultId?: string;
  prizeTierId?: string;
  prizeTierName?: string;
  rank?: number;
  amount?: number;
  series?: string; // e.g. "DB", "WA", or undefined for suffix draws
  canonicalNumber: string; // String with exact digits preserved e.g. "0276", "293215"
  numberLength: number; // e.g. 4 for 4-digit suffix, 6 for full ticket number
  isSuffix: boolean;
  suffixLength?: number;
  resultType: PrizeResultType;
  sourceDocumentId?: string; // Backward compatibility alias
  sourcePage?: number; // Backward compatibility alias
  sourceText?: string; // Backward compatibility alias
  confidence: number;
  validationStatus: "VALID" | "FLAGGED" | "PENDING_REVIEW";
  derivedNumericValue?: number; // Optional derived value ONLY, canonicalNumber always rules
  createdAt?: string;
}

// ============================================================================
// Legal & Knowledge Graph Entities
// ============================================================================

export interface LegalRule {
  id: string;
  ruleNumber: string;
  title: string;
  text: string;
  sourceDocumentId: string;
  pageNumber: number;
  effectiveFrom: string;
  effectiveTo?: string;
  status: "ACTIVE" | "AMENDED" | "REPEALED";
}

export interface LegalAmendment {
  id: string;
  ruleId: string;
  amendmentNumber: string;
  title: string;
  amendmentText: string;
  sourceDocumentId: string;
  pageNumber: number;
  gazetteDate: string;
  effectiveDate: string;
}

// ============================================================================
// Dataset Versioning & Invariants
// ============================================================================

export interface DatasetVersion {
  id: string; // e.g. "V001", "V002"
  name: string;
  description: string;
  documentCount: number;
  drawCount: number;
  recordCount: number;
  sourceSnapshot: {
    documentIds: string[];
    gitCommitSha?: string;
    datasetChecksum: string;
  };
  status: "DRAFT" | "LOCKED" | "DEPRECATED";
  createdAt: string;
}

// ============================================================================
// Audit & Quality Tracking
// ============================================================================

export type AuditAction =
  | "DOCUMENT_IMPORTED"
  | "DOCUMENT_APPROVED"
  | "RECORD_EDITED"
  | "RECORD_REJECTED"
  | "DATASET_CREATED"
  | "EXPERIMENT_CREATED"
  | "EXPERIMENT_EXECUTED"
  | "AI_PROVIDER_CHANGED"
  | "USER_ROLE_CHANGED";

export interface AuditLog {
  id: string;
  actorId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  details: Record<string, unknown>;
  timestamp: string;
}

export type QualityIssueType =
  | "MISSING_DRAW"
  | "DUPLICATE_DRAW"
  | "DUPLICATE_DOCUMENT"
  | "INVALID_NUMBER_LENGTH"
  | "LOST_LEADING_ZERO"
  | "MISSING_SOURCE"
  | "UNKNOWN_SERIES"
  | "MISSING_PRIZE"
  | "PARSE_FAILURE"
  | "CONFLICTING_SOURCE";

export interface DataQualityIssue {
  id: string;
  issueType: QualityIssueType;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  entityType: string;
  entityId: string;
  description: string;
  detectedAt: string;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
}
