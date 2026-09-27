/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 7A.6 — Canonical Dev Verifier: Prize Structure & Scheme Registry Integrity
 *
 * Verifies:
 * 1. Authoritative scheme sources loaded with strict provenance & no fake SHAs
 * 2. Official vs Observed Scheme Archetype distinction
 * 3. Total Prize Reconciliation across all schemes:
 *    sum(tier amount * maxCount) + consolation = totalPrizeAmount
 * 4. Bumper structural validation:
 *    COMMON_TO_ALL_SERIES, ONE_PER_SERIES, N_PER_SERIES, consolation matching
 * 5. Full 98-draw historical corpus resolution and validation:
 *    97 Official Schemes + 1 Observed Archetype = 98 Resolved, 0 Unresolved, 98 Validated
 * 6. Explicit UNRESOLVED handling for missing/unregistered lottery schemes
 * 7. Six canonical September baseline draws resolution behavior
 * 8. Physical source SRO PDF immutability & SHA-256 verification
 * 9. Deterministic IDs and repeated execution equivalence
 * 10. Descriptive historical research invariant
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createAuthoritativePrizeSchemeRegistry,
  validateDrawAgainstPrizeScheme,
  reconcilePrizeSchemeTotal,
  isValidSha256Hex,
  validateSchemeProvenanceIntegrity,
  hasOfficialGazetteSro,
  BT_SRO_SHA256,
  DL_SRO_SHA256,
  KN_SRO_SHA256,
  SS_SRO_SHA256,
  SK_SRO_SHA256,
  KR_SRO_SHA256,
  SM_SRO_SHA256,
  MONSOON_BUMPER_SRO_SHA256,
  THIRUVONAM_BUMPER_RESULT_SHA256
} from "@kerala-lottery/domain";
import {
  PdfPageExtractorService,
  DocumentSemanticSegmentationService,
  LotteryEntityExtractorService,
  computeSha256
} from "@kerala-lottery/documents";

async function verifyMilestone7A6Correction() {
  console.log("============================================================");
  console.log("KERALA STATE LOTTERY INTELLIGENCE PLATFORM");
  console.log("MILESTONE 7A.6-CORRECTION: PRIZE SCHEME REGISTRY INTEGRITY");
  console.log("Branch: develop ONLY");
  console.log("Scientific Boundary: DESCRIPTIVE HISTORICAL RESEARCH ONLY");
  console.log("============================================================\n");

  const registry = createAuthoritativePrizeSchemeRegistry();

  // 1. Authoritative Scheme Sources & Provenance Integrity
  console.log("1. Verifying Authoritative Scheme Sources & Provenance Integrity...");
  const versions = registry.getAllVersions();
  console.log(`   ✓ Loaded ${versions.length} scheme versions into authoritative registry.`);

  for (const v of versions) {
    if (!v.id || !v.schemeId || !v.lotteryCode || !v.version) {
      throw new Error(`Scheme version missing mandatory identifiers: ${JSON.stringify(v.id)}`);
    }
    if (v.descriptiveOnly !== true) {
      throw new Error(`Scheme version ${v.id} violates descriptive-only invariant`);
    }

    // Provenance integrity validator: checks no fake SHA strings, correct types
    const integrity = validateSchemeProvenanceIntegrity(v);
    if (!integrity.isValid) {
      throw new Error(`Provenance integrity failure for ${v.id}: ${integrity.errors.join("; ")}`);
    }

    if (v.sourceDocumentSha256 !== null && !isValidSha256Hex(v.sourceDocumentSha256)) {
      throw new Error(`Invalid sourceDocumentSha256 '${v.sourceDocumentSha256}' in ${v.id}. Must be 64-char hex or null.`);
    }

    console.log(
      `   - [${v.authorityLevel.padEnd(25)}] [${v.schemeType.padEnd(6)}] ${v.lotteryName} (${v.version}) -> Priority ${v.provenance.authorityPriority}, SHA: ${v.sourceDocumentSha256 ? v.sourceDocumentSha256.substring(0, 12) + "..." : "NULL (UNAVAILABLE)"}`
    );
  }
  console.log("   ✓ All scheme versions pass strict provenance integrity (0 placeholder SHAs).");

  // 2. Physical SRO Source File Verification (All 8 Ingested Gazette SROs)
  console.log("\n2. Verifying Physical Source Gazette S.R.O. Documents & SHAs...");
  const sroFiles = [
    { name: "Bhagyathara (BT)", path: "data/source-documents/prize-structure/sro-bhagyathara-bt.pdf", expectedSha: BT_SRO_SHA256, sro: "S.R.O. 1297/2025" },
    { name: "Dhanalekshmi (DL)", path: "data/source-documents/prize-structure/sro-dhanalekshmi-dl.pdf", expectedSha: DL_SRO_SHA256, sro: "S.R.O. 1296/2025" },
    { name: "Karunya Plus (KN)", path: "data/source-documents/prize-structure/sro-karunya-plus-kn.pdf", expectedSha: KN_SRO_SHA256, sro: "S.R.O. 1294/2025" },
    { name: "Sthree-Sakthi (SS)", path: "data/source-documents/prize-structure/sro-sthree-sakthi-ss.pdf", expectedSha: SS_SRO_SHA256, sro: "S.R.O. 1292/2025" },
    { name: "Suvarna Keralam (SK)", path: "data/source-documents/prize-structure/sro-suvarna-keralam-sk.pdf", expectedSha: SK_SRO_SHA256, sro: "S.R.O. 1291/2025" },
    { name: "Karunya (KR)", path: "data/source-documents/prize-structure/sro-karunya-kr.pdf", expectedSha: KR_SRO_SHA256, sro: "S.R.O. 1295/2025" },
    { name: "Samrudhi (SM)", path: "data/source-documents/prize-structure/sro-samrudhi-sm.pdf", expectedSha: SM_SRO_SHA256, sro: "S.R.O. 1293/2025" },
    { name: "Monsoon Bumper (BR-110)", path: "data/source-documents/prize-structure/sro-monsoon-bumper-br110.pdf", expectedSha: MONSOON_BUMPER_SRO_SHA256, sro: "S.R.O. 526/2026" }
  ];

  for (const item of sroFiles) {
    const bytes = readFileSync(join(process.cwd(), item.path));
    const computedSha = computeSha256(new Uint8Array(bytes));
    if (computedSha !== item.expectedSha) {
      throw new Error(`SHA mismatch for ${item.name} (${item.path}): expected ${item.expectedSha}, got ${computedSha}`);
    }
    console.log(`   ✓ [${item.sro}] ${item.name.padEnd(24)} -> SHA: ${computedSha.substring(0, 16)}... (VERIFIED)`);
  }

  // 3. Official vs Observed Scheme Classification
  console.log("\n3. Verifying Official vs Observed Scheme Classification...");
  const bt = registry.getSchemeVersion("scheme_ver_bt_v2025-11-sro1297")!;
  const ss = registry.getSchemeVersion("scheme_ver_ss_v2025-11-sro1292")!;
  const monsoon = registry.getSchemeVersion("scheme_ver_monsoon_bumper_2026_br110")!;
  const onam = registry.getSchemeVersion("scheme_ver_thiruvonam_bumper_2026_br111")!;

  if (bt.authorityLevel !== "OFFICIAL_SCHEME" || ss.authorityLevel !== "OFFICIAL_SCHEME") {
    throw new Error("Weekly lotteries with Gazette SROs must have authorityLevel = 'OFFICIAL_SCHEME'");
  }
  if (!hasOfficialGazetteSro(bt.lotteryCode) || !hasOfficialGazetteSro(monsoon.lotteryCode)) {
    throw new Error("BT and Monsoon Bumper must be identified as having official Gazette SRO");
  }
  if (hasOfficialGazetteSro(onam.lotteryCode)) {
    throw new Error("Thiruvonam Bumper archetype must not be identified as having official Gazette SRO");
  }
  if (monsoon.authorityLevel !== "OFFICIAL_SCHEME") {
    throw new Error("Monsoon Bumper BR-110 with S.R.O. 526/2026 must have authorityLevel = 'OFFICIAL_SCHEME'");
  }
  if (onam.authorityLevel !== "OBSERVED_SCHEME_ARCHETYPE") {
    throw new Error("Thiruvonam Bumper BR-111 derived from result PDF must have authorityLevel = 'OBSERVED_SCHEME_ARCHETYPE'");
  }
  if (onam.provenance.sourceType !== "RESULT_PDF" || onam.provenance.authorityPriority !== 3) {
    throw new Error("Thiruvonam Bumper archetype must not claim Gazette provenance");
  }
  if (onam.provenance.documentSha256 !== THIRUVONAM_BUMPER_RESULT_SHA256) {
    throw new Error("Thiruvonam Bumper SHA does not match expected result PDF SHA");
  }
  console.log(`   ✓ Monsoon Bumper (BR-110) correctly classified as OFFICIAL_SCHEME (S.R.O. 526/2026).`);
  console.log(`   ✓ Thiruvonam Bumper (BR-111) correctly classified as OBSERVED_SCHEME_ARCHETYPE (RESULT_PDF).`);

  // 4. Total Prize Reconciliation Across All Registered Schemes
  console.log("\n4. Verifying Total Prize Reconciliation Across All Schemes...");
  const activeSchemes = versions.filter((v) => v.status === "ACTIVE");

  for (const s of activeSchemes) {
    const rec = reconcilePrizeSchemeTotal(s);
    if (!rec.isReconciled) {
      throw new Error(
        `Total prize reconciliation failed for ${s.lotteryName} (${s.id}): calculated ${rec.calculatedTotal}, expected ${rec.expectedTotal}, diff ${rec.difference}`
      );
    }
    console.log(
      `   ✓ ${s.lotteryName.padEnd(32)}: sum(tier*count) = ₹${rec.calculatedTotal.toLocaleString("en-IN")} === scheme.totalPrizeAmount (Diff: 0)`
    );
  }

  // Explicit check on the corrected bumper values
  if (monsoon.totalPrizeAmount !== 308525000) {
    throw new Error(`Monsoon Bumper totalPrizeAmount must be ₹30,85,25,000, got ${monsoon.totalPrizeAmount}`);
  }
  if (onam.totalPrizeAmount !== 1255400000) {
    throw new Error(`Thiruvonam Bumper totalPrizeAmount must be ₹1,25,54,00,000, got ${onam.totalPrizeAmount}`);
  }
  console.log("   ✓ Monsoon Bumper reconciled: ₹30,85,25,000 (G.O.(P) No. 58/2026/TAXES, S.R.O. 526/2026).");
  console.log("   ✓ Thiruvonam Bumper reconciled: ₹1,25,54,00,000 (all 9 tiers + consolation).");

  // 5. Unresolved Scheme Handling (Explicit UNRESOLVED marking)
  console.log("\n5. Verifying Unresolved Scheme Handling...");
  const unresolvedRes = registry.resolveSchemeForDraw({
    lotteryName: "NON_EXISTENT_LOTTERY",
    drawDate: "2026-09-14"
  });
  if (unresolvedRes.status !== "SCHEME_NOT_FOUND") {
    throw new Error(`Expected SCHEME_NOT_FOUND for unregistered lottery, got ${unresolvedRes.status}`);
  }
  if (!unresolvedRes.resolutionEvidence.includes("UNRESOLVED")) {
    throw new Error(`Resolution evidence must explicitly indicate UNRESOLVED: '${unresolvedRes.resolutionEvidence}'`);
  }
  console.log(`   ✓ Unregistered lotteries cleanly return SCHEME_NOT_FOUND with explicit UNRESOLVED evidence.`);

  // 6. Historical Corpus Validation (98 Draws)
  console.log("\n6. Running 98-Draw Historical Corpus Against Prize Scheme Registry...");
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
  let officialSchemesValidatedCount = 0;
  let observedArchetypeCompatibleCount = 0;
  let schemeMismatchCount = 0;
  let officialSchemeCount = 0;
  let observedArchetypeCount = 0;

  const resolutionBreakdown = new Map<string, { resolved: number; notFound: number; authority: string }>();

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
      resolutionBreakdown.set(lotteryName, { resolved: 0, notFound: 0, authority: "UNKNOWN" });
    }

    const resolution = registry.resolveSchemeForDraw({
      lotteryName,
      drawDate
    });

    if (resolution.status === "SCHEME_RESOLVED") {
      schemeResolvedCount++;
      resolutionBreakdown.get(lotteryName)!.resolved++;
      resolutionBreakdown.get(lotteryName)!.authority = resolution.authorityLevel || "UNKNOWN";

      if (resolution.authorityLevel === "OFFICIAL_SCHEME") {
        officialSchemeCount++;
      } else if (resolution.authorityLevel === "OBSERVED_SCHEME_ARCHETYPE") {
        observedArchetypeCount++;
      }

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
        if (resolution.authorityLevel === "OFFICIAL_SCHEME") {
          officialSchemesValidatedCount++;
        } else {
          observedArchetypeCompatibleCount++;
        }
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
  console.log(`TOTAL DRAWS:                     ${totalDraws}`);
  console.log(`SCHEME RESOLVED:                 ${schemeResolvedCount} (100%)`);
  console.log(`  - OFFICIAL_SCHEME:             ${officialSchemeCount}`);
  console.log(`  - OBSERVED_SCHEME_ARCHETYPE:   ${observedArchetypeCount}`);
  console.log(`SCHEME NOT FOUND:                ${schemeNotFoundCount}`);
  console.log(`SCHEME AMBIGUOUS:                ${schemeAmbiguousCount}`);
  console.log(`OFFICIAL SCHEMES VALIDATED:      ${officialSchemesValidatedCount}`);
  console.log(`OBSERVED SCHEME ARCHETYPE COMPATIBLE: ${observedArchetypeCompatibleCount}`);
  console.log(`SCHEME MISMATCH:                 ${schemeMismatchCount}`);
  console.log("------------------------------------------------------------");
  console.log("Lottery Resolution Breakdown:");
  for (const [lottery, info] of resolutionBreakdown.entries()) {
    console.log(
      `  - ${lottery.padEnd(30)} Resolved: ${String(info.resolved).padStart(2)}, Not Found: ${String(info.notFound).padStart(2)} [${info.authority}]`
    );
  }
  console.log("============================================================\n");

  // Invariant checks on the 98 draws:
  if (totalDraws !== 98) throw new Error(`Expected 98 draws, got ${totalDraws}`);
  if (schemeResolvedCount !== 98) {
    throw new Error(`Expected all 98 draws to resolve to schemes, got ${schemeResolvedCount}`);
  }
  if (officialSchemeCount !== 97) {
    throw new Error(`Expected exactly 97 draws with OFFICIAL_SCHEME (7 weekly lotteries + Monsoon Bumper), got ${officialSchemeCount}`);
  }
  if (observedArchetypeCount !== 1) {
    throw new Error(`Expected exactly 1 draw with OBSERVED_SCHEME_ARCHETYPE (Thiruvonam Bumper), got ${observedArchetypeCount}`);
  }
  if (schemeNotFoundCount !== 0) {
    throw new Error(`Expected 0 not-found draws in the known 98-draw corpus, got ${schemeNotFoundCount}`);
  }
  if (schemeAmbiguousCount !== 0) {
    throw new Error(`Expected 0 ambiguous draws, got ${schemeAmbiguousCount}`);
  }
  if (officialSchemesValidatedCount !== 97) {
    throw new Error(`Expected exactly 97 official schemes validated, got ${officialSchemesValidatedCount}`);
  }
  if (observedArchetypeCompatibleCount !== 1) {
    throw new Error(`Expected exactly 1 observed scheme archetype compatible, got ${observedArchetypeCompatibleCount}`);
  }
  if (schemeMismatchCount !== 0) {
    throw new Error(`Expected 0 scheme mismatches, got ${schemeMismatchCount}`);
  }

  // 7. Canonical Baseline Draws (September 2026)
  console.log("7. Verifying Six Canonical Baseline Draws (September 2026)...");
  const baselines = [
    { date: "12/09/2026", lottery: "KARUNYA", id: "KR-768th", versionId: "scheme_ver_kr_v2025-11-sro1295" },
    { date: "13/09/2026", lottery: "SAMRUDHI", id: "SM-72nd", versionId: "scheme_ver_sm_v2025-11-sro1293" },
    { date: "14/09/2026", lottery: "BHAGYATHARA", id: "BT-71st", versionId: "scheme_ver_bt_v2025-11-sro1297" },
    { date: "15/09/2026", lottery: "STHREE-SAKTHI", id: "SS-537th", versionId: "scheme_ver_ss_v2025-11-sro1292" },
    { date: "16/09/2026", lottery: "DHANALEKSHMI", id: "DL-69th", versionId: "scheme_ver_dl_v2025-11-sro1296" },
    { date: "17/09/2026", lottery: "KARUNYA PLUS", id: "KN-641st", versionId: "scheme_ver_kn_v2025-11-sro1294" }
  ];

  for (const b of baselines) {
    const res = registry.resolveSchemeForDraw({
      lotteryName: b.lottery,
      drawDate: b.date
    });

    if (res.status !== "SCHEME_RESOLVED") {
      throw new Error(`Baseline draw ${b.id} (${b.lottery}) expected SCHEME_RESOLVED, got ${res.status}`);
    }
    if (res.schemeVersion?.id !== b.versionId) {
      throw new Error(`Baseline draw ${b.id} resolved to unexpected version ${res.schemeVersion?.id}, expected ${b.versionId}`);
    }
    if (res.authorityLevel !== "OFFICIAL_SCHEME") {
      throw new Error(`Baseline draw ${b.id} must have authorityLevel OFFICIAL_SCHEME`);
    }
    console.log(
      `   ✓ Baseline ${b.id} (${b.date}, ${b.lottery.padEnd(14)}) -> Resolved to ${res.schemeVersion.id} [${res.authorityLevel}]`
    );
  }

  // 8. Deterministic IDs & Repeated Execution Equivalence
  console.log("\n8. Verifying Determinism & Stability...");
  const reg2 = createAuthoritativePrizeSchemeRegistry();
  const v1List = registry.getAllVersions();
  const v2List = reg2.getAllVersions();
  if (v1List.length !== v2List.length) throw new Error("Repeated execution produced different version counts");
  for (let i = 0; i < v1List.length; i++) {
    if (v1List[i]?.id !== v2List[i]?.id) throw new Error("Registry version ID instability detected");
  }
  console.log(`   ✓ Registry generation is 100% deterministic and equivalent across repeated executions.`);

  console.log("\n============================================================");
  console.log("MILESTONE 7A.6-CORRECTION: ALL GATES PASSED [100% SUCCESS]");
  console.log("============================================================\n");
}

verifyMilestone7A6Correction().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
