/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 3A & 3B — Official Source Acquisition & Ingestion Pipeline
 *
 * CORE PRINCIPLE:
 * The PDF is treated as an opaque, immutable source artifact.
 * Cryptographic identity:
 *   PDF bytes → SHA-256(content)
 *   Storage: source-documents/{sha256}.pdf
 *   Firestore: documents/{sha256}
 */

import type { SourceDocument, DocumentType, DocumentProvenance } from "@kerala-lottery/domain";
import {
  computeSha256,
  getSourceStoragePath,
  validatePdfBuffer,
  validateSourceDocument,
  DocumentValidationError
} from "@kerala-lottery/documents";
import {
  type DocumentRepository,
  type StorageService,
  StorageAlreadyExistsError,
  DocumentAlreadyExistsError
} from "@kerala-lottery/data";

export * from "./errors";
export * from "./acquisition";
export * from "./discovery";
export * from "./page-extraction";

export interface IngestDocumentInput {
  fileBuffer: Uint8Array;
  fileName: string;
  mimeType?: string; // defaults to "application/pdf"
  sourceUrl?: string;
  title?: string;
  type?: DocumentType; // defaults to "LOTTERY_RESULT"
  sourceOrganization?: string; // defaults to "Directorate of Kerala State Lotteries"
  publishedAt?: string; // ISO 8601
  retrievedAt?: string; // defaults to current ISO 8601 timestamp
  provenance?: DocumentProvenance;
}

export type IngestionAction = "CREATED" | "EXISTING";

export interface IngestionResult {
  document: SourceDocument;
  isDuplicate: boolean;
  storagePath: string;
  action: IngestionAction;
}

export interface SourceIngestionServiceDependencies {
  documentRepository: DocumentRepository;
  storageService: StorageService;
  ingestionVersion?: string; // defaults to "v1.0.0-source-foundation"
}

export class SourceIngestionService {
  constructor(private readonly deps: SourceIngestionServiceDependencies) {}

  /**
   * Ingests a raw PDF document into the immutable SOURCE layer.
   *
   * Invariants enforced:
   * 1. Narrow validation of raw bytes and '%PDF-' magic header.
   * 2. Deterministic 64-char lowercase SHA-256 computation.
   * 3. Idempotent check: if document already exists in Firestore, returns existing record.
   * 4. Atomic create-only Storage write (putIfAbsent). Does not rely on check-then-write.
   * 5. Storage-exists / Firestore-missing recovery without overwriting storage.
   * 6. Atomic create-only Firestore document write.
   */
  async ingest(input: IngestDocumentInput): Promise<IngestionResult> {
    // 1. Narrow validation of PDF buffer
    validatePdfBuffer(input.fileBuffer);

    // 2. Validate MIME type
    const mimeType = input.mimeType || "application/pdf";
    if (mimeType !== "application/pdf") {
      throw new DocumentValidationError(
        `Invalid MIME type '${mimeType}'. Ingestion pipeline accepts only 'application/pdf'.`,
        "INVALID_MIME_TYPE"
      );
    }

    // 3. Deterministic SHA-256 computation
    const sha256 = computeSha256(input.fileBuffer);

    // 4. Derive canonical identity paths
    const storagePath = getSourceStoragePath(sha256);
    const documentId = sha256; // Full 64-character lowercase SHA-256

    // 5. Idempotent check against Firestore repository
    const existingDoc = await this.deps.documentRepository.getBySha256(sha256);
    if (existingDoc) {
      return {
        document: existingDoc,
        isDuplicate: true,
        storagePath: existingDoc.storagePath,
        action: "EXISTING"
      };
    }

    // 6. Timestamps & Ingestion Version
    const retrievedAt = input.retrievedAt || new Date().toISOString();
    const createdAt = new Date().toISOString();
    const ingestionVersion =
      this.deps.ingestionVersion || "v1.0.0-source-foundation";

    // 7. Atomic Storage putIfAbsent (Precondition-enforced)
    // Never overwrite an existing object in storage.
    try {
      const customMetadata: Record<string, string> = {
        sourceOrganization:
          input.sourceOrganization ||
          "Directorate of Kerala State Lotteries"
      };
      if (input.provenance) {
        customMetadata.sourceId = input.provenance.sourceId;
        customMetadata.requestedUrl = input.provenance.requestedUrl;
        customMetadata.finalUrl = input.provenance.finalUrl;
        if (input.provenance.discoveryUrl) {
          customMetadata.discoveryUrl = input.provenance.discoveryUrl;
        }
      }

      await this.deps.storageService.putIfAbsent(storagePath, input.fileBuffer, {
        sha256,
        originalFileName: input.fileName,
        retrievedAt,
        contentType: "application/pdf",
        customMetadata
      });
    } catch (err: unknown) {
      if (err instanceof StorageAlreadyExistsError) {
        // Recovery scenario: Storage object already exists, but Firestore document was missing.
        // Safely proceed to create Firestore metadata without overwriting Storage.
      } else {
        throw err;
      }
    }

    // 8. Construct SourceDocument entity adhering to provenance invariants
    const sourceDocument: SourceDocument = {
      id: documentId,
      type: input.type || "LOTTERY_RESULT",
      title: input.title || input.fileName,
      sourceUrl: input.sourceUrl,
      storagePath,
      sha256,
      mimeType: "application/pdf",
      fileSize: input.fileBuffer.byteLength,
      sourceOrganization:
        input.sourceOrganization || "Directorate of Kerala State Lotteries",
      publishedAt: input.publishedAt,
      retrievedAt,
      ingestionVersion,
      status: "UPLOADED",
      createdAt,
      provenance: input.provenance
    };

    // Validate domain invariants before persistence
    validateSourceDocument(sourceDocument);

    // 9. Atomic Firestore create-only
    try {
      await this.deps.documentRepository.create(sourceDocument);
      return {
        document: sourceDocument,
        isDuplicate: false,
        storagePath,
        action: "CREATED"
      };
    } catch (err: unknown) {
      if (err instanceof DocumentAlreadyExistsError) {
        // Race condition / concurrent creation: recover by reading existing
        const recovered = await this.deps.documentRepository.getBySha256(
          sha256
        );
        if (recovered) {
          return {
            document: recovered,
            isDuplicate: true,
            storagePath: recovered.storagePath,
            action: "EXISTING"
          };
        }
      }
      throw err;
    }
  }
}
