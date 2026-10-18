/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Operational Ingestion Console API & Security Boundary Tests
 *
 * Verifies all 17 Phase 7 Operational Ingestion requirements:
 * 1. Valid official PDF upload preview (dry-run via JSON & multipart/form-data)
 * 2. Non-PDF upload rejected (400 INVALID_PDF)
 * 3. Empty (0 bytes) or truncated PDF (missing %%EOF) rejected (400 INVALID_PDF / TRUNCATED_PDF)
 * 4. Oversized upload (> 10 MB) rejected (413 FILE_TOO_LARGE)
 * 5. Leading-zero prize numbers ("012345", "0123") preserved as exact strings
 * 6. Duplicate SHA-256 detected as ALREADY_KNOWN
 * 7. Conflicting draw identity rejected (409 INGESTION_CONFLICT on commit, CONFLICT on dry-run)
 * 8. Automatic current-date check (Asia/Kolkata) computes IST date and scheduled lottery
 * 9. Automatic check when today's result is already ingested returns NO_NEW_RESULT
 * 10. Automatic check when today's result is not yet published returns NOT_YET_PUBLISHED
 * 11. Automatic check when no draw is scheduled for today returns NO_SCHEDULED_DRAW
 * 12. Automatic check when a new official result is discovered returns TODAY_PUBLISHED / NEW candidate
 * 13. Official source timeout / network error handled gracefully with SOURCE_UNAVAILABLE
 * 14. Unauthorized domain / redirect rejected (403 SECURITY_VIOLATION)
 * 15. Unconfirmed ingestion (confirm: false) and PROD ingestion rejected (400 / 403)
 * 16. Single-flight lock conflict handled (409 CONCURRENCY_LOCK_ACTIVE)
 * 17. Confirmed DEV ingestion updates isolated local cache/manifest & mock cloud cleanly without mutating tracked corpus
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync, existsSync, mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  POST as checkPost,
  GET as checkGet
} from "../apps/web/app/api/ops/ingestion/check/route";
import { POST as dryRunPost, GET as dryRunGet } from "../apps/web/app/api/ops/ingestion/dry-run/route";
import { POST as downloadPost, GET as downloadGet } from "../apps/web/app/api/ops/ingestion/download/route";
import { POST as uploadPost, GET as uploadGet } from "../apps/web/app/api/ops/ingestion/upload/route";
import { GET as runsGet, POST as runsPost } from "../apps/web/app/api/ops/ingestion/runs/route";
import { GET as integrityGet, POST as integrityPost } from "../apps/web/app/api/ops/ingestion/storage-integrity/route";
import { setStorageIntegrityDependenciesForTesting } from "../apps/web/lib/storage-integrity";
import {
  GET as v1RunsGet,
  POST as v1RunsPost,
  PUT as v1RunsPut,
  DELETE as v1RunsDelete,
  PATCH as v1RunsPatch
} from "../apps/web/app/api/v1/ingestion/runs/route";
import {
  getOpsLockManager,
  setOpsIngestionCloudDependenciesForTesting,
  setDiscoveryFetchOverrideForTesting
} from "../apps/web/lib/ops-guard";
import { isFirebaseConfigured } from "../apps/web/lib/firebase";
import { computeSha256, DEFAULT_MAX_UPLOAD_BYTES } from "@kerala-lottery/documents";
import { InMemoryDocumentRepository, InMemoryStorageService } from "@kerala-lottery/data";
import {
  SourceIngestionService,
  getIstDateInfo,
  getScheduledLotteryForIstDate
} from "@kerala-lottery/service-ingestion";

describe("Operational Ingestion Console: API & Security Boundary Tests", () => {
  const samplePdfPath = join(process.cwd(), "data/source-documents/lottery-results/271-2346-28-09-2026.pdf");
  let samplePdfBuffer: Buffer;
  let sampleSha: string;
  let tempDir: string | null = null;

  beforeEach(() => {
    if (existsSync(samplePdfPath)) {
      samplePdfBuffer = readFileSync(samplePdfPath);
      sampleSha = computeSha256(new Uint8Array(samplePdfBuffer));
    }
  });

  afterEach(() => {
    setStorageIntegrityDependenciesForTesting(null);
    setDiscoveryFetchOverrideForTesting(null);
    setOpsIngestionCloudDependenciesForTesting(null);
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  // ==========================================================================
  // 1. Research API Read-Only Immutability
  // ==========================================================================
  describe("1. Research API Read-Only Boundary", () => {
    it("GET /api/v1/ingestion/runs returns 200 with audited runs", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/ingestion/runs", { method: "GET" });
      const res = await v1RunsGet(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toBeDefined();
      expect(Array.isArray(json.data)).toBe(true);
    });

    it("rejects POST/PUT/DELETE/PATCH on /api/v1/ingestion/runs with 405 Method Not Allowed", async () => {
      const resPost = await v1RunsPost();
      expect(resPost.status).toBe(405);
      expect(resPost.headers.get("Allow")).toBe("GET");

      expect((await v1RunsPut()).status).toBe(405);
      expect((await v1RunsDelete()).status).toBe(405);
      expect((await v1RunsPatch()).status).toBe(405);
    });
  });

  // ==========================================================================
  // 2. Production Environment & Explicit Confirmation Safety Guards
  // ==========================================================================
  describe("2. Production Mutation & Operator Confirmation Safety Guards", () => {
    it("strictly rejects PROD mutation on download with 403 Forbidden", async () => {
      const req = new NextRequest("http://localhost:3000/api/ops/ingestion/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment: "PROD",
          confirm: true,
          candidate: {
            fileName: "test-candidate.pdf",
            sourceUrl: "https://result.keralalotteries.com/test.pdf"
          }
        })
      });

      const res = await downloadPost(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe("FORBIDDEN_PROD_MUTATION");
      expect(json.message).toContain("PROD mutations are strictly forbidden");
    });

    it("strictly rejects PROD mutation on upload with 403 Forbidden", async () => {
      const req = new NextRequest("http://localhost:3000/api/ops/ingestion/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment: "PROD",
          confirm: true,
          fileName: "uploaded.pdf",
          fileBase64: samplePdfBuffer.toString("base64")
        })
      });

      const res = await uploadPost(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe("FORBIDDEN_PROD_MUTATION");
      expect(json.message).toContain("PROD mutations are strictly forbidden");
    });

    it("rejects unconfirmed upload (confirm: false) with 400 CONFIRMATION_REQUIRED", async () => {
      const req = new NextRequest("http://localhost:3000/api/ops/ingestion/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment: "DEV",
          confirm: false,
          fileName: "271-2346-28-09-2026.pdf",
          fileBase64: samplePdfBuffer.toString("base64")
        })
      });

      const res = await uploadPost(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("CONFIRMATION_REQUIRED");
    });

    it("rejects unconfirmed download (confirm: false) with 400 CONFIRMATION_REQUIRED", async () => {
      const req = new NextRequest("http://localhost:3000/api/ops/ingestion/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment: "DEV",
          confirm: false,
          candidate: {
            fileName: "271-2346-28-09-2026.pdf",
            sourceUrl: "https://result.keralalotteries.com/271-2346-28-09-2026.pdf"
          }
        })
      });

      const res = await downloadPost(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("CONFIRMATION_REQUIRED");
    });
  });

  // ==========================================================================
  // 3. Automatic Current-Date (Asia/Kolkata) & Official Source Discovery Check
  // ==========================================================================
  describe("3. Official Source Discovery & Asia/Kolkata Current-Date Check", () => {
    it("computes IST date and weekly scheduled lottery accurately in Asia/Kolkata timezone", () => {
      // 2026-10-14T10:30:00Z -> 2026-10-14 16:00:00 IST (Wednesday -> DHANALEKSHMI)
      const wednesdayUtc = new Date("2026-10-14T10:30:00.000Z");
      const ist = getIstDateInfo(wednesdayUtc);
      expect(ist.isoDate).toBe("2026-10-14");
      expect(ist.displayDate).toBe("14/10/2026");
      expect(ist.weekday).toBe("Wednesday");
      expect(ist.hourIst).toBe(16);

      const schedule = getScheduledLotteryForIstDate(ist.isoDate);
      expect(schedule.scheduledLotteryCode).toBe("DHANALEKSHMI");
      expect(schedule.isExpectedToday).toBe(true);

      // Explicit no-draw holiday override
      const holidaySchedule = getScheduledLotteryForIstDate("2026-10-14", {
        noDrawDates: ["2026-10-14"]
      });
      expect(holidaySchedule.isExpectedToday).toBe(false);
      expect(holidaySchedule.scheduledLotteryCode).toBeNull();
    });

    it("returns TODAY_PUBLISHED when today's newly published official result is discovered on the portal", async () => {
      setDiscoveryFetchOverrideForTesting(async () => {
        const html = `
          <html><body>
            <a href="https://result.keralalotteries.com/files/DHANALEKSHMI-DL-75th-14-10-2026.pdf">
              DHANALEKSHMI (DL-75th) Draw Result 14/10/2026
            </a>
          </body></html>
        `;
        return new Response(html, { status: 200, headers: { "Content-Type": "text/html" } });
      });

      const req = new NextRequest("http://localhost:3000/api/ops/ingestion/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment: "DEV",
          since: "2026-06-01",
          nowIso: "2026-10-14T11:00:00.000Z" // 16:30 IST on 14/10/2026
        })
      });

      const res = await checkPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.todayIst.isoDate).toBe("2026-10-14");
      expect(json.todaySchedule.scheduledLotteryCode).toBe("DHANALEKSHMI");
      expect(json.discoveryStatus).toBe("TODAY_PUBLISHED");
      expect(json.todayResult).not.toBeNull();
      expect(json.todayResult.drawNumber).toBe("DL-75th");
      expect(json.todayResult.state).toBe("NEW");
      expect(json.latestOfficialResult).not.toBeNull();
      expect(json.latestCorpusDraw).not.toBeNull();
    });

    it("returns NO_NEW_RESULT when today's official draw is already ingested in the corpus", async () => {
      // 2026-09-28 (Monday, BHAGYATHARA BT-73rd) is already in the tracked 114-draw manifest
      setDiscoveryFetchOverrideForTesting(async () => {
        const html = `
          <html><body>
            <a href="https://result.keralalotteries.com/files/271-2346-28-09-2026.pdf">
              BHAGYATHARA (BT-73rd) Result 28/09/2026
            </a>
          </body></html>
        `;
        return new Response(html, { status: 200, headers: { "Content-Type": "text/html" } });
      });

      const req = new NextRequest("http://localhost:3000/api/ops/ingestion/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment: "DEV",
          since: "2026-06-01",
          nowIso: "2026-09-28T12:00:00.000Z" // 17:30 IST on 28/09/2026
        })
      });

      const res = await checkPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.todayIst.isoDate).toBe("2026-09-28");
      expect(json.discoveryStatus).toBe("NO_NEW_RESULT");
      expect(json.todayResult).not.toBeNull();
      expect(json.todayResult.state).toBe("ALREADY_KNOWN");
    });

    it("returns NOT_YET_PUBLISHED when today's scheduled draw has not yet been posted on the portal", async () => {
      setDiscoveryFetchOverrideForTesting(async () => {
        const html = `
          <html><body>
            <a href="https://result.keralalotteries.com/files/271-2346-28-09-2026.pdf">
              BHAGYATHARA (BT-73rd) Result 28/09/2026
            </a>
          </body></html>
        `;
        return new Response(html, { status: 200, headers: { "Content-Type": "text/html" } });
      });

      const req = new NextRequest("http://localhost:3000/api/ops/ingestion/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment: "DEV",
          since: "2026-06-01",
          nowIso: "2026-10-15T08:00:00.000Z" // 13:30 IST on 15/10/2026 (KARUNYA-PLUS expected at 15:00 IST)
        })
      });

      const res = await checkPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.todayIst.isoDate).toBe("2026-10-15");
      expect(json.todaySchedule.scheduledLotteryCode).toBe("KARUNYA-PLUS");
      expect(json.discoveryStatus).toBe("NOT_YET_PUBLISHED");
      expect(json.todayResult).toBeNull();
    });

    it("returns NO_SCHEDULED_DRAW when today is a configured no-draw holiday", async () => {
      setDiscoveryFetchOverrideForTesting(async () => {
        return new Response("<html><body>No draw today</body></html>", { status: 200 });
      });

      const req = new NextRequest("http://localhost:3000/api/ops/ingestion/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment: "DEV",
          nowIso: "2026-10-20T10:00:00.000Z",
          noDrawDates: ["2026-10-20"]
        })
      });

      const res = await checkPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.todayIst.isoDate).toBe("2026-10-20");
      expect(json.todaySchedule.isExpectedToday).toBe(false);
      expect(json.discoveryStatus).toBe("NO_SCHEDULED_DRAW");
    });

    it("returns SOURCE_UNAVAILABLE when official portal times out or fails with 5xx", async () => {
      setDiscoveryFetchOverrideForTesting(async () => {
        throw new Error("Official portal connection timed out");
      });

      const req = new NextRequest("http://localhost:3000/api/ops/ingestion/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment: "DEV",
          nowIso: "2026-10-15T11:00:00.000Z"
        })
      });

      const res = await checkPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.portalReachable).toBe(false);
      expect(json.discoveryStatus).toBe("SOURCE_UNAVAILABLE");
      expect(json.portalError).toContain("timed out");
      expect(json.candidates.length).toBeGreaterThan(0); // falls back to local workspace inspection
    });

    it("rejects unauthorized redirect domain during discovery check with 403 SECURITY_VIOLATION", async () => {
      setDiscoveryFetchOverrideForTesting(async () => {
        const fakeRedirectResponse = new Response("<html></html>", { status: 200 });
        Object.defineProperty(fakeRedirectResponse, "url", {
          value: "https://malicious-lottery-phishing.example.com/results"
        });
        return fakeRedirectResponse;
      });

      const req = new NextRequest("http://localhost:3000/api/ops/ingestion/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ environment: "DEV" })
      });

      const res = await checkPost(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe("SECURITY_VIOLATION");
    });

    it("rejects GET on /api/ops/ingestion/check with 405 Method Not Allowed", async () => {
      const res = await checkGet();
      expect(res.status).toBe(405);
      expect(res.headers.get("Allow")).toBe("POST");
    });

    it("parses official lotteryagent.kerala.gov.in /result/public/ table rows and homepage upcoming draw schedule", async () => {
      setDiscoveryFetchOverrideForTesting(async (input) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.endsWith("/result/public/")) {
          const publicHtml = `
            <!DOCTYPE html>
            <html>
              <body>
                <table id="resulttable">
                  <tbody>
                    <tr>
                      <td>1</td>
                      <td>KARUNYA-10/11/2025 (KR-772)</td>
                      <td>17-10-2026</td>
                      <td>
                        <a class="btn btn-sm btn-primary view" data-item-id="8a985162-ae14-c3cd-9b55-e1ffbe554b5a" href="javascript:void(0)">Download</a>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </body>
            </html>
          `;
          return new Response(publicHtml, { status: 200, headers: { "Content-Type": "text/html" } });
        }

        const scheduleHtml = `
          <!DOCTYPE html>
          <html>
            <body>
              <table>
                <tbody id="drawtabletbody">
                  <tr>
                    <td>1</td>
                    <td>SAMRUDHI-10/11/2025 (SM-25)</td>
                    <td>18-10-2026 3:00 PM</td>
                    <td>GORKY BHAVAN NEAR BAKERY JUNCTION THIRUVANANTHAPURAM</td>
                  </tr>
                </tbody>
              </table>
            </body>
          </html>
        `;
        return new Response(scheduleHtml, { status: 200, headers: { "Content-Type": "text/html" } });
      });

      const req = new NextRequest("http://localhost:3000/api/ops/ingestion/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment: "DEV",
          since: "2026-10-01",
          nowIso: "2026-10-18T08:00:00.000Z" // 13:30 IST on 18/10/2026
        })
      });

      const res = await checkPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.portalReachable).toBe(true);
      expect(json.officialSourceUrl).toBe("https://www.lotteryagent.kerala.gov.in/result/public/");
      expect(json.discoveryStatus).toBe("NOT_YET_PUBLISHED");
      expect(json.todaySchedule.lotteryCode).toBe("SAMRUDHI");
      expect(json.todaySchedule.drawNumber).toBe("SM-25");
      expect(json.todaySchedule.venue).toContain("GORKY BHAVAN");
      expect(json.latestOfficialResult).not.toBeNull();
      expect(json.latestOfficialResult.drawNumber).toBe("KR-772");
      expect(json.latestOfficialResult.sourceUrl).toBe(
        "https://www.lotteryagent.kerala.gov.in/results/8a985162-ae14-c3cd-9b55-e1ffbe554b5a"
      );
      expect(Array.isArray(json.upcomingSchedule)).toBe(true);
      expect(json.upcomingSchedule.length).toBe(1);
    });

    it("returns SOURCE_PARSE_ERROR when official portal responds 200 OK with unrecognized markup > 200 chars", async () => {
      setDiscoveryFetchOverrideForTesting(async () => {
        const unrecognizedHtml =
          "<!DOCTYPE html><html><head><title>Portal Maintenance Redesign</title></head><body>" +
          "<div class='completely-new-portal-layout'>".repeat(8) +
          "</div></body></html>";
        return new Response(unrecognizedHtml, { status: 200, headers: { "Content-Type": "text/html" } });
      });

      const req = new NextRequest("http://localhost:3000/api/ops/ingestion/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment: "DEV",
          nowIso: "2026-10-15T11:00:00.000Z"
        })
      });

      const res = await checkPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.portalReachable).toBe(true);
      expect(json.discoveryStatus).toBe("SOURCE_PARSE_ERROR");
      expect(json.statusExplanation).toContain("could not be parsed automatically");
    });
  });

  // ==========================================================================
  // 4. Dry-Run Preview, Leading-Zero Preservation, & Multipart Support
  // ==========================================================================
  describe("4. Dry-Run Preview, Leading-Zero Preservation & Multipart Support", () => {
    it("POST /api/ops/ingestion/dry-run (JSON) previews validation report, prize tiers, and leading-zero strings without persistent mutations", async () => {
      // Use an isolated empty cacheDir so dry-run parses the full PDF and extracts prize tiers + leading zeros
      tempDir = mkdtempSync(join(tmpdir(), "kl-dryrun-test-"));
      const emptyCacheDir = join(tempDir, "processed-cache");
      mkdirSync(join(emptyCacheDir, "graphs"), { recursive: true });
      writeFileSync(
        join(emptyCacheDir, "manifest.json"),
        JSON.stringify({ version: "1.0.0", updatedAt: new Date().toISOString(), documents: {} })
      );

      setOpsIngestionCloudDependenciesForTesting({
        sourceIngestionService: new SourceIngestionService({
          documentRepository: new InMemoryDocumentRepository(),
          storageService: new InMemoryStorageService()
        }),
        cacheDir: emptyCacheDir,
        sourceDir: join(tempDir, "source-documents")
      });

      const req = new NextRequest("http://localhost:3000/api/ops/ingestion/dry-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment: "DEV",
          candidate: {
            fileName: "271-2346-28-09-2026.pdf",
            fileBase64: samplePdfBuffer.toString("base64")
          }
        })
      });

      const res = await dryRunPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.dryRun).toBe(true);
      expect(json.storageMutated).toBe(false);
      expect(json.firestoreMutated).toBe(false);
      expect(json.sha256).toBe(sampleSha);
      expect(json.fileSize).toBe(samplePdfBuffer.byteLength);
      expect(json.drawIdentity.lottery).toBe("BHAGYATHARA");
      expect(json.drawIdentity.drawNumber).toBe("BT-73rd");
      expect(json.drawIdentity.drawDate).toBe("28/09/2026");
      expect(json.validation.resultCount).toBeGreaterThan(300);
      expect(json.validation.fullTicketCount).toBeGreaterThan(0);
      expect(json.validation.suffixCount).toBeGreaterThan(0);
      expect(json.validation.prizeTierSummary.length).toBeGreaterThan(0);

      // Verify leading-zero numbers are preserved as exact strings (e.g., "0xxx")
      expect(json.validation.leadingZeroCount).toBeGreaterThan(0);
      expect(json.validation.sampleLeadingZeroNumbers.length).toBeGreaterThan(0);
      for (const sample of json.validation.sampleLeadingZeroNumbers) {
        expect(typeof sample).toBe("string");
        expect(sample.startsWith("0")).toBe(true);
      }
    });

    it("POST /api/ops/ingestion/dry-run supports multipart/form-data file upload preview", async () => {
      tempDir = mkdtempSync(join(tmpdir(), "kl-dryrun-multipart-"));
      const isoCacheDir = join(tempDir, "processed-cache");
      mkdirSync(join(isoCacheDir, "graphs"), { recursive: true });
      writeFileSync(
        join(isoCacheDir, "manifest.json"),
        JSON.stringify({ version: "1.0.0", updatedAt: new Date().toISOString(), documents: {} })
      );

      setOpsIngestionCloudDependenciesForTesting({
        sourceIngestionService: new SourceIngestionService({
          documentRepository: new InMemoryDocumentRepository(),
          storageService: new InMemoryStorageService()
        }),
        cacheDir: isoCacheDir,
        sourceDir: join(tempDir, "source-documents")
      });

      const formData = new FormData();
      const blob = new Blob([new Uint8Array(samplePdfBuffer)], { type: "application/pdf" });
      formData.append("file", blob, "271-2346-28-09-2026.pdf");
      formData.append("environment", "DEV");

      const req = new NextRequest("http://localhost:3000/api/ops/ingestion/dry-run", {
        method: "POST",
        body: formData
      });

      const res = await dryRunPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.dryRun).toBe(true);
      expect(json.sha256).toBe(sampleSha);
      expect(json.candidateStatus).toBe("VALID");
      expect(json.projectedChanges.newDocuments).toBe(1);
      expect(json.validation.leadingZeroCount).toBeGreaterThan(0);
    });

    it("rejects unauthorized sourceUrl domain on dry-run with 403 SECURITY_VIOLATION", async () => {
      const req = new NextRequest("http://localhost:3000/api/ops/ingestion/dry-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment: "DEV",
          candidate: {
            fileName: "remote.pdf",
            sourceUrl: "https://untrusted-site.example.org/remote.pdf"
          }
        })
      });

      const res = await dryRunPost(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe("SECURITY_VIOLATION");
    });

    it("rejects GET on /api/ops/ingestion/dry-run with 405 Method Not Allowed", async () => {
      const res = await dryRunGet();
      expect(res.status).toBe(405);
      expect(res.headers.get("Allow")).toBe("POST");
    });
  });

  // ==========================================================================
  // 5. PDF Format, Truncation, Oversize, Conflict & Upload/Download Validation
  // ==========================================================================
  describe("5. PDF Format, Size Limit, Truncation, Conflict & Upload/Download", () => {
    it("rejects non-PDF payload with 400 INVALID_PDF (magic header check)", async () => {
      const malformedText = "This is not a PDF file.";
      const malformedBase64 = Buffer.from(malformedText).toString("base64");

      const req = new NextRequest("http://localhost:3000/api/ops/ingestion/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: "invalid.pdf",
          fileBase64: malformedBase64,
          environment: "DEV",
          confirm: true
        })
      });

      const res = await uploadPost(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("INVALID_PDF");
      expect(json.message).toContain("PDF Validation Failed");
    });

    it("rejects empty (0-byte) PDF upload with 400 INVALID_PDF", async () => {
      const formData = new FormData();
      const emptyBlob = new Blob([new Uint8Array(0)], { type: "application/pdf" });
      formData.append("file", emptyBlob, "empty.pdf");
      formData.append("environment", "DEV");
      formData.append("confirm", "true");

      const req = new NextRequest("http://localhost:3000/api/ops/ingestion/upload", {
        method: "POST",
        body: formData
      });

      const res = await uploadPost(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("INVALID_PDF");
    });

    it("rejects truncated PDF missing %%EOF trailer with 400 TRUNCATED_PDF", async () => {
      const truncatedBytes = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n");
      const req = new NextRequest("http://localhost:3000/api/ops/ingestion/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: "truncated.pdf",
          fileBase64: truncatedBytes.toString("base64"),
          environment: "DEV",
          confirm: true
        })
      });

      const res = await uploadPost(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("TRUNCATED_PDF");
    });

    it("rejects oversized PDF (> 10 MB) with 413 FILE_TOO_LARGE", async () => {
      const oversizedBytes = Buffer.alloc(DEFAULT_MAX_UPLOAD_BYTES + 1024, 0x20);
      oversizedBytes.write("%PDF-1.4\n", 0, "latin1");
      oversizedBytes.write("\n%%EOF\n", oversizedBytes.length - 8, "latin1");

      const formData = new FormData();
      const blob = new Blob([new Uint8Array(oversizedBytes)], { type: "application/pdf" });
      formData.append("file", blob, "oversized.pdf");
      formData.append("environment", "DEV");
      formData.append("confirm", "true");

      const req = new NextRequest("http://localhost:3000/api/ops/ingestion/upload", {
        method: "POST",
        body: formData
      });

      const res = await uploadPost(req);
      expect(res.status).toBe(413);
      const json = await res.json();
      expect(json.error).toBe("FILE_TOO_LARGE");
    });

    it("rejects unauthorized domain on download with 403 SECURITY_VIOLATION", async () => {
      const req = new NextRequest("http://localhost:3000/api/ops/ingestion/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment: "DEV",
          confirm: true,
          candidate: {
            fileName: "unauthorized.pdf",
            sourceUrl: "https://evil.example.com/lottery.pdf"
          }
        })
      });

      const res = await downloadPost(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe("SECURITY_VIOLATION");
    });

    it("detects conflicting draw identity on upload and rejects with 409 INGESTION_CONFLICT", async () => {
      tempDir = mkdtempSync(join(tmpdir(), "kl-conflict-test-"));
      const isolatedCacheDir = join(tempDir, "processed-cache");
      const isolatedSourceDir = join(tempDir, "source-documents");
      mkdirSync(join(isolatedCacheDir, "graphs"), { recursive: true });
      mkdirSync(isolatedSourceDir, { recursive: true });
      writeFileSync(
        join(isolatedCacheDir, "manifest.json"),
        JSON.stringify({ version: "1.0.0", updatedAt: new Date().toISOString(), documents: {} })
      );

      const docRepo = new InMemoryDocumentRepository();
      const storageSvc = new InMemoryStorageService();
      setOpsIngestionCloudDependenciesForTesting({
        sourceIngestionService: new SourceIngestionService({
          documentRepository: docRepo,
          storageService: storageSvc
        }),
        cacheDir: isolatedCacheDir,
        sourceDir: isolatedSourceDir
      });

      // Supply samplePdfBuffer (which is BT-73rd dated 28/09/2026) but claim drawNumber is DL-999th
      const req = new NextRequest("http://localhost:3000/api/ops/ingestion/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: "271-2346-28-09-2026.pdf",
          fileBase64: samplePdfBuffer.toString("base64"),
          drawNumber: "DL-999th",
          environment: "DEV",
          confirm: true
        })
      });

      const res = await uploadPost(req);
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error).toBe("INGESTION_CONFLICT");
      expect(json.conflicts).toBe(1);
    });

    it("executes confirmed DEV upload & replay idempotency end-to-end against isolated cache and mock cloud services without touching tracked corpus", async () => {
      tempDir = mkdtempSync(join(tmpdir(), "kl-e2e-upload-test-"));
      const isolatedCacheDir = join(tempDir, "processed-cache");
      const isolatedSourceDir = join(tempDir, "source-documents");
      mkdirSync(join(isolatedCacheDir, "graphs"), { recursive: true });
      mkdirSync(isolatedSourceDir, { recursive: true });
      writeFileSync(
        join(isolatedCacheDir, "manifest.json"),
        JSON.stringify({ version: "1.0.0", updatedAt: new Date().toISOString(), documents: {} })
      );

      const docRepo = new InMemoryDocumentRepository();
      const storageSvc = new InMemoryStorageService();
      setOpsIngestionCloudDependenciesForTesting({
        sourceIngestionService: new SourceIngestionService({
          documentRepository: docRepo,
          storageService: storageSvc
        }),
        cacheDir: isolatedCacheDir,
        sourceDir: isolatedSourceDir
      });

      // 1. First confirmed upload -> NEW document ingested & promoted
      const req1 = new NextRequest("http://localhost:3000/api/ops/ingestion/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: "271-2346-28-09-2026.pdf",
          fileBase64: samplePdfBuffer.toString("base64"),
          environment: "DEV",
          confirm: true
        })
      });

      const res1 = await uploadPost(req1);
      expect(res1.status).toBe(200);
      const json1 = await res1.json();
      expect(json1.success).toBe(true);
      expect(json1.newDocuments).toBe(1);
      expect(json1.ingested).toBe(1);
      expect(json1.promoted).toBe(1);
      expect(json1.sha256).toBe(sampleSha);
      expect(json1.drawIdentity.lottery).toBe("BHAGYATHARA");
      expect(json1.drawIdentity.drawNumber).toBe("BT-73rd");
      expect(json1.leadingZeroCount).toBeGreaterThan(0);
      expect(storageSvc.has(`source-documents/${sampleSha}.pdf`)).toBe(true);
      expect(await docRepo.getBySha256(sampleSha)).not.toBeNull();
      expect(existsSync(join(isolatedCacheDir, "graphs", `${sampleSha}.json`))).toBe(true);

      // 2. Second confirmed upload of the exact same PDF -> ALREADY_KNOWN idempotent no-op
      const req2 = new NextRequest("http://localhost:3000/api/ops/ingestion/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: "271-2346-28-09-2026.pdf",
          fileBase64: samplePdfBuffer.toString("base64"),
          environment: "DEV",
          confirm: true
        })
      });

      const res2 = await uploadPost(req2);
      expect(res2.status).toBe(200);
      const json2 = await res2.json();
      expect(json2.success).toBe(true);
      expect(json2.alreadyKnown).toBe(1);
      expect(json2.newDocuments).toBe(0);
    });

    it("enforces fail-closed 503 when Firebase is unconfigured and no test cloud dependencies are injected", async () => {
      const req = new NextRequest("http://localhost:3000/api/ops/ingestion/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: "271-2346-28-09-2026.pdf",
          fileBase64: samplePdfBuffer.toString("base64"),
          environment: "DEV",
          confirm: true
        })
      });

      const res = await uploadPost(req);
      if (!isFirebaseConfigured) {
        expect(res.status).toBe(503);
        const json = await res.json();
        expect(json.error).toBe("FIREBASE_NOT_CONFIGURED");
      } else {
        expect(res.status).toBe(200);
      }
    });

    it("rejects GET on /api/ops/ingestion/upload and /api/ops/ingestion/download with 405 Method Not Allowed", async () => {
      const resUpload = await uploadGet();
      expect(resUpload.status).toBe(405);
      expect(resUpload.headers.get("Allow")).toBe("POST");

      const resDownload = await downloadGet();
      expect(resDownload.status).toBe(405);
      expect(resDownload.headers.get("Allow")).toBe("POST");
    });
  });

  // ==========================================================================
  // 6. Single-Flight Concurrency Lease Guard
  // ==========================================================================
  describe("6. Single-Flight Concurrency Lease Guard", () => {
    it("rejects mutating operation with 409 Conflict when single-flight lock is actively held", async () => {
      const lockManager = getOpsLockManager();
      const mockRunId = "run_active_test_lock_holder";

      const acquired = await lockManager.acquireLock(mockRunId, { ttlSeconds: 120, environment: "DEV" });
      expect(acquired).toBe(true);

      try {
        const req = new NextRequest("http://localhost:3000/api/ops/ingestion/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: "271-2346-28-09-2026.pdf",
            fileBase64: samplePdfBuffer.toString("base64"),
            environment: "DEV",
            confirm: true
          })
        });

        const res = await uploadPost(req);
        expect(res.status).toBe(409);
        const json = await res.json();
        expect(json.error).toBe("CONCURRENCY_LOCK_ACTIVE");
        expect(json.message).toContain("Single-flight lock acquisition rejected");
      } finally {
        await lockManager.releaseLock(mockRunId);
      }
    });
  });

  // ==========================================================================
  // 7. Storage Integrity & Local ↔ Cloud Reconciliation
  // ==========================================================================
  describe("7. Storage Integrity & Reconciliation", () => {
    it("GET /api/ops/ingestion/storage-integrity returns valid local count metadata and explicit UNVERIFIED when cloud is unconfigured", async () => {
      setStorageIntegrityDependenciesForTesting({
        isCloudConfigured: () => false
      });

      const req = new NextRequest("http://localhost:3000/api/ops/ingestion/storage-integrity?verify=true", { method: "GET" });
      const res = await integrityGet(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.counts.localDocumentCount).toBe(114);
      expect(json.counts.localGraphCount).toBe(114);
      expect(json.counts.localManifestCount).toBe(114);
      expect(json.counts.cloudStorageDocumentCount).toBeNull();
      expect(json.counts.firestoreDocumentCount).toBeNull();
      expect(json.counts.researchDrawCount).toBe(114);
      expect(json.counts.prodDrawCount).toBe(100);
      expect(json.operationalGuards.schedulerState).toBe("PAUSED");
      expect(json.operationalGuards.mutationState).toBe("PROD_LOCKED_DEV_ALLOWED");
      expect(json.verification.integrityStatus).toBe("UNVERIFIED");
      expect(json.verification.matchedCount).toBe(0);
      expect(json.verification.unverifiedCount).toBe(114);
    });

    it("GET /api/ops/ingestion/storage-integrity?verify=true calculates Storage and Firestore counts independently and returns VERIFIED when all 114 match", async () => {
      const manifestRaw = JSON.parse(
        readFileSync(join(process.cwd(), "data/processed-cache/manifest.json"), "utf-8")
      );
      const allShas = Object.keys(manifestRaw.documents || {});
      expect(allShas.length).toBe(114);

      setStorageIntegrityDependenciesForTesting({
        isCloudConfigured: () => true,
        listCloudStorageObjectShas: async () => new Set(allShas),
        listFirestoreDocumentShas: async () => new Set(allShas)
      });

      const req = new NextRequest("http://localhost:3000/api/ops/ingestion/storage-integrity?verify=true", { method: "GET" });
      const res = await integrityGet(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.counts.cloudStorageDocumentCount).toBe(114);
      expect(json.counts.firestoreDocumentCount).toBe(114);
      expect(json.verification.integrityStatus).toBe("VERIFIED");
      expect(json.verification.matchedCount).toBe(114);
      expect(json.verification.mismatchCount).toBe(0);
    });

    it("GET /api/ops/ingestion/storage-integrity?verify=true reports DISCREPANCY_DETECTED and distinct counts when Cloud Storage and Firestore diverge", async () => {
      const manifestRaw = JSON.parse(
        readFileSync(join(process.cwd(), "data/processed-cache/manifest.json"), "utf-8")
      );
      const allShas = Object.keys(manifestRaw.documents || {});
      const missingStorageSha = allShas[0]!;
      const storageSubset = new Set(allShas.slice(1));
      const firestoreFull = new Set(allShas);

      setStorageIntegrityDependenciesForTesting({
        isCloudConfigured: () => true,
        listCloudStorageObjectShas: async () => storageSubset,
        listFirestoreDocumentShas: async () => firestoreFull
      });

      const req = new NextRequest("http://localhost:3000/api/ops/ingestion/storage-integrity?verify=true", { method: "GET" });
      const res = await integrityGet(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.counts.cloudStorageDocumentCount).toBe(113);
      expect(json.counts.firestoreDocumentCount).toBe(114);
      expect(json.verification.integrityStatus).toBe("DISCREPANCY_DETECTED");
      expect(json.verification.matchedCount).toBe(113);
      expect(json.verification.mismatchCount).toBe(1);

      const discrepancyItem = json.verification.items.find(
        (item: { sha256: string }) => item.sha256 === missingStorageSha
      );
      expect(discrepancyItem).toBeDefined();
      expect(discrepancyItem.inCloudStore).toBe(false);
      expect(discrepancyItem.inFirestore).toBe(true);
      expect(discrepancyItem.residencyCategory).toBe("CLOUD_PARITY_MISMATCH");
    });

    it("rejects POST on /api/ops/ingestion/storage-integrity with 405 Method Not Allowed", async () => {
      const res = await integrityPost();
      expect(res.status).toBe(405);
      expect(res.headers.get("Allow")).toBe("GET");
    });
  });

  // ==========================================================================
  // 8. Operational Runs Telemetry
  // ==========================================================================
  describe("8. Operational Runs Telemetry", () => {
    it("GET /api/ops/ingestion/runs returns sanitized run history including recent check/dry-run/upload entries", async () => {
      const req = new NextRequest("http://localhost:3000/api/ops/ingestion/runs", { method: "GET" });
      const res = await runsGet(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data).toBeDefined();
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBeGreaterThan(0);

      const rawText = JSON.stringify(json.data);
      expect(rawText).not.toContain("bearer test");
      expect(rawText).not.toContain("api_key_secret");
    });

    it("rejects POST on /api/ops/ingestion/runs with 405 Method Not Allowed", async () => {
      const res = await runsPost();
      expect(res.status).toBe(405);
      expect(res.headers.get("Allow")).toBe("GET");
    });
  });
});
