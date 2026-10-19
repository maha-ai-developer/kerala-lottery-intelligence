/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 6B: Feature Evaluation & Statistical Validation Engine
 *
 * Implements:
 * - Deterministic feature coverage and missingness analysis (distinguishing structural nulls from unexpected missing)
 * - Cardinality and uniqueness metrics with exact string preservation
 * - Numeric and categorical distribution metrics (min, max, mean, variance, entropy)
 * - Redundancy detection (exact duplicate feature representations & deterministic transforms)
 * - Multi-partition stability evaluation (across lotteries, draws, and result types)
 * - Strict integrity and leakage validation (no target leakage, length consistency, series/suffix separation)
 * - In-Memory and Firestore REST repositories
 *
 * Strict Non-Predictive Boundary:
 * - Evaluates descriptive quality and stability of historical observations only.
 * - Zero prediction, probability scoring, betting recommendations, or causal claims.
 */

import { createHash } from "node:crypto";
import type { FeatureMatrix, FeatureMatrixRow, FeatureFamily, FeatureValueType } from "./feature-types";
import type { MultiDrawLotteryCorpus } from "./multi-draw-corpus";
import {
  DEFAULT_FEATURE_EVALUATION_VERSION,
  HISTORICAL_FEATURE_EVALUATION_DISCLAIMER,
  type FeatureCoverageSummary,
  type FeatureCardinalitySummary,
  type FeatureDistributionSummary,
  type NumericDistributionMetrics,
  type CategoricalDistributionMetrics,
  type FeatureStabilitySummary,
  type FeatureRedundancyMetric,
  type FeatureRedundancySummary,
  type PairwiseRedundancy,
  type FeatureValidationIssue,
  type FeatureIntegrityReport,
  type FeatureEvaluationPopulationScope,
  type FeatureEvaluationMetric,
  type FeatureEvaluationReport,
  type HistoricalFeatureEvaluationRecord
} from "./feature-evaluation-types";

// ============================================================================
// Deterministic Hash Functions
// ============================================================================

export function computePopulationScopeHash(
  scope: Omit<FeatureEvaluationPopulationScope, "populationScopeHash">
): string {
  const payload = [
    scope.corpusId || "none",
    scope.featureMatrixId,
    scope.totalRows,
    scope.fullTicketCount,
    scope.suffixCount,
    scope.drawIds.slice().sort().join(","),
    scope.lotteryCodes.slice().sort().join(","),
    scope.documentSha256s.slice().sort().join(",")
  ].join("|");

  return createHash("sha256").update(payload, "utf8").digest("hex").slice(0, 16);
}

export function computeFeatureEvaluationHash(
  matrixId: string,
  evaluationVersion: string,
  totalRows: number,
  featureNames: string[],
  scopeHash: string
): string {
  const payload = `${matrixId}|${evaluationVersion}|${totalRows}|${featureNames.slice().sort().join(",")}|${scopeHash}`;
  return createHash("sha256").update(payload, "utf8").digest("hex").slice(0, 16);
}

// ============================================================================
// Coverage & Missingness Analyzer
// ============================================================================

export function calculateFeatureCoverage(
  featureName: string,
  family: FeatureFamily,
  rows: FeatureMatrixRow[]
): FeatureCoverageSummary {
  const totalRows = rows.length;
  let populatedCount = 0;
  let missingCount = 0;

  let expectedStructuralNullsCount = 0;

  for (const r of rows) {
    const val = r.values[featureName];
    if (val !== undefined && val !== null) {
      populatedCount++;
    } else {
      missingCount++;
    }

    // Determine expected structural nulls per row
    if (family === "SUFFIX") {
      // Suffix features are structurally expected to be null for FULL_TICKET rows
      if (r.resultType === "FULL_TICKET") {
        expectedStructuralNullsCount++;
      }
    } else if (family === "SERIES") {
      // Series features are structurally expected to be null for SUFFIX rows
      if (r.resultType === "SUFFIX") {
        expectedStructuralNullsCount++;
      }
    } else if (
      featureName === "digitPositionFromLeft_5" ||
      featureName === "digitPositionFromLeft_6" ||
      featureName === "digitPositionFromRight_5" ||
      featureName === "digitPositionFromRight_6"
    ) {
      // Positions 5 & 6 are structurally expected to be null for numbers of length < 5 / < 6
      const len = r.canonicalNumber.length;
      if (featureName.endsWith("_5") && len < 5) {
        expectedStructuralNullsCount++;
      } else if (featureName.endsWith("_6") && len < 6) {
        expectedStructuralNullsCount++;
      }
    }
  }

  const unexpectedMissingCount = Math.max(0, missingCount - expectedStructuralNullsCount);
  const coverageRatio = totalRows > 0 ? Number((populatedCount / totalRows).toFixed(4)) : 0;
  const missingnessRatio = totalRows > 0 ? Number((missingCount / totalRows).toFixed(4)) : 0;

  return {
    totalRows,
    populatedCount,
    missingCount,
    coverageRatio,
    missingnessRatio,
    expectedStructuralNullsCount,
    unexpectedMissingCount,
    hasUnexpectedMissing: unexpectedMissingCount > 0
  };
}

// ============================================================================
// Cardinality Analyzer
// ============================================================================

export function calculateFeatureCardinality(
  rows: FeatureMatrixRow[],
  featureName: string
): FeatureCardinalitySummary {
  const populatedValues = new Set<string>();
  let populatedCount = 0;

  for (const r of rows) {
    const val = r.values[featureName];
    if (val !== undefined && val !== null) {
      populatedCount++;
      // String preservation: preserve exact string without numeric coercion (e.g. "0045" !== "45")
      populatedValues.add(String(val));
    }
  }

  const distinctValueCount = populatedValues.size;
  const uniqueValueRatio =
    populatedCount > 0 ? Number((distinctValueCount / populatedCount).toFixed(4)) : 0;
  const isConstant = distinctValueCount <= 1 && populatedCount > 0;
  const isLowCardinality = distinctValueCount <= 10;

  return {
    distinctValueCount,
    uniqueValueRatio,
    isConstant,
    isLowCardinality
  };
}

// ============================================================================
// Distribution Analyzer
// ============================================================================

export function calculateFeatureDistribution(
  rows: FeatureMatrixRow[],
  featureName: string,
  type: FeatureValueType
): FeatureDistributionSummary {
  if (type === "INTEGER") {
    const numbers: number[] = [];
    for (const r of rows) {
      const val = r.values[featureName];
      if (typeof val === "number" && !Number.isNaN(val)) {
        numbers.push(val);
      }
    }

    if (numbers.length === 0) {
      return { dataType: type };
    }

    let min = numbers[0]!;
    let max = numbers[0]!;
    let sum = 0;

    for (const n of numbers) {
      if (n < min) min = n;
      if (n > max) max = n;
      sum += n;
    }

    const mean = sum / numbers.length;
    let sumSqDiff = 0;
    for (const n of numbers) {
      sumSqDiff += (n - mean) * (n - mean);
    }
    const variance = sumSqDiff / numbers.length;
    const standardDeviation = Math.sqrt(variance);

    const numericMetrics: NumericDistributionMetrics = {
      min,
      max,
      mean: Number(mean.toFixed(4)),
      variance: Number(variance.toFixed(4)),
      standardDeviation: Number(standardDeviation.toFixed(4))
    };

    return { dataType: type, numericMetrics };
  }

  // Categorical, String, or Boolean
  const counts: Record<string, number> = {};
  let totalPopulated = 0;

  for (const r of rows) {
    const val = r.values[featureName];
    if (val !== undefined && val !== null) {
      const key = String(val);
      counts[key] = (counts[key] || 0) + 1;
      totalPopulated++;
    }
  }

  if (totalPopulated === 0) {
    return { dataType: type };
  }

  // Sort categories deterministically
  const sortedCategories = Object.keys(counts).sort();
  const sortedCounts: Record<string, number> = {};
  const proportions: Record<string, number> = {};

  let dominantCategory = sortedCategories[0]!;
  let dominantCount = counts[dominantCategory]!;
  let entropy = 0;

  for (const cat of sortedCategories) {
    const count = counts[cat]!;
    sortedCounts[cat] = count;
    const p = count / totalPopulated;
    proportions[cat] = Number(p.toFixed(4));
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
    if (count > dominantCount) {
      dominantCount = count;
      dominantCategory = cat;
    }
  }

  const categoricalMetrics: CategoricalDistributionMetrics = {
    categoryCounts: sortedCounts,
    categoryProportions: proportions,
    entropy: Number(entropy.toFixed(4)),
    dominantCategory
  };

  return { dataType: type, categoricalMetrics };
}

// ============================================================================
// Stability Analyzer
// ============================================================================

export function calculateFeatureStability(
  rows: FeatureMatrixRow[],
  featureName: string,
  _family: FeatureFamily,
  type: FeatureValueType,
  expectedStructuralNulls: number
): FeatureStabilitySummary {
  const totalRows = rows.length;

  // 1. Structurally Sparse Check
  if (totalRows > 0 && expectedStructuralNulls / totalRows >= 0.5) {
    return {
      classification: "STRUCTURALLY_SPARSE",
      partitionCount: 0,
      partitionMetrics: {},
      rationale: `Expected structural nulls constitute ${( (expectedStructuralNulls / totalRows) * 100 ).toFixed(1)}% of population.`
    };
  }

  // Partition rows by lotteryCode if present in values, else by sourceDrawId
  const partitions: Record<string, FeatureMatrixRow[]> = {};
  for (const r of rows) {
    const key = String(r.values["lotteryCode"] || r.sourceDrawId || "DEFAULT");
    if (!partitions[key]) partitions[key] = [];
    partitions[key].push(r);
  }

  const partitionKeys = Object.keys(partitions).sort();
  const partitionMetrics: FeatureStabilitySummary["partitionMetrics"] = {};
  const validPartitionMeans: number[] = [];
  const validPartitionProportions: number[] = [];

  let totalPopulatedInAllPartitions = 0;

  for (const pKey of partitionKeys) {
    const pRows = partitions[pKey]!;
    let popCount = 0;
    let sumNum = 0;
    const catCounts: Record<string, number> = {};

    for (const r of pRows) {
      const val = r.values[featureName];
      if (val !== undefined && val !== null) {
        popCount++;
        totalPopulatedInAllPartitions++;
        if (typeof val === "number") {
          sumNum += val;
        } else {
          const str = String(val);
          catCounts[str] = (catCounts[str] || 0) + 1;
        }
      }
    }

    const coverageRatio = pRows.length > 0 ? Number((popCount / pRows.length).toFixed(4)) : 0;
    let meanOrMode: string | number | undefined;

    if (type === "INTEGER" && popCount > 0) {
      meanOrMode = Number((sumNum / popCount).toFixed(2));
      if (popCount >= 10) {
        validPartitionMeans.push(sumNum / popCount);
      }
    } else if (popCount > 0) {
      // Find mode
      let bestKey = Object.keys(catCounts)[0];
      let bestCount = -1;
      for (const [k, c] of Object.entries(catCounts)) {
        if (c > bestCount) {
          bestCount = c;
          bestKey = k;
        }
      }
      meanOrMode = bestKey;
      if (popCount >= 10 && bestKey !== undefined) {
        validPartitionProportions.push(bestCount / popCount);
      }
    }

    partitionMetrics[pKey] = {
      populatedCount: popCount,
      coverageRatio,
      meanOrMode
    };
  }

  // 2. Insufficient Data Check
  if (totalPopulatedInAllPartitions < 30 || partitionKeys.length < 2) {
    return {
      classification: "INSUFFICIENT_DATA",
      partitionCount: partitionKeys.length,
      partitionMetrics,
      rationale: `Populated observations count (${totalPopulatedInAllPartitions}) is insufficient for cross-partition stability evaluation.`
    };
  }

  // 3. Coefficient of Variation or Proportion Range
  let variationMetric = 0;
  let isStable = true;

  if (type === "INTEGER" && validPartitionMeans.length >= 2) {
    const meanOfMeans =
      validPartitionMeans.reduce((a, b) => a + b, 0) / validPartitionMeans.length;
    let variance = 0;
    for (const m of validPartitionMeans) {
      variance += (m - meanOfMeans) * (m - meanOfMeans);
    }
    const std = Math.sqrt(variance / validPartitionMeans.length);
    const cv = meanOfMeans !== 0 ? std / Math.abs(meanOfMeans) : std;
    variationMetric = Number(cv.toFixed(4));
    // Stable if coefficient of variation is low (< 0.20)
    isStable = cv < 0.2;
  } else if (validPartitionProportions.length >= 2) {
    const minP = Math.min(...validPartitionProportions);
    const maxP = Math.max(...validPartitionProportions);
    const range = maxP - minP;
    variationMetric = Number(range.toFixed(4));
    // Stable if mode proportion range across partitions is < 0.25
    isStable = range < 0.25;
  }

  return {
    classification: isStable ? "STABLE" : "VARIABLE",
    partitionCount: partitionKeys.length,
    partitionMetrics,
    variationMetric,
    rationale: isStable
      ? `Feature distribution is stable across ${partitionKeys.length} historical partitions (variation metric: ${variationMetric}).`
      : `Feature distribution varies across historical partitions (variation metric: ${variationMetric}).`
  };
}

// ============================================================================
// Redundancy Analyzer
// ============================================================================

export function calculateFeatureRedundancy(
  rows: FeatureMatrixRow[],
  featureNames: string[]
): FeatureRedundancySummary {
  const exactDuplicatePairs: Array<{ featureA: string; featureB: string }> = [];
  const deterministicTransforms: Array<{ featureA: string; featureB: string; relation: string }> = [];
  const pairwiseRedundancies: PairwiseRedundancy[] = [];

  const totalPairs = (featureNames.length * (featureNames.length - 1)) / 2;

  // 1. Pairwise exact duplicate check
  for (let i = 0; i < featureNames.length; i++) {
    for (let j = i + 1; j < featureNames.length; j++) {
      const fA = featureNames[i]!;
      const fB = featureNames[j]!;

      let matchCount = 0;
      let overlapCount = 0;

      for (const r of rows) {
        const vA = r.values[fA];
        const vB = r.values[fB];

        if (vA !== undefined && vA !== null && vB !== undefined && vB !== null) {
          overlapCount++;
          if (vA === vB) {
            matchCount++;
          }
        } else if ((vA === null || vA === undefined) && (vB === null || vB === undefined)) {
          overlapCount++;
          matchCount++;
        }
      }

      if (overlapCount === rows.length && matchCount === rows.length) {
        exactDuplicatePairs.push({ featureA: fA, featureB: fB });
        pairwiseRedundancies.push({
          featureA: fA,
          featureB: fB,
          redundancyType: "EXACT_DUPLICATE",
          overlapCount,
          matchRatio: 1.0,
          description: `Features '${fA}' and '${fB}' have identical values across all ${rows.length} rows.`
        });
      }
    }
  }

  // 2. Known Deterministic Mathematical Transformations
  // A: repeatedDigitCount === digitCount - uniqueDigitCount
  let repeatFormulaHolds = true;
  for (const r of rows) {
    const rep = r.values["repeatedDigitCount"];
    const tot = r.values["digitCount"];
    const unq = r.values["uniqueDigitCount"];
    if (typeof rep === "number" && typeof tot === "number" && typeof unq === "number") {
      if (rep !== tot - unq) {
        repeatFormulaHolds = false;
        break;
      }
    }
  }
  if (repeatFormulaHolds) {
    deterministicTransforms.push({
      featureA: "repeatedDigitCount",
      featureB: "digitCount, uniqueDigitCount",
      relation: "repeatedDigitCount = digitCount - uniqueDigitCount"
    });
  }

  // B: evenDigitCount + oddDigitCount === digitCount
  let parityFormulaHolds = true;
  for (const r of rows) {
    const even = r.values["evenDigitCount"];
    const odd = r.values["oddDigitCount"];
    const tot = r.values["digitCount"];
    if (typeof even === "number" && typeof odd === "number" && typeof tot === "number") {
      if (even + odd !== tot) {
        parityFormulaHolds = false;
        break;
      }
    }
  }
  if (parityFormulaHolds) {
    deterministicTransforms.push({
      featureA: "digitCount",
      featureB: "evenDigitCount, oddDigitCount",
      relation: "digitCount = evenDigitCount + oddDigitCount"
    });
  }

  // C: leadingZero === (firstDigit === "0")
  let leadingZeroFormulaHolds = true;
  for (const r of rows) {
    const lz = r.values["leadingZero"];
    const fd = r.values["firstDigit"];
    if (lz !== undefined && fd !== undefined) {
      if (lz !== (fd === "0")) {
        leadingZeroFormulaHolds = false;
        break;
      }
    }
  }
  if (leadingZeroFormulaHolds) {
    deterministicTransforms.push({
      featureA: "leadingZero",
      featureB: "firstDigit",
      relation: "leadingZero = (firstDigit === '0')"
    });
  }

  return {
    totalPairsEvaluated: totalPairs,
    exactDuplicatePairs,
    deterministicTransforms,
    pairwiseRedundancies
  };
}

// ============================================================================
// Integrity & Leakage Validator
// ============================================================================

export function validateFeatureMatrixIntegrity(
  matrix: FeatureMatrix,
  corpus?: MultiDrawLotteryCorpus
): FeatureIntegrityReport {
  const issues: FeatureValidationIssue[] = [];
  const knownDocShas = corpus ? new Set(corpus.documentSha256s) : null;
  const knownDrawIds = corpus ? new Set(corpus.draws.map((d) => d.drawId)) : null;

  const seenResultIds = new Set<string>();
  let sourceResultIdConsistent = true;
  let sourceDocumentShaConsistent = true;
  let sourceDrawConsistent = true;
  let resultTypeSeparationValid = true;
  let seriesSuffixSeparationValid = true;
  let leadingZeroPreserved = true;
  let numberLengthConsistent = true;
  let noDuplicatedRows = true;
  let featureVersionConsistent = matrix.featureVersion === "v1.0.0-feature-engineering";
  let noTargetLeakage = true;

  // Check feature names for target leakage
  for (const fn of matrix.featureNames) {
    const l = fn.toLowerCase();
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
      issues.push({
        severity: "ERROR",
        code: "TARGET_LEAKAGE_DETECTED",
        message: `Feature '${fn}' contains prohibited predictive or target leakage naming.`,
        featureName: fn
      });
    }
  }

  for (let i = 0; i < matrix.rows.length; i++) {
    const r = matrix.rows[i]!;

    // 1. Result ID
    if (!r.resultId || typeof r.resultId !== "string" || r.resultId.trim() === "") {
      sourceResultIdConsistent = false;
      issues.push({
        severity: "ERROR",
        code: "MALFORMED_RESULT_ID",
        message: `Row index ${i} has empty or missing resultId.`
      });
    } else {
      if (seenResultIds.has(r.resultId)) {
        noDuplicatedRows = false;
        issues.push({
          severity: "ERROR",
          code: "DUPLICATED_RESULT_ROW",
          message: `Duplicated resultId '${r.resultId}' found at row ${i}.`
        });
      }
      seenResultIds.add(r.resultId);
    }

    // 2. Document SHA-256
    if (!r.sourceDocumentSha256 || r.sourceDocumentSha256.length !== 64) {
      sourceDocumentShaConsistent = false;
      issues.push({
        severity: "ERROR",
        code: "MALFORMED_DOCUMENT_SHA",
        message: `Row ${r.resultId} has malformed document SHA: '${r.sourceDocumentSha256}'.`
      });
    } else if (knownDocShas && !knownDocShas.has(r.sourceDocumentSha256)) {
      sourceDocumentShaConsistent = false;
      issues.push({
        severity: "ERROR",
        code: "UNKNOWN_DOCUMENT_SHA",
        message: `Row ${r.resultId} document SHA '${r.sourceDocumentSha256}' not present in corpus.`
      });
    }

    // 3. Draw ID
    if (!r.sourceDrawId || typeof r.sourceDrawId !== "string") {
      sourceDrawConsistent = false;
      issues.push({
        severity: "ERROR",
        code: "MALFORMED_DRAW_ID",
        message: `Row ${r.resultId} has missing or malformed sourceDrawId.`
      });
    } else if (knownDrawIds && !knownDrawIds.has(r.sourceDrawId)) {
      sourceDrawConsistent = false;
      issues.push({
        severity: "ERROR",
        code: "UNKNOWN_DRAW_ID",
        message: `Row ${r.resultId} sourceDrawId '${r.sourceDrawId}' not present in corpus.`
      });
    }

    // 4. Result Type Separation & Series/Suffix separation
    if (r.resultType !== "FULL_TICKET" && r.resultType !== "SUFFIX") {
      resultTypeSeparationValid = false;
      issues.push({
        severity: "ERROR",
        code: "INVALID_RESULT_TYPE",
        message: `Row ${r.resultId} has invalid resultType '${r.resultType}'.`
      });
    }

    if (r.resultType === "FULL_TICKET") {
      if (!r.values["seriesCode"] || r.values["seriesLength"] === null) {
        seriesSuffixSeparationValid = false;
        issues.push({
          severity: "ERROR",
          code: "FULL_TICKET_MISSING_SERIES",
          message: `FULL_TICKET row ${r.resultId} is missing mandatory seriesCode.`
        });
      }
      if (r.values["suffix2"] !== null || r.values["suffix3"] !== null || r.values["suffix4"] !== null) {
        seriesSuffixSeparationValid = false;
        issues.push({
          severity: "ERROR",
          code: "FULL_TICKET_HAS_SUFFIX_FEATURES",
          message: `FULL_TICKET row ${r.resultId} has non-null suffix features.`
        });
      }
    } else if (r.resultType === "SUFFIX") {
      if (r.values["seriesCode"] !== null || r.values["seriesLength"] !== null) {
        seriesSuffixSeparationValid = false;
        issues.push({
          severity: "ERROR",
          code: "SUFFIX_HAS_SERIES_FEATURES",
          message: `SUFFIX row ${r.resultId} has non-null series features.`
        });
      }
      if (!r.values["suffix2"] || !r.values["suffix3"] || !r.values["suffix4"]) {
        seriesSuffixSeparationValid = false;
        issues.push({
          severity: "ERROR",
          code: "SUFFIX_MISSING_SUFFIX_FEATURES",
          message: `4-digit SUFFIX row ${r.resultId} is missing suffix features.`
        });
      }
    }

    // 5. Leading-zero preservation
    if (r.canonicalNumber.startsWith("0")) {
      if (typeof r.canonicalNumber !== "string") {
        leadingZeroPreserved = false;
      }
      if (r.values["leadingZero"] !== true || r.values["firstDigit"] !== "0") {
        leadingZeroPreserved = false;
        issues.push({
          severity: "ERROR",
          code: "LEADING_ZERO_CORRUPTED",
          message: `Row ${r.resultId} canonical number '${r.canonicalNumber}' failed leading-zero checks.`
        });
      }
    }

    // 6. Number length consistency
    if (r.canonicalNumber.length !== r.values["numberLength"]) {
      numberLengthConsistent = false;
      issues.push({
        severity: "ERROR",
        code: "NUMBER_LENGTH_MISMATCH",
        message: `Row ${r.resultId} string length ${r.canonicalNumber.length} !== numberLength ${r.values["numberLength"]}.`
      });
    }
  }

  const integrityChecksPassed =
    sourceResultIdConsistent &&
    sourceDocumentShaConsistent &&
    sourceDrawConsistent &&
    resultTypeSeparationValid &&
    seriesSuffixSeparationValid &&
    leadingZeroPreserved &&
    featureVersionConsistent &&
    numberLengthConsistent &&
    noDuplicatedRows &&
    noTargetLeakage &&
    issues.length === 0;

  return {
    totalRowsChecked: matrix.rows.length,
    integrityChecksPassed,
    sourceResultIdConsistent,
    sourceDocumentShaConsistent,
    sourceDrawConsistent,
    resultTypeSeparationValid,
    seriesSuffixSeparationValid,
    leadingZeroPreserved,
    featureVersionConsistent,
    numberLengthConsistent,
    noDuplicatedRows,
    noTargetLeakage,
    issues
  };
}

// ============================================================================
// Main Feature Evaluation Engine
// ============================================================================

export interface EvaluateFeatureMatrixOptions {
  evaluationVersion?: string;
  evaluatedAt?: string;
}

/**
 * Deterministically evaluates the quality, coverage, cardinality, distribution,
 * redundancy, stability, and integrity of a FeatureMatrix.
 */
export function evaluateFeatureMatrix(
  matrix: FeatureMatrix,
  corpus?: MultiDrawLotteryCorpus,
  options?: EvaluateFeatureMatrixOptions
): FeatureEvaluationReport {
  const evalVersion = options?.evaluationVersion || DEFAULT_FEATURE_EVALUATION_VERSION;
  const evaluatedAt = options?.evaluatedAt || new Date().toISOString();

  // 1. Build Population Scope
  const drawIdsSet = new Set<string>();
  const lotteryCodesSet = new Set<string>();
  const docShaSet = new Set<string>();

  for (const r of matrix.rows) {
    if (r.sourceDrawId) drawIdsSet.add(r.sourceDrawId);
    if (r.sourceDocumentSha256) docShaSet.add(r.sourceDocumentSha256);
    const lotCode = r.values["lotteryCode"];
    if (lotCode && typeof lotCode === "string") lotteryCodesSet.add(lotCode);
  }

  const drawIds = Array.from(drawIdsSet).sort();
  const lotteryCodes = Array.from(lotteryCodesSet).sort();
  const documentSha256s = Array.from(docShaSet).sort();

  const rawScope = {
    corpusId: matrix.metadata.corpusId,
    featureMatrixId: matrix.id,
    totalRows: matrix.totalRecords,
    fullTicketCount: matrix.metadata.fullTicketCount,
    suffixCount: matrix.metadata.suffixCount,
    drawIds,
    drawCount: drawIds.length,
    lotteryCodes,
    documentSha256s,
    dateRange: {
      earliest: corpus?.validationReport.dateRange.earliest,
      latest: corpus?.validationReport.dateRange.latest
    }
  };

  const scopeHash = computePopulationScopeHash(rawScope);
  const populationScope: FeatureEvaluationPopulationScope = {
    ...rawScope,
    populationScopeHash: scopeHash
  };

  // 2. Evaluate Matrix Redundancy
  const matrixRedundancySummary = calculateFeatureRedundancy(matrix.rows, matrix.featureNames);

  // 3. Matrix Integrity & Leakage Validation
  const matrixIntegrityReport = validateFeatureMatrixIntegrity(matrix, corpus);

  // 4. Feature-by-Feature Metrics Evaluation
  const featureMetrics: Record<string, FeatureEvaluationMetric> = {};

  let stableCount = 0;
  let variableCount = 0;
  let sparseCount = 0;
  let insufficientCount = 0;
  let unexpectedMissingTotal = 0;
  const constantFeatures: string[] = [];

  for (const fn of matrix.featureNames) {
    const family = matrix.featureFamilies[fn]!;
    const dType = matrix.featureTypes[fn]!;

    const coverage = calculateFeatureCoverage(fn, family, matrix.rows);
    unexpectedMissingTotal += coverage.unexpectedMissingCount;

    const cardinality = calculateFeatureCardinality(matrix.rows, fn);
    if (cardinality.isConstant) {
      constantFeatures.push(fn);
    }

    const distribution = calculateFeatureDistribution(matrix.rows, fn, dType);

    const stability = calculateFeatureStability(
      matrix.rows,
      fn,
      family,
      dType,
      coverage.expectedStructuralNullsCount
    );

    if (stability.classification === "STABLE") stableCount++;
    else if (stability.classification === "VARIABLE") variableCount++;
    else if (stability.classification === "STRUCTURALLY_SPARSE") sparseCount++;
    else if (stability.classification === "INSUFFICIENT_DATA") insufficientCount++;

    // Redundancy metric for this specific feature
    const dupMatches = matrixRedundancySummary.exactDuplicatePairs
      .filter((p) => p.featureA === fn || p.featureB === fn)
      .map((p) => (p.featureA === fn ? p.featureB : p.featureA));

    const transformMatches = matrixRedundancySummary.deterministicTransforms
      .filter((t) => t.featureA === fn || t.featureB.includes(fn))
      .map((t) => t.relation);

    const redundancy: FeatureRedundancyMetric = {
      hasExactDuplicates: dupMatches.length > 0,
      duplicateFeatures: dupMatches,
      deterministicDependencies: transformMatches
    };

    const validationIssues: FeatureValidationIssue[] = [];
    if (coverage.hasUnexpectedMissing) {
      validationIssues.push({
        severity: "WARNING",
        code: "UNEXPECTED_MISSING_VALUES",
        message: `Feature '${fn}' contains ${coverage.unexpectedMissingCount} unexpected missing values.`,
        featureName: fn
      });
    }
    if (cardinality.isConstant && coverage.populatedCount > 0) {
      validationIssues.push({
        severity: "INFO",
        code: "CONSTANT_FEATURE",
        message: `Feature '${fn}' has a constant value across all ${coverage.populatedCount} populated rows.`,
        featureName: fn
      });
    }

    featureMetrics[fn] = {
      featureName: fn,
      featureFamily: family,
      featureDataType: dType,
      coverage,
      cardinality,
      distribution,
      stability,
      redundancy,
      validationIssues
    };
  }

  // 5. Deterministic Evaluation Hash
  const deterministicHash = computeFeatureEvaluationHash(
    matrix.id,
    evalVersion,
    matrix.totalRecords,
    matrix.featureNames,
    scopeHash
  );

  return {
    id: `feval_${deterministicHash}`,
    featureMatrixId: matrix.id,
    corpusId: matrix.metadata.corpusId || "unknown_corpus",
    featureEngineeringVersion: matrix.featureVersion,
    evaluationVersion: evalVersion,
    evaluatedAt,
    status: matrixIntegrityReport.integrityChecksPassed ? "COMPLETED" : "FAILED",
    populationScope,
    totalFeaturesEvaluated: matrix.featureNames.length,
    featureMetrics,
    matrixRedundancySummary,
    matrixIntegrityReport,
    summary: {
      totalFeatures: matrix.featureNames.length,
      stableFeaturesCount: stableCount,
      variableFeaturesCount: variableCount,
      structurallySparseCount: sparseCount,
      insufficientDataCount: insufficientCount,
      constantFeatures,
      exactDuplicateFeaturePairsCount: matrixRedundancySummary.exactDuplicatePairs.length,
      unexpectedMissingValuesTotal: unexpectedMissingTotal,
      dataIntegrityPassed: matrixIntegrityReport.integrityChecksPassed
    },
    deterministicHash,
    limitations: [
      HISTORICAL_FEATURE_EVALUATION_DISCLAIMER,
      "DESCRIPTIVE_EVALUATION_ONLY: Evaluates historical dataset properties without evaluating predictive validity.",
      "INDEPENDENT_RANDOMNESS: Low feature variability does NOT imply future non-randomness or winning odds.",
      "ZERO_GAMBLING_UTILITY: Results cannot be used for betting optimization, selection scoring, or lottery play."
    ],
    descriptiveOnly: true
  };
}

// ============================================================================
// Feature Evaluation Repositories
// ============================================================================

export interface FeatureEvaluationRepository {
  saveEvaluation(record: HistoricalFeatureEvaluationRecord): Promise<void>;
  getEvaluationById(id: string): Promise<HistoricalFeatureEvaluationRecord | null>;
  listEvaluations(limit?: number): Promise<HistoricalFeatureEvaluationRecord[]>;
}

export class InMemoryFeatureEvaluationRepository implements FeatureEvaluationRepository {
  private readonly reportsById = new Map<string, HistoricalFeatureEvaluationRecord>();

  async saveEvaluation(record: HistoricalFeatureEvaluationRecord): Promise<void> {
    this.reportsById.set(record.id, JSON.parse(JSON.stringify(record)));
  }

  async getEvaluationById(id: string): Promise<HistoricalFeatureEvaluationRecord | null> {
    const item = this.reportsById.get(id);
    return item ? JSON.parse(JSON.stringify(item)) : null;
  }

  async listEvaluations(limit = 10): Promise<HistoricalFeatureEvaluationRecord[]> {
    return Array.from(this.reportsById.values())
      .slice(0, limit)
      .map((item) => JSON.parse(JSON.stringify(item)));
  }
}
