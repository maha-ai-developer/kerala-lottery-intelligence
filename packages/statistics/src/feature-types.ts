/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 6A: Feature Engineering & Representation Contracts
 *
 * Provides:
 * - Deterministic feature contracts and schema for validated lottery observations
 * - Explicit value types (STRING, INTEGER, BOOLEAN, CATEGORICAL)
 * - Defined feature families: NUMBER, POSITION, SUFFIX, SERIES, DRAW, STRUCTURAL
 * - Vector and Matrix representations for downstream modeling
 * - Provenance preservation to winning result, draw, and source document SHA-256
 *
 * Strict Non-Predictive Boundary:
 * - A feature is a representation of an observed historical fact.
 * - Features are NOT predictions, probabilities, recommendations, or winning scores.
 * - Zero predictive semantics.
 */

export const DEFAULT_FEATURE_VERSION = "v1.0.0-feature-engineering";

export const HISTORICAL_FEATURE_DISCLAIMER =
  "NON-PREDICTIVE FEATURE NOTICE: Features represent deterministic historical facts derived from official Kerala State Gazette publications. They do NOT represent predictive signals, winning probabilities, betting recommendations, or causal indicators.";

export type FeatureValueType = "STRING" | "INTEGER" | "BOOLEAN" | "CATEGORICAL";

export type FeatureFamily =
  | "NUMBER"
  | "POSITION"
  | "SUFFIX"
  | "SERIES"
  | "DRAW"
  | "STRUCTURAL";

// ============================================================================
// Core Feature Record Contract
// ============================================================================

export interface FeatureRecord {
  featureId: string; // Deterministic: `feat_${hash}`
  featureVersion: string; // e.g. "v1.0.0-feature-engineering"
  sourceResultId: string;
  sourceDrawId: string;
  sourceDocumentSha256: string;
  featureFamily: FeatureFamily;
  featureName: string;
  value: string | number | boolean | null;
  valueType: FeatureValueType;
  sourceMetadata: {
    pageNumber: number;
    sourceTextBlockOrders: number[];
    prizeTierRank: number;
    resultType: "FULL_TICKET" | "SUFFIX";
    canonicalNumber: string;
  };
  deterministicHash: string;
  descriptiveOnly: true;
}

// ============================================================================
// Context & Result Feature Vector
// ============================================================================

export interface DrawFeatureContext {
  drawId: string;
  drawNumber: string;
  lotteryCode: string;
  drawDate: string;
  drawSequence?: number;
}

export interface ResultFeatureVector {
  resultId: string;
  sourceResultId: string; // Explicit provenance alias matching resultId
  canonicalNumber: string;
  resultType: "FULL_TICKET" | "SUFFIX";
  sourceDrawId: string;
  sourceDocumentSha256: string;
  featureVersion: string;
  features: Record<string, FeatureRecord>;
  values: Record<string, string | number | boolean | null>;
  descriptiveOnly: true;
}

// ============================================================================
// Tabular Feature Matrix Representation
// ============================================================================

export interface FeatureMatrixRow {
  resultId: string;
  sourceDrawId: string;
  sourceDocumentSha256: string;
  canonicalNumber: string;
  resultType: "FULL_TICKET" | "SUFFIX";
  values: Record<string, string | number | boolean | null>;
}

export interface FeatureMatrix {
  id: string; // Deterministic: `fmat_${hash}`
  featureVersion: string;
  totalRecords: number;
  featureNames: string[]; // Alphabetically sorted for determinism
  featureTypes: Record<string, FeatureValueType>;
  featureFamilies: Record<string, FeatureFamily>;
  rows: FeatureMatrixRow[];
  deterministicHash: string;
  metadata: {
    corpusId?: string;
    fullTicketCount: number;
    suffixCount: number;
    totalFeaturesPerRecord: number;
  };
  limitations: string[];
  descriptiveOnly: true;
}

// ============================================================================
// Error Contract
// ============================================================================

export type FeatureValidationErrorCode =
  | "EMPTY_NUMBER"
  | "NON_NUMERIC_DIGITS"
  | "INVALID_RESULT_TYPE"
  | "FULL_TICKET_WITHOUT_SERIES"
  | "SUFFIX_WITH_SERIES"
  | "INCONSISTENT_NUMBER_LENGTH"
  | "MALFORMED_DRAW_IDENTITY"
  | "EMPTY_RESULT_SET"
  | "MIXED_LENGTH_ERROR";

export class FeatureValidationError extends Error {
  constructor(
    message: string,
    public readonly code: FeatureValidationErrorCode,
    public readonly details?: Record<string, any>
  ) {
    super(`[FeatureValidationError:${code}] ${message}`);
    this.name = "FeatureValidationError";
  }
}
