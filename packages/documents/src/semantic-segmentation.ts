/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 3D: Semantic Document Classification & Region Segmentation
 *
 * Implements the first deterministic semantic interpretation layer on top of
 * the Milestone 3C DocumentPage + TextBlock physical observation layer.
 *
 * Invariants:
 * - Deterministic, reversible, auditable rules only (no LLMs, no probabilistic classifiers).
 * - Full provenance: SemanticField/Region -> DocumentPage.id -> TextBlock.order/box -> documentSha256 -> immutable PDF.
 * - Semantic versioning: v1.0.0-semantic-regions (separate from 3C extraction version v1.0.0-text-layout).
 * - Strict scope boundary: Observes and demarcates regions; DOES NOT extract winning numbers or ticket models.
 */

import type {
  DocumentPage,
  TextBlock,
  SemanticDocumentKind,
  SemanticRegionType,
  RegionBoundingBox,
  SemanticRegion,
  SemanticField,
  DrawMetadata,
  ClassificationEvidence,
  DocumentClassificationResult,
  DocumentSemanticSegmentation
} from "@kerala-lottery/domain";
import { DEFAULT_SEMANTIC_VERSION } from "@kerala-lottery/domain";
import { DocumentValidationError } from "./index";

export { DEFAULT_SEMANTIC_VERSION };
export type {
  SemanticDocumentKind,
  SemanticRegionType,
  RegionBoundingBox,
  SemanticRegion,
  SemanticField,
  DrawMetadata,
  ClassificationEvidence,
  DocumentClassificationResult,
  DocumentSemanticSegmentation
};

// ============================================================================
// Rule Identifiers
// ============================================================================

export const RULE_CLASSIFICATION_HEADER = "rule.classification.header_v1";
export const RULE_CLASSIFICATION_DRAW_HEADING = "rule.classification.draw_heading_v1";
export const RULE_CLASSIFICATION_PORTAL = "rule.classification.portal_v1";

export const RULE_REGION_HEADER = "rule.region.header_v1";
export const RULE_REGION_DRAW_METADATA = "rule.region.draw_metadata_v1";
export const RULE_REGION_PRIZE_STRUCTURE = "rule.region.prize_structure_v1";
export const RULE_REGION_LEGAL_CLAIMS_FOOTER = "rule.region.legal_claims_footer_v1";
export const RULE_REGION_CERTIFICATION = "rule.region.certification_v1";

export const RULE_DRAW_METADATA_REGEX = "rule.draw_metadata.regex_v1";

// ============================================================================
// Classification Engine
// ============================================================================

/**
 * Deterministically classifies a set of document pages based on explicit physical evidence.
 * Does not use LLMs or probabilistic estimation.
 */
export function classifyDocumentPages(
  pages: readonly DocumentPage[],
  options?: { semanticVersion?: string }
): DocumentClassificationResult {
  const semanticVersion = options?.semanticVersion || DEFAULT_SEMANTIC_VERSION;

  if (!pages || pages.length === 0) {
    return {
      documentSha256: "",
      kind: "UNCLASSIFIED",
      confidence: 0,
      evidence: [],
      ruleId: "rule.classification.none",
      semanticVersion
    };
  }

  const documentSha256 = pages[0]!.documentSha256;
  const page1 = pages.find((p) => p.pageNumber === 1);

  if (!page1 || page1.textBlocks.length === 0) {
    return {
      documentSha256,
      kind: "UNCLASSIFIED",
      confidence: 0,
      evidence: [],
      ruleId: "rule.classification.no_page1_text",
      semanticVersion
    };
  }

  const evidence: ClassificationEvidence[] = [];

  // Rule 1: Official Header banner match
  for (const block of page1.textBlocks.slice(0, 5)) {
    if (
      /KERALA\s+STATE\s+LOTTERIES/i.test(block.text) &&
      /RESULT/i.test(block.text)
    ) {
      evidence.push({
        ruleId: RULE_CLASSIFICATION_HEADER,
        description: "Official banner header matches 'KERALA STATE LOTTERIES - RESULT'",
        matchedText: block.text,
        pageNumber: 1,
        textBlockOrder: block.order
      });
      break;
    }
  }

  // Rule 2: Official portal URL / domain match
  for (const block of page1.textBlocks.slice(0, 5)) {
    if (
      /statelottery\.kerala\.gov\.in/i.test(block.text) ||
      /keralalotteries\.com/i.test(block.text)
    ) {
      evidence.push({
        ruleId: RULE_CLASSIFICATION_PORTAL,
        description: "Official publication portal URL reference present in document header",
        matchedText: block.text,
        pageNumber: 1,
        textBlockOrder: block.order
      });
      break;
    }
  }

  // Rule 3: Draw heading match: <NAME> LOTTERY NO.<ID> DRAW held on <DATE>
  const drawHeadingRegex =
    /\b([A-Z\s-]+?)\s+LOTTERY\s+NO\.?\s*([A-Z0-9thndrs\/\.-]+)\s+DRAW\s+held\s+on\b/i;

  for (const block of page1.textBlocks.slice(0, 8)) {
    if (drawHeadingRegex.test(block.text)) {
      evidence.push({
        ruleId: RULE_CLASSIFICATION_DRAW_HEADING,
        description: "Official draw heading matching '<NAME> LOTTERY NO.<ID> DRAW held on'",
        matchedText: block.text,
        pageNumber: 1,
        textBlockOrder: block.order
      });
      break;
    }
  }

  // Deterministic Classification Decision
  // A document is classified as LOTTERY_RESULT if both the header banner and draw heading rules match
  const hasHeader = evidence.some((e) => e.ruleId === RULE_CLASSIFICATION_HEADER);
  const hasDrawHeading = evidence.some((e) => e.ruleId === RULE_CLASSIFICATION_DRAW_HEADING);

  if (hasHeader && hasDrawHeading) {
    return {
      documentSha256,
      kind: "LOTTERY_RESULT",
      confidence: 1.0,
      evidence,
      ruleId: "rule.classification.lottery_result_v1",
      semanticVersion
    };
  }

  return {
    documentSha256,
    kind: "UNCLASSIFIED",
    confidence: 0,
    evidence,
    ruleId: "rule.classification.insufficient_evidence",
    semanticVersion
  };
}

// ============================================================================
// Draw Metadata Extraction Engine
// ============================================================================

/**
 * Extracts document-level draw metadata from the DRAW_METADATA region on Page 1.
 * Retains exact provenance back to source text blocks, bounding boxes, and rule IDs.
 */
export function extractDrawMetadata(
  pages: readonly DocumentPage[],
  classification: DocumentClassificationResult
): DrawMetadata | undefined {
  if (classification.kind !== "LOTTERY_RESULT") {
    return undefined;
  }

  const page1 = pages.find((p) => p.pageNumber === 1);
  if (!page1) return undefined;

  const drawHeadingRegex =
    /^([A-Z\s-]+?)\s+LOTTERY\s+NO\.?\s*([A-Z0-9thndrs\/\.-]+)\s+DRAW\s+held\s+on(?::-)?\s*(\d{2}[\/\.-]\d{2}[\/\.-]\d{4})(?:[,\s]+([0-9:AMP\s]+))?/i;

  let headingBlock: TextBlock | undefined;
  let headingMatch: RegExpMatchArray | null = null;
  let headingIndex = -1;

  for (let i = 0; i < Math.min(10, page1.textBlocks.length); i++) {
    const b = page1.textBlocks[i]!;
    const match = b.text.match(drawHeadingRegex);
    if (match) {
      headingBlock = b;
      headingMatch = match;
      headingIndex = i;
      break;
    }
  }

  if (!headingBlock || !headingMatch) {
    return undefined;
  }

  const lotteryNameRaw = headingMatch[1]?.trim() || "";
  const drawNumberRaw = headingMatch[2]?.trim() || "";
  const drawDateRaw = headingMatch[3]?.trim() || "";
  const drawTimeRaw = headingMatch[4]?.trim() || undefined;

  const box = {
    x: headingBlock.x,
    y: headingBlock.y,
    width: headingBlock.width,
    height: headingBlock.height,
    top: headingBlock.top
  };

  const metadata: DrawMetadata = {};

  if (lotteryNameRaw) {
    metadata.lotteryName = {
      name: "lotteryName",
      value: lotteryNameRaw,
      rawText: headingBlock.text,
      sourceDocumentSha256: page1.documentSha256,
      sourcePageId: page1.id,
      sourcePageNumber: page1.pageNumber,
      textBlockOrder: headingBlock.order,
      boundingBox: box,
      ruleId: RULE_DRAW_METADATA_REGEX,
      confidence: 1.0
    };
  }

  if (drawNumberRaw) {
    metadata.drawNumber = {
      name: "drawNumber",
      value: drawNumberRaw,
      rawText: headingBlock.text,
      sourceDocumentSha256: page1.documentSha256,
      sourcePageId: page1.id,
      sourcePageNumber: page1.pageNumber,
      textBlockOrder: headingBlock.order,
      boundingBox: box,
      ruleId: RULE_DRAW_METADATA_REGEX,
      confidence: 1.0
    };
  }

  if (drawDateRaw) {
    metadata.drawDate = {
      name: "drawDate",
      value: drawDateRaw,
      rawText: headingBlock.text,
      sourceDocumentSha256: page1.documentSha256,
      sourcePageId: page1.id,
      sourcePageNumber: page1.pageNumber,
      textBlockOrder: headingBlock.order,
      boundingBox: box,
      ruleId: RULE_DRAW_METADATA_REGEX,
      confidence: 1.0
    };
  }

  if (drawTimeRaw) {
    metadata.drawTime = {
      name: "drawTime",
      value: drawTimeRaw,
      rawText: headingBlock.text,
      sourceDocumentSha256: page1.documentSha256,
      sourcePageId: page1.id,
      sourcePageNumber: page1.pageNumber,
      textBlockOrder: headingBlock.order,
      boundingBox: box,
      ruleId: RULE_DRAW_METADATA_REGEX,
      confidence: 1.0
    };
  }

  // Location typically follows immediately on the next block
  if (headingIndex >= 0 && headingIndex + 1 < page1.textBlocks.length) {
    const nextBlock = page1.textBlocks[headingIndex + 1]!;
    if (
      /^(?:AT\s+)?([A-Z0-9\s,.-]+(?:BHAVAN|JUNCTION|THIRUVANANTHAPURAM|HALL|AUDITORIUM)[A-Z0-9\s,.-]*)/i.test(
        nextBlock.text
      ) ||
      /^AT\s+/i.test(nextBlock.text)
    ) {
      const locationRaw = nextBlock.text.replace(/^AT\s+/i, "").trim();
      metadata.location = {
        name: "location",
        value: locationRaw,
        rawText: nextBlock.text,
        sourceDocumentSha256: page1.documentSha256,
        sourcePageId: page1.id,
        sourcePageNumber: page1.pageNumber,
        textBlockOrder: nextBlock.order,
        boundingBox: {
          x: nextBlock.x,
          y: nextBlock.y,
          width: nextBlock.width,
          height: nextBlock.height,
          top: nextBlock.top
        },
        ruleId: RULE_DRAW_METADATA_REGEX,
        confidence: 1.0
      };
    }
  }

  return metadata;
}

// ============================================================================
// Region Segmentation Engine
// ============================================================================

/**
 * Computes an aggregated bounding box in 3C geometry (unit: pt, origin: BOTTOM_LEFT)
 * encompassing all supplied text blocks.
 */
function computeAggregateBoundingBox(
  blocks: readonly TextBlock[],
  pageHeight: number
): RegionBoundingBox {
  if (blocks.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0, top: 0, unit: "pt" };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let minTop = Infinity;

  for (const b of blocks) {
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    const right = b.x + b.width;
    const topEdge = b.y + b.height;
    if (right > maxX) maxX = right;
    if (topEdge > maxY) maxY = topEdge;

    const blockTop = b.top ?? pageHeight - (b.y + b.height);
    if (blockTop < minTop) minTop = blockTop;
  }

  return {
    x: Number(minX.toFixed(2)),
    y: Number(minY.toFixed(2)),
    width: Number((maxX - minX).toFixed(2)),
    height: Number((maxY - minY).toFixed(2)),
    top: Number(minTop.toFixed(2)),
    unit: "pt"
  };
}

/**
 * Segments document pages into deterministic semantic regions.
 */
export function segmentDocumentRegions(
  pages: readonly DocumentPage[],
  classification: DocumentClassificationResult
): SemanticRegion[] {
  if (classification.kind !== "LOTTERY_RESULT") {
    return [];
  }

  const regions: SemanticRegion[] = [];

  for (const page of pages) {
    if (page.textBlocks.length === 0) {
      continue;
    }

    // Helper to filter out bottom system print footer if present
    const isSystemFooter = (b: TextBlock) =>
      b.y < 30 &&
      /\b(?:\d{2}[\/\.-]\d{2}[\/\.-]\d{4}|\d{2}:\d{2}:\d{2})\b.*(?:Department of State Lotteries|Software Division|Page\s+\d+)/i.test(
        b.text
      );

    const contentBlocks = page.textBlocks.filter((b) => !isSystemFooter(b));

    if (page.pageNumber === 1) {
      // Page 1 contains: HEADER, DRAW_METADATA, PRIZE_STRUCTURE
      const headerBlocks: TextBlock[] = [];
      const drawMetadataBlocks: TextBlock[] = [];
      const prizeBlocks: TextBlock[] = [];

      let state: "IN_HEADER" | "IN_DRAW_METADATA" | "IN_PRIZE" = "IN_HEADER";

      for (let i = 0; i < contentBlocks.length; i++) {
        const b = contentBlocks[i]!;

        if (state === "IN_HEADER") {
          if (
            /\b([A-Z\s-]+?)\s+LOTTERY\s+NO\.?\s*([A-Z0-9thndrs\/\.-]+)\s+DRAW\s+held\s+on\b/i.test(
              b.text
            )
          ) {
            state = "IN_DRAW_METADATA";
            drawMetadataBlocks.push(b);
          } else {
            headerBlocks.push(b);
          }
        } else if (state === "IN_DRAW_METADATA") {
          // Check if this block is the location or already a prize tier heading
          if (
            /^(?:1st|2nd|3rd|4th|5th|6th|7th|8th|Cons(?:olation)?)\s+Prize/i.test(
              b.text
            )
          ) {
            state = "IN_PRIZE";
            prizeBlocks.push(b);
          } else {
            drawMetadataBlocks.push(b);
          }
        } else {
          prizeBlocks.push(b);
        }
      }

      if (headerBlocks.length > 0) {
        regions.push({
          id: `${page.id}_HEADER`,
          documentSha256: page.documentSha256,
          pageId: page.id,
          pageNumber: page.pageNumber,
          type: "HEADER",
          textBlockOrders: headerBlocks.map((b) => b.order),
          boundingBox: computeAggregateBoundingBox(headerBlocks, page.pageHeight),
          confidence: 1.0,
          ruleId: RULE_REGION_HEADER,
          evidence: ["Official Department Header and Contact Information"],
          summaryText: headerBlocks.map((b) => b.text).join(" ")
        });
      }

      if (drawMetadataBlocks.length > 0) {
        regions.push({
          id: `${page.id}_DRAW_METADATA`,
          documentSha256: page.documentSha256,
          pageId: page.id,
          pageNumber: page.pageNumber,
          type: "DRAW_METADATA",
          textBlockOrders: drawMetadataBlocks.map((b) => b.order),
          boundingBox: computeAggregateBoundingBox(
            drawMetadataBlocks,
            page.pageHeight
          ),
          confidence: 1.0,
          ruleId: RULE_REGION_DRAW_METADATA,
          evidence: ["Lottery Draw Name, Number, Date, and Location Announcement"],
          summaryText: drawMetadataBlocks.map((b) => b.text).join(" ")
        });
      }

      if (prizeBlocks.length > 0) {
        regions.push({
          id: `${page.id}_PRIZE_STRUCTURE`,
          documentSha256: page.documentSha256,
          pageId: page.id,
          pageNumber: page.pageNumber,
          type: "PRIZE_STRUCTURE",
          textBlockOrders: prizeBlocks.map((b) => b.order),
          boundingBox: computeAggregateBoundingBox(prizeBlocks, page.pageHeight),
          confidence: 1.0,
          ruleId: RULE_REGION_PRIZE_STRUCTURE,
          evidence: ["Winning Prize Tiers, Amounts, and Serial Numbers"],
          summaryText: `${prizeBlocks.length} prize structure text blocks on Page 1`
        });
      }
    } else if (page.pageNumber === page.pageCount) {
      // Final page contains: PRIZE_STRUCTURE (continuation), LEGAL_CLAIMS_FOOTER, CERTIFICATION
      const prizeBlocks: TextBlock[] = [];
      const legalBlocks: TextBlock[] = [];
      const certBlocks: TextBlock[] = [];

      let state: "IN_PRIZE" | "IN_LEGAL" | "IN_CERT" = "IN_PRIZE";

      for (let i = 0; i < contentBlocks.length; i++) {
        const b = contentBlocks[i]!;

        if (state === "IN_PRIZE") {
          if (
            /The prize winners are advised to verify/i.test(b.text) ||
            /Government Gazette and surrender/i.test(b.text)
          ) {
            state = "IN_LEGAL";
            legalBlocks.push(b);
          } else {
            prizeBlocks.push(b);
          }
        } else if (state === "IN_LEGAL") {
          if (
            /Sd\/-/i.test(b.text) ||
            /Joint Director|Deputy Director|Director/i.test(b.text) ||
            /Next .* Draw will be held on/i.test(b.text)
          ) {
            state = "IN_CERT";
            certBlocks.push(b);
          } else if (/Government Gazette and surrender/i.test(b.text)) {
            legalBlocks.push(b);
          } else {
            legalBlocks.push(b);
          }
        } else {
          certBlocks.push(b);
        }
      }

      if (prizeBlocks.length > 0) {
        regions.push({
          id: `${page.id}_PRIZE_STRUCTURE`,
          documentSha256: page.documentSha256,
          pageId: page.id,
          pageNumber: page.pageNumber,
          type: "PRIZE_STRUCTURE",
          textBlockOrders: prizeBlocks.map((b) => b.order),
          boundingBox: computeAggregateBoundingBox(prizeBlocks, page.pageHeight),
          confidence: 1.0,
          ruleId: RULE_REGION_PRIZE_STRUCTURE,
          evidence: ["Winning Prize Numbers (Final Page Continuation)"],
          summaryText: `${prizeBlocks.length} prize structure text blocks on Page ${page.pageNumber}`
        });
      }

      if (legalBlocks.length > 0) {
        regions.push({
          id: `${page.id}_LEGAL_CLAIMS_FOOTER`,
          documentSha256: page.documentSha256,
          pageId: page.id,
          pageNumber: page.pageNumber,
          type: "LEGAL_CLAIMS_FOOTER",
          textBlockOrders: legalBlocks.map((b) => b.order),
          boundingBox: computeAggregateBoundingBox(legalBlocks, page.pageHeight),
          confidence: 1.0,
          ruleId: RULE_REGION_LEGAL_CLAIMS_FOOTER,
          evidence: ["Statutory Prize Claim Verification and 90-Day Surrender Terms"],
          summaryText: legalBlocks.map((b) => b.text).join(" ")
        });
      }

      if (certBlocks.length > 0) {
        regions.push({
          id: `${page.id}_CERTIFICATION`,
          documentSha256: page.documentSha256,
          pageId: page.id,
          pageNumber: page.pageNumber,
          type: "CERTIFICATION",
          textBlockOrders: certBlocks.map((b) => b.order),
          boundingBox: computeAggregateBoundingBox(certBlocks, page.pageHeight),
          confidence: 1.0,
          ruleId: RULE_REGION_CERTIFICATION,
          evidence: ["Directorate Official Signatory Certification and Next Draw Schedule"],
          summaryText: certBlocks.map((b) => b.text).join(" ")
        });
      }
    } else {
      // Intermediate pages: entire content is PRIZE_STRUCTURE
      if (contentBlocks.length > 0) {
        regions.push({
          id: `${page.id}_PRIZE_STRUCTURE`,
          documentSha256: page.documentSha256,
          pageId: page.id,
          pageNumber: page.pageNumber,
          type: "PRIZE_STRUCTURE",
          textBlockOrders: contentBlocks.map((b) => b.order),
          boundingBox: computeAggregateBoundingBox(contentBlocks, page.pageHeight),
          confidence: 1.0,
          ruleId: RULE_REGION_PRIZE_STRUCTURE,
          evidence: [`Prize Result Continuation on Page ${page.pageNumber}`],
          summaryText: `${contentBlocks.length} prize structure text blocks on Page ${page.pageNumber}`
        });
      }
    }
  }

  return regions;
}

// ============================================================================
// Complete Semantic Segmentation Service
// ============================================================================

export interface SemanticSegmentationOptions {
  semanticVersion?: string;
  createdAt?: string;
}

export class DocumentSemanticSegmentationService {
  public readonly semanticVersion: string;

  constructor(semanticVersion?: string) {
    this.semanticVersion = semanticVersion || DEFAULT_SEMANTIC_VERSION;
  }

  /**
   * Segments a set of extracted DocumentPage observations into semantic regions
   * and extracts document-level draw metadata.
   */
  public segmentDocument(
    pages: readonly DocumentPage[],
    options?: SemanticSegmentationOptions
  ): DocumentSemanticSegmentation {
    if (!pages || pages.length === 0) {
      throw new DocumentValidationError(
        "Cannot perform semantic segmentation on empty page list",
        "EMPTY_PAGES"
      );
    }

    const documentSha256 = pages[0]!.documentSha256;
    for (const p of pages) {
      if (p.documentSha256 !== documentSha256) {
        throw new DocumentValidationError(
          `All pages must belong to documentSha256 '${documentSha256}', found '${p.documentSha256}' on page ${p.pageNumber}`,
          "DOCUMENT_SHA_MISMATCH"
        );
      }
    }

    const semanticVersion = options?.semanticVersion || this.semanticVersion;
    const createdAt = options?.createdAt || new Date().toISOString();
    const extractionVersion = pages[0]!.extractionVersion;

    const classification = classifyDocumentPages(pages, { semanticVersion });
    const drawMetadata = extractDrawMetadata(pages, classification);
    const regions = segmentDocumentRegions(pages, classification);

    const segmentation: DocumentSemanticSegmentation = {
      id: documentSha256,
      documentSha256,
      classification,
      regions,
      drawMetadata,
      pageCount: pages.length,
      extractionVersion,
      semanticVersion,
      createdAt
    };

    validateDocumentSemanticSegmentation(segmentation);
    return segmentation;
  }
}

// ============================================================================
// Domain Invariant Validators
// ============================================================================

export function validateSemanticRegion(region: SemanticRegion): void {
  if (!region || typeof region !== "object") {
    throw new DocumentValidationError("SemanticRegion must be an object", "INVALID_REGION");
  }
  if (!region.id || typeof region.id !== "string") {
    throw new DocumentValidationError("SemanticRegion id must be a string", "INVALID_REGION_ID");
  }
  if (!region.documentSha256 || !/^[a-f0-9]{64}$/.test(region.documentSha256)) {
    throw new DocumentValidationError(
      `SemanticRegion documentSha256 must be 64-char lowercase hex, received '${region.documentSha256}'`,
      "INVALID_SHA256"
    );
  }
  if (!Number.isInteger(region.pageNumber) || region.pageNumber < 1) {
    throw new DocumentValidationError(
      `SemanticRegion pageNumber must be a positive integer, received ${region.pageNumber}`,
      "INVALID_PAGE_NUMBER"
    );
  }
  const validTypes: SemanticRegionType[] = [
    "HEADER",
    "DRAW_METADATA",
    "PRIZE_STRUCTURE",
    "CERTIFICATION",
    "LEGAL_CLAIMS_FOOTER"
  ];
  if (!validTypes.includes(region.type)) {
    throw new DocumentValidationError(
      `SemanticRegion type must be one of [${validTypes.join(", ")}], received '${region.type}'`,
      "INVALID_REGION_TYPE"
    );
  }
  if (!Array.isArray(region.textBlockOrders)) {
    throw new DocumentValidationError(
      "SemanticRegion textBlockOrders must be an array",
      "INVALID_BLOCK_ORDERS"
    );
  }
  if (!region.boundingBox || typeof region.boundingBox !== "object") {
    throw new DocumentValidationError(
      "SemanticRegion boundingBox must be an object",
      "INVALID_BOUNDING_BOX"
    );
  }
  if (region.boundingBox.unit !== "pt") {
    throw new DocumentValidationError("RegionBoundingBox unit must be 'pt'", "INVALID_UNIT");
  }
  if (typeof region.confidence !== "number" || region.confidence < 0 || region.confidence > 1) {
    throw new DocumentValidationError("SemanticRegion confidence must be between 0 and 1", "INVALID_CONFIDENCE");
  }
}

export function validateSemanticField(field: SemanticField): void {
  if (!field || typeof field !== "object") {
    throw new DocumentValidationError("SemanticField must be an object", "INVALID_FIELD");
  }
  if (!field.name || typeof field.name !== "string") {
    throw new DocumentValidationError("SemanticField name must be a string", "INVALID_FIELD_NAME");
  }
  if (field.value === undefined || field.value === null) {
    throw new DocumentValidationError("SemanticField value cannot be null/undefined", "INVALID_FIELD_VALUE");
  }
  if (!field.sourceDocumentSha256 || !/^[a-f0-9]{64}$/.test(field.sourceDocumentSha256)) {
    throw new DocumentValidationError("SemanticField sourceDocumentSha256 must be 64-char hex", "INVALID_SHA256");
  }
  if (!Number.isInteger(field.sourcePageNumber) || field.sourcePageNumber < 1) {
    throw new DocumentValidationError("SemanticField sourcePageNumber must be >= 1", "INVALID_PAGE_NUMBER");
  }
  if (!Number.isInteger(field.textBlockOrder) || field.textBlockOrder < 0) {
    throw new DocumentValidationError("SemanticField textBlockOrder must be >= 0", "INVALID_BLOCK_ORDER");
  }
}

export function validateDocumentSemanticSegmentation(seg: DocumentSemanticSegmentation): void {
  if (!seg || typeof seg !== "object") {
    throw new DocumentValidationError(
      "DocumentSemanticSegmentation must be an object",
      "INVALID_SEGMENTATION"
    );
  }
  if (!seg.documentSha256 || !/^[a-f0-9]{64}$/.test(seg.documentSha256)) {
    throw new DocumentValidationError(
      `DocumentSemanticSegmentation documentSha256 must be 64-char hex, received '${seg.documentSha256}'`,
      "INVALID_SHA256"
    );
  }
  if (seg.id !== seg.documentSha256) {
    throw new DocumentValidationError(
      `DocumentSemanticSegmentation id ('${seg.id}') must match documentSha256 ('${seg.documentSha256}')`,
      "ID_MISMATCH"
    );
  }
  if (!seg.classification || typeof seg.classification !== "object") {
    throw new DocumentValidationError(
      "DocumentSemanticSegmentation classification must be an object",
      "INVALID_CLASSIFICATION"
    );
  }
  if (!Array.isArray(seg.regions)) {
    throw new DocumentValidationError("DocumentSemanticSegmentation regions must be an array", "INVALID_REGIONS");
  }
  for (const r of seg.regions) {
    validateSemanticRegion(r);
  }
  if (seg.drawMetadata) {
    if (seg.drawMetadata.lotteryName) validateSemanticField(seg.drawMetadata.lotteryName);
    if (seg.drawMetadata.drawNumber) validateSemanticField(seg.drawMetadata.drawNumber);
    if (seg.drawMetadata.drawDate) validateSemanticField(seg.drawMetadata.drawDate);
    if (seg.drawMetadata.drawTime) validateSemanticField(seg.drawMetadata.drawTime);
    if (seg.drawMetadata.location) validateSemanticField(seg.drawMetadata.location);
  }
  if (!seg.semanticVersion || typeof seg.semanticVersion !== "string") {
    throw new DocumentValidationError(
      "DocumentSemanticSegmentation semanticVersion must be a string",
      "INVALID_SEMANTIC_VERSION"
    );
  }
  if (!seg.extractionVersion || typeof seg.extractionVersion !== "string") {
    throw new DocumentValidationError(
      "DocumentSemanticSegmentation extractionVersion must be a string",
      "INVALID_EXTRACTION_VERSION"
    );
  }
}
