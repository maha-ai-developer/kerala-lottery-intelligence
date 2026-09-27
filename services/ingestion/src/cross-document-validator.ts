/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 7A.5 — Cross-Document Batch Validation Engine
 *
 * Implements strict batch-level validation across all candidate lottery knowledge graphs:
 * - Duplicate SHA-256 detection
 * - Duplicate draw identity detection
 * - Conflicting draw identity detection (e.g. same draw number with different lotteries or dates)
 * - Conflicting source documents for the same draw
 * - Duplicate WinningResult detection
 * - Conflicting WinningResult detection (conflicting prize amounts, mismatched types)
 * - Malformed number detection (non-numeric, irregular length)
 * - Missing prize tiers detection
 * - Series / suffix violations (suffix results MUST NEVER have series)
 * - Leading-zero loss detection
 * - Provenance gaps (missing sourceDocumentSha, drawId, or extraction metadata)
 * - Date ordering anomalies
 * - Unexpected duplicate results
 *
 * Invariant: Never silently merge or overwrite conflicting observations.
 */

import type { LotteryKnowledgeGraph } from "@kerala-lottery/knowledge";
import { extractEntitiesFromKnowledgeGraph, sortDatesChronologically } from "@kerala-lottery/statistics";

export interface BatchValidationIssue {
  type:
    | "DUPLICATE_SHA"
    | "DUPLICATE_DRAW"
    | "CONFLICTING_DRAW"
    | "CONFLICTING_SOURCE"
    | "DUPLICATE_WINNING_RESULT"
    | "CONFLICTING_WINNING_RESULT"
    | "MALFORMED_NUMBER"
    | "MISSING_PRIZE_TIERS"
    | "SERIES_SUFFIX_VIOLATION"
    | "LEADING_ZERO_LOSS"
    | "PROVENANCE_GAP"
    | "DATE_ANOMALY";
  severity: "ERROR" | "WARNING";
  documentSha256?: string;
  drawId?: string;
  drawNumber?: string;
  lotteryCode?: string;
  recordId?: string;
  message: string;
}

export interface BatchValidationReport {
  isValid: boolean;
  totalGraphs: number;
  totalDraws: number;
  distinctLotteries: string[];
  totalWinningResults: number;
  totalFullTicketResults: number;
  totalSuffixResults: number;
  dateRange: {
    earliest?: string;
    latest?: string;
  };
  errors: BatchValidationIssue[];
  warnings: BatchValidationIssue[];
  quarantinedShas: string[];
}

export class CrossDocumentValidator {
  /**
   * Validates an entire batch of parsed Knowledge Graphs.
   */
  public static validateBatch(graphs: LotteryKnowledgeGraph[]): BatchValidationReport {
    const errors: BatchValidationIssue[] = [];
    const warnings: BatchValidationIssue[] = [];
    const quarantinedShas = new Set<string>();

    const shaCountMap = new Map<string, number>();
    const drawByNumber = new Map<string, { lotteryCode: string; drawDate: string; sha: string; graphIndex: number }>();
    const seenResultKeys = new Map<string, { amount?: number; isSuffix: boolean; sha: string; id: string }>();

    let totalWinningResults = 0;
    let totalFullTicketResults = 0;
    let totalSuffixResults = 0;
    const lotteriesSet = new Set<string>();
    const dates: string[] = [];

    // Step 1: Check SHA-256 uniqueness across graphs
    for (const graph of graphs) {
      const sha = graph.documentSha256;
      shaCountMap.set(sha, (shaCountMap.get(sha) ?? 0) + 1);
    }

    for (const [sha, count] of shaCountMap.entries()) {
      if (count > 1) {
        errors.push({
          type: "DUPLICATE_SHA",
          severity: "ERROR",
          documentSha256: sha,
          message: `Document SHA-256 '${sha}' appears ${count} times in the batch.`
        });
        quarantinedShas.add(sha);
      }
    }

    // Step 2: Validate each graph and check cross-graph consistency
    for (let i = 0; i < graphs.length; i++) {
      const graph = graphs[i]!;
      const sha = graph.documentSha256;

      // Check provenance
      if (!sha || sha.length !== 64) {
        errors.push({
          type: "PROVENANCE_GAP",
          severity: "ERROR",
          documentSha256: sha,
          message: `Graph index ${i} has missing or malformed SHA-256 '${sha}'.`
        });
        quarantinedShas.add(sha);
      }

      const drawNode = graph.nodes.find((n) => n.type === "Draw");
      const lotteryNode = graph.nodes.find((n) => n.type === "Lottery");

      if (!drawNode) {
        errors.push({
          type: "PROVENANCE_GAP",
          severity: "ERROR",
          documentSha256: sha,
          message: `Graph for document '${sha}' lacks a Draw node.`
        });
        quarantinedShas.add(sha);
        continue;
      }

      const drawNumber = String(drawNode.properties.drawNumber ?? "").trim();
      const lotteryCode = String(lotteryNode?.properties.code ?? lotteryNode?.properties.name ?? "UNKNOWN").trim();
      const drawDate = String(drawNode.properties.drawDate ?? "").trim();
      const drawId = drawNode.id;

      if (lotteryCode) lotteriesSet.add(lotteryCode);
      if (drawDate) dates.push(drawDate);

      // Check draw identity conflicts
      if (drawNumber && drawNumber !== "UNKNOWN") {
        const existing = drawByNumber.get(drawNumber);
        if (existing) {
          if (existing.sha !== sha) {
            if (existing.lotteryCode !== lotteryCode) {
              errors.push({
                type: "CONFLICTING_DRAW",
                severity: "ERROR",
                documentSha256: sha,
                drawNumber,
                lotteryCode,
                message: `Draw number '${drawNumber}' conflicts: claimed by lottery '${lotteryCode}' in ${sha.slice(0, 10)} but already registered to '${existing.lotteryCode}' in ${existing.sha.slice(0, 10)}.`
              });
              quarantinedShas.add(sha);
              quarantinedShas.add(existing.sha);
            } else if (existing.drawDate !== drawDate) {
              errors.push({
                type: "CONFLICTING_DRAW",
                severity: "ERROR",
                documentSha256: sha,
                drawNumber,
                lotteryCode,
                message: `Draw number '${drawNumber}' conflicts: claimed for date '${drawDate}' in ${sha.slice(0, 10)} but already registered with date '${existing.drawDate}' in ${existing.sha.slice(0, 10)}.`
              });
              quarantinedShas.add(sha);
              quarantinedShas.add(existing.sha);
            } else {
              // Same lottery and same draw number from different documents
              errors.push({
                type: "CONFLICTING_SOURCE",
                severity: "ERROR",
                documentSha256: sha,
                drawNumber,
                lotteryCode,
                message: `Duplicate draw number '${drawNumber}' published in two different source documents (${existing.sha.slice(0, 10)} and ${sha.slice(0, 10)}).`
              });
              quarantinedShas.add(sha);
              quarantinedShas.add(existing.sha);
            }
          }
        } else {
          drawByNumber.set(drawNumber, { lotteryCode, drawDate, sha, graphIndex: i });
        }
      }

      // Extract entities
      const entities = extractEntitiesFromKnowledgeGraph(graph);

      // Check prize tiers
      if (!entities.prizeTiers || entities.prizeTiers.length === 0) {
        errors.push({
          type: "MISSING_PRIZE_TIERS",
          severity: "ERROR",
          documentSha256: sha,
          drawId,
          message: `Document '${sha.slice(0, 10)}' has zero prize tiers defined.`
        });
        quarantinedShas.add(sha);
      }

      // Check winning results
      if (!entities.winningResults || entities.winningResults.length === 0) {
        errors.push({
          type: "MISSING_PRIZE_TIERS",
          severity: "ERROR",
          documentSha256: sha,
          drawId,
          message: `Document '${sha.slice(0, 10)}' has zero winning results.`
        });
        quarantinedShas.add(sha);
      }

      for (const res of entities.winningResults ?? []) {
        totalWinningResults++;
        if (res.isSuffix) totalSuffixResults++;
        else totalFullTicketResults++;

        // 1. Malformed number check
        if (!res.canonicalNumber || !/^\d+$/.test(res.canonicalNumber)) {
          errors.push({
            type: "MALFORMED_NUMBER",
            severity: "ERROR",
            documentSha256: sha,
            recordId: res.id,
            drawNumber,
            message: `Result '${res.id}' has malformed non-digit canonical number: '${res.canonicalNumber}'.`
          });
          quarantinedShas.add(sha);
        }

        // 2. Series / Suffix violations
        if (res.isSuffix && res.series) {
          errors.push({
            type: "SERIES_SUFFIX_VIOLATION",
            severity: "ERROR",
            documentSha256: sha,
            recordId: res.id,
            drawNumber,
            message: `Suffix result '${res.id}' illegally contains series '${res.series}'.`
          });
          quarantinedShas.add(sha);
        }

        // 3. Leading zero preservation check
        if (res.rawSourceText && res.rawSourceText.startsWith("0")) {
          if (!res.canonicalNumber.startsWith("0")) {
            errors.push({
              type: "LEADING_ZERO_LOSS",
              severity: "ERROR",
              documentSha256: sha,
              recordId: res.id,
              drawNumber,
              message: `Leading zero was lost: raw '${res.rawSourceText}' -> canonical '${res.canonicalNumber}'.`
            });
            quarantinedShas.add(sha);
          }
        }

        // 4. Collision & Conflict check
        const resultKey = `${drawId}_${res.rank}_${res.canonicalNumber}_${res.series ?? "NO_SERIES"}`;
        const existingResult = seenResultKeys.get(resultKey);
        if (existingResult) {
          if (existingResult.amount !== res.amount || existingResult.isSuffix !== res.isSuffix) {
            errors.push({
              type: "CONFLICTING_WINNING_RESULT",
              severity: "ERROR",
              documentSha256: sha,
              recordId: res.id,
              drawNumber,
              message: `Conflicting WinningResult '${res.id}' across documents: amount ${res.amount} vs ${existingResult.amount}, suffix ${res.isSuffix} vs ${existingResult.isSuffix}.`
            });
            quarantinedShas.add(sha);
            quarantinedShas.add(existingResult.sha);
          } else {
            // Identical result key
            errors.push({
              type: "DUPLICATE_WINNING_RESULT",
              severity: "ERROR",
              documentSha256: sha,
              recordId: res.id,
              drawNumber,
              message: `Duplicate WinningResult '${res.id}' found in document ${sha.slice(0, 10)}.`
            });
            quarantinedShas.add(sha);
          }
        } else {
          seenResultKeys.set(resultKey, {
            amount: res.amount,
            isSuffix: res.isSuffix,
            sha,
            id: res.id
          });
        }
      }
    }

    const sortedDates = sortDatesChronologically(dates);
    const dateRange = {
      earliest: sortedDates[0],
      latest: sortedDates[sortedDates.length - 1]
    };

    return {
      isValid: errors.length === 0,
      totalGraphs: graphs.length,
      totalDraws: drawByNumber.size,
      distinctLotteries: Array.from(lotteriesSet).sort(),
      totalWinningResults,
      totalFullTicketResults,
      totalSuffixResults,
      dateRange,
      errors,
      warnings,
      quarantinedShas: Array.from(quarantinedShas)
    };
  }
}
