import { describe, it, expect, beforeEach } from "vitest";
import type { SourceDocument } from "@kerala-lottery/domain";
import {
  DEV_SYNTHETIC_LAYOUT_FIXTURE_BYTES,
  DEV_SYNTHETIC_LAYOUT_FIXTURE_SHA256,
  extractPdfPages,
  getDocumentPageId,
  validateDocumentPage,
  DEFAULT_EXTRACTION_VERSION,
  DEFAULT_EXTRACTION_METHOD,
  DocumentValidationError,
  getSourceStoragePath
} from "@kerala-lottery/documents";
import {
  InMemoryDocumentRepository,
  InMemoryDocumentPageRepository,
  InMemoryStorageService,
  type DocumentPage
} from "@kerala-lottery/data";
import { PageExtractionService } from "./page-extraction";

describe("Milestone 3C — Page-Level Text & Layout Segmentation Foundation", () => {
  let docRepo: InMemoryDocumentRepository;
  let pageRepo: InMemoryDocumentPageRepository;
  let storage: InMemoryStorageService;
  let extractionService: PageExtractionService;

  const validSha256 = DEV_SYNTHETIC_LAYOUT_FIXTURE_SHA256;
  const validStoragePath = getSourceStoragePath(validSha256);

  const testSourceDoc: SourceDocument = {
    id: validSha256,
    type: "LOTTERY_RESULT",
    title: "Synthetic Multi-Page Layout Test Fixture",
    storagePath: validStoragePath,
    sha256: validSha256,
    mimeType: "application/pdf",
    fileSize: DEV_SYNTHETIC_LAYOUT_FIXTURE_BYTES.byteLength,
    sourceOrganization: "Directorate of Kerala State Lotteries",
    retrievedAt: new Date().toISOString(),
    ingestionVersion: "v1.1.0-source-acquisition",
    status: "UPLOADED",
    createdAt: new Date().toISOString()
  };

  beforeEach(async () => {
    docRepo = new InMemoryDocumentRepository();
    pageRepo = new InMemoryDocumentPageRepository();
    storage = new InMemoryStorageService();

    // Seed test document in repository and storage
    await docRepo.create(testSourceDoc);
    await storage.putIfAbsent(
      validStoragePath,
      DEV_SYNTHETIC_LAYOUT_FIXTURE_BYTES,
      {
        sha256: validSha256,
        originalFileName: "synthetic-layout.pdf",
        retrievedAt: new Date().toISOString()
      }
    );

    extractionService = new PageExtractionService({
      documentRepository: docRepo,
      documentPageRepository: pageRepo,
      storageService: storage
    });
  });

  // 1. PDF page-count extraction
  it("1. extracts correct total page count from multi-page PDF", async () => {
    const result = await extractPdfPages(
      DEV_SYNTHETIC_LAYOUT_FIXTURE_BYTES,
      validSha256
    );
    expect(result.pageCount).toBe(3);
    expect(result.pages).toHaveLength(3);
  });

  // 2. Page-number correctness (1-based, sequential)
  it("2. enforces 1-based sequential page numbering", async () => {
    const result = await extractPdfPages(
      DEV_SYNTHETIC_LAYOUT_FIXTURE_BYTES,
      validSha256
    );
    expect(result.pages[0]!.pageNumber).toBe(1);
    expect(result.pages[1]!.pageNumber).toBe(2);
    expect(result.pages[2]!.pageNumber).toBe(3);

    for (let i = 0; i < result.pages.length; i++) {
      expect(result.pages[i]!.pageNumber).toBe(i + 1);
      expect(result.pages[i]!.pageCount).toBe(3);
    }
  });

  // 3. Text extraction
  it("3. extracts page-level text correctly without semantic interpretation", async () => {
    const result = await extractPdfPages(
      DEV_SYNTHETIC_LAYOUT_FIXTURE_BYTES,
      validSha256
    );
    expect(result.pages[0]!.text).toContain("KERALA STATE LOTTERIES");
    expect(result.pages[0]!.text).toContain("Milestone 3C Layout Extraction");
    expect(result.pages[1]!.text).toContain("Physical Observation Layer");
    expect(result.pages[2]!.text).toBe(""); // Scanned / image-only test page
  });

  // 4. Text-block extraction
  it("4. preserves structural text blocks with reading order and typography", async () => {
    const result = await extractPdfPages(
      DEV_SYNTHETIC_LAYOUT_FIXTURE_BYTES,
      validSha256
    );
    const page1Blocks = result.pages[0]!.textBlocks;
    expect(page1Blocks.length).toBeGreaterThanOrEqual(2);

    expect(page1Blocks[0]!.order).toBe(0);
    expect(page1Blocks[0]!.text).toBe("KERALA STATE LOTTERIES");
    expect(page1Blocks[0]!.fontName).toBeDefined();

    expect(page1Blocks[1]!.order).toBe(1);
    expect(page1Blocks[1]!.text).toBe("Milestone 3C Layout Extraction");
  });

  // 5. Page dimensions
  it("5. extracts exact page dimensions and PostScript point unit", async () => {
    const result = await extractPdfPages(
      DEV_SYNTHETIC_LAYOUT_FIXTURE_BYTES,
      validSha256
    );
    for (const page of result.pages) {
      expect(page.pageWidth).toBe(612);
      expect(page.pageHeight).toBe(792);
      expect(page.unit).toBe("pt");
    }
  });

  // 6. Coordinate normalization and convention
  it("6. validates bounding box coordinates and derived top-down positions", async () => {
    const result = await extractPdfPages(
      DEV_SYNTHETIC_LAYOUT_FIXTURE_BYTES,
      validSha256
    );
    const b0 = result.pages[0]!.textBlocks[0]!;
    const b1 = result.pages[0]!.textBlocks[1]!;

    // PDF native coordinate origin: bottom-left (y goes up)
    expect(b0.x).toBeGreaterThanOrEqual(0);
    expect(b0.y).toBeGreaterThan(0);
    expect(b0.width).toBeGreaterThan(0);
    expect(b0.height).toBeGreaterThan(0);

    // Derived top coordinate: pageHeight - (y + height)
    expect(b0.top).toBeCloseTo(792 - (b0.y + b0.height), 1);
    expect(b1.top).toBeCloseTo(792 - (b1.y + b1.height), 1);

    // Block 0 (y ~ 700) is visually above Block 1 (y ~ 650)
    expect(b0.y).toBeGreaterThan(b1.y);
    expect(b0.top).toBeLessThan(b1.top!);
  });

  // 7. Image-only page detection
  it("7. distinguishes TEXT_LAYER and IMAGE_ONLY pages deterministically", async () => {
    const result = await extractPdfPages(
      DEV_SYNTHETIC_LAYOUT_FIXTURE_BYTES,
      validSha256
    );
    expect(result.pages[0]!.extractionStatus).toBe("TEXT_LAYER");
    expect(result.pages[1]!.extractionStatus).toBe("TEXT_LAYER");
    expect(result.pages[2]!.extractionStatus).toBe("IMAGE_ONLY");
    expect(result.pages[2]!.textBlocks).toHaveLength(0);
    expect(result.pages[2]!.text).toBe("");
  });

  // 8. Malformed PDF handling
  it("8. rejects malformed PDF content with descriptive error", async () => {
    const malformedPdf = new Uint8Array(
      Buffer.from("%PDF-1.4\nMalformed content without catalog or pages\n%%EOF")
    );
    await expect(
      extractPdfPages(malformedPdf, validSha256)
    ).rejects.toThrowError(DocumentValidationError);
  });

  // 9. Empty and corrupt input handling
  it("9. rejects empty buffers or invalid PDF magic headers", async () => {
    const empty = new Uint8Array(0);
    await expect(extractPdfPages(empty, validSha256)).rejects.toThrowError(
      "PDF buffer cannot be empty (0 bytes)"
    );

    const nonPdf = new Uint8Array(Buffer.from("NOT_A_PDF_DOCUMENT"));
    await expect(extractPdfPages(nonPdf, validSha256)).rejects.toThrowError(
      "Invalid PDF magic header"
    );
  });

  // 10. Deterministic repeated extraction
  it("10. produces identical structural output when run repeatedly on the same PDF", async () => {
    const run1 = await extractPdfPages(
      DEV_SYNTHETIC_LAYOUT_FIXTURE_BYTES,
      validSha256
    );
    const run2 = await extractPdfPages(
      DEV_SYNTHETIC_LAYOUT_FIXTURE_BYTES,
      validSha256
    );

    expect(run1.pageCount).toBe(run2.pageCount);
    for (let i = 0; i < run1.pages.length; i++) {
      const p1 = run1.pages[i]!;
      const p2 = run2.pages[i]!;
      expect(p1.id).toBe(p2.id);
      expect(p1.pageNumber).toBe(p2.pageNumber);
      expect(p1.pageWidth).toBe(p2.pageWidth);
      expect(p1.pageHeight).toBe(p2.pageHeight);
      expect(p1.text).toBe(p2.text);
      expect(p1.textBlocks).toEqual(p2.textBlocks);
      expect(p1.extractionStatus).toBe(p2.extractionStatus);
    }
  });

  // 11. Extraction versioning
  it("11. records and propagates extractionVersion cleanly", async () => {
    const customVersion = "v1.5.0-experimental-layout";
    const result = await extractPdfPages(
      DEV_SYNTHETIC_LAYOUT_FIXTURE_BYTES,
      validSha256,
      { extractionVersion: customVersion }
    );

    expect(result.extractionVersion).toBe(customVersion);
    for (const page of result.pages) {
      expect(page.extractionVersion).toBe(customVersion);
    }
  });

  // 12. Deterministic page identity
  it("12. validates deterministic page identity format ${sha256}_${pageNumber}", () => {
    expect(getDocumentPageId(validSha256, 1)).toBe(`${validSha256}_1`);
    expect(getDocumentPageId(validSha256, 2)).toBe(`${validSha256}_2`);

    // Must reject 0 or negative page number
    expect(() => getDocumentPageId(validSha256, 0)).toThrowError(
      "pageNumber must be a positive 1-based integer"
    );
  });

  // 13. Duplicate page handling & Idempotency
  it("13. achieves idempotency and returns existing page records on repeat extraction", async () => {
    // First run: creates pages
    const firstRun = await extractionService.extractPagesForDocument({
      documentSha256: validSha256
    });
    expect(firstRun.action).toBe("CREATED");
    expect(firstRun.isDuplicate).toBe(false);
    expect(firstRun.pageCount).toBe(3);

    // Verify stored in repository
    const stored = await pageRepo.getByDocumentSha256(validSha256);
    expect(stored).toHaveLength(3);

    // Second run: returns existing pages without creating duplicate logical pages
    const secondRun = await extractionService.extractPagesForDocument({
      documentSha256: validSha256
    });
    expect(secondRun.action).toBe("EXISTING");
    expect(secondRun.isDuplicate).toBe(true);
    expect(secondRun.pageCount).toBe(3);
    expect(secondRun.pages[0]!.id).toBe(firstRun.pages[0]!.id);
  });

  // 14. Source-document provenance
  it("14. forbids extracting pages detached from nonexistent source documents", async () => {
    const nonexistentSha = "a".repeat(64);
    await expect(
      extractionService.extractPagesForDocument({
        documentSha256: nonexistentSha
      })
    ).rejects.toThrowError(
      `Cannot extract pages: source document '${nonexistentSha}' does not exist in repository.`
    );
  });

  // 15. Extraction failure handling
  it("15. handles missing storage objects and invalid SHA-256 strings gracefully", async () => {
    // Missing PDF in storage
    const orphanSha = "b".repeat(64);
    await docRepo.create({
      ...testSourceDoc,
      id: orphanSha,
      sha256: orphanSha,
      storagePath: getSourceStoragePath(orphanSha)
    });

    await expect(
      extractionService.extractPagesForDocument({
        documentSha256: orphanSha
      })
    ).rejects.toThrowError("Immutable source PDF artifact not found in storage");

    // Invalid SHA-256 format
    await expect(
      extractionService.extractPagesForDocument({
        documentSha256: "not-a-sha"
      })
    ).rejects.toThrowError("Expected 64 lowercase hexadecimal characters");
  });

  // Contract Validation Unit Tests
  it("validates DocumentPage domain invariants rigorously", () => {
    const validPage: DocumentPage = {
      id: `${validSha256}_1`,
      documentSha256: validSha256,
      pageNumber: 1,
      pageCount: 3,
      extractionMethod: DEFAULT_EXTRACTION_METHOD,
      extractionVersion: DEFAULT_EXTRACTION_VERSION,
      extractionStatus: "TEXT_LAYER",
      text: "Sample text",
      textBlocks: [
        {
          order: 0,
          text: "Sample text",
          x: 10,
          y: 20,
          width: 100,
          height: 12
        }
      ],
      pageWidth: 612,
      pageHeight: 792,
      unit: "pt",
      hasImages: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    expect(() => validateDocumentPage(validPage)).not.toThrow();

    // Mismatched ID
    expect(() =>
      validateDocumentPage({
        ...validPage,
        id: "wrong_id"
      })
    ).toThrowError(/must match deterministic page ID/);

    // Page out of bounds
    expect(() =>
      validateDocumentPage({
        ...validPage,
        id: `${validSha256}_5`,
        pageNumber: 5,
        pageCount: 3
      })
    ).toThrowError(/exceeds pageCount/);
  });
});
