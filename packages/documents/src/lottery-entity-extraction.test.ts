import { describe, it, expect, beforeEach } from "vitest";
import type { DocumentPage, TextBlock } from "@kerala-lottery/domain";
import {
  DocumentSemanticSegmentationService,
  extractLotteryEntitiesFromDocument,
  LotteryEntityExtractorService,
  validatePrizeTier,
  validateSeries,
  validateWinningResult,
  RULE_TIER_DECLARATION,
  RULE_SERIES_EXTRACTION,
  RULE_RESULT_FULL_TICKET,
  RULE_RESULT_SUFFIX_NUMBER,
  RULE_VALIDATION_REGION,
  DEFAULT_ENTITY_PARSER_VERSION
} from "./index";
import {
  InMemoryPrizeTierRepository,
  InMemoryWinningResultRepository
} from "@kerala-lottery/data";

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

describe("Milestone 3E — Validated Lottery Entities & Provenance", () => {
  let pages: DocumentPage[];
  let segmentationService: DocumentSemanticSegmentationService;

  beforeEach(() => {
    pages = createCanonical4PageDocumentFixture();
    segmentationService = new DocumentSemanticSegmentationService();
  });

  // 1. Prize tier extraction
  it("1. Prize tier extraction: extracts explicit prize-tier labels without inferring missing tiers", () => {
    const segmentation = segmentationService.segmentDocument(pages);
    const result = extractLotteryEntitiesFromDocument(segmentation, pages);

    const tierNames = result.prizeTiers.map((t) => t.name);
    expect(tierNames).toContain("1st Prize");
    expect(tierNames).toContain("Cons Prize");
    expect(tierNames).toContain("2nd Prize");
    expect(tierNames).toContain("3rd Prize");
    expect(tierNames).toContain("4th Prize");
    expect(tierNames).toContain("5th Prize");
    expect(tierNames).toContain("6th Prize");
    expect(tierNames).toContain("7th Prize");
    expect(tierNames).toContain("8th Prize");

    // Total of 9 explicitly documented tiers in Dhanalekshmi result
    expect(result.prizeTiers).toHaveLength(9);

    // Validate tier properties
    for (const tier of result.prizeTiers) {
      expect(() => validatePrizeTier(tier)).not.toThrow();
      expect(tier.documentSha256).toBe(CANONICAL_SHA256);
      expect(tier.parserRule).toBe(RULE_TIER_DECLARATION);
      expect(tier.parserVersion).toBe(DEFAULT_ENTITY_PARSER_VERSION);
    }
  });

  // 2. Prize amount extraction
  it("2. Prize amount extraction: extracts numeric prize amounts in INR and leaves missing amounts undefined", () => {
    const segmentation = segmentationService.segmentDocument(pages);
    const result = extractLotteryEntitiesFromDocument(segmentation, pages);

    const tier1 = result.prizeTiers.find((t) => t.name === "1st Prize");
    expect(tier1?.amount).toBe(10000000);
    expect(tier1?.currency).toBe("INR");

    const consTier = result.prizeTiers.find((t) => t.name === "Cons Prize");
    expect(consTier?.amount).toBe(5000);
    expect(consTier?.currency).toBe("INR");

    const tier2 = result.prizeTiers.find((t) => t.name === "2nd Prize");
    expect(tier2?.amount).toBe(3000000);

    const tier3 = result.prizeTiers.find((t) => t.name === "3rd Prize");
    expect(tier3?.amount).toBe(500000);

    const tier4 = result.prizeTiers.find((t) => t.name === "4th Prize");
    expect(tier4?.amount).toBe(5000);

    const tier5 = result.prizeTiers.find((t) => t.name === "5th Prize");
    expect(tier5?.amount).toBe(2000);

    const tier6 = result.prizeTiers.find((t) => t.name === "6th Prize");
    expect(tier6?.amount).toBe(1000);

    const tier7 = result.prizeTiers.find((t) => t.name === "7th Prize");
    expect(tier7?.amount).toBe(500);

    const tier8 = result.prizeTiers.find((t) => t.name === "8th Prize");
    expect(tier8?.amount).toBe(100);
  });

  // 3. Winning number extraction
  it("3. Winning number extraction: extracts numeric ticket values preserving exact strings and leading zeros", () => {
    const segmentation = segmentationService.segmentDocument(pages);
    const result = extractLotteryEntitiesFromDocument(segmentation, pages);

    // 1st Prize ticket: 6 digits
    const res1 = result.winningResults.find((r) => r.prizeTierName === "1st Prize");
    expect(res1?.canonicalNumber).toBe("809210");
    expect(res1?.numberLength).toBe(6);
    expect(res1?.isSuffix).toBe(false);

    // 4th Prize suffix numbers: 4 digits with leading zeros preserved!
    const fourTiers = result.winningResults.filter((r) => r.prizeTierName === "4th Prize");
    const fourNumbers = fourTiers.map((r) => r.canonicalNumber);
    expect(fourNumbers).toContain("0259");
    expect(fourNumbers).toContain("0375");
    expect(fourNumbers).toContain("0497");
    expect(fourNumbers).toContain("0701");
    expect(fourNumbers).toContain("2709");

    // Check that "0259" was NOT converted to numeric 259 in canonicalNumber
    const leadingZeroResult = fourTiers.find((r) => r.canonicalNumber === "0259");
    expect(leadingZeroResult?.canonicalNumber).toBe("0259");
    expect(typeof leadingZeroResult?.canonicalNumber).toBe("string");
  });

  // 4. Series extraction
  it("4. Series extraction: separates 2-letter uppercase series prefixes and never invents series for suffix tiers", () => {
    const segmentation = segmentationService.segmentDocument(pages);
    const result = extractLotteryEntitiesFromDocument(segmentation, pages);

    // Series from 1st prize
    const tier1Result = result.winningResults.find((r) => r.prizeTierName === "1st Prize");
    expect(tier1Result?.series).toBe("DW");

    // Series from Consolation prize
    const consResults = result.winningResults.filter((r) => r.prizeTierName === "Cons Prize");
    const consSeries = consResults.map((r) => r.series);
    expect(consSeries).toEqual(
      expect.arrayContaining(["DN", "DO", "DP", "DR", "DS", "DT", "DU", "DV", "DX", "DY", "DZ"])
    );

    // Series entities list
    const seriesCodes = result.series.map((s) => s.code);
    expect(seriesCodes).toContain("DW");
    expect(seriesCodes).toContain("DO");
    expect(seriesCodes).toContain("DX");
    for (const s of result.series) {
      expect(() => validateSeries(s)).not.toThrow();
      expect(s.code).toMatch(/^[A-Z]{2}$/);
      expect(s.parserRule).toBe(RULE_SERIES_EXTRACTION);
    }

    // Suffix tiers MUST NOT have any series
    const suffixResults = result.winningResults.filter((r) => r.isSuffix);
    expect(suffixResults.length).toBeGreaterThan(0);
    for (const sr of suffixResults) {
      expect(sr.series).toBeUndefined();
    }
  });

  // 5. Numeric validation
  it("5. Numeric validation: ensures all accepted numbers strictly match expected formats", () => {
    const segmentation = segmentationService.segmentDocument(pages);
    const result = extractLotteryEntitiesFromDocument(segmentation, pages);

    for (const res of result.winningResults) {
      expect(() => validateWinningResult(res)).not.toThrow();
      if (res.isSuffix) {
        expect(res.canonicalNumber).toMatch(/^\d{4}$/);
        expect(res.numberLength).toBe(4);
      } else {
        expect(res.canonicalNumber).toMatch(/^\d{6}$/);
        expect(res.numberLength).toBe(6);
        expect(res.series).toMatch(/^[A-Z]{2}$/);
      }
    }
  });

  // 6. Region restriction
  it("6. Region restriction: extracts numbers ONLY from PRIZE_STRUCTURE regions and rejects candidates in other regions", () => {
    const segmentation = segmentationService.segmentDocument(pages);
    const result = extractLotteryEntitiesFromDocument(segmentation, pages);

    // Verify non-prize numbers are NOT in winningResults:
    // Page 1 header phone numbers "2305230", "2305193", "2301740"
    const phoneCandidates = result.winningResults.map((r) => r.canonicalNumber);
    expect(phoneCandidates).not.toContain("2305230");
    expect(phoneCandidates).not.toContain("2305193");
    expect(phoneCandidates).not.toContain("2301740");

    // Page 1 draw date "18/02/2026"
    expect(phoneCandidates).not.toContain("2026");

    // Page 4 legal claims footer "90 days"
    expect(phoneCandidates).not.toContain("90");

    // Check that rejectedCandidates includes OUTSIDE_PRIZE_STRUCTURE records
    const outsideRejections = result.rejectedCandidates.filter(
      (c) => c.reason === "OUTSIDE_PRIZE_STRUCTURE"
    );
    expect(outsideRejections.length).toBeGreaterThan(0);
    for (const r of outsideRejections) {
      expect(r.ruleId).toBe(RULE_VALIDATION_REGION);
    }
  });

  // 7. Provenance
  it("7. Provenance: traces every accepted entity back to pageId, textBlockOrder, boundingBox, and documentSha256", () => {
    const segmentation = segmentationService.segmentDocument(pages);
    const result = extractLotteryEntitiesFromDocument(segmentation, pages);

    for (const res of result.winningResults) {
      expect(res.documentSha256).toBe(CANONICAL_SHA256);
      expect(res.pageId).toMatch(new RegExp(`^${CANONICAL_SHA256}_\\d+$`));
      expect(res.pageNumber).toBeGreaterThanOrEqual(1);
      expect(res.sourceTextBlockOrders.length).toBeGreaterThan(0);
      expect(res.rawSourceText).toBeTruthy();
      expect(res.boundingBox).toBeDefined();
      expect(res.boundingBox.unit).toBe("pt");
      if (res.isSuffix) {
        expect(res.parserRule).toBe(RULE_RESULT_SUFFIX_NUMBER);
      } else {
        expect(res.parserRule).toBe(RULE_RESULT_FULL_TICKET);
      }
      expect(res.parserVersion).toBe(DEFAULT_ENTITY_PARSER_VERSION);
      expect(res.id).toMatch(new RegExp(`^${CANONICAL_SHA256}_tier_`));
    }

    for (const tier of result.prizeTiers) {
      expect(tier.documentSha256).toBe(CANONICAL_SHA256);
      expect(tier.sourceTextBlockOrders.length).toBeGreaterThan(0);
    }
  });

  // 8. Duplicate handling
  it("8. Duplicate handling: handles duplicate text candidates deterministically without duplicating entity IDs", () => {
    // Inject a duplicate block in prize structure
    const customPages = createCanonical4PageDocumentFixture();
    const p1 = customPages[0]!;
    // Add duplicate block of 1st prize
    p1.textBlocks.push(createBlock(99, "1st Prize Rs :10000000/- 1) DW 809210 (ERNAKULAM)", 57, 630, 364, 11, 200));

    const segmentation = segmentationService.segmentDocument(customPages);
    const result = extractLotteryEntitiesFromDocument(segmentation, customPages);

    const firstPrizeResults = result.winningResults.filter((r) => r.id.includes("tier_1_result_809210_DW"));
    // Exactly 1 unique entity emitted for this ID
    expect(firstPrizeResults).toHaveLength(1);
  });

  // 9. Invalid candidate rejection
  it("9. Invalid candidate rejection: rejects malformed numbers, invalid lengths, and malformed series with detailed reasons", () => {
    const customPages = createCanonical4PageDocumentFixture();
    const p2 = customPages[1]!;
    // Add invalid 5-digit number and malformed series in prize structure
    p2.textBlocks.push(createBlock(50, "12345 678901", 57, 500, 200, 11, 200));
    p2.textBlocks.push(createBlock(51, "D 809210", 57, 480, 200, 11, 220));

    const segmentation = segmentationService.segmentDocument(customPages);
    const result = extractLotteryEntitiesFromDocument(segmentation, customPages);

    const lengthRejections = result.rejectedCandidates.filter((c) => c.reason === "INVALID_LENGTH");
    expect(lengthRejections.length).toBeGreaterThan(0);

    // Rejection details must be clear
    for (const rej of result.rejectedCandidates) {
      expect(rej.rawText).toBeTruthy();
      expect(rej.reason).toBeTruthy();
      expect(rej.boundingBox).toBeDefined();
    }
  });

  // 10. Deterministic repeat execution
  it("10. Deterministic repeat execution: produces identical entities across multiple runs", () => {
    const segmentation = segmentationService.segmentDocument(pages);
    const service = new LotteryEntityExtractorService();

    const run1 = service.extract(segmentation, pages, { createdAt: "2026-09-25T12:00:00Z" });
    const run2 = service.extract(segmentation, pages, { createdAt: "2026-09-25T12:00:00Z" });

    expect(run1).toEqual(run2);
    expect(JSON.stringify(run1)).toBe(JSON.stringify(run2));
  });

  // 11. Idempotent persistence
  it("11. Idempotent persistence: saves prize tiers and winning results idempotently and retrieves by ID and SHA-256", async () => {
    const segmentation = segmentationService.segmentDocument(pages);
    const result = extractLotteryEntitiesFromDocument(segmentation, pages);

    const tierRepo = new InMemoryPrizeTierRepository();
    const resultRepo = new InMemoryWinningResultRepository();

    // 1. Initial save
    await tierRepo.saveBatch(result.prizeTiers);
    await resultRepo.saveBatch(result.winningResults);

    // 2. Query by documentSha256
    const savedTiers = await tierRepo.getByDocumentSha256(CANONICAL_SHA256);
    expect(savedTiers).toHaveLength(result.prizeTiers.length);

    const savedResults = await resultRepo.getByDocumentSha256(CANONICAL_SHA256);
    expect(savedResults).toHaveLength(result.winningResults.length);

    // 3. Query by single ID
    const tier1 = await tierRepo.getById(result.prizeTiers[0]!.id);
    expect(tier1).toEqual(result.prizeTiers[0]);

    const res1 = await resultRepo.getById(result.winningResults[0]!.id);
    expect(res1).toEqual(result.winningResults[0]);

    // 4. Repeated save (idempotency test)
    await tierRepo.saveBatch(result.prizeTiers);
    await resultRepo.saveBatch(result.winningResults);

    const reQueriedTiers = await tierRepo.getByDocumentSha256(CANONICAL_SHA256);
    expect(reQueriedTiers).toHaveLength(result.prizeTiers.length);
  });

  // 12. Real canonical document
  it("12. Real canonical document: verifies complete extraction on official Dhanalekshmi DL-40th draw", () => {
    const segmentation = segmentationService.segmentDocument(pages);
    const result = extractLotteryEntitiesFromDocument(segmentation, pages);

    // Draw metadata remains linked
    expect(result.documentSha256).toBe(CANONICAL_SHA256);
    expect(result.drawMetadata?.lotteryName?.value).toBe("DHANALEKSHMI");
    expect(result.drawMetadata?.drawNumber?.value).toBe("DL-40th");
    expect(result.drawMetadata?.drawDate?.value).toBe("18/02/2026");

    // Prize tiers are identified
    expect(result.prizeTiers).toHaveLength(9);
    const firstTier = result.prizeTiers.find((t) => t.rank === 1);
    expect(firstTier?.name).toBe("1st Prize");
    expect(firstTier?.amount).toBe(10000000);

    // Winning numbers are extracted only from prize regions
    // Page 4 blocks 0 & 1 contain the final 8th prize suffix numbers:
    const page4Results = result.winningResults.filter((r) => r.pageNumber === 4);
    expect(page4Results.length).toBe(8); // 5 numbers in block 0 + 3 numbers in block 1
    const page4Numbers = page4Results.map((r) => r.canonicalNumber);
    expect(page4Numbers).toEqual(["9718", "9749", "9810", "9850", "9856", "9884", "9889", "9970"]);

    // Legal footer ("The prize winners are advised...", "surrender the winning tickets within 90 days")
    // and certification ("Sd/- RAJKAPOOR Joint Director") are NOT in winning numbers
    expect(page4Numbers).not.toContain("90");
    expect(page4Numbers).not.toContain("2026");

    // Location extracted for full ticket tiers
    const firstWinner = result.winningResults.find((r) => r.prizeTierName === "1st Prize");
    expect(firstWinner?.location).toBe("ERNAKULAM");

    const secondWinner = result.winningResults.find((r) => r.prizeTierName === "2nd Prize");
    expect(secondWinner?.location).toBe("PALAKKAD");

    const thirdWinner = result.winningResults.find((r) => r.prizeTierName === "3rd Prize");
    expect(thirdWinner?.location).toBe("ERNAKULAM");

    // All results have valid winningNumbers equivalent
    expect(result.winningNumbers.length).toBe(result.winningResults.length);
  });
});
