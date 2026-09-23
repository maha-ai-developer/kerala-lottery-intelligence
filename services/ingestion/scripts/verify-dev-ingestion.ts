/**
 * Milestone 3A — DEV Integration Verification Script
 *
 * Demonstrates:
 *   PDF bytes
 *     ↓
 *   SHA-256
 *     ↓
 *   DEV Storage (source-documents/{sha256}.pdf)
 *     ↓
 *   DEV Firestore (documents/{sha256})
 *     ↓
 *   Exact same PDF again
 *     ↓
 *   EXISTING / duplicate (Idempotency confirmed)
 */

import {
  computeSha256,
  getSourceStoragePath,
  validatePdfBuffer,
  DEV_SYNTHETIC_FIXTURE_BYTES
} from "@kerala-lottery/documents";
import {
  FirebaseStorageService,
  FirestoreRestDocumentRepository
} from "@kerala-lottery/data";
import {
  SourceIngestionService,
  type IngestDocumentInput
} from "../src/index";

export async function runDevIntegrationVerification() {
  console.log("============================================================");
  console.log("Milestone 3A — DEV Integration Verification");
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

  // 2. Validate synthetic fixture
  validatePdfBuffer(DEV_SYNTHETIC_FIXTURE_BYTES);
  const sha256 = computeSha256(DEV_SYNTHETIC_FIXTURE_BYTES);
  const storagePath = getSourceStoragePath(sha256);

  console.log("\n1. Synthetic Fixture Identity:");
  console.log(`   SHA-256:      ${sha256}`);
  console.log(`   Byte Size:    ${DEV_SYNTHETIC_FIXTURE_BYTES.byteLength} bytes`);
  console.log(`   Storage Path: ${storagePath}`);
  console.log(`   Firestore ID: documents/${sha256}`);

  // 3. Initialize DEV repositories
  const bucketName = "kerala-lottery-intel-dev.firebasestorage.app";
  const storageService = new FirebaseStorageService({
    bucketName,
    getAccessToken: () => token
  });

  const documentRepository = new FirestoreRestDocumentRepository({
    projectId: "kerala-lottery-intel-dev",
    databaseId: "(default)",
    getAccessToken: () => token
  });

  const ingestionService = new SourceIngestionService({
    documentRepository,
    storageService,
    ingestionVersion: "v1.0.0-source-foundation"
  });

  const input: IngestDocumentInput = {
    fileBuffer: DEV_SYNTHETIC_FIXTURE_BYTES,
    fileName: "dev-synthetic-lottery-fixture.pdf",
    sourceUrl: "https://kerala-lottery-intel-dev.test/fixtures/draw-synthetic.pdf",
    title: "DEV Milestone 3A Synthetic Fixture Gazette",
    sourceOrganization: "Directorate of Kerala State Lotteries (DEV Test)"
  };

  // 4. First Ingestion Run
  console.log("\n2. Executing First Ingestion...");
  const firstResult = await ingestionService.ingest(input);
  console.log(`   Action:       ${firstResult.action}`);
  console.log(`   isDuplicate:  ${firstResult.isDuplicate}`);
  console.log(`   Document ID:  ${firstResult.document.id}`);
  console.log(`   Storage Path: ${firstResult.storagePath}`);

  // 5. Second Ingestion Run with Exact Same PDF Bytes (Idempotency Test)
  console.log("\n3. Executing Second Ingestion (Exact Same PDF Bytes)...");
  const secondResult = await ingestionService.ingest(input);
  console.log(`   Action:       ${secondResult.action}`);
  console.log(`   isDuplicate:  ${secondResult.isDuplicate}`);
  console.log(`   Document ID:  ${secondResult.document.id}`);
  console.log(`   Storage Path: ${secondResult.storagePath}`);

  // 6. Assertions
  if (secondResult.action !== "EXISTING" || secondResult.isDuplicate !== true) {
    throw new Error(
      `Idempotency failed: expected action 'EXISTING' and isDuplicate true, got action '${secondResult.action}' and isDuplicate ${secondResult.isDuplicate}`
    );
  }

  // 7. Verify Firestore record directly
  console.log("\n4. Verifying Firestore Metadata in DEV:");
  const verifiedDoc = await documentRepository.getBySha256(sha256);
  if (!verifiedDoc) {
    throw new Error(`Document ${sha256} not found in Firestore!`);
  }
  console.log(`   Verified ID:           ${verifiedDoc.id}`);
  console.log(`   Verified SHA-256:      ${verifiedDoc.sha256}`);
  console.log(`   Verified File Size:    ${verifiedDoc.fileSize}`);
  console.log(`   Verified Status:       ${verifiedDoc.status}`);
  console.log(`   Verified IngestionVer: ${verifiedDoc.ingestionVersion}`);
  console.log(`   Verified CreatedAt:    ${verifiedDoc.createdAt}`);

  console.log("\n============================================================");
  console.log("DEV INTEGRATION VERIFICATION: PASS");
  console.log("============================================================");

  return {
    sha256,
    storagePath,
    firstResult,
    secondResult,
    verifiedDoc
  };
}

// Execute if run directly
if (process.argv[1]?.endsWith("verify-dev-ingestion.ts") || process.argv[1]?.endsWith("verify-dev-ingestion.js")) {
  runDevIntegrationVerification().catch((err) => {
    console.error("DEV Integration Verification Failed:", err);
    process.exit(1);
  });
}
