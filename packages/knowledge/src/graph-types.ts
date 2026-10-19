/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 4A: Knowledge Graph Foundation Types
 *
 * Defines the canonical entity-relationship schema for the lottery knowledge graph,
 * connecting:
 * Document -> Lottery -> Draw -> PrizeTier -> WinningResult -> Series -> WinningNumber
 *
 * Invariants:
 * - Deterministic entity and relationship IDs.
 * - Source document provenance on every node and edge.
 * - Idempotent, deduplicated graph representations.
 * - Explicit representation of missing/unknown relationships.
 * - No statistics, predictions, ML, or probabilistic inference.
 */

export type KnowledgeEntityType =
  | "Act"
  | "Rule"
  | "Amendment"
  | "LegalDocument"
  | "Form"
  | "Lottery"
  | "Scheme"
  | "Draw"
  | "Prize"
  | "PrizeTier"
  | "WinningResult"
  | "Ticket"
  | "Series"
  | "WinningNumber"
  | "Suffix"
  | "Agent"
  | "Agency"
  | "District"
  | "Office"
  | "SourceDocument"
  | "Dataset"
  | "Experiment"
  | "Model"
  | "Feature";

export type KnowledgeRelationType =
  | "CONTAINS"
  | "AMENDED_BY"
  | "AMENDS"
  | "SOURCED_FROM"
  | "HAS_LOTTERY"
  | "HAS_DRAW"
  | "HAS_PRIZE"
  | "HAS_PRIZE_TIER"
  | "HAS_WINNING_RESULT"
  | "HAS_SERIES"
  | "HAS_WINNING_NUMBER"
  | "ASSOCIATED_WITH_NUMBER"
  | "USES_DATASET"
  | "USES_FEATURE"
  | "USES_MODEL";

export interface EdgeProvenance {
  documentSha256: string;
  sourcePageNumber?: number;
  sourceTextBlockOrders?: number[];
  parserRule: string;
  parserVersion: string;
  confidence: number;
  extractedAt: string;
}

export interface KnowledgeNode {
  id: string;
  type: KnowledgeEntityType;
  label: string;
  properties: Record<string, unknown>;
  provenance?: EdgeProvenance;
  validFrom?: string; // Temporal context
  validTo?: string;
  createdAt: string;
}

export interface KnowledgeEdge {
  id: string;
  sourceId: string;
  sourceType: KnowledgeEntityType;
  targetId: string;
  targetType: KnowledgeEntityType;
  relation: KnowledgeRelationType;
  metadata?: Record<string, unknown>;
  provenance: EdgeProvenance;
  createdAt: string;
}

export interface LotteryKnowledgeGraph {
  documentSha256: string;
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  metadata: {
    nodeCount: number;
    edgeCount: number;
    lotteryId?: string;
    drawId?: string;
    extractedAt: string;
    graphVersion: string;
  };
}

export const DEFAULT_GRAPH_VERSION = "v1.0.0-knowledge-graph";

// ============================================================================
// Deterministic ID Generators
// ============================================================================

export function getDocumentNodeId(documentSha256: string): string {
  return documentSha256.trim().toLowerCase();
}

export function getLotteryNodeId(lotteryCode?: string): string {
  if (!lotteryCode || !lotteryCode.trim()) {
    return "lottery_UNKNOWN";
  }
  return `lottery_${lotteryCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "_")}`;
}

export function getDrawNodeId(documentSha256: string, drawNumber?: string): string {
  const normSha = documentSha256.trim().toLowerCase();
  if (!drawNumber || !drawNumber.trim()) {
    return `${normSha}_draw_UNKNOWN`;
  }
  const normNum = drawNumber.trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${normSha}_draw_${normNum}`;
}

export function getPrizeTierNodeId(tierId: string): string {
  return tierId.trim();
}

export function getWinningResultNodeId(resultId: string): string {
  return resultId.trim();
}

export function getSeriesNodeId(code: string): string {
  return `series_${code.trim().toUpperCase()}`;
}

export function getWinningNumberNodeId(canonicalNumber: string): string {
  return `number_${canonicalNumber.trim()}`;
}

export function getKnowledgeEdgeId(
  relation: KnowledgeRelationType,
  sourceId: string,
  targetId: string,
  qualifier?: string
): string {
  const qPart = qualifier ? `_${qualifier}` : "";
  return `edge_${relation.toLowerCase()}_${sourceId}_${targetId}${qPart}`;
}
