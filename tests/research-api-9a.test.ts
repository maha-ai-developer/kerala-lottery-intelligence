import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { researchService, ResearchApiError } from "../packages/data/src/research-service";
import { computeSha256 } from "../packages/documents/src";
import {
  methodNotAllowed,
  apiSuccess,
  apiError,
  IMMUTABLE_CACHE_HEADER
} from "../apps/web/lib/api-response";

describe("Directive 9A: Production Research API & Read-Only Surface Invariants", () => {
  // 1. Data Domains & Coverage
  it("Invariant 1: Exposes exactly 9 active/seasonal Kerala lottery families", async () => {
    const lotteries = await researchService.getLotteries();
    expect(lotteries).toBeDefined();
    expect(lotteries.length).toBe(9);
    const codes = lotteries.map((l) => l.code);
    expect(codes).toContain("BT"); // Bhagyathara
    expect(codes).toContain("KR"); // Karunya
    expect(codes).toContain("KN"); // Karunya Plus
    expect(codes).toContain("DL"); // Dhanalekshmi
    expect(codes).toContain("SK"); // Suvarna Keralam
    expect(codes).toContain("SS"); // Sthree Sakthi
    expect(codes).toContain("SM"); // Samrudhi
    expect(codes).toContain("MB"); // Monsoon Bumper
    expect(codes).toContain("BR"); // Thiruvonam Bumper
  });

  it("Invariant 2: Exposes exactly 103 verified historical draws with deterministic pagination", async () => {
    // Default page 1, pageSize 20
    const resPage1 = await researchService.getDraws({ page: 1, pageSize: 20 });
    expect(resPage1.data.length).toBe(20);
    expect(resPage1.pagination.totalCount).toBe(103);
    expect(resPage1.pagination.page).toBe(1);
    expect(resPage1.pagination.hasMore).toBe(true);

    // PageSize 100 returns 100 draws with hasMore: true
    const resPage100 = await researchService.getDraws({ page: 1, pageSize: 100 });
    expect(resPage100.data.length).toBe(100);
    expect(resPage100.pagination.hasMore).toBe(true);

    // Page 2 returns the remaining 3 draws
    const resPage2 = await researchService.getDraws({ page: 2, pageSize: 100 });
    expect(resPage2.data.length).toBe(3);
    expect(resPage2.pagination.hasMore).toBe(false);

    // Maximum pageSize guard (requesting 500 clamps to 100)
    const resClamped = await researchService.getDraws({ page: 1, pageSize: 500 });
    expect(resClamped.data.length).toBe(100);
    expect(resClamped.pagination.pageSize).toBe(100);
  });

  it("Invariant 3: Real-World Anchor BT-73 resolves with exact verified metadata", async () => {
    const bt73 = await researchService.getDrawById("draw_BT-73");
    expect(bt73).toBeDefined();
    expect(bt73?.lotteryName).toBe("BHAGYATHARA");
    expect(bt73?.drawNumber).toBe("BT-73rd");
    expect(bt73?.drawDate).toBe("28/09/2026");
    expect(bt73?.sourceDocumentSha256).toBe(
      "cddb3d4d05c102b98f38050ac1ff297ad15bc442b12087c0505927f7bb1cf3dc"
    );
    expect(bt73?.prizeSchemeId).toBe("scheme_ver_bt_v2025-11-sro1297");
    expect(bt73?.totalResults).toBe(378);
    expect(bt73?.validationStatus).toBe("VALID");
  });

  it("Invariant 4: BT-73 contains exactly 378 winning results preserving leading zeros", async () => {
    const resultsRes = await researchService.getDrawResults("draw_BT-73", { pageSize: 500 });
    expect(resultsRes).not.toBeNull();
    // Bounded pagination: maximum 100 results per page
    expect(resultsRes!.data.length).toBe(100);
    expect(resultsRes!.pagination.totalCount).toBe(378);

    // Collect all results across pages to verify full 378 count and leading zero preservation
    let totalCollected = 0;
    let fullTicketCount = 0;
    let suffixCount = 0;
    let leadingZeroCount = 0;

    for (let p = 1; p <= resultsRes!.pagination.totalPages; p++) {
      const pageRes = await researchService.getDrawResults("draw_BT-73", { page: p, pageSize: 100 });
      expect(pageRes).not.toBeNull();
      totalCollected += pageRes!.data.length;

      for (const r of pageRes!.data) {
        expect(typeof r.canonicalNumber).toBe("string");
        expect(r.canonicalNumber.length).toBeGreaterThan(0);
        expect(r.sourceDocumentSha256).toBe(
          "cddb3d4d05c102b98f38050ac1ff297ad15bc442b12087c0505927f7bb1cf3dc"
        );
        expect(r.drawId).toBe("draw_BT-73");

        if (r.isSuffix) suffixCount++;
        else fullTicketCount++;

        if (r.canonicalNumber.startsWith("0")) leadingZeroCount++;
      }
    }

    expect(totalCollected).toBe(378);
    expect(fullTicketCount).toBe(14); // 1 1st prize + 13 consolation prizes
    expect(suffixCount).toBe(364);
    expect(leadingZeroCount).toBeGreaterThan(0);
  });

  it("Invariant 5: Prize Schemes classify OFFICIAL_SCHEME vs OBSERVED_SCHEME_ARCHETYPE (BR-111)", async () => {
    const schemesRes = await researchService.getSchemes({ pageSize: 100 });
    const schemes = schemesRes.data;
    expect(schemes.length).toBe(16);

    const officialSchemes = schemes.filter((s) => s.authorityLevel === "OFFICIAL_SCHEME");
    const archetypeSchemes = schemes.filter((s) => s.authorityLevel === "OBSERVED_SCHEME_ARCHETYPE");

    expect(officialSchemes.length).toBe(15);
    expect(archetypeSchemes.length).toBe(1);

    // BR-111 must be the archetype scheme
    expect(archetypeSchemes[0]!.lotteryCode).toBe("THIRUVONAM_BUMPER");
    expect(archetypeSchemes[0]!.id).toContain("br111");

    // BT-73 scheme must be OFFICIAL_SCHEME
    const bt73Scheme = await researchService.getSchemeById("scheme_ver_bt_v2025-11-sro1297");
    expect(bt73Scheme).toBeDefined();
    expect(bt73Scheme?.authorityLevel).toBe("OFFICIAL_SCHEME");
    expect(bt73Scheme?.tierRules.length).toBe(10); // Standard weekly tier rules
  });

  it("Invariant 6: Source document lookup by SHA-256 resolves canonical evidence", async () => {
    const sha = "cddb3d4d05c102b98f38050ac1ff297ad15bc442b12087c0505927f7bb1cf3dc";
    const source = await researchService.getSourceBySha256(sha);
    expect(source).toBeDefined();
    expect(source?.sha256).toBe(sha);
    expect(source?.canonicalFilename).toBe("271-2346-28-09-2026.pdf");
    expect(source?.fileName).toBe("271-2346-28-09-2026.pdf");
    expect(source?.sourceResponseFilename).toBe("BT-73.pdf");
    expect(source?.sourceUrl).toBe("http://result.keralalotteries.com/viewlotisresult.php?drawserial=75393");
    expect(source?.provenance.canonicalFilename).toBe("271-2346-28-09-2026.pdf");
    expect(source?.provenance.sourceResponseFilename).toBe("BT-73.pdf");
    expect(source?.associatedDraw.drawId).toBe("draw_BT-73");
    expect(source?.drawNumber).toBe("BT-73rd");
    expect(source?.mimeType).toBe("application/pdf");
    expect(source?.storagePath).toBe(
      `gs://kerala-lottery-intelligence.firebasestorage.app/source-documents/${sha}.pdf`
    );
    expect(source?.provenance.cloudStorageBucket).toBe("kerala-lottery-intelligence.firebasestorage.app");
    expect(source?.status).toBe("VALID");
  });

  it("Invariant 7: Statistics evaluate 39,550 winning results across 103 draws with non-predictive notice", async () => {
    const stats = await researchService.getStatistics();
    expect(stats.population.totalDraws).toBe(103);
    expect(stats.population.totalResults).toBe(39550);
    expect(stats.population.fullTicketCount).toBe(1504);
    expect(stats.population.suffixCount).toBe(38046);
    expect(Object.keys(stats.lastDigitDistribution).length).toBe(10);
    expect(Object.keys(stats.firstDigitDistribution).length).toBe(10);

    // Check entropy is near theoretical max (~3.32 bits for base 10)
    expect(stats.entropy.lastDigitEntropy).toBeGreaterThan(3.3);
    expect(stats.entropy.lastDigitEntropy).toBeLessThanOrEqual(stats.entropy.theoreticalUniformEntropy + 0.05);

    // Chi-square uniformity degrees of freedom = 9
    expect(stats.chiSquareUniformity.degreesOfFreedom).toBe(9);
    expect(stats.chiSquareUniformity.lastDigitChiSquare).toBeGreaterThan(0);

    // Scientific notice must be present and explicit
    expect(stats.provenance.disclaimer).toContain("NON-PREDICTIVE MODELING FOUNDATION NOTICE");
    expect(stats.provenance.disclaimer).toContain("NO winning-number predictions");
  });

  it("Invariant 8: Experiments and Backtests enforce chronological holdout and temporal separation", async () => {
    const experimentsRes = await researchService.getExperiments();
    expect(experimentsRes.data.length).toBeGreaterThanOrEqual(1);
    for (const exp of experimentsRes.data) {
      expect(exp.disclaimer).toContain("NON-PREDICTIVE MODELING FOUNDATION NOTICE");
    }
    expect(experimentsRes.data.some((exp) => exp.evaluationMethod.includes("Holdout"))).toBe(true);

    const backtestsRes = await researchService.getBacktests();
    expect(backtestsRes.data.length).toBeGreaterThanOrEqual(1);
    for (const bt of backtestsRes.data) {
      expect(bt.testRows).toBeGreaterThan(0);
      expect(bt.metrics.accuracy).toBeGreaterThan(0.08); // roughly ~10% for uniform random digits
      expect(bt.metrics.accuracy).toBeLessThan(0.12);
    }

    const models = await researchService.getModels();
    expect(models.length).toBe(3); // Uniform, Empirical, Majority
    for (const m of models) {
      expect(m.classification).toBe("FORMAL_STATISTICAL_BASELINE");
      expect(m.provenance).toContain("@kerala-lottery/statistics");
      expect(m.descriptiveOnly).toBe(true);
    }
  });

  it("Invariant 9: Ingestion runs are sanitized of all operational secrets and reflect PAUSED scheduler", async () => {
    const runsRes = await researchService.getIngestionRuns();
    expect(runsRes.data.length).toBeGreaterThanOrEqual(1);
    for (const run of runsRes.data) {
      expect(run.audit.schedulerState).toBe("PAUSED");
      expect(run.audit.zeroSecretsExposed).toBe(true);
      // Ensure no raw bearer tokens or secret keys in JSON representation
      const serialized = JSON.stringify(run);
      expect(serialized).not.toContain("Bearer");
      expect(serialized).not.toContain("AIza");
      expect(serialized).not.toContain("private_key");
    }
  });

  it("Invariant 10: Search across draws and numbers functions deterministically", async () => {
    // Search by draw number
    const drawSearch = await researchService.search("BT-73");
    expect(drawSearch.draws.length).toBeGreaterThan(0);
    expect(drawSearch.draws.some((item) => item.drawId === "draw_BT-73" || item.drawNumber.includes("73"))).toBe(true);

    // Search by ticket digits
    const numSearch = await researchService.search("75382");
    expect(numSearch.query).toBe("75382");
  });

  // 2. Read-Only API Contracts & HTTP Protocol Invariants
  it("Invariant 11: Method Not Allowed (405) is returned for mutation attempts", () => {
    const postRes = methodNotAllowed();
    expect(postRes.status).toBe(405);
    expect(postRes.headers.get("Allow")).toBe("GET");
  });

  it("Invariant 12: Success responses include structured envelopes and appropriate cache headers", async () => {
    const res = apiSuccess({ foo: "bar" }, { cache: true });
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe(IMMUTABLE_CACHE_HEADER);

    const body = await res.json();
    expect(body.foo).toBe("bar");
  });

  it("Invariant 13: Error responses do not leak stack traces or internal secrets", async () => {
    const res = apiError(new ResearchApiError(400, "INVALID_PARAMETER", "Invalid parameter provided"));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe("INVALID_PARAMETER");
    expect(body.message).toBe("Invalid parameter provided");
    expect(body.statusCode).toBe(400);
    expect(body.stack).toBeUndefined();
  });

  it("Invariant 14: End-to-end provenance traversal (BT-73 -> Source -> Scheme -> 378 Results)", async () => {
    // Step 1: Query draw
    const draw = await researchService.getDrawById("draw_BT-73");
    expect(draw).toBeDefined();

    // Step 2: Query source via draw's sourceDocumentSha256
    const source = await researchService.getSourceBySha256(draw!.sourceDocumentSha256);
    expect(source?.associatedDraw.drawId).toBe(draw!.drawId);

    // Step 3: Query scheme via draw's prizeSchemeId
    const scheme = await researchService.getSchemeById(draw!.prizeSchemeId!);
    expect(scheme?.id).toBe(draw!.prizeSchemeId);

    // Step 4: Query results for draw
    const results = await researchService.getDrawResults(draw!.drawId, { pageSize: 50 });
    expect(results!.pagination.totalCount).toBe(378);

    // Every result links back to the draw and source document SHA
    for (const r of results!.data) {
      expect(r.drawId).toBe(draw!.drawId);
      expect(r.sourceDocumentSha256).toBe(draw!.sourceDocumentSha256);
    }
  });

  it("Invariant 15: Separated Filename Model prevents arbitrary lottery-code filenames from becoming canonical", async () => {
    const sha = "cddb3d4d05c102b98f38050ac1ff297ad15bc442b12087c0505927f7bb1cf3dc";
    const source = await researchService.getSourceBySha256(sha);
    expect(source).toBeDefined();

    // 1. Separate fields check: sourceUrl, sourceResponseFilename, canonicalFilename, sha256
    expect(source?.canonicalFilename).not.toBe(source?.sourceResponseFilename);
    expect(source?.canonicalFilename).toBe("271-2346-28-09-2026.pdf");
    expect(source?.sourceResponseFilename).toBe("BT-73.pdf");
    expect(source?.sourceUrl).toBe("http://result.keralalotteries.com/viewlotisresult.php?drawserial=75393");
    expect(source?.sha256).toBe(sha);

    // 2. Arbitrary lottery code pattern (e.g. BT-73.pdf) is forbidden from being the canonicalFilename
    expect(source?.canonicalFilename).toMatch(/^[0-9]+-[0-9]+-[0-9]{2}-[0-9]{2}-[0-9]{4}\.pdf$/);
    expect(source?.canonicalFilename).not.toBe("BT-73.pdf");

    // 3. Provenance records both original HTTP response filename and canonical repository filename
    expect(source?.provenance.canonicalFilename).toBe("271-2346-28-09-2026.pdf");
    expect(source?.provenance.sourceResponseFilename).toBe("BT-73.pdf");

    // 4. Physical file on disk matches canonicalFilename with identical byte SHA-256
    const diskPath = join(process.cwd(), "data/source-documents/lottery-results", source!.canonicalFilename);
    expect(existsSync(diskPath)).toBe(true);
    const diskBytes = readFileSync(diskPath);
    const diskSha = computeSha256(new Uint8Array(diskBytes));
    expect(diskSha).toBe(sha);
    expect(diskSha).toBe("cddb3d4d05c102b98f38050ac1ff297ad15bc442b12087c0505927f7bb1cf3dc");
  });

  it("Invariant 16: Catch-Up Historical Draws (29/09, 30/09, 01/10/2026) adhere to separated filename model", async () => {
    const catchupConfigs = [
      {
        drawId: "draw_SS-539",
        drawNumber: "SS-539th",
        drawDate: "29/09/2026",
        lotteryName: "STHREE-SAKTHI",
        sha256: "351176188dbb5264f22715eef8cab489e584d67455125c36e8778edc6aff431e",
        canonicalFilename: "272-2351-29-09-2026.pdf",
        sourceResponseFilename: "SS-539.pdf",
        sourceUrl: "http://result.keralalotteries.com/viewlotisresult.php?drawserial=75394",
        totalResults: 380,
        fullTicketCount: 14,
        suffixCount: 366
      },
      {
        drawId: "draw_DL-71",
        drawNumber: "DL-71st",
        drawDate: "30/09/2026",
        lotteryName: "DHANALEKSHMI",
        sha256: "8670c8a0cdb9174d81c57a21b38e279c969088b4dc5020a16ef3f5a59e787174",
        canonicalFilename: "273-2356-30-09-2026.pdf",
        sourceResponseFilename: "DL-71.pdf",
        sourceUrl: "http://result.keralalotteries.com/viewlotisresult.php?drawserial=75395",
        totalResults: 374,
        fullTicketCount: 14,
        suffixCount: 360
      },
      {
        drawId: "draw_KN-643",
        drawNumber: "KN-643rd",
        drawDate: "01/10/2026",
        lotteryName: "KARUNYA PLUS",
        sha256: "37e35a7760e98eecc7062e10c9512070f8809d759e72963d5857374ea28a09fc",
        canonicalFilename: "274-2361-01-10-2026.pdf",
        sourceResponseFilename: "KN-643.pdf",
        sourceUrl: "http://result.keralalotteries.com/viewlotisresult.php?drawserial=75396",
        totalResults: 380,
        fullTicketCount: 14,
        suffixCount: 366
      }
    ];

    const sourceDocsDir = join(process.cwd(), "data/source-documents/lottery-results");

    for (const config of catchupConfigs) {
      // 1. Verify draw resolution
      const draw = await researchService.getDrawById(config.drawId);
      expect(draw).toBeDefined();
      expect(draw?.drawNumber).toBe(config.drawNumber);
      expect(draw?.drawDate).toBe(config.drawDate);
      expect(draw?.lotteryName).toBe(config.lotteryName);
      expect(draw?.sourceDocumentSha256).toBe(config.sha256);
      expect(draw?.totalResults).toBe(config.totalResults);
      expect(draw?.fullTicketCount).toBe(config.fullTicketCount);
      expect(draw?.suffixCount).toBe(config.suffixCount);
      expect(draw?.validationStatus).toBe("VALID");

      // 2. Verify source document resolution & separated filename model
      const source = await researchService.getSourceBySha256(config.sha256);
      expect(source).toBeDefined();
      expect(source?.canonicalFilename).toBe(config.canonicalFilename);
      expect(source?.sourceResponseFilename).toBe(config.sourceResponseFilename);
      expect(source?.sourceUrl).toBe(config.sourceUrl);
      expect(source?.sha256).toBe(config.sha256);

      // 3. Physical file on disk exists under canonicalFilename with matching SHA
      const diskPath = join(sourceDocsDir, config.canonicalFilename);
      expect(existsSync(diskPath)).toBe(true);
      const diskBytes = readFileSync(diskPath);
      const diskSha = computeSha256(new Uint8Array(diskBytes));
      expect(diskSha).toBe(config.sha256);

      // 4. Forbidden response filenames must NOT exist in the repository source directory
      const forbiddenPath = join(sourceDocsDir, config.sourceResponseFilename);
      expect(existsSync(forbiddenPath)).toBe(false);
    }
  });
});
