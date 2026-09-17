import { describe, it, expect } from "vitest";
import { normalizeLotteryNumber, createWinningNumber, ValidationError } from "./lottery-numbers";

describe("Lottery Number Normalization & Canonical Preservation", () => {
  it("CRITICAL RULE: '0276' must remain '0276' with string type", () => {
    const result = normalizeLotteryNumber("0276");
    expect(result).toBe("0276");
    expect(typeof result).toBe("string");
    expect(result.length).toBe(4);
    expect(result[0]).toBe("0");
  });

  it("preserves multiple leading zeros (e.g., '0042', '0001')", () => {
    expect(normalizeLotteryNumber("0042")).toBe("0042");
    expect(normalizeLotteryNumber("0001")).toBe("0001");
    expect(normalizeLotteryNumber("000000", 6)).toBe("000000");
  });

  it("pads numeric inputs only when expectedLength is explicitly provided", () => {
    expect(normalizeLotteryNumber(276, 4)).toBe("0276");
  });

  it("rejects non-digit characters", () => {
    expect(() => normalizeLotteryNumber("027A")).toThrowError(ValidationError);
    expect(() => normalizeLotteryNumber("12-34")).toThrowError(ValidationError);
    expect(() => normalizeLotteryNumber("")).toThrowError(ValidationError);
  });

  it("rejects length mismatches when expectedLength is specified", () => {
    expect(() => normalizeLotteryNumber("0276", 6)).toThrowError(ValidationError);
  });

  it("creates WinningNumber with canonical string and derived numeric value", () => {
    const winningNumber = createWinningNumber({
      id: "win-1",
      drawId: "draw-101",
      prizeResultId: "prize-1st",
      series: "WA",
      rawNumber: "0276",
      expectedLength: 4,
      isSuffix: true,
      resultType: "SUFFIX",
      sourceDocumentId: "doc-123",
      sourcePage: 1,
      sourceText: "WA 0276"
    });

    expect(winningNumber.canonicalNumber).toBe("0276");
    expect(typeof winningNumber.canonicalNumber).toBe("string");
    expect(winningNumber.derivedNumericValue).toBe(276);
    expect(winningNumber.series).toBe("WA");
    expect(winningNumber.isSuffix).toBe(true);
  });
});
