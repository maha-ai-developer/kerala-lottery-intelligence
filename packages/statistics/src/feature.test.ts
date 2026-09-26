/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 6A: Feature Engineering & Representation Unit & Invariant Tests
 *
 * Verifies all 25 non-negotiable core requirements:
 * 1. deterministic feature IDs
 * 2. deterministic repeated generation
 * 3. leading-zero preservation
 * 4. digit length
 * 5. digit sum
 * 6. unique digit count
 * 7. repeated digit detection
 * 8. first/last digit
 * 9. left-position extraction
 * 10. right-position extraction
 * 11. suffix extraction
 * 12. series extraction
 * 13. suffix-without-series invariant
 * 14. full-ticket-with-series invariant
 * 15. palindrome detection
 * 16. repeated pattern detection
 * 17. even/odd digit counts
 * 18. zero count
 * 19. malformed number rejection
 * 20. mixed-length validation
 * 21. provenance preservation
 * 22. feature version preservation
 * 23. source-result immutability
 * 24. deterministic feature matrix generation
 * 25. no-prediction invariant
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { WinningResult } from "@kerala-lottery/domain";
import {
  PdfPageExtractorService,
  DocumentSemanticSegmentationService,
  LotteryEntityExtractorService,
  computeSha256
} from "@kerala-lottery/documents";
import {
  buildLotteryKnowledgeGraph,
  validateLotteryKnowledgeGraph,
  LotteryKnowledgeGraph
} from "@kerala-lottery/knowledge";
import {
  buildMultiDrawCorpus,
  MultiDrawLotteryCorpus
} from "./multi-draw-corpus";
import {
  DEFAULT_FEATURE_VERSION,
  FeatureValidationError,
  computeFeatureRecordHash,
  validateResultForFeatureExtraction,
  extractResultFeatures,
  transformToFeatureMatrix,
  extractCorpusFeatures,
  InMemoryFeatureRepository,
  type DrawFeatureContext
} from "./index";

describe("Milestone 6A — Feature Engineering & Representation", () => {
  const LOTTERY_RESULTS_DIR = join(process.cwd(), "data/source-documents/lottery-results");
  let testCorpus: MultiDrawLotteryCorpus;

  beforeAll(async () => {
    if (!existsSync(LOTTERY_RESULTS_DIR)) return;

    const files = readdirSync(LOTTERY_RESULTS_DIR)
      .filter((f) => f.endsWith(".pdf") && f !== "dhanalekshmi-dl-40.pdf")
      .sort();

    const extractor = new PdfPageExtractorService();
    const segService = new DocumentSemanticSegmentationService();
    const entityService = new LotteryEntityExtractorService();

    const graphs: LotteryKnowledgeGraph[] = [];
    for (const filename of files) {
      const pdfBytes = readFileSync(join(LOTTERY_RESULTS_DIR, filename));
      const sha256 = computeSha256(new Uint8Array(pdfBytes));
      const extRes = await extractor.extractPages(new Uint8Array(pdfBytes), sha256);
      const segmentation = segService.segmentDocument(extRes.pages);
      const extraction = entityService.extract(segmentation, extRes.pages);
      const graph = buildLotteryKnowledgeGraph(extraction, segmentation);
      validateLotteryKnowledgeGraph(graph);
      graphs.push(graph);
    }

    testCorpus = buildMultiDrawCorpus(graphs);
  });

  const mockDrawContext: DrawFeatureContext = {
    drawId: "draw_ss_537",
    drawNumber: "SS-537th",
    lotteryCode: "SS",
    drawDate: "15/09/2026",
    drawSequence: 1
  };

  const mockSuffixResult: WinningResult = {
    id: "res_suffix_0045",
    documentSha256: "a".repeat(64),
    pageId: "page_01",
    pageNumber: 1,
    sourceTextBlockOrders: [10, 11],
    rawSourceText: "0045",
    boundingBox: { x: 10, y: 20, width: 30, height: 40, unit: "pt" },
    parserRule: "PRIZE_STRUCTURE_GRID",
    parserVersion: "v1.0",
    drawId: "draw_ss_537",
    prizeTierId: "tier_rank_7",
    prizeTierName: "7th Prize",
    rank: 7,
    amount: 100,
    canonicalNumber: "0045",
    numberLength: 4,
    isSuffix: true,
    confidence: 1.0,
    validationStatus: "VALID",
    createdAt: "2026-09-26T12:00:00.000Z"
  };

  const mockFullTicketResult: WinningResult = {
    id: "res_full_ticket_809210",
    documentSha256: "b".repeat(64),
    pageId: "page_01",
    pageNumber: 1,
    sourceTextBlockOrders: [4, 5],
    rawSourceText: "WA 809210",
    boundingBox: { x: 50, y: 60, width: 70, height: 80, unit: "pt" },
    parserRule: "PRIZE_STRUCTURE_GRID",
    parserVersion: "v1.0",
    drawId: "draw_ss_537",
    prizeTierId: "tier_rank_1",
    prizeTierName: "1st Prize",
    rank: 1,
    amount: 7500000,
    series: "WA",
    canonicalNumber: "809210",
    numberLength: 6,
    isSuffix: false,
    confidence: 1.0,
    validationStatus: "VALID",
    createdAt: "2026-09-26T12:00:00.000Z"
  };

  // 1. Deterministic feature IDs
  it("1. Deterministic feature IDs: identical result, feature, and value generate identical IDs", () => {
    const hash1 = computeFeatureRecordHash("res_01", "canonicalNumber", DEFAULT_FEATURE_VERSION, "0045");
    const hash2 = computeFeatureRecordHash("res_01", "canonicalNumber", DEFAULT_FEATURE_VERSION, "0045");
    const hashDiff = computeFeatureRecordHash("res_01", "canonicalNumber", DEFAULT_FEATURE_VERSION, "0046");

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hashDiff);
  });

  // 2. Deterministic repeated generation
  it("2. Deterministic repeated generation: multiple calls on the same result produce identical feature values", () => {
    const vec1 = extractResultFeatures(mockSuffixResult, mockDrawContext);
    const vec2 = extractResultFeatures(mockSuffixResult, mockDrawContext);

    expect(vec1.canonicalNumber).toBe(vec2.canonicalNumber);
    expect(vec1.values).toEqual(vec2.values);
    for (const key of Object.keys(vec1.features)) {
      expect(vec1.features[key]!.featureId).toBe(vec2.features[key]!.featureId);
      expect(vec1.features[key]!.deterministicHash).toBe(vec2.features[key]!.deterministicHash);
    }
  });

  // 3. Leading-zero preservation
  it("3. Leading-zero preservation: '0045' retains string identity, leadingZero=true, and firstDigit='0'", () => {
    const vec = extractResultFeatures(mockSuffixResult, mockDrawContext);

    expect(vec.values["canonicalNumber"]).toBe("0045");
    expect(vec.values["canonicalNumber"]).not.toBe(45);
    expect(vec.values["leadingZero"]).toBe(true);
    expect(vec.values["firstDigit"]).toBe("0");
    expect(typeof vec.values["canonicalNumber"]).toBe("string");
  });

  // 4. Digit length
  it("4. Digit length: correctly reports numberLength and digitCount", () => {
    const vecSuffix = extractResultFeatures(mockSuffixResult, mockDrawContext);
    expect(vecSuffix.values["numberLength"]).toBe(4);
    expect(vecSuffix.values["digitCount"]).toBe(4);

    const vecFull = extractResultFeatures(mockFullTicketResult, mockDrawContext);
    expect(vecFull.values["numberLength"]).toBe(6);
    expect(vecFull.values["digitCount"]).toBe(6);
  });

  // 5. Digit sum
  it("5. Digit sum: accurately sums individual digits (0+0+4+5=9)", () => {
    const vec = extractResultFeatures(mockSuffixResult, mockDrawContext);
    expect(vec.values["digitSum"]).toBe(9);

    const vecFull = extractResultFeatures(mockFullTicketResult, mockDrawContext);
    // 8 + 0 + 9 + 2 + 1 + 0 = 20
    expect(vecFull.values["digitSum"]).toBe(20);
  });

  // 6. Unique digit count
  it("6. Unique digit count: accurately determines distinct digits ('0045' -> 3 unique: 0, 4, 5)", () => {
    const vec = extractResultFeatures(mockSuffixResult, mockDrawContext);
    expect(vec.values["uniqueDigitCount"]).toBe(3);

    const customRes: WinningResult = { ...mockSuffixResult, canonicalNumber: "1111", numberLength: 4 };
    const vecCustom = extractResultFeatures(customRes, mockDrawContext);
    expect(vecCustom.values["uniqueDigitCount"]).toBe(1);
  });

  // 7. Repeated digit detection
  it("7. Repeated digit detection: flags hasRepeatedDigit=true and repeatedDigitCount=1 for '0045'", () => {
    const vec = extractResultFeatures(mockSuffixResult, mockDrawContext);
    expect(vec.values["hasRepeatedDigit"]).toBe(true);
    expect(vec.values["repeatedDigitCount"]).toBe(1); // 4 - 3 = 1

    const uniqueRes: WinningResult = { ...mockSuffixResult, canonicalNumber: "1234", numberLength: 4 };
    const vecUnique = extractResultFeatures(uniqueRes, mockDrawContext);
    expect(vecUnique.values["hasRepeatedDigit"]).toBe(false);
    expect(vecUnique.values["repeatedDigitCount"]).toBe(0);
  });

  // 8. First and last digit
  it("8. First/last digit: accurately extracts firstDigit='0' and lastDigit='5' as strings", () => {
    const vec = extractResultFeatures(mockSuffixResult, mockDrawContext);
    expect(vec.values["firstDigit"]).toBe("0");
    expect(vec.values["lastDigit"]).toBe("5");
    expect(typeof vec.values["firstDigit"]).toBe("string");
    expect(typeof vec.values["lastDigit"]).toBe("string");
  });

  // 9. Left-position extraction
  it("9. Left-position extraction: accurately extracts 1-based positions from left for '0045'", () => {
    const vec = extractResultFeatures(mockSuffixResult, mockDrawContext);
    expect(vec.values["digitPositionFromLeft_1"]).toBe(0);
    expect(vec.values["digitPositionFromLeft_2"]).toBe(0);
    expect(vec.values["digitPositionFromLeft_3"]).toBe(4);
    expect(vec.values["digitPositionFromLeft_4"]).toBe(5);
  });

  // 10. Right-position extraction
  it("10. Right-position extraction: accurately extracts 1-based positions from right for '0045'", () => {
    const vec = extractResultFeatures(mockSuffixResult, mockDrawContext);
    expect(vec.values["digitPositionFromRight_1"]).toBe(5); // terminal unit digit
    expect(vec.values["digitPositionFromRight_2"]).toBe(4); // tens
    expect(vec.values["digitPositionFromRight_3"]).toBe(0); // hundreds
    expect(vec.values["digitPositionFromRight_4"]).toBe(0); // thousands
  });

  // 11. Suffix extraction
  it("11. Suffix extraction: extracts suffix2='45', suffix3='045', suffix4='0045' for '0045'", () => {
    const vec = extractResultFeatures(mockSuffixResult, mockDrawContext);
    expect(vec.values["suffix2"]).toBe("45");
    expect(vec.values["suffix3"]).toBe("045");
    expect(vec.values["suffix4"]).toBe("0045");
  });

  // 12. Series extraction
  it("12. Series extraction: extracts seriesCode='WA', seriesLength=2, seriesCharacters='W,A' for full ticket", () => {
    const vec = extractResultFeatures(mockFullTicketResult, mockDrawContext);
    expect(vec.values["seriesCode"]).toBe("WA");
    expect(vec.values["seriesLength"]).toBe(2);
    expect(vec.values["seriesCharacters"]).toBe("W,A");
  });

  // 13. Suffix-without-series invariant
  it("13. Suffix-without-series invariant: suffix results strictly keep seriesCode=null, length=null, chars=null", () => {
    const vec = extractResultFeatures(mockSuffixResult, mockDrawContext);
    expect(vec.values["seriesCode"]).toBeNull();
    expect(vec.values["seriesLength"]).toBeNull();
    expect(vec.values["seriesCharacters"]).toBeNull();
  });

  // 14. Full-ticket-with-series invariant
  it("14. Full-ticket-with-series invariant: full ticket results strictly keep suffix2/suffix3/suffix4 as null", () => {
    const vec = extractResultFeatures(mockFullTicketResult, mockDrawContext);
    expect(vec.values["suffix2"]).toBeNull();
    expect(vec.values["suffix3"]).toBeNull();
    expect(vec.values["suffix4"]).toBeNull();
  });

  // 15. Palindrome detection
  it("15. Palindrome detection: accurately flags palindromes ('1221' -> true, '1234' -> false)", () => {
    const palRes: WinningResult = { ...mockSuffixResult, canonicalNumber: "1221", numberLength: 4 };
    const vecPal = extractResultFeatures(palRes, mockDrawContext);
    expect(vecPal.values["palindrome"]).toBe(true);

    const nonPalRes: WinningResult = { ...mockSuffixResult, canonicalNumber: "1234", numberLength: 4 };
    const vecNonPal = extractResultFeatures(nonPalRes, mockDrawContext);
    expect(vecNonPal.values["palindrome"]).toBe(false);
  });

  // 16. Repeated pattern detection
  it("16. Repeated pattern detection: alternatingPattern, allDigitsSame, and repeatedPairCount", () => {
    // Alternating "1212"
    const altRes: WinningResult = { ...mockSuffixResult, canonicalNumber: "1212", numberLength: 4 };
    const vecAlt = extractResultFeatures(altRes, mockDrawContext);
    expect(vecAlt.values["alternatingPattern"]).toBe(true);
    expect(vecAlt.values["allDigitsSame"]).toBe(false);

    // All same "7777"
    const sameRes: WinningResult = { ...mockSuffixResult, canonicalNumber: "7777", numberLength: 4 };
    const vecSame = extractResultFeatures(sameRes, mockDrawContext);
    expect(vecSame.values["allDigitsSame"]).toBe(true);
    expect(vecSame.values["alternatingPattern"]).toBe(false); // must have distinct digits
    expect(vecSame.values["repeatedPairCount"]).toBe(2);

    // Repeated pairs "1122" -> 2
    const pairsRes: WinningResult = { ...mockSuffixResult, canonicalNumber: "1122", numberLength: 4 };
    const vecPairs = extractResultFeatures(pairsRes, mockDrawContext);
    expect(vecPairs.values["repeatedPairCount"]).toBe(2);

    // Ascending "1234"
    const ascRes: WinningResult = { ...mockSuffixResult, canonicalNumber: "1234", numberLength: 4 };
    const vecAsc = extractResultFeatures(ascRes, mockDrawContext);
    expect(vecAsc.values["ascendingAdjacentPattern"]).toBe(true);
    expect(vecAsc.values["descendingAdjacentPattern"]).toBe(false);

    // Descending "4321"
    const descRes: WinningResult = { ...mockSuffixResult, canonicalNumber: "4321", numberLength: 4 };
    const vecDesc = extractResultFeatures(descRes, mockDrawContext);
    expect(vecDesc.values["descendingAdjacentPattern"]).toBe(true);
    expect(vecDesc.values["ascendingAdjacentPattern"]).toBe(false);
  });

  // 17. Even/odd digit counts
  it("17. Even/odd digit counts: correctly counts even and odd digits ('0045' has 3 even {0,0,4} and 1 odd {5})", () => {
    const vec = extractResultFeatures(mockSuffixResult, mockDrawContext);
    expect(vec.values["evenDigitCount"]).toBe(3);
    expect(vec.values["oddDigitCount"]).toBe(1);
  });

  // 18. Zero count
  it("18. Zero count: correctly counts occurrences of '0' ('0045' -> 2 zeros)", () => {
    const vec = extractResultFeatures(mockSuffixResult, mockDrawContext);
    expect(vec.values["zeroCount"]).toBe(2);
  });

  // 19. Malformed number rejection
  it("19. Malformed number rejection: throws FeatureValidationError on invalid digits, length mismatch, or series violations", () => {
    // Non-numeric digits
    const nonNumRes = { ...mockSuffixResult, canonicalNumber: "12A4" };
    expect(() => extractResultFeatures(nonNumRes as any, mockDrawContext)).toThrowError(FeatureValidationError);
    expect(() => validateResultForFeatureExtraction(nonNumRes as any, mockDrawContext)).toThrowError(/NON_NUMERIC_DIGITS/);

    // Empty number
    const emptyRes = { ...mockSuffixResult, canonicalNumber: "" };
    expect(() => extractResultFeatures(emptyRes as any, mockDrawContext)).toThrowError(/EMPTY_NUMBER/);

    // Length mismatch
    const mismatchRes = { ...mockSuffixResult, canonicalNumber: "1234", numberLength: 6 };
    expect(() => extractResultFeatures(mismatchRes as any, mockDrawContext)).toThrowError(/INCONSISTENT_NUMBER_LENGTH/);

    // Suffix with series
    const suffixWithSeries = { ...mockSuffixResult, series: "AB" };
    expect(() => extractResultFeatures(suffixWithSeries as any, mockDrawContext)).toThrowError(/SUFFIX_WITH_SERIES/);

    // Full ticket without series
    const fullWithoutSeries = { ...mockFullTicketResult, series: undefined };
    expect(() => extractResultFeatures(fullWithoutSeries as any, mockDrawContext)).toThrowError(/FULL_TICKET_WITHOUT_SERIES/);
  });

  // 20. Mixed-length validation
  it("20. Mixed-length validation: handles position differences gracefully and matrix filters safely", () => {
    const vec4 = extractResultFeatures(mockSuffixResult, mockDrawContext, { maxPositionLength: 6 });
    const vec6 = extractResultFeatures(mockFullTicketResult, mockDrawContext, { maxPositionLength: 6 });

    // For 4-digit number, position 5 and 6 are null
    expect(vec4.values["digitPositionFromLeft_5"]).toBeNull();
    expect(vec4.values["digitPositionFromLeft_6"]).toBeNull();
    // For 6-digit number, position 5 and 6 have values
    expect(vec6.values["digitPositionFromLeft_5"]).toBe(1);
    expect(vec6.values["digitPositionFromLeft_6"]).toBe(0);

    // Matrix length filtering
    const matrix4 = transformToFeatureMatrix([vec4, vec6], { filterNumberLength: 4 });
    expect(matrix4.totalRecords).toBe(1);
    expect(matrix4.rows[0]!.canonicalNumber).toBe("0045");
  });

  // 21. Provenance preservation
  it("21. Provenance preservation: vectors maintain exact sourceResultId, drawId, documentSha256, and metadata", () => {
    const vec = extractResultFeatures(mockSuffixResult, mockDrawContext);
    expect(vec.sourceResultId).toBe(mockSuffixResult.id);
    expect(vec.sourceDrawId).toBe(mockDrawContext.drawId);
    expect(vec.sourceDocumentSha256).toBe(mockSuffixResult.documentSha256);

    const featRec = vec.features["canonicalNumber"]!;
    expect(featRec.sourceMetadata.pageNumber).toBe(mockSuffixResult.pageNumber);
    expect(featRec.sourceMetadata.prizeTierRank).toBe(mockSuffixResult.rank);
    expect(featRec.sourceMetadata.resultType).toBe("SUFFIX");
  });

  // 22. Feature version preservation
  it("22. Feature version preservation: version 'v1.0.0-feature-engineering' is stamped on all records", () => {
    const vec = extractResultFeatures(mockSuffixResult, mockDrawContext);
    expect(vec.featureVersion).toBe(DEFAULT_FEATURE_VERSION);
    for (const rec of Object.values(vec.features)) {
      expect(rec.featureVersion).toBe(DEFAULT_FEATURE_VERSION);
    }
  });

  // 23. Source-result immutability
  it("23. Source-result immutability: extractResultFeatures does not mutate the input WinningResult", () => {
    const originalClone = JSON.parse(JSON.stringify(mockSuffixResult));
    extractResultFeatures(mockSuffixResult, mockDrawContext);
    expect(mockSuffixResult).toEqual(originalClone);
  });

  // 24. Deterministic feature matrix generation
  it("24. Deterministic feature matrix generation: transformation produces consistent columns, rows, and hash", async () => {
    const vec1 = extractResultFeatures(mockSuffixResult, mockDrawContext);
    const vec2 = extractResultFeatures(mockFullTicketResult, mockDrawContext);

    const matrix1 = transformToFeatureMatrix([vec1, vec2]);
    const matrix2 = transformToFeatureMatrix([vec1, vec2]);

    expect(matrix1.id).toBe(matrix2.id);
    expect(matrix1.deterministicHash).toBe(matrix2.deterministicHash);
    expect(matrix1.totalRecords).toBe(2);
    expect(matrix1.featureNames).toEqual(matrix2.featureNames);
    expect(matrix1.rows).toEqual(matrix2.rows);

    // Repository persistence check
    const repo = new InMemoryFeatureRepository();
    await repo.saveMatrix(matrix1);
    const retrieved = await repo.getMatrixById(matrix1.id);
    expect(retrieved).toEqual(matrix1);
  });

  // 25. No-prediction invariant
  it("25. No-prediction invariant: enforces descriptiveOnly=true, includes disclaimer, and zero predictive scores", () => {
    const vec = extractResultFeatures(mockSuffixResult, mockDrawContext);
    expect(vec.descriptiveOnly).toBe(true);

    const matrix = transformToFeatureMatrix([vec]);
    expect(matrix.descriptiveOnly).toBe(true);
    expect(matrix.limitations.some((l) => l.includes("NON-PREDICTIVE FEATURE NOTICE"))).toBe(true);

    for (const featureName of Object.keys(vec.values)) {
      const lower = featureName.toLowerCase();
      expect(lower).not.toContain("predict");
      expect(lower).not.toContain("hot");
      expect(lower).not.toContain("cold");
      expect(lower).not.toContain("due");
      expect(lower).not.toContain("probability");
      expect(lower).not.toContain("bet");
      expect(lower).not.toContain("score");
    }
  });

  // Real Corpus Test: 2,270 Results across 6 draws
  it("Corpus Integration: extracts feature matrix over real 2,270 validated results from 6 draws", () => {
    if (!testCorpus) return;

    expect(testCorpus.combinedEntities.winningResults.length).toBe(2270);
    const matrix = extractCorpusFeatures(testCorpus);

    expect(matrix.totalRecords).toBe(2270);
    expect(matrix.metadata.fullTicketCount).toBe(84);
    expect(matrix.metadata.suffixCount).toBe(2186);
    expect(matrix.featureNames.length).toBeGreaterThan(25);
    expect(matrix.id.startsWith("fmat_")).toBe(true);
    expect(matrix.deterministicHash.length).toBe(16);
  });
});
