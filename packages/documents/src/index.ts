/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Document Schemas & Classification Logic
 */

import type { DocumentType } from "@kerala-lottery/domain";

export interface DocumentClassificationResult {
  detectedType: DocumentType;
  confidence: number;
  extractedTitle?: string;
  gazetteNumber?: string;
  drawDate?: string;
  drawNumber?: string;
}

/**
 * Heuristic document classifier based on text snippets and layout markers.
 */
export function classifyDocumentText(extractedText: string): DocumentClassificationResult {
  const upper = extractedText.toUpperCase();

  if (
    upper.includes("KERALA STATE LOTTERIES") &&
    (upper.includes("DRAW NO") || upper.includes("RESULTS") || upper.includes("PRIZE"))
  ) {
    return {
      detectedType: "LOTTERY_RESULT",
      confidence: 0.95
    };
  }

  if (
    upper.includes("KERALA PAPER LOTTERIES (REGULATION) RULES") ||
    upper.includes("LOTTERY RULES")
  ) {
    return {
      detectedType: "RULE",
      confidence: 0.9
    };
  }

  if (upper.includes("USER MANUAL") || upper.includes("AGENT USER MANUAL")) {
    return {
      detectedType: "MANUAL",
      confidence: 0.95
    };
  }

  if (upper.includes("AMENDMENT") || upper.includes("S.R.O.")) {
    return {
      detectedType: "AMENDMENT",
      confidence: 0.85
    };
  }

  return {
    detectedType: "OTHER",
    confidence: 0.5
  };
}
