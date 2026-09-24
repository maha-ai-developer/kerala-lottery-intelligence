import { describe, it, expect } from "vitest";
import {
  computeSha256,
  getSourceStoragePath,
  validatePdfBuffer,
  validateSourceDocument,
  DocumentValidationError,
  DEV_SYNTHETIC_FIXTURE_BYTES,
  DEV_SYNTHETIC_FIXTURE_SHA256,
  validateOfficialSource,
  KERALA_STATE_LOTTERY_PORTAL,
  validateSafeUrl
} from "./index";
import type { SourceDocument } from "@kerala-lottery/domain";

describe("packages/documents: Cryptographic Identity & Invariant Validation", () => {
  // Minimal valid PDF fixture (%PDF-1.4 header)
  const samplePdfBytes = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF");
  const samplePdfBytesAlt = Buffer.from("%PDF-1.4\n2 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF");

  it("Invariant: SHA-256 computation is deterministic", () => {
    const hash1 = computeSha256(samplePdfBytes);
    const hash2 = computeSha256(samplePdfBytes);

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    expect(hash1).toBe(hash1.toLowerCase());
  });

  it("Invariant: Different bytes produce distinct SHA-256 hashes", () => {
    const hash1 = computeSha256(samplePdfBytes);
    const hash2 = computeSha256(samplePdfBytesAlt);

    expect(hash1).not.toBe(hash2);
    expect(hash1.length).toBe(64);
    expect(hash2.length).toBe(64);
  });

  it("Invariant: computeSha256 rejects invalid types", () => {
    expect(() => computeSha256("not a buffer" as unknown as Uint8Array)).toThrow(
      DocumentValidationError
    );
    expect(() => computeSha256(null as unknown as Uint8Array)).toThrow(
      DocumentValidationError
    );
  });

  it("Invariant: getSourceStoragePath formats as source-documents/{sha256}.pdf", () => {
    const validHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    const path = getSourceStoragePath(validHash);

    expect(path).toBe(`source-documents/${validHash}.pdf`);
  });

  it("Invariant: getSourceStoragePath rejects malformed or truncated hashes", () => {
    expect(() => getSourceStoragePath("short-hash")).toThrow(DocumentValidationError);
    expect(() => getSourceStoragePath("")).toThrow(DocumentValidationError);
    expect(() =>
      getSourceStoragePath("E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855")
    ).not.toThrow(); // Normalized to lowercase
  });

  it("Invariant: validatePdfBuffer accepts valid PDF headers", () => {
    expect(() => validatePdfBuffer(samplePdfBytes)).not.toThrow();
  });

  it("Invariant: validatePdfBuffer rejects non-PDF buffers and empty buffers", () => {
    // Empty buffer
    expect(() => validatePdfBuffer(new Uint8Array(0))).toThrow(DocumentValidationError);

    // Too small
    expect(() => validatePdfBuffer(Buffer.from("%PDF"))).toThrow(DocumentValidationError);

    // Non-PDF magic bytes
    expect(() => validatePdfBuffer(Buffer.from("HELLO WORLD NOT A PDF"))).toThrow(
      DocumentValidationError
    );

    // Non-buffer type
    expect(() => validatePdfBuffer({ not: "a buffer" })).toThrow(DocumentValidationError);
  });

  it("Invariant: validateSourceDocument verifies cryptographic identity and provenance", () => {
    const sha256 = computeSha256(samplePdfBytes);
    const validDoc: SourceDocument = {
      id: sha256, // Must match sha256 exactly
      type: "LOTTERY_RESULT",
      title: "Sample Gazette Result",
      storagePath: `source-documents/${sha256}.pdf`,
      sha256,
      mimeType: "application/pdf",
      fileSize: samplePdfBytes.byteLength,
      sourceOrganization: "Directorate of Kerala State Lotteries",
      retrievedAt: new Date().toISOString(),
      ingestionVersion: "v1.0.0-source-foundation",
      status: "UPLOADED",
      createdAt: new Date().toISOString()
    };

    expect(() => validateSourceDocument(validDoc)).not.toThrow();
  });

  it("Invariant: validateSourceDocument rejects document where id does not match SHA-256", () => {
    const sha256 = computeSha256(samplePdfBytes);
    const mismatchedDoc: SourceDocument = {
      id: "arbitrary-id-not-matching-sha256",
      type: "LOTTERY_RESULT",
      title: "Sample Gazette Result",
      storagePath: `source-documents/${sha256}.pdf`,
      sha256,
      mimeType: "application/pdf",
      fileSize: samplePdfBytes.byteLength,
      sourceOrganization: "Directorate of Kerala State Lotteries",
      retrievedAt: new Date().toISOString(),
      ingestionVersion: "v1.0.0-source-foundation",
      status: "UPLOADED",
      createdAt: new Date().toISOString()
    };

    expect(() => validateSourceDocument(mismatchedDoc)).toThrow(DocumentValidationError);
  });

  it("Invariant: validateSourceDocument rejects invalid storagePath or MIME type", () => {
    const sha256 = computeSha256(samplePdfBytes);
    const invalidPathDoc: SourceDocument = {
      id: sha256,
      type: "LOTTERY_RESULT",
      title: "Sample Gazette Result",
      storagePath: `wrong-folder/${sha256}.pdf`,
      sha256,
      mimeType: "application/pdf",
      fileSize: samplePdfBytes.byteLength,
      sourceOrganization: "Directorate of Kerala State Lotteries",
      retrievedAt: new Date().toISOString(),
      ingestionVersion: "v1.0.0-source-foundation",
      status: "UPLOADED",
      createdAt: new Date().toISOString()
    };

    expect(() => validateSourceDocument(invalidPathDoc)).toThrow(DocumentValidationError);

    const invalidMimeDoc: SourceDocument = {
      ...invalidPathDoc,
      storagePath: `source-documents/${sha256}.pdf`,
      mimeType: "text/plain"
    };

    expect(() => validateSourceDocument(invalidMimeDoc)).toThrow(DocumentValidationError);
  });

  it("Invariant: DEV_SYNTHETIC_FIXTURE_BYTES has valid PDF header and matches canonical SHA-256", () => {
    expect(() => validatePdfBuffer(DEV_SYNTHETIC_FIXTURE_BYTES)).not.toThrow();
    const computed = computeSha256(DEV_SYNTHETIC_FIXTURE_BYTES);
    expect(computed).toBe(DEV_SYNTHETIC_FIXTURE_SHA256);
    expect(computed).toBe("2b8ed894e0e6da419e81b54d760322c574cf88a61f8d892bd309ad9148fc3acf");
    expect(DEV_SYNTHETIC_FIXTURE_BYTES.byteLength).toBe(331);
  });

  it("Invariant: validateOfficialSource validates official source configurations", () => {
    expect(() => validateOfficialSource(KERALA_STATE_LOTTERY_PORTAL)).not.toThrow();

    // Invalid sourceId
    expect(() =>
      validateOfficialSource({ ...KERALA_STATE_LOTTERY_PORTAL, sourceId: "" })
    ).toThrow(DocumentValidationError);

    // Invalid allowedDomains
    expect(() =>
      validateOfficialSource({ ...KERALA_STATE_LOTTERY_PORTAL, allowedDomains: [] })
    ).toThrow(DocumentValidationError);

    // Invalid baseUrl
    expect(() =>
      validateOfficialSource({ ...KERALA_STATE_LOTTERY_PORTAL, baseUrl: "not-a-url" })
    ).toThrow(DocumentValidationError);
  });

  it("Invariant: validateSafeUrl enforces allowed domains and prevents SSRF", () => {
    const allowed = ["statelottery.kerala.gov.in"];

    // Allowed domain succeeds
    expect(() =>
      validateSafeUrl("https://statelottery.kerala.gov.in/images/pdf/test.pdf", allowed)
    ).not.toThrow();

    // Unauthorized domain throws
    expect(() =>
      validateSafeUrl("https://evil-unauthorized-site.com/fake.pdf", allowed)
    ).toThrow(DocumentValidationError);

    // SSRF / Private network targets strictly blocked
    expect(() =>
      validateSafeUrl("http://localhost:8080/secret", allowed)
    ).toThrow(DocumentValidationError);
    expect(() =>
      validateSafeUrl("http://127.0.0.1/admin", allowed)
    ).toThrow(DocumentValidationError);
    expect(() =>
      validateSafeUrl("http://169.254.169.254/computeMetadata/v1", allowed)
    ).toThrow(DocumentValidationError);
    expect(() =>
      validateSafeUrl("http://10.0.0.1/internal", allowed)
    ).toThrow(DocumentValidationError);
    expect(() =>
      validateSafeUrl("http://192.168.1.1/router", allowed)
    ).toThrow(DocumentValidationError);

    // Non-HTTP protocols blocked
    expect(() =>
      validateSafeUrl("ftp://statelottery.kerala.gov.in/test.pdf", allowed)
    ).toThrow(DocumentValidationError);
    expect(() =>
      validateSafeUrl("file:///etc/passwd", allowed)
    ).toThrow(DocumentValidationError);
  });

  it("Invariant: validateSourceDocument verifies provenance invariants when present", () => {
    const sha256 = computeSha256(samplePdfBytes);
    const validDoc: SourceDocument = {
      id: sha256,
      type: "LOTTERY_RESULT",
      title: "Sample Gazette Result",
      storagePath: `source-documents/${sha256}.pdf`,
      sha256,
      mimeType: "application/pdf",
      fileSize: samplePdfBytes.byteLength,
      sourceOrganization: "Directorate of Kerala State Lotteries",
      retrievedAt: new Date().toISOString(),
      ingestionVersion: "v1.0.0-source-foundation",
      status: "UPLOADED",
      createdAt: new Date().toISOString(),
      provenance: {
        sourceId: "KERALA_STATE_LOTTERY_PORTAL",
        sourceOrganization: "Directorate of Kerala State Lotteries",
        requestedUrl: "https://statelottery.kerala.gov.in/images/pdf/test.pdf",
        finalUrl: "https://statelottery.kerala.gov.in/images/pdf/test.pdf",
        redirectCount: 0,
        retrievedAt: new Date().toISOString(),
        httpMetadata: {
          statusCode: 200,
          contentType: "application/pdf",
          sha256,
          byteSize: samplePdfBytes.byteLength
        }
      }
    };

    expect(() => validateSourceDocument(validDoc)).not.toThrow();

    // Mismatched provenance sha256 must throw
    const mismatchedShaDoc: SourceDocument = {
      ...validDoc,
      provenance: {
        ...validDoc.provenance!,
        httpMetadata: {
          ...validDoc.provenance!.httpMetadata,
          sha256: "0000000000000000000000000000000000000000000000000000000000000000"
        }
      }
    };
    expect(() => validateSourceDocument(mismatchedShaDoc)).toThrow(DocumentValidationError);

    // Mismatched provenance byteSize must throw
    const mismatchedSizeDoc: SourceDocument = {
      ...validDoc,
      provenance: {
        ...validDoc.provenance!,
        httpMetadata: {
          ...validDoc.provenance!.httpMetadata,
          byteSize: 999999
        }
      }
    };
    expect(() => validateSourceDocument(mismatchedSizeDoc)).toThrow(DocumentValidationError);
  });
});
