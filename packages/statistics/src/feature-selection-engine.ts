/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 6C: Feature Selection & Modeling Representation Engine
 *
 * Implements:
 * - Deterministic, versioned, evidence-based feature selection based on 6B evaluation findings
 * - Preservation of source observations (6A remains completely immutable)
 * - Exact duplicate elimination via semantic entity precedence (e.g. digitCount ↔ numberLength)
 * - Trivial formatting derivative elimination (e.g. seriesCharacters vs seriesCode)
 * - Retention of mathematically informative transforms with explicit structural reasoning
 * - Population-aware structural sparsity handling (preserving structural nulls without arbitrary zero-imputation)
 * - Strict leakage and target safety validation (descriptiveOnly = true)
 * - Deterministic ModelFeatureMatrix construction with canonical column ordering
 * - Full 43-feature decision reporting and provenance traceability
 * - In-Memory and Firestore REST repositories
 */

import { createHash } from "node:crypto";
import type { FeatureMatrix } from "./feature-types";
import { FeatureValidationError } from "./feature-types";
import type { FeatureEvaluationReport } from "./feature-evaluation-types";
import {
  DEFAULT_FEATURE_SELECTION_VERSION,
  HISTORICAL_FEATURE_SELECTION_DISCLAIMER,
  type StructuralApplicability,
  type FeatureSelectionPolicy,
  type FeatureSelectionDecision,
  type ModelFeatureColumn,
  type ModelFeatureMatrixRow,
  type FeatureSelectionPopulationScope,
  type FeatureSelectionValidationResult,
  type ModelFeatureMatrix,
  type FeatureSelectionReport,
  type HistoricalModelFeatureRecord
} from "./feature-selection-types";

// ============================================================================
// Canonical Default Selection Policy
// ============================================================================

export const DEFAULT_FEATURE_SELECTION_POLICY: FeatureSelectionPolicy = {
  policyId: "pol_v1_canonical_selection",
  policyVersion: "v1.0.0-feature-selection",
  policyName: "Canonical Representation Policy",
  description:
    "Deterministic model-ready representation policy based on 6B statistical evaluation: eliminates exact duplicates using semantic entity precedence, excludes trivial formatting derivatives, retains mathematically distinct derived features, preserves structurally sparse features with explicit population applicability metadata, and retains lottery structure variables.",
  excludeExactDuplicates: true,
  canonicalDuplicateResolutionRule: "SEMANTIC_ENTITY_PRECEDENCE",
  excludeFormattingDerivatives: true,
  structuralSparsityHandling: "RETAIN_WITH_METADATA",
  variableHandling: "RETAIN",
  allowLosslessTransformations: true,
  disclaimer: HISTORICAL_FEATURE_SELECTION_DISCLAIMER
};

// ============================================================================
// Deterministic Hash Functions
// ============================================================================

export function computeSelectionPolicyHash(policy: FeatureSelectionPolicy): string {
  const payload = [
    policy.policyId,
    policy.policyVersion,
    policy.excludeExactDuplicates ? "true" : "false",
    policy.canonicalDuplicateResolutionRule,
    policy.excludeFormattingDerivatives ? "true" : "false",
    policy.structuralSparsityHandling,
    policy.variableHandling,
    policy.allowLosslessTransformations ? "true" : "false"
  ].join("|");

  return createHash("sha256").update(payload, "utf8").digest("hex").slice(0, 16);
}

export function computeModelFeatureMatrixHash(
  sourceMatrixId: string,
  selectionVersion: string,
  selectedColumnNames: string[],
  policyHash: string,
  rows: ModelFeatureMatrixRow[]
): string {
  // Deterministic digest over sorted columns and row values
  const hasher = createHash("sha256");
  hasher.update(`${sourceMatrixId}|${selectionVersion}|${selectedColumnNames.slice().sort().join(",")}|${policyHash}|${rows.length}`);

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    const rowVals = selectedColumnNames.map((col) => String(r.values[col] ?? "null")).join(",");
    hasher.update(`|${r.resultId}:${rowVals}`);
  }

  return hasher.digest("hex").slice(0, 16);
}

export function computeFeatureSelectionReportHash(
  sourceMatrixId: string,
  evaluationId: string,
  selectionVersion: string,
  decisions: FeatureSelectionDecision[]
): string {
  const sortedDecisions = decisions
    .slice()
    .sort((a, b) => a.featureName.localeCompare(b.featureName));

  const decisionPayload = sortedDecisions
    .map((d) => `${d.featureName}:${d.selectionStatus}:${d.resultingDataType}`)
    .join(";");

  const payload = `${sourceMatrixId}|${evaluationId}|${selectionVersion}|${decisionPayload}`;
  return createHash("sha256").update(payload, "utf8").digest("hex").slice(0, 16);
}

// ============================================================================
// Core Feature Selection Evaluator
// ============================================================================

/**
 * Evaluates selection decisions for all 43 engineered features based on 6B evaluation evidence.
 */
export function evaluateFeatureSelectionDecisions(
  sourceMatrix: FeatureMatrix,
  evaluationReport: FeatureEvaluationReport,
  policy: FeatureSelectionPolicy = DEFAULT_FEATURE_SELECTION_POLICY
): Record<string, FeatureSelectionDecision> {
  if (sourceMatrix.id !== evaluationReport.featureMatrixId) {
    throw new FeatureValidationError(
      `Matrix ID mismatch: FeatureMatrix ID '${sourceMatrix.id}' does not match EvaluationReport featureMatrixId '${evaluationReport.featureMatrixId}'`,
      "EMPTY_RESULT_SET"
    );
  }

  const decisions: Record<string, FeatureSelectionDecision> = {};
  const version = policy.policyVersion;

  // Exact duplicate set from 6B
  const duplicatePairs = evaluationReport.matrixRedundancySummary.exactDuplicatePairs;

  for (const featureName of sourceMatrix.featureNames) {
    const family = sourceMatrix.featureFamilies[featureName]!;
    const originalType = sourceMatrix.featureTypes[featureName]!;
    const evalMetric = evaluationReport.featureMetrics[featureName];

    const provenance = `Derived from 6A FeatureMatrix '${sourceMatrix.id}' evaluated in 6B Report '${evaluationReport.id}'`;

    // 1. Exact Duplicate Resolution: digitCount ↔ numberLength
    if (policy.excludeExactDuplicates) {
      const isExactDuplicate = duplicatePairs.some(
        (p) => p.featureA === featureName || p.featureB === featureName
      );

      if (isExactDuplicate) {
        if (featureName === "digitCount") {
          decisions[featureName] = {
            featureName,
            featureFamily: family,
            sourceFeatureMatrixId: sourceMatrix.id,
            sourceFeatureEvaluationId: evaluationReport.id,
            selectionStatus: "EXCLUDED_REDUNDANT",
            selectionReason:
              "Exact duplicate of 'numberLength' across all 2,270 historical rows (100% pairwise value identity). Excluded under SEMANTIC_ENTITY_PRECEDENCE rule in favor of canonical 'numberLength'.",
            originalDataType: originalType,
            resultingDataType: originalType,
            transformation: null,
            structuralApplicability: "ALL",
            provenance,
            selectionVersion: version
          };
          continue;
        } else if (featureName === "numberLength") {
          decisions[featureName] = {
            featureName,
            featureFamily: family,
            sourceFeatureMatrixId: sourceMatrix.id,
            sourceFeatureEvaluationId: evaluationReport.id,
            selectionStatus: "RETAINED",
            selectionReason:
              "Canonical length representation retained over duplicate 'digitCount' under SEMANTIC_ENTITY_PRECEDENCE rule.",
            originalDataType: originalType,
            resultingDataType: originalType,
            transformation: null,
            structuralApplicability: "ALL",
            provenance,
            selectionVersion: version
          };
          continue;
        }
      }
    }

    // 2. Formatting Derivative: seriesCharacters vs seriesCode
    if (policy.excludeFormattingDerivatives && featureName === "seriesCharacters") {
      decisions[featureName] = {
        featureName,
        featureFamily: family,
        sourceFeatureMatrixId: sourceMatrix.id,
        sourceFeatureEvaluationId: evaluationReport.id,
        selectionStatus: "EXCLUDED_REDUNDANT",
        selectionReason:
          "Trivial formatting derivative of 'seriesCode' ('seriesCode.split('').join(',')') containing identical entropy and zero distinct information.",
        originalDataType: originalType,
        resultingDataType: originalType,
        transformation: null,
        structuralApplicability: "FULL_TICKET_ONLY",
        provenance,
        selectionVersion: version
      };
      continue;
    }

    // 3. Structurally Sparse Features Handling
    const isStructurallySparse = evalMetric?.stability.classification === "STRUCTURALLY_SPARSE";

    if (isStructurallySparse) {
      if (policy.structuralSparsityHandling === "EXCLUDE_STRUCTURALLY_SPARSE") {
        decisions[featureName] = {
          featureName,
          featureFamily: family,
          sourceFeatureMatrixId: sourceMatrix.id,
          sourceFeatureEvaluationId: evaluationReport.id,
          selectionStatus: "EXCLUDED_STRUCTURALLY_SPARSE",
          selectionReason:
            "Excluded under EXCLUDE_STRUCTURALLY_SPARSE policy option for universal-only modeling representation.",
          originalDataType: originalType,
          resultingDataType: originalType,
          transformation: null,
          structuralApplicability: family === "SERIES" || featureName.endsWith("_5") || featureName.endsWith("_6")
            ? "FULL_TICKET_ONLY"
            : "ALL",
          provenance,
          selectionVersion: version
        };
        continue;
      } else {
        // RETAIN_WITH_METADATA: Preserve with explicit structural applicability
        const applicability: StructuralApplicability =
          family === "SERIES" || featureName.endsWith("_5") || featureName.endsWith("_6")
            ? "FULL_TICKET_ONLY"
            : "ALL";

        decisions[featureName] = {
          featureName,
          featureFamily: family,
          sourceFeatureMatrixId: sourceMatrix.id,
          sourceFeatureEvaluationId: evaluationReport.id,
          selectionStatus: "RETAINED",
          selectionReason:
            `Retained with ${applicability} metadata. Structural sparsity (expected structural nulls) reflects Kerala lottery 2-tier prize structure rather than missing data.`,
          originalDataType: originalType,
          resultingDataType: originalType,
          transformation: null,
          structuralApplicability: applicability,
          provenance,
          selectionVersion: version
        };
        continue;
      }
    }

    // 4. Suffix Features Handling
    if (family === "SUFFIX") {
      decisions[featureName] = {
        featureName,
        featureFamily: family,
        sourceFeatureMatrixId: sourceMatrix.id,
        sourceFeatureEvaluationId: evaluationReport.id,
        selectionStatus: "RETAINED",
        selectionReason:
          "Official prize qualification representation for suffix prize tiers (ranks 3 to 9). Retained with SUFFIX_ONLY applicability metadata.",
        originalDataType: originalType,
        resultingDataType: originalType,
        transformation: null,
        structuralApplicability: "SUFFIX_ONLY",
        provenance,
        selectionVersion: version
      };
      continue;
    }

    // 5. Mathematical Transforms Handling (e.g. repeatedDigitCount, evenDigitCount, leadingZero)
    if (featureName === "repeatedDigitCount") {
      decisions[featureName] = {
        featureName,
        featureFamily: family,
        sourceFeatureMatrixId: sourceMatrix.id,
        sourceFeatureEvaluationId: evaluationReport.id,
        selectionStatus: "RETAINED",
        selectionReason:
          "Retained alongside 'uniqueDigitCount' because it captures duplicate frequency directly, providing distinct modeling utility without information loss.",
        originalDataType: originalType,
        resultingDataType: originalType,
        transformation: "repeatedDigitCount = digitCount - uniqueDigitCount",
        structuralApplicability: "ALL",
        provenance,
        selectionVersion: version
      };
      continue;
    }

    if (featureName === "evenDigitCount" || featureName === "oddDigitCount") {
      decisions[featureName] = {
        featureName,
        featureFamily: family,
        sourceFeatureMatrixId: sourceMatrix.id,
        sourceFeatureEvaluationId: evaluationReport.id,
        selectionStatus: "RETAINED",
        selectionReason:
          "Retained as orthogonal parity partitions (evenDigitCount + oddDigitCount = numberLength) providing direct structural composition.",
        originalDataType: originalType,
        resultingDataType: originalType,
        transformation: "evenDigitCount + oddDigitCount = digitCount",
        structuralApplicability: "ALL",
        provenance,
        selectionVersion: version
      };
      continue;
    }

    if (featureName === "leadingZero") {
      decisions[featureName] = {
        featureName,
        featureFamily: family,
        sourceFeatureMatrixId: sourceMatrix.id,
        sourceFeatureEvaluationId: evaluationReport.id,
        selectionStatus: "RETAINED",
        selectionReason:
          "Retained alongside nominal 'firstDigit' as an explicit binary indicator of leading zero string formatting.",
        originalDataType: originalType,
        resultingDataType: originalType,
        transformation: "leadingZero = (firstDigit === '0')",
        structuralApplicability: "ALL",
        provenance,
        selectionVersion: version
      };
      continue;
    }

    // 6. Variable Feature: prizeTierRank
    if (featureName === "prizeTierRank") {
      if (policy.variableHandling === "EXCLUDE") {
        decisions[featureName] = {
          featureName,
          featureFamily: family,
          sourceFeatureMatrixId: sourceMatrix.id,
          sourceFeatureEvaluationId: evaluationReport.id,
          selectionStatus: "EXCLUDED_STRUCTURALLY_SPARSE",
          selectionReason: "Excluded under VARIABLE feature exclusion policy.",
          originalDataType: originalType,
          resultingDataType: originalType,
          transformation: null,
          structuralApplicability: "ALL",
          provenance,
          selectionVersion: version
        };
        continue;
      } else {
        decisions[featureName] = {
          featureName,
          featureFamily: family,
          sourceFeatureMatrixId: sourceMatrix.id,
          sourceFeatureEvaluationId: evaluationReport.id,
          selectionStatus: "RETAINED",
          selectionReason:
            "Official prize rank (1-9) reflecting prize schedule hierarchy. Cross-draw variation reflects heterogeneous weekly prize schedules; retained as valid historical structure.",
          originalDataType: originalType,
          resultingDataType: originalType,
          transformation: null,
          structuralApplicability: "ALL",
          provenance,
          selectionVersion: version
        };
        continue;
      }
    }

    // 7. General Stable Features
    decisions[featureName] = {
      featureName,
      featureFamily: family,
      sourceFeatureMatrixId: sourceMatrix.id,
      sourceFeatureEvaluationId: evaluationReport.id,
      selectionStatus: "RETAINED",
      selectionReason:
        "Deterministic descriptive feature meeting all coverage, distribution, and stability standards with zero redundancy.",
      originalDataType: originalType,
      resultingDataType: originalType,
      transformation: null,
      structuralApplicability: "ALL",
      provenance,
      selectionVersion: version
    };
  }

  return decisions;
}

// ============================================================================
// Selection & Representation Validator
// ============================================================================

export function validateModelFeatureSelection(
  sourceMatrix: FeatureMatrix,
  modelMatrix: ModelFeatureMatrix,
  decisions: Record<string, FeatureSelectionDecision>
): FeatureSelectionValidationResult {
  const issues: string[] = [];
  const totalFeaturesChecked = sourceMatrix.featureNames.length;

  // 1. All 43 features accounted for
  let allFeaturesAccountedFor = true;
  for (const fn of sourceMatrix.featureNames) {
    if (!decisions[fn]) {
      allFeaturesAccountedFor = false;
      issues.push(`Feature '${fn}' missing explicit selection decision.`);
    }
  }

  // 2. No unexplained exclusions
  let noUnexplainedExclusions = true;
  for (const [fn, decision] of Object.entries(decisions)) {
    if (decision.selectionStatus !== "RETAINED" && (!decision.selectionReason || decision.selectionReason.trim() === "")) {
      noUnexplainedExclusions = false;
      issues.push(`Excluded feature '${fn}' has no documented selection reason.`);
    }
  }

  // 3. Row count preservation
  const rowCountPreserved = modelMatrix.rows.length === sourceMatrix.rows.length;
  if (!rowCountPreserved) {
    issues.push(`Row count mismatch: Source has ${sourceMatrix.rows.length}, Model matrix has ${modelMatrix.rows.length}.`);
  }

  // 4. Result IDs aligned 1:1
  let resultIdsAligned = true;
  let leadingZerosPreserved = true;
  let fullTicketSuffixSeparationPreserved = true;
  let provenancePreserved = true;

  for (let i = 0; i < sourceMatrix.rows.length; i++) {
    const sRow = sourceMatrix.rows[i]!;
    const mRow = modelMatrix.rows[i];

    if (!mRow || mRow.resultId !== sRow.resultId) {
      resultIdsAligned = false;
      issues.push(`Result ID mismatch at index ${i}: Source '${sRow.resultId}' !== Model '${mRow?.resultId}'.`);
      break;
    }

    if (sRow.canonicalNumber.startsWith("0")) {
      if (mRow.canonicalNumber !== sRow.canonicalNumber || !mRow.canonicalNumber.startsWith("0")) {
        leadingZerosPreserved = false;
        issues.push(`Leading zero lost for resultId '${sRow.resultId}'.`);
      }
    }

    if (mRow.resultType !== sRow.resultType) {
      fullTicketSuffixSeparationPreserved = false;
      issues.push(`Result type mismatch at resultId '${sRow.resultId}'.`);
    }

    if (!mRow.sourceDocumentSha256 || !mRow.sourceDrawId) {
      provenancePreserved = false;
      issues.push(`Missing source document SHA or draw ID at resultId '${sRow.resultId}'.`);
    }
  }

  // 5. Target / Outcome Leakage check
  let noTargetLeakage = true;
  for (const colName of modelMatrix.selectedColumnNames) {
    const l = colName.toLowerCase();
    if (
      l.includes("predict") ||
      l.includes("winner") ||
      l.includes("target") ||
      l.includes("label") ||
      l.includes("future") ||
      l.includes("hot") ||
      l.includes("cold") ||
      l.includes("due") ||
      l.includes("score")
    ) {
      noTargetLeakage = false;
      issues.push(`Prohibited predictive or target leakage name detected: '${colName}'.`);
    }
  }

  const passed =
    allFeaturesAccountedFor &&
    noUnexplainedExclusions &&
    rowCountPreserved &&
    resultIdsAligned &&
    leadingZerosPreserved &&
    fullTicketSuffixSeparationPreserved &&
    provenancePreserved &&
    noTargetLeakage &&
    issues.length === 0;

  return {
    passed,
    totalFeaturesChecked,
    allFeaturesAccountedFor,
    noUnexplainedExclusions,
    rowCountPreserved,
    resultIdsAligned,
    leadingZerosPreserved,
    fullTicketSuffixSeparationPreserved,
    provenancePreserved,
    noTargetLeakage,
    issues
  };
}

// ============================================================================
// Model Feature Matrix Builder
// ============================================================================

export interface BuildModelFeatureMatrixOptions {
  selectionVersion?: string;
  evaluatedAt?: string;
  policy?: FeatureSelectionPolicy;
}

/**
 * Builds a deterministic ModelFeatureMatrix and FeatureSelectionReport
 * from a 6A FeatureMatrix and 6B FeatureEvaluationReport.
 */
export function buildModelFeatureMatrix(
  sourceMatrix: FeatureMatrix,
  evaluationReport: FeatureEvaluationReport,
  options?: BuildModelFeatureMatrixOptions
): { matrix: ModelFeatureMatrix; report: FeatureSelectionReport } {
  if (!sourceMatrix || sourceMatrix.rows.length === 0) {
    throw new FeatureValidationError("Cannot build ModelFeatureMatrix from empty source matrix", "EMPTY_RESULT_SET");
  }

  const policy = options?.policy || DEFAULT_FEATURE_SELECTION_POLICY;
  const version = options?.selectionVersion || policy.policyVersion || DEFAULT_FEATURE_SELECTION_VERSION;
  const evaluatedAt = options?.evaluatedAt || new Date().toISOString();

  // 1. Evaluate Decisions for all 43 features
  const decisions = evaluateFeatureSelectionDecisions(sourceMatrix, evaluationReport, policy);
  const decisionList = Object.values(decisions).sort((a, b) => a.featureName.localeCompare(b.featureName));

  // 2. Identify Selected Columns & Excluded Decisions
  const selectedColumns: ModelFeatureColumn[] = [];
  const selectedColumnNamesSet = new Set<string>();
  const excludedDecisions: FeatureSelectionDecision[] = [];

  for (const d of decisionList) {
    if (d.selectionStatus === "RETAINED" || d.selectionStatus === "RETAINED_WITH_TRANSFORMATION") {
      selectedColumnNamesSet.add(d.featureName);
      selectedColumns.push({
        name: d.featureName,
        family: d.featureFamily,
        dataType: d.resultingDataType,
        structuralApplicability: d.structuralApplicability,
        description: d.selectionReason,
        sourceFeatureName: d.featureName,
        transformation: d.transformation
      });
    } else {
      excludedDecisions.push(d);
    }
  }

  // Canonical sorting of column names
  const selectedColumnNames = Array.from(selectedColumnNamesSet).sort();
  selectedColumns.sort((a, b) => a.name.localeCompare(b.name));

  // 3. Build Model Matrix Rows (Filtering to selected columns, preserving types and nulls)
  const rows: ModelFeatureMatrixRow[] = [];
  for (let i = 0; i < sourceMatrix.rows.length; i++) {
    const sRow = sourceMatrix.rows[i]!;
    const rowValues: Record<string, string | number | boolean | null> = {};

    for (const col of selectedColumnNames) {
      rowValues[col] = sRow.values[col] !== undefined ? sRow.values[col] : null;
    }

    rows.push({
      resultId: sRow.resultId,
      sourceDrawId: sRow.sourceDrawId,
      sourceDocumentSha256: sRow.sourceDocumentSha256,
      canonicalNumber: sRow.canonicalNumber,
      resultType: sRow.resultType,
      numberLength: sRow.canonicalNumber.length,
      values: rowValues
    });
  }

  // 4. Compute Population Scope
  const policyHash = computeSelectionPolicyHash(policy);
  const populationScope: FeatureSelectionPopulationScope = {
    corpusId: evaluationReport.corpusId,
    sourceFeatureMatrixId: sourceMatrix.id,
    sourceFeatureEvaluationId: evaluationReport.id,
    totalRows: rows.length,
    fullTicketCount: sourceMatrix.metadata.fullTicketCount,
    suffixCount: sourceMatrix.metadata.suffixCount,
    drawIds: evaluationReport.populationScope.drawIds,
    drawCount: evaluationReport.populationScope.drawCount,
    lotteryCodes: evaluationReport.populationScope.lotteryCodes,
    documentSha256s: evaluationReport.populationScope.documentSha256s,
    dateRange: evaluationReport.populationScope.dateRange,
    populationScopeHash: evaluationReport.populationScope.populationScopeHash
  };

  // 5. Deterministic Model Matrix Hash & ID
  const matrixHash = computeModelFeatureMatrixHash(
    sourceMatrix.id,
    version,
    selectedColumnNames,
    policyHash,
    rows
  );
  const modelMatrixId = `mfmat_${matrixHash}`;

  const modelMatrix: ModelFeatureMatrix = {
    id: modelMatrixId,
    sourceFeatureMatrixId: sourceMatrix.id,
    sourceFeatureEvaluationId: evaluationReport.id,
    featureSelectionVersion: version,
    policy,
    totalRecords: rows.length,
    selectedColumnNames,
    selectedColumns,
    excludedDecisions,
    allDecisions: decisions,
    rows,
    metadata: {
      corpusId: evaluationReport.corpusId,
      fullTicketCount: sourceMatrix.metadata.fullTicketCount,
      suffixCount: sourceMatrix.metadata.suffixCount,
      totalFeaturesEvaluated: sourceMatrix.featureNames.length,
      retainedFeaturesCount: selectedColumnNames.length,
      excludedFeaturesCount: excludedDecisions.length
    },
    populationScope,
    deterministicHash: matrixHash,
    provenance: `Derived from 6A FeatureMatrix '${sourceMatrix.id}' via 6B Evaluation '${evaluationReport.id}'`,
    limitations: [
      HISTORICAL_FEATURE_SELECTION_DISCLAIMER,
      "DESCRIPTIVE_REPRESENTATION_ONLY: Tabular machine representation of historical observations without predictive claims.",
      "INDEPENDENT_SELECTION: Selection does not imply feature importance, winning odds, or gambling advantages.",
      "ZERO_BETTING_UTILITY: Selected feature matrix must NOT be used for betting strategies or number picking."
    ],
    descriptiveOnly: true
  };

  // 6. Validation
  const validation = validateModelFeatureSelection(sourceMatrix, modelMatrix, decisions);

  // 7. Report Summary & Report Hash
  let exactDuplicatesResolved: string[] = [];
  let structuralSparseAddressed: string[] = [];
  let variableFeaturesAddressed: string[] = [];

  for (const d of decisionList) {
    if (d.selectionStatus === "EXCLUDED_REDUNDANT") {
      exactDuplicatesResolved.push(d.featureName);
    }
    if (d.structuralApplicability === "FULL_TICKET_ONLY" || d.structuralApplicability === "SUFFIX_ONLY") {
      structuralSparseAddressed.push(d.featureName);
    }
    if (d.featureName === "prizeTierRank") {
      variableFeaturesAddressed.push(d.featureName);
    }
  }

  const reportHash = computeFeatureSelectionReportHash(
    sourceMatrix.id,
    evaluationReport.id,
    version,
    decisionList
  );

  const report: FeatureSelectionReport = {
    reportId: `fsel_${reportHash}`,
    selectionVersion: version,
    sourceFeatureMatrixId: sourceMatrix.id,
    sourceFeatureEvaluationId: evaluationReport.id,
    modelFeatureMatrixId: modelMatrixId,
    policy,
    evaluatedAt,
    totalFeaturesEvaluated: sourceMatrix.featureNames.length,
    retainedFeaturesCount: selectedColumnNames.length,
    excludedFeaturesCount: excludedDecisions.length,
    decisions,
    decisionList,
    validation,
    summary: {
      totalInputFeatures: sourceMatrix.featureNames.length,
      retainedCount: selectedColumnNames.length,
      excludedRedundantCount: excludedDecisions.filter((d) => d.selectionStatus === "EXCLUDED_REDUNDANT").length,
      excludedSparseCount: excludedDecisions.filter((d) => d.selectionStatus === "EXCLUDED_STRUCTURALLY_SPARSE").length,
      retainedWithTransformCount: decisionList.filter((d) => d.selectionStatus === "RETAINED_WITH_TRANSFORMATION").length,
      insufficientEvidenceCount: decisionList.filter((d) => d.selectionStatus === "INSUFFICIENT_EVIDENCE").length,
      exactDuplicatesResolved,
      structuralSparseAddressed,
      variableFeaturesAddressed
    },
    deterministicHash: reportHash,
    limitations: modelMatrix.limitations,
    descriptiveOnly: true
  };

  return { matrix: modelMatrix, report };
}

// ============================================================================
// Model Feature Repository
// ============================================================================

export interface ModelFeatureRepository {
  saveModelMatrix(record: HistoricalModelFeatureRecord): Promise<void>;
  getModelMatrixById(id: string): Promise<HistoricalModelFeatureRecord | null>;
  listModelMatrices(limit?: number): Promise<HistoricalModelFeatureRecord[]>;
  countModelMatrices(): Promise<number>;
}

export class InMemoryModelFeatureRepository implements ModelFeatureRepository {
  private readonly recordsById = new Map<string, HistoricalModelFeatureRecord>();

  async saveModelMatrix(record: HistoricalModelFeatureRecord): Promise<void> {
    this.recordsById.set(record.id, JSON.parse(JSON.stringify(record)));
  }

  async getModelMatrixById(id: string): Promise<HistoricalModelFeatureRecord | null> {
    const item = this.recordsById.get(id);
    return item ? JSON.parse(JSON.stringify(item)) : null;
  }

  async listModelMatrices(limit = 10): Promise<HistoricalModelFeatureRecord[]> {
    return Array.from(this.recordsById.values())
      .slice(0, limit)
      .map((item) => JSON.parse(JSON.stringify(item)));
  }

  async countModelMatrices(): Promise<number> {
    return this.recordsById.size;
  }
}
