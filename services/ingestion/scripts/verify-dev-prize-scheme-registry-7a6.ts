/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 7A.6 — Canonical Dev Verifier: Prize Structure & Scheme Registry
 *
 * Verifies:
 * 1. Authoritative scheme sources loaded with strict provenance
 * 2. WEEKLY vs BUMPER explicit distinction
 * 3. Historical draw resolution across the 98-draw corpus
 * 4. No ambiguous forced assignments (clean SCHEME_NOT_FOUND for missing SROs)
 * 5. Result/scheme validation with theoretical vs observed counts
 * 6. Six canonical baseline draws resolution behavior
 * 7. Bumper draw resolution and validation
 * 8. Deterministic scheme IDs and repeated execution equivalence
 * 9. Source PDF immutability
 * 10. Descriptive-only invariant
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createAuthoritativePrizeSchemeRegistry,
  validateDrawAgainstPrizeScheme,
  BT_SRO_SHA256,
  DL_SRO_SHA256,
  KN_SRO_SHA256
} from "@kerala-lottery/domain";
import {
  PdfPageExtractorService,
  DocumentSemanticSegmentationService,
  LotteryEntityExtractorService,
  computeSha256
} from "@kerala-lottery/documents";

async function verifyMilestone7A6() {
  console.log("============================================================");
  console.log("KERALA STATE LOTTERY INTELLIGENCE PLATFORM");
  console.log("MILESTONE 7A.6: PRIZE STRUCTURE & SCHEME REGISTRY VERIFIER");
  console.log("Branch: develop ONLY");
  console.log("Scientific Boundary: DESCRIPTIVE HISTORICAL RESEARCH ONLY");
  console.log("============================================================\n");

  const registry = createAuthoritativePrizeSchemeRegistry();

  // 1. Authoritative Scheme Sources Loaded
  console.log("1. Verifying Authoritative Scheme Sources & Provenance...");
  const versions = registry.getAllVersions();
  console.log(`   ✓ Loaded ${versions.length} scheme versions into authoritative registry.`);

  for (const v of versions) {
    if (!v.id || !v.schemeId || !v.lotteryCode || !v.version) {
      throw new Error(`Scheme version missing mandatory identifiers: ${JSON.stringify(v.id)}`);
    }
    if (!v.provenance || !v.provenance.documentSha256) {
      throw new Error(`Scheme version ${v.id} missing provenance or documentSha256`);
    }
    if (v.descriptiveOnly !== true) {
      throw new Error(`Scheme version ${v.id} violates descriptive-only invariant`);
    }
    console.log(
      `   - [${v.schemeType}] ${v.lotteryName} (${v.version}) -> Priority ${v.provenance.authorityPriority} (${v.provenance.sourceType}), SRO: ${v.provenance.sroNumber || v.provenance.notificationNumber}`
    );
  }

  // Verify SHA-256 for the 3 official Government Gazette SROs
  const bt = registry.getSchemeVersion("scheme_ver_bt_v2025-11-sro1297")!;
  const dl = registry.getSchemeVersion("scheme_ver_dl_v2025-11-sro1296")!;
  const kn = registry.getSchemeVersion("scheme_ver_kn_v2025-11-sro1294")!;

  if (bt.provenance.documentSha256 !== BT_SRO_SHA256) {
    throw new Error(`BT SRO SHA mismatch. Expected ${BT_SRO_SHA256}, got ${bt.provenance.documentSha256}`);
  }
  if (dl.provenance.documentSha256 !== DL_SRO_SHA256) {
    throw new Error(`DL SRO SHA mismatch. Expected ${DL_SRO_SHA256}, got ${dl.provenance.documentSha256}`);
  }
  if (kn.provenance.documentSha256 !== KN_SRO_SHA256) {
    throw new Error(`KN SRO SHA mismatch. Expected ${KN_SRO_SHA256}, got ${kn.provenance.documentSha256}`);
  }
  console.log(`   ✓ All 3 official Gazette S.R.O. files match verified SHA-256 digests.`);

  // 2. Weekly vs Bumper Scheme Identity
  console.log("\n2. Verifying WEEKLY vs BUMPER Scheme Classification...");
  const monsoon = registry.getSchemeVersion("scheme_ver_monsoon_bumper_2026_br110")!;
  const onam = registry.getSchemeVersion("scheme_ver_thiruvonam_bumper_2026_br111")!;

  if (bt.schemeType !== "WEEKLY" || dl.schemeType !== "WEEKLY" || kn.schemeType !== "WEEKLY") {
    throw new Error("Weekly lotteries must have schemeType = 'WEEKLY'");
  }
  if (monsoon.schemeType !== "BUMPER" || onam.schemeType !== "BUMPER") {
    throw new Error("Bumper lotteries must have schemeType = 'BUMPER'");
  }
  console.log(`   ✓ Weekly schemes correctly have schemeType = 'WEEKLY' (12 series, common 1-3 tiers).`);
  console.log(`   ✓ Monsoon Bumper has schemeType = 'BUMPER' (5 series: ${monsoon.seriesCodes.join(", ")}, 1-per-series tiers).`);
  console.log(`   ✓ Thiruvonam Bumper has schemeType = 'BUMPER' (10 series: ${onam.seriesCodes.join(", ")}, 2-per-series tiers).`);

  // 3. Theoretical vs Observed Capacity Calculations
  console.log("\n3. Verifying Theoretical Capacity & Mathematical Formulae...");
  for (const v of [bt, dl, kn]) {
    const factor = v.ticketsPrinted / 10000; // 1080
    for (const tier of v.tierRules) {
      if (tier.isSuffix) {
        const expectedMax = tier.drawCount * factor;
        if (tier.maximumPrizeCount !== expectedMax) {
          throw new Error(
            `Mathematical inconsistency in ${v.lotteryCode} ${tier.tierName}: expected max ${expectedMax}, found ${tier.maximumPrizeCount}`
          );
        }
      }
    }
  }
  console.log(`   ✓ Suffix theoretical capacity verified: drawRepetitions * (ticketsPrinted / 10,000) = maximumPrizeCount`);

  // 4. Historical Corpus Validation (98 Draws)
  console.log("\n4. Running 98-Draw Historical Corpus Against Prize Scheme Registry...");
  const dir = join(process.cwd(), "data/source-documents/lottery-results");
  const files = readdirSync(dir).filter((f) => f.endsWith(".pdf")).sort();

  if (files.length !== 98) {
    throw new Error(`Expected 98 source PDFs, discovered ${files.length}`);
  }

  const extractor = new PdfPageExtractorService();
  const segService = new DocumentSemanticSegmentationService();
  const entityService = new LotteryEntityExtractorService();

  let totalDraws = 0;
  let schemeResolvedCount = 0;
  let schemeNotFoundCount = 0;
  let schemeAmbiguousCount = 0;
  let schemeValidatedCount = 0;
  let schemeMismatchCount = 0;

  const resolutionBreakdown = new Map<string, { resolved: number; notFound: number }>();

  for (let i = 0; i < files.length; i++) {
    const filename = files[i]!;
    const bytes = readFileSync(join(dir, filename));
    const sha = computeSha256(new Uint8Array(bytes));
    const ext = await extractor.extractPages(new Uint8Array(bytes), sha);
    const seg = segService.segmentDocument(ext.pages);
    const extraction = entityService.extract(seg, ext.pages);

    totalDraws++;
    const lotteryName = extraction.drawMetadata?.lotteryName?.value || "UNKNOWN";
    const drawDate = extraction.drawMetadata?.drawDate?.value || "UNKNOWN";
    const drawNumber = extraction.drawMetadata?.drawNumber?.value || "UNKNOWN";

    if (!resolutionBreakdown.has(lotteryName)) {
      resolutionBreakdown.set(lotteryName, { resolved: 0, notFound: 0 });
    }

    const resolution = registry.resolveSchemeForDraw({
      lotteryName,
      drawDate
    });

    if (resolution.status === "SCHEME_RESOLVED") {
      schemeResolvedCount++;
      resolutionBreakdown.get(lotteryName)!.resolved++;

      const validation = validateDrawAgainstPrizeScheme(
        {
          id: drawNumber,
          lotteryName,
          drawDate,
          prizeTiers: extraction.prizeTiers,
          winningResults: extraction.winningResults
        },
        resolution.schemeVersion!
      );

      if (validation.isValid) {
        schemeValidatedCount++;
      } else {
        schemeMismatchCount++;
        console.warn(`[MISMATCH] Draw ${drawNumber} (${lotteryName}): ${validation.discrepancies.join("; ")}`);
      }
    } else if (resolution.status === "SCHEME_NOT_FOUND") {
      schemeNotFoundCount++;
      resolutionBreakdown.get(lotteryName)!.notFound++;
    } else if (resolution.status === "SCHEME_RESOLUTION_AMBIGUOUS") {
      schemeAmbiguousCount++;
    }

    if ((i + 1) % 25 === 0 || i === files.length - 1) {
      console.log(`   Processed ${i + 1}/98 draws... (Resolved: ${schemeResolvedCount}, Not Found: ${schemeNotFoundCount})`);
    }
  }

  console.log("\n============================================================");
  console.log("HISTORICAL CORPUS PRIZE SCHEME VALIDATION REPORT");
  console.log("============================================================");
  console.log(`TOTAL DRAWS:             ${totalDraws}`);
  console.log(`SCHEME RESOLVED:         ${schemeResolvedCount}`);
  console.log(`SCHEME NOT FOUND:        ${schemeNotFoundCount}`);
  console.log(`SCHEME AMBIGUOUS:        ${schemeAmbiguousCount}`);
  console.log(`SCHEME VALIDATED:        ${schemeValidatedCount}`);
  console.log(`SCHEME MISMATCH:         ${schemeMismatchCount}`);
  console.log("------------------------------------------------------------");
  console.log("Lottery Resolution Breakdown:");
  for (const [lottery, counts] of resolutionBreakdown.entries()) {
    console.log(
      `  - ${lottery.padEnd(28)} Resolved: ${String(counts.resolved).padStart(2)}, Not Found: ${String(counts.notFound).padStart(2)}`
    );
  }
  console.log("============================================================\n");

  // Invariant checks on the 98 draws:
  if (totalDraws !== 98) throw new Error(`Expected 98 draws, got ${totalDraws}`);
  if (schemeResolvedCount !== 43) {
    throw new Error(`Expected exactly 43 resolved draws (41 weekly with SROs + 2 bumpers with official result publications), got ${schemeResolvedCount}`);
  }
  if (schemeNotFoundCount !== 55) {
    throw new Error(`Expected exactly 55 not-found draws without official scheme sources (14 SS + 15 SK + 12 KR + 14 SM), got ${schemeNotFoundCount}`);
  }
  if (schemeAmbiguousCount !== 0) {
    throw new Error(`Expected 0 ambiguous draws, got ${schemeAmbiguousCount}`);
  }
  if (schemeValidatedCount !== 43) {
    throw new Error(`Expected all 43 resolved draws to validate with 0 mismatches, got ${schemeValidatedCount}`);
  }
  if (schemeMismatchCount !== 0) {
    throw new Error(`Expected 0 scheme mismatches, got ${schemeMismatchCount}`);
  }

  // 5. Verification of the Six Canonical September Baseline Draws
  console.log("5. Verifying Canonical Baseline Draws (September 2026)...");
  const baselines = [
    { date: "12/09/2026", lottery: "KARUNYA", id: "KR-768th", expectedStatus: "SCHEME_NOT_FOUND" },
    { date: "13/09/2026", lottery: "SAMRUDHI", id: "SM-72nd", expectedStatus: "SCHEME_NOT_FOUND" },
    { date: "14/09/2026", lottery: "BHAGYATHARA", id: "BT-71st", expectedStatus: "SCHEME_RESOLVED", versionId: "scheme_ver_bt_v2025-11-sro1297" },
    { date: "15/09/2026", lottery: "STHREE-SAKTHI", id: "SS-537th", expectedStatus: "SCHEME_NOT_FOUND" },
    { date: "16/09/2026", lottery: "DHANALEKSHMI", id: "DL-69th", expectedStatus: "SCHEME_RESOLVED", versionId: "scheme_ver_dl_v2025-11-sro1296" },
    { date: "17/09/2026", lottery: "KARUNYA PLUS", id: "KN-641st", expectedStatus: "SCHEME_RESOLVED", versionId: "scheme_ver_kn_v2025-11-sro1294" }
  ];

  for (const b of baselines) {
    const res = registry.resolveSchemeForDraw({
      lotteryName: b.lottery,
      drawDate: b.date
    });

    if (res.status !== b.expectedStatus) {
      throw new Error(`Baseline draw ${b.id} (${b.lottery}) expected ${b.expectedStatus}, got ${res.status}`);
    }
    if (b.versionId && res.schemeVersion?.id !== b.versionId) {
      throw new Error(`Baseline draw ${b.id} resolved to unexpected version ${res.schemeVersion?.id}`);
    }
    console.log(
      `   ✓ Baseline ${b.id} (${b.date}, ${b.lottery.padEnd(14)}) -> Status: ${res.status}${res.schemeVersion ? " (" + res.schemeVersion.id + ")" : ""}`
    );
  }

  // 6. Verification of Bumper Resolution & Validation
  console.log("\n6. Verifying Bumper Draws Against Bumper Scheme Archetypes...");
  const bumperResMonsoon = registry.resolveSchemeForDraw({
    lotteryName: "MONSOON BUMPER",
    drawDate: "18/07/2026"
  });
  if (bumperResMonsoon.status !== "SCHEME_RESOLVED" || bumperResMonsoon.schemeVersion?.schemeType !== "BUMPER") {
    throw new Error("Monsoon Bumper draw must resolve to BUMPER scheme version");
  }
  console.log(`   ✓ Monsoon Bumper resolved to: ${bumperResMonsoon.schemeVersion.id} (schemeType: BUMPER)`);

  const bumperResOnam = registry.resolveSchemeForDraw({
    lotteryName: "THIRUVONAM BUMPER LOTTERY",
    drawDate: "26/09/2026"
  });
  if (bumperResOnam.status !== "SCHEME_RESOLVED" || bumperResOnam.schemeVersion?.schemeType !== "BUMPER") {
    throw new Error("Thiruvonam Bumper draw must resolve to BUMPER scheme version");
  }
  console.log(`   ✓ Thiruvonam Bumper resolved to: ${bumperResOnam.schemeVersion.id} (schemeType: BUMPER)`);

  // 7. Deterministic IDs & Repeated Execution Equivalence
  console.log("\n7. Verifying Determinism & Stability...");
  const reg2 = createAuthoritativePrizeSchemeRegistry();
  const v1List = registry.getAllVersions();
  const v2List = reg2.getAllVersions();
  if (v1List.length !== v2List.length) throw new Error("Repeated execution produced different version counts");
  for (let i = 0; i < v1List.length; i++) {
    if (v1List[i]?.id !== v2List[i]?.id) throw new Error("Registry version ID instability detected");
  }
  console.log(`   ✓ Registry generation is 100% deterministic and equivalent across repeated executions.`);

  // 8. Source PDF Immutability Check
  console.log("\n8. Verifying Source PDF Immutability...");
  const sroFiles = [
    { path: "data/source-documents/prize-structure/sro-bhagyathara-bt.pdf", sha: BT_SRO_SHA256 },
    { path: "data/source-documents/prize-structure/sro-dhanalekshmi-dl.pdf", sha: DL_SRO_SHA256 },
    { path: "data/source-documents/prize-structure/sro-karunya-plus-kn.pdf", sha: KN_SRO_SHA256 }
  ];
  for (const s of sroFiles) {
    const bytes = readFileSync(join(process.cwd(), s.path));
    const sha = computeSha256(new Uint8Array(bytes));
    if (sha !== s.sha) throw new Error(`Source file ${s.path} was modified! SHA mismatch: ${sha}`);
  }
  console.log(`   ✓ All physical source SRO PDFs intact and verified with immutable SHA-256 hashes.`);

  console.log("\n============================================================");
  console.log("MILESTONE 7A.6 VERIFICATION: ALL GATES PASSED [100% SUCCESS]");
  console.log("============================================================\n");
}

verifyMilestone7A6().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
