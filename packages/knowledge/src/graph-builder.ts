/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 4A: Knowledge Graph Builder & Validator
 *
 * Implements deterministic graph construction and traversal for canonical lottery entities:
 *   Document -> Lottery -> Draw -> PrizeTier -> WinningResult -> Series -> WinningNumber
 *
 * Invariants:
 * - Deterministic entity and edge IDs.
 * - Source document provenance on every node and edge.
 * - Idempotent, deduplicated graph representations.
 * - Explicit representation of missing/unknown relationships.
 * - Strictly NO statistics, predictions, ML, or probabilistic inference.
 * - String preservation for lottery numbers (leading zeros preserved).
 */

import type {
  DocumentSemanticSegmentation,
  LotteryEntityExtractionResult,
  PrizeTier
} from "@kerala-lottery/domain";
import {
  type KnowledgeNode,
  type KnowledgeEdge,
  type LotteryKnowledgeGraph,
  type KnowledgeRelationType,
  DEFAULT_GRAPH_VERSION,
  getDocumentNodeId,
  getLotteryNodeId,
  getDrawNodeId,
  getPrizeTierNodeId,
  getWinningResultNodeId,
  getSeriesNodeId,
  getWinningNumberNodeId,
  getKnowledgeEdgeId
} from "./graph-types";

// ============================================================================
// Error Definitions
// ============================================================================

export class KnowledgeGraphValidationError extends Error {
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, code = "GRAPH_VALIDATION_ERROR", details?: unknown) {
    super(`KnowledgeGraphValidationError [${code}]: ${message}`);
    this.name = "KnowledgeGraphValidationError";
    this.code = code;
    this.details = details;
  }
}

// ============================================================================
// Graph Builder Options
// ============================================================================

export interface KnowledgeGraphBuilderOptions {
  graphVersion?: string;
  createdAt?: string;
}

// ============================================================================
// Core Builder Function
// ============================================================================

export function buildLotteryKnowledgeGraph(
  extractionResult: LotteryEntityExtractionResult,
  segmentation?: DocumentSemanticSegmentation,
  options?: KnowledgeGraphBuilderOptions
): LotteryKnowledgeGraph {
  if (!extractionResult) {
    throw new KnowledgeGraphValidationError(
      "Extraction result is required to build knowledge graph",
      "MISSING_EXTRACTION_RESULT"
    );
  }

  const documentSha256 = extractionResult.documentSha256;
  if (!documentSha256 || typeof documentSha256 !== "string") {
    throw new KnowledgeGraphValidationError(
      "Valid document SHA-256 is required",
      "INVALID_DOCUMENT_SHA256"
    );
  }

  const graphVersion = options?.graphVersion || DEFAULT_GRAPH_VERSION;
  const createdAt = options?.createdAt || extractionResult.createdAt || new Date().toISOString();

  const nodesMap = new Map<string, KnowledgeNode>();
  const edgesMap = new Map<string, KnowledgeEdge>();

  function addNode(node: KnowledgeNode): void {
    if (!nodesMap.has(node.id)) {
      nodesMap.set(node.id, node);
    }
  }

  function addEdge(edge: KnowledgeEdge): void {
    if (!edgesMap.has(edge.id)) {
      edgesMap.set(edge.id, edge);
    }
  }

  // --------------------------------------------------------------------------
  // 1. Source Document Node
  // --------------------------------------------------------------------------
  const docNodeId = getDocumentNodeId(documentSha256);
  const docNode: KnowledgeNode = {
    id: docNodeId,
    type: "SourceDocument",
    label: `Document ${documentSha256.substring(0, 8)}...`,
    properties: {
      documentSha256,
      pageCount: segmentation?.pageCount ?? 0,
      classificationKind: segmentation?.classification?.kind ?? "LOTTERY_RESULT",
      semanticVersion: segmentation?.semanticVersion ?? extractionResult.semanticVersion,
      extractionVersion: extractionResult.extractionVersion,
      parserVersion: extractionResult.parserVersion
    },
    provenance: {
      documentSha256,
      parserRule: "rule.graph.document_node_v1",
      parserVersion: graphVersion,
      confidence: 1.0,
      extractedAt: createdAt
    },
    createdAt
  };
  addNode(docNode);

  // --------------------------------------------------------------------------
  // 2. Lottery Node
  // --------------------------------------------------------------------------
  const lotteryField =
    segmentation?.drawMetadata?.lotteryName || extractionResult.drawMetadata?.lotteryName;

  let lotteryNode: KnowledgeNode;
  if (lotteryField?.value && lotteryField.value.trim()) {
    const rawName = lotteryField.value.trim();
    const code = rawName.toUpperCase().replace(/[^A-Z0-9_-]/g, "_");
    const lotteryId = getLotteryNodeId(code);

    lotteryNode = {
      id: lotteryId,
      type: "Lottery",
      label: `Lottery: ${rawName}`,
      properties: {
        code,
        name: rawName,
        isUnknown: false,
        state: "Kerala"
      },
      provenance: {
        documentSha256,
        sourcePageNumber: lotteryField.sourcePageNumber,
        sourceTextBlockOrders: [lotteryField.textBlockOrder],
        parserRule: lotteryField.ruleId || "rule.graph.lottery_node_v1",
        parserVersion: graphVersion,
        confidence: lotteryField.confidence || 1.0,
        extractedAt: createdAt
      },
      createdAt
    };
  } else {
    // Explicit Unknown Representation
    const unknownLotteryId = getLotteryNodeId(undefined);
    lotteryNode = {
      id: unknownLotteryId,
      type: "Lottery",
      label: "Lottery: UNKNOWN",
      properties: {
        code: "UNKNOWN",
        name: "UNKNOWN",
        isUnknown: true,
        reason: "NOT_SPECIFIED_IN_DOCUMENT"
      },
      provenance: {
        documentSha256,
        parserRule: "rule.graph.unknown_lottery_v1",
        parserVersion: graphVersion,
        confidence: 0.0,
        extractedAt: createdAt
      },
      createdAt
    };
  }
  addNode(lotteryNode);

  // Edge: Document -> Lottery
  const docToLotteryEdgeId = getKnowledgeEdgeId("HAS_LOTTERY", docNode.id, lotteryNode.id);
  const docToLotteryEdge: KnowledgeEdge = {
    id: docToLotteryEdgeId,
    sourceId: docNode.id,
    sourceType: "SourceDocument",
    targetId: lotteryNode.id,
    targetType: "Lottery",
    relation: "HAS_LOTTERY",
    metadata: {
      isUnknown: lotteryNode.properties.isUnknown
    },
    provenance: lotteryNode.provenance || docNode.provenance!,
    createdAt
  };
  addEdge(docToLotteryEdge);

  // --------------------------------------------------------------------------
  // 3. Draw Node
  // --------------------------------------------------------------------------
  const drawField =
    segmentation?.drawMetadata?.drawNumber || extractionResult.drawMetadata?.drawNumber;

  let drawNode: KnowledgeNode;
  if (drawField?.value && drawField.value.trim()) {
    const rawNumber = drawField.value.trim();
    const drawId = getDrawNodeId(documentSha256, rawNumber);

    drawNode = {
      id: drawId,
      type: "Draw",
      label: `Draw: ${rawNumber}`,
      properties: {
        drawNumber: rawNumber,
        lotteryId: lotteryNode.id,
        documentSha256,
        drawDate:
          segmentation?.drawMetadata?.drawDate?.value ||
          extractionResult.drawMetadata?.drawDate?.value,
        drawTime:
          segmentation?.drawMetadata?.drawTime?.value ||
          extractionResult.drawMetadata?.drawTime?.value,
        location:
          segmentation?.drawMetadata?.location?.value ||
          extractionResult.drawMetadata?.location?.value,
        isUnknown: false
      },
      provenance: {
        documentSha256,
        sourcePageNumber: drawField.sourcePageNumber,
        sourceTextBlockOrders: [drawField.textBlockOrder],
        parserRule: drawField.ruleId || "rule.graph.draw_node_v1",
        parserVersion: graphVersion,
        confidence: drawField.confidence || 1.0,
        extractedAt: createdAt
      },
      createdAt
    };
  } else {
    // Explicit Unknown Representation
    const unknownDrawId = getDrawNodeId(documentSha256, undefined);
    drawNode = {
      id: unknownDrawId,
      type: "Draw",
      label: "Draw: UNKNOWN",
      properties: {
        drawNumber: "UNKNOWN",
        lotteryId: lotteryNode.id,
        documentSha256,
        isUnknown: true,
        reason: "NOT_SPECIFIED_IN_DOCUMENT"
      },
      provenance: {
        documentSha256,
        parserRule: "rule.graph.unknown_draw_v1",
        parserVersion: graphVersion,
        confidence: 0.0,
        extractedAt: createdAt
      },
      createdAt
    };
  }
  addNode(drawNode);

  // Edge: Lottery -> Draw
  const lotteryToDrawEdgeId = getKnowledgeEdgeId("HAS_DRAW", lotteryNode.id, drawNode.id);
  const lotteryToDrawEdge: KnowledgeEdge = {
    id: lotteryToDrawEdgeId,
    sourceId: lotteryNode.id,
    sourceType: "Lottery",
    targetId: drawNode.id,
    targetType: "Draw",
    relation: "HAS_DRAW",
    metadata: {
      isUnknown: drawNode.properties.isUnknown
    },
    provenance: drawNode.provenance || lotteryNode.provenance!,
    createdAt
  };
  addEdge(lotteryToDrawEdge);

  // --------------------------------------------------------------------------
  // 4. PrizeTier Nodes & Edges (Draw -> PrizeTier)
  // --------------------------------------------------------------------------
  const tiersById = new Map<string, PrizeTier>();
  for (const tier of extractionResult.prizeTiers) {
    tiersById.set(tier.id, tier);

    const tierNodeId = getPrizeTierNodeId(tier.id);
    const tierNode: KnowledgeNode = {
      id: tierNodeId,
      type: "PrizeTier",
      label: `${tier.name}${tier.amount !== undefined ? ` (₹${tier.amount.toLocaleString("en-IN")})` : ""}`,
      properties: {
        name: tier.name,
        rank: tier.rank,
        tierType: tier.tierType,
        amount: tier.amount,
        currency: tier.currency || "INR",
        isSuffix: tier.isSuffix,
        expectedLength: tier.expectedLength,
        pageNumber: tier.pageNumber,
        textBlockOrders: tier.sourceTextBlockOrders,
        rawSourceText: tier.rawSourceText
      },
      provenance: {
        documentSha256: tier.documentSha256,
        sourcePageNumber: tier.pageNumber,
        sourceTextBlockOrders: tier.sourceTextBlockOrders,
        parserRule: tier.parserRule,
        parserVersion: tier.parserVersion,
        confidence: tier.confidence,
        extractedAt: tier.createdAt
      },
      createdAt
    };
    addNode(tierNode);

    // Edge: Draw -> PrizeTier
    const drawToTierEdgeId = getKnowledgeEdgeId("HAS_PRIZE_TIER", drawNode.id, tierNode.id);
    const drawToTierEdge: KnowledgeEdge = {
      id: drawToTierEdgeId,
      sourceId: drawNode.id,
      sourceType: "Draw",
      targetId: tierNode.id,
      targetType: "PrizeTier",
      relation: "HAS_PRIZE_TIER",
      metadata: {
        rank: tier.rank,
        tierType: tier.tierType,
        amount: tier.amount
      },
      provenance: {
        documentSha256: tier.documentSha256,
        sourcePageNumber: tier.pageNumber,
        sourceTextBlockOrders: tier.sourceTextBlockOrders,
        parserRule: "rule.graph.edge_has_prize_tier_v1",
        parserVersion: graphVersion,
        confidence: tier.confidence,
        extractedAt: tier.createdAt
      },
      createdAt
    };
    addEdge(drawToTierEdge);
  }

  // --------------------------------------------------------------------------
  // 5. WinningResult, Series, WinningNumber Nodes & Edges
  // --------------------------------------------------------------------------
  for (const result of extractionResult.winningResults) {
    const resultNodeId = getWinningResultNodeId(result.id);
    const resultSeries = result.series?.trim().toUpperCase();
    const isSuffix = result.isSuffix;

    const seriesStatus = resultSeries
      ? "PRESENT"
      : isSuffix
        ? "ABSENT_SUFFIX"
        : "UNKNOWN_MISSING";

    const resultNode: KnowledgeNode = {
      id: resultNodeId,
      type: "WinningResult",
      label: `${result.prizeTierName}: ${resultSeries ? resultSeries + " " : ""}${result.canonicalNumber}`,
      properties: {
        prizeTierId: result.prizeTierId,
        prizeTierName: result.prizeTierName,
        rank: result.rank,
        amount: result.amount,
        series: resultSeries,
        seriesStatus,
        canonicalNumber: result.canonicalNumber,
        numberLength: result.numberLength,
        isSuffix,
        location: result.location,
        validationStatus: result.validationStatus,
        pageNumber: result.pageNumber,
        textBlockOrders: result.sourceTextBlockOrders
      },
      provenance: {
        documentSha256: result.documentSha256,
        sourcePageNumber: result.pageNumber,
        sourceTextBlockOrders: result.sourceTextBlockOrders,
        parserRule: result.parserRule,
        parserVersion: result.parserVersion,
        confidence: result.confidence,
        extractedAt: result.createdAt
      },
      createdAt
    };
    addNode(resultNode);

    // Edge: PrizeTier -> WinningResult
    const tierToResultEdgeId = getKnowledgeEdgeId(
      "HAS_WINNING_RESULT",
      result.prizeTierId,
      resultNode.id
    );
    const tierToResultEdge: KnowledgeEdge = {
      id: tierToResultEdgeId,
      sourceId: result.prizeTierId,
      sourceType: "PrizeTier",
      targetId: resultNode.id,
      targetType: "WinningResult",
      relation: "HAS_WINNING_RESULT",
      metadata: {
        canonicalNumber: result.canonicalNumber,
        rank: result.rank,
        isSuffix
      },
      provenance: {
        documentSha256: result.documentSha256,
        sourcePageNumber: result.pageNumber,
        sourceTextBlockOrders: result.sourceTextBlockOrders,
        parserRule: "rule.graph.edge_has_winning_result_v1",
        parserVersion: graphVersion,
        confidence: result.confidence,
        extractedAt: result.createdAt
      },
      createdAt
    };
    addEdge(tierToResultEdge);

    // ------------------------------------------------------------------------
    // 6. Series Node & Edge: WinningResult -> Series
    // ------------------------------------------------------------------------
    let seriesNodeId: string | undefined;

    if (resultSeries) {
      seriesNodeId = getSeriesNodeId(resultSeries);

      // Create Series Node if not present
      if (!nodesMap.has(seriesNodeId)) {
        const seriesNode: KnowledgeNode = {
          id: seriesNodeId,
          type: "Series",
          label: `Series ${resultSeries}`,
          properties: {
            code: resultSeries,
            isUnknown: false
          },
          provenance: {
            documentSha256: result.documentSha256,
            sourcePageNumber: result.pageNumber,
            sourceTextBlockOrders: result.sourceTextBlockOrders,
            parserRule: "rule.graph.series_node_v1",
            parserVersion: graphVersion,
            confidence: result.confidence,
            extractedAt: result.createdAt
          },
          createdAt
        };
        addNode(seriesNode);
      }

      // Edge: WinningResult -> Series
      const resultToSeriesEdgeId = getKnowledgeEdgeId(
        "HAS_SERIES",
        resultNode.id,
        seriesNodeId
      );
      const resultToSeriesEdge: KnowledgeEdge = {
        id: resultToSeriesEdgeId,
        sourceId: resultNode.id,
        sourceType: "WinningResult",
        targetId: seriesNodeId,
        targetType: "Series",
        relation: "HAS_SERIES",
        metadata: {
          code: resultSeries
        },
        provenance: {
          documentSha256: result.documentSha256,
          sourcePageNumber: result.pageNumber,
          sourceTextBlockOrders: result.sourceTextBlockOrders,
          parserRule: "rule.graph.edge_has_series_v1",
          parserVersion: graphVersion,
          confidence: result.confidence,
          extractedAt: result.createdAt
        },
        createdAt
      };
      addEdge(resultToSeriesEdge);
    }

    // ------------------------------------------------------------------------
    // 7. WinningNumber Node & Edges
    // ------------------------------------------------------------------------
    const numberNodeId = getWinningNumberNodeId(result.canonicalNumber);

    if (!nodesMap.has(numberNodeId)) {
      const numberNode: KnowledgeNode = {
        id: numberNodeId,
        type: "WinningNumber",
        label: `Number ${result.canonicalNumber}`,
        properties: {
          canonicalNumber: result.canonicalNumber, // String with preserved leading zeros
          numberLength: result.canonicalNumber.length,
          derivedNumericValue: parseInt(result.canonicalNumber, 10)
        },
        provenance: {
          documentSha256: result.documentSha256,
          sourcePageNumber: result.pageNumber,
          sourceTextBlockOrders: result.sourceTextBlockOrders,
          parserRule: "rule.graph.winning_number_node_v1",
          parserVersion: graphVersion,
          confidence: result.confidence,
          extractedAt: result.createdAt
        },
        createdAt
      };
      addNode(numberNode);
    }

    // Edge: WinningResult -> WinningNumber
    const resultToNumberEdgeId = getKnowledgeEdgeId(
      "HAS_WINNING_NUMBER",
      resultNode.id,
      numberNodeId
    );
    const resultToNumberEdge: KnowledgeEdge = {
      id: resultToNumberEdgeId,
      sourceId: resultNode.id,
      sourceType: "WinningResult",
      targetId: numberNodeId,
      targetType: "WinningNumber",
      relation: "HAS_WINNING_NUMBER",
      metadata: {
        canonicalNumber: result.canonicalNumber,
        isSuffix
      },
      provenance: {
        documentSha256: result.documentSha256,
        sourcePageNumber: result.pageNumber,
        sourceTextBlockOrders: result.sourceTextBlockOrders,
        parserRule: "rule.graph.edge_result_has_number_v1",
        parserVersion: graphVersion,
        confidence: result.confidence,
        extractedAt: result.createdAt
      },
      createdAt
    };
    addEdge(resultToNumberEdge);

    // If Series is present, also connect Series -> WinningNumber qualified by drawId
    if (seriesNodeId) {
      const seriesToNumberEdgeId = getKnowledgeEdgeId(
        "HAS_WINNING_NUMBER",
        seriesNodeId,
        numberNodeId,
        drawNode.id
      );
      const seriesToNumberEdge: KnowledgeEdge = {
        id: seriesToNumberEdgeId,
        sourceId: seriesNodeId,
        sourceType: "Series",
        targetId: numberNodeId,
        targetType: "WinningNumber",
        relation: "HAS_WINNING_NUMBER",
        metadata: {
          drawId: drawNode.id,
          prizeTierId: result.prizeTierId,
          resultId: result.id
        },
        provenance: {
          documentSha256: result.documentSha256,
          sourcePageNumber: result.pageNumber,
          sourceTextBlockOrders: result.sourceTextBlockOrders,
          parserRule: "rule.graph.edge_series_has_number_v1",
          parserVersion: graphVersion,
          confidence: result.confidence,
          extractedAt: result.createdAt
        },
        createdAt
      };
      addEdge(seriesToNumberEdge);
    }
  }

  const nodes = Array.from(nodesMap.values());
  const edges = Array.from(edgesMap.values());

  return {
    documentSha256,
    nodes,
    edges,
    metadata: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      lotteryId: lotteryNode.id,
      drawId: drawNode.id,
      extractedAt: createdAt,
      graphVersion
    }
  };
}

// ============================================================================
// Service Class
// ============================================================================

export class LotteryKnowledgeGraphBuilder {
  private readonly defaultGraphVersion: string;

  constructor(options?: { graphVersion?: string }) {
    this.defaultGraphVersion = options?.graphVersion || DEFAULT_GRAPH_VERSION;
  }

  public build(
    extractionResult: LotteryEntityExtractionResult,
    segmentation?: DocumentSemanticSegmentation,
    options?: KnowledgeGraphBuilderOptions
  ): LotteryKnowledgeGraph {
    return buildLotteryKnowledgeGraph(extractionResult, segmentation, {
      graphVersion: options?.graphVersion || this.defaultGraphVersion,
      createdAt: options?.createdAt
    });
  }
}

// ============================================================================
// Traversal and Query Helpers
// ============================================================================

export function getNode(graph: LotteryKnowledgeGraph, id: string): KnowledgeNode | undefined {
  return graph.nodes.find((n) => n.id === id);
}

export function getOutEdges(
  graph: LotteryKnowledgeGraph,
  sourceId: string,
  relation?: KnowledgeRelationType
): KnowledgeEdge[] {
  return graph.edges.filter(
    (e) => e.sourceId === sourceId && (relation === undefined || e.relation === relation)
  );
}

export function getInEdges(
  graph: LotteryKnowledgeGraph,
  targetId: string,
  relation?: KnowledgeRelationType
): KnowledgeEdge[] {
  return graph.edges.filter(
    (e) => e.targetId === targetId && (relation === undefined || e.relation === relation)
  );
}

export function getTargetNodes(
  graph: LotteryKnowledgeGraph,
  sourceId: string,
  relation?: KnowledgeRelationType
): KnowledgeNode[] {
  const targetIds = new Set(getOutEdges(graph, sourceId, relation).map((e) => e.targetId));
  return graph.nodes.filter((n) => targetIds.has(n.id));
}

export function getSourceNodes(
  graph: LotteryKnowledgeGraph,
  targetId: string,
  relation?: KnowledgeRelationType
): KnowledgeNode[] {
  const sourceIds = new Set(getInEdges(graph, targetId, relation).map((e) => e.sourceId));
  return graph.nodes.filter((n) => sourceIds.has(n.id));
}

/**
 * Finds all directed paths between two node IDs up to a maximum depth.
 */
export function findPaths(
  graph: LotteryKnowledgeGraph,
  startId: string,
  endId: string,
  maxDepth = 10
): string[][] {
  const results: string[][] = [];
  const adjacency = new Map<string, string[]>();

  for (const edge of graph.edges) {
    const list = adjacency.get(edge.sourceId) || [];
    list.push(edge.targetId);
    adjacency.set(edge.sourceId, list);
  }

  function dfs(currentId: string, path: string[], visited: Set<string>): void {
    if (path.length > maxDepth) return;
    if (currentId === endId) {
      results.push([...path]);
      return;
    }
    const neighbors = adjacency.get(currentId) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        path.push(neighbor);
        dfs(neighbor, path, visited);
        path.pop();
        visited.delete(neighbor);
      }
    }
  }

  const initialVisited = new Set<string>([startId]);
  dfs(startId, [startId], initialVisited);
  return results;
}

// ============================================================================
// Graph Validator
// ============================================================================

export function validateLotteryKnowledgeGraph(graph: LotteryKnowledgeGraph): void {
  if (!graph || typeof graph !== "object") {
    throw new KnowledgeGraphValidationError("Graph must be an object", "MALFORMED_GRAPH");
  }

  if (!graph.documentSha256 || typeof graph.documentSha256 !== "string") {
    throw new KnowledgeGraphValidationError(
      "Graph documentSha256 must be a non-empty string",
      "MISSING_DOCUMENT_SHA256"
    );
  }

  if (!Array.isArray(graph.nodes) || graph.nodes.length === 0) {
    throw new KnowledgeGraphValidationError(
      "Graph nodes must be a non-empty array",
      "EMPTY_NODES"
    );
  }

  if (!Array.isArray(graph.edges)) {
    throw new KnowledgeGraphValidationError(
      "Graph edges must be an array",
      "INVALID_EDGES"
    );
  }

  const nodeIds = new Set<string>();
  const nodesMap = new Map<string, KnowledgeNode>();

  for (const node of graph.nodes) {
    if (!node.id || typeof node.id !== "string") {
      throw new KnowledgeGraphValidationError("Node must have a non-empty string ID", "INVALID_NODE_ID", node);
    }
    if (nodeIds.has(node.id)) {
      throw new KnowledgeGraphValidationError(`Duplicate node ID '${node.id}'`, "DUPLICATE_NODE_ID", node);
    }
    nodeIds.add(node.id);
    nodesMap.set(node.id, node);

    if (!node.type || typeof node.type !== "string") {
      throw new KnowledgeGraphValidationError(`Node '${node.id}' missing valid type`, "INVALID_NODE_TYPE", node);
    }
    if (!node.properties || typeof node.properties !== "object") {
      throw new KnowledgeGraphValidationError(`Node '${node.id}' properties must be an object`, "INVALID_NODE_PROPERTIES", node);
    }

    // Number string invariant check
    if (node.type === "WinningNumber") {
      const numStr = node.properties.canonicalNumber;
      if (typeof numStr !== "string" || !/^\d+$/.test(numStr)) {
        throw new KnowledgeGraphValidationError(
          `WinningNumber node '${node.id}' must have string digits for canonicalNumber, received: ${String(numStr)}`,
          "INVALID_WINNING_NUMBER_STRING",
          node
        );
      }
    }
  }

  const edgeIds = new Set<string>();
  for (const edge of graph.edges) {
    if (!edge.id || typeof edge.id !== "string") {
      throw new KnowledgeGraphValidationError("Edge must have a non-empty string ID", "INVALID_EDGE_ID", edge);
    }
    if (edgeIds.has(edge.id)) {
      throw new KnowledgeGraphValidationError(`Duplicate edge ID '${edge.id}'`, "DUPLICATE_EDGE_ID", edge);
    }
    edgeIds.add(edge.id);

    const source = nodesMap.get(edge.sourceId);
    if (!source) {
      throw new KnowledgeGraphValidationError(
        `Edge '${edge.id}' sourceId '${edge.sourceId}' does not exist in graph nodes`,
        "DANGLING_EDGE_SOURCE",
        edge
      );
    }
    if (source.type !== edge.sourceType) {
      throw new KnowledgeGraphValidationError(
        `Edge '${edge.id}' sourceType '${edge.sourceType}' does not match source node type '${source.type}'`,
        "TYPE_MISMATCH_SOURCE",
        edge
      );
    }

    const target = nodesMap.get(edge.targetId);
    if (!target) {
      throw new KnowledgeGraphValidationError(
        `Edge '${edge.id}' targetId '${edge.targetId}' does not exist in graph nodes`,
        "DANGLING_EDGE_TARGET",
        edge
      );
    }
    if (target.type !== edge.targetType) {
      throw new KnowledgeGraphValidationError(
        `Edge '${edge.id}' targetType '${edge.targetType}' does not match target node type '${target.type}'`,
        "TYPE_MISMATCH_TARGET",
        edge
      );
    }

    if (!edge.provenance || !edge.provenance.documentSha256 || !edge.provenance.parserRule) {
      throw new KnowledgeGraphValidationError(
        `Edge '${edge.id}' missing required provenance fields (documentSha256, parserRule)`,
        "MISSING_EDGE_PROVENANCE",
        edge
      );
    }
  }

  // Document node verification
  const docNodeId = getDocumentNodeId(graph.documentSha256);
  const docNode = nodesMap.get(docNodeId);
  if (!docNode || docNode.type !== "SourceDocument") {
    throw new KnowledgeGraphValidationError(
      `Root SourceDocument node '${docNodeId}' not found in graph`,
      "MISSING_ROOT_DOCUMENT_NODE"
    );
  }
}
