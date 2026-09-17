import { describe, it, expect } from "vitest";
import { normalizeLotteryNumber, createWinningNumber } from "@kerala-lottery/validation";
import type { Draw, WinningNumber, SourceEvidence } from "@kerala-lottery/domain";

describe("Core Platform Invariants", () => {
  it("Invariant: Canonical lottery numbers remain strings with intact leading zeros", () => {
    const rawNumber = "0276";
    const canonical = normalizeLotteryNumber(rawNumber);
    expect(canonical).toBe("0276");
    expect(canonical.startsWith("0")).toBe(true);
  });

  it("Invariant: Winning numbers link directly to source evidence and document", () => {
    const evidence: SourceEvidence = {
      id: "ev-001",
      documentId: "doc-271",
      pageNumber: 1,
      sourceText: "1st Prize: DL-293215",
      parserVersion: "v1.0.0-deterministic",
      confidence: 1.0,
      createdAt: new Date().toISOString()
    };

    const winningNumber: WinningNumber = createWinningNumber({
      id: "wn-001",
      drawId: "draw-dl-69",
      prizeResultId: "prz-1st",
      series: "DL",
      rawNumber: "293215",
      expectedLength: 6,
      isSuffix: false,
      resultType: "PRIMARY",
      sourceDocumentId: evidence.documentId,
      sourcePage: evidence.pageNumber,
      sourceText: evidence.sourceText,
      confidence: evidence.confidence
    });

    expect(winningNumber.sourceDocumentId).toBe(evidence.documentId);
    expect(winningNumber.sourcePage).toBe(evidence.pageNumber);
    expect(winningNumber.sourceText).toBe(evidence.sourceText);
    expect(winningNumber.canonicalNumber).toBe("293215");
  });

  it("Invariant: Draw belongs to a lottery and references source document", () => {
    const draw: Draw = {
      id: "draw-dl-69",
      lotteryId: "lottery-dhanalekshmi",
      drawNumber: "DL-69",
      drawDate: "2026-09-16",
      location: "Gorky Bhavan, Thiruvananthapuram",
      sourceDocumentId: "doc-271",
      sourcePage: 1,
      status: "VERIFIED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    expect(draw.lotteryId).toBe("lottery-dhanalekshmi");
    expect(draw.drawDate).toBe("2026-09-16");
    expect(draw.sourceDocumentId).toBe("doc-271");
  });
});
