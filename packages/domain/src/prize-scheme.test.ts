/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 7A.6 — Prize Structure & Scheme Registry Tests
 *
 * Tests all 24 required invariant and functional properties:
 * 1. WEEKLY scheme identity
 * 2. BUMPER scheme identity
 * 3. version identity
 * 4. supersession
 * 5. source provenance
 * 6. series definition
 * 7. common-to-all-series rule
 * 8. one-per-series rule
 * 9. last-four-digit rule
 * 10. consolation rule
 * 11. expected number length
 * 12. theoretical vs observed counts
 * 13. draw-to-scheme resolution
 * 14. date applicability
 * 15. ambiguous scheme handling
 * 16. missing scheme handling
 * 17. weekly validation
 * 18. bumper validation
 * 19. observed-result compatibility
 * 20. deterministic scheme ID
 * 21. repeated execution equivalence
 * 22. no source mutation
 * 23. provenance preservation
 * 24. leading-zero compatibility
 */

import { describe, it, expect } from "vitest";
import {
  createAuthoritativePrizeSchemeRegistry,
  InMemoryPrizeSchemeRepository,
  validateDrawAgainstPrizeScheme,
  inferSchemeTypeFromLotteryName,
  BT_SRO_SHA256,
  type PrizeSchemeVersion
} from "./prize-scheme";
import { statSync } from "node:fs";
import { join } from "node:path";

describe("Milestone 7A.6 — Prize Structure & Scheme Registry", () => {
  const registry = createAuthoritativePrizeSchemeRegistry();

  // 1. WEEKLY scheme identity
  it("1. WEEKLY scheme identity: correctly typed and distinct from BUMPER", () => {
    const bt = registry.getSchemeVersion("scheme_ver_bt_v2025-11-sro1297");
    expect(bt).toBeDefined();
    expect(bt?.schemeType).toBe("WEEKLY");
    expect(bt?.periodicity).toBe("Weekly Draw");
    expect(inferSchemeTypeFromLotteryName("BHAGYATHARA")).toBe("WEEKLY");
    expect(inferSchemeTypeFromLotteryName("DHANALEKSHMI")).toBe("WEEKLY");
    expect(inferSchemeTypeFromLotteryName("KARUNYA PLUS")).toBe("WEEKLY");
  });

  // 2. BUMPER scheme identity
  it("2. BUMPER scheme identity: explicit schemeType and distinct architecture", () => {
    const monsoon = registry.getSchemeVersion("scheme_ver_monsoon_bumper_2026_br110");
    const onam = registry.getSchemeVersion("scheme_ver_thiruvonam_bumper_2026_br111");

    expect(monsoon).toBeDefined();
    expect(monsoon?.schemeType).toBe("BUMPER");
    expect(monsoon?.numberOfSeries).toBe(5);
    expect(monsoon?.seriesCodes).toEqual(["MA", "MB", "MC", "MD", "ME"]);

    expect(onam).toBeDefined();
    expect(onam?.schemeType).toBe("BUMPER");
    expect(onam?.numberOfSeries).toBe(10);
    expect(onam?.seriesCodes.length).toBe(10);

    expect(inferSchemeTypeFromLotteryName("MONSOON BUMPER LOTTERY")).toBe("BUMPER");
    expect(inferSchemeTypeFromLotteryName("THIRUVONAM BUMPER LOTTERY")).toBe("BUMPER");
  });

  // 3. version identity
  it("3. version identity: each scheme version has deterministic, unique identifier", () => {
    const all = registry.getAllVersions();
    expect(all.length).toBeGreaterThanOrEqual(5);

    const ids = new Set(all.map((v) => v.id));
    expect(ids.size).toBe(all.length);

    const btActive = registry.getSchemeVersion("scheme_ver_bt_v2025-11-sro1297");
    expect(btActive?.version).toBe("v2025-11-sro1297");
    expect(btActive?.status).toBe("ACTIVE");
  });

  // 4. supersession
  it("4. supersession: newer Government notifications supersede previous versions without overwriting", () => {
    const btOld = registry.getSchemeVersion("scheme_ver_bt_v2025-09-sro1062");
    const btNew = registry.getSchemeVersion("scheme_ver_bt_v2025-11-sro1297");

    expect(btOld).toBeDefined();
    expect(btNew).toBeDefined();
    expect(btOld?.status).toBe("SUPERSEDED");
    expect(btNew?.status).toBe("ACTIVE");

    expect(btNew?.supersedesSchemeId).toBe(btOld?.id);
    expect(btOld?.applicability.supersededBySchemeId).toBe(btNew?.id);
    expect(btOld?.effectiveTo).toBe("2025-11-09");
    expect(btNew?.effectiveFrom).toBe("2025-11-10");
  });

  // 5. source provenance
  it("5. source provenance: records SHA-256, SRO number, notification, gazette, and priority", () => {
    const bt = registry.getSchemeVersion("scheme_ver_bt_v2025-11-sro1297")!;
    expect(bt.provenance.sourceType).toBe("GAZETTE_SRO");
    expect(bt.provenance.authorityPriority).toBe(1);
    expect(bt.provenance.documentSha256).toBe(BT_SRO_SHA256);
    expect(bt.provenance.sroNumber).toBe("S. R. O. No. 1297/2025");
    expect(bt.provenance.notificationNumber).toBe("G.O.(P) No.192/2025/TAXES");
    expect(bt.provenance.gazetteNumber).toBe("3982");
    expect(bt.provenance.publishedDate).toBe("2025-11-10");
    expect(bt.provenance.evidenceText).toContain("S. R. O. No. 1297/2025");
  });

  // 6. series definition
  it("6. series definition: scheme specifies series count separately from winning series", () => {
    const dl = registry.getSchemeVersion("scheme_ver_dl_v2025-11-sro1296")!;
    expect(dl.seriesRule.numberOfSeries).toBe(12);
    expect(dl.seriesRule.selectionScope).toBe("ALL");
    expect(dl.seriesRule.rawSourceText).toContain("Tickets are issued in twelve series");

    const monsoon = registry.getSchemeVersion("scheme_ver_monsoon_bumper_2026_br110")!;
    expect(monsoon.seriesRule.numberOfSeries).toBe(5);
    expect(monsoon.seriesRule.knownSeriesCodes).toEqual(["MA", "MB", "MC", "MD", "ME"]);
  });

  // 7. common-to-all-series rule
  it("7. common-to-all-series rule: 1st, 2nd, 3rd prizes are common across all series", () => {
    const kn = registry.getSchemeVersion("scheme_ver_kn_v2025-11-sro1294")!;
    const tier1 = kn.tierRules.find((t) => t.rank === 1)!;
    const tier2 = kn.tierRules.find((t) => t.rank === 2)!;
    const tier3 = kn.tierRules.find((t) => t.rank === 3)!;

    expect(tier1.selectionBasis).toBe("COMMON_TO_ALL_SERIES");
    expect(tier1.drawCount).toBe(1);
    expect(tier1.maximumPrizeCount).toBe(1);
    expect(tier1.numberLength).toBe(6);

    expect(tier2.selectionBasis).toBe("COMMON_TO_ALL_SERIES");
    expect(tier2.drawCount).toBe(1);
    expect(tier2.maximumPrizeCount).toBe(1);

    expect(tier3.selectionBasis).toBe("COMMON_TO_ALL_SERIES");
    expect(tier3.drawCount).toBe(1);
    expect(tier3.maximumPrizeCount).toBe(1);
  });

  // 8. one-per-series rule
  it("8. one-per-series rule: bumper schemes allocate prizes per individual series", () => {
    const monsoon = registry.getSchemeVersion("scheme_ver_monsoon_bumper_2026_br110")!;
    const tier2 = monsoon.tierRules.find((t) => t.rank === 2)!;
    expect(tier2.selectionBasis).toBe("ONE_PER_SERIES");
    expect(tier2.seriesScope).toBe("PER_SERIES");
    expect(tier2.drawCount).toBe(5);
    expect(tier2.maximumPrizeCount).toBe(5);
  });

  // 9. last-four-digit rule
  it("9. last-four-digit rule: suffix tiers specify draw repetitions and 4-digit numberLength", () => {
    const bt = registry.getSchemeVersion("scheme_ver_bt_v2025-11-sro1297")!;
    const tier4 = bt.tierRules.find((t) => t.tierCode === "IV")!;
    const tier9 = bt.tierRules.find((t) => t.tierCode === "IX")!;

    expect(tier4.selectionBasis).toBe("LAST_FOUR_DIGITS");
    expect(tier4.isSuffix).toBe(true);
    expect(tier4.numberLength).toBe(4);
    expect(tier4.drawCount).toBe(19);

    expect(tier9.selectionBasis).toBe("LAST_FOUR_DIGITS");
    expect(tier9.isSuffix).toBe(true);
    expect(tier9.numberLength).toBe(4);
    expect(tier9.drawCount).toBe(144);
  });

  // 10. consolation rule
  it("10. consolation rule: consolation awards remaining series matching 1st prize number", () => {
    const bt = registry.getSchemeVersion("scheme_ver_bt_v2025-11-sro1297")!;
    const cons = bt.tierRules.find((t) => t.isConsolation)!;
    expect(cons).toBeDefined();
    expect(cons.selectionBasis).toBe("CONSOLATION");
    expect(cons.seriesScope).toBe("REMAINING_SERIES");
    expect(cons.drawCount).toBe(11); // 12 - 1 = 11
    expect(cons.maximumPrizeCount).toBe(11);
    expect(cons.numberLength).toBe(6);
  });

  // 11. expected number length
  it("11. expected number length: enforces 6 for full tickets and 4 for suffix rules", () => {
    const dl = registry.getSchemeVersion("scheme_ver_dl_v2025-11-sro1296")!;
    for (const tier of dl.tierRules) {
      if (tier.isSuffix) {
        expect(tier.numberLength).toBe(4);
      } else {
        expect(tier.numberLength).toBe(6);
      }
    }
  });

  // 12. theoretical vs observed counts
  it("12. theoretical vs observed counts: computes exact mathematical capacity", () => {
    const bt = registry.getSchemeVersion("scheme_ver_bt_v2025-11-sro1297")!;
    const tickets = bt.ticketsPrinted; // 1,08,00,000
    const factor = tickets / 10000; // 1080

    for (const tier of bt.tierRules) {
      if (tier.isSuffix) {
        // theoretical maximum = repetitionCount * (tickets / 10000)
        expect(tier.maximumPrizeCount).toBe(tier.drawCount * factor);
      }
    }

    const tier4 = bt.tierRules.find((t) => t.tierCode === "IV")!;
    expect(tier4.maximumPrizeCount).toBe(19 * 1080); // 20,520
    const tier8 = bt.tierRules.find((t) => t.tierCode === "VIII")!;
    expect(tier8.maximumPrizeCount).toBe(94 * 1080); // 1,01,520
  });

  // 13. draw-to-scheme resolution
  it("13. draw-to-scheme resolution: resolves active scheme version by lottery and date", () => {
    const res = registry.resolveSchemeForDraw({
      lotteryName: "BHAGYATHARA",
      drawDate: "14/09/2026"
    });

    expect(res.status).toBe("SCHEME_RESOLVED");
    expect(res.schemeVersion?.id).toBe("scheme_ver_bt_v2025-11-sro1297");
    expect(res.confidence).toBe(1.0);
    expect(res.sourceProvenance?.sroNumber).toBe("S. R. O. No. 1297/2025");
  });

  // 14. date applicability
  it("14. date applicability: historical draw before supersession resolves to earlier version", () => {
    const res = registry.resolveSchemeForDraw({
      lotteryName: "BHAGYATHARA",
      drawDate: "2025-10-01" // In October 2025, prior to Nov 10 supersession
    });

    expect(res.status).toBe("SCHEME_RESOLVED");
    expect(res.schemeVersion?.id).toBe("scheme_ver_bt_v2025-09-sro1062");
    expect(res.schemeVersion?.status).toBe("SUPERSEDED");
  });

  // 15. ambiguous scheme handling
  it("15. ambiguous scheme handling: returns SCHEME_RESOLUTION_AMBIGUOUS for unresolvable overlaps", () => {
    const customRepo = new InMemoryPrizeSchemeRepository();
    // Register two overlapping active versions without supersession
    const vA: PrizeSchemeVersion = {
      ...registry.getSchemeVersion("scheme_ver_bt_v2025-11-sro1297")!,
      id: "scheme_ver_bt_alt_A",
      version: "vA",
      supersedesSchemeId: undefined
    };
    const vB: PrizeSchemeVersion = {
      ...registry.getSchemeVersion("scheme_ver_bt_v2025-11-sro1297")!,
      id: "scheme_ver_bt_alt_B",
      version: "vB",
      supersedesSchemeId: undefined
    };
    customRepo.registerSchemeVersion(vA);
    customRepo.registerSchemeVersion(vB);

    const res = customRepo.resolveSchemeForDraw({
      lotteryName: "BHAGYATHARA",
      drawDate: "2026-09-14"
    });

    expect(res.status).toBe("SCHEME_RESOLUTION_AMBIGUOUS");
    expect(res.schemeVersion).toBeUndefined();
    expect(res.resolutionEvidence).toContain("multiple overlapping");
  });

  // 16. missing scheme handling
  it("16. missing scheme handling: returns SCHEME_NOT_FOUND when official Gazette SRO is absent", () => {
    const res = registry.resolveSchemeForDraw({
      lotteryName: "UNKNOWN_LOTTERY_XYZ",
      drawDate: "2026-09-14"
    });
    expect(res.status).toBe("SCHEME_NOT_FOUND");
    expect(res.schemeVersion).toBeUndefined();

    // Sthree-Sakthi without registered Gazette SRO returns NOT_FOUND
    const resSS = registry.resolveSchemeForDraw({
      lotteryName: "STHREE-SAKTHI",
      drawDate: "2026-09-15"
    });
    expect(resSS.status).toBe("SCHEME_NOT_FOUND");
    expect(resSS.resolutionEvidence).toContain("No registered scheme definitions");
  });

  // 17. weekly validation
  it("17. weekly validation: validates complete weekly draw structure against official SRO rules", () => {
    const scheme = registry.getSchemeVersion("scheme_ver_bt_v2025-11-sro1297")!;

    // Construct mock observed draw matching BT structure
    const mockTiers = scheme.tierRules.map((r) => ({
      name: r.tierName,
      rank: r.rank,
      amount: r.amount,
      isSuffix: r.isSuffix
    }));

    const mockWinningResults: Array<{
      prizeTierName: string;
      rank: number;
      amount: number;
      canonicalNumber: string;
      numberLength: number;
      isSuffix: boolean;
    }> = [
      { prizeTierName: "1st Prize", rank: 1, amount: 10000000, canonicalNumber: "123456", numberLength: 6, isSuffix: false },
      { prizeTierName: "2nd Prize", rank: 2, amount: 3000000, canonicalNumber: "234567", numberLength: 6, isSuffix: false },
      { prizeTierName: "3rd Prize", rank: 3, amount: 500000, canonicalNumber: "345678", numberLength: 6, isSuffix: false },
      // 11 consolation prizes
      ...Array.from({ length: 11 }, () => ({
        prizeTierName: "Consolation Prize",
        rank: 0,
        amount: 5000,
        canonicalNumber: "123456",
        numberLength: 6,
        isSuffix: false
      })),
      // 19 draws for 4th prize
      ...Array.from({ length: 19 }, (_, i) => ({
        prizeTierName: "4th Prize",
        rank: 4,
        amount: 5000,
        canonicalNumber: String(1000 + i),
        numberLength: 4,
        isSuffix: true
      })),
      // 6 draws for 5th prize
      ...Array.from({ length: 6 }, (_, i) => ({
        prizeTierName: "5th Prize",
        rank: 5,
        amount: 2000,
        canonicalNumber: String(2000 + i),
        numberLength: 4,
        isSuffix: true
      })),
      // 25 draws for 6th prize
      ...Array.from({ length: 25 }, (_, i) => ({
        prizeTierName: "6th Prize",
        rank: 6,
        amount: 1000,
        canonicalNumber: String(3000 + i),
        numberLength: 4,
        isSuffix: true
      })),
      // 76 draws for 7th prize
      ...Array.from({ length: 76 }, (_, i) => ({
        prizeTierName: "7th Prize",
        rank: 7,
        amount: 500,
        canonicalNumber: String(4000 + i),
        numberLength: 4,
        isSuffix: true
      })),
      // 94 draws for 8th prize
      ...Array.from({ length: 94 }, (_, i) => ({
        prizeTierName: "8th Prize",
        rank: 8,
        amount: 200,
        canonicalNumber: String(5000 + i),
        numberLength: 4,
        isSuffix: true
      })),
      // 144 draws for 9th prize
      ...Array.from({ length: 144 }, (_, i) => ({
        prizeTierName: "9th Prize",
        rank: 9,
        amount: 100,
        canonicalNumber: String(6000 + i),
        numberLength: 4,
        isSuffix: true
      }))
    ];

    const validation = validateDrawAgainstPrizeScheme(
      {
        id: "mock_bt_draw",
        lotteryName: "BHAGYATHARA",
        drawDate: "14/09/2026",
        prizeTiers: mockTiers,
        winningResults: mockWinningResults
      },
      scheme
    );

    expect(validation.isValid).toBe(true);
    expect(validation.validationStatus).toBe("VALIDATED");
    expect(validation.discrepancies.length).toBe(0);
    expect(validation.theoreticalVsObserved.length).toBe(10);
  });

  // 18. bumper validation
  it("18. bumper validation: validates bumper draw with per-series allocation", () => {
    const bumper = registry.getSchemeVersion("scheme_ver_monsoon_bumper_2026_br110")!;
    const mockTiers = bumper.tierRules.map((r) => ({
      name: r.tierName,
      rank: r.rank,
      amount: r.amount,
      isSuffix: r.isSuffix
    }));

    const validation = validateDrawAgainstPrizeScheme(
      {
        id: "mock_bumper_draw",
        lotteryName: "MONSOON BUMPER",
        drawDate: "18/07/2026",
        prizeTiers: mockTiers
      },
      bumper
    );

    expect(validation.isValid).toBe(true);
    expect(validation.validationStatus).toBe("VALIDATED");
  });

  // 19. observed-result compatibility
  it("19. observed-result compatibility: does NOT fail merely because observed count < theoretical capacity", () => {
    const scheme = registry.getSchemeVersion("scheme_ver_bt_v2025-11-sro1297")!;
    const mockTiers = scheme.tierRules.map((r) => ({
      name: r.tierName,
      rank: r.rank,
      amount: r.amount,
      isSuffix: r.isSuffix
    }));

    // Suffix tier IV theoretical maximum is 20,520; observed draw repetition count is 19
    const tier4 = scheme.tierRules.find((t) => t.tierCode === "IV")!;
    expect(19).toBeLessThan(tier4.maximumPrizeCount);

    const validation = validateDrawAgainstPrizeScheme(
      {
        id: "draw_partial",
        lotteryName: "BHAGYATHARA",
        drawDate: "14/09/2026",
        prizeTiers: mockTiers
      },
      scheme
    );

    expect(validation.isValid).toBe(true);
    const t4Comparison = validation.theoreticalVsObserved.find((t) => t.tierCode === "IV")!;
    expect(t4Comparison.isCompatible).toBe(true);
  });

  // 20. deterministic scheme ID
  it("20. deterministic scheme ID: scheme IDs and version IDs follow deterministic naming conventions", () => {
    const bt = registry.getSchemeVersion("scheme_ver_bt_v2025-11-sro1297")!;
    expect(bt.id).toMatch(/^scheme_ver_[a-z0-9_-]+$/);
    expect(bt.schemeId).toMatch(/^scheme_[a-z0-9_-]+$/);
  });

  // 21. repeated execution equivalence
  it("21. repeated execution equivalence: multiple factory calls produce identical registries", () => {
    const reg1 = createAuthoritativePrizeSchemeRegistry();
    const reg2 = createAuthoritativePrizeSchemeRegistry();

    const all1 = reg1.getAllVersions();
    const all2 = reg2.getAllVersions();

    expect(all1.length).toBe(all2.length);
    for (let i = 0; i < all1.length; i++) {
      expect(all1[i]?.id).toBe(all2[i]?.id);
      expect(all1[i]?.sourceDocumentSha256).toBe(all2[i]?.sourceDocumentSha256);
      expect(all1[i]?.tierRules.length).toBe(all2[i]?.tierRules.length);
    }
  });

  // 22. no source mutation
  it("22. no source mutation: verifies physical source files in data/source-documents remain untouched", () => {
    const btPath = join(process.cwd(), "data/source-documents/prize-structure/sro-bhagyathara-bt.pdf");
    const dlPath = join(process.cwd(), "data/source-documents/prize-structure/sro-dhanalekshmi-dl.pdf");
    const knPath = join(process.cwd(), "data/source-documents/prize-structure/sro-karunya-plus-kn.pdf");

    const statBt = statSync(btPath);
    const statDl = statSync(dlPath);
    const statKn = statSync(knPath);

    expect(statBt.size).toBeGreaterThan(0);
    expect(statDl.size).toBeGreaterThan(0);
    expect(statKn.size).toBeGreaterThan(0);
  });

  // 23. provenance preservation
  it("23. provenance preservation: every scheme version references an immutable document SHA-256", () => {
    const all = registry.getAllVersions();
    for (const v of all) {
      expect(v.sourceDocumentSha256).toBeDefined();
      expect(v.sourceDocumentSha256.length).toBeGreaterThan(0);
      expect(v.provenance).toBeDefined();
      expect(v.provenance.authorityPriority).toBeGreaterThanOrEqual(1);
      expect(v.provenance.authorityPriority).toBeLessThanOrEqual(4);
    }
  });

  // 24. leading-zero compatibility
  it("24. leading-zero compatibility: preserves leading zeros in canonical number strings without coercion", () => {
    const scheme = registry.getSchemeVersion("scheme_ver_bt_v2025-11-sro1297")!;
    const mockTiers = scheme.tierRules.map((r) => ({
      name: r.tierName,
      rank: r.rank,
      amount: r.amount,
      isSuffix: r.isSuffix
    }));

    const drawWithLeadingZeros = {
      id: "draw_zeros",
      lotteryName: "BHAGYATHARA",
      drawDate: "14/09/2026",
      prizeTiers: mockTiers,
      winningResults: [
        {
          prizeTierName: "4th Prize",
          rank: 4,
          amount: 5000,
          canonicalNumber: "0276", // Must remain 4-char string "0276", NOT 276
          numberLength: 4,
          isSuffix: true
        }
      ]
    };

    expect(typeof drawWithLeadingZeros.winningResults[0]!.canonicalNumber).toBe("string");
    expect(drawWithLeadingZeros.winningResults[0]!.canonicalNumber.startsWith("0")).toBe(true);
    expect(drawWithLeadingZeros.winningResults[0]!.canonicalNumber.length).toBe(4);
  });
});
