import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as getDraws } from "../apps/web/app/api/v1/draws/route";
import { GET as getFindings } from "../apps/web/app/api/v1/findings/route";
import { GET as getFindingDetail } from "../apps/web/app/api/v1/findings/[id]/route";
import { GET as getFindingEvidence } from "../apps/web/app/api/v1/findings/[id]/evidence/route";
import { GET as getFindingReport } from "../apps/web/app/api/v1/findings/[id]/report/route";
import { GET as getStatistics } from "../apps/web/app/api/v1/statistics/route";
import { GET as getExperimentResults } from "../apps/web/app/api/v1/experiment-results/route";
import { GET as getResearchSandbox } from "../apps/web/app/api/v1/research-sandbox/route";
import { GET as getCandidateLab } from "../apps/web/app/api/v1/candidate-lab/route";
import { GET as getGeography } from "../apps/web/app/api/v1/geography/route";
import { POST as catchUpPost } from "../apps/web/app/api/ops/ingestion/catch-up/route";
import {
  setDiscoveryFetchOverrideForTesting,
  resetCatchUpDiscoveryCacheForTesting,
  getCatchUpDiscoveryCacheSnapshotForTesting
} from "../apps/web/lib/ops-guard";
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

describe("Active Research Corpus (118 Draws), Findings Refresh, V1.0 Separation & Site-Open Catch-Up", () => {
  beforeEach(() => {
    resetCatchUpDiscoveryCacheForTesting();
    setDiscoveryFetchOverrideForTesting(null);
  });

  afterEach(() => {
    setDiscoveryFetchOverrideForTesting(null);
  });

  it("1. Separates frozen V1.0 baseline (114 draws / 43,712 results) from active research corpus (118 draws / 45,218 results)", async () => {
    const summary = researchService.getCorpusIdentitySummary();

    expect(summary.activeCorpus.version).toBe("active-research-118draws");
    expect(summary.activeCorpus.corpusId).toBe("corpus_055e805237802b5e");
    expect(summary.activeCorpus.draws).toBe(118);
    expect(summary.activeCorpus.totalResults).toBe(45218);
    expect(summary.activeCorpus.latestDrawNumber).toBe("KR-772nd");
    expect(summary.activeCorpus.latestDrawDate).toBe("2026-10-17");

    expect(summary.v1Baseline.version).toBe("v1.0-research-114draws");
    expect(summary.v1Baseline.corpusId).toBe("corpus_981356dd505db164");
    expect(summary.v1Baseline.draws).toBe(114);
    expect(summary.v1Baseline.totalResults).toBe(43712);
    expect(summary.v1Baseline.latestDrawNumber).toBe("SS-541st");
    expect(summary.v1Baseline.latestDrawDate).toBe("2026-10-13");

    expect(summary.historicalM9Snapshot.version).toBe("m9-initial-103draws");
    expect(summary.historicalM9Snapshot.corpusId).toBe("corpus_07971b8e8aa2a79c");
    expect(summary.historicalM9Snapshot.draws).toBe(103);
    expect(summary.historicalM9Snapshot.totalResults).toBe(39550);
  });

  it("2. Diagnoses and resolves the 103 count on Findings: returns 9 total findings (3 active 118-draw, 3 frozen V1.0 114-draw, 3 historical M9 103-draw) with explicit corpus provenance", async () => {
    const reqAll = new NextRequest("http://localhost:3000/api/v1/findings?limit=50");
    const resAll = await getFindings(reqAll);
    expect(resAll.status).toBe(200);
    const jsonAll = await resAll.json();

    expect(jsonAll.pagination.totalCount).toBe(9);
    expect(jsonAll.corpusMetadata.activeCorpus.draws).toBe(118);
    expect(jsonAll.corpusMetadata.activeCorpus.version).toBe("active-research-118draws");
    expect(jsonAll.corpusMetadata.activeCorpusFindingCount).toBe(3);
    expect(jsonAll.corpusMetadata.v1BaselineFindingCount).toBe(3);
    expect(jsonAll.corpusMetadata.historicalSnapshotFindingCount).toBe(3);
    expect(jsonAll.corpusMetadata.lastEvaluatedCorpusVersion).toBe("corpus_055e805237802b5e");
    expect(jsonAll.corpusMetadata.isActiveCorpusEvaluated).toBe(true);

    const activeFindings = jsonAll.data.filter((f: any) => f.corpusRole === "ACTIVE_CORPUS");
    const v1Findings = jsonAll.data.filter((f: any) => f.corpusRole === "FROZEN_V1_BASELINE");
    const m9Findings = jsonAll.data.filter((f: any) => f.corpusRole === "HISTORICAL_SNAPSHOT");

    expect(activeFindings.length).toBe(3);
    expect(v1Findings.length).toBe(3);
    expect(m9Findings.length).toBe(3);

    for (const f of activeFindings) {
      expect(f.corpusVersion).toBe("corpus_055e805237802b5e");
      expect(f.corpusLabel).toBe("active-research-118draws");
      expect(f.drawCount).toBe(118);
      expect(f.totalResults).toBe(45218);
      expect(f.isCurrentActiveCorpus).toBe(true);
    }

    for (const f of v1Findings) {
      expect(f.corpusVersion).toBe("corpus_981356dd505db164");
      expect(f.corpusLabel).toBe("v1.0-research-114draws");
      expect(f.drawCount).toBe(114);
      expect(f.totalResults).toBe(43712);
      expect(f.isCurrentActiveCorpus).toBe(false);
    }

    for (const f of m9Findings) {
      expect(f.corpusVersion).toBe("corpus_07971b8e8aa2a79c");
      expect(f.corpusLabel).toBe("m9-initial-103draws");
      expect(f.drawCount).toBe(103);
      expect(f.totalResults).toBe(39550);
      expect(f.isCurrentActiveCorpus).toBe(false);
    }

    // Filter by corpusScope=active or scope=active returns only the 3 active 118-draw findings
    const reqActive = new NextRequest("http://localhost:3000/api/v1/findings?corpusScope=active");
    const resActive = await getFindings(reqActive);
    const jsonActive = await resActive.json();
    expect(jsonActive.pagination.totalCount).toBe(3);
    expect(jsonActive.data.every((f: any) => f.drawCount === 118)).toBe(true);
  });

  it("3. Serves complete detail, evidence bundle, and peer-reviewable report for active 118-draw findings", async () => {
    const activeFindingId = "find_a9cb45ea6d397ffc";

    const detailRes = await getFindingDetail(
      new NextRequest(`http://localhost:3000/api/v1/findings/${activeFindingId}`),
      { params: Promise.resolve({ id: activeFindingId }) }
    );
    expect(detailRes.status).toBe(200);
    const detailJson = await detailRes.json();
    expect(detailJson.findingId).toBe(activeFindingId);
    expect(detailJson.corpusVersion).toBe("corpus_055e805237802b5e");
    expect(detailJson.corpusLabel).toBe("active-research-118draws");
    expect(detailJson.drawCount).toBe(118);

    const evRes = await getFindingEvidence(
      new NextRequest(`http://localhost:3000/api/v1/findings/${activeFindingId}/evidence`),
      { params: Promise.resolve({ id: activeFindingId }) }
    );
    expect(evRes.status).toBe(200);
    const evJson = await evRes.json();
    expect(evJson.drawCount).toBe(118);
    expect(evJson.corpusRef.totalResults).toBe(45218);
    expect(evJson.sourceDocumentShas.length).toBe(118);

    const repRes = await getFindingReport(
      new NextRequest(`http://localhost:3000/api/v1/findings/${activeFindingId}/report`),
      { params: Promise.resolve({ id: activeFindingId }) }
    );
    expect(repRes.status).toBe(200);
    const repJson = await repRes.json();
    expect(repJson.findingId).toBe(activeFindingId);
    expect(repJson.markdownContent).toContain("118");
  });

  it("4. Reflects the active 118-draw (45,218-result) corpus consistently across Draws, Statistics, Experiment Results, Research Sandbox, Candidate Lab, and Geography APIs", async () => {
    // 1. Draws API
    const drawsRes = await getDraws(new NextRequest("http://localhost:3000/api/v1/draws?limit=5"));
    const drawsJson = await drawsRes.json();
    expect(drawsJson.pagination.totalCount).toBe(118);
    expect(drawsJson.data[0].drawNumber).toBe("KR-772nd");

    // 2. Statistics API
    const statsRes = await getStatistics(new NextRequest("http://localhost:3000/api/v1/statistics"));
    const statsJson = await statsRes.json();
    expect(statsJson.data.population.totalDraws).toBe(118);
    expect(statsJson.data.population.totalResults).toBe(45218);
    expect(statsJson.data.population.fullTicketCount).toBe(1714);
    expect(statsJson.data.population.suffixCount).toBe(43504);
    expect(statsJson.data.corpusVersion).toBe("active-research-118draws");
    expect(statsJson.data.corpusId).toBe("corpus_055e805237802b5e");
    expect(statsJson.data.v1Baseline.draws).toBe(114);
    expect(statsJson.data.v1Baseline.totalResults).toBe(43712);

    // 3. Experiment Results API
    const expRes = await getExperimentResults(new NextRequest("http://localhost:3000/api/v1/experiment-results"));
    const expJson = await expRes.json();
    expect(expJson.pagination.totalCount).toBe(12);
    const activeRuns = expJson.data.filter((r: any) => r.drawsEvaluated === 118);
    expect(activeRuns.length).toBe(3);

    // 4. Research Sandbox API
    const sbRes = await getResearchSandbox(
      new NextRequest("http://localhost:3000/api/v1/research-sandbox?lottery=BT&series=BB&number=814615")
    );
    const sbJson = await sbRes.json();
    expect(sbJson.provenance.corpusVersion).toBe("active-research-118draws");
    expect(sbJson.historicalComparison.sampleSizeDraws).toBe(118);
    expect(sbJson.historicalComparison.sampleSizeResults).toBe(45218);

    // 5. Candidate Lab API
    const clRes = await getCandidateLab(
      new NextRequest("http://localhost:3000/api/v1/candidate-lab?candidates=BT:BB:814615:A,BT:BA:025916:B")
    );
    const clJson = await clRes.json();
    expect(clJson.provenance.corpusVersion).toBe("active-research-118draws");
    const finalWindow = clJson.backtestResults.windows[clJson.backtestResults.windows.length - 1];
    expect(finalWindow.drawCount).toBe(118);
    expect(finalWindow.resultCount).toBe(45218);

    // 6. Geography API (preserves 103-draw M10A geographic dataset while exposing active 118-draw corpus metadata)
    const geoRes = await getGeography();
    const geoJson = await geoRes.json();
    expect(geoJson.drawCount).toBe(103);
    expect(geoJson.geographicObservationCount).toBe(380);
    expect(geoJson.activeCorpus.draws).toBe(118);
    expect(geoJson.activeCorpus.totalResults).toBe(45218);
    expect(geoJson.snapshotMetadata.snapshotVersion).toBe("m10a-geography-103draws");
  });

  it("5. Site-open discovery performs zero writes, deduplicates concurrent requests, uses 5m TTL cache, and preserves verified data on source outage", async () => {
    let networkCalls = 0;

    const mockFetch = (async (input: RequestInfo | URL): Promise<Response> => {
      networkCalls++;
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      await new Promise((r) => setTimeout(r, 15));
      if (url.includes("/result/public")) {
        return new Response(MOCK_LOTIS_RESULT_HTML, {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" }
        });
      }
      if (url.includes("lotteryagent.kerala.gov.in")) {
        return new Response(MOCK_LOTIS_HOME_HTML, {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" }
        });
      }
      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    setDiscoveryFetchOverrideForTesting(mockFetch);

    const makeSiteOpenReq = (forceRefresh = false) =>
      new NextRequest("http://localhost:3000/api/ops/ingestion/catch-up", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          environment: "DEV",
          mode: "DISCOVER",
          source: "site-open",
          forceRefresh,
          referenceDate: "2026-10-18T14:00:00+05:30"
        })
      });

    // Concurrent page opens share single-flight discovery promise
    const [res1, res2, res3] = await Promise.all([
      catchUpPost(makeSiteOpenReq(false)),
      catchUpPost(makeSiteOpenReq(false)),
      catchUpPost(makeSiteOpenReq(false))
    ]);

    const json1 = await res1.json();
    const json2 = await res2.json();
    const json3 = await res3.json();

    expect(json1.success).toBe(true);
    expect(json2.success).toBe(true);
    expect(json3.success).toBe(true);
    // Only 1 discovery run executed (2 HTTP fetches: /result/public + homepage)
    expect(networkCalls).toBe(2);
    expect(json1.lastVerifiedIngestedDraw.drawNumber).toBe("KR-772nd");
    expect(json1.currentIst.isoDate).toBe("2026-10-18");

    // Subsequent site-open call hits the 5m TTL cache without hitting the network
    const resCached = await catchUpPost(makeSiteOpenReq(false));
    const jsonCached = await resCached.json();
    expect(jsonCached.cacheMeta.cached).toBe(true);
    expect(networkCalls).toBe(2);
    expect(getCatchUpDiscoveryCacheSnapshotForTesting().cacheSize).toBe(1);

    // Simulate official source outage on forced refresh -> falls back to last verified discovery and preserves corpus
    const failingFetch = (async (): Promise<Response> => {
      throw new Error("ECONNREFUSED lotteryagent.kerala.gov.in");
    }) as typeof fetch;
    setDiscoveryFetchOverrideForTesting(failingFetch);

    const resOutage = await catchUpPost(makeSiteOpenReq(true));
    const jsonOutage = await resOutage.json();
    expect(resOutage.status).toBe(200);
    expect(jsonOutage.portalReachable).toBe(false);
    expect(jsonOutage.cacheMeta.staleFallbackUsed).toBe(true);
    expect(jsonOutage.corpusAfter.totalDraws).toBe(118);
    expect(jsonOutage.corpusAfter.totalResults).toBe(45218);

    // Confirm ResearchDataService cache invalidation reloads the 118-draw corpus cleanly
    researchService.invalidateCache();
    const reloadedStats = await researchService.getGlobalStatistics();
    expect(reloadedStats.population.totalDraws).toBe(118);
    expect(reloadedStats.population.totalResults).toBe(45218);
  });
});
