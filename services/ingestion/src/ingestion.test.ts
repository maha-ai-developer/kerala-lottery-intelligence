import { describe, it, expect, beforeEach } from "vitest";
import {
  SourceIngestionService,
  type IngestDocumentInput
} from "./index";
import {
  InMemoryDocumentRepository,
  InMemoryStorageService,
  StorageAlreadyExistsError,
  DocumentAlreadyExistsError,
  StorageError
} from "@kerala-lottery/data";
import {
  computeSha256,
  DocumentValidationError
} from "@kerala-lottery/documents";

describe("Milestone 3A — SourceIngestionService: Ingestion Foundation & Idempotency", () => {
  let docRepo: InMemoryDocumentRepository;
  let storageService: InMemoryStorageService;
  let ingestionService: SourceIngestionService;

  // Minimal valid PDF byte fixture
  const validPdfBytes = Buffer.from(
    "%PDF-1.4\n1 0 obj\n<< /Title (Kerala Gazette Result) >>\nendobj\ntrailer\n<<>>\n%%EOF"
  );
  const validPdfBytes2 = Buffer.from(
    "%PDF-1.4\n2 0 obj\n<< /Title (Kerala Gazette Result 2) >>\nendobj\ntrailer\n<<>>\n%%EOF"
  );

  beforeEach(() => {
    docRepo = new InMemoryDocumentRepository();
    storageService = new InMemoryStorageService();
    ingestionService = new SourceIngestionService({
      documentRepository: docRepo,
      storageService: storageService,
      ingestionVersion: "v1.0.0-source-foundation"
    });
  });

  it("Invariant: Ingests valid PDF bytes, creating storage object and Firestore record with matching 64-char SHA-256", async () => {
    const expectedSha256 = computeSha256(validPdfBytes);
    const input: IngestDocumentInput = {
      fileBuffer: validPdfBytes,
      fileName: "kerala-lottery-draw-271.pdf",
      sourceUrl: "https://statelottery.kerala.gov.in/results/draw271.pdf",
      title: "Kerala State Lottery Draw 271 Official Gazette"
    };

    const result = await ingestionService.ingest(input);

    expect(result.action).toBe("CREATED");
    expect(result.isDuplicate).toBe(false);
    expect(result.document.id).toBe(expectedSha256);
    expect(result.document.sha256).toBe(expectedSha256);
    expect(result.document.storagePath).toBe(`source-documents/${expectedSha256}.pdf`);
    expect(result.document.fileSize).toBe(validPdfBytes.byteLength);
    expect(result.document.mimeType).toBe("application/pdf");
    expect(result.document.status).toBe("UPLOADED");
    expect(result.document.ingestionVersion).toBe("v1.0.0-source-foundation");

    // Verify presence in storage
    expect(storageService.has(`source-documents/${expectedSha256}.pdf`)).toBe(true);

    // Verify presence in repository
    const storedDoc = await docRepo.getBySha256(expectedSha256);
    expect(storedDoc).not.toBeNull();
    expect(storedDoc?.id).toBe(expectedSha256);
    expect(docRepo.getAll().length).toBe(1);
  });

  it("Invariant: Idempotent ingestion of same PDF bytes returns existing record without duplicating storage or Firestore", async () => {
    const expectedSha256 = computeSha256(validPdfBytes);
    const input: IngestDocumentInput = {
      fileBuffer: validPdfBytes,
      fileName: "draw-271.pdf"
    };

    // First ingestion
    const firstResult = await ingestionService.ingest(input);
    expect(firstResult.action).toBe("CREATED");
    expect(firstResult.isDuplicate).toBe(false);

    // Second ingestion with identical PDF bytes
    const secondResult = await ingestionService.ingest(input);
    expect(secondResult.action).toBe("EXISTING");
    expect(secondResult.isDuplicate).toBe(true);
    expect(secondResult.document.id).toBe(expectedSha256);
    expect(secondResult.document.sha256).toBe(expectedSha256);

    // Invariant: Exactly one document in repository, exactly one object in storage
    expect(docRepo.getAll().length).toBe(1);
    expect(storageService.has(`source-documents/${expectedSha256}.pdf`)).toBe(true);
  });

  it("Invariant: Different PDF bytes create distinct independent source documents", async () => {
    const sha1 = computeSha256(validPdfBytes);
    const sha2 = computeSha256(validPdfBytes2);
    expect(sha1).not.toBe(sha2);

    const res1 = await ingestionService.ingest({
      fileBuffer: validPdfBytes,
      fileName: "file1.pdf"
    });
    const res2 = await ingestionService.ingest({
      fileBuffer: validPdfBytes2,
      fileName: "file2.pdf"
    });

    expect(res1.action).toBe("CREATED");
    expect(res2.action).toBe("CREATED");
    expect(res1.document.id).toBe(sha1);
    expect(res2.document.id).toBe(sha2);
    expect(docRepo.getAll().length).toBe(2);
  });

  it("Invariant: Rejects invalid PDF buffers (empty, non-PDF, or corrupted)", async () => {
    // Empty buffer
    await expect(
      ingestionService.ingest({
        fileBuffer: new Uint8Array(0),
        fileName: "empty.pdf"
      })
    ).rejects.toThrow(DocumentValidationError);

    // Plain text masquerading as PDF
    await expect(
      ingestionService.ingest({
        fileBuffer: Buffer.from("plain text not a pdf"),
        fileName: "fake.pdf"
      })
    ).rejects.toThrow(DocumentValidationError);

    // Invalid MIME type
    await expect(
      ingestionService.ingest({
        fileBuffer: validPdfBytes,
        fileName: "image.png",
        mimeType: "image/png"
      })
    ).rejects.toThrow(DocumentValidationError);

    // Zero records created
    expect(docRepo.getAll().length).toBe(0);
  });

  it("Invariant: Storage putIfAbsent prevents silent overwrite of existing storage objects", async () => {
    const sha256 = computeSha256(validPdfBytes);
    const path = `source-documents/${sha256}.pdf`;

    // Put initial object into storage
    await storageService.putIfAbsent(path, validPdfBytes, {
      sha256,
      originalFileName: "original.pdf",
      retrievedAt: new Date().toISOString()
    });

    // Attempting putIfAbsent again on same path MUST throw StorageAlreadyExistsError
    await expect(
      storageService.putIfAbsent(path, validPdfBytes, {
        sha256,
        originalFileName: "duplicate.pdf",
        retrievedAt: new Date().toISOString()
      })
    ).rejects.toThrow(StorageAlreadyExistsError);
  });

  it("Invariant: Recovery scenario (Storage exists, Firestore missing) creates Firestore record without overwriting Storage", async () => {
    const expectedSha256 = computeSha256(validPdfBytes);
    const storagePath = `source-documents/${expectedSha256}.pdf`;

    // Pre-populate storage (simulating partial past failure or orphaned storage object)
    await storageService.putIfAbsent(storagePath, validPdfBytes, {
      sha256: expectedSha256,
      originalFileName: "pre-existing.pdf",
      retrievedAt: new Date().toISOString()
    });

    // Ensure Firestore is missing
    expect(await docRepo.getBySha256(expectedSha256)).toBeNull();

    // Ingest should safely catch StorageAlreadyExistsError and create the Firestore metadata
    const result = await ingestionService.ingest({
      fileBuffer: validPdfBytes,
      fileName: "recovered.pdf"
    });

    expect(result.action).toBe("CREATED");
    expect(result.document.id).toBe(expectedSha256);
    expect(await docRepo.getBySha256(expectedSha256)).not.toBeNull();
  });

  it("Invariant: Storage failure aborts ingestion and does not write partial Firestore records", async () => {
    // Failing storage mock
    const failingStorage = {
      putIfAbsent: async () => {
        throw new StorageError("Simulated Cloud Storage I/O failure");
      }
    };

    const serviceWithFailingStorage = new SourceIngestionService({
      documentRepository: docRepo,
      storageService: failingStorage
    });

    await expect(
      serviceWithFailingStorage.ingest({
        fileBuffer: validPdfBytes,
        fileName: "failure-test.pdf"
      })
    ).rejects.toThrow(StorageError);

    // Repository must remain clean
    expect(docRepo.getAll().length).toBe(0);
  });

  it("Invariant: Concurrent creation race in Firestore recovers and returns the existing document", async () => {
    const expectedSha256 = computeSha256(validPdfBytes);

    // Mock docRepo whose create() method throws DocumentAlreadyExistsError (simulating race condition)
    // but getBySha256() returns the concurrently created document
    const racedDoc = {
      id: expectedSha256,
      type: "LOTTERY_RESULT" as const,
      title: "Concurrently Created Doc",
      storagePath: `source-documents/${expectedSha256}.pdf`,
      sha256: expectedSha256,
      mimeType: "application/pdf",
      fileSize: validPdfBytes.byteLength,
      sourceOrganization: "Directorate of Kerala State Lotteries",
      retrievedAt: new Date().toISOString(),
      ingestionVersion: "v1.0.0-source-foundation",
      status: "UPLOADED" as const,
      createdAt: new Date().toISOString()
    };

    let firstCheck = true;
    const raceSimulatorRepo = {
      getBySha256: async (_hash: string) => {
        if (firstCheck) {
          firstCheck = false;
          return null; // Initial check says doesn't exist
        }
        return racedDoc; // After create fails, recovery finds it!
      },
      create: async () => {
        throw new DocumentAlreadyExistsError("Concurrently created by another process");
      }
    };

    const raceService = new SourceIngestionService({
      documentRepository: raceSimulatorRepo,
      storageService: storageService
    });

    const result = await raceService.ingest({
      fileBuffer: validPdfBytes,
      fileName: "race.pdf"
    });

    expect(result.action).toBe("EXISTING");
    expect(result.isDuplicate).toBe(true);
    expect(result.document.id).toBe(expectedSha256);
  });
});
