/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 5B: Multi-Draw Dataset Expansion & Corpus Foundation
 *
 * Provides:
 * - Deterministic multi-draw corpus representation and contracts
 * - Cross-document validation (duplicate draws, conflicting results, leading zeros)
 * - Complete provenance preserving SourceDocument -> Lottery -> Draw -> PrizeTier -> WinningResult -> Series -> WinningNumber
 * - Deterministic corpus query functions answering all 9 core corpus questions
 * - Multi-draw statistical aggregation over the expanded population
 *
 * Strict Invariants:
 * - OBSERVED DATA + STATISTICAL SUMMARY ONLY.
 * - Zero prediction, recommendation, betting optimization, or ML/LLM inference.
 * - Strict separation of FULL_TICKET vs SUFFIX results.
 * - Suffix results NEVER receive synthetic series values.
 * - Numbers preserved as exact strings with leading zeros ("0259", "0081", "0004").
 * - Multi-draw observation explicitly noted (not single draw, not predictive probability).
 */

import { createHash } from "node:crypto";
import type {
  WinningResult,
  PrizeTier,
  Draw,
  Lottery
} from "@kerala-lottery/domain";
import type { LotteryKnowledgeGraph } from "@kerala-lottery/knowledge";
import {
  DEFAULT_STATISTICAL_VERSION,
  type StatisticalFilterCriteria,
  type HistoricalLotteryStatisticsAggregate
} from "./statistical-types";
import {
  StatisticalValidationError,
  calculateHistoricalStatistics,
  extractEntitiesFromKnowledgeGraph,
  type ValidatedStatisticalEntities
} from "./statistical-engine";

export const DEFAULT_CORPUS_VERSION = "v1.0.0-multi-draw-corpus";

// ============================================================================
// Multi-Draw Corpus Contracts
// ============================================================================

export interface MultiDrawCorpusDrawProfile {
  drawId: string;
  drawNumber: string;
  lotteryCode: string;
  lotteryName: string;
  drawDate: string; // ISO format YYYY-MM-DD or document string
  drawTime?: string;
  location?: string;
  sourceDocumentSha256: string;
  totalResultsCount: number;
  fullTicketResultsCount: number;
  suffixResultsCount: number;
  prizeTiersCount: number;
  distinctSeries: string[];
  seriesOccurrences: Record<string, number>;
  leadingZeroNumbers: string[];
  graphNodeCount: number;
  graphEdgeCount: number;
  validationStatus: "VALID" | "FLAGGED";
  validationErrors: string[];
}

export interface MultiDrawCorpusValidationReport {
  totalDocuments: number;
  totalDraws: number;
  distinctLotteries: string[];
  dateRange: {
    earliest?: string;
    latest?: string;
  };
  totalWinningResults: number;
  totalFullTicketResults: number;
  totalSuffixResults: number;
  duplicateDrawsDetected: Array<{
    drawNumber: string;
    documentShas: string[];
  }>;
  conflictingResultsDetected: Array<{
    resultId: string;
    description: string;
  }>;
  malformedRecordsDetected: Array<{
    recordId: string;
    error: string;
  }>;
  crossDocumentCollisions: Array<{
    description: string;
  }>;
  isValid: boolean;
  validationErrors: string[];
}

export interface MultiDrawLotteryCorpus {
  id: string; // Deterministic: `corpus_${corpusHash}`
  corpusHash: string;
  version: string;
  computedAt: string;
  draws: MultiDrawCorpusDrawProfile[];
  documentSha256s: string[];
  validationReport: MultiDrawCorpusValidationReport;
  knowledgeGraphs: LotteryKnowledgeGraph[];
  combinedEntities: ValidatedStatisticalEntities;
}

export interface MultiDrawCorpusOptions {
  version?: string;
  allowEmpty?: boolean;
}

// ============================================================================
// Multi-Draw Corpus Builder & Validation Engine
// ============================================================================

export function buildMultiDrawCorpus(
  graphs: LotteryKnowledgeGraph[],
  options?: MultiDrawCorpusOptions
): MultiDrawLotteryCorpus {
  if (!Array.isArray(graphs)) {
    throw new StatisticalValidationError(
      "Knowledge graphs must be provided as an array",
      "EMPTY_DATASET"
    );
  }

  if (graphs.length === 0 && !options?.allowEmpty) {
    throw new StatisticalValidationError(
      "Cannot build multi-draw corpus from an empty graph list",
      "EMPTY_DATASET"
    );
  }

  const version = options?.version || DEFAULT_CORPUS_VERSION;
  const computedAt = "2026-09-26T00:00:00.000Z";

  // 1. Sort graphs deterministically: by documentSha256
  const sortedGraphs = graphs.slice().sort((a, b) =>
    a.documentSha256.localeCompare(b.documentSha256)
  );

  const drawProfiles: MultiDrawCorpusDrawProfile[] = [];
  const documentSha256s: string[] = [];
  const allWinningResults: WinningResult[] = [];
  const allPrizeTiers: PrizeTier[] = [];
  const allDraws: Draw[] = [];
  const allLotteries: Lottery[] = [];

  const drawsByNumber = new Map<string, string[]>(); // drawNumber -> documentSha256s
  const validationErrors: string[] = [];
  const duplicateDrawsDetected: Array<{ drawNumber: string; documentShas: string[] }> = [];
  const conflictingResultsDetected: Array<{ resultId: string; description: string }> = [];
  const malformedRecordsDetected: Array<{ recordId: string; error: string }> = [];
  const crossDocumentCollisions: Array<{ description: string }> = [];

  const seenResultKeys = new Map<string, WinningResult>(); // `${drawId}_${rank}_${canonicalNumber}_${series}` -> WinningResult

  for (const graph of sortedGraphs) {
    documentSha256s.push(graph.documentSha256);

    const entities = extractEntitiesFromKnowledgeGraph(graph);
    const drawNode = graph.nodes.find((n) => n.type === "Draw");
    const lotteryNode = graph.nodes.find((n) => n.type === "Lottery");

    const drawNumber = (drawNode?.properties.drawNumber as string) || "UNKNOWN";
    const lotteryCode = (lotteryNode?.properties.code as string) || "UNKNOWN";
    const lotteryName = (lotteryNode?.properties.name as string) || lotteryNode?.label || "UNKNOWN";
    const drawDate = (drawNode?.properties.drawDate as string) || "";
    const drawTime = drawNode?.properties.drawTime as string | undefined;
    const location = drawNode?.properties.location as string | undefined;

    const drawId = drawNode?.id || `draw_${lotteryCode}_${drawNumber}_${graph.documentSha256.slice(0, 8)}`;

    // Cross-document duplicate draw check
    const existingShas = drawsByNumber.get(drawNumber) || [];
    existingShas.push(graph.documentSha256);
    drawsByNumber.set(drawNumber, existingShas);

    const drawErrors: string[] = [];

    // Tiers and Results breakdown for this draw
    const drawResults = entities.winningResults;
    const fullTicketResults = drawResults.filter((r) => !r.isSuffix);
    const suffixResults = drawResults.filter((r) => r.isSuffix);

    // Validate numbers and series
    const seriesOccurrences: Record<string, number> = {};
    const leadingZeroNumbers: string[] = [];

    for (const r of drawResults) {
      // 1. Malformed number check
      if (!r.canonicalNumber || !/^\d+$/.test(r.canonicalNumber)) {
        const err = `Malformed number '${r.canonicalNumber}' in draw ${drawNumber} result ${r.id}`;
        malformedRecordsDetected.push({ recordId: r.id, error: err });
        drawErrors.push(err);
      }

      // 2. Leading zero tracking
      if (r.canonicalNumber.startsWith("0") && !leadingZeroNumbers.includes(r.canonicalNumber)) {
        leadingZeroNumbers.push(r.canonicalNumber);
      }

      // 3. Series tracking (Full-ticket results only!)
      if (!r.isSuffix && r.series) {
        seriesOccurrences[r.series] = (seriesOccurrences[r.series] || 0) + 1;
      }

      // Suffix result invariant: never has series
      if (r.isSuffix && r.series) {
        const err = `Suffix result ${r.id} in draw ${drawNumber} has forbidden series code '${r.series}'`;
        malformedRecordsDetected.push({ recordId: r.id, error: err });
        drawErrors.push(err);
      }

      // 4. Collision / Conflict detection
      const key = `${drawId}_${r.rank}_${r.canonicalNumber}_${r.series || "NO_SERIES"}`;
      const existing = seenResultKeys.get(key);
      if (existing) {
        if (existing.amount !== r.amount || existing.documentSha256 !== r.documentSha256) {
          const desc = `Conflicting duplicate result '${r.id}' found between document ${existing.documentSha256.slice(0, 12)} and ${r.documentSha256.slice(0, 12)} (different amounts or sources)`;
          conflictingResultsDetected.push({ resultId: r.id, description: desc });
          drawErrors.push(desc);
        }
      } else {
        seenResultKeys.set(key, r);
      }
    }

    const distinctSeries = Object.keys(seriesOccurrences).sort();

    drawProfiles.push({
      drawId,
      drawNumber,
      lotteryCode,
      lotteryName,
      drawDate,
      drawTime,
      location,
      sourceDocumentSha256: graph.documentSha256,
      totalResultsCount: drawResults.length,
      fullTicketResultsCount: fullTicketResults.length,
      suffixResultsCount: suffixResults.length,
      prizeTiersCount: entities.prizeTiers?.length || 0,
      distinctSeries,
      seriesOccurrences,
      leadingZeroNumbers: leadingZeroNumbers.sort(),
      graphNodeCount: graph.nodes.length,
      graphEdgeCount: graph.edges.length,
      validationStatus: drawErrors.length === 0 ? "VALID" : "FLAGGED",
      validationErrors: drawErrors
    });

    allWinningResults.push(...drawResults);
    if (entities.prizeTiers) allPrizeTiers.push(...entities.prizeTiers);
    if (entities.draws) allDraws.push(...entities.draws);
    if (entities.lotteries) allLotteries.push(...entities.lotteries);
  }

  // Cross-document duplicate draw check evaluation
  for (const [dNum, shas] of drawsByNumber.entries()) {
    if (shas.length > 1 && dNum !== "UNKNOWN") {
      const err = `Duplicate draw number '${dNum}' published in multiple distinct documents: ${shas.join(", ")}`;
      duplicateDrawsDetected.push({ drawNumber: dNum, documentShas: shas });
      crossDocumentCollisions.push({ description: err });
      validationErrors.push(err);
    }
  }

  // Determine date range
  const dates = drawProfiles.map((d) => d.drawDate).filter(Boolean).sort();
  const dateRange = {
    earliest: dates[0],
    latest: dates[dates.length - 1]
  };

  const distinctLotteries = Array.from(new Set(drawProfiles.map((d) => d.lotteryCode))).sort();

  const isValid =
    validationErrors.length === 0 &&
    conflictingResultsDetected.length === 0 &&
    malformedRecordsDetected.length === 0;

  const validationReport: MultiDrawCorpusValidationReport = {
    totalDocuments: sortedGraphs.length,
    totalDraws: drawProfiles.length,
    distinctLotteries,
    dateRange,
    totalWinningResults: allWinningResults.length,
    totalFullTicketResults: allWinningResults.filter((r) => !r.isSuffix).length,
    totalSuffixResults: allWinningResults.filter((r) => r.isSuffix).length,
    duplicateDrawsDetected,
    conflictingResultsDetected,
    malformedRecordsDetected,
    crossDocumentCollisions,
    isValid,
    validationErrors
  };

  if (!isValid && !options?.allowEmpty) {
    throw new StatisticalValidationError(
      `Multi-draw corpus validation failed with ${validationErrors.length} errors, ${conflictingResultsDetected.length} conflicts, ${malformedRecordsDetected.length} malformed records: ${validationErrors.concat(conflictingResultsDetected.map(c => c.description)).join("; ")}`,
      "CONFLICTING_DUPLICATE_RESULTS"
    );
  }

  // Deterministic corpus hash based on sorted document IDs and draw IDs
  const corpusHash = createHash("sha256")
    .update(
      [
        version,
        documentSha256s.slice().sort().join(","),
        drawProfiles.map((d) => `${d.drawId}:${d.totalResultsCount}`).sort().join(","),
        allWinningResults.length.toString()
      ].join("||")
    )
    .digest("hex")
    .slice(0, 16);

  return {
    id: `corpus_${corpusHash}`,
    corpusHash,
    version,
    computedAt,
    draws: drawProfiles,
    documentSha256s,
    validationReport,
    knowledgeGraphs: sortedGraphs,
    combinedEntities: {
      winningResults: allWinningResults,
      prizeTiers: allPrizeTiers,
      draws: allDraws,
      lotteries: allLotteries,
      documentSha256s
    }
  };
}

// ============================================================================
// Multi-Draw Corpus Query Functions (Answering Core Dataset Questions)
// ============================================================================

/**
 * 1. How many draws are in the corpus?
 */
export function getCorpusDrawCount(corpus: MultiDrawLotteryCorpus): number {
  return corpus.draws.length;
}

/**
 * 2. Which lottery does each draw belong to?
 */
export function getCorpusLotteries(corpus: MultiDrawLotteryCorpus): string[] {
  return corpus.validationReport.distinctLotteries;
}

export function getDrawsByLottery(
  corpus: MultiDrawLotteryCorpus,
  lotteryCode: string
): MultiDrawCorpusDrawProfile[] {
  const norm = lotteryCode.trim().toUpperCase();
  return corpus.draws.filter((d) => d.lotteryCode.toUpperCase() === norm);
}

/**
 * 3. What date does each draw represent?
 */
export function getDrawByDate(
  corpus: MultiDrawLotteryCorpus,
  dateStr: string
): MultiDrawCorpusDrawProfile | undefined {
  const norm = dateStr.trim();
  return corpus.draws.find((d) => d.drawDate === norm);
}

/**
 * 4. Which source document produced each draw?
 */
export function getSourceDocumentForDraw(
  corpus: MultiDrawLotteryCorpus,
  drawIdOrNumber: string
): string | undefined {
  const norm = drawIdOrNumber.trim();
  const draw = corpus.draws.find(
    (d) => d.drawId === norm || d.drawNumber === norm
  );
  return draw?.sourceDocumentSha256;
}

/**
 * 5. How many prize results exist per draw?
 */
export function getResultsPerDraw(
  corpus: MultiDrawLotteryCorpus
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const d of corpus.draws) {
    result[d.drawNumber] = d.totalResultsCount;
  }
  return result;
}

/**
 * 6. Which results are FULL_TICKET vs SUFFIX?
 */
export function getResultTypesPerDraw(
  corpus: MultiDrawLotteryCorpus
): Record<string, { fullTicket: number; suffix: number; total: number }> {
  const breakdown: Record<string, { fullTicket: number; suffix: number; total: number }> = {};
  for (const d of corpus.draws) {
    breakdown[d.drawNumber] = {
      fullTicket: d.fullTicketResultsCount,
      suffix: d.suffixResultsCount,
      total: d.totalResultsCount
    };
  }
  return breakdown;
}

/**
 * 7. Which series occur in each draw?
 */
export function getSeriesPerDraw(
  corpus: MultiDrawLotteryCorpus
): Record<string, string[]> {
  const seriesMap: Record<string, string[]> = {};
  for (const d of corpus.draws) {
    seriesMap[d.drawNumber] = d.distinctSeries;
  }
  return seriesMap;
}

/**
 * 8. Are any results duplicated or conflicting?
 */
export function getConflictingOrDuplicateResults(
  corpus: MultiDrawLotteryCorpus
): Array<{ resultId: string; description: string }> {
  return corpus.validationReport.conflictingResultsDetected;
}

/**
 * 9. Are there missing or malformed records?
 */
export function getMissingOrMalformedRecords(
  corpus: MultiDrawLotteryCorpus
): Array<{ recordId: string; error: string }> {
  return corpus.validationReport.malformedRecordsDetected;
}

// ============================================================================
// Multi-Draw Statistical Aggregation Execution
// ============================================================================

/**
 * Runs the deterministic 5A statistical engine across the entire multi-draw corpus.
 * Produces purely descriptive statistics of historical observations.
 * Strictly non-predictive.
 */
export function calculateCorpusHistoricalStatistics(
  corpus: MultiDrawLotteryCorpus,
  criteria?: StatisticalFilterCriteria
): HistoricalLotteryStatisticsAggregate {
  if (corpus.draws.length === 0) {
    throw new StatisticalValidationError(
      "Cannot compute historical statistics on an empty corpus",
      "EMPTY_DATASET"
    );
  }

  // Execute existing 5A statistical engine with the combined validated entities
  return calculateHistoricalStatistics(corpus.combinedEntities, criteria, {
    statisticalVersion: DEFAULT_STATISTICAL_VERSION,
    allowEmpty: false
  });
}
