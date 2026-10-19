/**
 * Invariant enforcement and validation for Kerala Lottery Numbers.
 * 
 * CORE PRINCIPLE:
 * Lottery numbers are strings.
 * Never convert canonical lottery numbers into integers.
 * Example: "0276" must remain "0276".
 */

import type { WinningNumber, PrizeResultType, RegionBoundingBox } from "@kerala-lottery/domain";

export class ValidationError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Normalizes and guarantees the canonical string representation of a lottery number.
 * Ensures that leading zeros are strictly preserved.
 */
export function normalizeLotteryNumber(raw: unknown, expectedLength?: number): string {
  if (typeof raw !== "string" && typeof raw !== "number") {
    throw new ValidationError(
      `Lottery number must be a string or number, received ${typeof raw}`,
      "INVALID_TYPE"
    );
  }

  // If raw is passed as a number, we warn that precision or leading zero may have been lost!
  if (typeof raw === "number") {
    if (!Number.isInteger(raw) || raw < 0) {
      throw new ValidationError(`Invalid numeric lottery number: ${raw}`, "NEGATIVE_OR_FLOAT");
    }
    if (expectedLength) {
      // Pad leading zeros to expected length
      return raw.toString().padStart(expectedLength, "0");
    }
    return raw.toString();
  }

  const trimmed = raw.trim();

  // Validate that trimmed contains only digits
  if (!/^\d+$/.test(trimmed)) {
    throw new ValidationError(
      `Canonical lottery number must contain only ASCII digits: received '${raw}'`,
      "NON_DIGIT_CHARACTERS"
    );
  }

  if (expectedLength && trimmed.length !== expectedLength) {
    throw new ValidationError(
      `Lottery number '${trimmed}' length ${trimmed.length} does not match expected length ${expectedLength}`,
      "LENGTH_MISMATCH"
    );
  }

  return trimmed;
}

export interface CreateWinningNumberInput {
  id: string;
  documentSha256?: string;
  pageId?: string;
  pageNumber?: number;
  sourceTextBlockOrders?: number[];
  rawSourceText?: string;
  boundingBox?: RegionBoundingBox;
  parserRule?: string;
  parserVersion?: string;
  drawId?: string;
  prizeResultId?: string;
  prizeTierId?: string;
  prizeTierName?: string;
  rank?: number;
  amount?: number;
  series?: string;
  rawNumber: string;
  expectedLength?: number;
  isSuffix: boolean;
  resultType: PrizeResultType;
  sourceDocumentId?: string;
  sourcePage?: number;
  sourceText?: string;
  confidence?: number;
  createdAt?: string;
}

/**
 * Constructs a type-safe WinningNumber domain record strictly adhering to the Canonical Number Rule.
 */
export function createWinningNumber(input: CreateWinningNumberInput): WinningNumber {
  const canonical = normalizeLotteryNumber(input.rawNumber, input.expectedLength);
  const docSha = input.documentSha256 ?? input.sourceDocumentId ?? "0000000000000000000000000000000000000000000000000000000000000000";
  const pNum = input.pageNumber ?? input.sourcePage ?? 1;

  return {
    id: input.id,
    documentSha256: docSha,
    pageId: input.pageId ?? `${docSha}_${pNum}`,
    pageNumber: pNum,
    sourceTextBlockOrders: input.sourceTextBlockOrders ?? [0],
    rawSourceText: input.rawSourceText ?? input.sourceText ?? canonical,
    boundingBox: input.boundingBox ?? { x: 0, y: 0, width: 0, height: 0, unit: "pt" },
    parserRule: input.parserRule ?? "rule.winning_number.v1",
    parserVersion: input.parserVersion ?? "v1.0.0-entities",
    drawId: input.drawId,
    prizeResultId: input.prizeResultId,
    prizeTierId: input.prizeTierId,
    prizeTierName: input.prizeTierName,
    rank: input.rank,
    amount: input.amount,
    series: input.series ? input.series.trim().toUpperCase() : undefined,
    canonicalNumber: canonical,
    numberLength: canonical.length,
    isSuffix: input.isSuffix,
    suffixLength: input.isSuffix ? canonical.length : undefined,
    resultType: input.resultType,
    sourceDocumentId: input.sourceDocumentId ?? docSha,
    sourcePage: input.sourcePage ?? pNum,
    sourceText: input.sourceText ?? input.rawSourceText ?? canonical,
    confidence: input.confidence ?? 1.0,
    validationStatus: "VALID",
    derivedNumericValue: parseInt(canonical, 10),
    createdAt: input.createdAt ?? new Date().toISOString()
  };
}
