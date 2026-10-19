/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 6A: Feature Engineering & Representation Engine
 *
 * Implements:
 * - Deterministic feature extraction across 6 families:
 *   NUMBER, POSITION, SUFFIX, SERIES, DRAW, STRUCTURAL
 * - Strict preservation of string canonical numbers with leading zeros (e.g. "0045")
 * - Strict separation of FULL_TICKET (with series) and SUFFIX (never with series)
 * - Deterministic feature ID and matrix hash generation
 * - Complete provenance tracing back to source WinningResult, Draw, and PDF SHA-256
 * - In-memory feature repository
 *
 * Strict Non-Predictive Boundary:
 * - A feature is a representation of an observed historical fact.
 * - Zero prediction, probability, betting optimization, or winning-number scoring.
 */

import { createHash } from "node:crypto";
import type { WinningResult } from "@kerala-lottery/domain";
import type { MultiDrawLotteryCorpus, MultiDrawCorpusDrawProfile } from "./multi-draw-corpus";
import {
  DEFAULT_FEATURE_VERSION,
  HISTORICAL_FEATURE_DISCLAIMER,
  type FeatureRecord,
  type FeatureFamily,
  type FeatureValueType,
  type DrawFeatureContext,
  type ResultFeatureVector,
  type FeatureMatrix,
  type FeatureMatrixRow,
  FeatureValidationError
} from "./feature-types";

// ============================================================================
// Deterministic Hash Functions
// ============================================================================

export function computeFeatureRecordHash(
  sourceResultId: string,
  featureName: string,
  featureVersion: string,
  value: string | number | boolean | null
): string {
  const payload = `${sourceResultId}|${featureName}|${featureVersion}|${String(value)}`;
  return createHash("sha256").update(payload, "utf8").digest("hex").slice(0, 16);
}

export function computeFeatureMatrixHash(
  featureVersion: string,
  featureNames: string[],
  rows: FeatureMatrixRow[]
): string {
  const hasher = createHash("sha256");
  hasher.update(`${featureVersion}|${featureNames.join(",")}|${rows.length}\n`, "utf8");
  for (const r of rows) {
    const rowValues = featureNames.map((fn) => String(r.values[fn] ?? "null")).join(",");
    hasher.update(`${r.resultId}|${r.sourceDrawId}|${r.canonicalNumber}|${rowValues}\n`, "utf8");
  }
  return hasher.digest("hex").slice(0, 16);
}

// ============================================================================
// Validation Logic
// ============================================================================

export function validateResultForFeatureExtraction(
  result: WinningResult,
  drawContext?: DrawFeatureContext
): void {
  if (!result || typeof result !== "object") {
    throw new FeatureValidationError("WinningResult must be a valid object", "EMPTY_RESULT_SET");
  }

  // 1. Validate Canonical Number
  if (!result.canonicalNumber || typeof result.canonicalNumber !== "string" || result.canonicalNumber.trim() === "") {
    throw new FeatureValidationError("Canonical number must not be empty", "EMPTY_NUMBER", { resultId: result.id });
  }

  if (!/^\d+$/.test(result.canonicalNumber)) {
    throw new FeatureValidationError(
      `Canonical number '${result.canonicalNumber}' must contain only digits {0..9}`,
      "NON_NUMERIC_DIGITS",
      { resultId: result.id, canonicalNumber: result.canonicalNumber }
    );
  }

  // 2. Validate Length Consistency
  if (result.numberLength !== result.canonicalNumber.length) {
    throw new FeatureValidationError(
      `Inconsistent number length: metadata says ${result.numberLength} but string length is ${result.canonicalNumber.length}`,
      "INCONSISTENT_NUMBER_LENGTH",
      { resultId: result.id, declaredLength: result.numberLength, actualLength: result.canonicalNumber.length }
    );
  }

  // 3. Validate Result Type & Series Constraints
  if (typeof result.isSuffix !== "boolean") {
    throw new FeatureValidationError("WinningResult.isSuffix must be boolean", "INVALID_RESULT_TYPE", { resultId: result.id });
  }

  if (!result.isSuffix) {
    // FULL_TICKET requires a non-empty series
    if (!result.series || typeof result.series !== "string" || result.series.trim() === "") {
      throw new FeatureValidationError(
        `FULL_TICKET result ${result.id} must possess a valid series code`,
        "FULL_TICKET_WITHOUT_SERIES",
        { resultId: result.id }
      );
    }
  } else {
    // SUFFIX must never have a series code
    if (result.series !== undefined && result.series !== null && result.series !== "") {
      throw new FeatureValidationError(
        `SUFFIX result ${result.id} must not have a series code, but found '${result.series}'`,
        "SUFFIX_WITH_SERIES",
        { resultId: result.id, series: result.series }
      );
    }
  }

  // 4. Validate Draw Context if provided
  if (drawContext) {
    if (!drawContext.drawId || !drawContext.drawNumber || !drawContext.lotteryCode) {
      throw new FeatureValidationError(
        "DrawFeatureContext missing essential draw identity fields",
        "MALFORMED_DRAW_IDENTITY",
        { drawContext }
      );
    }
  }
}

// ============================================================================
// Feature Extraction Engine
// ============================================================================

export interface ExtractResultFeaturesOptions {
  featureVersion?: string;
  maxPositionLength?: number; // e.g. 6 to standardize position columns across 4- and 6-digit numbers
}

/**
 * Deterministically extracts all 6 feature families for a single validated WinningResult.
 * Does NOT mutate the source WinningResult.
 */
export function extractResultFeatures(
  result: WinningResult,
  drawContext?: DrawFeatureContext,
  options?: ExtractResultFeaturesOptions
): ResultFeatureVector {
  validateResultForFeatureExtraction(result, drawContext);

  const version = options?.featureVersion || DEFAULT_FEATURE_VERSION;
  const numStr = result.canonicalNumber;
  const len = numStr.length;
  const isSuffix = result.isSuffix;
  const resultType: "FULL_TICKET" | "SUFFIX" = isSuffix ? "SUFFIX" : "FULL_TICKET";
  const drawId = drawContext?.drawId || result.drawId || "UNKNOWN_DRAW";

  const featureRecords: Record<string, FeatureRecord> = {};
  const featureValues: Record<string, string | number | boolean | null> = {};

  const sourceMeta = {
    pageNumber: result.pageNumber,
    sourceTextBlockOrders: [...result.sourceTextBlockOrders],
    prizeTierRank: result.rank,
    resultType,
    canonicalNumber: numStr
  };

  function addFeature(
    family: FeatureFamily,
    name: string,
    value: string | number | boolean | null,
    type: FeatureValueType
  ): void {
    const hash = computeFeatureRecordHash(result.id, name, version, value);
    const rec: FeatureRecord = {
      featureId: `feat_${hash}`,
      featureVersion: version,
      sourceResultId: result.id,
      sourceDrawId: drawId,
      sourceDocumentSha256: result.documentSha256,
      featureFamily: family,
      featureName: name,
      value,
      valueType: type,
      sourceMetadata: sourceMeta,
      deterministicHash: hash,
      descriptiveOnly: true
    };
    featureRecords[name] = rec;
    featureValues[name] = value;
  }

  // --------------------------------------------------------------------------
  // 1. NUMBER FEATURES (Universal for all validated numbers)
  // --------------------------------------------------------------------------
  addFeature("NUMBER", "canonicalNumber", numStr, "STRING");
  addFeature("NUMBER", "numberLength", len, "INTEGER");
  addFeature("NUMBER", "leadingZero", numStr.startsWith("0"), "BOOLEAN");
  addFeature("NUMBER", "digitCount", len, "INTEGER");

  let digitSum = 0;
  const digitSet = new Set<string>();
  for (let i = 0; i < len; i++) {
    const d = Number(numStr[i]);
    digitSum += d;
    digitSet.add(numStr[i]!);
  }
  const uniqueCount = digitSet.size;
  const repeatedCount = len - uniqueCount;

  addFeature("NUMBER", "digitSum", digitSum, "INTEGER");
  addFeature("NUMBER", "uniqueDigitCount", uniqueCount, "INTEGER");
  addFeature("NUMBER", "repeatedDigitCount", repeatedCount, "INTEGER");
  addFeature("NUMBER", "hasRepeatedDigit", repeatedCount > 0, "BOOLEAN");
  addFeature("NUMBER", "firstDigit", numStr[0]!, "STRING");
  addFeature("NUMBER", "lastDigit", numStr[len - 1]!, "STRING");

  // --------------------------------------------------------------------------
  // 2. POSITION FEATURES (1-based from left and right)
  // --------------------------------------------------------------------------
  const maxPos = options?.maxPositionLength || (len > 4 ? 6 : 4);
  for (let p = 1; p <= maxPos; p++) {
    const leftVal = p <= len ? Number(numStr[p - 1]) : null;
    const rightVal = p <= len ? Number(numStr[len - p]) : null;
    addFeature("POSITION", `digitPositionFromLeft_${p}`, leftVal, "INTEGER");
    addFeature("POSITION", `digitPositionFromRight_${p}`, rightVal, "INTEGER");
  }

  // --------------------------------------------------------------------------
  // 3. SUFFIX FEATURES (Strictly for SUFFIX results; valid for length)
  // --------------------------------------------------------------------------
  if (isSuffix) {
    addFeature("SUFFIX", "suffix2", len >= 2 ? numStr.slice(-2) : null, "STRING");
    addFeature("SUFFIX", "suffix3", len >= 3 ? numStr.slice(-3) : null, "STRING");
    addFeature("SUFFIX", "suffix4", len >= 4 ? numStr.slice(-4) : null, "STRING");
  } else {
    // FULL_TICKET results do NOT manufacture suffix features
    addFeature("SUFFIX", "suffix2", null, "STRING");
    addFeature("SUFFIX", "suffix3", null, "STRING");
    addFeature("SUFFIX", "suffix4", null, "STRING");
  }

  // --------------------------------------------------------------------------
  // 4. SERIES FEATURES (Strictly for FULL_TICKET results)
  // --------------------------------------------------------------------------
  if (!isSuffix && result.series) {
    addFeature("SERIES", "seriesCode", result.series, "STRING");
    addFeature("SERIES", "seriesLength", result.series.length, "INTEGER");
    addFeature("SERIES", "seriesCharacters", result.series.split("").join(","), "STRING");
  } else {
    addFeature("SERIES", "seriesCode", null, "STRING");
    addFeature("SERIES", "seriesLength", null, "INTEGER");
    addFeature("SERIES", "seriesCharacters", null, "STRING");
  }

  // --------------------------------------------------------------------------
  // 5. DRAW FEATURES (Observed metadata without temporal forecasting)
  // --------------------------------------------------------------------------
  addFeature("DRAW", "lotteryCode", drawContext?.lotteryCode || "UNKNOWN", "CATEGORICAL");
  addFeature("DRAW", "drawNumber", drawContext?.drawNumber || "UNKNOWN", "STRING");
  addFeature("DRAW", "drawDate", drawContext?.drawDate || "UNKNOWN", "STRING");
  addFeature("DRAW", "drawSequence", drawContext?.drawSequence ?? null, "INTEGER");
  addFeature("DRAW", "prizeTierRank", result.rank, "INTEGER");
  addFeature("DRAW", "resultType", resultType, "CATEGORICAL");

  // --------------------------------------------------------------------------
  // 6. STRUCTURAL FEATURES (Deterministic algorithmic patterns)
  // --------------------------------------------------------------------------
  const isPalindrome = numStr === numStr.split("").reverse().join("");
  const allSame = numStr.split("").every((d) => d === numStr[0]);

  // Alternating: length >= 2, alternating between 2 distinct digits (e.g. "1212", "0505")
  const isAlternating =
    len >= 2 &&
    numStr[0] !== numStr[1] &&
    numStr.split("").every((d, i) => d === numStr[i % 2]);

  // Strictly ascending adjacent digits (e.g. "1234", "6789")
  const isAscending =
    len >= 2 &&
    numStr.split("").every((d, i, arr) => i === 0 || Number(d) === Number(arr[i - 1]) + 1);

  // Strictly descending adjacent digits (e.g. "4321", "9876")
  const isDescending =
    len >= 2 &&
    numStr.split("").every((d, i, arr) => i === 0 || Number(d) === Number(arr[i - 1]) - 1);

  // Repeated non-overlapping adjacent pairs (e.g. "1122" -> 2, "1112" -> 1)
  let repeatedPairCount = 0;
  let idx = 0;
  while (idx < len - 1) {
    if (numStr[idx] === numStr[idx + 1]) {
      repeatedPairCount++;
      idx += 2;
    } else {
      idx++;
    }
  }

  let zeroCount = 0;
  let evenCount = 0;
  let oddCount = 0;
  for (let i = 0; i < len; i++) {
    const ch = numStr[i]!;
    if (ch === "0") zeroCount++;
    if (["0", "2", "4", "6", "8"].includes(ch)) {
      evenCount++;
    } else {
      oddCount++;
    }
  }

  addFeature("STRUCTURAL", "palindrome", isPalindrome, "BOOLEAN");
  addFeature("STRUCTURAL", "allDigitsSame", allSame, "BOOLEAN");
  addFeature("STRUCTURAL", "alternatingPattern", isAlternating, "BOOLEAN");
  addFeature("STRUCTURAL", "ascendingAdjacentPattern", isAscending, "BOOLEAN");
  addFeature("STRUCTURAL", "descendingAdjacentPattern", isDescending, "BOOLEAN");
  addFeature("STRUCTURAL", "repeatedPairCount", repeatedPairCount, "INTEGER");
  addFeature("STRUCTURAL", "zeroCount", zeroCount, "INTEGER");
  addFeature("STRUCTURAL", "evenDigitCount", evenCount, "INTEGER");
  addFeature("STRUCTURAL", "oddDigitCount", oddCount, "INTEGER");

  return {
    resultId: result.id,
    sourceResultId: result.id,
    canonicalNumber: numStr,
    resultType,
    sourceDrawId: drawId,
    sourceDocumentSha256: result.documentSha256,
    featureVersion: version,
    features: featureRecords,
    values: featureValues,
    descriptiveOnly: true
  };
}

// ============================================================================
// Matrix Transformation
// ============================================================================

export interface MatrixTransformOptions {
  featureVersion?: string;
  corpusId?: string;
  filterNumberLength?: number; // Optional filter to prevent mixing lengths
  filterResultType?: "FULL_TICKET" | "SUFFIX";
}

/**
 * Transforms a collection of ResultFeatureVectors into a deterministic FeatureMatrix.
 */
export function transformToFeatureMatrix(
  vectors: ResultFeatureVector[],
  options?: MatrixTransformOptions
): FeatureMatrix {
  if (!vectors || vectors.length === 0) {
    throw new FeatureValidationError("Cannot construct FeatureMatrix from empty feature vectors", "EMPTY_RESULT_SET");
  }

  let filtered = vectors;
  if (options?.filterNumberLength) {
    filtered = filtered.filter((v) => v.canonicalNumber.length === options.filterNumberLength);
    if (filtered.length === 0) {
      throw new FeatureValidationError(
        `No feature vectors match requested number length ${options.filterNumberLength}`,
        "EMPTY_RESULT_SET"
      );
    }
  }

  if (options?.filterResultType) {
    filtered = filtered.filter((v) => v.resultType === options.filterResultType);
    if (filtered.length === 0) {
      throw new FeatureValidationError(
        `No feature vectors match requested result type ${options.filterResultType}`,
        "EMPTY_RESULT_SET"
      );
    }
  }

  const version = options?.featureVersion || vectors[0]!.featureVersion;

  // Collect all unique feature names, types, and families
  const featureNamesSet = new Set<string>();
  const featureTypes: Record<string, FeatureValueType> = {};
  const featureFamilies: Record<string, FeatureFamily> = {};

  for (const vec of filtered) {
    for (const [name, rec] of Object.entries(vec.features)) {
      featureNamesSet.add(name);
      if (!featureTypes[name]) featureTypes[name] = rec.valueType;
      if (!featureFamilies[name]) featureFamilies[name] = rec.featureFamily;
    }
  }

  // Sort feature names alphabetically for deterministic columns
  const featureNames = Array.from(featureNamesSet).sort();

  let fullTicketCount = 0;
  let suffixCount = 0;
  const rows: FeatureMatrixRow[] = [];

  for (const vec of filtered) {
    if (vec.resultType === "FULL_TICKET") {
      fullTicketCount++;
    } else {
      suffixCount++;
    }

    const rowValues: Record<string, string | number | boolean | null> = {};
    for (const fn of featureNames) {
      rowValues[fn] = vec.values[fn] !== undefined ? vec.values[fn] : null;
    }

    rows.push({
      resultId: vec.resultId,
      sourceDrawId: vec.sourceDrawId,
      sourceDocumentSha256: vec.sourceDocumentSha256,
      canonicalNumber: vec.canonicalNumber,
      resultType: vec.resultType,
      values: rowValues
    });
  }

  const deterministicHash = computeFeatureMatrixHash(version, featureNames, rows);

  return {
    id: `fmat_${deterministicHash}`,
    featureVersion: version,
    totalRecords: rows.length,
    featureNames,
    featureTypes,
    featureFamilies,
    rows,
    deterministicHash,
    metadata: {
      corpusId: options?.corpusId,
      fullTicketCount,
      suffixCount,
      totalFeaturesPerRecord: featureNames.length
    },
    limitations: [
      HISTORICAL_FEATURE_DISCLAIMER,
      "DESCRIPTIVE_ONLY: Features are tabular machine representations of historical lottery publications.",
      "INDEPENDENT_SELECTION: Past feature distributions do not alter future lottery drawing randomness.",
      "ZERO_BETTING_UTILITY: Features must NOT be used for betting advice or future number prediction."
    ],
    descriptiveOnly: true
  };
}

// ============================================================================
// Corpus Feature Extractor
// ============================================================================

export interface ExtractCorpusFeaturesOptions extends MatrixTransformOptions {
  maxPositionLength?: number;
}

/**
 * Deterministically extracts feature vectors for every validated result in the MultiDrawLotteryCorpus
 * and packages them into a FeatureMatrix.
 */
export function extractCorpusFeatures(
  corpus: MultiDrawLotteryCorpus,
  options?: ExtractCorpusFeaturesOptions
): FeatureMatrix {
  if (!corpus || !corpus.combinedEntities || corpus.combinedEntities.winningResults.length === 0) {
    throw new FeatureValidationError("Cannot extract features from empty corpus", "EMPTY_RESULT_SET");
  }

  // Build Draw Context lookup map
  const drawMap = new Map<string, MultiDrawCorpusDrawProfile>();
  const docShaToDrawMap = new Map<string, MultiDrawCorpusDrawProfile>();

  for (const draw of corpus.draws) {
    drawMap.set(draw.drawId, draw);
    docShaToDrawMap.set(draw.sourceDocumentSha256, draw);
  }

  const vectors: ResultFeatureVector[] = [];
  for (let i = 0; i < corpus.combinedEntities.winningResults.length; i++) {
    const res = corpus.combinedEntities.winningResults[i]!;
    const draw = (res.drawId ? drawMap.get(res.drawId) : null) || docShaToDrawMap.get(res.documentSha256);

    const drawContext: DrawFeatureContext | undefined = draw
      ? {
          drawId: draw.drawId,
          drawNumber: draw.drawNumber,
          lotteryCode: draw.lotteryCode,
          drawDate: draw.drawDate,
          drawSequence: corpus.draws.indexOf(draw) + 1
        }
      : undefined;

    const vec = extractResultFeatures(res, drawContext, {
      featureVersion: options?.featureVersion,
      maxPositionLength: options?.maxPositionLength || 6
    });

    vectors.push(vec);
  }

  return transformToFeatureMatrix(vectors, {
    ...options,
    corpusId: corpus.id
  });
}

// ============================================================================
// In-Memory Feature Repository
// ============================================================================

export interface FeatureRepository {
  saveMatrix(matrix: FeatureMatrix): Promise<void>;
  getMatrixById(matrixId: string): Promise<FeatureMatrix | null>;
  listMatrices(limit?: number): Promise<FeatureMatrix[]>;
}

export class InMemoryFeatureRepository implements FeatureRepository {
  private readonly matricesById = new Map<string, FeatureMatrix>();

  async saveMatrix(matrix: FeatureMatrix): Promise<void> {
    this.matricesById.set(matrix.id, JSON.parse(JSON.stringify(matrix)));
  }

  async getMatrixById(matrixId: string): Promise<FeatureMatrix | null> {
    const item = this.matricesById.get(matrixId);
    return item ? JSON.parse(JSON.stringify(item)) : null;
  }

  async listMatrices(limit = 10): Promise<FeatureMatrix[]> {
    return Array.from(this.matricesById.values())
      .slice(0, limit)
      .map((item) => JSON.parse(JSON.stringify(item)));
  }
}
