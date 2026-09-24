/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 3B — Official Document Acquisition Service
 *
 * Enforces:
 *   - Strict official source domain constraint
 *   - SSRF and private-network protection
 *   - Bounded, safe redirect following
 *   - Configurable timeout and network failure representation
 *   - Maximum size enforcement
 *   - Content-Type mismatch detection
 *   - Non-200 HTTP status rejection
 *   - PDF magic bytes verification & HTML rejection
 *   - Cryptographic SHA-256 provenance capture
 */

import {
  type OfficialSource,
  type DocumentProvenance,
  KERALA_STATE_LOTTERY_PORTAL,
  validateOfficialSource,
  validateSafeUrl,
  computeSha256,
  DocumentValidationError
} from "@kerala-lottery/documents";
import {
  AcquisitionNetworkError,
  AcquisitionHttpError,
  AcquisitionSecurityError,
  AcquisitionValidationError
} from "./errors";

export interface AcquireDocumentInput {
  url: string;
  officialSource?: OfficialSource;
  discoveryUrl?: string;
  title?: string;
  sourceOrganization?: string;
  maxBytes?: number; // defaults to 25 MB
  timeoutMs?: number; // defaults to 30,000 ms
  maxRedirects?: number; // defaults to 5
}

export interface AcquisitionResult {
  fileBuffer: Uint8Array;
  fileName: string;
  mimeType: string;
  sourceUrl: string;
  title: string;
  sourceOrganization: string;
  provenance: DocumentProvenance;
}

export interface DocumentAcquisitionServiceDependencies {
  fetchFn?: typeof fetch;
}

const DEFAULT_MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds
const DEFAULT_MAX_REDIRECTS = 5;

export class DocumentAcquisitionService {
  private readonly fetch: typeof fetch;

  constructor(deps?: DocumentAcquisitionServiceDependencies) {
    this.fetch = deps?.fetchFn || globalThis.fetch.bind(globalThis);
  }

  /**
   * Safely retrieves an official Kerala State Lottery document over HTTP(S).
   */
  async acquire(input: AcquireDocumentInput): Promise<AcquisitionResult> {
    if (!input || typeof input !== "object") {
      throw new AcquisitionValidationError("Input must be an object", "INVALID_INPUT");
    }

    const officialSource = input.officialSource || KERALA_STATE_LOTTERY_PORTAL;
    try {
      validateOfficialSource(officialSource);
    } catch (err: unknown) {
      if (err instanceof DocumentValidationError) {
        throw new AcquisitionValidationError(err.message, err.code);
      }
      throw err;
    }

    const maxBytes = input.maxBytes ?? DEFAULT_MAX_BYTES;
    const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const maxRedirects = input.maxRedirects ?? DEFAULT_MAX_REDIRECTS;

    let currentUrl = input.url;
    let redirectCount = 0;
    const visitedUrls = new Set<string>();

    // Initial URL safety validation
    this.validateTargetUrl(currentUrl, officialSource);
    visitedUrls.add(currentUrl);

    let res: Response;

    while (true) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        res = await this.fetch(currentUrl, {
          method: "GET",
          headers: {
            Accept: "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8",
            "User-Agent": "KeralaLotteryIntelligence/1.0 (+https://kerala-lottery-intelligence)"
          },
          redirect: "manual",
          signal: controller.signal
        });
      } catch (err: unknown) {
        if (err instanceof Error) {
          if (err.name === "AbortError") {
            throw new AcquisitionNetworkError(
              `Request to '${currentUrl}' timed out after ${timeoutMs}ms`,
              { url: currentUrl, timeoutMs }
            );
          }
          throw new AcquisitionNetworkError(
            `Network request failed for '${currentUrl}': ${err.message}`,
            { url: currentUrl, originalError: err.message }
          );
        }
        throw new AcquisitionNetworkError(`Unknown network error for '${currentUrl}'`, { url: currentUrl });
      } finally {
        clearTimeout(timeoutId);
      }

      // Handle HTTP redirects (301, 302, 303, 307, 308)
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        redirectCount++;
        if (redirectCount > maxRedirects) {
          throw new AcquisitionSecurityError(
            `Exceeded maximum redirect limit of ${maxRedirects}`,
            { redirectCount, maxRedirects, finalUrl: currentUrl }
          );
        }

        const location = res.headers.get("location");
        if (!location) {
          throw new AcquisitionHttpError(
            `Redirect status ${res.status} received without Location header from '${currentUrl}'`,
            res.status,
            { url: currentUrl }
          );
        }

        const resolvedTarget = new URL(location, currentUrl).toString();
        if (visitedUrls.has(resolvedTarget)) {
          throw new AcquisitionSecurityError(
            `Circular redirect loop detected: '${resolvedTarget}' was already visited`,
            { url: resolvedTarget, visited: Array.from(visitedUrls) }
          );
        }

        // Validate redirected URL against official allowed domains and SSRF
        this.validateTargetUrl(resolvedTarget, officialSource);
        visitedUrls.add(resolvedTarget);
        currentUrl = resolvedTarget;
        continue;
      }

      break;
    }

    // Validate HTTP Success (200..299)
    if (!res.ok) {
      throw new AcquisitionHttpError(
        `HTTP request to '${currentUrl}' failed with status ${res.status} ${res.statusText}`,
        res.status,
        { url: currentUrl, statusText: res.statusText }
      );
    }

    // Check declared Content-Length
    const declaredContentLength = res.headers.get("content-length");
    if (declaredContentLength) {
      const lengthInt = parseInt(declaredContentLength, 10);
      if (!isNaN(lengthInt) && lengthInt > maxBytes) {
        throw new AcquisitionValidationError(
          `Document size (${lengthInt} bytes) exceeds configured limit of ${maxBytes} bytes`,
          "MAX_SIZE_EXCEEDED",
          { declaredContentLength: lengthInt, maxBytes }
        );
      }
    }

    // Read response body bytes
    const arrayBuffer = await res.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

    // Validate byte size
    if (fileBuffer.byteLength === 0) {
      throw new AcquisitionValidationError(
        `Empty response body (0 bytes) received from '${currentUrl}'`,
        "EMPTY_RESPONSE",
        { url: currentUrl }
      );
    }

    if (fileBuffer.byteLength > maxBytes) {
      throw new AcquisitionValidationError(
        `Document byte length (${fileBuffer.byteLength} bytes) exceeds limit of ${maxBytes} bytes`,
        "MAX_SIZE_EXCEEDED",
        { byteLength: fileBuffer.byteLength, maxBytes }
      );
    }

    // Validate PDF magic header '%PDF-'
    if (fileBuffer.byteLength < 5) {
      throw new AcquisitionValidationError(
        "Response is too small to be a valid PDF",
        "INVALID_PDF_HEADER"
      );
    }

    const headerSnippet = Buffer.from(fileBuffer.buffer, fileBuffer.byteOffset, Math.min(fileBuffer.byteLength, 64)).toString("latin1");
    if (
      headerSnippet.trim().toLowerCase().startsWith("<!doctype") ||
      headerSnippet.trim().toLowerCase().startsWith("<html") ||
      headerSnippet.includes("<html")
    ) {
      throw new AcquisitionValidationError(
        `Response from '${currentUrl}' is an HTML document, not a PDF. Possible error page or portal splash screen.`,
        "HTML_MASQUERADING_AS_PDF",
        { url: currentUrl, snippet: headerSnippet.substring(0, 40) }
      );
    }

    if (!headerSnippet.startsWith("%PDF-")) {
      throw new AcquisitionValidationError(
        `Invalid PDF magic header. Expected '%PDF-', received '${headerSnippet.substring(0, 5)}'`,
        "INVALID_PDF_HEADER",
        { url: currentUrl, header: headerSnippet.substring(0, 8) }
      );
    }

    // Content-Type validation and mismatch recording
    const rawContentType = res.headers.get("content-type");
    const normalizedContentType = rawContentType ? (rawContentType.split(";")[0]?.trim().toLowerCase() ?? "") : "";
    const isStandardPdfContentType = normalizedContentType === "application/pdf";
    const contentTypeMismatch = !isStandardPdfContentType;

    // Extract filename from Content-Disposition or URL path
    const fileName = this.extractFileName(res.headers.get("content-disposition"), currentUrl);

    // Compute cryptographic SHA-256
    const sha256 = computeSha256(fileBuffer);
    const retrievedAt = new Date().toISOString();

    const provenance: DocumentProvenance = {
      sourceId: officialSource.sourceId,
      sourceOrganization: input.sourceOrganization || officialSource.organization,
      discoveryUrl: input.discoveryUrl || officialSource.discoveryUrl,
      requestedUrl: input.url,
      finalUrl: currentUrl,
      redirectCount,
      retrievedAt,
      originalFileName: fileName,
      contentTypeMismatch,
      declaredContentType: rawContentType || undefined,
      httpMetadata: {
        statusCode: res.status,
        contentType: isStandardPdfContentType ? "application/pdf" : (rawContentType || "application/octet-stream"),
        contentLength: declaredContentLength ? parseInt(declaredContentLength, 10) : fileBuffer.byteLength,
        etag: res.headers.get("etag") || undefined,
        lastModified: res.headers.get("last-modified") || undefined,
        server: res.headers.get("server") || undefined,
        sha256,
        byteSize: fileBuffer.byteLength
      }
    };

    return {
      fileBuffer,
      fileName,
      mimeType: "application/pdf",
      sourceUrl: currentUrl,
      title: input.title || fileName,
      sourceOrganization: input.sourceOrganization || officialSource.organization,
      provenance
    };
  }

  private validateTargetUrl(urlStr: string, source: OfficialSource): void {
    try {
      validateSafeUrl(urlStr, source.allowedDomains);
    } catch (err: unknown) {
      if (err instanceof DocumentValidationError) {
        throw new AcquisitionSecurityError(err.message, { url: urlStr, code: err.code });
      }
      throw err;
    }
  }

  private extractFileName(contentDisposition: string | null, finalUrl: string): string {
    if (contentDisposition) {
      // Support filename="sample.pdf" or filename*=UTF-8''sample.pdf
      const match = contentDisposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
      if (match && match[1]) {
        const cleaned = match[1].trim().replace(/^['"]|['"]$/g, "");
        if (cleaned.length > 0) {
          return cleaned;
        }
      }
    }

    try {
      const urlObj = new URL(finalUrl);
      const segments = urlObj.pathname.split("/").filter(Boolean);
      const last = segments.pop();
      if (last && last.toLowerCase().endsWith(".pdf")) {
        return decodeURIComponent(last);
      }
      if (last) {
        return `${decodeURIComponent(last)}.pdf`;
      }
    } catch {
      // ignore URL parsing error for filename extraction
    }

    return "official-lottery-document.pdf";
  }
}
