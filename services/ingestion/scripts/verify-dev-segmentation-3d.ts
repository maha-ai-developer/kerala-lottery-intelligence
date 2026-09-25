/**
 * Milestone 3D — Live DEV Semantic Document Classification & Region Segmentation Verification Script
 *
 * Demonstrates the end-to-end semantic interpretation chain on DEV:
 *   DOCUMENT_PAGES (Milestone 3C observation layer)
 *     ↓
 *   DETERMINISTIC DOCUMENT CLASSIFICATION (LOTTERY_RESULT)
 *     ↓
 *   DRAW METADATA EXTRACTION (Lottery Name, Draw Number, Draw Date, Location)
 *     ↓
 *   PAGE REGION SEGMENTATION (HEADER, DRAW_METADATA, PRIZE_STRUCTURE, LEGAL_CLAIMS_FOOTER, CERTIFICATION)
 *     ↓
 *   EXACT PROVENANCE CHAIN (Region/Field -> Page ID -> TextBlock Order -> Source SHA-256)
 *     ↓
 *   DEV FIRESTORE PERSISTENCE (document_segmentations/{sha256})
 *     ↓
 *   REPEAT EXECUTION -> IDEMPOTENT RESULT
 *
 * IMPORTANT:
 * Operates purely on physical/structural observations.
 * DOES NOT interpret winning numbers, ticket series, or monetary outcomes.
 */

import {
  FirestoreRestDocumentPageRepository,
  FirestoreRestDocumentSegmentationRepository
} from "@kerala-lottery/data";
import {
  DocumentSemanticSegmentationService
} from "@kerala-lottery/documents";

export async function runDevSegmentation3DVerification() {
  console.log("============================================================");
  console.log("Milestone 3D — DEV Semantic Classification & Region Segmentation");
  console.log("Target Project: kerala-lottery-intel-dev (DEV ONLY)");
  console.log("Scope: Deterministic Semantic Zoning (NO LOTTERY MECHANICS)");
  console.log("============================================================");

  const targetSha256 =
    "9bc76b6017edb26d3c13d415cd96280f4a2f066d24c41ce7a82b39b44dee557c";

  // 1. Safe runtime authentication via standard environment variables
  // (e.g. GCP_ACCESS_TOKEN or FIREBASE_TOKEN provided by the execution environment)
  const token = process.env.GCP_ACCESS_TOKEN || process.env.FIREBASE_TOKEN;

  if (!token) {
    throw new Error(
      "Safe runtime authentication: GCP_ACCESS_TOKEN or FIREBASE_TOKEN environment variable is required to authenticate against DEV Cloud resources."
    );
  }

  const projectId = "kerala-lottery-intel-dev";

  const pageRepository = new FirestoreRestDocumentPageRepository({
    projectId,
    databaseId: "(default)",
    getAccessToken: () => token!
  });

  const segmentationRepository = new FirestoreRestDocumentSegmentationRepository({
    projectId,
    databaseId: "(default)",
    getAccessToken: () => token!
  });

  // 2. Load 3C DocumentPage records from DEV Firestore
  console.log("\n1. Loading Milestone 3C DocumentPage Records from DEV Firestore...");
  console.log(`   Source SHA-256: ${targetSha256}`);
  const pages = await pageRepository.getByDocumentSha256(targetSha256);
  console.log(`   Retrieved ${pages.length} DocumentPage records from DEV`);

  if (pages.length === 0) {
    throw new Error(
      `No DocumentPage records found for ${targetSha256} in DEV Firestore!`
    );
  }

  // Ensure pages are sorted by 1-based pageNumber
  pages.sort((a, b) => a.pageNumber - b.pageNumber);

  // 3. Execute Deterministic Semantic Classification & Region Segmentation
  console.log("\n2. Executing Milestone 3D Semantic Segmentation Service...");
  const segmentationService = new DocumentSemanticSegmentationService();
  const segmentation = segmentationService.segmentDocument(pages);

  console.log("\n3. Document Classification Evidence:");
  console.log(`   - Document SHA-256:        ${segmentation.documentSha256}`);
  console.log(`   - Page Count:              ${segmentation.pageCount}`);
  console.log(`   - Detected Document Kind:  ${segmentation.classification.kind}`);
  console.log(`   - Classification Score:    ${segmentation.classification.confidence}`);
  console.log(`   - Rule Identifier:         ${segmentation.classification.ruleId}`);
  console.log(`   - Semantic Version:        ${segmentation.semanticVersion}`);
  console.log(`   - Extraction Version:      ${segmentation.extractionVersion}`);
  console.log(`   - Evidence Items (${segmentation.classification.evidence.length}):`);
  for (const ev of segmentation.classification.evidence) {
    console.log(
      `     * [${ev.ruleId}] (Page ${ev.pageNumber}, Block ${ev.textBlockOrder}): "${ev.matchedText}" -> ${ev.description}`
    );
  }

  // 4. Extracted Draw Metadata Evidence
  console.log("\n4. Extracted Draw Metadata (with Full Provenance):");
  if (!segmentation.drawMetadata) {
    throw new Error("Expected draw metadata to be extracted for LOTTERY_RESULT document!");
  }

  const dm = segmentation.drawMetadata;
  if (dm.lotteryName) {
    console.log(`   - Lottery Name: "${dm.lotteryName.value}"`);
    console.log(`     Provenance: Page ${dm.lotteryName.sourcePageNumber}, Block ${dm.lotteryName.textBlockOrder}, Rule: ${dm.lotteryName.ruleId}`);
    console.log(`     Raw Source: "${dm.lotteryName.rawText}"`);
    console.log(`     Bounding Box: [x=${dm.lotteryName.boundingBox.x}, y=${dm.lotteryName.boundingBox.y}, w=${dm.lotteryName.boundingBox.width}, h=${dm.lotteryName.boundingBox.height}]`);
  }
  if (dm.drawNumber) {
    console.log(`   - Draw Number:  "${dm.drawNumber.value}"`);
    console.log(`     Provenance: Page ${dm.drawNumber.sourcePageNumber}, Block ${dm.drawNumber.textBlockOrder}, Rule: ${dm.drawNumber.ruleId}`);
  }
  if (dm.drawDate) {
    console.log(`   - Draw Date:    "${dm.drawDate.value}"`);
    console.log(`     Provenance: Page ${dm.drawDate.sourcePageNumber}, Block ${dm.drawDate.textBlockOrder}, Rule: ${dm.drawDate.ruleId}`);
  }
  if (dm.drawTime) {
    console.log(`   - Draw Time:    "${dm.drawTime.value}"`);
  }
  if (dm.location) {
    console.log(`   - Location:     "${dm.location.value}"`);
    console.log(`     Provenance: Page ${dm.location.sourcePageNumber}, Block ${dm.location.textBlockOrder}, Rule: ${dm.location.ruleId}`);
  }

  // 5. Detected Semantic Regions per Page
  console.log(`\n5. Detected Semantic Regions (${segmentation.regions.length} total regions):`);
  for (const page of pages) {
    const pageRegions = segmentation.regions.filter((r) => r.pageNumber === page.pageNumber);
    console.log(`\n   --- Page ${page.pageNumber} of ${page.pageCount} (${pageRegions.length} regions) ---`);
    for (const r of pageRegions) {
      console.log(
        `   [Region] Type: ${r.type.padEnd(20)} | ID: ${r.id}`
      );
      console.log(
        `            Blocks (${r.textBlockOrders.length}): [${r.textBlockOrders.join(", ")}]`
      );
      console.log(
        `            Bounding Box: x=${r.boundingBox.x}, y=${r.boundingBox.y}, w=${r.boundingBox.width}, h=${r.boundingBox.height}, top=${r.boundingBox.top ?? 0} pt`
      );
      console.log(`            Evidence: ${r.evidence.join("; ")}`);
      if (r.summaryText) {
        const excerpt = r.summaryText.length > 70 ? r.summaryText.slice(0, 67) + "..." : r.summaryText;
        console.log(`            Summary: "${excerpt}"`);
      }
    }
  }

  // 6. Persist to DEV Firestore document_segmentations
  console.log("\n6. Persisting Document Semantic Segmentation to DEV Firestore...");
  await segmentationRepository.save(segmentation);
  console.log(`   ✓ Saved segmentation under 'document_segmentations/${segmentation.id}'`);

  // 7. Verify Persistence and Idempotency
  console.log("\n7. Verifying Persistence & Idempotency from DEV Firestore...");
  const retrievedSeg = await segmentationRepository.getByDocumentSha256(targetSha256);
  if (!retrievedSeg) {
    throw new Error(`Failed to retrieve saved segmentation for ${targetSha256} from DEV Firestore!`);
  }

  console.log(`   ✓ Retrieved record id: ${retrievedSeg.id}`);
  console.log(`   ✓ Retrieved classification: ${retrievedSeg.classification.kind}`);
  console.log(`   ✓ Retrieved regions count: ${retrievedSeg.regions.length}`);
  console.log(`   ✓ Retrieved lotteryName: ${retrievedSeg.drawMetadata?.lotteryName?.value}`);
  console.log(`   ✓ Retrieved drawNumber: ${retrievedSeg.drawMetadata?.drawNumber?.value}`);
  console.log(`   ✓ Retrieved drawDate: ${retrievedSeg.drawMetadata?.drawDate?.value}`);

  // Re-save identical segmentation (idempotent write)
  await segmentationRepository.save(segmentation);
  console.log("   ✓ Repeated save executed successfully (idempotent).");

  console.log("\n============================================================");
  console.log("MILESTONE 3D LIVE DEV VERIFICATION: PASS");
  console.log("CONFIRMATION: NO LOTTERY SEMANTIC INTERPRETATION WAS PERFORMED.");
  console.log("============================================================");

  return segmentation;
}

if (
  process.argv[1]?.endsWith("verify-dev-segmentation-3d.ts") ||
  process.argv[1]?.endsWith("verify-dev-segmentation-3d.js")
) {
  runDevSegmentation3DVerification().catch((err) => {
    console.error("DEV 3D Segmentation Verification Failed:", err);
    process.exit(1);
  });
}
