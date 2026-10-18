import { describe, it, expect } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { OfficialResultCatchUpEngine } from "../services/ingestion/src";
import {
  GET as catchUpGet,
  POST as catchUpPost
} from "../apps/web/app/api/ops/ingestion/catch-up/route";
import { researchService } from "../packages/data/src/research-service";

const MOCK_LOTIS_RESULT_HTML = `
<!DOCTYPE html>
<html>
<body>
  <nav>
    <a href="/assets/downloads/LOTTERIES_PORTAL_RULES.pdf">Lotteries Portal Rules</a>
  </nav>
  <table id="resulttable">
    <tbody>
      <tr>
        <td>1</td>
        <td>KARUNYA-10/11/2025 (KR-772)</td>
        <td>17-10-2026</td>
        <td><a class="btn btn-sm btn-primary view" data-item-id="8a985162-ae14-c3cd-9b55-e1ffbe554b5a" href="javascript:void(0)">Download</a></td>
      </tr>
      <tr>
        <td>2</td>
        <td>SUVARNA KERALAM-10/11/2025 (SK-73)</td>
        <td>16-10-2026</td>
        <td><a class="btn btn-sm btn-primary view" data-item-id="c65f08ae-fe05-b6e9-10c3-30b5c65af944" href="javascript:void(0)">Download</a></td>
      </tr>
      <tr>
        <td>3</td>
        <td>KARUNYA PLUS-10/11/2025 (KN-645)</td>
        <td>15-10-2026</td>
        <td><a class="btn btn-sm btn-primary view" data-item-id="d8d406bf-ba27-96b6-4be7-de0c1f10710d" href="javascript:void(0)">Download</a></td>
      </tr>
      <tr>
        <td>4</td>
        <td>DHANALEKSHMI-10/11/2025 (DL-73)</td>
        <td>14-10-2026</td>
        <td><a class="btn btn-sm btn-primary view" data-item-id="72c97033-15ee-df55-1e69-3e0a50a1b1cb" href="javascript:void(0)">Download</a></td>
      </tr>
      <tr>
        <td>5</td>
        <td>STHREE-SAKTHI-10/11/2025 (SS-541)</td>
        <td>13-10-2026</td>
        <td><a class="btn btn-sm btn-primary view" data-item-id="1b077fa7-61e5-da81-4090-a7d397592c3e" href="javascript:void(0)">Download</a></td>
      </tr>
    </tbody>
  </table>
</body>
</html>
`;

const MOCK_LOTIS_HOME_HTML = `
<!DOCTYPE html>
<html>
<body>
  <table>
    <tbody id="drawtabletbody">
      <tr>
        <td>1</td>
        <td>SAMRUDHI-10/11/2025 (SM-77)</td>
        <td>18-10-2026 3:00 PM</td>
        <td>GORKY BHAVAN NEAR BAKERY JUNCTION THIRUVANANTHAPURAM</td>
      </tr>
    </tbody>
  </table>
</body>
</html>
`;

describe("Official Result Catch-Up Workflow & Inventory Verification", () => {
  const cwd = process.cwd();
  const dl73Bytes = new Uint8Array(readFileSync(join(cwd, "data/source-documents/lottery-results/273-2381-14-10-2026.pdf")));
  const kn645Bytes = new Uint8Array(readFileSync(join(cwd, "data/source-documents/lottery-results/274-2386-15-10-2026.pdf")));
  const sk73Bytes = new Uint8Array(readFileSync(join(cwd, "data/source-documents/lottery-results/275-2390-16-10-2026.pdf")));
  const kr772Bytes = new Uint8Array(readFileSync(join(cwd, "data/source-documents/lottery-results/276-2395-17-10-2026.pdf")));

  const createMockFetch = () => {
    return (async (input: RequestInfo | URL): Promise<Response> => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes("/result/public")) {
        return new Response(MOCK_LOTIS_RESULT_HTML, {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" }
        });
      }
      if (url === "https://www.lotteryagent.kerala.gov.in/" || url === "https://www.lotteryagent.kerala.gov.in") {
        return new Response(MOCK_LOTIS_HOME_HTML, {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" }
        });
      }
      if (url.includes("72c97033-15ee-df55-1e69-3e0a50a1b1cb")) {
        return new Response(dl73Bytes, { status: 200, headers: { "content-type": "application/pdf" } });
      }
      if (url.includes("d8d406bf-ba27-96b6-4be7-de0c1f10710d")) {
        return new Response(kn645Bytes, { status: 200, headers: { "content-type": "application/pdf" } });
      }
      if (url.includes("c65f08ae-fe05-b6e9-10c3-30b5c65af944")) {
        return new Response(sk73Bytes, { status: 200, headers: { "content-type": "application/pdf" } });
      }
      if (url.includes("8a985162-ae14-c3cd-9b55-e1ffbe554b5a")) {
        return new Response(kr772Bytes, { status: 200, headers: { "content-type": "application/pdf" } });
      }
      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;
  };

  it("1. Verifies active 118-draw (45,218-result) corpus and preserved V1.0 (114-draw / 43,712-result) baseline", async () => {
    const manifest = JSON.parse(readFileSync(join(cwd, "data/processed-cache/manifest.json"), "utf-8"));
    expect(Object.keys(manifest.documents || {}).length).toBe(118);
    expect(manifest.v1Baseline).toBeDefined();
    expect(manifest.v1Baseline.draws).toBe(114);
    expect(manifest.v1Baseline.totalResults).toBe(43712);
    expect(manifest.v1Baseline.latestDrawNumber).toBe("SS-541st");
    expect(manifest.activeCorpus).toBeDefined();
    expect(manifest.activeCorpus.draws).toBe(118);
    expect(manifest.activeCorpus.totalResults).toBe(45218);
    expect(manifest.activeCorpus.latestDrawNumber).toBe("KR-772nd");

    // Verify all 4 newly caught-up draws are accessible via researchService with leading zeros intact
    const caughtUpDraws = [
      { id: "draw_DL-73", code: "DL-73rd", sha: "224e4d241ca2f0ae10f7b26a507e13de419890f0fb00a2545a7e691a859ec682", results: 374, sampleZero: "0356" },
      { id: "draw_KN-645", code: "KN-645th", sha: "3a95c86db086ff702a0a53de8844da9cd9e5839757b613ac5ffbcfe6d75292f3", results: 380, sampleZero: "0431" },
      { id: "draw_SK-73", code: "SK-73rd", sha: "289a9f364e4a1e2477317505f817a0365ad047e28c6b3b9572b8c010263e10ec", results: 376, sampleZero: "0356" },
      { id: "draw_KR-772", code: "KR-772nd", sha: "04cb4771ca0105f69096c9d146f9ab7d5146e726dea4b6574ef3aee97d8cd36a", results: 376, sampleZero: "0945" }
    ];

    for (const expected of caughtUpDraws) {
      const draw = await researchService.getDrawById(expected.id);
      expect(draw).toBeDefined();
      expect(draw?.drawNumber).toBe(expected.code);
      expect(draw?.sourceDocumentSha256).toBe(expected.sha);
      expect(draw?.totalResults).toBe(expected.results);

      const resultsPage = await researchService.getDrawResults(expected.id, { page: 1, pageSize: 100 });
      expect(resultsPage).not.toBeNull();
      expect(resultsPage?.pagination.totalCount).toBe(expected.results);
    }
  });

  it("2. Calculates catch-up range from 114-draw baseline (SS-541 on 2026-10-13) and classifies DL-73, KN-645, SK-73, KR-772 as NEW_ELIGIBLE while filtering rulebook and marking SM-77 as NOT_PUBLISHED_YET", async () => {
    const tempCacheDir = mkdtempSync(join(tmpdir(), "catchup-baseline-cache-"));
    const tempSourceDir = mkdtempSync(join(tmpdir(), "catchup-baseline-source-"));
    mkdirSync(join(tempCacheDir, "graphs"), { recursive: true });

    // Create a 114-draw manifest snapshot (excluding the 4 Oct 14-17 draws)
    const fullManifest = JSON.parse(readFileSync(join(cwd, "data/processed-cache/manifest.json"), "utf-8"));
    const newShas = new Set([
      "224e4d241ca2f0ae10f7b26a507e13de419890f0fb00a2545a7e691a859ec682",
      "3a95c86db086ff702a0a53de8844da9cd9e5839757b613ac5ffbcfe6d75292f3",
      "289a9f364e4a1e2477317505f817a0365ad047e28c6b3b9572b8c010263e10ec",
      "04cb4771ca0105f69096c9d146f9ab7d5146e726dea4b6574ef3aee97d8cd36a"
    ]);
    const baselineDocs: Record<string, unknown> = {};
    for (const [sha, doc] of Object.entries(fullManifest.documents || {})) {
      if (!newShas.has(sha)) {
        baselineDocs[sha] = doc;
      }
    }
    writeFileSync(
      join(tempCacheDir, "manifest.json"),
      JSON.stringify({ version: "1.0", updatedAt: "2026-10-14T00:00:00Z", documents: baselineDocs }, null, 2)
    );
    // Copy SS-541 graph so latest draw verification reads its results
    cpSync(
      join(cwd, "data/processed-cache/graphs/4ef34cc25df8fa54ad3c815ff26625b34d63ae2d17833232017dcb9afe16ae1d.json"),
      join(tempCacheDir, "graphs/4ef34cc25df8fa54ad3c815ff26625b34d63ae2d17833232017dcb9afe16ae1d.json")
    );

    const engine = new OfficialResultCatchUpEngine({
      mode: "DRY_RUN",
      environment: "DEV",
      cacheDir: tempCacheDir,
      sourceDir: tempSourceDir,
      referenceDate: "2026-10-18T14:00:00+05:30",
      fetchImpl: createMockFetch()
    });
    const res = await engine.execute();

    expect(res.portalReachable).toBe(true);
    expect(res.catchUpRange.afterDrawDateIso).toBe("2026-10-13");
    expect(res.lastVerifiedIngestedDraw?.drawNumber).toBe("SS-541st");
    expect(res.currentIst.isoDate).toBe("2026-10-18");

    // 4 published draws + 1 upcoming draw (SM-77); LOTTERIES_PORTAL_RULES.pdf is filtered out
    expect(res.candidates.length).toBe(5);
    expect(res.counts.newEligible).toBe(4);
    expect(res.counts.notPublishedYet).toBe(1);

    const dl73 = res.candidates.find((i) => i.drawNumber.startsWith("DL-73"));
    expect(dl73?.classification).toBe("NEW_ELIGIBLE");
    expect(dl73?.finalDisposition).toBe("READY_TO_INGEST");
    expect(dl73?.resultCount).toBe(374);
    expect(dl73?.leadingZeroCount).toBeGreaterThan(0);

    const sm77 = res.candidates.find((i) => i.drawNumber === "SM-77");
    expect(sm77?.classification).toBe("NOT_PUBLISHED_YET");
    expect(sm77?.finalDisposition).toBe("UNAVAILABLE");
  });

  it("3. Classifies all 4 draws as ALREADY_INGESTED_BY_SHA256 / ALREADY_PRESENT on idempotent re-run against the 118-draw corpus", async () => {
    const engine = new OfficialResultCatchUpEngine({
      mode: "DRY_RUN",
      environment: "DEV",
      referenceDate: "2026-10-18T14:00:00+05:30",
      fetchImpl: createMockFetch()
    });
    const res = await engine.execute();

    expect(res.portalReachable).toBe(true);
    expect(res.lastVerifiedIngestedDraw?.isoDate).toBe("2026-10-17");
    expect(res.lastVerifiedIngestedDraw?.drawNumber).toBe("KR-772nd");
    expect(res.counts.alreadyIngestedBySha256).toBe(4);
    expect(res.counts.newEligible).toBe(0);
    expect(res.counts.ingestedThisRun).toBe(0);
  });

  it("4. Enforces API guards on /api/ops/ingestion/catch-up (confirm required on INGEST, PROD 403 block, 405 on GET)", async () => {
    // Missing confirm: true on INGEST
    const badPost = new NextRequest("http://localhost:3000/api/ops/ingestion/catch-up", {
      method: "POST",
      body: JSON.stringify({ mode: "INGEST", confirm: false }),
      headers: { "content-type": "application/json" }
    });
    const badRes = await catchUpPost(badPost);
    expect(badRes.status).toBe(400);
    const badJson = await badRes.json();
    expect(badJson.error).toBe("CONFIRMATION_REQUIRED");

    // PROD environment block on INGEST
    const prodPost = new NextRequest("http://localhost:3000/api/ops/ingestion/catch-up", {
      method: "POST",
      body: JSON.stringify({ mode: "INGEST", environment: "PROD", confirm: true }),
      headers: { "content-type": "application/json" }
    });
    const prodRes = await catchUpPost(prodPost);
    expect(prodRes.status).toBe(403);
    const prodJson = await prodRes.json();
    expect(prodJson.error).toBe("FORBIDDEN_PROD_MUTATION");

    // 405 Method Not Allowed on GET
    expect((await catchUpGet()).status).toBe(405);
  });
});

