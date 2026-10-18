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

import type {
  SourceDocument,
  DocumentType,
  DocumentProvenance,
  WinningResult
} from "@kerala-lottery/domain";
import {
  computeSha256,
  getSourceStoragePath,
  validatePdfBuffer,
  validateSourceDocument,
  validateWinningResult,
  DocumentValidationError
} from "@kerala-lottery/documents";
import {
  type DocumentRepository,
  type StorageService,
  type WinningResultRepository,
  StorageAlreadyExistsError,
  StorageIntegrityError,
  DocumentAlreadyExistsError,
  DocumentIntegrityError,
  verifyExistingWinningResultMatches
} from "@kerala-lottery/data";

export {
  computeSha256,
  validatePdfBuffer,
  DEFAULT_MAX_UPLOAD_BYTES,
  type PdfBufferValidationOptions,
  validateSafeUrl,
  DocumentValidationError,
  KERALA_STATE_LOTTERY_PORTAL,
  getSourceStoragePath,
  validateSourceDocument
} from "@kerala-lottery/documents";

export {
  StorageIntegrityError,
  DocumentIntegrityError,
  verifyExistingPrizeTierMatches,
  verifyExistingWinningResultMatches
} from "@kerala-lottery/data";

export * from "./errors";
export * from "./acquisition";
export * from "./discovery";
export * from "./page-extraction";
export * from "./cross-document-validator";
export * from "./document-cache";
export * from "./daily-ingestion-engine";
export * from "./catch-up-engine";
export * from "./operations";

export interface IngestDocumentInput {
  fileBuffer: Uint8Array;
  fileName: string;
  mimeType?: string; // defaults to "application/pdf"
  sourceUrl?: string;
  title?: string;
  expectedDrawId?: string;
  expectedResults?: WinningResult[];
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
  winningResultRepository?: WinningResultRepository;
  ingestionVersion?: string; // defaults to "v1.0.0-source-foundation"
}

export class SourceIngestionService {
  constructor(private readonly deps: SourceIngestionServiceDependencies) {}

  /**
   * Checks whether a SHA-256 document identity is present in Cloud Storage and Firestore.
   */
  async checkResidency(sha256: string): Promise<{
    inCloudStorage: boolean;
    inFirestore: boolean;
  }> {
    const normalizedSha = sha256.trim().toLowerCase();
    const storagePath = getSourceStoragePath(normalizedSha);
    let inFirestore = false;
    let inCloudStorage = false;
    try {
      const doc = await this.deps.documentRepository.getBySha256(normalizedSha);
      inFirestore = Boolean(doc && doc.sha256 === normalizedSha);
    } catch {
      inFirestore = false;
    }
    try {
      if (this.deps.storageService.getObjectMetadata) {
        const meta = await this.deps.storageService.getObjectMetadata(storagePath);
        inCloudStorage = Boolean(meta);
      } else if (this.deps.storageService.getObject) {
        const bytes = await this.deps.storageService.getObject(storagePath);
        inCloudStorage = Boolean(bytes && bytes.byteLength > 0);
      } else {
        inCloudStorage = inFirestore;
      }
    } catch {
      inCloudStorage = false;
    }
    return { inCloudStorage, inFirestore };
  }

  /**
   * Verifies that an existing GCS object matches the expected byte length, cryptographic
   * SHA-256 content hash, and metadata identity before treating it as valid.
   * Fails closed by throwing StorageIntegrityError on any discrepancy.
   */
  private async verifyExistingStorageObjectIntegrity(
    storagePath: string,
    expectedSha256: string,
    input: IngestDocumentInput
  ): Promise<void> {
    if (this.deps.storageService.getObjectMetadata) {
      const meta = await this.deps.storageService.getObjectMetadata(storagePath);
      if (!meta) {
        throw new StorageIntegrityError(
          `Expected existing storage object at '${storagePath}' was not found during integrity verification.`,
          storagePath,
          "MISSING_STORAGE_OBJECT"
        );
      }
      if (meta.size >= 0 && meta.size !== input.fileBuffer.byteLength) {
        throw new StorageIntegrityError(
          `Existing storage object at '${storagePath}' has byte size ${meta.size}, expected ${input.fileBuffer.byteLength}.`,
          storagePath,
          "STORAGE_SIZE_MISMATCH"
        );
      }
      if (meta.sha256 && meta.sha256.toLowerCase() !== expectedSha256) {
        throw new StorageIntegrityError(
          `Existing storage object metadata SHA-256 '${meta.sha256}' at '${storagePath}' does not match expected '${expectedSha256}'.`,
          storagePath,
          "STORAGE_SHA256_MISMATCH"
        );
      }
      if (meta.contentType && meta.contentType !== "application/pdf") {
        throw new StorageIntegrityError(
          `Existing storage object at '${storagePath}' has contentType '${meta.contentType}', expected 'application/pdf'.`,
          storagePath,
          "STORAGE_CONTENT_TYPE_MISMATCH"
        );
      }
      if (
        input.provenance?.sourceId &&
        meta.customMetadata?.sourceId &&
        meta.customMetadata.sourceId !== input.provenance.sourceId
      ) {
        throw new StorageIntegrityError(
          `Existing storage object at '${storagePath}' has sourceId '${meta.customMetadata.sourceId}', expected '${input.provenance.sourceId}'.`,
          storagePath,
          "STORAGE_IDENTITY_MISMATCH"
        );
      }
      if (
        input.expectedDrawId &&
        meta.customMetadata?.drawId &&
        meta.customMetadata.drawId !== input.expectedDrawId
      ) {
        throw new StorageIntegrityError(
          `Existing storage object at '${storagePath}' has drawId '${meta.customMetadata.drawId}', expected '${input.expectedDrawId}'.`,
          storagePath,
          "STORAGE_DRAW_ID_MISMATCH"
        );
      }
    }

    if (this.deps.storageService.getObject) {
      const existingBytes = await this.deps.storageService.getObject(storagePath);
      if (!existingBytes) {
        throw new StorageIntegrityError(
          `Existing storage object bytes at '${storagePath}' could not be retrieved during integrity verification.`,
          storagePath,
          "MISSING_STORAGE_OBJECT"
        );
      }
      if (existingBytes.byteLength !== input.fileBuffer.byteLength) {
        throw new StorageIntegrityError(
          `Existing storage object bytes at '${storagePath}' have length ${existingBytes.byteLength}, expected ${input.fileBuffer.byteLength}.`,
          storagePath,
          "STORAGE_SIZE_MISMATCH"
        );
      }
      const actualSha256 = computeSha256(existingBytes);
      if (actualSha256 !== expectedSha256) {
        throw new StorageIntegrityError(
          `Existing storage object content SHA-256 '${actualSha256}' at '${storagePath}' does not match expected '${expectedSha256}'.`,
          storagePath,
          "STORAGE_SHA256_MISMATCH"
        );
      }
    }
  }

  /**
   * Verifies that an existing Firestore SourceDocument and any stored WinningResult records
   * match expected cryptographic identity, byte size, metadata, and result content before
   * treating an existing record as valid. Fails closed on any discrepancy.
   */
  private async verifyExistingDocumentAndResultsIntegrity(
    existingDoc: SourceDocument,
    expectedSha256: string,
    expectedStoragePath: string,
    input: IngestDocumentInput
  ): Promise<void> {
    if (existingDoc.id !== expectedSha256) {
      throw new DocumentIntegrityError(
        `Existing Firestore document id '${existingDoc.id}' does not match expected SHA-256 '${expectedSha256}'.`,
        existingDoc.id || expectedSha256,
        "DOCUMENT_ID_MISMATCH"
      );
    }
    if (existingDoc.sha256 !== expectedSha256) {
      throw new DocumentIntegrityError(
        `Existing Firestore document sha256 '${existingDoc.sha256}' does not match expected SHA-256 '${expectedSha256}'.`,
        expectedSha256,
        "DOCUMENT_SHA256_MISMATCH"
      );
    }
    if (existingDoc.fileSize !== input.fileBuffer.byteLength) {
      throw new DocumentIntegrityError(
        `Existing Firestore document '${expectedSha256}' has fileSize ${existingDoc.fileSize}, expected ${input.fileBuffer.byteLength}.`,
        expectedSha256,
        "DOCUMENT_FILE_SIZE_MISMATCH"
      );
    }
    if (existingDoc.storagePath !== expectedStoragePath) {
      throw new DocumentIntegrityError(
        `Existing Firestore document '${expectedSha256}' has storagePath '${existingDoc.storagePath}', expected '${expectedStoragePath}'.`,
        expectedSha256,
        "DOCUMENT_STORAGE_PATH_MISMATCH"
      );
    }
    if (existingDoc.mimeType !== "application/pdf") {
      throw new DocumentIntegrityError(
        `Existing Firestore document '${expectedSha256}' has mimeType '${existingDoc.mimeType}', expected 'application/pdf'.`,
        expectedSha256,
        "DOCUMENT_MIME_TYPE_MISMATCH"
      );
    }
    if (existingDoc.status !== "UPLOADED") {
      throw new DocumentIntegrityError(
        `Existing Firestore document '${expectedSha256}' has status '${existingDoc.status}', expected 'UPLOADED'.`,
        expectedSha256,
        "DOCUMENT_STATUS_MISMATCH"
      );
    }
    if (
      input.provenance?.sourceId &&
      existingDoc.provenance?.sourceId &&
      existingDoc.provenance.sourceId !== input.provenance.sourceId
    ) {
      throw new DocumentIntegrityError(
        `Existing Firestore document '${expectedSha256}' has provenance.sourceId '${existingDoc.provenance.sourceId}', expected '${input.provenance.sourceId}'.`,
        expectedSha256,
        "DOCUMENT_PROVENANCE_SOURCE_MISMATCH"
      );
    }
    if (existingDoc.provenance?.httpMetadata) {
      if (existingDoc.provenance.httpMetadata.sha256 !== expectedSha256) {
        throw new DocumentIntegrityError(
          `Existing Firestore document '${expectedSha256}' has provenance.httpMetadata.sha256 '${existingDoc.provenance.httpMetadata.sha256}', expected '${expectedSha256}'.`,
          expectedSha256,
          "DOCUMENT_PROVENANCE_SHA256_MISMATCH"
        );
      }
      if (existingDoc.provenance.httpMetadata.byteSize !== input.fileBuffer.byteLength) {
        throw new DocumentIntegrityError(
          `Existing Firestore document '${expectedSha256}' has provenance.httpMetadata.byteSize ${existingDoc.provenance.httpMetadata.byteSize}, expected ${input.fileBuffer.byteLength}.`,
          expectedSha256,
          "DOCUMENT_PROVENANCE_SIZE_MISMATCH"
        );
      }
    }
    if (
      input.expectedDrawId &&
      existingDoc.title &&
      !existingDoc.title.includes(input.expectedDrawId)
    ) {
      throw new DocumentIntegrityError(
        `Existing Firestore document '${expectedSha256}' title '${existingDoc.title}' does not match expected draw identity '${input.expectedDrawId}'.`,
        expectedSha256,
        "DOCUMENT_DRAW_IDENTITY_MISMATCH"
      );
    }

    // Verify backing GCS object integrity as well
    await this.verifyExistingStorageObjectIntegrity(expectedStoragePath, expectedSha256, input);

    // Verify existing result subcollection / result records if repository is configured
    if (this.deps.winningResultRepository) {
      const existingResults =
        await this.deps.winningResultRepository.getByDocumentSha256(expectedSha256);

      if (input.expectedResults) {
        if (existingResults.length !== input.expectedResults.length) {
          throw new DocumentIntegrityError(
            `Existing WinningResult subcollection for '${expectedSha256}' has ${existingResults.length} records, expected ${input.expectedResults.length}.`,
            expectedSha256,
            "RESULT_COUNT_MISMATCH"
          );
        }

        const existingById = new Map<string, WinningResult>();
        for (const r of existingResults) {
          if (existingById.has(r.id)) {
            throw new DocumentIntegrityError(
              `Duplicate WinningResult ID '${r.id}' found in existing records for '${expectedSha256}'.`,
              r.id,
              "DUPLICATE_RESULT_ID"
            );
          }
          existingById.set(r.id, r);
        }

        for (const expectedResult of input.expectedResults) {
          const storedResult = existingById.get(expectedResult.id);
          if (!storedResult) {
            throw new DocumentIntegrityError(
              `Expected WinningResult '${expectedResult.id}' (canonicalNumber '${expectedResult.canonicalNumber}') is missing from existing records for '${expectedSha256}'.`,
              expectedResult.id,
              "MISSING_RESULT_RECORD"
            );
          }
          verifyExistingWinningResultMatches(storedResult, expectedResult);
        }
      } else {
        for (const r of existingResults) {
          validateWinningResult(r);
          if (r.documentSha256 !== expectedSha256) {
            throw new DocumentIntegrityError(
              `Existing WinningResult '${r.id}' has documentSha256 '${r.documentSha256}', expected '${expectedSha256}'.`,
              r.id,
              "WINNING_RESULT_SHA256_MISMATCH"
            );
          }
        }
      }
    }
  }

  /**
   * Ingests a raw PDF document into the immutable SOURCE layer.
   *
   * Invariants enforced:
   * 1. Narrow validation of raw bytes and '%PDF-' magic header.
   * 2. Deterministic 64-char lowercase SHA-256 computation.
   * 3. Existing-record integrity check: if document already exists in Firestore, verifies
   *    existing document metadata, storage object bytes/metadata, and result records before
   *    returning existing record.
   * 4. Atomic create-only Storage write (putIfAbsent). Does not rely on check-then-write.
   * 5. Storage-exists / Firestore-missing recovery verifies existing Storage object bytes and
   *    metadata before creating Firestore metadata without overwriting storage.
   * 6. Atomic create-only Firestore document write with verified recovery on concurrent creation.
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

    // 5. Idempotent & integrity check against Firestore repository
    const existingDoc = await this.deps.documentRepository.getBySha256(sha256);
    if (existingDoc) {
      await this.verifyExistingDocumentAndResultsIntegrity(
        existingDoc,
        sha256,
        storagePath,
        input
      );
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
      if (input.expectedDrawId) {
        customMetadata.drawId = input.expectedDrawId;
      }
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
        // Verify existing object metadata & content bytes match expected SHA-256, size, and identity
        // before creating Firestore metadata. Never accept or overwrite corrupted storage objects.
        const existingObj = err.existingObject;
        if (
          existingObj &&
          existingObj.size >= 0 &&
          existingObj.size !== input.fileBuffer.byteLength
        ) {
          throw new StorageIntegrityError(
            `Existing storage object at '${storagePath}' has size ${existingObj.size}, expected ${input.fileBuffer.byteLength}.`,
            storagePath,
            "STORAGE_SIZE_MISMATCH"
          );
        }
        if (
          existingObj &&
          existingObj.sha256 &&
          existingObj.sha256.toLowerCase() !== sha256
        ) {
          throw new StorageIntegrityError(
            `Existing storage object at '${storagePath}' has metadata SHA-256 '${existingObj.sha256}', expected '${sha256}'.`,
            storagePath,
            "STORAGE_SHA256_MISMATCH"
          );
        }
        await this.verifyExistingStorageObjectIntegrity(storagePath, sha256, input);
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
      if (this.deps.winningResultRepository && input.expectedResults) {
        await this.deps.winningResultRepository.saveBatch(input.expectedResults);
      }
      return {
        document: sourceDocument,
        isDuplicate: false,
        storagePath,
        action: "CREATED"
      };
    } catch (err: unknown) {
      if (err instanceof DocumentAlreadyExistsError) {
        // Race condition / concurrent creation: recover by reading existing and verifying integrity
        const recovered = await this.deps.documentRepository.getBySha256(
          sha256
        );
        if (recovered) {
          await this.verifyExistingDocumentAndResultsIntegrity(
            recovered,
            sha256,
            storagePath,
            input
          );
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
