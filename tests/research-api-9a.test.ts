import { describe, it, expect } from "vitest";
import { researchService, ResearchApiError } from "../packages/data/src/research-service";
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

  it("Invariant 2: Exposes exactly 100 verified historical draws with deterministic pagination", async () => {
    // Default page 1, pageSize 20
    const resPage1 = await researchService.getDraws({ page: 1, pageSize: 20 });
    expect(resPage1.data.length).toBe(20);
    expect(resPage1.pagination.totalCount).toBe(100);
    expect(resPage1.pagination.page).toBe(1);
    expect(resPage1.pagination.hasMore).toBe(true);

    // PageSize 100 returns all draws
    const resAll = await researchService.getDraws({ page: 1, pageSize: 100 });
    expect(resAll.data.length).toBe(100);
    expect(resAll.pagination.hasMore).toBe(false);

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
    expect(source?.associatedDraw.drawId).toBe("draw_BT-73");
    expect(source?.drawNumber).toBe("BT-73rd");
    expect(source?.mimeType).toBe("application/pdf");
    expect(source?.storagePath).toContain("kerala-lottery-intelligence-prod-sources");
    expect(source?.status).toBe("VALID");
  });

  it("Invariant 7: Statistics evaluate 38,416 winning results with non-predictive notice", async () => {
    const stats = await researchService.getStatistics();
    expect(stats.population.totalDraws).toBe(100);
    expect(stats.population.totalResults).toBe(38416);
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
    const uniform = models.find((m) => m.modelId === "model_uniform_random_baseline" || m.modelType === "UNIFORM");
    expect(uniform).toBeDefined();
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
});
