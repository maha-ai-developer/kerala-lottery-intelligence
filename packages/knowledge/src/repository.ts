/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 4A: Knowledge Graph Repository Interfaces & Implementations
 *
 * Provides repository contracts and implementations for persisting and querying:
 * - LotteryKnowledgeGraph
 * - KnowledgeNode
 * - KnowledgeEdge
 *
 * Implements:
 * - InMemoryKnowledgeGraphRepository (offline & testing)
 * - FirestoreRestKnowledgeGraphRepository (production & DEV Cloud Firestore via REST)
 *
 * Security: Safe runtime authentication without hardcoded credentials.
 */

import type {
  KnowledgeNode,
  KnowledgeEdge,
  LotteryKnowledgeGraph,
  KnowledgeEntityType,
  KnowledgeRelationType,
  EdgeProvenance
} from "./graph-types";
import { validateLotteryKnowledgeGraph } from "./graph-builder";

// ============================================================================
// Repository Interface
// ============================================================================

export interface KnowledgeGraphRepository {
  saveGraph(graph: LotteryKnowledgeGraph): Promise<void>;
  getGraphByDocumentSha256(documentSha256: string): Promise<LotteryKnowledgeGraph | null>;

  saveNode(node: KnowledgeNode): Promise<void>;
  saveNodes(nodes: KnowledgeNode[]): Promise<void>;
  getNodeById(id: string): Promise<KnowledgeNode | null>;
  getNodesByType(type: KnowledgeEntityType, limit?: number): Promise<KnowledgeNode[]>;

  saveEdge(edge: KnowledgeEdge): Promise<void>;
  saveEdges(edges: KnowledgeEdge[]): Promise<void>;
  getEdgesBySource(sourceId: string, relation?: KnowledgeRelationType): Promise<KnowledgeEdge[]>;
  getEdgesByTarget(targetId: string, relation?: KnowledgeRelationType): Promise<KnowledgeEdge[]>;
}

// ============================================================================
// In-Memory Implementation
// ============================================================================

export class InMemoryKnowledgeGraphRepository implements KnowledgeGraphRepository {
  private readonly graphs = new Map<string, LotteryKnowledgeGraph>();
  private readonly nodes = new Map<string, KnowledgeNode>();
  private readonly edges = new Map<string, KnowledgeEdge>();

  async saveGraph(graph: LotteryKnowledgeGraph): Promise<void> {
    validateLotteryKnowledgeGraph(graph);
    this.graphs.set(graph.documentSha256, JSON.parse(JSON.stringify(graph)));

    // Also index individual nodes and edges
    for (const node of graph.nodes) {
      this.nodes.set(node.id, JSON.parse(JSON.stringify(node)));
    }
    for (const edge of graph.edges) {
      this.edges.set(edge.id, JSON.parse(JSON.stringify(edge)));
    }
  }

  async getGraphByDocumentSha256(documentSha256: string): Promise<LotteryKnowledgeGraph | null> {
    const g = this.graphs.get(documentSha256.trim().toLowerCase());
    return g ? JSON.parse(JSON.stringify(g)) : null;
  }

  async saveNode(node: KnowledgeNode): Promise<void> {
    this.nodes.set(node.id, JSON.parse(JSON.stringify(node)));
  }

  async saveNodes(nodes: KnowledgeNode[]): Promise<void> {
    for (const node of nodes) {
      await this.saveNode(node);
    }
  }

  async getNodeById(id: string): Promise<KnowledgeNode | null> {
    const node = this.nodes.get(id);
    return node ? JSON.parse(JSON.stringify(node)) : null;
  }

  async getNodesByType(type: KnowledgeEntityType, limit?: number): Promise<KnowledgeNode[]> {
    const results: KnowledgeNode[] = [];
    for (const node of this.nodes.values()) {
      if (node.type === type) {
        results.push(JSON.parse(JSON.stringify(node)));
        if (limit && results.length >= limit) break;
      }
    }
    return results;
  }

  async saveEdge(edge: KnowledgeEdge): Promise<void> {
    this.edges.set(edge.id, JSON.parse(JSON.stringify(edge)));
  }

  async saveEdges(edges: KnowledgeEdge[]): Promise<void> {
    for (const edge of edges) {
      await this.saveEdge(edge);
    }
  }

  async getEdgesBySource(sourceId: string, relation?: KnowledgeRelationType): Promise<KnowledgeEdge[]> {
    const results: KnowledgeEdge[] = [];
    for (const edge of this.edges.values()) {
      if (edge.sourceId === sourceId && (relation === undefined || edge.relation === relation)) {
        results.push(JSON.parse(JSON.stringify(edge)));
      }
    }
    return results;
  }

  async getEdgesByTarget(targetId: string, relation?: KnowledgeRelationType): Promise<KnowledgeEdge[]> {
    const results: KnowledgeEdge[] = [];
    for (const edge of this.edges.values()) {
      if (edge.targetId === targetId && (relation === undefined || edge.relation === relation)) {
        results.push(JSON.parse(JSON.stringify(edge)));
      }
    }
    return results;
  }
}

// ============================================================================
// Firestore REST Value Serialization Helpers
// ============================================================================

function encodeFirestoreValue(val: unknown): Record<string, any> {
  if (val === null || val === undefined) {
    return { nullValue: null };
  }
  if (typeof val === "boolean") {
    return { booleanValue: val };
  }
  if (typeof val === "number") {
    if (Number.isInteger(val)) {
      return { integerValue: val.toString() };
    }
    return { doubleValue: val };
  }
  if (typeof val === "string") {
    return { stringValue: val };
  }
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map((item) => encodeFirestoreValue(item))
      }
    };
  }
  if (typeof val === "object") {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        fields[k] = encodeFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function decodeFirestoreValue(f: Record<string, any>): any {
  if ("nullValue" in f) return null;
  if ("booleanValue" in f) return f.booleanValue;
  if ("integerValue" in f) return parseInt(f.integerValue, 10);
  if ("doubleValue" in f) return parseFloat(f.doubleValue);
  if ("stringValue" in f) return f.stringValue;
  if ("timestampValue" in f) return f.timestampValue;
  if ("arrayValue" in f) {
    return (f.arrayValue.values || []).map((v: any) => decodeFirestoreValue(v));
  }
  if ("mapValue" in f) {
    const result: Record<string, any> = {};
    const subFields = f.mapValue.fields || {};
    for (const [k, v] of Object.entries(subFields)) {
      result[k] = decodeFirestoreValue(v as Record<string, any>);
    }
    return result;
  }
  return null;
}

// ============================================================================
// Firestore REST Implementation
// ============================================================================

export interface FirestoreRestKnowledgeGraphRepositoryOptions {
  projectId: string;
  databaseId?: string;
  nodesCollection?: string;
  edgesCollection?: string;
  graphsCollection?: string;
  getAccessToken: () => Promise<string> | string;
}

export class FirestoreRestKnowledgeGraphRepository implements KnowledgeGraphRepository {
  private readonly projectId: string;
  private readonly databaseId: string;
  private readonly nodesCollection: string;
  private readonly edgesCollection: string;
  private readonly graphsCollection: string;
  private readonly getAccessToken: () => Promise<string> | string;

  constructor(options: FirestoreRestKnowledgeGraphRepositoryOptions) {
    this.projectId = options.projectId;
    this.databaseId = options.databaseId || "(default)";
    this.nodesCollection = options.nodesCollection || "knowledge_nodes";
    this.edgesCollection = options.edgesCollection || "knowledge_edges";
    this.graphsCollection = options.graphsCollection || "lottery_knowledge_graphs";
    this.getAccessToken = options.getAccessToken;
  }

  private get baseUrl(): string {
    return `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/${this.databaseId}/documents`;
  }

  private async getHeaders(): Promise<Record<string, string>> {
    const token = await this.getAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    };
  }

  // --------------------------------------------------------------------------
  // Graph Methods
  // --------------------------------------------------------------------------

  async saveGraph(graph: LotteryKnowledgeGraph): Promise<void> {
    validateLotteryKnowledgeGraph(graph);

    // 1. Save full graph snapshot document
    const url = `${this.baseUrl}/${this.graphsCollection}/${encodeURIComponent(graph.documentSha256)}`;
    const headers = await this.getHeaders();
    const body = JSON.stringify({ fields: this.graphToFirestoreFields(graph) });

    const res = await fetch(url, { method: "PATCH", headers, body });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to save graph for ${graph.documentSha256}: HTTP ${res.status} - ${errText}`);
    }

    // 2. Save individual nodes and edges
    await this.saveNodes(graph.nodes);
    await this.saveEdges(graph.edges);
  }

  async getGraphByDocumentSha256(documentSha256: string): Promise<LotteryKnowledgeGraph | null> {
    const normalized = documentSha256.trim().toLowerCase();
    const url = `${this.baseUrl}/${this.graphsCollection}/${encodeURIComponent(normalized)}`;
    const headers = await this.getHeaders();

    const res = await fetch(url, { method: "GET", headers });
    if (res.status === 404) return null;
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to get graph for ${normalized}: HTTP ${res.status} - ${errText}`);
    }

    const data = (await res.json()) as { fields: Record<string, any> };
    return this.graphFromFirestoreFields(data.fields);
  }

  // --------------------------------------------------------------------------
  // Node Methods
  // --------------------------------------------------------------------------

  async saveNode(node: KnowledgeNode): Promise<void> {
    const url = `${this.baseUrl}/${this.nodesCollection}/${encodeURIComponent(node.id)}`;
    const headers = await this.getHeaders();
    const body = JSON.stringify({ fields: this.nodeToFirestoreFields(node) });

    const res = await fetch(url, { method: "PATCH", headers, body });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to save node ${node.id}: HTTP ${res.status} - ${errText}`);
    }
  }

  async saveNodes(nodes: KnowledgeNode[]): Promise<void> {
    for (const node of nodes) {
      await this.saveNode(node);
    }
  }

  async getNodeById(id: string): Promise<KnowledgeNode | null> {
    const url = `${this.baseUrl}/${this.nodesCollection}/${encodeURIComponent(id)}`;
    const headers = await this.getHeaders();

    const res = await fetch(url, { method: "GET", headers });
    if (res.status === 404) return null;
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to get node ${id}: HTTP ${res.status} - ${errText}`);
    }

    const data = (await res.json()) as { fields: Record<string, any> };
    return this.nodeFromFirestoreFields(data.fields);
  }

  async getNodesByType(type: KnowledgeEntityType, limit = 100): Promise<KnowledgeNode[]> {
    const url = `${this.baseUrl}:runQuery`;
    const headers = await this.getHeaders();

    const body = JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: this.nodesCollection }],
        where: {
          fieldFilter: {
            field: { fieldPath: "type" },
            op: "EQUAL",
            value: { stringValue: type }
          }
        },
        limit
      }
    });

    const res = await fetch(url, { method: "POST", headers, body });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to query nodes by type ${type}: HTTP ${res.status} - ${errText}`);
    }

    const data = (await res.json()) as Array<{ document?: { fields: Record<string, any> } }>;
    const results: KnowledgeNode[] = [];
    for (const item of data) {
      if (item.document?.fields) {
        results.push(this.nodeFromFirestoreFields(item.document.fields));
      }
    }
    return results;
  }

  // --------------------------------------------------------------------------
  // Edge Methods
  // --------------------------------------------------------------------------

  async saveEdge(edge: KnowledgeEdge): Promise<void> {
    const url = `${this.baseUrl}/${this.edgesCollection}/${encodeURIComponent(edge.id)}`;
    const headers = await this.getHeaders();
    const body = JSON.stringify({ fields: this.edgeToFirestoreFields(edge) });

    const res = await fetch(url, { method: "PATCH", headers, body });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to save edge ${edge.id}: HTTP ${res.status} - ${errText}`);
    }
  }

  async saveEdges(edges: KnowledgeEdge[]): Promise<void> {
    for (const edge of edges) {
      await this.saveEdge(edge);
    }
  }

  async getEdgesBySource(sourceId: string, relation?: KnowledgeRelationType): Promise<KnowledgeEdge[]> {
    const url = `${this.baseUrl}:runQuery`;
    const headers = await this.getHeaders();

    let whereClause: any = {
      fieldFilter: {
        field: { fieldPath: "sourceId" },
        op: "EQUAL",
        value: { stringValue: sourceId }
      }
    };

    if (relation) {
      whereClause = {
        compositeFilter: {
          op: "AND",
          filters: [
            whereClause,
            {
              fieldFilter: {
                field: { fieldPath: "relation" },
                op: "EQUAL",
                value: { stringValue: relation }
              }
            }
          ]
        }
      };
    }

    const body = JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: this.edgesCollection }],
        where: whereClause
      }
    });

    const res = await fetch(url, { method: "POST", headers, body });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to query edges for source ${sourceId}: HTTP ${res.status} - ${errText}`);
    }

    const data = (await res.json()) as Array<{ document?: { fields: Record<string, any> } }>;
    const results: KnowledgeEdge[] = [];
    for (const item of data) {
      if (item.document?.fields) {
        results.push(this.edgeFromFirestoreFields(item.document.fields));
      }
    }
    return results;
  }

  async getEdgesByTarget(targetId: string, relation?: KnowledgeRelationType): Promise<KnowledgeEdge[]> {
    const url = `${this.baseUrl}:runQuery`;
    const headers = await this.getHeaders();

    let whereClause: any = {
      fieldFilter: {
        field: { fieldPath: "targetId" },
        op: "EQUAL",
        value: { stringValue: targetId }
      }
    };

    if (relation) {
      whereClause = {
        compositeFilter: {
          op: "AND",
          filters: [
            whereClause,
            {
              fieldFilter: {
                field: { fieldPath: "relation" },
                op: "EQUAL",
                value: { stringValue: relation }
              }
            }
          ]
        }
      };
    }

    const body = JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: this.edgesCollection }],
        where: whereClause
      }
    });

    const res = await fetch(url, { method: "POST", headers, body });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to query edges for target ${targetId}: HTTP ${res.status} - ${errText}`);
    }

    const data = (await res.json()) as Array<{ document?: { fields: Record<string, any> } }>;
    const results: KnowledgeEdge[] = [];
    for (const item of data) {
      if (item.document?.fields) {
        results.push(this.edgeFromFirestoreFields(item.document.fields));
      }
    }
    return results;
  }

  // --------------------------------------------------------------------------
  // Serialization Helpers
  // --------------------------------------------------------------------------

  private nodeToFirestoreFields(node: KnowledgeNode): Record<string, any> {
    const fields: Record<string, any> = {
      id: { stringValue: node.id },
      type: { stringValue: node.type },
      label: { stringValue: node.label },
      properties: encodeFirestoreValue(node.properties),
      createdAt: { stringValue: node.createdAt }
    };
    if (node.provenance) {
      fields.provenance = encodeFirestoreValue(node.provenance);
    }
    if (node.validFrom) {
      fields.validFrom = { stringValue: node.validFrom };
    }
    if (node.validTo) {
      fields.validTo = { stringValue: node.validTo };
    }
    return fields;
  }

  private nodeFromFirestoreFields(fields: Record<string, any>): KnowledgeNode {
    return {
      id: fields.id?.stringValue || "",
      type: (fields.type?.stringValue || "SourceDocument") as KnowledgeEntityType,
      label: fields.label?.stringValue || "",
      properties: decodeFirestoreValue(fields.properties || { mapValue: { fields: {} } }) || {},
      provenance: fields.provenance ? (decodeFirestoreValue(fields.provenance) as EdgeProvenance) : undefined,
      validFrom: fields.validFrom?.stringValue,
      validTo: fields.validTo?.stringValue,
      createdAt: fields.createdAt?.stringValue || ""
    };
  }

  private edgeToFirestoreFields(edge: KnowledgeEdge): Record<string, any> {
    const fields: Record<string, any> = {
      id: { stringValue: edge.id },
      sourceId: { stringValue: edge.sourceId },
      sourceType: { stringValue: edge.sourceType },
      targetId: { stringValue: edge.targetId },
      targetType: { stringValue: edge.targetType },
      relation: { stringValue: edge.relation },
      provenance: encodeFirestoreValue(edge.provenance),
      createdAt: { stringValue: edge.createdAt }
    };
    if (edge.metadata) {
      fields.metadata = encodeFirestoreValue(edge.metadata);
    }
    return fields;
  }

  private edgeFromFirestoreFields(fields: Record<string, any>): KnowledgeEdge {
    return {
      id: fields.id?.stringValue || "",
      sourceId: fields.sourceId?.stringValue || "",
      sourceType: (fields.sourceType?.stringValue || "SourceDocument") as KnowledgeEntityType,
      targetId: fields.targetId?.stringValue || "",
      targetType: (fields.targetType?.stringValue || "SourceDocument") as KnowledgeEntityType,
      relation: (fields.relation?.stringValue || "CONTAINS") as KnowledgeRelationType,
      metadata: fields.metadata ? decodeFirestoreValue(fields.metadata) : undefined,
      provenance: decodeFirestoreValue(fields.provenance || { mapValue: { fields: {} } }) as EdgeProvenance,
      createdAt: fields.createdAt?.stringValue || ""
    };
  }

  private graphToFirestoreFields(graph: LotteryKnowledgeGraph): Record<string, any> {
    return {
      documentSha256: { stringValue: graph.documentSha256 },
      nodes: {
        arrayValue: {
          values: graph.nodes.map((n) => ({ mapValue: { fields: this.nodeToFirestoreFields(n) } }))
        }
      },
      edges: {
        arrayValue: {
          values: graph.edges.map((e) => ({ mapValue: { fields: this.edgeToFirestoreFields(e) } }))
        }
      },
      metadata: encodeFirestoreValue(graph.metadata)
    };
  }

  private graphFromFirestoreFields(fields: Record<string, any>): LotteryKnowledgeGraph {
    const nodes: KnowledgeNode[] = [];
    if (fields.nodes?.arrayValue?.values) {
      for (const item of fields.nodes.arrayValue.values) {
        if (item.mapValue?.fields) {
          nodes.push(this.nodeFromFirestoreFields(item.mapValue.fields));
        }
      }
    }

    const edges: KnowledgeEdge[] = [];
    if (fields.edges?.arrayValue?.values) {
      for (const item of fields.edges.arrayValue.values) {
        if (item.mapValue?.fields) {
          edges.push(this.edgeFromFirestoreFields(item.mapValue.fields));
        }
      }
    }

    return {
      documentSha256: fields.documentSha256?.stringValue || "",
      nodes,
      edges,
      metadata: decodeFirestoreValue(fields.metadata || { mapValue: { fields: {} } }) || {
        nodeCount: nodes.length,
        edgeCount: edges.length,
        extractedAt: "",
        graphVersion: ""
      }
    };
  }
}
