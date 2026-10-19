/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 6C: Feature Selection & Modeling Representation Contracts
 *
 * Defines:
 * - FeatureSelectionPolicy, FeatureSelectionDecision, FeatureSelectionReport
 * - ModelFeatureMatrix, ModelFeatureColumn, ModelFeatureMatrixRow
 * - FeatureSelectionPopulationScope, FeatureSelectionValidationResult
 * - Deterministic model-ready feature representation
 *
 * Strict Non-Predictive Boundary:
 * - 6C is feature representation and selection only.
 * - Zero future prediction, winning number betting optimization, or lucky/hot/cold scoring.
 * - Does NOT claim selected features are predictive.
 * - Neutral terminology: RETAINED, EXCLUDED_REDUNDANT, EXCLUDED_STRUCTURALLY_SPARSE,
 *   RETAINED_WITH_TRANSFORMATION, INSUFFICIENT_EVIDENCE.
 */

import type { FeatureFamily, FeatureValueType } from "./feature-types";

export const DEFAULT_FEATURE_SELECTION_VERSION = "v1.0.0-feature-selection";

export const HISTORICAL_FEATURE_SELECTION_DISCLAIMER =
  "NON-PREDICTIVE FEATURE SELECTION NOTICE: This feature selection and model-ready representation defines deterministic structural representations of historical observations only. Selected features do NOT represent predictive importance, indicate winning odds, optimize betting strategies, or imply future causal relationships.";

export type SelectionStatus =
  | "RETAINED"
  | "EXCLUDED_REDUNDANT"
  | "EXCLUDED_STRUCTURALLY_SPARSE"
  | "RETAINED_WITH_TRANSFORMATION"
  | "INSUFFICIENT_EVIDENCE";

export type StructuralApplicability =
  | "ALL"
  | "FULL_TICKET_ONLY"
  | "SUFFIX_ONLY";

// ============================================================================
// Selection Policy
// ============================================================================

export interface FeatureSelectionPolicy {
  policyId: string;
  policyVersion: string;
  policyName: string;
  description: string;
  excludeExactDuplicates: boolean;
  canonicalDuplicateResolutionRule: "SEMANTIC_ENTITY_PRECEDENCE" | "ALPHABETICAL";
  excludeFormattingDerivatives: boolean;
  structuralSparsityHandling: "RETAIN_WITH_METADATA" | "EXCLUDE_STRUCTURALLY_SPARSE";
  variableHandling: "RETAIN" | "EXCLUDE";
  allowLosslessTransformations: boolean;
  disclaimer: string;
}

// ============================================================================
// Selection Decision per Feature
// ============================================================================

export interface FeatureSelectionDecision {
  featureName: string;
  featureFamily: FeatureFamily;
  sourceFeatureMatrixId: string;
  sourceFeatureEvaluationId: string;
  selectionStatus: SelectionStatus;
  selectionReason: string;
  originalDataType: FeatureValueType;
  resultingDataType: FeatureValueType;
  transformation: string | null;
  structuralApplicability: StructuralApplicability;
  provenance: string;
  selectionVersion: string;
}

// ============================================================================
// Model Feature Matrix Contracts
// ============================================================================

export interface ModelFeatureColumn {
  name: string;
  family: FeatureFamily;
  dataType: FeatureValueType;
  structuralApplicability: StructuralApplicability;
  description: string;
  sourceFeatureName: string;
  transformation: string | null;
}

export interface ModelFeatureMatrixRow {
  resultId: string;
  sourceDrawId: string;
  sourceDocumentSha256: string;
  canonicalNumber: string;
  resultType: "FULL_TICKET" | "SUFFIX";
  numberLength: number;
  values: Record<string, string | number | boolean | null>;
}

export interface FeatureSelectionPopulationScope {
  corpusId?: string;
  sourceFeatureMatrixId: string;
  sourceFeatureEvaluationId: string;
  totalRows: number;
  fullTicketCount: number;
  suffixCount: number;
  drawIds: string[];
  drawCount: number;
  lotteryCodes: string[];
  documentSha256s: string[];
  dateRange: {
    earliest?: string;
    latest?: string;
  };
  populationScopeHash: string;
}

export interface ModelFeatureMatrix {
  id: string; // Deterministic: `mfmat_${hash}`
  sourceFeatureMatrixId: string;
  sourceFeatureEvaluationId: string;
  featureSelectionVersion: string;
  policy: FeatureSelectionPolicy;
  totalRecords: number;
  selectedColumnNames: string[]; // canonically sorted
  selectedColumns: ModelFeatureColumn[];
  excludedDecisions: FeatureSelectionDecision[];
  allDecisions: Record<string, FeatureSelectionDecision>;
  rows: ModelFeatureMatrixRow[];
  metadata: {
    corpusId?: string;
    fullTicketCount: number;
    suffixCount: number;
    totalFeaturesEvaluated: number;
    retainedFeaturesCount: number;
    excludedFeaturesCount: number;
  };
  populationScope: FeatureSelectionPopulationScope;
  deterministicHash: string;
  provenance: string;
  limitations: string[];
  descriptiveOnly: true;
}

// ============================================================================
// Selection Validation Result
// ============================================================================

export interface FeatureSelectionValidationResult {
  passed: boolean;
  totalFeaturesChecked: number;
  allFeaturesAccountedFor: boolean;
  noUnexplainedExclusions: boolean;
  rowCountPreserved: boolean;
  resultIdsAligned: boolean;
  leadingZerosPreserved: boolean;
  fullTicketSuffixSeparationPreserved: boolean;
  provenancePreserved: boolean;
  noTargetLeakage: boolean;
  issues: string[];
}

// ============================================================================
// Feature Selection Report
// ============================================================================

export interface FeatureSelectionReport {
  reportId: string; // Deterministic: `fsel_${hash}`
  selectionVersion: string;
  sourceFeatureMatrixId: string;
  sourceFeatureEvaluationId: string;
  modelFeatureMatrixId: string;
  policy: FeatureSelectionPolicy;
  evaluatedAt: string;
  totalFeaturesEvaluated: number;
  retainedFeaturesCount: number;
  excludedFeaturesCount: number;
  decisions: Record<string, FeatureSelectionDecision>;
  decisionList: FeatureSelectionDecision[]; // canonically sorted
  validation: FeatureSelectionValidationResult;
  summary: {
    totalInputFeatures: number;
    retainedCount: number;
    excludedRedundantCount: number;
    excludedSparseCount: number;
    retainedWithTransformCount: number;
    insufficientEvidenceCount: number;
    exactDuplicatesResolved: string[];
    structuralSparseAddressed: string[];
    variableFeaturesAddressed: string[];
  };
  deterministicHash: string;
  limitations: string[];
  descriptiveOnly: true;
}

export interface HistoricalModelFeatureRecord {
  id: string; // matches matrix.id
  matrix: ModelFeatureMatrix;
  report: FeatureSelectionReport;
  createdAt: string;
}
