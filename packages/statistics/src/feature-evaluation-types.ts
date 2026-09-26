/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 6B: Feature Evaluation & Statistical Validation Contracts
 *
 * Defines:
 * - FeatureEvaluationReport, FeatureEvaluationMetric, FeatureCoverageSummary
 * - FeatureCardinalitySummary, FeatureDistributionSummary, FeatureStabilitySummary
 * - FeatureRedundancySummary, FeatureIntegrityReport, FeatureValidationIssue
 * - Population scope tracking and deterministic hashing
 *
 * Strict Non-Predictive Boundary:
 * - Evaluation assesses historical distribution, quality, coverage, redundancy, and stability.
 * - Does NOT predict future outcomes, score winning numbers, or optimize bets.
 */

import type { FeatureFamily, FeatureValueType } from "./feature-types";

export const DEFAULT_FEATURE_EVALUATION_VERSION = "v1.0.0-feature-evaluation";

export const HISTORICAL_FEATURE_EVALUATION_DISCLAIMER =
  "NON-PREDICTIVE FEATURE EVALUATION NOTICE: This feature evaluation assesses the statistical quality, distribution, coverage, and stability of historical observations only. Features and metrics do NOT predict future lottery outcomes, indicate hot/cold numbers, provide betting advantages, or imply causation.";

export type FeatureStabilityClassification =
  | "STABLE"
  | "VARIABLE"
  | "INSUFFICIENT_DATA"
  | "STRUCTURALLY_SPARSE";

// ============================================================================
// Coverage & Cardinality Contracts
// ============================================================================

export interface FeatureCoverageSummary {
  totalRows: number;
  populatedCount: number;
  missingCount: number;
  coverageRatio: number; // populatedCount / totalRows
  missingnessRatio: number; // missingCount / totalRows
  expectedStructuralNullsCount: number;
  unexpectedMissingCount: number;
  hasUnexpectedMissing: boolean;
}

export interface FeatureCardinalitySummary {
  distinctValueCount: number;
  uniqueValueRatio: number; // distinctValueCount / populatedCount (or 0 if populatedCount = 0)
  isConstant: boolean;
  isLowCardinality: boolean; // distinctValueCount <= 10
}

// ============================================================================
// Distribution Contracts
// ============================================================================

export interface NumericDistributionMetrics {
  min: number;
  max: number;
  mean: number;
  variance: number;
  standardDeviation: number;
}

export interface CategoricalDistributionMetrics {
  categoryCounts: Record<string, number>;
  categoryProportions: Record<string, number>;
  entropy: number; // Shannon entropy in bits
  dominantCategory: string;
}

export interface FeatureDistributionSummary {
  dataType: FeatureValueType;
  numericMetrics?: NumericDistributionMetrics;
  categoricalMetrics?: CategoricalDistributionMetrics;
}

// ============================================================================
// Stability & Redundancy Contracts
// ============================================================================

export interface FeatureStabilitySummary {
  classification: FeatureStabilityClassification;
  partitionCount: number;
  partitionMetrics: Record<
    string,
    {
      populatedCount: number;
      coverageRatio: number;
      meanOrMode?: string | number;
    }
  >;
  variationMetric?: number; // e.g. coefficient of variation or max deviation
  rationale: string;
}

export interface PairwiseRedundancy {
  featureA: string;
  featureB: string;
  redundancyType: "EXACT_DUPLICATE" | "DETERMINISTIC_TRANSFORM" | "HIGH_ASSOCIATION";
  overlapCount: number;
  matchRatio: number;
  description: string;
}

export interface FeatureRedundancyMetric {
  hasExactDuplicates: boolean;
  duplicateFeatures: string[];
  deterministicDependencies: string[];
}

export interface FeatureRedundancySummary {
  totalPairsEvaluated: number;
  exactDuplicatePairs: Array<{ featureA: string; featureB: string }>;
  deterministicTransforms: Array<{ featureA: string; featureB: string; relation: string }>;
  pairwiseRedundancies: PairwiseRedundancy[];
}

// ============================================================================
// Validation & Integrity Contracts
// ============================================================================

export interface FeatureValidationIssue {
  severity: "INFO" | "WARNING" | "ERROR";
  code: string;
  message: string;
  featureName?: string;
  details?: Record<string, any>;
}

export interface FeatureIntegrityReport {
  totalRowsChecked: number;
  integrityChecksPassed: boolean;
  sourceResultIdConsistent: boolean;
  sourceDocumentShaConsistent: boolean;
  sourceDrawConsistent: boolean;
  resultTypeSeparationValid: boolean;
  seriesSuffixSeparationValid: boolean;
  leadingZeroPreserved: boolean;
  featureVersionConsistent: boolean;
  numberLengthConsistent: boolean;
  noDuplicatedRows: boolean;
  noTargetLeakage: boolean;
  issues: FeatureValidationIssue[];
}

// ============================================================================
// Population Scope & Evaluation Report
// ============================================================================

export interface FeatureEvaluationPopulationScope {
  corpusId?: string;
  featureMatrixId: string;
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

export interface FeatureEvaluationMetric {
  featureName: string;
  featureFamily: FeatureFamily;
  featureDataType: FeatureValueType;
  coverage: FeatureCoverageSummary;
  cardinality: FeatureCardinalitySummary;
  distribution: FeatureDistributionSummary;
  stability: FeatureStabilitySummary;
  redundancy: FeatureRedundancyMetric;
  validationIssues: FeatureValidationIssue[];
}

export interface FeatureEvaluationReport {
  id: string; // Deterministic: `feval_${deterministicHash}`
  featureMatrixId: string;
  corpusId: string;
  featureEngineeringVersion: string;
  evaluationVersion: string;
  evaluatedAt: string;
  status: "COMPLETED" | "PARTIAL" | "FAILED" | "INSUFFICIENT_DATA";
  populationScope: FeatureEvaluationPopulationScope;
  totalFeaturesEvaluated: number;
  featureMetrics: Record<string, FeatureEvaluationMetric>;
  matrixRedundancySummary: FeatureRedundancySummary;
  matrixIntegrityReport: FeatureIntegrityReport;
  summary: {
    totalFeatures: number;
    stableFeaturesCount: number;
    variableFeaturesCount: number;
    structurallySparseCount: number;
    insufficientDataCount: number;
    constantFeatures: string[];
    exactDuplicateFeaturePairsCount: number;
    unexpectedMissingValuesTotal: number;
    dataIntegrityPassed: boolean;
  };
  deterministicHash: string;
  limitations: string[];
  descriptiveOnly: true;
}

export interface HistoricalFeatureEvaluationRecord {
  id: string; // matches report.id
  report: FeatureEvaluationReport;
  createdAt: string;
}
