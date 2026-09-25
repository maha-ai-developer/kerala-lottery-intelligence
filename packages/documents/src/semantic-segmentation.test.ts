/**
 * Milestone 3D: Semantic Document Classification & Region Segmentation Unit Tests
 *
 * Verifies all required 3D invariants:
 * 1. LOTTERY_RESULT classification.
 * 2. Non-matching document classification.
 * 3. Header region detection.
 * 4. Draw metadata region detection.
 * 5. Prize structure region detection.
 * 6. Certification region detection.
 * 7. Legal/footer region detection.
 * 8. Draw number extraction.
 * 9. Draw date extraction.
 * 10. Lottery name extraction.
 * 11. Provenance preservation.
 * 12. Deterministic repeat execution.
 * 13. Idempotent persistence if semantic observations are persisted.
 */

import { describe, it, expect } from "vitest";
import type { DocumentPage, TextBlock } from "@kerala-lottery/domain";
import {
  classifyDocumentPages,
  extractDrawMetadata,
  segmentDocumentRegions,
  DocumentSemanticSegmentationService,
  DEFAULT_SEMANTIC_VERSION,
  RULE_CLASSIFICATION_HEADER,
  RULE_CLASSIFICATION_DRAW_HEADING,
  RULE_DRAW_METADATA_REGEX
} from "./semantic-segmentation";
import { InMemoryDocumentSegmentationRepository } from "@kerala-lottery/data";

const TEST_SHA256 = "9bc76b6017edb26d3c13d415cd96280f4a2f066d24c41ce7a82b39b44dee557c";

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

function createLotteryDocumentFixture(): DocumentPage[] {
  // Page 1: Header, Draw Metadata, Prize Structure
  const page1Blocks: TextBlock[] = [
    createBlock(0, "KERALA STATE LOTTERIES - RESULT", 150, 750, 250, 14, 77),
    createBlock(1, "www.statelottery.kerala.gov.in PHONE:- 0471-2305230 DIRECTOR:- 0471-2305193", 56, 723, 360, 9, 108),
    createBlock(2, "www.kerala.gov.in OFFICE:- 0471-2301740 EMAIL:- cru.dir.lotteries@kerala.gov.in", 56, 709, 410, 9, 123),
    createBlock(3, "DHANALEKSHMI LOTTERY NO.DL-40th DRAW held on:- 18/02/2026,3:00 PM", 114, 695, 388, 10, 136),
    createBlock(4, "AT GORKY BHAVAN, NEAR BAKERY JUNCTION, THIRUVANANTHAPURAM", 102, 666, 362, 10, 165),
    createBlock(5, "1st Prize Rs :10000000/- 1) DW 809210 (ERNAKULAM)", 57, 632, 364, 11, 198),
    createBlock(6, "Cons Prize-Rs :5000/- DN 809210 DO 809210 DP 809210", 57, 605, 502, 11, 225),
    createBlock(7, "2nd Prize Rs :3000000/- 1) DO 503175 (PALAKKAD)", 57, 526, 349, 11, 304),
    createBlock(8, "18/02/2026 16:36:50 Modernization & IT Software Division : Department of State Lotteries Page 1", 50, 11, 400, 8, 822)
  ];

  // Page 2: Intermediate Prize Structure
  const page2Blocks: TextBlock[] = [
    createBlock(0, "1905 1918 2203 2470 2587", 268, 807, 260, 11, 23),
    createBlock(1, "2812 3118 3732 3753 3859", 268, 781, 260, 11, 49),
    createBlock(2, "18/02/2026 16:36:50 Modernization & IT Software Division : Department of State Lotteries Page 2", 50, 11, 400, 8, 822)
  ];

  // Page 3: Final Page: Prize Structure continuation, Legal Notice, Certification
  const page3Blocks: TextBlock[] = [
    createBlock(0, "9718 9749 9810 9850 9856", 268, 807, 260, 11, 23),
    createBlock(1, "9884 9889 9970", 268, 781, 144, 11, 49),
    createBlock(2, "The prize winners are advised to verify the winning numbers with the results published in the Kerala", 105, 737, 453, 10, 94),
    createBlock(3, "Government Gazette and surrender the winning tickets within 90 days.", 105, 723, 400, 10, 108),
    createBlock(4, "Sd/-", 200, 709, 30, 10, 122),
    createBlock(5, "RAJKAPOOR", 200, 694, 80, 10, 137),
    createBlock(6, "Joint Director", 200, 680, 70, 10, 151),
    createBlock(7, "Next DHANALEKSHMI Draw will be held on 25/02/2026 Directorate Of State Lotteries ,Thiruvananthapuram", 100, 666, 400, 10, 165),
    createBlock(8, "at GORKY BHAVAN, NEAR BAKERY JUNCTION, THIRUVANANTHAPURAM", 100, 652, 350, 10, 179),
    createBlock(9, "18/02/2026 16:36:50 Modernization & IT Software Division : Department of State Lotteries Page 3", 50, 11, 400, 8, 822)
  ];

  return [
    {
      id: `${TEST_SHA256}_1`,
      documentSha256: TEST_SHA256,
      pageNumber: 1,
      pageCount: 3,
      extractionMethod: "pdfjs-dist/v4-layout",
      extractionVersion: "v1.0.0-text-layout",
      extractionStatus: "MIXED",
      text: page1Blocks.map((b) => b.text).join("\n"),
      textBlocks: page1Blocks,
      pageWidth: 595.28,
      pageHeight: 841.89,
      unit: "pt",
      hasImages: true,
      createdAt: "2026-09-25T10:00:00Z",
      updatedAt: "2026-09-25T10:00:00Z"
    },
    {
      id: `${TEST_SHA256}_2`,
      documentSha256: TEST_SHA256,
      pageNumber: 2,
      pageCount: 3,
      extractionMethod: "pdfjs-dist/v4-layout",
      extractionVersion: "v1.0.0-text-layout",
      extractionStatus: "TEXT_LAYER",
      text: page2Blocks.map((b) => b.text).join("\n"),
      textBlocks: page2Blocks,
      pageWidth: 595.28,
      pageHeight: 841.89,
      unit: "pt",
      hasImages: false,
      createdAt: "2026-09-25T10:00:00Z",
      updatedAt: "2026-09-25T10:00:00Z"
    },
    {
      id: `${TEST_SHA256}_3`,
      documentSha256: TEST_SHA256,
      pageNumber: 3,
      pageCount: 3,
      extractionMethod: "pdfjs-dist/v4-layout",
      extractionVersion: "v1.0.0-text-layout",
      extractionStatus: "TEXT_LAYER",
      text: page3Blocks.map((b) => b.text).join("\n"),
      textBlocks: page3Blocks,
      pageWidth: 595.28,
      pageHeight: 841.89,
      unit: "pt",
      hasImages: false,
      createdAt: "2026-09-25T10:00:00Z",
      updatedAt: "2026-09-25T10:00:00Z"
    }
  ];
}

function createNonMatchingDocumentFixture(): DocumentPage[] {
  const otherSha = "1111111111111111111111111111111111111111111111111111111111111111";
  const blocks: TextBlock[] = [
    createBlock(0, "KERALA PAPER LOTTERIES (REGULATION) RULES, 2005", 100, 750, 400, 12, 50),
    createBlock(1, "Section 1: Short title and commencement.", 100, 720, 300, 10, 80),
    createBlock(2, "These rules may be called the Kerala Paper Lotteries Rules.", 100, 700, 400, 10, 100)
  ];

  return [
    {
      id: `${otherSha}_1`,
      documentSha256: otherSha,
      pageNumber: 1,
      pageCount: 1,
      extractionMethod: "pdfjs-dist/v4-layout",
      extractionVersion: "v1.0.0-text-layout",
      extractionStatus: "TEXT_LAYER",
      text: blocks.map((b) => b.text).join("\n"),
      textBlocks: blocks,
      pageWidth: 595.28,
      pageHeight: 841.89,
      unit: "pt",
      hasImages: false,
      createdAt: "2026-09-25T10:00:00Z",
      updatedAt: "2026-09-25T10:00:00Z"
    }
  ];
}

describe("Milestone 3D — Semantic Document Classification & Region Segmentation", () => {
  const service = new DocumentSemanticSegmentationService();

  // 1. LOTTERY_RESULT classification
  it("1. classifies official result document as LOTTERY_RESULT with deterministic evidence", () => {
    const pages = createLotteryDocumentFixture();
    const classification = classifyDocumentPages(pages);

    expect(classification.kind).toBe("LOTTERY_RESULT");
    expect(classification.confidence).toBe(1.0);
    expect(classification.documentSha256).toBe(TEST_SHA256);
    expect(classification.evidence.length).toBeGreaterThanOrEqual(2);
    expect(classification.evidence.some((e) => e.ruleId === RULE_CLASSIFICATION_HEADER)).toBe(true);
    expect(classification.evidence.some((e) => e.ruleId === RULE_CLASSIFICATION_DRAW_HEADING)).toBe(true);
  });

  // 2. Non-matching document classification
  it("2. classifies non-matching document as UNCLASSIFIED without probabilistic hallucination", () => {
    const nonMatchingPages = createNonMatchingDocumentFixture();
    const classification = classifyDocumentPages(nonMatchingPages);

    expect(classification.kind).toBe("UNCLASSIFIED");
    expect(classification.confidence).toBe(0);
    expect(classification.evidence.length).toBe(0);
  });

  // 3. Header region detection
  it("3. detects HEADER region on page 1 with accurate bounding box and member blocks", () => {
    const pages = createLotteryDocumentFixture();
    const classification = classifyDocumentPages(pages);
    const regions = segmentDocumentRegions(pages, classification);

    const header = regions.find((r) => r.pageNumber === 1 && r.type === "HEADER");
    expect(header).toBeDefined();
    expect(header?.textBlockOrders).toEqual([0, 1, 2]);
    expect(header?.boundingBox.x).toBe(56);
    expect(header?.boundingBox.unit).toBe("pt");
    expect(header?.confidence).toBe(1.0);
    expect(header?.summaryText).toContain("KERALA STATE LOTTERIES - RESULT");
  });

  // 4. Draw metadata region detection
  it("4. detects DRAW_METADATA region on page 1 containing lottery announcement blocks", () => {
    const pages = createLotteryDocumentFixture();
    const classification = classifyDocumentPages(pages);
    const regions = segmentDocumentRegions(pages, classification);

    const drawMetaRegion = regions.find((r) => r.pageNumber === 1 && r.type === "DRAW_METADATA");
    expect(drawMetaRegion).toBeDefined();
    expect(drawMetaRegion?.textBlockOrders).toEqual([3, 4]);
    expect(drawMetaRegion?.confidence).toBe(1.0);
    expect(drawMetaRegion?.summaryText).toContain("DHANALEKSHMI LOTTERY NO.DL-40th DRAW");
  });

  // 5. Prize structure region detection
  it("5. detects PRIZE_STRUCTURE regions across pages preserving member blocks", () => {
    const pages = createLotteryDocumentFixture();
    const classification = classifyDocumentPages(pages);
    const regions = segmentDocumentRegions(pages, classification);

    const p1Prize = regions.find((r) => r.pageNumber === 1 && r.type === "PRIZE_STRUCTURE");
    expect(p1Prize).toBeDefined();
    expect(p1Prize?.textBlockOrders).toEqual([5, 6, 7]);

    const p2Prize = regions.find((r) => r.pageNumber === 2 && r.type === "PRIZE_STRUCTURE");
    expect(p2Prize).toBeDefined();
    expect(p2Prize?.textBlockOrders).toEqual([0, 1]);

    const p3Prize = regions.find((r) => r.pageNumber === 3 && r.type === "PRIZE_STRUCTURE");
    expect(p3Prize).toBeDefined();
    expect(p3Prize?.textBlockOrders).toEqual([0, 1]);
  });

  // 6. Certification region detection
  it("6. detects CERTIFICATION region on final page including official signatory blocks", () => {
    const pages = createLotteryDocumentFixture();
    const classification = classifyDocumentPages(pages);
    const regions = segmentDocumentRegions(pages, classification);

    const cert = regions.find((r) => r.pageNumber === 3 && r.type === "CERTIFICATION");
    expect(cert).toBeDefined();
    expect(cert?.textBlockOrders).toEqual([4, 5, 6, 7, 8]);
    expect(cert?.summaryText).toContain("Sd/-");
    expect(cert?.summaryText).toContain("RAJKAPOOR");
    expect(cert?.summaryText).toContain("Joint Director");
  });

  // 7. Legal/footer region detection
  it("7. detects LEGAL_CLAIMS_FOOTER region on final page covering statutory surrender notice", () => {
    const pages = createLotteryDocumentFixture();
    const classification = classifyDocumentPages(pages);
    const regions = segmentDocumentRegions(pages, classification);

    const legal = regions.find((r) => r.pageNumber === 3 && r.type === "LEGAL_CLAIMS_FOOTER");
    expect(legal).toBeDefined();
    expect(legal?.textBlockOrders).toEqual([2, 3]);
    expect(legal?.summaryText).toContain("The prize winners are advised to verify");
    expect(legal?.summaryText).toContain("within 90 days");
  });

  // 8. Draw number extraction
  it("8. deterministically extracts draw number with full provenance", () => {
    const pages = createLotteryDocumentFixture();
    const classification = classifyDocumentPages(pages);
    const metadata = extractDrawMetadata(pages, classification);

    expect(metadata?.drawNumber).toBeDefined();
    expect(metadata?.drawNumber?.value).toBe("DL-40th");
    expect(metadata?.drawNumber?.sourcePageNumber).toBe(1);
    expect(metadata?.drawNumber?.textBlockOrder).toBe(3);
    expect(metadata?.drawNumber?.ruleId).toBe(RULE_DRAW_METADATA_REGEX);
  });

  // 9. Draw date extraction
  it("9. deterministically extracts draw date and optional draw time", () => {
    const pages = createLotteryDocumentFixture();
    const classification = classifyDocumentPages(pages);
    const metadata = extractDrawMetadata(pages, classification);

    expect(metadata?.drawDate).toBeDefined();
    expect(metadata?.drawDate?.value).toBe("18/02/2026");
    expect(metadata?.drawTime?.value).toBe("3:00 PM");
  });

  // 10. Lottery name extraction
  it("10. deterministically extracts lottery name", () => {
    const pages = createLotteryDocumentFixture();
    const classification = classifyDocumentPages(pages);
    const metadata = extractDrawMetadata(pages, classification);

    expect(metadata?.lotteryName).toBeDefined();
    expect(metadata?.lotteryName?.value).toBe("DHANALEKSHMI");
    expect(metadata?.location?.value).toContain("GORKY BHAVAN");
  });

  // 11. Provenance preservation
  it("11. ensures all semantic fields and regions preserve traceable link to source SHA-256 and page IDs", () => {
    const pages = createLotteryDocumentFixture();
    const segmentation = service.segmentDocument(pages);

    expect(segmentation.documentSha256).toBe(TEST_SHA256);
    expect(segmentation.id).toBe(TEST_SHA256);
    expect(segmentation.semanticVersion).toBe(DEFAULT_SEMANTIC_VERSION);
    expect(segmentation.extractionVersion).toBe("v1.0.0-text-layout");

    for (const r of segmentation.regions) {
      expect(r.documentSha256).toBe(TEST_SHA256);
      expect(r.pageId).toBe(`${TEST_SHA256}_${r.pageNumber}`);
      expect(r.textBlockOrders.length).toBeGreaterThan(0);
    }

    if (segmentation.drawMetadata?.lotteryName) {
      const ln = segmentation.drawMetadata.lotteryName;
      expect(ln.sourceDocumentSha256).toBe(TEST_SHA256);
      expect(ln.sourcePageId).toBe(`${TEST_SHA256}_1`);
      expect(ln.sourcePageNumber).toBe(1);
    }
  });

  // 12. Deterministic repeat execution
  it("12. produces identical results when executed multiple times on the same input", () => {
    const pages = createLotteryDocumentFixture();
    const fixedTimestamp = "2026-09-25T11:00:00Z";

    const seg1 = service.segmentDocument(pages, { createdAt: fixedTimestamp });
    const seg2 = service.segmentDocument(pages, { createdAt: fixedTimestamp });

    expect(JSON.stringify(seg1)).toBe(JSON.stringify(seg2));
  });

  // 13. Idempotent persistence if semantic observations are persisted
  it("13. idempotently saves and retrieves semantic segmentation records", async () => {
    const pages = createLotteryDocumentFixture();
    const repo = new InMemoryDocumentSegmentationRepository();
    const segmentation = service.segmentDocument(pages, { createdAt: "2026-09-25T11:00:00Z" });

    // Save first time
    await repo.save(segmentation);
    const retrieved1 = await repo.getByDocumentSha256(TEST_SHA256);
    expect(retrieved1).toBeDefined();
    expect(retrieved1?.id).toBe(TEST_SHA256);
    expect(retrieved1?.regions.length).toBe(segmentation.regions.length);

    // Save second time (idempotent write)
    await repo.save(segmentation);
    const retrieved2 = await repo.getByDocumentSha256(TEST_SHA256);
    expect(retrieved2).toEqual(retrieved1);
  });
});
