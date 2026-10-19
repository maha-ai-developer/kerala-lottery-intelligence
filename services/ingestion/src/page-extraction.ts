/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 3C — Page-Level Text & Layout Segmentation Service
 *
 * Invariants Enforced:
 * 1. Strict Physical Observation Layer: observes page count, dimensions, text lines,
 *    and coordinates without performing any lottery semantic interpretation.
 * 2. Immutable Source Input: reads bytes directly from Cloud Storage source-documents/{sha256}.pdf.
 *    Does not redownload from the live official website.
 * 3. Provenance Chain: verifies the SourceDocument exists in Firestore before creating pages.
 *    Every page links deterministically to documentSha256.
 * 4. Deterministic Identity: page ID is `${documentSha256}_${pageNumber}` (1-based).
 * 5. Idempotent Execution: if pages already exist with matching extractionVersion,
 *    returns the existing pages without creating duplicate logical records.
 */

import type { DocumentPage } from "@kerala-lottery/domain";
import {
  getSourceStoragePath,
  PdfPageExtractorService,
  DEFAULT_EXTRACTION_VERSION,
  DEFAULT_EXTRACTION_METHOD,
  DocumentValidationError
} from "@kerala-lottery/documents";
import {
  type DocumentRepository,
  type DocumentPageRepository,
  type StorageService,
  StorageError
} from "@kerala-lottery/data";

export interface PageExtractionServiceDependencies {
  documentRepository: DocumentRepository;
  documentPageRepository: DocumentPageRepository;
  storageService: StorageService;
  extractorService?: PdfPageExtractorService;
  extractionVersion?: string;
  extractionMethod?: string;
}

export interface ExtractPagesInput {
  documentSha256: string;
  pdfBytes?: Uint8Array; // Optional direct byte buffer (e.g. for offline unit testing)
  forceReextract?: boolean;
}

export type PageExtractionAction = "CREATED" | "EXISTING";

export interface PageExtractionResult {
  documentSha256: string;
  pageCount: number;
  pages: DocumentPage[];
  action: PageExtractionAction;
  isDuplicate: boolean;
  extractionVersion: string;
}

export class PageExtractionService {
  private readonly extractor: PdfPageExtractorService;
  private readonly extractionVersion: string;
  private readonly extractionMethod: string;

  constructor(private readonly deps: PageExtractionServiceDependencies) {
    this.extractionVersion =
      deps.extractionVersion || DEFAULT_EXTRACTION_VERSION;
    this.extractionMethod = deps.extractionMethod || DEFAULT_EXTRACTION_METHOD;
    this.extractor =
      deps.extractorService ||
      new PdfPageExtractorService(this.extractionVersion, this.extractionMethod);
  }

  /**
   * Executes deterministic structural observation & layout extraction on an immutable source document.
   */
  async extractPagesForDocument(
    input: ExtractPagesInput
  ): Promise<PageExtractionResult> {
    const { documentSha256 } = input;

    // 1. Validate SHA-256 identifier format
    if (!documentSha256 || typeof documentSha256 !== "string") {
      throw new DocumentValidationError(
        "documentSha256 must be a non-empty string",
        "INVALID_SHA256"
      );
    }
    const normalizedSha = documentSha256.trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(normalizedSha)) {
      throw new DocumentValidationError(
        `Invalid documentSha256 '${documentSha256}'. Expected 64 lowercase hexadecimal characters.`,
        "INVALID_SHA256"
      );
    }

    // 2. Provenance invariant: SourceDocument must exist in Firestore
    const sourceDoc =
      await this.deps.documentRepository.getBySha256(normalizedSha);
    if (!sourceDoc) {
      throw new DocumentValidationError(
        `Cannot extract pages: source document '${normalizedSha}' does not exist in repository.`,
        "SOURCE_NOT_FOUND"
      );
    }

    // 3. Idempotency check: if pages already exist with matching extractionVersion, reuse existing records
    if (!input.forceReextract) {
      const existingPages =
        await this.deps.documentPageRepository.getByDocumentSha256(normalizedSha);
      if (
        existingPages.length > 0 &&
        existingPages.every(
          (p) => p.extractionVersion === this.extractionVersion
        )
      ) {
        return {
          documentSha256: normalizedSha,
          pageCount: existingPages.length,
          pages: existingPages,
          action: "EXISTING",
          isDuplicate: true,
          extractionVersion: this.extractionVersion
        };
      }
    }

    // 4. Retrieve canonical immutable PDF bytes directly from Storage artifact
    let pdfBytes = input.pdfBytes;
    if (!pdfBytes) {
      const storagePath = getSourceStoragePath(normalizedSha);
      if (!this.deps.storageService.getObject) {
        throw new StorageError(
          "StorageService does not implement getObject to retrieve source PDF bytes."
        );
      }
      const retrieved = await this.deps.storageService.getObject(storagePath);
      if (!retrieved) {
        throw new StorageError(
          `Immutable source PDF artifact not found in storage at '${storagePath}'.`
        );
      }
      pdfBytes = retrieved;
    }

    // 5. Execute server-side layout and text extraction (pure observation)
    const extraction = await this.extractor.extractPages(
      pdfBytes,
      normalizedSha,
      {
        extractionVersion: this.extractionVersion,
        extractionMethod: this.extractionMethod
      }
    );

    // 6. Persist extracted pages to document_pages repository
    for (const page of extraction.pages) {
      await this.deps.documentPageRepository.save(page);
    }

    return {
      documentSha256: normalizedSha,
      pageCount: extraction.pageCount,
      pages: extraction.pages,
      action: "CREATED",
      isDuplicate: false,
      extractionVersion: this.extractionVersion
    };
  }
}
