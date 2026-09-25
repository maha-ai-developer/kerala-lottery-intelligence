/**
 * Milestone 3C — Live DEV Text & Layout Segmentation Verification Script
 *
 * Demonstrates the end-to-end structural observation chain on DEV:
 *   IMMUTABLE PDF (Storage: source-documents/{sha256}.pdf)
 *     ↓
 *   PAGE-LEVEL TEXT & LAYOUT EXTRACTION
 *     ↓
 *   BOUNDING BOXES & COORDINATES
 *     ↓
 *   DEV FIRESTORE (document_pages/{sha256}_{pageNumber})
 *     ↓
 *   REPEAT EXTRACTION → IDEMPOTENT REUSE (ZERO DUPLICATES)
 *
 * IMPORTANT:
 * Observes physical layout and text ONLY.
 * NO LOTTERY SEMANTIC INTERPRETATION IS PERFORMED.
 */

import {
  computeSha256,
  getSourceStoragePath,
  DEFAULT_EXTRACTION_VERSION
} from "@kerala-lottery/documents";
import {
  FirebaseStorageService,
  FirestoreRestDocumentRepository,
  FirestoreRestDocumentPageRepository
} from "@kerala-lottery/data";
import { PageExtractionService } from "../src/page-extraction";

export async function runDevSegmentationVerification() {
  console.log("============================================================");
  console.log("Milestone 3C — DEV Text & Layout Segmentation Verification");
  console.log("Target Project: kerala-lottery-intel-dev (DEV ONLY)");
  console.log("Scope: Pure Physical Observation (NO LOTTERY SEMANTICS)");
  console.log("============================================================");

  // Target real official document ingested in Milestone 3B
  const targetSha256 =
    "9bc76b6017edb26d3c13d415cd96280f4a2f066d24c41ce7a82b39b44dee557c";
  const expectedStoragePath = getSourceStoragePath(targetSha256);

  // 1. Obtain authenticated credentials via normal Firebase CLI tooling
  let token = process.env.GCP_ACCESS_TOKEN;
  if (!token) {
    try {
      const fbPath =
        "/home/pi/.npm/_npx/ba4f1959e38407b5/node_modules/firebase-tools";
      const auth = require(fbPath + "/lib/auth");
      const account = auth.getGlobalDefaultAccount();
      if (account?.tokens?.refresh_token) {
        const tokenRes = await auth.getAccessToken(
          account.tokens.refresh_token,
          []
        );
        token = tokenRes.access_token;
      }
    } catch (err) {
      console.warn("Could not load credentials via firebase-tools auth module:", err);
    }
  }

  if (!token) {
    throw new Error(
      "Unable to obtain authenticated credentials for DEV verification"
    );
  }

  const projectId = "kerala-lottery-intel-dev";
  const bucketName = "kerala-lottery-intel-dev.firebasestorage.app";

  const storageService = new FirebaseStorageService({
    bucketName,
    getAccessToken: () => token!
  });

  const documentRepository = new FirestoreRestDocumentRepository({
    projectId,
    databaseId: "(default)",
    getAccessToken: () => token!
  });

  const documentPageRepository = new FirestoreRestDocumentPageRepository({
    projectId,
    databaseId: "(default)",
    getAccessToken: () => token!
  });

  // 2. Verify source document exists in DEV Firestore
  console.log("\n1. Verifying Source Document in DEV Firestore...");
  const sourceDoc = await documentRepository.getBySha256(targetSha256);
  if (!sourceDoc) {
    throw new Error(
      `Source document ${targetSha256} not found in DEV Firestore!`
    );
  }
  console.log(`   Source Document ID:   ${sourceDoc.id}`);
  console.log(`   Source Title:         ${sourceDoc.title}`);
  console.log(`   Source Storage Path:  ${sourceDoc.storagePath}`);
  console.log(`   Source File Size:     ${sourceDoc.fileSize} bytes`);
  console.log(`   Source Status:        ${sourceDoc.status}`);

  // 3. Retrieve immutable PDF artifact directly from Storage
  console.log("\n2. Retrieving Immutable PDF from DEV Storage...");
  console.log(`   Target Path: ${expectedStoragePath}`);
  const pdfBytes = await storageService.getObject(expectedStoragePath);
  if (!pdfBytes) {
    throw new Error(
      `Immutable PDF artifact not found at '${expectedStoragePath}' in bucket '${bucketName}'`
    );
  }
  const verifiedSha256 = computeSha256(pdfBytes);
  console.log(`   Retrieved Size:    ${pdfBytes.byteLength} bytes`);
  console.log(`   Retrieved SHA-256: ${verifiedSha256}`);
  if (verifiedSha256 !== targetSha256) {
    throw new Error(
      `SHA-256 verification failed! Expected ${targetSha256}, got ${verifiedSha256}`
    );
  }

  // 4. Initialize Milestone 3C PageExtractionService
  const extractionService = new PageExtractionService({
    documentRepository,
    documentPageRepository,
    storageService,
    extractionVersion: DEFAULT_EXTRACTION_VERSION
  });

  // 5. First Extraction Run: Observe structure and persist to DEV Firestore
  console.log("\n3. Running Physical Page & Layout Extraction...");
  const firstResult = await extractionService.extractPagesForDocument({
    documentSha256: targetSha256,
    pdfBytes,
    forceReextract: true // ensure fresh observation for live verification
  });

  console.log(`   Extraction Action:  ${firstResult.action}`);
  console.log(`   Is Duplicate:       ${firstResult.isDuplicate}`);
  console.log(`   Extraction Version: ${firstResult.extractionVersion}`);
  console.log(`   Total Pages:        ${firstResult.pageCount}`);

  for (const page of firstResult.pages) {
    console.log(
      `   - Page ${page.pageNumber}/${page.pageCount}: ID=${page.id}, Status=${page.extractionStatus}, Dimensions=${page.pageWidth}x${page.pageHeight} ${page.unit}, Blocks=${page.textBlocks.length}, HasImages=${page.hasImages}`
    );
  }

  // 6. Second Extraction Run: Test Repeatability & Idempotency
  console.log("\n4. Running Repeat Extraction (Idempotency & Deduplication Test)...");
  const secondResult = await extractionService.extractPagesForDocument({
    documentSha256: targetSha256,
    pdfBytes
  });

  console.log(`   Repeat Action:       ${secondResult.action}`);
  console.log(`   Repeat isDuplicate:  ${secondResult.isDuplicate}`);
  console.log(`   Repeat Total Pages:  ${secondResult.pageCount}`);

  if (secondResult.action !== "EXISTING" || secondResult.isDuplicate !== true) {
    throw new Error(
      `Repeat extraction idempotency check failed: expected action 'EXISTING', got '${secondResult.action}'`
    );
  }

  // 7. Verify Firestore Page Records directly from DEV
  console.log("\n5. Verifying DEV Firestore document_pages Records...");
  const devPages =
    await documentPageRepository.getByDocumentSha256(targetSha256);
  console.log(`   Retrieved ${devPages.length} pages from DEV document_pages`);
  if (devPages.length !== firstResult.pageCount) {
    throw new Error(
      `Page count mismatch in Firestore: expected ${firstResult.pageCount}, got ${devPages.length}`
    );
  }

  for (const p of devPages) {
    console.log(
      `   ✓ Verified page ${p.pageNumber}: id=${p.id}, status=${p.extractionStatus}, blocks=${p.textBlocks.length}, geom=${p.pageWidth}x${p.pageHeight}pt`
    );
  }

  // 8. Visual / Provenance Diagnostic Output (Bounding boxes and layout)
  console.log("\n6. Visual / Provenance Coordinate Sample (Page 1 Text Blocks):");
  console.log("---------------------------------------------------------------------------------------------------------");
  console.log(
    "Order | X (pt) | Y (pt) | Top (pt) | Width (pt) | Height (pt) | Font / Size | Text Excerpt"
  );
  console.log("---------------------------------------------------------------------------------------------------------");
  const sampleBlocks = devPages[0]!.textBlocks.slice(0, 10);
  for (const b of sampleBlocks) {
    const textExcerpt = b.text.length > 40 ? b.text.slice(0, 37) + "..." : b.text;
    const fontInfo = `${b.fontName || "default"}/${b.fontSize || "-"}`;
    console.log(
      `${String(b.order).padEnd(5)} | ${String(b.x).padEnd(6)} | ${String(b.y).padEnd(6)} | ${String(b.top).padEnd(8)} | ${String(b.width).padEnd(10)} | ${String(b.height).padEnd(11)} | ${fontInfo.padEnd(11)} | "${textExcerpt}"`
    );
  }
  console.log("---------------------------------------------------------------------------------------------------------");

  console.log("\n============================================================");
  console.log("MILESTONE 3C LIVE DEV VERIFICATION: PASS");
  console.log("CONFIRMATION: NO LOTTERY SEMANTIC INTERPRETATION WAS PERFORMED.");
  console.log("============================================================");

  return {
    targetSha256,
    expectedStoragePath,
    sourceDoc,
    firstResult,
    secondResult,
    devPages
  };
}

if (
  process.argv[1]?.endsWith("verify-dev-segmentation.ts") ||
  process.argv[1]?.endsWith("verify-dev-segmentation.js")
) {
  runDevSegmentationVerification().catch((err) => {
    console.error("DEV Segmentation Verification Failed:", err);
    process.exit(1);
  });
}
