import { describe, it, expect, beforeEach } from "vitest";
import type { DocumentPage, TextBlock } from "@kerala-lottery/domain";
import {
  DocumentSemanticSegmentationService,
  extractLotteryEntitiesFromDocument
} from "@kerala-lottery/documents";
import {
  buildLotteryKnowledgeGraph,
  LotteryKnowledgeGraphBuilder,
  validateLotteryKnowledgeGraph,
  KnowledgeGraphValidationError,
  getNode,
  getOutEdges,
  getInEdges,
  getTargetNodes,
  getSourceNodes,
  findPaths,
  InMemoryKnowledgeGraphRepository,
  getDocumentNodeId,
  getLotteryNodeId,
  getDrawNodeId,
  getPrizeTierNodeId,
  getWinningResultNodeId,
  getSeriesNodeId,
  getWinningNumberNodeId,
  getKnowledgeEdgeId
} from "./index";

const CANONICAL_SHA256 =
  "9bc76b6017edb26d3c13d415cd96280f4a2f066d24c41ce7a82b39b44dee557c";

function createBlock(
  order: number,
  text: string,
  x = 100,
  y = 700,
  width = 300,
  height = 12,
  top = 100
): TextBlock {
  return { order, text, x, y, width, height, top, fontName: "f1", fontSize: 10 };
}

function createCanonical4PageDocumentFixture(): DocumentPage[] {
  // Page 1: Header, Draw Metadata, 1st to 7th Prizes
  const page1Blocks: TextBlock[] = [
    createBlock(0, "KERALA STATE LOTTERIES - RESULT", 150, 750, 250, 14, 77),
    createBlock(1, "www.statelottery.kerala.gov.in PHONE:- 0471-2305230 DIRECTOR:- 0471-2305193", 56, 723, 360, 9, 108),
    createBlock(2, "www.kerala.gov.in OFFICE:- 0471-2301740 EMAIL:- cru.dir.lotteries@kerala.gov.in", 56, 709, 410, 9, 123),
    createBlock(3, "DHANALEKSHMI LOTTERY NO.DL-40th DRAW held on:- 18/02/2026,3:00 PM", 114, 695, 388, 10, 136),
    createBlock(4, "AT GORKY BHAVAN, NEAR BAKERY JUNCTION, THIRUVANANTHAPURAM", 102, 666, 362, 10, 165),
    createBlock(5, "1st Prize Rs :10000000/- 1) DW 809210 (ERNAKULAM)", 57, 632, 364, 11, 198),
    createBlock(6, "Cons Prize-Rs :5000/- DN 809210 DO 809210 DP 809210 DR 809210 DS 809210", 57, 605, 502, 11, 225),
    createBlock(7, "DT 809210 DU 809210 DV 809210 DX 809210 DY 809210", 57, 579, 502, 11, 251),
    createBlock(8, "DZ 809210", 57, 552, 100, 11, 278),
    createBlock(9, "2nd Prize Rs :3000000/- 1) DO 503175 (PALAKKAD)", 57, 526, 349, 11, 304),
    createBlock(10, "3rd Prize Rs :500000/- 1) DX 475553 (ERNAKULAM)", 57, 500, 350, 11, 330),
    createBlock(11, "FOR THE TICKETS ENDING WITH THE FOLLOWING NUMBERS", 57, 473, 400, 10, 357),
    createBlock(12, "4th Prize-Rs :5000/- 0259 0375 0497 0701 2709", 57, 447, 400, 11, 383),
    createBlock(13, "3083 3362 4165 4255 5063", 57, 420, 300, 11, 410),
    createBlock(14, "5343 5347 5690 6421 6767", 57, 394, 300, 11, 436),
    createBlock(15, "6815 7800 9133 9626", 57, 368, 250, 11, 462),
    createBlock(16, "5th Prize-Rs :2000/- 2072 3709 6776 7476 7685", 57, 341, 400, 11, 489),
    createBlock(17, "9941", 57, 315, 60, 11, 515),
    createBlock(18, "6th Prize-Rs :1000/- 0273 0798 1084 1133 1629", 57, 288, 400, 11, 542),
    createBlock(19, "2962 3301 3523 3621 3992", 57, 262, 300, 11, 568),
    createBlock(20, "4581 4704 5125 5169 5217", 57, 236, 300, 11, 594),
    createBlock(21, "5505 5742 5766 6316 6332", 57, 209, 300, 11, 621),
    createBlock(22, "7023 7707 9141 9219 9281", 57, 183, 300, 11, 647),
    createBlock(23, "7th Prize-Rs :500/- 0191 0243 0535 0592 0603", 57, 156, 400, 11, 674),
    createBlock(24, "0636 0790 0833 0858 0887", 57, 130, 300, 11, 700),
    createBlock(25, "0978 1278 1439 1552 1598", 57, 104, 300, 11, 726),
    createBlock(26, "1671 1722 1786 1794 1882", 57, 77, 300, 11, 753),
    createBlock(27, "18/02/2026 16:36:50 Modernization & IT Software Division : Department of State Lotteries Page 1", 50, 11, 400, 8, 822)
  ];

  // Page 2: Intermediate Page 8th Prize numbers
  const page2Blocks: TextBlock[] = [
    createBlock(0, "8th Prize-Rs :100/- 0081 0134 0154 0212 0262", 57, 807, 400, 11, 23),
    createBlock(1, "0304 0352 0463 0511 0549", 57, 781, 300, 11, 49),
    createBlock(2, "18/02/2026 16:36:50 Modernization & IT Software Division : Department of State Lotteries Page 2", 50, 11, 400, 8, 822)
  ];

  // Page 3: Intermediate Page 8th Prize numbers continuation
  const page3Blocks: TextBlock[] = [
    createBlock(0, "5012 5143 5298 5410 5582", 57, 807, 300, 11, 23),
    createBlock(1, "5674 5789 5890 5912 6023", 57, 781, 300, 11, 49),
    createBlock(2, "18/02/2026 16:36:50 Modernization & IT Software Division : Department of State Lotteries Page 3", 50, 11, 400, 8, 822)
  ];

  // Page 4: Final Page: 8th Prize completion, Legal Claims Footer, Certification
  const page4Blocks: TextBlock[] = [
    createBlock(0, "9718 9749 9810 9850 9856", 268, 807, 260, 11, 23),
    createBlock(1, "9884 9889 9970", 268, 781, 144, 11, 49),
    createBlock(2, "The prize winners are advised to verify the winning numbers with the results published in the Kerala", 105, 737, 453, 10, 94),
    createBlock(3, "Government Gazette and surrender the winning tickets within 90 days.", 105, 723, 400, 10, 108),
    createBlock(4, "Sd/-", 200, 709, 30, 10, 122),
    createBlock(5, "RAJKAPOOR", 200, 694, 80, 10, 137),
    createBlock(6, "Joint Director", 200, 680, 70, 10, 151),
    createBlock(7, "Next DHANALEKSHMI Draw will be held on 25/02/2026 Directorate Of State Lotteries ,Thiruvananthapuram", 100, 666, 400, 10, 165),
    createBlock(8, "at GORKY BHAVAN, NEAR BAKERY JUNCTION,", 100, 652, 350, 10, 179),
    createBlock(9, "THIRUVANANTHAPURAM", 100, 638, 200, 10, 193),
    createBlock(10, "18/02/2026 16:36:50 Modernization & IT Software Division : Department of State Lotteries Page 4", 50, 11, 400, 8, 822)
  ];

  const makePage = (num: number, blocks: TextBlock[]): DocumentPage => ({
    id: `${CANONICAL_SHA256}_${num}`,
    documentSha256: CANONICAL_SHA256,
    pageNumber: num,
    pageCount: 4,
    extractionMethod: "pdfjs-dist/v4-layout",
    extractionVersion: "v1.0.0-text-layout",
    extractionStatus: "TEXT_LAYER",
    text: blocks.map((b) => b.text).join("\n"),
    textBlocks: blocks,
    pageWidth: 595.28,
    pageHeight: 841.89,
    unit: "pt",
    hasImages: num === 1,
    createdAt: "2026-09-25T10:00:00Z",
    updatedAt: "2026-09-25T10:00:00Z"
  });

  return [
    makePage(1, page1Blocks),
    makePage(2, page2Blocks),
    makePage(3, page3Blocks),
    makePage(4, page4Blocks)
  ];
}

describe("Milestone 4A: Knowledge Graph Foundation", () => {
  let pages: DocumentPage[];
  let segmentationService: DocumentSemanticSegmentationService;
  let segmentation: ReturnType<DocumentSemanticSegmentationService["segmentDocument"]>;
  let extractionResult: ReturnType<typeof extractLotteryEntitiesFromDocument>;

  beforeEach(() => {
    pages = createCanonical4PageDocumentFixture();
    segmentationService = new DocumentSemanticSegmentationService();
    segmentation = segmentationService.segmentDocument(pages);
    extractionResult = extractLotteryEntitiesFromDocument(segmentation, pages);
  });

  it("1. builds complete canonical knowledge graph with all 7 entity types", () => {
    const builder = new LotteryKnowledgeGraphBuilder();
    const graph = builder.build(extractionResult, segmentation);

    expect(graph.documentSha256).toBe(CANONICAL_SHA256);
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.edges.length).toBeGreaterThan(0);

    const entityTypes = new Set(graph.nodes.map((n) => n.type));
    expect(entityTypes.has("SourceDocument")).toBe(true);
    expect(entityTypes.has("Lottery")).toBe(true);
    expect(entityTypes.has("Draw")).toBe(true);
    expect(entityTypes.has("PrizeTier")).toBe(true);
    expect(entityTypes.has("WinningResult")).toBe(true);
    expect(entityTypes.has("Series")).toBe(true);
    expect(entityTypes.has("WinningNumber")).toBe(true);
  });

  it("2. enforces canonical chain: Document -> Lottery -> Draw -> PrizeTier -> WinningResult", () => {
    const graph = buildLotteryKnowledgeGraph(extractionResult, segmentation);

    // Root Document node
    const docNodeId = getDocumentNodeId(CANONICAL_SHA256);
    const docNode = getNode(graph, docNodeId);
    expect(docNode).toBeDefined();
    expect(docNode?.type).toBe("SourceDocument");

    // Document -> Lottery
    const lotteryEdges = getOutEdges(graph, docNodeId, "HAS_LOTTERY");
    expect(lotteryEdges.length).toBe(1);
    const expectedLotteryId = getLotteryNodeId("DHANALEKSHMI");
    const lotteryNodeId = lotteryEdges[0]!.targetId;
    expect(lotteryNodeId).toBe(expectedLotteryId);

    // Test getKnowledgeEdgeId generator
    const expectedEdgeId = getKnowledgeEdgeId("HAS_LOTTERY", docNodeId, lotteryNodeId);
    expect(lotteryEdges[0]!.id).toBe(expectedEdgeId);

    // Traversal: getTargetNodes and getSourceNodes
    const targetLotteryNodes = getTargetNodes(graph, docNodeId, "HAS_LOTTERY");
    expect(targetLotteryNodes.length).toBe(1);
    expect(targetLotteryNodes[0]!.id).toBe(lotteryNodeId);

    const sourceDocNodes = getSourceNodes(graph, lotteryNodeId, "HAS_LOTTERY");
    expect(sourceDocNodes.length).toBe(1);
    expect(sourceDocNodes[0]!.id).toBe(docNodeId);

    const inDocEdges = getInEdges(graph, lotteryNodeId, "HAS_LOTTERY");
    expect(inDocEdges.length).toBe(1);
    expect(inDocEdges[0]!.sourceId).toBe(docNodeId);

    const lotteryNode = getNode(graph, lotteryNodeId);
    expect(lotteryNode?.type).toBe("Lottery");
    expect(lotteryNode?.properties.code).toBe("DHANALEKSHMI");

    // Lottery -> Draw
    const drawEdges = getOutEdges(graph, lotteryNodeId, "HAS_DRAW");
    expect(drawEdges.length).toBe(1);
    const drawNodeId = drawEdges[0]!.targetId;
    const drawNode = getNode(graph, drawNodeId);
    expect(drawNode?.type).toBe("Draw");
    expect(drawNode?.properties.drawNumber).toBe("DL-40th");

    // Draw -> PrizeTiers
    const tierEdges = getOutEdges(graph, drawNodeId, "HAS_PRIZE_TIER");
    expect(tierEdges.length).toBe(extractionResult.prizeTiers.length);

    // PrizeTier -> WinningResults
    for (const tierEdge of tierEdges) {
      const tierId = tierEdge.targetId;
      const expectedTierId = getPrizeTierNodeId(tierId);
      expect(tierId).toBe(expectedTierId);

      const resultEdges = getOutEdges(graph, tierId, "HAS_WINNING_RESULT");
      expect(resultEdges.length).toBeGreaterThan(0);
      for (const resEdge of resultEdges) {
        const expectedResultId = getWinningResultNodeId(resEdge.targetId);
        expect(resEdge.targetId).toBe(expectedResultId);

        const resNode = getNode(graph, resEdge.targetId);
        expect(resNode?.type).toBe("WinningResult");
      }
    }
  });

  it("3. handles full ticket results: connects WinningResult -> Series and Series -> WinningNumber", () => {
    const graph = buildLotteryKnowledgeGraph(extractionResult, segmentation);

    // Find 1st Prize WinningResult (DW 809210)
    const firstPrizeResults = graph.nodes.filter(
      (n) => n.type === "WinningResult" && n.properties.rank === 1
    );
    expect(firstPrizeResults.length).toBe(1);

    const firstResult = firstPrizeResults[0]!;
    expect(firstResult.properties.series).toBe("DW");
    expect(firstResult.properties.canonicalNumber).toBe("809210");
    expect(firstResult.properties.seriesStatus).toBe("PRESENT");

    // Edge: WinningResult -> Series (HAS_SERIES)
    const seriesEdges = getOutEdges(graph, firstResult.id, "HAS_SERIES");
    expect(seriesEdges.length).toBe(1);
    const seriesId = seriesEdges[0]!.targetId;
    expect(seriesId).toBe(getSeriesNodeId("DW"));

    const seriesNode = getNode(graph, seriesId);
    expect(seriesNode?.type).toBe("Series");
    expect(seriesNode?.properties.code).toBe("DW");

    // Edge: WinningResult -> WinningNumber (HAS_WINNING_NUMBER)
    const numberEdges = getOutEdges(graph, firstResult.id, "HAS_WINNING_NUMBER");
    expect(numberEdges.length).toBe(1);
    const numberId = numberEdges[0]!.targetId;
    expect(numberId).toBe(getWinningNumberNodeId("809210"));

    // Edge: Series -> WinningNumber (HAS_WINNING_NUMBER)
    const seriesToNumberEdges = getOutEdges(graph, seriesId, "HAS_WINNING_NUMBER");
    expect(seriesToNumberEdges.some((e) => e.targetId === numberId)).toBe(true);
  });

  it("4. handles suffix results: explicitly represents ABSENT_SUFFIX and forbids phantom series", () => {
    const graph = buildLotteryKnowledgeGraph(extractionResult, segmentation);

    // 4th prize is a suffix tier ("FOR THE TICKETS ENDING WITH THE FOLLOWING NUMBERS")
    const fourthPrizeResults = graph.nodes.filter(
      (n) => n.type === "WinningResult" && n.properties.rank === 4
    );
    expect(fourthPrizeResults.length).toBeGreaterThan(0);

    for (const resNode of fourthPrizeResults) {
      expect(resNode.properties.isSuffix).toBe(true);
      expect(resNode.properties.series).toBeUndefined();
      expect(resNode.properties.seriesStatus).toBe("ABSENT_SUFFIX");

      // ZERO HAS_SERIES edges for suffix result
      const seriesEdges = getOutEdges(graph, resNode.id, "HAS_SERIES");
      expect(seriesEdges.length).toBe(0);

      // Direct edge to WinningNumber
      const numberEdges = getOutEdges(graph, resNode.id, "HAS_WINNING_NUMBER");
      expect(numberEdges.length).toBe(1);
      const numberNode = getNode(graph, numberEdges[0]!.targetId);
      expect(numberNode?.type).toBe("WinningNumber");
    }
  });

  it("5. strictly preserves string canonical numbers with leading zeros", () => {
    const graph = buildLotteryKnowledgeGraph(extractionResult, segmentation);

    // Sample known numbers with leading zero in 4th/8th prizes: "0259", "0375", "0081", "0134"
    const zeroPrefixed = ["0259", "0375", "0497", "0701", "0081", "0134"];

    for (const canonical of zeroPrefixed) {
      const numberNodeId = getWinningNumberNodeId(canonical);
      const node = getNode(graph, numberNodeId);

      expect(node).toBeDefined();
      expect(node?.type).toBe("WinningNumber");
      expect(node?.properties.canonicalNumber).toBe(canonical);
      expect(typeof node?.properties.canonicalNumber).toBe("string");
      // Must not have lost leading zero
      expect((node?.properties.canonicalNumber as string).startsWith("0")).toBe(true);
    }
  });

  it("6. preserves complete source document provenance on every node and edge", () => {
    const graph = buildLotteryKnowledgeGraph(extractionResult, segmentation);

    // Verify all nodes have provenance
    for (const node of graph.nodes) {
      expect(node.provenance).toBeDefined();
      expect(node.provenance?.documentSha256).toBe(CANONICAL_SHA256);
      expect(node.provenance?.parserRule).toBeTruthy();
      expect(typeof node.provenance?.confidence).toBe("number");
      expect(node.provenance?.confidence).toBeGreaterThanOrEqual(0);
    }

    // Verify all edges have provenance
    for (const edge of graph.edges) {
      expect(edge.provenance).toBeDefined();
      expect(edge.provenance.documentSha256).toBe(CANONICAL_SHA256);
      expect(edge.provenance.parserRule).toBeTruthy();
      expect(typeof edge.provenance.confidence).toBe("number");
      expect(edge.provenance.confidence).toBeGreaterThanOrEqual(0);
    }
  });

  it("7. produces deterministic IDs and is strictly idempotent", () => {
    const graph1 = buildLotteryKnowledgeGraph(extractionResult, segmentation);
    const graph2 = buildLotteryKnowledgeGraph(extractionResult, segmentation);

    expect(graph1.nodes.length).toBe(graph2.nodes.length);
    expect(graph1.edges.length).toBe(graph2.edges.length);

    const nodeIds1 = graph1.nodes.map((n) => n.id).sort();
    const nodeIds2 = graph2.nodes.map((n) => n.id).sort();
    expect(nodeIds1).toEqual(nodeIds2);

    const edgeIds1 = graph1.edges.map((e) => e.id).sort();
    const edgeIds2 = graph2.edges.map((e) => e.id).sort();
    expect(edgeIds1).toEqual(edgeIds2);

    // Verify no duplicates
    expect(new Set(nodeIds1).size).toBe(nodeIds1.length);
    expect(new Set(edgeIds1).size).toBe(edgeIds1.length);
  });

  it("8. explicitly represents unknown/missing lottery name and draw number without guessing", () => {
    // Clone extraction result without draw metadata
    const sparseExtraction = {
      ...extractionResult,
      drawMetadata: undefined
    };
    const sparseSegmentation = {
      ...segmentation,
      drawMetadata: undefined
    };

    const graph = buildLotteryKnowledgeGraph(sparseExtraction, sparseSegmentation);

    // Lottery node must be lottery_UNKNOWN
    const lotteryNode = getNode(graph, "lottery_UNKNOWN");
    expect(lotteryNode).toBeDefined();
    expect(lotteryNode?.properties.isUnknown).toBe(true);
    expect(lotteryNode?.properties.reason).toBe("NOT_SPECIFIED_IN_DOCUMENT");

    // Draw node must be ${sha256}_draw_UNKNOWN
    const drawNodeId = `${CANONICAL_SHA256}_draw_UNKNOWN`;
    const drawNode = getNode(graph, drawNodeId);
    expect(drawNode).toBeDefined();
    expect(drawNode?.properties.isUnknown).toBe(true);

    // Document connects to unknown lottery, which connects to unknown draw
    const docToLottery = getOutEdges(graph, getDocumentNodeId(CANONICAL_SHA256), "HAS_LOTTERY");
    expect(docToLottery[0]?.targetId).toBe("lottery_UNKNOWN");

    const lotteryToDraw = getOutEdges(graph, "lottery_UNKNOWN", "HAS_DRAW");
    expect(lotteryToDraw[0]?.targetId).toBe(drawNodeId);
  });

  it("9. validates graph structure via validateLotteryKnowledgeGraph", () => {
    const graph = buildLotteryKnowledgeGraph(extractionResult, segmentation);

    // Must pass validation
    expect(() => validateLotteryKnowledgeGraph(graph)).not.toThrow();

    // Tampering test: Duplicate node ID
    const tamperedDuplicate = {
      ...graph,
      nodes: [...graph.nodes, graph.nodes[0]!]
    };
    expect(() => validateLotteryKnowledgeGraph(tamperedDuplicate)).toThrow(KnowledgeGraphValidationError);

    // Tampering test: Dangling edge target
    const tamperedDangling = {
      ...graph,
      edges: [
        ...graph.edges,
        {
          id: "edge_dangling_test",
          sourceId: graph.nodes[0]!.id,
          sourceType: graph.nodes[0]!.type,
          targetId: "non_existent_node_id",
          targetType: "Lottery" as const,
          relation: "HAS_LOTTERY" as const,
          provenance: graph.edges[0]!.provenance,
          createdAt: new Date().toISOString()
        }
      ]
    };
    expect(() => validateLotteryKnowledgeGraph(tamperedDangling)).toThrow(KnowledgeGraphValidationError);
  });

  it("10. finds end-to-end paths from Document to WinningNumber via findPaths", () => {
    const graph = buildLotteryKnowledgeGraph(extractionResult, segmentation);

    const docId = getDocumentNodeId(CANONICAL_SHA256);
    const targetNumberId = getWinningNumberNodeId("809210");

    const paths = findPaths(graph, docId, targetNumberId);
    expect(paths.length).toBeGreaterThan(0);

    // Verify first path contains the sequence of entity IDs
    const path = paths[0]!;
    expect(path[0]).toBe(docId);
    expect(path[path.length - 1]).toBe(targetNumberId);
  });

  it("11. persists and retrieves graph via InMemoryKnowledgeGraphRepository", async () => {
    const graph = buildLotteryKnowledgeGraph(extractionResult, segmentation);
    const repo = new InMemoryKnowledgeGraphRepository();

    await repo.saveGraph(graph);

    const retrieved = await repo.getGraphByDocumentSha256(CANONICAL_SHA256);
    expect(retrieved).toBeDefined();
    expect(retrieved?.documentSha256).toBe(CANONICAL_SHA256);
    expect(retrieved?.nodes.length).toBe(graph.nodes.length);
    expect(retrieved?.edges.length).toBe(graph.edges.length);

    // Verify node queries
    const docNode = await repo.getNodeById(getDocumentNodeId(CANONICAL_SHA256));
    expect(docNode?.type).toBe("SourceDocument");

    const prizeTierNodes = await repo.getNodesByType("PrizeTier");
    expect(prizeTierNodes.length).toBe(extractionResult.prizeTiers.length);

    // Verify edge queries
    const drawToTierEdges = await repo.getEdgesBySource(
      getDrawNodeId(CANONICAL_SHA256, "DL-40th"),
      "HAS_PRIZE_TIER"
    );
    expect(drawToTierEdges.length).toBe(extractionResult.prizeTiers.length);
  });
});
