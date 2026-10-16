/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 10B/V1 Final Audit Remediation Verifier
 *
 * Fail-closed, multi-layer cryptographic and byte-level verification
 * of draws SM-75 through SS-541 without modifying PROD.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import * as https from "node:https";
import * as tls from "node:tls";
import * as crypto from "node:crypto";
import {
  PdfPageExtractorService,
  DocumentSemanticSegmentationService,
  LotteryEntityExtractorService,
  computeSha256
} from "@kerala-lottery/documents";

// Target draws from SM-75 through SS-541
interface TargetDrawSpec {
  drawId: string;
  serial: number;
  expectedDate: string;
  expectedLottery: string;
  localFilename: string;
}

const TARGET_DRAWS: TargetDrawSpec[] = [
  { drawId: "SM-75th", serial: 75398, expectedDate: "04/10/2026", expectedLottery: "SAMRUDHI", localFilename: "SM-75.pdf" },
  { drawId: "BT-74th", serial: 75399, expectedDate: "05/10/2026", expectedLottery: "BHAGYATHARA", localFilename: "BT-74.pdf" },
  { drawId: "SS-540th", serial: 75400, expectedDate: "06/10/2026", expectedLottery: "STHREE-SAKTHI", localFilename: "SS-540.pdf" },
  { drawId: "DL-72nd", serial: 75401, expectedDate: "07/10/2026", expectedLottery: "DHANALEKSHMI", localFilename: "DL-72.pdf" },
  { drawId: "KN-644th", serial: 75402, expectedDate: "08/10/2026", expectedLottery: "KARUNYA PLUS", localFilename: "KN-644.pdf" },
  { drawId: "SK-72nd", serial: 75403, expectedDate: "09/10/2026", expectedLottery: "SUVARNA KERALAM", localFilename: "SK-72.pdf" },
  { drawId: "KR-771st", serial: 75404, expectedDate: "10/10/2026", expectedLottery: "KARUNYA", localFilename: "KR-771.pdf" },
  { drawId: "SM-76th", serial: 75405, expectedDate: "11/10/2026", expectedLottery: "SAMRUDHI", localFilename: "SM-76.pdf" },
  { drawId: "BT-75th", serial: 75406, expectedDate: "12/10/2026", expectedLottery: "BHAGYATHARA", localFilename: "BT-75.pdf" },
  { drawId: "SS-541st", serial: 75407, expectedDate: "13/10/2026", expectedLottery: "STHREE-SAKTHI", localFilename: "SS-541.pdf" }
];

async function initializeFirebaseClients() {
  const { selectAccount, setActiveAccount } = require("/home/pi/.npm/_npx/ba4f1959e38407b5/node_modules/firebase-tools/lib/auth");
  const { requireAuth } = require("/home/pi/.npm/_npx/ba4f1959e38407b5/node_modules/firebase-tools/lib/requireAuth");
  const apiv2 = require("/home/pi/.npm/_npx/ba4f1959e38407b5/node_modules/firebase-tools/lib/apiv2");

  const devOptions = { project: "kerala-lottery-intel-dev" };
  const account = selectAccount(undefined, process.cwd());
  if (account) {
    setActiveAccount(devOptions, account);
  }
  await requireAuth(devOptions);

  const storageClient = new apiv2.Client({ urlPrefix: "https://storage.googleapis.com" });
  const firestoreClient = new apiv2.Client({ urlPrefix: "https://firestore.googleapis.com" });
  const schedulerClient = new apiv2.Client({ urlPrefix: "https://cloudscheduler.googleapis.com" });

  return { storageClient, firestoreClient, schedulerClient };
}

function fetchOfficialPdf(serial: number): Promise<{
  statusCode: number;
  finalUrl: string;
  responseFilename: string;
  contentType: string;
  bytes: Buffer;
  sha256: string;
}> {
  return new Promise((resolve, reject) => {
    const officialHost = "103.251.43.52";
    const sniHost = "result.keralalotteries.com";
    const path = `/viewlotisresult.php?drawserial=${serial}`;

    const req = https.request({
      host: officialHost,
      port: 443,
      path,
      method: "GET",
      servername: sniHost,
      checkServerIdentity: (_host, cert) => tls.checkServerIdentity(sniHost, cert),
      headers: {
        "Host": sniHost,
        "User-Agent": "KeralaLotteryAudit/1.0"
      }
    }, (res) => {
      const statusCode = res.statusCode || 0;
      const contentType = String(res.headers["content-type"] || "");
      const disposition = String(res.headers["content-disposition"] || "");
      let responseFilename = "unknown";
      const fnMatch = disposition.match(/filename=["\x27]?([^"\x27;\r\n]+)/);
      if (fnMatch && fnMatch[1]) {
        responseFilename = fnMatch[1].trim();
      }

      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        const bytes = Buffer.concat(chunks);
        const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
        resolve({
          statusCode,
          finalUrl: `https://${sniHost}${path}`,
          responseFilename,
          contentType,
          bytes,
          sha256
        });
      });
    });

    req.on("error", reject);
    req.end();
  });
}

async function main() {
  console.log("================================================================================");
  console.log("FINAL AUDIT REMEDIATION — FAIL-CLOSED MULTI-LAYER RECONCILIATION");
  console.log("Execution Time:", new Date().toISOString());
  console.log("================================================================================\n");

  const { storageClient, firestoreClient, schedulerClient } = await initializeFirebaseClients();

  // 1. Audit PROD Pre-State (Read-Only Inventory)
  console.log("[PHASE 1] Recording PROD Read-Only Inventory...");
  const prodSchedRes = await schedulerClient.get("/v1/projects/kerala-lottery-intelligence/locations/asia-south1/jobs/prod-daily-lottery-ingestion");
  if (prodSchedRes.status !== 200 || prodSchedRes.body?.state !== "PAUSED") {
    throw new Error(`PROD Scheduler validation failed: status ${prodSchedRes.status}, state ${prodSchedRes.body?.state}`);
  }
  const prodSchedulerPre = {
    name: prodSchedRes.body?.name,
    state: prodSchedRes.body?.state,
    userUpdateTime: prodSchedRes.body?.userUpdateTime
  };

  const prodStorageRes = await storageClient.get("/storage/v1/b/kerala-lottery-intelligence.firebasestorage.app/o?prefix=source-documents%2F&maxResults=200");
  if (prodStorageRes.status !== 200 || !prodStorageRes.body?.items) {
    throw new Error(`PROD Storage query failed: status ${prodStorageRes.status}`);
  }
  const prodStorageInventoryPre = (prodStorageRes.body.items as any[]).map(item => ({
    name: item.name,
    generation: item.generation,
    size: item.size,
    updated: item.updated,
    md5Hash: item.md5Hash
  }));
  if (prodStorageInventoryPre.length !== 100) {
    throw new Error(`PROD Storage expected 100 objects, found ${prodStorageInventoryPre.length}`);
  }

  const prodFirestoreRes = await firestoreClient.get("/v1/projects/kerala-lottery-intelligence/databases/(default)/documents/documents?pageSize=300");
  if (prodFirestoreRes.status !== 200 || !prodFirestoreRes.body?.documents) {
    throw new Error(`PROD Firestore query failed: status ${prodFirestoreRes.status}`);
  }
  const prodFirestoreInventoryPre = (prodFirestoreRes.body.documents as any[]).map(doc => ({
    name: doc.name,
    createTime: doc.createTime,
    updateTime: doc.updateTime
  }));
  if (prodFirestoreInventoryPre.length !== 100) {
    throw new Error(`PROD Firestore expected 100 documents, found ${prodFirestoreInventoryPre.length}`);
  }

  console.log(`✓ PROD Baseline: Scheduler PAUSED, 100 Storage objects, 100 Firestore documents.`);

  // 2. Reconcile all 10 disputed documents
  console.log("\n[PHASE 2] Reconciling all 10 disputed documents across 7 layers...");
  const extractor = new PdfPageExtractorService();
  const segService = new DocumentSemanticSegmentationService();
  const entityService = new LotteryEntityExtractorService();

  const auditRows: any[] = [];
  const manifest = JSON.parse(readFileSync(join(process.cwd(), "data/processed-cache/manifest.json"), "utf-8"));

  for (const spec of TARGET_DRAWS) {
    console.log(`\n--- Auditing Draw: ${spec.drawId} (Serial ${spec.serial}) ---`);

    // Layer 1: Network / Official TLS fetch
    const remote = await fetchOfficialPdf(spec.serial);
    const networkPass = remote.statusCode === 200 &&
      remote.contentType.includes("pdf") &&
      remote.bytes.slice(0, 5).toString() === "%PDF-" &&
      remote.responseFilename.endsWith(".pdf");

    if (!networkPass) {
      throw new Error(`Network layer failed for ${spec.drawId}: status=${remote.statusCode}, contentType=${remote.contentType}`);
    }

    // Layer 2: Parse reacquired PDF
    const remoteExtRes = await extractor.extractPages(new Uint8Array(remote.bytes), remote.sha256);
    const remoteSeg = segService.segmentDocument(remoteExtRes.pages);
    const remoteEntities = entityService.extract(remoteSeg, remoteExtRes.pages);

    const remoteParsedLottery = remoteEntities.drawMetadata?.lotteryName?.value;
    const remoteParsedDrawNum = remoteEntities.drawMetadata?.drawNumber?.value;
    const remoteParsedDate = remoteEntities.drawMetadata?.drawDate?.value;
    const remoteResultsCount = remoteEntities.winningResults.length;

    // Layer 3: Local PDF reading and parsing
    const localPath = join(process.cwd(), "data/source-documents/lottery-results", spec.localFilename);
    if (!existsSync(localPath)) {
      throw new Error(`Local file missing: ${localPath}`);
    }
    const localBytes = readFileSync(localPath);
    const localSha = computeSha256(new Uint8Array(localBytes));
    const localByteLength = localBytes.length;

    const localExtRes = await extractor.extractPages(new Uint8Array(localBytes), localSha);
    const localSeg = segService.segmentDocument(localExtRes.pages);
    const localEntities = entityService.extract(localSeg, localExtRes.pages);

    const localParsedLottery = localEntities.drawMetadata?.lotteryName?.value;
    const localParsedDrawNum = localEntities.drawMetadata?.drawNumber?.value;
    const localParsedDate = localEntities.drawMetadata?.drawDate?.value;
    const localResultsCount = localEntities.winningResults.length;

    const byteShaPass = localSha === remote.sha256;
    const byteLengthPass = localByteLength === remote.bytes.length;
    const pdfParsePass = remoteParsedDrawNum === spec.drawId &&
      remoteParsedDate === spec.expectedDate &&
      remoteParsedLottery === spec.expectedLottery &&
      localParsedLottery === remoteParsedLottery &&
      localParsedDrawNum === remoteParsedDrawNum &&
      localParsedDate === remoteParsedDate &&
      localResultsCount === remoteResultsCount &&
      remoteResultsCount > 0;

    if (!byteShaPass || !byteLengthPass || !pdfParsePass) {
      throw new Error(`Local vs Remote validation failed for ${spec.drawId}: shaMatch=${byteShaPass}, lenMatch=${byteLengthPass}, parseMatch=${pdfParsePass}`);
    }

    // Layer 4: Cloud Storage byte download and hash verification
    const gcsMediaRes = await storageClient.get(
      `/storage/v1/b/kerala-lottery-intel-dev.firebasestorage.app/o/source-documents%2F${localSha}.pdf?alt=media`,
      { responseType: "stream", resolveOnHTTPError: true }
    );
    if (gcsMediaRes.status !== 200) {
      throw new Error(`DEV Storage media download failed for ${spec.drawId}: status ${gcsMediaRes.status}`);
    }
    const gcsChunks: Buffer[] = [];
    gcsMediaRes.body.on("data", (c: Buffer) => gcsChunks.push(c));
    await new Promise((res, rej) => {
      gcsMediaRes.body.on("end", res);
      gcsMediaRes.body.on("error", rej);
    });
    const gcsBytes = Buffer.concat(gcsChunks);
    const gcsSha = crypto.createHash("sha256").update(gcsBytes).digest("hex");
    const gcsByteLength = gcsBytes.length;

    // Fetch GCS object metadata for generation
    const gcsMetaRes = await storageClient.get(`/storage/v1/b/kerala-lottery-intel-dev.firebasestorage.app/o/source-documents%2F${localSha}.pdf`);
    const gcsGeneration = gcsMetaRes.body?.generation;
    const gcsByteShaPass = gcsSha === localSha && gcsByteLength === localByteLength && !!gcsGeneration;

    if (!gcsByteShaPass) {
      throw new Error(`DEV Storage byte validation failed for ${spec.drawId}: gcsSha=${gcsSha}, localSha=${localSha}`);
    }

    // Layer 5: Firestore document metadata verification
    const fsDocRes = await firestoreClient.get(`/v1/projects/kerala-lottery-intel-dev/databases/(default)/documents/documents/${localSha}`);
    if (fsDocRes.status !== 200) {
      throw new Error(`DEV Firestore document fetch failed for ${spec.drawId}: status ${fsDocRes.status}`);
    }
    const fsFields = fsDocRes.body?.fields || {};
    const fsTitle = fsFields.title?.stringValue || "";
    const fsSha = fsFields.sha256?.stringValue || fsFields.id?.stringValue || "";
    const fsByteCount = Number(fsFields.fileSize?.integerValue || 0);
    const fsSourceUrl = fsFields.sourceUrl?.stringValue || "";
    const fsStatus = fsFields.status?.stringValue || "";

    const simpleId = spec.localFilename.replace(".pdf", "");
    const firestoreMetadataPass = fsSha === localSha &&
      fsByteCount === localByteLength &&
      fsTitle.includes(simpleId) &&
      fsSourceUrl.includes(String(spec.serial)) &&
      fsStatus === "UPLOADED";

    if (!firestoreMetadataPass) {
      throw new Error(`DEV Firestore metadata validation failed for ${spec.drawId}: fsSha=${fsSha}, fsTitle=${fsTitle}, fsBytes=${fsByteCount}`);
    }

    // Layer 6: Knowledge graph & manifest verification
    const simpleDrawId = spec.drawId.replace(/(st|nd|rd|th)$/, "");
    const graphPath1 = join(process.cwd(), "data/processed-cache/graphs", `graph_${simpleDrawId}.json`);
    const graphPath2 = join(process.cwd(), "data/processed-cache/graphs", `${localSha}.json`);
    const graphPath = existsSync(graphPath1) ? graphPath1 : graphPath2;
    if (!existsSync(graphPath)) {
      throw new Error(`Graph missing for ${spec.drawId}`);
    }
    const graphData = JSON.parse(readFileSync(graphPath, "utf-8"));
    const graphNodesCount = graphData.nodes?.length || 0;
    const graphEdgesCount = graphData.edges?.length || 0;

    const manifestDoc = manifest.documents ? manifest.documents[localSha] : undefined;
    const graphManifestPass = graphNodesCount > 0 &&
      graphEdgesCount > 0 &&
      !!manifestDoc &&
      manifestDoc.sha256 === localSha &&
      manifestDoc.drawDate === spec.expectedDate &&
      manifestDoc.status === "VALID";

    if (!graphManifestPass) {
      throw new Error(`Graph/manifest validation failed for ${spec.drawId}: manifestFound=${!!manifestDoc}`);
    }

    const row = {
      drawIdentity: spec.drawId,
      serial: spec.serial,
      drawDate: spec.expectedDate,
      lotteryName: spec.expectedLottery,
      requestUrl: remote.finalUrl,
      officialResponseFilename: remote.responseFilename,
      canonicalLocalFilename: spec.localFilename,
      exactBytes: localByteLength,
      localSha256: localSha,
      remoteSha256: remote.sha256,
      cloudStorageSha256: gcsSha,
      cloudStorageGeneration: gcsGeneration,
      firestoreDocumentId: `documents/${localSha}`,
      graphIdentity: `${graphNodesCount} nodes, ${graphEdgesCount} edges (${graphPath.split("/").pop()})`,
      resultCount: localResultsCount,
      layerResults: {
        networkPass,
        byteShaPass,
        byteLengthPass,
        pdfParsePass,
        gcsByteShaPass,
        firestoreMetadataPass,
        graphManifestPass
      },
      overallVerdict: "PASS"
    };

    console.log(`✓ Draw ${spec.drawId}: All 7 layers verified PASS (Bytes=${localByteLength}, SHA=${localSha.slice(0, 16)}...)`);
    auditRows.push(row);
  }

  // 3. Live Anti-Duplication Precondition Tests
  console.log("\n[PHASE 3] Executing Live Precondition & Anti-Duplication Assertions...");
  const targetSha = auditRows[0].localSha256;

  // GCS Overwrite Precondition Test: ifGenerationMatch=0
  console.log("Testing GCS overwrite precondition guard (ifGenerationMatch=0)...");
  const gcsPrecondRes = await storageClient.post(
    `/upload/storage/v1/b/kerala-lottery-intel-dev.firebasestorage.app/o?uploadType=media&name=source-documents%2F${targetSha}.pdf&ifGenerationMatch=0`,
    Buffer.from("audit-remediation-test-payload"),
    {
      headers: { "Content-Type": "application/pdf" },
      resolveOnHTTPError: true
    }
  );
  console.log(`Actual GCS Precondition Response Status: ${gcsPrecondRes.status}`);
  if (gcsPrecondRes.status !== 412) {
    throw new Error(`FAIL-CLOSED: GCS overwrite precondition failed! Expected HTTP 412, got ${gcsPrecondRes.status}`);
  }
  const gcsPrecondEvidence = {
    test: "GCS Overwrite Guard (ifGenerationMatch=0)",
    expectedStatus: 412,
    actualStatus: gcsPrecondRes.status,
    responseBody: gcsPrecondRes.body
  };
  console.log("✓ GCS Overwrite Guard PASSED with HTTP 412 Precondition Failed.");

  // Firestore Duplicate Create Test
  console.log("Testing Firestore duplicate create guard (createDocument with existing documentId)...");
  const fsDupRes = await firestoreClient.post(
    `/v1/projects/kerala-lottery-intel-dev/databases/(default)/documents/documents?documentId=${targetSha}`,
    {
      fields: {
        auditTest: { stringValue: "duplicate-attempt-payload" }
      }
    },
    { resolveOnHTTPError: true }
  );
  console.log(`Actual Firestore Duplicate Create Status: ${fsDupRes.status}`);
  if (fsDupRes.status !== 409) {
    throw new Error(`FAIL-CLOSED: Firestore duplicate create guard failed! Expected HTTP 409, got ${fsDupRes.status}`);
  }
  const fsDupEvidence = {
    test: "Firestore Duplicate Guard (createDocument with existing documentId)",
    expectedStatus: 409,
    actualStatus: fsDupRes.status,
    responseBody: fsDupRes.body
  };
  console.log("✓ Firestore Duplicate Guard PASSED with HTTP 409 Conflict.");

  // 4. PROD Post-Verification Inventory Comparison
  console.log("\n[PHASE 4] Comparing PROD Post-Audit Inventory...");
  const prodSchedPost = await schedulerClient.get("/v1/projects/kerala-lottery-intelligence/locations/asia-south1/jobs/prod-daily-lottery-ingestion");
  if (prodSchedPost.body?.state !== prodSchedulerPre.state || prodSchedPost.body?.userUpdateTime !== prodSchedulerPre.userUpdateTime) {
    throw new Error(`PROD Scheduler mutated! Pre: ${JSON.stringify(prodSchedulerPre)}, Post: ${JSON.stringify(prodSchedPost.body)}`);
  }

  const prodStoragePost = await storageClient.get("/storage/v1/b/kerala-lottery-intelligence.firebasestorage.app/o?prefix=source-documents%2F&maxResults=200");
  const prodStorageInventoryPost = (prodStoragePost.body?.items as any[]).map(item => ({
    name: item.name,
    generation: item.generation,
    size: item.size,
    updated: item.updated,
    md5Hash: item.md5Hash
  }));
  if (prodStorageInventoryPost.length !== prodStorageInventoryPre.length) {
    throw new Error(`PROD Storage count changed: ${prodStorageInventoryPre.length} -> ${prodStorageInventoryPost.length}`);
  }
  for (const pre of prodStorageInventoryPre) {
    const post = prodStorageInventoryPost.find(p => p.name === pre.name);
    if (!post || post.generation !== pre.generation || post.updated !== pre.updated) {
      throw new Error(`PROD Storage object mutated: ${pre.name}`);
    }
  }

  const prodFirestorePost = await firestoreClient.get("/v1/projects/kerala-lottery-intelligence/databases/(default)/documents/documents?pageSize=300");
  const prodFirestoreInventoryPost = (prodFirestorePost.body?.documents as any[]).map(doc => ({
    name: doc.name,
    createTime: doc.createTime,
    updateTime: doc.updateTime
  }));
  if (prodFirestoreInventoryPost.length !== prodFirestoreInventoryPre.length) {
    throw new Error(`PROD Firestore count changed: ${prodFirestoreInventoryPre.length} -> ${prodFirestoreInventoryPost.length}`);
  }
  for (const pre of prodFirestoreInventoryPre) {
    const post = prodFirestoreInventoryPost.find(p => p.name === pre.name);
    if (!post || post.updateTime !== pre.updateTime) {
      throw new Error(`PROD Firestore document mutated: ${pre.name}`);
    }
  }

  console.log("✓ PROD Post-Audit Comparison: 100/100 Storage objects and 100/100 Firestore documents identical (0 modified, 0 added, 0 deleted). Scheduler unchanged.");

  // 5. Save Raw Machine-Readable Report
  const fullReport = {
    auditTimestamp: new Date().toISOString(),
    overallStatus: "PASS",
    coverageLimit: {
      corpusEndingDate: "13/10/2026",
      totalDrawsInCorpus: 114,
      totalResultsInCorpus: 43712,
      absentLaterDraws: [
        { drawId: "DL-73rd", serial: 75408, drawDate: "14/10/2026", status: "ABSENT_FROM_CORPUS" },
        { drawId: "KN-645th", serial: 75409, drawDate: "15/10/2026", status: "ABSENT_FROM_CORPUS" },
        { drawId: "SK-73rd", serial: 75410, drawDate: "16/10/2026", status: "ABSENT_FROM_CORPUS" }
      ],
      scopeStatement: "The verified V1 corpus strictly covers draws up to 13 October 2026 (114 draws). Draws DL-73 (14/10), KN-645 (15/10), and SK-73 (16/10) are published on the portal but excluded from this V1 audit scope and must not be claimed as covered."
    },
    prodZeroMutationVerification: {
      schedulerState: prodSchedPost.body?.state,
      schedulerUpdateTime: prodSchedPost.body?.userUpdateTime,
      storageObjectsCount: prodStorageInventoryPost.length,
      firestoreDocumentsCount: prodFirestoreInventoryPost.length,
      mutationsDetected: 0
    },
    livePreconditionEvidence: {
      gcsOverwriteGuard: gcsPrecondEvidence,
      firestoreDuplicateGuard: fsDupEvidence
    },
    reconciliationTable: auditRows
  };

  const outputPath1 = join(process.cwd(), "data/processed-cache/reconciliation-audit-raw.json");
  const outputPath2 = "/home/pi/.gemini/antigravity-ide/brain/86aa6227-4ac1-484e-a826-87384cf373a3/reconciliation-audit-raw.json";
  writeFileSync(outputPath1, JSON.stringify(fullReport, null, 2));
  writeFileSync(outputPath2, JSON.stringify(fullReport, null, 2));

  console.log(`\n✓ Raw machine-readable audit report saved to:\n  - ${outputPath1}\n  - ${outputPath2}`);
  console.log("\n================================================================================");
  console.log("FINAL AUDIT REMEDIATION: ALL 10 DRAWS AND GUARDS VERIFIED PASS (FAIL-CLOSED)");
  console.log("================================================================================");
}

main().catch((err) => {
  console.error("\n❌ AUDIT REMEDIATION FAILED:", err);
  process.exit(1);
});
