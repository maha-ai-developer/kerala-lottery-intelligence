/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Knowledge Graph Node & Edge Definitions
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
  | "HAS_DRAW"
  | "HAS_SERIES"
  | "HAS_PRIZE"
  | "HAS_WINNING_NUMBER"
  | "USES_DATASET"
  | "USES_FEATURE"
  | "USES_MODEL";

export interface KnowledgeNode {
  id: string;
  type: KnowledgeEntityType;
  label: string;
  properties: Record<string, unknown>;
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
  createdAt: string;
}
