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

export interface SourceDocument {
  id: string;
  type: DocumentType;
  title: string;
  sourceUrl?: string;
  storagePath: string; // Cloud Storage URI (gs://...)
  sha256: string;
  mimeType: string;
  fileSize: number;
  sourceOrganization: string;
  publishedAt?: string;
  retrievedAt: string;
  parserVersion: string;
  status: DocumentStatus;
  createdAt: string;
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
  drawId: string;
  prizeResultId: string;
  series?: string; // e.g. "DB", "WA", or undefined for suffix draws
  canonicalNumber: string; // String with exact digits preserved e.g. "0276", "293215"
  numberLength: number; // e.g. 4 for 4-digit suffix, 6 for full ticket number
  isSuffix: boolean;
  suffixLength?: number;
  resultType: PrizeResultType;
  sourceDocumentId: string;
  sourcePage: number;
  sourceText: string;
  confidence: number;
  validationStatus: "VALID" | "FLAGGED" | "PENDING_REVIEW";
  derivedNumericValue?: number; // Optional derived value ONLY, canonicalNumber always rules
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
