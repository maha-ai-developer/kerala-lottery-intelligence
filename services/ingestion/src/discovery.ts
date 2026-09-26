/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 3B — Official Source Discovery Service
 *
 * Discovers official result documents published on government portal endpoints.
 */

import {
  type OfficialSource,
  KERALA_STATE_LOTTERY_PORTAL,
  validateOfficialSource,
  validateSafeUrl,
  DocumentValidationError
} from "@kerala-lottery/documents";
import {
  AcquisitionError,
  AcquisitionNetworkError,
  AcquisitionHttpError,
  AcquisitionSecurityError,
  AcquisitionValidationError
} from "./errors";

export interface DiscoveredDocument {
  sourceId: string;
  sourceOrganization: string;
  discoveryUrl: string;
  documentUrl: string;
  title: string;
  drawDate?: string;
  drawNumber?: string;
  lotteryCode?: string;
  rawLinkText?: string;
}

export interface OfficialSourceDiscoveryServiceDependencies {
  fetchFn?: typeof fetch;
}

export class OfficialSourceDiscoveryService {
  private readonly fetch: typeof fetch;

  constructor(deps?: OfficialSourceDiscoveryServiceDependencies) {
    this.fetch = deps?.fetchFn || globalThis.fetch.bind(globalThis);
  }

  /**
   * Scans an official government source's discovery endpoint to find published lottery result documents.
   */
  async discover(source?: OfficialSource): Promise<DiscoveredDocument[]> {
    const officialSource = source || KERALA_STATE_LOTTERY_PORTAL;
    try {
      validateOfficialSource(officialSource);
    } catch (err: unknown) {
      if (err instanceof DocumentValidationError) {
        throw new AcquisitionValidationError(err.message, err.code);
      }
      throw err;
    }

    // Validate discovery URL
    try {
      validateSafeUrl(officialSource.discoveryUrl, officialSource.allowedDomains);
    } catch (err: unknown) {
      if (err instanceof DocumentValidationError) {
        throw new AcquisitionSecurityError(err.message, { url: officialSource.discoveryUrl, code: err.code });
      }
      throw err;
    }

    let html: string;
    try {
      const res = await this.fetch(officialSource.discoveryUrl, {
        method: "GET",
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "KeralaLotteryIntelligence/1.0 (+https://kerala-lottery-intelligence)"
        }
      });

      if (!res.ok) {
        throw new AcquisitionHttpError(
          `Discovery fetch to '${officialSource.discoveryUrl}' failed with status ${res.status}`,
          res.status,
          { url: officialSource.discoveryUrl }
        );
      }

      html = await res.text();
    } catch (err: unknown) {
      if (err instanceof AcquisitionError) {
        throw err;
      }
      if (err instanceof Error) {
        throw new AcquisitionNetworkError(
          `Network error during discovery at '${officialSource.discoveryUrl}': ${err.message}`,
          { url: officialSource.discoveryUrl }
        );
      }
      throw new AcquisitionNetworkError(`Unknown error during discovery at '${officialSource.discoveryUrl}'`);
    }

    return this.parseDiscoveryHtml(html, officialSource);
  }

  /**
   * Parses official portal HTML to extract published PDF result entries.
   */
  parseDiscoveryHtml(html: string, officialSource: OfficialSource): DiscoveredDocument[] {
    const results: DiscoveredDocument[] = [];
    const seenUrls = new Set<string>();

    // Strategy 1: Match structured "Result - <Title> ... <a href='...pdf'> Click here</a>" blocks
    // Example: Result - DHANALEKSHMI-10/11/2025 (DL-40) dated 18-02-2026 ... <a href="/English/../images/pdf/273-2113-18-02-2026.pdf"
    const blockRegex = /Result\s*-\s*([^<]+)<\/span>[\s\S]{0,120}?<a\s+[^>]*href=["']([^"']+\.pdf)["'][^>]*>(.*?)<\/a>/gi;
    let match: RegExpExecArray | null;

    while ((match = blockRegex.exec(html)) !== null) {
      const rawTitle = (match[1] ?? "").trim();
      const rawHref = (match[2] ?? "").trim();
      const rawLinkText = (match[3] ?? "").replace(/<[^>]+>/g, "").trim();

      const documentUrl = this.resolveAndValidateUrl(rawHref, officialSource);
      if (!documentUrl || seenUrls.has(documentUrl)) {
        continue;
      }
      seenUrls.add(documentUrl);

      const parsedMeta = this.parseTitleMetadata(rawTitle);

      results.push({
        sourceId: officialSource.sourceId,
        sourceOrganization: officialSource.organization,
        discoveryUrl: officialSource.discoveryUrl,
        documentUrl,
        title: rawTitle ? `Result - ${rawTitle}` : `Kerala State Lottery Result ${parsedMeta.drawNumber || ""}`.trim(),
        drawDate: parsedMeta.drawDate,
        drawNumber: parsedMeta.drawNumber,
        lotteryCode: parsedMeta.lotteryCode,
        rawLinkText: rawLinkText || undefined
      });
    }

    // Strategy 2: Fallback scan for any remaining <a href="...pdf"> tags referencing /pdf/ or result files
    const genericPdfRegex = /<a\s+[^>]*href=["']([^"']+\.pdf)["'][^>]*>(.*?)<\/a>/gi;
    while ((match = genericPdfRegex.exec(html)) !== null) {
      const rawHref = (match[1] ?? "").trim();
      const rawText = (match[2] ?? "").replace(/<[^>]+>/g, "").trim();

      const documentUrl = this.resolveAndValidateUrl(rawHref, officialSource);
      if (!documentUrl || seenUrls.has(documentUrl)) {
        continue;
      }

      // Filter for result PDFs (avoid unrelated links if any)
      if (
        documentUrl.includes("/pdf/") ||
        documentUrl.includes("result") ||
        /\d{2,}-\d{2,}/.test(documentUrl)
      ) {
        seenUrls.add(documentUrl);
        const parsedMeta = this.parseTitleMetadata(rawText);

        results.push({
          sourceId: officialSource.sourceId,
          sourceOrganization: officialSource.organization,
          discoveryUrl: officialSource.discoveryUrl,
          documentUrl,
          title: rawText && rawText !== "Click here" ? rawText : `Official Gazette Result (${documentUrl.split("/").pop()})`,
          drawDate: parsedMeta.drawDate,
          drawNumber: parsedMeta.drawNumber,
          lotteryCode: parsedMeta.lotteryCode,
          rawLinkText: rawText || undefined
        });
      }
    }

    // Strategy 3: Match table rows from official results view table:
    // <tr><td class='text-left'>KARUNYA PLUS(KN-641)</td><td >17/09/2026</td><td ><a href='http://result.keralalotteries.com/viewlotisresult.php?drawserial=75382'...
    const tableRowRegex =
      /<tr[^>]*>\s*<td[^>]*class=['"][^'"]*text-left[^'"]*['"][^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*><a\s+[^>]*href=['"]([^'"]+)['"][^>]*>([^<]*)<\/a>/gi;
    while ((match = tableRowRegex.exec(html)) !== null) {
      const rawTitle = (match[1] ?? "").trim();
      const rawDate = (match[2] ?? "").trim();
      const rawHref = (match[3] ?? "").trim();
      const rawLinkText = (match[4] ?? "").trim();

      const documentUrl = this.resolveAndValidateUrl(rawHref, officialSource);
      if (!documentUrl || seenUrls.has(documentUrl)) {
        continue;
      }
      seenUrls.add(documentUrl);

      const parsedMeta = this.parseTitleMetadata(rawTitle);
      let canonicalDate = parsedMeta.drawDate;
      if (!canonicalDate && rawDate) {
        const parts = rawDate.split(/[-/]/);
        if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
          canonicalDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }

      results.push({
        sourceId: officialSource.sourceId,
        sourceOrganization: officialSource.organization,
        discoveryUrl: officialSource.discoveryUrl,
        documentUrl,
        title: rawTitle ? `Result - ${rawTitle}` : `Kerala State Lottery Result ${parsedMeta.drawNumber || ""}`.trim(),
        drawDate: canonicalDate,
        drawNumber: parsedMeta.drawNumber,
        lotteryCode: parsedMeta.lotteryCode,
        rawLinkText: rawLinkText || undefined
      });
    }

    return results;
  }

  private resolveAndValidateUrl(rawHref: string, source: OfficialSource): string | null {
    try {
      const resolved = new URL(rawHref, source.discoveryUrl).toString();
      validateSafeUrl(resolved, source.allowedDomains);
      return resolved;
    } catch {
      return null;
    }
  }

  private parseTitleMetadata(text: string): { drawDate?: string; drawNumber?: string; lotteryCode?: string } {
    const meta: { drawDate?: string; drawNumber?: string; lotteryCode?: string } = {};

    // Match draw series code e.g. (DL-40), (SS-500), (W-780)
    const drawNoMatch = text.match(/\(([A-Z]{1,4}-\d+)\)/i);
    if (drawNoMatch && drawNoMatch[1]) {
      meta.drawNumber = drawNoMatch[1].toUpperCase();
    }

    // Match lottery name / code e.g. DHANALEKSHMI, STHREE-SAKTHI, WIN-WIN
    const lotteryCodeMatch = text.match(/^([A-Z]+(?:-[A-Z]+)?)/i);
    if (lotteryCodeMatch && lotteryCodeMatch[1]) {
      meta.lotteryCode = lotteryCodeMatch[1].toUpperCase();
    }

    // Match draw date: prioritize explicit "dated DD-MM-YYYY"
    const explicitDateMatch = text.match(/dated\s+(\d{2}[-/]\d{2}[-/]\d{4})/i);
    const dateMatch = explicitDateMatch || text.match(/(\d{2}[-/]\d{2}[-/]\d{4})/);
    if (dateMatch && dateMatch[1]) {
      // Convert DD-MM-YYYY to canonical YYYY-MM-DD
      const parts = dateMatch[1].split(/[-/]/);
      if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
        meta.drawDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }

    return meta;
  }
}
