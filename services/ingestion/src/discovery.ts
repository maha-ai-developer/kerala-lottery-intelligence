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

export type DiscoveryStatusCode =
  | "TODAY_PUBLISHED"
  | "NO_NEW_RESULT"
  | "NOT_YET_PUBLISHED"
  | "NO_SCHEDULED_DRAW"
  | "SOURCE_UNAVAILABLE";

export interface IstDateInfo {
  /** Canonical YYYY-MM-DD in Asia/Kolkata */
  isoDate: string;
  /** Display DD/MM/YYYY in Asia/Kolkata */
  displayDate: string;
  /** Day of week (0 = Sunday .. 6 = Saturday) in Asia/Kolkata */
  dayOfWeek: number;
  /** English weekday name in Asia/Kolkata */
  dayName: string;
  /** Alias for dayName */
  weekday: string;
  /** Hour (0-23) in Asia/Kolkata */
  hour: number;
  /** Alias for hour */
  hourIst: number;
  /** Minute (0-59) in Asia/Kolkata */
  minute: number;
  /** Formatted IST timestamp string */
  istTimestamp: string;
}

export interface ScheduledLotteryInfo {
  isoDate: string;
  dayName: string;
  scheduled: boolean;
  isExpectedToday: boolean;
  lotteryName?: string;
  lotteryCode?: string;
  scheduledLotteryCode: string | null;
  drawSeriesPrefix?: string;
  drawTimeIst: string;
  expectedPdfPublicationTimeIst: string;
  reason?: string;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6
};

const DAILY_LOTTERY_SCHEDULE: Record<
  number,
  { lotteryName: string; lotteryCode: string; drawSeriesPrefix: string }
> = {
  0: { lotteryName: "SAMRUDHI", lotteryCode: "SAMRUDHI", drawSeriesPrefix: "SM" },
  1: { lotteryName: "BHAGYATHARA", lotteryCode: "BHAGYATHARA", drawSeriesPrefix: "BT" },
  2: { lotteryName: "STHREE-SAKTHI", lotteryCode: "STHREE-SAKTHI", drawSeriesPrefix: "SS" },
  3: { lotteryName: "DHANALEKSHMI", lotteryCode: "DHANALEKSHMI", drawSeriesPrefix: "DL" },
  4: { lotteryName: "KARUNYA-PLUS", lotteryCode: "KARUNYA-PLUS", drawSeriesPrefix: "KN" },
  5: { lotteryName: "SUVARNA-KERALAM", lotteryCode: "SUVARNA-KERALAM", drawSeriesPrefix: "SK" },
  6: { lotteryName: "KARUNYA", lotteryCode: "KARUNYA", drawSeriesPrefix: "KR" }
};

/**
 * Computes the current date and time metadata in the Asia/Kolkata (IST) timezone.
 */
export function getIstDateInfo(now: Date = new Date()): IstDateInfo {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(now);
  const partMap: Record<string, string> = {};
  for (const part of parts) {
    partMap[part.type] = part.value;
  }

  const year = partMap.year ?? "1970";
  const month = partMap.month ?? "01";
  const day = partMap.day ?? "01";
  const dayName = partMap.weekday ?? "Sunday";
  const dayOfWeek = WEEKDAY_INDEX[dayName] ?? 0;
  const hour = Number(partMap.hour ?? "0") % 24;
  const minute = Number(partMap.minute ?? "0");
  const second = partMap.second ?? "00";

  return {
    isoDate: `${year}-${month}-${day}`,
    displayDate: `${day}/${month}/${year}`,
    dayOfWeek,
    dayName,
    weekday: dayName,
    hour,
    hourIst: hour,
    minute,
    istTimestamp: `${year}-${month}-${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${second}+05:30`
  };
}

/**
 * Determines the scheduled Kerala State Lottery draw for a canonical YYYY-MM-DD date in Asia/Kolkata.
 */
export function getScheduledLotteryForIstDate(
  isoDate: string,
  options?: { noDrawDates?: string[] }
): ScheduledLotteryInfo {
  const middayIst = new Date(`${isoDate}T12:00:00+05:30`);
  const info = Number.isNaN(middayIst.getTime()) ? getIstDateInfo() : getIstDateInfo(middayIst);

  if (options?.noDrawDates?.includes(isoDate)) {
    return {
      isoDate,
      dayName: info.dayName,
      scheduled: false,
      isExpectedToday: false,
      scheduledLotteryCode: null,
      drawTimeIst: "15:00 IST",
      expectedPdfPublicationTimeIst: "16:30 IST",
      reason: `No draw scheduled for ${isoDate} (official no-draw date)`
    };
  }

  const scheduleEntry = DAILY_LOTTERY_SCHEDULE[info.dayOfWeek] ?? DAILY_LOTTERY_SCHEDULE[0]!;
  return {
    isoDate,
    dayName: info.dayName,
    scheduled: true,
    isExpectedToday: true,
    lotteryName: scheduleEntry.lotteryName,
    lotteryCode: scheduleEntry.lotteryCode,
    scheduledLotteryCode: scheduleEntry.lotteryCode,
    drawSeriesPrefix: scheduleEntry.drawSeriesPrefix,
    drawTimeIst: "15:00 IST",
    expectedPdfPublicationTimeIst: "16:30 IST"
  };
}

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

export interface DiscoverOptions {
  /** Number of bounded retries on transient network or 5xx HTTP errors (default: 0 for strict unit tests, configurable by callers). */
  maxRetries?: number;
  /** Delay in ms between retry attempts (default: 50). */
  retryDelayMs?: number;
}

export class OfficialSourceDiscoveryService {
  private readonly fetch: typeof fetch;

  constructor(deps?: OfficialSourceDiscoveryServiceDependencies | typeof fetch) {
    const fn = typeof deps === "function" ? deps : deps?.fetchFn;
    this.fetch = fn || globalThis.fetch.bind(globalThis);
  }

  /**
   * Scans an official government source's discovery endpoint to find published lottery result documents.
   */
  async discover(source?: OfficialSource, options?: DiscoverOptions): Promise<DiscoveredDocument[]> {
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

    const maxRetries = Math.max(0, options?.maxRetries ?? 0);
    const retryDelayMs = Math.max(0, options?.retryDelayMs ?? 50);
    let html = "";
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0 && retryDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
      try {
        const res = await this.fetch(officialSource.discoveryUrl, {
          method: "GET",
          headers: {
            Accept: "text/html,application/xhtml+xml",
            "User-Agent": "KeralaLotteryIntelligence/1.0 (+https://kerala-lottery-intelligence)"
          }
        });

        // Validate final response URL if redirect occurred
        if (res.url && typeof res.url === "string" && res.url.trim() !== "") {
          try {
            validateSafeUrl(res.url, officialSource.allowedDomains);
          } catch (redirectErr: unknown) {
            if (redirectErr instanceof DocumentValidationError) {
              throw new AcquisitionSecurityError(
                `Discovery redirect to unauthorized host blocked: ${redirectErr.message}`,
                { url: res.url, code: redirectErr.code }
              );
            }
            throw redirectErr;
          }
        }

        if (!res.ok) {
          const httpErr = new AcquisitionHttpError(
            `Discovery fetch to '${officialSource.discoveryUrl}' failed with status ${res.status}`,
            res.status,
            { url: officialSource.discoveryUrl }
          );
          if (res.status >= 500 && attempt < maxRetries) {
            lastError = httpErr;
            continue;
          }
          throw httpErr;
        }

        html = await res.text();
        lastError = undefined;
        break;
      } catch (err: unknown) {
        if (err instanceof AcquisitionSecurityError || err instanceof AcquisitionValidationError) {
          throw err;
        }
        if (err instanceof AcquisitionHttpError) {
          if (err.statusCode >= 500 && attempt < maxRetries) {
            lastError = err;
            continue;
          }
          throw err;
        }
        if (attempt < maxRetries) {
          lastError = err;
          continue;
        }
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
    }

    if (lastError) {
      if (lastError instanceof AcquisitionError) throw lastError;
      if (lastError instanceof Error) {
        throw new AcquisitionNetworkError(
          `Network error during discovery at '${officialSource.discoveryUrl}': ${lastError.message}`,
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
    const blockRegex = /Result\s*-\s*([^<]+)<\/span>[\s\S]{0,120}?<a\s+[^>]*href=["']([^"']+\.pdf)["'][^>]*>([\s\S]*?)<\/a>/gi;
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
    const genericPdfRegex = /<a\s+[^>]*href=["']([^"']+\.pdf)["'][^>]*>([\s\S]*?)<\/a>/gi;
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
        documentUrl.includes("/files/") ||
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

    // Match draw series code e.g. (DL-40), (DL-75th), (SS-500), (W-780)
    const drawNoMatch = text.match(/\(([A-Z]{1,4}-\d+(?:st|nd|rd|th)?)\)/i);
    if (drawNoMatch && drawNoMatch[1]) {
      const rawDrawNo = drawNoMatch[1];
      const ordinalMatch = rawDrawNo.match(/^([A-Z]{1,4}-\d+)(st|nd|rd|th)?$/i);
      meta.drawNumber = ordinalMatch
        ? `${ordinalMatch[1]!.toUpperCase()}${ordinalMatch[2] ? ordinalMatch[2].toLowerCase() : ""}`
        : rawDrawNo.toUpperCase();
    }

    // Match lottery name / code e.g. DHANALEKSHMI, STHREE-SAKTHI, WIN-WIN, KARUNYA PLUS
    const cleanedPrefix = text.split("(")[0]?.replace(/^Result\s*-\s*/i, "").trim() || text.trim();
    const multiWordMatch = cleanedPrefix.match(
      /^(KARUNYA\s+PLUS|SUVARNA\s+KERALAM|STHREE\s+SAKTHI|FIFTY\s+FIFTY|WIN\s+WIN)/i
    );
    if (multiWordMatch && multiWordMatch[1]) {
      meta.lotteryCode = multiWordMatch[1].trim().replace(/\s+/g, "-").toUpperCase();
    } else {
      const lotteryCodeMatch = cleanedPrefix.match(/^([A-Z]+(?:-[A-Z]+)?)/i);
      if (lotteryCodeMatch && lotteryCodeMatch[1]) {
        meta.lotteryCode = lotteryCodeMatch[1].toUpperCase();
      }
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
