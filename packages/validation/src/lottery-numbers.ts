/**
 * Invariant enforcement and validation for Kerala Lottery Numbers.
 * 
 * CORE PRINCIPLE:
 * Lottery numbers are strings.
 * Never convert canonical lottery numbers into integers.
 * Example: "0276" must remain "0276".
 */

import type { WinningNumber, PrizeResultType } from "@kerala-lottery/domain";

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
  drawId: string;
  prizeResultId: string;
  series?: string;
  rawNumber: string;
  expectedLength?: number;
  isSuffix: boolean;
  resultType: PrizeResultType;
  sourceDocumentId: string;
  sourcePage: number;
  sourceText: string;
  confidence?: number;
}

/**
 * Constructs a type-safe WinningNumber domain record strictly adhering to the Canonical Number Rule.
 */
export function createWinningNumber(input: CreateWinningNumberInput): WinningNumber {
  const canonical = normalizeLotteryNumber(input.rawNumber, input.expectedLength);

  return {
    id: input.id,
    drawId: input.drawId,
    prizeResultId: input.prizeResultId,
    series: input.series ? input.series.trim().toUpperCase() : undefined,
    canonicalNumber: canonical,
    numberLength: canonical.length,
    isSuffix: input.isSuffix,
    suffixLength: input.isSuffix ? canonical.length : undefined,
    resultType: input.resultType,
    sourceDocumentId: input.sourceDocumentId,
    sourcePage: input.sourcePage,
    sourceText: input.sourceText,
    confidence: input.confidence ?? 1.0,
    validationStatus: "VALID",
    derivedNumericValue: parseInt(canonical, 10)
  };
}
