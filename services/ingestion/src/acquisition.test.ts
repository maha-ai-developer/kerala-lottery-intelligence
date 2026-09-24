import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DocumentAcquisitionService,
  OfficialSourceDiscoveryService,
  SourceIngestionService,
  AcquisitionHttpError,
  AcquisitionNetworkError,
  AcquisitionSecurityError,
  AcquisitionValidationError
} from "./index";
import {
  KERALA_STATE_LOTTERY_PORTAL,
  computeSha256,
  type OfficialSource
} from "@kerala-lottery/documents";
import {
  InMemoryDocumentRepository,
  InMemoryStorageService
} from "@kerala-lottery/data";

describe("Milestone 3B — Official Source Discovery & Acquisition", () => {
  const validPdfBytes = Buffer.from(
    "%PDF-1.4\n1 0 obj\n<< /Title (Kerala State Lottery Result) >>\nendobj\ntrailer\n<<>>\n%%EOF"
  );
  const altPdfBytes = Buffer.from(
    "%PDF-1.4\n2 0 obj\n<< /Title (Kerala State Lottery Result 2) >>\nendobj\ntrailer\n<<>>\n%%EOF"
  );
  const validSha256 = computeSha256(validPdfBytes);
  const altSha256 = computeSha256(altPdfBytes);

  let docRepo: InMemoryDocumentRepository;
  let storageService: InMemoryStorageService;
  let ingestionService: SourceIngestionService;

  beforeEach(() => {
    docRepo = new InMemoryDocumentRepository();
    storageService = new InMemoryStorageService();
    ingestionService = new SourceIngestionService({
      documentRepository: docRepo,
      storageService
    });
  });

  // 1. official-source configuration validation
  it("1. Invariant: Validates official-source configuration", async () => {
    const service = new DocumentAcquisitionService();
    const invalidSource = {
      ...KERALA_STATE_LOTTERY_PORTAL,
      sourceId: "", // empty id
      allowedDomains: []
    } as unknown as OfficialSource;

    await expect(
      service.acquire({
        url: "https://statelottery.kerala.gov.in/images/pdf/test.pdf",
        officialSource: invalidSource
      })
    ).rejects.toThrow(AcquisitionValidationError);
  });

  // 2. successful PDF acquisition
  it("2. Invariant: Successfully acquires official PDF document", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({
        "content-type": "application/pdf",
        "content-length": validPdfBytes.byteLength.toString(),
        "content-disposition": 'inline; filename="draw-273.pdf"',
        etag: '"test-etag-123"',
        "last-modified": "Wed, 18 Feb 2026 11:35:28 GMT",
        server: "Apache"
      }),
      arrayBuffer: async () => validPdfBytes.buffer.slice(validPdfBytes.byteOffset, validPdfBytes.byteOffset + validPdfBytes.byteLength)
    });

    const service = new DocumentAcquisitionService({ fetchFn: mockFetch as any });
    const result = await service.acquire({
      url: "https://statelottery.kerala.gov.in/images/pdf/draw-273.pdf",
      officialSource: KERALA_STATE_LOTTERY_PORTAL,
      discoveryUrl: "https://statelottery.kerala.gov.in/English/index.php/lottery-result-view"
    });

    expect(result.fileName).toBe("draw-273.pdf");
    expect(result.mimeType).toBe("application/pdf");
    expect(result.fileBuffer.byteLength).toBe(validPdfBytes.byteLength);
    expect(result.provenance.sourceId).toBe("KERALA_STATE_LOTTERY_PORTAL");
    expect(result.provenance.httpMetadata.statusCode).toBe(200);
    expect(result.provenance.httpMetadata.sha256).toBe(validSha256);
    expect(result.provenance.httpMetadata.etag).toBe('"test-etag-123"');
    expect(result.provenance.contentTypeMismatch).toBe(false);
  });

  // 3. HTTP non-200 handling
  it("3. Invariant: Rejects non-200 HTTP responses", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      headers: new Headers()
    });

    const service = new DocumentAcquisitionService({ fetchFn: mockFetch as any });
    await expect(
      service.acquire({
        url: "https://statelottery.kerala.gov.in/images/pdf/missing.pdf"
      })
    ).rejects.toThrow(AcquisitionHttpError);
  });

  // 4. HTML masquerading as PDF
  it("4. Invariant: Rejects HTML error pages masquerading as PDF", async () => {
    const htmlBytes = Buffer.from("<!DOCTYPE html><html><body><h1>404 Not Found</h1></body></html>");
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "application/pdf" }),
      arrayBuffer: async () => htmlBytes.buffer.slice(htmlBytes.byteOffset, htmlBytes.byteOffset + htmlBytes.byteLength)
    });

    const service = new DocumentAcquisitionService({ fetchFn: mockFetch as any });
    await expect(
      service.acquire({
        url: "https://statelottery.kerala.gov.in/images/pdf/fake.pdf"
      })
    ).rejects.toThrow(AcquisitionValidationError);
  });

  // 5. empty response
  it("5. Invariant: Rejects empty response body (0 bytes)", async () => {
    const emptyBytes = new Uint8Array(0);
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "application/pdf" }),
      arrayBuffer: async () => emptyBytes.buffer
    });

    const service = new DocumentAcquisitionService({ fetchFn: mockFetch as any });
    await expect(
      service.acquire({
        url: "https://statelottery.kerala.gov.in/images/pdf/empty.pdf"
      })
    ).rejects.toThrow(AcquisitionValidationError);
  });

  // 6. malformed PDF header
  it("6. Invariant: Rejects response with malformed/missing PDF magic bytes", async () => {
    const badBytes = Buffer.from("NOT_A_VALID_PDF_MAGIC_HEADER_DATA_12345");
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "application/pdf" }),
      arrayBuffer: async () => badBytes.buffer.slice(badBytes.byteOffset, badBytes.byteOffset + badBytes.byteLength)
    });

    const service = new DocumentAcquisitionService({ fetchFn: mockFetch as any });
    await expect(
      service.acquire({
        url: "https://statelottery.kerala.gov.in/images/pdf/bad-header.pdf"
      })
    ).rejects.toThrow(AcquisitionValidationError);
  });

  // 7. redirect handling
  it("7. Invariant: Follows safe redirects within allowed domains and bounds", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 302,
        statusText: "Found",
        headers: new Headers({
          location: "https://statelottery.kerala.gov.in/images/pdf/final-draw.pdf"
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({
          "content-type": "application/pdf",
          "content-length": validPdfBytes.byteLength.toString()
        }),
        arrayBuffer: async () => validPdfBytes.buffer.slice(validPdfBytes.byteOffset, validPdfBytes.byteOffset + validPdfBytes.byteLength)
      });

    const service = new DocumentAcquisitionService({ fetchFn: mockFetch as any });
    const result = await service.acquire({
      url: "https://statelottery.kerala.gov.in/latest-draw.pdf"
    });

    expect(result.sourceUrl).toBe("https://statelottery.kerala.gov.in/images/pdf/final-draw.pdf");
    expect(result.provenance.requestedUrl).toBe("https://statelottery.kerala.gov.in/latest-draw.pdf");
    expect(result.provenance.finalUrl).toBe("https://statelottery.kerala.gov.in/images/pdf/final-draw.pdf");
    expect(result.provenance.redirectCount).toBe(1);

    // Test circular redirect loop prevention
    const circularFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 301,
      statusText: "Moved Permanently",
      headers: new Headers({
        location: "https://statelottery.kerala.gov.in/loop"
      })
    });
    const loopService = new DocumentAcquisitionService({ fetchFn: circularFetch as any });
    await expect(
      loopService.acquire({ url: "https://statelottery.kerala.gov.in/loop" })
    ).rejects.toThrow(AcquisitionSecurityError);
  });

  // 8. timeout/network failure
  it("8. Invariant: Handles network errors and request timeouts explicitly", async () => {
    const timeoutError = new Error("The operation was aborted");
    timeoutError.name = "AbortError";

    const mockFetch = vi.fn().mockRejectedValue(timeoutError);
    const service = new DocumentAcquisitionService({ fetchFn: mockFetch as any });

    await expect(
      service.acquire({
        url: "https://statelottery.kerala.gov.in/images/pdf/test.pdf",
        timeoutMs: 50
      })
    ).rejects.toThrow(AcquisitionNetworkError);
  });

  // 9. maximum response-size enforcement
  it("9. Invariant: Enforces maximum response byte limits", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({
        "content-type": "application/pdf",
        "content-length": "100000000" // 100 MB declared in header
      }),
      arrayBuffer: async () => validPdfBytes.buffer
    });

    const service = new DocumentAcquisitionService({ fetchFn: mockFetch as any });
    await expect(
      service.acquire({
        url: "https://statelottery.kerala.gov.in/images/pdf/huge.pdf",
        maxBytes: 1024 * 1024 // 1 MB limit
      })
    ).rejects.toThrow(AcquisitionValidationError);
  });

  // 10. Content-Type mismatch recording
  it("10. Invariant: Records Content-Type discrepancy when valid PDF has non-standard header", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({
        "content-type": "application/octet-stream", // Non-standard MIME type
        "content-length": validPdfBytes.byteLength.toString()
      }),
      arrayBuffer: async () => validPdfBytes.buffer.slice(validPdfBytes.byteOffset, validPdfBytes.byteOffset + validPdfBytes.byteLength)
    });

    const service = new DocumentAcquisitionService({ fetchFn: mockFetch as any });
    const result = await service.acquire({
      url: "https://statelottery.kerala.gov.in/images/pdf/stream.pdf"
    });

    // Invariant: Does not reject valid PDF, but faithfully records mismatch
    expect(result.mimeType).toBe("application/pdf");
    expect(result.provenance.contentTypeMismatch).toBe(true);
    expect(result.provenance.declaredContentType).toBe("application/octet-stream");
  });

  // 11. final URL provenance
  it("11. Invariant: Preserves original requested URL and final URL after redirects", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 301,
        headers: new Headers({ location: "/images/pdf/resolved.pdf" })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/pdf" }),
        arrayBuffer: async () => validPdfBytes.buffer.slice(validPdfBytes.byteOffset, validPdfBytes.byteOffset + validPdfBytes.byteLength)
      });

    const service = new DocumentAcquisitionService({ fetchFn: mockFetch as any });
    const result = await service.acquire({
      url: "https://statelottery.kerala.gov.in/alias.pdf",
      discoveryUrl: "https://statelottery.kerala.gov.in/index.php"
    });

    expect(result.provenance.requestedUrl).toBe("https://statelottery.kerala.gov.in/alias.pdf");
    expect(result.provenance.finalUrl).toBe("https://statelottery.kerala.gov.in/images/pdf/resolved.pdf");
    expect(result.provenance.discoveryUrl).toBe("https://statelottery.kerala.gov.in/index.php");
  });

  // 12. repeated acquisition
  it("12. Invariant: Repeated acquisition of same official document is deterministic and safe", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/pdf" }),
      arrayBuffer: async () => validPdfBytes.buffer.slice(validPdfBytes.byteOffset, validPdfBytes.byteOffset + validPdfBytes.byteLength)
    });

    const service = new DocumentAcquisitionService({ fetchFn: mockFetch as any });
    const run1 = await service.acquire({ url: "https://statelottery.kerala.gov.in/images/pdf/draw.pdf" });
    const run2 = await service.acquire({ url: "https://statelottery.kerala.gov.in/images/pdf/draw.pdf" });

    expect(run1.provenance.httpMetadata.sha256).toBe(run2.provenance.httpMetadata.sha256);
    expect(run1.fileBuffer.byteLength).toBe(run2.fileBuffer.byteLength);
  });

  // 13. same bytes → same SHA-256 identity
  it("13. Invariant: Same PDF bytes always yield identical SHA-256 cryptographic identity", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/pdf" }),
      arrayBuffer: async () => validPdfBytes.buffer.slice(validPdfBytes.byteOffset, validPdfBytes.byteOffset + validPdfBytes.byteLength)
    });

    const service = new DocumentAcquisitionService({ fetchFn: mockFetch as any });
    const res = await service.acquire({ url: "https://statelottery.kerala.gov.in/images/pdf/draw.pdf" });

    expect(res.provenance.httpMetadata.sha256).toBe(validSha256);
    expect(res.provenance.httpMetadata.sha256).toBe(computeSha256(validPdfBytes));
  });

  // 14. changed bytes → new immutable identity
  it("14. Invariant: Changed PDF bytes yield distinct immutable SHA-256 identities without collision", async () => {
    const mockFetch1 = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/pdf" }),
      arrayBuffer: async () => validPdfBytes.buffer.slice(validPdfBytes.byteOffset, validPdfBytes.byteOffset + validPdfBytes.byteLength)
    });
    const mockFetch2 = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/pdf" }),
      arrayBuffer: async () => altPdfBytes.buffer.slice(altPdfBytes.byteOffset, altPdfBytes.byteOffset + altPdfBytes.byteLength)
    });

    const service1 = new DocumentAcquisitionService({ fetchFn: mockFetch1 as any });
    const service2 = new DocumentAcquisitionService({ fetchFn: mockFetch2 as any });

    const res1 = await service1.acquire({ url: "https://statelottery.kerala.gov.in/images/pdf/version1.pdf" });
    const res2 = await service2.acquire({ url: "https://statelottery.kerala.gov.in/images/pdf/version2.pdf" });

    expect(res1.provenance.httpMetadata.sha256).toBe(validSha256);
    expect(res2.provenance.httpMetadata.sha256).toBe(altSha256);
    expect(res1.provenance.httpMetadata.sha256).not.toBe(res2.provenance.httpMetadata.sha256);
  });

  // 15. integration into Milestone 3A SourceIngestionService
  it("15. Invariant: Acquired document feeds seamlessly into SourceIngestionService with idempotent reuse", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({
        "content-type": "application/pdf",
        etag: '"prod-etag-456"'
      }),
      arrayBuffer: async () => validPdfBytes.buffer.slice(validPdfBytes.byteOffset, validPdfBytes.byteOffset + validPdfBytes.byteLength)
    });

    const acquisitionService = new DocumentAcquisitionService({ fetchFn: mockFetch as any });

    // Step A: Acquire document from official source
    const acquired = await acquisitionService.acquire({
      url: "https://statelottery.kerala.gov.in/images/pdf/draw-273.pdf",
      title: "Kerala State Lottery Draw 273 Official Gazette Result"
    });

    // Step B: Ingest into Milestone 3A SourceIngestionService
    const ingestion1 = await ingestionService.ingest({
      fileBuffer: acquired.fileBuffer,
      fileName: acquired.fileName,
      mimeType: acquired.mimeType,
      sourceUrl: acquired.sourceUrl,
      title: acquired.title,
      sourceOrganization: acquired.sourceOrganization,
      provenance: acquired.provenance
    });

    expect(ingestion1.action).toBe("CREATED");
    expect(ingestion1.isDuplicate).toBe(false);
    expect(ingestion1.document.id).toBe(validSha256);
    expect(ingestion1.document.storagePath).toBe(`source-documents/${validSha256}.pdf`);
    expect(ingestion1.document.provenance).toBeDefined();
    expect(ingestion1.document.provenance?.httpMetadata.sha256).toBe(validSha256);

    // Step C: Repeat acquisition & ingestion with same document (Idempotent reuse)
    const acquiredAgain = await acquisitionService.acquire({
      url: "https://statelottery.kerala.gov.in/images/pdf/draw-273.pdf"
    });

    const ingestion2 = await ingestionService.ingest({
      fileBuffer: acquiredAgain.fileBuffer,
      fileName: acquiredAgain.fileName,
      mimeType: acquiredAgain.mimeType,
      sourceUrl: acquiredAgain.sourceUrl,
      title: acquiredAgain.title,
      sourceOrganization: acquiredAgain.sourceOrganization,
      provenance: acquiredAgain.provenance
    });

    expect(ingestion2.action).toBe("EXISTING");
    expect(ingestion2.isDuplicate).toBe(true);
    expect(ingestion2.document.id).toBe(validSha256);
    expect(docRepo.getAll().length).toBe(1);
  });

  // Extra discovery test
  it("Discovers official result documents from portal HTML", async () => {
    const portalHtml = `
      <html>
        <body>
          <div class="sppb-addon-text-block">
            <span>Result - DHANALEKSHMI-10/11/2025 (DL-40) dated 18-02-2026</span>
            <a href="/English/../images/pdf/273-2113-18-02-2026.pdf"> Click here</a>
          </div>
          <div class="sppb-addon-text-block">
            <span>Result - STHREE-SAKTHI-10/11/2025 (SS-500) dated 30-12-2025</span>
            <a href="/images/pdf/272-2051-30-12-2025.pdf"> Click here</a>
          </div>
        </body>
      </html>
    `;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => portalHtml
    });

    const discoveryService = new OfficialSourceDiscoveryService({ fetchFn: mockFetch as any });
    const discovered = await discoveryService.discover(KERALA_STATE_LOTTERY_PORTAL);

    expect(discovered.length).toBe(2);
    expect(discovered[0]!.documentUrl).toBe("https://statelottery.kerala.gov.in/images/pdf/273-2113-18-02-2026.pdf");
    expect(discovered[0]!.drawNumber).toBe("DL-40");
    expect(discovered[0]!.drawDate).toBe("2026-02-18");
    expect(discovered[0]!.lotteryCode).toBe("DHANALEKSHMI");

    expect(discovered[1]!.documentUrl).toBe("https://statelottery.kerala.gov.in/images/pdf/272-2051-30-12-2025.pdf");
    expect(discovered[1]!.drawNumber).toBe("SS-500");
    expect(discovered[1]!.drawDate).toBe("2025-12-30");
    expect(discovered[1]!.lotteryCode).toBe("STHREE-SAKTHI");
  });
});
