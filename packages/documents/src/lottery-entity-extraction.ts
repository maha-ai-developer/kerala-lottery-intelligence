/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 3E: Validated Lottery Entities & Provenance
 *
 * Implements deterministic extraction and structural validation of lottery entities
 * (PrizeTier, WinningResult, Series, WinningNumber) from Milestone 3D PRIZE_STRUCTURE
 * observations with complete provenance back to TextBlock and immutable PDF.
 *
 * Invariants:
 * - Deterministic, reversible, auditable rules only (no LLMs, no probabilistic classifiers).
 * - Never convert ambiguous text into an accepted lottery entity.
 * - Winning numbers extracted ONLY from validated PRIZE_STRUCTURE regions.
 * - Strict full ticket (6-digit + 2-letter uppercase series) vs suffix (4-digit, no series) separation.
 * - Exact string preservation for numbers (e.g. leading zeros: "0259").
 * - Full provenance: entity -> pageId -> textBlockOrder -> documentSha256 -> immutable PDF.
 */

import type {
  DocumentPage,
  TextBlock,
  DocumentSemanticSegmentation,
  PrizeTier,
  PrizeTierType,
  Series,
  WinningResult,
  WinningNumber,
  RejectedCandidate,
  LotteryEntityExtractionResult,
  RegionBoundingBox
} from "@kerala-lottery/domain";
import { DEFAULT_ENTITY_PARSER_VERSION } from "@kerala-lottery/domain";
import { DocumentValidationError } from "./index";

export { DEFAULT_ENTITY_PARSER_VERSION };

// ============================================================================
// Rule Identifiers
// ============================================================================

export const RULE_TIER_DECLARATION = "rule.tier.declaration_v1";
export const RULE_SERIES_EXTRACTION = "rule.series.extraction_v1";
export const RULE_RESULT_FULL_TICKET = "rule.result.full_ticket_v1";
export const RULE_RESULT_SUFFIX_NUMBER = "rule.result.suffix_number_v1";
export const RULE_VALIDATION_REGION = "rule.validation.region_v1";
export const RULE_VALIDATION_FORMAT = "rule.validation.format_v1";

// ============================================================================
// Helper Patterns
// ============================================================================

const PRIZE_TIER_REGEX =
  /^(?:(\d+)(?:st|nd|rd|th)|(Cons(?:olation)?))\s+Prize(?:-|\s+)?(?:Rs\s*[:\.]?\s*(\d+)\s*\/-)?/i;

const SUFFIX_ANNOUNCEMENT_REGEX =
  /FOR\s+THE\s+TICKETS\s+ENDING\s+WITH\s+THE\s+FOLLOWING\s+NUMBERS/i;

// Full ticket pattern: optional item prefix like "1) ", 2-letter series, 6 digits, optional (LOCATION)
const FULL_TICKET_PATTERN =
  /\b(?:(\d+)\)\s+)?([A-Z]{2})\s+(\d{6})(?:\s*\(([^)]+)\))?/g;

// 2-letter uppercase word
const SERIES_CODE_PATTERN = /^[A-Z]{2}$/;

// 6-digit ticket number
const FULL_TICKET_NUMBER_PATTERN = /^\d{6}$/;

// 4-digit suffix number
const SUFFIX_NUMBER_PATTERN = /^\d{4}$/;

function rankToTierType(rank: number): PrizeTierType {
  if (rank === 0) return "CONSOLATION";
  return "RANKED";
}

function parsePrizeTierDeclaration(
  text: string
): { name: string; rank: number; tierType: PrizeTierType; amount?: number } | null {
  const match = text.match(PRIZE_TIER_REGEX);
  if (!match) return null;

  if (match[2]) {
    // Consolation prize
    const amountStr = match[3];
    return {
      name: "Cons Prize",
      rank: 0,
      tierType: "CONSOLATION",
      amount: amountStr ? parseInt(amountStr, 10) : undefined
    };
  }

  const rank = parseInt(match[1]!, 10);
  const rankSuffix =
    rank === 1 ? "1st" : rank === 2 ? "2nd" : rank === 3 ? "3rd" : `${rank}th`;
  const amountStr = match[3];

  return {
    name: `${rankSuffix} Prize`,
    rank,
    tierType: rankToTierType(rank),
    amount: amountStr ? parseInt(amountStr, 10) : undefined
  };
}

// ============================================================================
// Entity Validation Functions
// ============================================================================

export function validatePrizeTier(tier: PrizeTier): void {
  if (!tier || typeof tier !== "object") {
    throw new DocumentValidationError("PrizeTier must be an object", "INVALID_PRIZE_TIER");
  }
  if (!tier.id || typeof tier.id !== "string") {
    throw new DocumentValidationError("PrizeTier id must be a string", "INVALID_TIER_ID");
  }
  if (!tier.documentSha256 || !/^[a-f0-9]{64}$/.test(tier.documentSha256)) {
    throw new DocumentValidationError("PrizeTier documentSha256 must be 64-char hex", "INVALID_SHA256");
  }
  if (!Number.isInteger(tier.pageNumber) || tier.pageNumber < 1) {
    throw new DocumentValidationError("PrizeTier pageNumber must be a positive integer", "INVALID_PAGE_NUMBER");
  }
  if (!Array.isArray(tier.sourceTextBlockOrders) || tier.sourceTextBlockOrders.length === 0) {
    throw new DocumentValidationError("PrizeTier sourceTextBlockOrders must not be empty", "INVALID_BLOCK_ORDERS");
  }
  if (!tier.name || typeof tier.name !== "string") {
    throw new DocumentValidationError("PrizeTier name must be a non-empty string", "INVALID_TIER_NAME");
  }
  if (tier.amount !== undefined && (!Number.isFinite(tier.amount) || tier.amount < 0)) {
    throw new DocumentValidationError("PrizeTier amount must be a non-negative number", "INVALID_AMOUNT");
  }
  if (!tier.parserRule || !tier.parserVersion) {
    throw new DocumentValidationError("PrizeTier must have parserRule and parserVersion", "INVALID_PROVENANCE");
  }
}

export function validateSeries(series: Series): void {
  if (!series || typeof series !== "object") {
    throw new DocumentValidationError("Series must be an object", "INVALID_SERIES");
  }
  if (!series.id || typeof series.id !== "string") {
    throw new DocumentValidationError("Series id must be a string", "INVALID_SERIES_ID");
  }
  if (!series.code || !SERIES_CODE_PATTERN.test(series.code)) {
    throw new DocumentValidationError(
      `Series code must be 2 uppercase alphabetic characters, received '${series.code}'`,
      "INVALID_SERIES_CODE"
    );
  }
  if (!series.documentSha256 || !/^[a-f0-9]{64}$/.test(series.documentSha256)) {
    throw new DocumentValidationError("Series documentSha256 must be 64-char hex", "INVALID_SHA256");
  }
  if (!Number.isInteger(series.pageNumber) || series.pageNumber < 1) {
    throw new DocumentValidationError("Series pageNumber must be >= 1", "INVALID_PAGE_NUMBER");
  }
  if (!Array.isArray(series.sourceTextBlockOrders) || series.sourceTextBlockOrders.length === 0) {
    throw new DocumentValidationError("Series sourceTextBlockOrders must not be empty", "INVALID_BLOCK_ORDERS");
  }
}

export function validateWinningResult(result: WinningResult): void {
  if (!result || typeof result !== "object") {
    throw new DocumentValidationError("WinningResult must be an object", "INVALID_WINNING_RESULT");
  }
  if (!result.id || typeof result.id !== "string") {
    throw new DocumentValidationError("WinningResult id must be a string", "INVALID_RESULT_ID");
  }
  if (!result.prizeTierId || typeof result.prizeTierId !== "string") {
    throw new DocumentValidationError("WinningResult prizeTierId must be a string", "INVALID_PRIZE_TIER_ID");
  }
  if (!result.documentSha256 || !/^[a-f0-9]{64}$/.test(result.documentSha256)) {
    throw new DocumentValidationError("WinningResult documentSha256 must be 64-char hex", "INVALID_SHA256");
  }
  if (result.isSuffix) {
    if (!SUFFIX_NUMBER_PATTERN.test(result.canonicalNumber)) {
      throw new DocumentValidationError(
        `Suffix winning number must be exactly 4 digits, received '${result.canonicalNumber}'`,
        "INVALID_SUFFIX_FORMAT"
      );
    }
    if (result.series !== undefined) {
      throw new DocumentValidationError("Suffix winning number must not have a series", "UNEXPECTED_SERIES");
    }
  } else {
    if (!FULL_TICKET_NUMBER_PATTERN.test(result.canonicalNumber)) {
      throw new DocumentValidationError(
        `Full ticket winning number must be exactly 6 digits, received '${result.canonicalNumber}'`,
        "INVALID_FULL_TICKET_FORMAT"
      );
    }
    if (!result.series || !SERIES_CODE_PATTERN.test(result.series)) {
      throw new DocumentValidationError(
        `Full ticket winning result must have a 2-letter uppercase series, received '${result.series}'`,
        "INVALID_SERIES_CODE"
      );
    }
  }
  if (!Array.isArray(result.sourceTextBlockOrders) || result.sourceTextBlockOrders.length === 0) {
    throw new DocumentValidationError("WinningResult sourceTextBlockOrders must not be empty", "INVALID_BLOCK_ORDERS");
  }
}

export function validateLotteryEntityExtractionResult(res: LotteryEntityExtractionResult): void {
  if (!res || typeof res !== "object") {
    throw new DocumentValidationError("LotteryEntityExtractionResult must be an object", "INVALID_RESULT");
  }
  if (!res.documentSha256 || !/^[a-f0-9]{64}$/.test(res.documentSha256)) {
    throw new DocumentValidationError("documentSha256 must be 64-char hex", "INVALID_SHA256");
  }
  if (!Array.isArray(res.prizeTiers)) {
    throw new DocumentValidationError("prizeTiers must be an array", "INVALID_PRIZE_TIERS");
  }
  for (const t of res.prizeTiers) validatePrizeTier(t);

  if (!Array.isArray(res.series)) {
    throw new DocumentValidationError("series must be an array", "INVALID_SERIES_LIST");
  }
  for (const s of res.series) validateSeries(s);

  if (!Array.isArray(res.winningResults)) {
    throw new DocumentValidationError("winningResults must be an array", "INVALID_WINNING_RESULTS");
  }
  for (const r of res.winningResults) validateWinningResult(r);

  if (!Array.isArray(res.winningNumbers)) {
    throw new DocumentValidationError("winningNumbers must be an array", "INVALID_WINNING_NUMBERS");
  }
}

// ============================================================================
// Core Extraction Engine
// ============================================================================

export interface LotteryEntityExtractionOptions {
  parserVersion?: string;
  createdAt?: string;
}

/**
 * Extracts validated lottery entities from 3D semantic segmentation and 3C DocumentPages.
 * Follows strict deterministic rules:
 * - Reads only from PRIZE_STRUCTURE regions.
 * - Extracts explicit prize tiers and amounts.
 * - Separates series and canonical numbers with leading zeros preserved.
 * - Rejects non-prize or ambiguous numbers with detailed provenance.
 * - Handles duplicates deterministically.
 */
export function extractLotteryEntitiesFromDocument(
  segmentation: DocumentSemanticSegmentation,
  pages: readonly DocumentPage[],
  options?: LotteryEntityExtractionOptions
): LotteryEntityExtractionResult {
  if (!segmentation) {
    throw new DocumentValidationError("Semantic segmentation is required", "MISSING_SEGMENTATION");
  }
  if (!pages || pages.length === 0) {
    throw new DocumentValidationError("Document pages are required", "EMPTY_PAGES");
  }

  const documentSha256 = segmentation.documentSha256;
  const parserVersion = options?.parserVersion || DEFAULT_ENTITY_PARSER_VERSION;
  const createdAt = options?.createdAt || new Date().toISOString();
  const drawId = segmentation.drawMetadata?.drawNumber?.value
    ? `${documentSha256}_draw_${segmentation.drawMetadata.drawNumber.value}`
    : `${documentSha256}_draw`;

  // Build map of blocks in PRIZE_STRUCTURE regions
  const prizeStructureBlocksByPage = new Map<number, Set<number>>();
  const allPrizeRegions = segmentation.regions.filter((r) => r.type === "PRIZE_STRUCTURE");

  for (const region of allPrizeRegions) {
    let pageSet = prizeStructureBlocksByPage.get(region.pageNumber);
    if (!pageSet) {
      pageSet = new Set<number>();
      prizeStructureBlocksByPage.set(region.pageNumber, pageSet);
    }
    for (const order of region.textBlockOrders) {
      pageSet.add(order);
    }
  }

  // Find candidate blocks outside PRIZE_STRUCTURE to explicitly document rejection
  const rejectedCandidates: RejectedCandidate[] = [];

  // Sort pages ascending by pageNumber
  const sortedPages = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);

  // Scan non-prize regions to record rejection of any number candidates found outside PRIZE_STRUCTURE
  for (const page of sortedPages) {
    const prizeBlockSet = prizeStructureBlocksByPage.get(page.pageNumber) || new Set<number>();
    for (const block of page.textBlocks) {
      if (!prizeBlockSet.has(block.order)) {
        // Check if this non-prize block contains 4-digit or 6-digit number patterns
        const digits = block.text.match(/\b\d{4,6}\b/g);
        if (digits) {
          for (const d of digits) {
            rejectedCandidates.push({
              reason: "OUTSIDE_PRIZE_STRUCTURE",
              rawText: d,
              pageNumber: page.pageNumber,
              textBlockOrder: block.order,
              boundingBox: {
                x: block.x,
                y: block.y,
                width: block.width,
                height: block.height,
                top: block.top,
                unit: "pt"
              },
              ruleId: RULE_VALIDATION_REGION,
              detail: `Number '${d}' found outside PRIZE_STRUCTURE on page ${page.pageNumber} block ${block.order}`
            });
          }
        }
      }
    }
  }

  const prizeTiers: PrizeTier[] = [];
  const seriesList: Series[] = [];
  const winningResults: WinningResult[] = [];
  const winningNumbers: WinningNumber[] = [];

  // State tracking across document traversal
  let currentTier: PrizeTier | null = null;
  let isSuffixSection = false;

  // Process all blocks strictly within PRIZE_STRUCTURE in physical reading order
  for (const page of sortedPages) {
    const prizeBlockSet = prizeStructureBlocksByPage.get(page.pageNumber);
    if (!prizeBlockSet || prizeBlockSet.size === 0) continue;

    // Filter and sort blocks strictly within PRIZE_STRUCTURE
    const prizeBlocks = page.textBlocks
      .filter((b) => prizeBlockSet.has(b.order))
      .sort((a, b) => a.order - b.order);

    for (const block of prizeBlocks) {
      const text = block.text.trim();
      const blockBox: RegionBoundingBox = {
        x: block.x,
        y: block.y,
        width: block.width,
        height: block.height,
        top: block.top,
        unit: "pt"
      };

      // 1. Check for suffix announcement header
      if (SUFFIX_ANNOUNCEMENT_REGEX.test(text)) {
        isSuffixSection = true;
        continue;
      }

      // 2. Check for Prize Tier declaration
      const tierInfo = parsePrizeTierDeclaration(text);
      if (tierInfo) {
        // Tiers 4th and above in Kerala lotteries are suffix tiers, or if we passed suffix announcement
        const isSuffix = isSuffixSection || tierInfo.rank >= 4;
        const tierId = `${documentSha256}_tier_${tierInfo.tierType === "CONSOLATION" ? "cons" : tierInfo.rank}`;

        currentTier = {
          id: tierId,
          documentSha256,
          pageId: page.id,
          pageNumber: page.pageNumber,
          sourceTextBlockOrders: [block.order],
          rawSourceText: text,
          boundingBox: blockBox,
          parserRule: RULE_TIER_DECLARATION,
          parserVersion,
          name: tierInfo.name,
          rank: tierInfo.rank,
          tierType: tierInfo.tierType,
          amount: tierInfo.amount,
          currency: tierInfo.amount ? "INR" : undefined,
          isSuffix,
          expectedLength: isSuffix ? 4 : 6,
          confidence: 1.0,
          createdAt
        };

        prizeTiers.push(currentTier);

        // Process any numbers declared on the exact same line as the tier header
        // For full ticket tiers (e.g. 1st, Cons, 2nd, 3rd)
        if (!isSuffix) {
          processFullTicketMatches(
            text,
            currentTier,
            page,
            block,
            documentSha256,
            drawId,
            parserVersion,
            createdAt,
            seriesList,
            winningResults,
            winningNumbers,
            rejectedCandidates
          );
        } else {
          // For suffix tiers (e.g. "4th Prize-Rs :5000/- 0259 0375 0497 0701 2709")
          // Strip the tier declaration prefix, then process remaining numbers
          const afterHeader = text.replace(PRIZE_TIER_REGEX, "").trim();
          if (afterHeader) {
            processSuffixNumberTokens(
              afterHeader,
              currentTier,
              page,
              block,
              documentSha256,
              drawId,
              parserVersion,
              createdAt,
              winningResults,
              winningNumbers,
              rejectedCandidates
            );
          }
        }
        continue;
      }

      // 3. Continuation lines under active prize tier
      if (!currentTier) {
        // If numbers appear before any prize tier is active, reject
        const tokens = text.split(/\s+/).filter(Boolean);
        for (const token of tokens) {
          if (/\d+/.test(token)) {
            rejectedCandidates.push({
              reason: "UNASSOCIATED_TIER",
              rawText: token,
              pageNumber: page.pageNumber,
              textBlockOrder: block.order,
              boundingBox: blockBox,
              ruleId: RULE_VALIDATION_FORMAT,
              detail: `Number '${token}' has no preceding prize tier declaration`
            });
          }
        }
        continue;
      }

      if (!currentTier.isSuffix) {
        // Full ticket continuation line (e.g. "DT 809210 DU 809210 DV 809210...")
        processFullTicketMatches(
          text,
          currentTier,
          page,
          block,
          documentSha256,
          drawId,
          parserVersion,
          createdAt,
          seriesList,
          winningResults,
          winningNumbers,
          rejectedCandidates
        );
      } else {
        // Suffix continuation line (e.g. "3083 3362 4165 4255 5063")
        processSuffixNumberTokens(
          text,
          currentTier,
          page,
          block,
          documentSha256,
          drawId,
          parserVersion,
          createdAt,
          winningResults,
          winningNumbers,
          rejectedCandidates
        );
      }
    }
  }

  // Deduplicate entities deterministically
  const uniqueTiers = deduplicateById(prizeTiers);
  const uniqueSeries = deduplicateById(seriesList);
  const uniqueResults = deduplicateById(winningResults);
  const uniqueNumbers = deduplicateById(winningNumbers);

  const result: LotteryEntityExtractionResult = {
    documentSha256,
    drawId,
    drawMetadata: segmentation.drawMetadata,
    prizeTiers: uniqueTiers,
    series: uniqueSeries,
    winningResults: uniqueResults,
    winningNumbers: uniqueNumbers,
    rejectedCandidates,
    parserVersion,
    extractionVersion: segmentation.extractionVersion,
    semanticVersion: segmentation.semanticVersion,
    createdAt
  };

  validateLotteryEntityExtractionResult(result);
  return result;
}

// ============================================================================
// Helper Match Processors
// ============================================================================

function processFullTicketMatches(
  text: string,
  tier: PrizeTier,
  page: DocumentPage,
  block: TextBlock,
  documentSha256: string,
  drawId: string,
  parserVersion: string,
  createdAt: string,
  seriesList: Series[],
  winningResults: WinningResult[],
  winningNumbers: WinningNumber[],
  rejectedCandidates: RejectedCandidate[]
): void {
  const blockBox: RegionBoundingBox = {
    x: block.x,
    y: block.y,
    width: block.width,
    height: block.height,
    top: block.top,
    unit: "pt"
  };

  // Find all standard pairs: ([A-Z]{2})\s+(\d{6})
  let match: RegExpExecArray | null;
  const regex = new RegExp(FULL_TICKET_PATTERN.source, "g");
  let foundAny = false;

  while ((match = regex.exec(text)) !== null) {
    foundAny = true;
    const seriesCode = match[2]!.toUpperCase();
    const canonicalNumber = match[3]!;
    const location = match[4]?.trim();

    // 1. Validated Series Entity
    const seriesId = `${documentSha256}_series_${seriesCode}_${page.pageNumber}_${block.order}`;
    const seriesEntity: Series = {
      id: seriesId,
      documentSha256,
      pageId: page.id,
      pageNumber: page.pageNumber,
      sourceTextBlockOrders: [block.order],
      rawSourceText: seriesCode,
      boundingBox: blockBox,
      parserRule: RULE_SERIES_EXTRACTION,
      parserVersion,
      code: seriesCode,
      confidence: 1.0,
      createdAt
    };
    seriesList.push(seriesEntity);

    // 2. Validated Winning Result Entity
    const resultId = `${tier.id}_result_${canonicalNumber}_${seriesCode}`;
    const winningResult: WinningResult = {
      id: resultId,
      documentSha256,
      pageId: page.id,
      pageNumber: page.pageNumber,
      sourceTextBlockOrders: [block.order],
      rawSourceText: match[0].trim(),
      boundingBox: blockBox,
      parserRule: RULE_RESULT_FULL_TICKET,
      parserVersion,
      drawId,
      prizeTierId: tier.id,
      prizeTierName: tier.name,
      rank: tier.rank,
      amount: tier.amount,
      series: seriesCode,
      canonicalNumber,
      numberLength: 6,
      isSuffix: false,
      location,
      confidence: 1.0,
      validationStatus: "VALID",
      createdAt
    };
    winningResults.push(winningResult);

    // 3. Validated Winning Number Entity
    const winningNumberId = `${tier.id}_num_${canonicalNumber}_${seriesCode}`;
    const winningNumber: WinningNumber = {
      id: winningNumberId,
      documentSha256,
      pageId: page.id,
      pageNumber: page.pageNumber,
      sourceTextBlockOrders: [block.order],
      rawSourceText: canonicalNumber,
      boundingBox: blockBox,
      parserRule: RULE_RESULT_FULL_TICKET,
      parserVersion,
      drawId,
      prizeTierId: tier.id,
      prizeTierName: tier.name,
      rank: tier.rank,
      amount: tier.amount,
      series: seriesCode,
      canonicalNumber,
      numberLength: 6,
      isSuffix: false,
      resultType: tier.tierType === "CONSOLATION" ? "CONSOLATION" : "PRIMARY",
      sourceDocumentId: documentSha256,
      sourcePage: page.pageNumber,
      sourceText: match[0].trim(),
      confidence: 1.0,
      validationStatus: "VALID",
      derivedNumericValue: parseInt(canonicalNumber, 10),
      createdAt
    };
    winningNumbers.push(winningNumber);
  }

  // If no full ticket matches found in this block, check for malformed or ambiguous tokens
  if (!foundAny) {
    const tokens = text.split(/\s+/).filter(Boolean);
    for (const tok of tokens) {
      if (/^\d{6}$/.test(tok)) {
        // Missing series for full ticket tier
        rejectedCandidates.push({
          reason: "MALFORMED_SERIES",
          rawText: tok,
          pageNumber: page.pageNumber,
          textBlockOrder: block.order,
          boundingBox: blockBox,
          ruleId: RULE_VALIDATION_FORMAT,
          detail: `6-digit ticket '${tok}' in tier '${tier.name}' missing 2-letter uppercase series prefix`
        });
      } else if (/\d+/.test(tok) && !tok.startsWith("Rs") && !tok.endsWith("/-")) {
        rejectedCandidates.push({
          reason: "AMBIGUOUS",
          rawText: tok,
          pageNumber: page.pageNumber,
          textBlockOrder: block.order,
          boundingBox: blockBox,
          ruleId: RULE_VALIDATION_FORMAT,
          detail: `Ambiguous token '${tok}' in full-ticket tier '${tier.name}'`
        });
      }
    }
  }
}

function processSuffixNumberTokens(
  text: string,
  tier: PrizeTier,
  page: DocumentPage,
  block: TextBlock,
  documentSha256: string,
  drawId: string,
  parserVersion: string,
  createdAt: string,
  winningResults: WinningResult[],
  winningNumbers: WinningNumber[],
  rejectedCandidates: RejectedCandidate[]
): void {
  const blockBox: RegionBoundingBox = {
    x: block.x,
    y: block.y,
    width: block.width,
    height: block.height,
    top: block.top,
    unit: "pt"
  };

  const tokens = text.split(/\s+/).filter(Boolean);

  for (const token of tokens) {
    // Check if token is exactly 4 digits (preserving leading zeros, e.g. "0259")
    if (SUFFIX_NUMBER_PATTERN.test(token)) {
      const canonicalNumber = token;
      const resultId = `${tier.id}_result_${canonicalNumber}`;

      const winningResult: WinningResult = {
        id: resultId,
        documentSha256,
        pageId: page.id,
        pageNumber: page.pageNumber,
        sourceTextBlockOrders: [block.order],
        rawSourceText: token,
        boundingBox: blockBox,
        parserRule: RULE_RESULT_SUFFIX_NUMBER,
        parserVersion,
        drawId,
        prizeTierId: tier.id,
        prizeTierName: tier.name,
        rank: tier.rank,
        amount: tier.amount,
        series: undefined,
        canonicalNumber,
        numberLength: 4,
        isSuffix: true,
        confidence: 1.0,
        validationStatus: "VALID",
        createdAt
      };
      winningResults.push(winningResult);

      const winningNumberId = `${tier.id}_num_${canonicalNumber}`;
      const winningNumber: WinningNumber = {
        id: winningNumberId,
        documentSha256,
        pageId: page.id,
        pageNumber: page.pageNumber,
        sourceTextBlockOrders: [block.order],
        rawSourceText: token,
        boundingBox: blockBox,
        parserRule: RULE_RESULT_SUFFIX_NUMBER,
        parserVersion,
        drawId,
        prizeTierId: tier.id,
        prizeTierName: tier.name,
        rank: tier.rank,
        amount: tier.amount,
        series: undefined,
        canonicalNumber,
        numberLength: 4,
        isSuffix: true,
        suffixLength: 4,
        resultType: "SUFFIX",
        sourceDocumentId: documentSha256,
        sourcePage: page.pageNumber,
        sourceText: token,
        confidence: 1.0,
        validationStatus: "VALID",
        derivedNumericValue: parseInt(canonicalNumber, 10),
        createdAt
      };
      winningNumbers.push(winningNumber);
    } else if (/^\d+$/.test(token)) {
      // Numeric token but not 4 digits (e.g. 3 digits or 5 digits)
      rejectedCandidates.push({
        reason: "INVALID_LENGTH",
        rawText: token,
        pageNumber: page.pageNumber,
        textBlockOrder: block.order,
        boundingBox: blockBox,
        ruleId: RULE_VALIDATION_FORMAT,
        detail: `Expected 4 digits for suffix tier '${tier.name}', received '${token}' (length ${token.length})`
      });
    } else if (/[A-Za-z0-9]/.test(token) && !token.includes("/-") && !token.startsWith("Rs")) {
      // Mixed alphanumeric or non-numeric token
      rejectedCandidates.push({
        reason: "NON_NUMERIC",
        rawText: token,
        pageNumber: page.pageNumber,
        textBlockOrder: block.order,
        boundingBox: blockBox,
        ruleId: RULE_VALIDATION_FORMAT,
        detail: `Non-numeric or malformed candidate '${token}' in suffix tier '${tier.name}'`
      });
    }
  }
}

function deduplicateById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      result.push(item);
    }
  }
  return result;
}

// ============================================================================
// Service Class
// ============================================================================

export class LotteryEntityExtractorService {
  public readonly parserVersion: string;

  constructor(parserVersion?: string) {
    this.parserVersion = parserVersion || DEFAULT_ENTITY_PARSER_VERSION;
  }

  public extract(
    segmentation: DocumentSemanticSegmentation,
    pages: readonly DocumentPage[],
    options?: LotteryEntityExtractionOptions
  ): LotteryEntityExtractionResult {
    return extractLotteryEntitiesFromDocument(segmentation, pages, {
      parserVersion: options?.parserVersion || this.parserVersion,
      createdAt: options?.createdAt
    });
  }
}
