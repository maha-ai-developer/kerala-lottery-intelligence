/**
 * Milestone 3B — Live DEV Official Source Discovery & Acquisition Verification Script
 *
 * Demonstrates the end-to-end chain on DEV:
 *   OFFICIAL SOURCE
 *     ↓
 *   DISCOVERY
 *     ↓
 *   REAL PDF DOWNLOAD
 *     ↓
 *   PDF VALIDATION
 *     ↓
 *   SHA-256
 *     ↓
 *   Milestone 3A IMMUTABLE INGESTION
 *     ↓
 *   DEV STORAGE (source-documents/{sha256}.pdf)
 *     ↓
 *   DEV FIRESTORE (documents/{sha256})
 *     ↓
 *   REPEAT → IDEMPOTENT RESULT
 */

import {
  KERALA_STATE_LOTTERY_PORTAL,
  validatePdfBuffer,
  computeSha256,
  getSourceStoragePath
} from "@kerala-lottery/documents";
import {
  FirebaseStorageService,
  FirestoreRestDocumentRepository
} from "@kerala-lottery/data";
import {
  OfficialSourceDiscoveryService,
  DocumentAcquisitionService,
  SourceIngestionService
} from "../src/index";

export async function runDevAcquisitionVerification() {
  console.log("============================================================");
  console.log("Milestone 3B — DEV Official Source Discovery & Acquisition Verification");
  console.log("Target Project: kerala-lottery-intel-dev (DEV ONLY)");
  console.log("============================================================");

  // 1. Obtain authenticated credentials via normal Firebase CLI tooling
  let token = process.env.GCP_ACCESS_TOKEN;
  if (!token) {
    try {
      const fbPath = "/home/pi/.npm/_npx/ba4f1959e38407b5/node_modules/firebase-tools";
      const auth = require(fbPath + "/lib/auth");
      const account = auth.getGlobalDefaultAccount();
      if (account?.tokens?.refresh_token) {
        const tokenRes = await auth.getAccessToken(account.tokens.refresh_token, []);
        token = tokenRes.access_token;
      }
    } catch (err) {
      console.warn("Could not load credentials via firebase-tools auth module:", err);
    }
  }

  if (!token) {
    throw new Error("Unable to obtain authenticated credentials for DEV verification");
  }

  // 2. Discover official result publications
  console.log("\n1. Discovering Official Documents from Official Portal...");
  console.log(`   Official Organization: ${KERALA_STATE_LOTTERY_PORTAL.organization}`);
  console.log(`   Discovery Endpoint:    ${KERALA_STATE_LOTTERY_PORTAL.discoveryUrl}`);

  const discoveryService = new OfficialSourceDiscoveryService();
  const discoveredDocs = await discoveryService.discover(KERALA_STATE_LOTTERY_PORTAL);
  console.log(`   Discovered ${discoveredDocs.length} official publication(s)`);

  if (discoveredDocs.length === 0) {
    throw new Error("No official result documents discovered on official portal");
  }

  const targetDoc = discoveredDocs[0]!;
  console.log(`   Selected Official Document: ${targetDoc.title}`);
  console.log(`   Document URL:               ${targetDoc.documentUrl}`);
  if (targetDoc.drawNumber) console.log(`   Draw Number:                ${targetDoc.drawNumber}`);
  if (targetDoc.drawDate) console.log(`   Draw Date:                  ${targetDoc.drawDate}`);

  // 3. Acquire Real Official Document with Full Validation
  console.log("\n2. Acquiring Official Document via DocumentAcquisitionService...");
  const acquisitionService = new DocumentAcquisitionService();
  const acquisition = await acquisitionService.acquire({
    url: targetDoc.documentUrl,
    officialSource: KERALA_STATE_LOTTERY_PORTAL,
    discoveryUrl: targetDoc.discoveryUrl,
    title: targetDoc.title,
    sourceOrganization: targetDoc.sourceOrganization
  });

  // Verify PDF invariants on real acquired bytes
  validatePdfBuffer(acquisition.fileBuffer);
  const sha256 = computeSha256(acquisition.fileBuffer);
  const storagePath = getSourceStoragePath(sha256);

  console.log("   HTTP & Document Validation Evidence:");
  console.log(`   - HTTP Status:          ${acquisition.provenance.httpMetadata.statusCode}`);
  console.log(`   - Content-Type:         ${acquisition.provenance.httpMetadata.contentType}`);
  console.log(`   - Declared Content-Type: ${acquisition.provenance.declaredContentType || "application/pdf"}`);
  console.log(`   - Byte Size:            ${acquisition.fileBuffer.byteLength} bytes`);
  console.log(`   - SHA-256 (Canonical):  ${sha256}`);
  console.log(`   - Storage Path:         ${storagePath}`);
  console.log(`   - Firestore Document:   documents/${sha256}`);
  console.log(`   - Requested URL:        ${acquisition.provenance.requestedUrl}`);
  console.log(`   - Final URL:            ${acquisition.provenance.finalUrl}`);
  console.log(`   - Redirect Count:       ${acquisition.provenance.redirectCount}`);
  console.log(`   - Retrieved At:         ${acquisition.provenance.retrievedAt}`);

  // 4. Initialize Milestone 3A Ingestion Pipeline targeting DEV
  const bucketName = "kerala-lottery-intel-dev.firebasestorage.app";
  const storageService = new FirebaseStorageService({
    bucketName,
    getAccessToken: () => token!
  });

  const documentRepository = new FirestoreRestDocumentRepository({
    projectId: "kerala-lottery-intel-dev",
    databaseId: "(default)",
    getAccessToken: () => token!
  });

  const ingestionService = new SourceIngestionService({
    documentRepository,
    storageService,
    ingestionVersion: "v1.1.0-source-acquisition"
  });

  // 5. Ingest Real Official Document into Immutable SOURCE Layer
  console.log("\n3. Ingesting Real Official Document into DEV...");
  const firstIngest = await ingestionService.ingest({
    fileBuffer: acquisition.fileBuffer,
    fileName: acquisition.fileName,
    mimeType: acquisition.mimeType,
    sourceUrl: acquisition.sourceUrl,
    title: acquisition.title,
    sourceOrganization: acquisition.sourceOrganization,
    retrievedAt: acquisition.provenance.retrievedAt,
    provenance: acquisition.provenance
  });

  console.log(`   Action:       ${firstIngest.action}`);
  console.log(`   isDuplicate:  ${firstIngest.isDuplicate}`);
  console.log(`   Document ID:  ${firstIngest.document.id}`);
  console.log(`   Storage Path: ${firstIngest.storagePath}`);

  // 6. Test Idempotency: Run Acquisition & Ingestion Again
  console.log("\n4. Running Repeated Acquisition & Ingestion (Idempotency Test)...");
  const repeatAcquisition = await acquisitionService.acquire({
    url: targetDoc.documentUrl,
    officialSource: KERALA_STATE_LOTTERY_PORTAL,
    discoveryUrl: targetDoc.discoveryUrl,
    title: targetDoc.title,
    sourceOrganization: targetDoc.sourceOrganization
  });

  const secondIngest = await ingestionService.ingest({
    fileBuffer: repeatAcquisition.fileBuffer,
    fileName: repeatAcquisition.fileName,
    mimeType: repeatAcquisition.mimeType,
    sourceUrl: repeatAcquisition.sourceUrl,
    title: repeatAcquisition.title,
    sourceOrganization: repeatAcquisition.sourceOrganization,
    retrievedAt: repeatAcquisition.provenance.retrievedAt,
    provenance: repeatAcquisition.provenance
  });

  console.log(`   Repeat Action:      ${secondIngest.action}`);
  console.log(`   Repeat isDuplicate: ${secondIngest.isDuplicate}`);
  console.log(`   Document ID:        ${secondIngest.document.id}`);

  if (secondIngest.action !== "EXISTING" || secondIngest.isDuplicate !== true) {
    throw new Error(
      `Idempotency verification failed: expected action 'EXISTING' and isDuplicate true, got '${secondIngest.action}'`
    );
  }

  // 7. Verify Firestore Document Metadata in DEV
  console.log("\n5. Verifying Firestore Metadata & Provenance in DEV...");
  const verifiedDoc = await documentRepository.getBySha256(sha256);
  if (!verifiedDoc) {
    throw new Error(`Document ${sha256} not found in DEV Firestore!`);
  }

  console.log(`   Verified ID:           ${verifiedDoc.id}`);
  console.log(`   Verified SHA-256:      ${verifiedDoc.sha256}`);
  console.log(`   Verified File Size:    ${verifiedDoc.fileSize} bytes`);
  console.log(`   Verified Status:       ${verifiedDoc.status}`);
  console.log(`   Verified IngestionVer: ${verifiedDoc.ingestionVersion}`);
  console.log(`   Verified Provenance:`);
  console.log(`     - Source ID:         ${verifiedDoc.provenance?.sourceId}`);
  console.log(`     - Source Org:        ${verifiedDoc.provenance?.sourceOrganization}`);
  console.log(`     - Discovery URL:     ${verifiedDoc.provenance?.discoveryUrl}`);
  console.log(`     - Requested URL:     ${verifiedDoc.provenance?.requestedUrl}`);
  console.log(`     - Final URL:         ${verifiedDoc.provenance?.finalUrl}`);
  console.log(`     - Status Code:       ${verifiedDoc.provenance?.httpMetadata.statusCode}`);

  console.log("\n============================================================");
  console.log("MILESTONE 3B LIVE DEV VERIFICATION: PASS");
  console.log("============================================================");

  return {
    officialSource: KERALA_STATE_LOTTERY_PORTAL,
    targetDoc,
    acquisition,
    sha256,
    storagePath,
    firstIngest,
    secondIngest,
    verifiedDoc
  };
}

if (
  process.argv[1]?.endsWith("verify-dev-acquisition.ts") ||
  process.argv[1]?.endsWith("verify-dev-acquisition.js")
) {
  runDevAcquisitionVerification().catch((err) => {
    console.error("DEV Acquisition Verification Failed:", err);
    process.exit(1);
  });
}
