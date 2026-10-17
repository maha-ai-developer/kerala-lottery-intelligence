/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 8B/V1.0 Acceptance — Production Source Integrity & Reconciliation Regression Tests
 *
 * Exercises actual production classes and verifiers (zero local stand-in helper functions):
 * 1. verifyDrawArtifactReconciliation: rejects incorrect SHA-256, file size, draw identity, draw date, or result count.
 * 2. FirebaseStorageService.putIfAbsent & InMemoryStorageService.putIfAbsent: enforces create-only precondition (HTTP 412 -> StorageAlreadyExistsError) and refuses to overwrite existing objects.
 * 3. FirestoreRestDocumentRepository.create & InMemoryDocumentRepository.create: enforces create-if-absent precondition (HTTP 409 -> DocumentAlreadyExistsError) and refuses duplicate documents.
 * 4. compareProdInventories: rejects injected storage additions, deletions, generation changes, size changes, timestamp changes, Firestore document additions/deletions/timestamp changes, and Scheduler state/timestamp changes.
 * 5. acquireGoogleCloudAccessToken, sanitizeAuthError, getAccessToken, and getGcpAccessToken: uses documented GoogleAuth ADC interface and scrubs tokens/secrets from error messages.
 * 6. resolveCanonicalAndResponseFilename & DailyIngestionEngine: refuses to fabricate canonical filenames from sequence order and blocks conflicting draw identities.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  resolveCanonicalAndResponseFilename
} from "./daily-ingestion-engine";
import {
  verifyDrawArtifactReconciliation,
  ReconciliationVerificationError,
  compareProdInventories,
  ProdInventoryMutationError,
  acquireGoogleCloudAccessToken,
  sanitizeAuthError,
  assertDevEnvironment,
  EnvironmentViolationError,
  ScheduledIngestionOrchestrator,
  type DrawArtifactReconciliationInput,
  type ProdInventorySnapshot
} from "./operations";
import {
  FirebaseStorageService,
  FirestoreRestDocumentRepository,
  FirestoreRestWinningResultRepository,
  InMemoryStorageService,
  InMemoryDocumentRepository,
  InMemoryWinningResultRepository,
  InMemoryPrizeTierRepository,
  StorageAlreadyExistsError,
  StorageIntegrityError,
  DocumentAlreadyExistsError,
  DocumentIntegrityError
} from "@kerala-lottery/data";
import { SourceIngestionService } from "./index";
import type { SourceDocument, WinningResult, PrizeTier } from "@kerala-lottery/domain";
import { computeSha256 } from "@kerala-lottery/documents";
import { getAccessToken } from "../scripts/verify-prod-activation";
import { getGcpAccessToken } from "../scripts/prod-bootstrap";
import { getAuditAccessToken } from "../scripts/reconciliation-audit-remediation";

const SAMPLE_PDF_PATH = resolve(
  __dirname,
  "../../../data/source-documents/lottery-results/SM-75.pdf"
);
const SAMPLE_PDF_BYTES = new Uint8Array(readFileSync(SAMPLE_PDF_PATH));
const SAMPLE_PDF_SHA256 = computeSha256(SAMPLE_PDF_BYTES);

function createValidReconciliationInput(): DrawArtifactReconciliationInput {
  return {
    expectedDrawId: "SM-75th",
    expectedDate: "04/10/2026",
    expectedLottery: "SAMRUDHI",
    expectedSerial: 75398,
    expectedResultCount: 382,
    localBytes: SAMPLE_PDF_BYTES,
    remoteBytes: SAMPLE_PDF_BYTES,
    cloudStorageBytes: SAMPLE_PDF_BYTES,
    cloudStorageGeneration: "1792154997562839",
    parsedDrawId: "SM-75th",
    parsedDrawDate: "04/10/2026",
    parsedLotteryName: "SAMRUDHI",
    parsedTotalResults: 382,
    parsedFullTicketCount: 14,
    parsedSuffixCount: 368,
    manifestRecord: {
      sha256: SAMPLE_PDF_SHA256,
      drawNumber: "SM-75th",
      drawDate: "04/10/2026",
      lotteryName: "SAMRUDHI",
      status: "VALID"
    },
    firestoreRecord: {
      id: SAMPLE_PDF_SHA256,
      sha256: SAMPLE_PDF_SHA256,
      fileSize: SAMPLE_PDF_BYTES.byteLength,
      storagePath: `source-documents/${SAMPLE_PDF_SHA256}.pdf`,
      title: "SAMRUDHI SM-75th Official Gazette Results (04/10/2026)",
      sourceUrl: "https://result.keralalotteries.com/viewlotisresult.php?drawserial=75398",
      status: "UPLOADED"
    },
    graphStats: {
      nodesCount: 778,
      edgesCount: 804,
      winningResultCount: 382
    }
  };
}

function createBaselineProdInventory(count = 3): ProdInventorySnapshot {
  return {
    scheduler: {
      name: "projects/kerala-lottery-intelligence/locations/asia-south1/jobs/prod-daily-lottery-ingestion",
      state: "PAUSED",
      userUpdateTime: "2026-09-29T02:33:32.611005Z"
    },
    storageObjects: Array.from({ length: count }, (_, idx) => ({
      name: `source-documents/sha_${idx + 1}.pdf`,
      generation: `179000000000000${idx + 1}`,
      size: 87200 + idx,
      updated: "2026-10-10T10:00:00.000Z",
      md5Hash: `md5_${idx + 1}`
    })),
    firestoreDocuments: Array.from({ length: count }, (_, idx) => ({
      name: `projects/kerala-lottery-intelligence/databases/(default)/documents/documents/sha_${idx + 1}`,
      createTime: "2026-10-10T10:00:00.000000Z",
      updateTime: "2026-10-10T10:00:00.000000Z"
    }))
  };
}

describe("Production Source Integrity, Storage/Firestore Preconditions & PROD Inventory Guard Tests", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Production Artifact Reconciliation (verifyDrawArtifactReconciliation)", () => {
    it("passes when local PDF, remote PDF, Cloud Storage object, Firestore metadata, manifest, and graph counts all reconcile", () => {
      const input = createValidReconciliationInput();
      const result = verifyDrawArtifactReconciliation(input);

      expect(result.overallVerdict).toBe("PASS");
      expect(result.localSha256).toBe(SAMPLE_PDF_SHA256);
      expect(result.exactBytes).toBe(87253);
      expect(result.resultCount).toBe(382);
      expect(result.fullTicketCount).toBe(14);
      expect(result.suffixCount).toBe(368);
      expect(result.layerResults.byteShaPass).toBe(true);
      expect(result.layerResults.gcsByteShaPass).toBe(true);
      expect(result.layerResults.firestoreMetadataPass).toBe(true);
    });

    it("rejects artifact when remote, Cloud Storage, manifest, or Firestore SHA-256 disagrees with local PDF SHA-256", () => {
      const wrongSha = "0000000000000000000000000000000000000000000000000000000000000000";

      // Manifest SHA mismatch
      const manifestMismatch = createValidReconciliationInput();
      manifestMismatch.manifestRecord = {
        ...manifestMismatch.manifestRecord!,
        sha256: wrongSha
      };
      expect(() => verifyDrawArtifactReconciliation(manifestMismatch)).toThrowError(
        ReconciliationVerificationError
      );
      expect(() => verifyDrawArtifactReconciliation(manifestMismatch)).toThrowError(
        /Manifest SHA-256 .* does not match local SHA-256/
      );

      // Cloud Storage byte content mismatch (same byte length, altered content)
      const alteredGcsBytes = new Uint8Array(SAMPLE_PDF_BYTES);
      const targetIdx = alteredGcsBytes.length - 10;
      alteredGcsBytes[targetIdx] = (alteredGcsBytes[targetIdx] ?? 0) ^ 0xff;
      const gcsMismatch = createValidReconciliationInput();
      gcsMismatch.cloudStorageBytes = alteredGcsBytes;
      expect(() => verifyDrawArtifactReconciliation(gcsMismatch)).toThrowError(
        /Cloud Storage SHA-256 .* does not match local SHA-256/
      );

      // Firestore SHA mismatch
      const firestoreShaMismatch = createValidReconciliationInput();
      firestoreShaMismatch.firestoreRecord = {
        ...firestoreShaMismatch.firestoreRecord!,
        sha256: wrongSha
      };
      expect(() => verifyDrawArtifactReconciliation(firestoreShaMismatch)).toThrowError(
        /Firestore SHA-256 .* does not match local SHA-256/
      );
    });

    it("rejects artifact when remote, Cloud Storage, or Firestore file size disagrees with local byte length", () => {
      const sizeMismatch = createValidReconciliationInput();
      sizeMismatch.firestoreRecord = {
        ...sizeMismatch.firestoreRecord!,
        fileSize: 87200 // SM-75 is 87,253 bytes
      };

      expect(() => verifyDrawArtifactReconciliation(sizeMismatch)).toThrowError(
        ReconciliationVerificationError
      );
      expect(() => verifyDrawArtifactReconciliation(sizeMismatch)).toThrowError(
        /Firestore fileSize \(87200\) does not match local byte size \(87253\)/
      );

      const truncatedRemote = createValidReconciliationInput();
      truncatedRemote.remoteBytes = SAMPLE_PDF_BYTES.slice(0, 87200);
      expect(() => verifyDrawArtifactReconciliation(truncatedRemote)).toThrowError(
        /Remote byte size \(87200\) does not match local byte size \(87253\)/
      );
    });

    it("rejects artifact when parsed or manifest draw identity conflicts with expected draw identity", () => {
      const drawIdMismatch = createValidReconciliationInput();
      drawIdMismatch.parsedDrawId = "SM-76th";

      expect(() => verifyDrawArtifactReconciliation(drawIdMismatch)).toThrowError(
        ReconciliationVerificationError
      );
      expect(() => verifyDrawArtifactReconciliation(drawIdMismatch)).toThrowError(
        /Parsed drawNumber 'SM-76th' does not match expected 'SM-75th'/
      );

      const lotteryMismatch = createValidReconciliationInput();
      lotteryMismatch.parsedLotteryName = "BHAGYATHARA";
      expect(() => verifyDrawArtifactReconciliation(lotteryMismatch)).toThrowError(
        /Parsed lotteryName 'BHAGYATHARA' does not match expected 'SAMRUDHI'/
      );
    });

    it("rejects artifact when parsed or manifest draw date conflicts with expected draw date", () => {
      const dateMismatch = createValidReconciliationInput();
      dateMismatch.parsedDrawDate = "05/10/2026";

      expect(() => verifyDrawArtifactReconciliation(dateMismatch)).toThrowError(
        ReconciliationVerificationError
      );
      expect(() => verifyDrawArtifactReconciliation(dateMismatch)).toThrowError(
        /Parsed drawDate '05\/10\/2026' does not match expected '04\/10\/2026'/
      );
    });

    it("rejects artifact when parsed result count, component sum, or graph WinningResult count conflicts", () => {
      // Stale/erroneous report count (379 instead of actual 382)
      const countMismatch = createValidReconciliationInput();
      countMismatch.expectedResultCount = 379;

      expect(() => verifyDrawArtifactReconciliation(countMismatch)).toThrowError(
        ReconciliationVerificationError
      );
      expect(() => verifyDrawArtifactReconciliation(countMismatch)).toThrowError(
        /Parsed result count \(382\) does not match expected result count \(379\)/
      );

      // Component sum mismatch (fullTicketCount + suffixCount !== totalResults)
      const componentMismatch = createValidReconciliationInput();
      componentMismatch.parsedSuffixCount = 365; // 14 + 365 = 379 !== 382
      expect(() => verifyDrawArtifactReconciliation(componentMismatch)).toThrowError(
        /Component result counts \(14 full \+ 365 suffix\) do not sum to totalResults \(382\)/
      );

      // Graph WinningResult count mismatch (e.g. confusing 371 WinningNumber nodes with 382 WinningResult nodes)
      const graphMismatch = createValidReconciliationInput();
      graphMismatch.graphStats = {
        nodesCount: 778,
        edgesCount: 804,
        winningResultCount: 371
      };
      expect(() => verifyDrawArtifactReconciliation(graphMismatch)).toThrowError(
        /Graph WinningResult count \(371\) does not match parsed result count \(382\)/
      );
    });
  });

  describe("2. Production Storage Create-Only Idempotency (FirebaseStorageService & InMemoryStorageService)", () => {
    it("FirebaseStorageService.putIfAbsent sends ifGenerationMatch=0, verifies existing metadata on HTTP 412, and throws StorageAlreadyExistsError without overwriting", async () => {
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(new Response("Precondition Failed", { status: 412 }))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              size: String(SAMPLE_PDF_BYTES.byteLength),
              contentType: "application/pdf",
              generation: "1792154997562839",
              metadata: {
                sha256: SAMPLE_PDF_SHA256,
                originalFileName: "SM-75.pdf",
                retrievedAt: "2026-10-16T00:00:00.000Z"
              }
            }),
            { status: 200 }
          )
        );

      const storageService = new FirebaseStorageService({
        bucketName: "gs://kerala-lottery-intel-dev.firebasestorage.app",
        getAccessToken: async () => "mock_adc_token"
      });

      await expect(
        storageService.putIfAbsent(
          `source-documents/${SAMPLE_PDF_SHA256}.pdf`,
          SAMPLE_PDF_BYTES,
          {
            sha256: SAMPLE_PDF_SHA256,
            originalFileName: "SM-75.pdf",
            retrievedAt: "2026-10-16T00:00:00.000Z"
          }
        )
      ).rejects.toThrow(StorageAlreadyExistsError);

      expect(fetchMock).toHaveBeenCalledTimes(2);
      const calledUrl = String(fetchMock.mock.calls[0]?.[0]);
      expect(calledUrl).toContain("ifGenerationMatch=0");
      expect(calledUrl).toContain(encodeURIComponent(`source-documents/${SAMPLE_PDF_SHA256}.pdf`));
    });

    it("InMemoryStorageService.putIfAbsent preserves original object bytes and throws StorageAlreadyExistsError on duplicate write attempt", async () => {
      const memoryStorage = new InMemoryStorageService();
      const path = `source-documents/${SAMPLE_PDF_SHA256}.pdf`;

      await memoryStorage.putIfAbsent(path, SAMPLE_PDF_BYTES, {
        sha256: SAMPLE_PDF_SHA256,
        originalFileName: "SM-75.pdf",
        retrievedAt: "2026-10-16T00:00:00.000Z"
      });

      const mutatedBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
      await expect(
        memoryStorage.putIfAbsent(path, mutatedBytes, {
          sha256: SAMPLE_PDF_SHA256,
          originalFileName: "SM-75-mutated.pdf",
          retrievedAt: "2026-10-16T01:00:00.000Z"
        })
      ).rejects.toThrow(StorageAlreadyExistsError);

      const storedBytes = await memoryStorage.getObject(path);
      expect(storedBytes?.byteLength).toBe(SAMPLE_PDF_BYTES.byteLength);
    });
  });

  describe("3. Production Firestore Create-If-Absent Idempotency (FirestoreRestDocumentRepository & InMemoryDocumentRepository)", () => {
    const sampleSourceDoc: SourceDocument = {
      id: SAMPLE_PDF_SHA256,
      type: "LOTTERY_RESULT",
      title: "SAMRUDHI SM-75th Official Gazette Results (04/10/2026)",
      storagePath: `source-documents/${SAMPLE_PDF_SHA256}.pdf`,
      sha256: SAMPLE_PDF_SHA256,
      mimeType: "application/pdf",
      fileSize: SAMPLE_PDF_BYTES.byteLength,
      sourceOrganization: "Directorate of Kerala State Lotteries",
      retrievedAt: "2026-10-16T00:00:00.000Z",
      ingestionVersion: "1.0.0",
      status: "UPLOADED",
      createdAt: "2026-10-16T00:00:00.000Z"
    };

    it("FirestoreRestDocumentRepository.create sends POST with documentId and throws DocumentAlreadyExistsError on HTTP 409", async () => {
      const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { status: "ALREADY_EXISTS" } }), { status: 409 })
      );

      const repo = new FirestoreRestDocumentRepository({
        projectId: "kerala-lottery-intel-dev",
        getAccessToken: async () => "mock_adc_token"
      });

      await expect(repo.create(sampleSourceDoc)).rejects.toThrow(DocumentAlreadyExistsError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const calledUrl = String(fetchMock.mock.calls[0]?.[0]);
      expect(calledUrl).toContain(`?documentId=${SAMPLE_PDF_SHA256}`);
    });

    it("InMemoryDocumentRepository.create rejects duplicate document creation and preserves original record", async () => {
      const repo = new InMemoryDocumentRepository();
      await repo.create(sampleSourceDoc);

      await expect(
        repo.create({
          ...sampleSourceDoc,
          title: "Attempted Overwrite Title"
        })
      ).rejects.toThrow(DocumentAlreadyExistsError);

      const stored = await repo.getBySha256(SAMPLE_PDF_SHA256);
      expect(stored?.title).toBe(sampleSourceDoc.title);
    });
  });

  describe("4. Production PROD Inventory Comparison (compareProdInventories)", () => {
    it("succeeds when pre-audit and post-audit inventories have zero net state changes and scheduler is PAUSED", () => {
      const pre = createBaselineProdInventory(3);
      const post = createBaselineProdInventory(3);

      const result = compareProdInventories(pre, post, { expectedBaselineCount: 3 });
      expect(result.overallProdZeroMutation).toBe(true);
      expect(result.storage.isIdentical).toBe(true);
      expect(result.firestore.isIdentical).toBe(true);
      expect(result.scheduler.isIdentical).toBe(true);
    });

    it("rejects injected Storage object addition, deletion, generation change, size change, and timestamp change", () => {
      const pre = createBaselineProdInventory(3);

      // 1. Injected addition
      const withAddition = createBaselineProdInventory(3);
      withAddition.storageObjects.push({
        name: "source-documents/injected_extra.pdf",
        generation: "1790000000000999",
        size: 87200,
        updated: "2026-10-16T12:00:00.000Z"
      });
      expect(() =>
        compareProdInventories(pre, withAddition, { expectedBaselineCount: 3 })
      ).toThrowError(ProdInventoryMutationError);
      expect(() =>
        compareProdInventories(pre, withAddition, { expectedBaselineCount: 3 })
      ).toThrowError(/PROD Storage additions detected/);

      // 2. Injected deletion
      const withDeletion = createBaselineProdInventory(3);
      withDeletion.storageObjects.pop();
      expect(() =>
        compareProdInventories(pre, withDeletion, { expectedBaselineCount: 3 })
      ).toThrowError(/PROD Storage deletions detected/);

      // 3. Injected generation change
      const withGenChange = createBaselineProdInventory(3);
      withGenChange.storageObjects[0]!.generation = "1799999999999999";
      expect(() =>
        compareProdInventories(pre, withGenChange, { expectedBaselineCount: 3 })
      ).toThrowError(/PROD Storage generation changes detected/);

      // 4. Injected size change
      const withSizeChange = createBaselineProdInventory(3);
      withSizeChange.storageObjects[1]!.size = 99999;
      expect(() =>
        compareProdInventories(pre, withSizeChange, { expectedBaselineCount: 3 })
      ).toThrowError(/PROD Storage size changes detected/);

      // 5. Injected timestamp change
      const withTimeChange = createBaselineProdInventory(3);
      withTimeChange.storageObjects[2]!.updated = "2026-10-16T23:59:59.000Z";
      expect(() =>
        compareProdInventories(pre, withTimeChange, { expectedBaselineCount: 3 })
      ).toThrowError(/PROD Storage timestamp changes detected/);
    });

    it("rejects injected Firestore document addition, deletion, and updateTime change", () => {
      const pre = createBaselineProdInventory(3);

      // 1. Injected Firestore addition
      const withDocAddition = createBaselineProdInventory(3);
      withDocAddition.firestoreDocuments.push({
        name: "projects/kerala-lottery-intelligence/databases/(default)/documents/documents/sha_extra",
        createTime: "2026-10-16T12:00:00.000000Z",
        updateTime: "2026-10-16T12:00:00.000000Z"
      });
      expect(() =>
        compareProdInventories(pre, withDocAddition, { expectedBaselineCount: 3 })
      ).toThrowError(/PROD Firestore additions detected/);

      // 2. Injected Firestore deletion
      const withDocDeletion = createBaselineProdInventory(3);
      withDocDeletion.firestoreDocuments.shift();
      expect(() =>
        compareProdInventories(pre, withDocDeletion, { expectedBaselineCount: 3 })
      ).toThrowError(/PROD Firestore deletions detected/);

      // 3. Injected Firestore updateTime change
      const withDocUpdate = createBaselineProdInventory(3);
      withDocUpdate.firestoreDocuments[0]!.updateTime = "2026-10-16T15:30:00.000000Z";
      expect(() =>
        compareProdInventories(pre, withDocUpdate, { expectedBaselineCount: 3 })
      ).toThrowError(/PROD Firestore document timestamp changes detected/);
    });

    it("rejects injected PROD Cloud Scheduler state change or userUpdateTime change", () => {
      const pre = createBaselineProdInventory(3);

      const withEnabledScheduler = createBaselineProdInventory(3);
      withEnabledScheduler.scheduler.state = "ENABLED";
      expect(() =>
        compareProdInventories(pre, withEnabledScheduler, { expectedBaselineCount: 3 })
      ).toThrowError(/PROD Scheduler must remain PAUSED and unchanged/);

      const withSchedulerTimeChange = createBaselineProdInventory(3);
      withSchedulerTimeChange.scheduler.userUpdateTime = "2026-10-16T19:00:00Z";
      expect(() =>
        compareProdInventories(pre, withSchedulerTimeChange, { expectedBaselineCount: 3 })
      ).toThrowError(/PROD Scheduler userUpdateTime changed/);
    });
  });

  describe("5. Safe ADC Authentication & Token Scrubbing (acquireGoogleCloudAccessToken & sanitizeAuthError)", () => {
    it("acquires token via documented authFactory interface and delegates from verification scripts", async () => {
      const mockAuthFactory = () => ({
        getAccessToken: async () => "mock_short_lived_adc_token"
      });

      const token1 = await acquireGoogleCloudAccessToken({ authFactory: mockAuthFactory });
      const token2 = await getAccessToken({ authFactory: mockAuthFactory });
      const token3 = await getGcpAccessToken({ authFactory: mockAuthFactory });
      const token4 = await getAuditAccessToken({ authFactory: mockAuthFactory });

      expect(token1).toBe("mock_short_lived_adc_token");
      expect(token2).toBe("mock_short_lived_adc_token");
      expect(token3).toBe("mock_short_lived_adc_token");
      expect(token4).toBe("mock_short_lived_adc_token");
    });

    it("scrubs OAuth access tokens, refresh tokens, bearer headers, and raw OAuth JSON bodies on error", async () => {
      const rawErrorWithSecrets = new Error(
        'OAuth failure: Authorization: Bearer ya29.a0AfH6SMBxSecretTokenValue12345 body={"access_token":"ya29.secret999","refresh_token":"1//0gSecretRefreshTokenValue987","client_secret":"GOCSPX-secretValue"}'
      );

      const sanitized = sanitizeAuthError(rawErrorWithSecrets);
      expect(sanitized.message).not.toContain("ya29.a0AfH6SMBxSecretTokenValue12345");
      expect(sanitized.message).not.toContain("ya29.secret999");
      expect(sanitized.message).not.toContain("1//0gSecretRefreshTokenValue987");
      expect(sanitized.message).not.toContain("GOCSPX-secretValue");
      expect(sanitized.message).toContain("[REDACTED]");

      await expect(
        acquireGoogleCloudAccessToken({
          authFactory: () => ({
            getAccessToken: async () => {
              throw rawErrorWithSecrets;
            }
          })
        })
      ).rejects.toThrowError(/\[REDACTED\]/);
    });
  });

  describe("6. Non-Inference of Canonical Filenames & Conflict Detection", () => {
    it("refuses to guess or extrapolate government canonical filename from sequence order", () => {
      const unknownResponse = resolveCanonicalAndResponseFilename(
        "SM-75.pdf",
        SAMPLE_PDF_SHA256
      );

      expect(unknownResponse.canonicalFilename).toBeUndefined();
      expect(unknownResponse.isCanonicalResolved).toBe(false);
      expect(unknownResponse.sourceResponseFilename).toBe("SM-75.pdf");
    });

    it("flags conflict when candidate draw identity disagrees with existing draw identity", () => {
      const resolution = resolveCanonicalAndResponseFilename(
        "SM-75.pdf",
        undefined,
        undefined,
        undefined,
        "https://result.keralalotteries.com/viewlotisresult.php?drawserial=75398",
        {
          candidateDrawNumber: "SM-75th",
          existingDrawNumber: "SM-76th"
        }
      );

      expect(resolution.conflict).toBeDefined();
      expect(resolution.conflict).toContain("Draw identity mismatch");
    });

    it("assertDevEnvironment and ScheduledIngestionOrchestrator reject execution when environment is set to PROD without explicit override", async () => {
      expect(() =>
        assertDevEnvironment({
          projectId: "kerala-lottery-intelligence",
          environment: "PROD"
        })
      ).toThrowError(EnvironmentViolationError);

      const orchestrator = new ScheduledIngestionOrchestrator();
      const result = await orchestrator.execute("MANUAL", {
        projectId: "kerala-lottery-intelligence",
        environment: "PROD"
      });

      expect(result.status).toBe("FAILED");
      expect(result.failureCategory).toBe("CONFIGURATION_FAILURE");
      expect(result.lockAcquired).toBe(false);
      expect(result.failureSummary).toContain("DEV environment guard violation");
    });
  });

  describe("7. Existing-Record Content & Metadata Integrity (Fail-Closed on Corrupted Existing Objects, Documents & Result Subcollections)", () => {
    const sampleResults: WinningResult[] = [
      {
        id: "SM-75th-res-1",
        documentSha256: SAMPLE_PDF_SHA256,
        pageId: `${SAMPLE_PDF_SHA256}_1`,
        pageNumber: 1,
        sourceTextBlockOrders: [5],
        rawSourceText: "1) MA 123456 (ERNAKULAM)",
        boundingBox: { x: 10, y: 20, width: 100, height: 15, unit: "pt" },
        parserRule: "rule.result.full_ticket_v1",
        parserVersion: "v1.0.0-entity-parser",
        drawId: "SM-75th",
        prizeTierId: "SM-75th-tier-1",
        prizeTierName: "1st Prize",
        rank: 1,
        amount: 10000000,
        series: "MA",
        canonicalNumber: "123456",
        numberLength: 6,
        isSuffix: false,
        location: "ERNAKULAM",
        confidence: 1.0,
        validationStatus: "VALID",
        createdAt: "2026-10-16T00:00:00.000Z"
      },
      {
        id: "SM-75th-res-2",
        documentSha256: SAMPLE_PDF_SHA256,
        pageId: `${SAMPLE_PDF_SHA256}_1`,
        pageNumber: 1,
        sourceTextBlockOrders: [12],
        rawSourceText: "0123",
        boundingBox: { x: 10, y: 50, width: 40, height: 12, unit: "pt" },
        parserRule: "rule.result.suffix_number_v1",
        parserVersion: "v1.0.0-entity-parser",
        drawId: "SM-75th",
        prizeTierId: "SM-75th-tier-4",
        prizeTierName: "4th Prize",
        rank: 4,
        amount: 5000,
        canonicalNumber: "0123",
        numberLength: 4,
        isSuffix: true,
        confidence: 1.0,
        validationStatus: "VALID",
        createdAt: "2026-10-16T00:00:00.000Z"
      }
    ];

    it("rejects existing GCS object when stored bytes are corrupted (same byte length or different byte length) and does not overwrite", async () => {
      const storage = new InMemoryStorageService();
      const docRepo = new InMemoryDocumentRepository();
      const service = new SourceIngestionService({
        storageService: storage,
        documentRepository: docRepo
      });

      // First ingest succeeds and stores valid record + valid bytes
      const initial = await service.ingest({
        fileBuffer: SAMPLE_PDF_BYTES,
        fileName: "SM-75.pdf",
        title: "SM-75th — SUKARMA",
        expectedDrawId: "SM-75th"
      });
      expect(initial.action).toBe("CREATED");

      // Re-ingesting identical valid artifact verifies existing bytes & metadata and returns EXISTING
      const validRepeat = await service.ingest({
        fileBuffer: SAMPLE_PDF_BYTES,
        fileName: "SM-75.pdf",
        title: "SM-75th — SUKARMA",
        expectedDrawId: "SM-75th"
      });
      expect(validRepeat.action).toBe("EXISTING");

      // Corrupt the existing stored object bytes in-place (same length, flipped byte -> different SHA-256)
      const storagePath = `source-documents/${SAMPLE_PDF_SHA256}.pdf`;
      const storedObj = storage.get(storagePath);
      expect(storedObj).toBeDefined();
      storedObj![storedObj!.length - 8] = (storedObj![storedObj!.length - 8] ?? 0) ^ 0xff;

      // Subsequent ingestion attempt must fail closed with StorageIntegrityError and NOT overwrite corrupted bytes
      await expect(
        service.ingest({
          fileBuffer: SAMPLE_PDF_BYTES,
          fileName: "SM-75.pdf",
          title: "SM-75th — SUKARMA",
          expectedDrawId: "SM-75th"
        })
      ).rejects.toThrow(StorageIntegrityError);
      await expect(
        service.ingest({
          fileBuffer: SAMPLE_PDF_BYTES,
          fileName: "SM-75.pdf",
          title: "SM-75th — SUKARMA",
          expectedDrawId: "SM-75th"
        })
      ).rejects.toThrow(/Existing storage object content SHA-256 .* does not match expected/);
    });

    it("rejects orphan existing GCS object with corrupted bytes or mismatched metadata before creating a Firestore document", async () => {
      const storage = new InMemoryStorageService();
      const docRepo = new InMemoryDocumentRepository();
      const service = new SourceIngestionService({
        storageService: storage,
        documentRepository: docRepo
      });

      const storagePath = `source-documents/${SAMPLE_PDF_SHA256}.pdf`;
      // Pre-populate storage with corrupted bytes under the expected SHA path
      const corruptedBytes = new Uint8Array(SAMPLE_PDF_BYTES);
      corruptedBytes[40] = (corruptedBytes[40] ?? 0) ^ 0xff;
      await storage.putIfAbsent(storagePath, corruptedBytes, {
        sha256: SAMPLE_PDF_SHA256,
        originalFileName: "SM-75.pdf",
        retrievedAt: "2026-10-16T00:00:00.000Z"
      });

      await expect(
        service.ingest({
          fileBuffer: SAMPLE_PDF_BYTES,
          fileName: "SM-75.pdf",
          title: "SM-75th — SUKARMA",
          expectedDrawId: "SM-75th"
        })
      ).rejects.toThrow(StorageIntegrityError);

      // Verify no Firestore document was created for the corrupted storage object
      const doc = await docRepo.getBySha256(SAMPLE_PDF_SHA256);
      expect(doc).toBeNull();
    });

    it("FirebaseStorageService.putIfAbsent fails closed with StorageIntegrityError when existing GCS object on HTTP 412 has mismatched size, SHA-256, or drawId", async () => {
      const storageService = new FirebaseStorageService({
        bucketName: "gs://kerala-lottery-intel-dev.firebasestorage.app",
        getAccessToken: async () => "mock_adc_token"
      });

      // 1. Existing object has wrong byte size
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(new Response("Precondition Failed", { status: 412 }))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              size: "12345",
              contentType: "application/pdf",
              metadata: {
                sha256: SAMPLE_PDF_SHA256,
                originalFileName: "SM-75.pdf",
                retrievedAt: "2026-10-16T00:00:00.000Z"
              }
            }),
            { status: 200 }
          )
        );

      await expect(
        storageService.putIfAbsent(
          `source-documents/${SAMPLE_PDF_SHA256}.pdf`,
          SAMPLE_PDF_BYTES,
          {
            sha256: SAMPLE_PDF_SHA256,
            originalFileName: "SM-75.pdf",
            retrievedAt: "2026-10-16T00:00:00.000Z"
          }
        )
      ).rejects.toThrow(StorageIntegrityError);

      vi.restoreAllMocks();

      // 2. Existing object has wrong drawId metadata
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(new Response("Precondition Failed", { status: 412 }))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              size: String(SAMPLE_PDF_BYTES.byteLength),
              contentType: "application/pdf",
              metadata: {
                sha256: SAMPLE_PDF_SHA256,
                originalFileName: "SM-75.pdf",
                retrievedAt: "2026-10-16T00:00:00.000Z",
                drawId: "SM-999th"
              }
            }),
            { status: 200 }
          )
        );

      await expect(
        storageService.putIfAbsent(
          `source-documents/${SAMPLE_PDF_SHA256}.pdf`,
          SAMPLE_PDF_BYTES,
          {
            sha256: SAMPLE_PDF_SHA256,
            originalFileName: "SM-75.pdf",
            retrievedAt: "2026-10-16T00:00:00.000Z",
            customMetadata: {
              drawId: "SM-75th"
            }
          }
        )
      ).rejects.toThrow(/drawId 'SM-999th' does not match expected 'SM-75th'/);
    });

    it("rejects existing Firestore document when stored metadata (fileSize, storagePath, status, title, or provenance) is corrupted", async () => {
      const storage = new InMemoryStorageService();
      const docRepo = new InMemoryDocumentRepository();
      const service = new SourceIngestionService({
        storageService: storage,
        documentRepository: docRepo
      });

      await storage.putIfAbsent(`source-documents/${SAMPLE_PDF_SHA256}.pdf`, SAMPLE_PDF_BYTES, {
        sha256: SAMPLE_PDF_SHA256,
        originalFileName: "SM-75.pdf",
        retrievedAt: "2026-10-16T00:00:00.000Z"
      });

      // Seed an existing Firestore document with a corrupted fileSize (99999 instead of 87253)
      await docRepo.create({
        id: SAMPLE_PDF_SHA256,
        type: "LOTTERY_RESULT",
        title: "SM-75.pdf",
        storagePath: `source-documents/${SAMPLE_PDF_SHA256}.pdf`,
        sha256: SAMPLE_PDF_SHA256,
        mimeType: "application/pdf",
        fileSize: 99999,
        sourceOrganization: "Directorate of Kerala State Lotteries",
        retrievedAt: "2026-10-16T00:00:00.000Z",
        ingestionVersion: "1.0.0",
        status: "UPLOADED",
        createdAt: "2026-10-16T00:00:00.000Z"
      });

      await expect(
        service.ingest({
          fileBuffer: SAMPLE_PDF_BYTES,
          fileName: "SM-75.pdf"
        })
      ).rejects.toThrow(DocumentIntegrityError);
      await expect(
        service.ingest({
          fileBuffer: SAMPLE_PDF_BYTES,
          fileName: "SM-75.pdf"
        })
      ).rejects.toThrow(/Existing Firestore document .* has fileSize 99999, expected 87253/);

      // Ensure corrupted record was not silently overwritten
      const existing = await docRepo.getBySha256(SAMPLE_PDF_SHA256);
      expect(existing?.fileSize).toBe(99999);
    });

    it("rejects existing result subcollection / WinningResult & PrizeTier records when content or identifiers differ, even when counts match", async () => {
      const resultRepo = new InMemoryWinningResultRepository();
      const tierRepo = new InMemoryPrizeTierRepository();

      await resultRepo.saveBatch(sampleResults);

      // Saving identical results is idempotent
      await expect(resultRepo.saveBatch(sampleResults)).resolves.toBeUndefined();

      // Saving an existing result ID with a mutated canonicalNumber fails closed with DocumentIntegrityError
      await expect(
        resultRepo.save({
          ...sampleResults[0]!,
          canonicalNumber: "999999"
        })
      ).rejects.toThrow(DocumentIntegrityError);
      await expect(
        resultRepo.save({
          ...sampleResults[0]!,
          canonicalNumber: "999999"
        })
      ).rejects.toThrow(/canonicalNumber \('123456' !== '999999'\)/);

      // Original stored result remains untouched
      const storedResults = await resultRepo.getByDocumentSha256(SAMPLE_PDF_SHA256);
      expect(
        storedResults.find((r: WinningResult) => r.id === "SM-75th-res-1")?.canonicalNumber
      ).toBe("123456");

      // PrizeTier repository also fails closed on mutated amount/label for an existing tier ID
      const tier: PrizeTier = {
        id: "SM-75th-tier-1",
        documentSha256: SAMPLE_PDF_SHA256,
        pageId: `${SAMPLE_PDF_SHA256}_1`,
        pageNumber: 1,
        sourceTextBlockOrders: [4],
        rawSourceText: "1st Prize Rs :10000000/-",
        boundingBox: { x: 10, y: 10, width: 100, height: 15, unit: "pt" },
        parserRule: "rule.tier.declaration_v1",
        parserVersion: "v1.0.0-entity-parser",
        name: "1st Prize",
        rank: 1,
        tierType: "RANKED",
        amount: 10000000,
        currency: "INR",
        isSuffix: false,
        expectedLength: 6,
        confidence: 1.0,
        createdAt: "2026-10-16T00:00:00.000Z"
      };
      await tierRepo.save(tier);
      await expect(tierRepo.save(tier)).resolves.toBeUndefined();
      await expect(
        tierRepo.save({
          ...tier,
          amount: 5000000
        })
      ).rejects.toThrow(DocumentIntegrityError);

      // SourceIngestionService verifies existing WinningResult records against expectedResults
      const storage = new InMemoryStorageService();
      const docRepo = new InMemoryDocumentRepository();
      const serviceWithResults = new SourceIngestionService({
        storageService: storage,
        documentRepository: docRepo,
        winningResultRepository: resultRepo
      });

      await serviceWithResults.ingest({
        fileBuffer: SAMPLE_PDF_BYTES,
        fileName: "SM-75.pdf",
        title: "SM-75th — SUKARMA",
        expectedDrawId: "SM-75th",
        expectedResults: sampleResults
      });

      // Same count (2), same IDs, but expected canonicalNumber differs from stored record -> fails closed!
      await expect(
        serviceWithResults.ingest({
          fileBuffer: SAMPLE_PDF_BYTES,
          fileName: "SM-75.pdf",
          title: "SM-75th — SUKARMA",
          expectedDrawId: "SM-75th",
          expectedResults: [
            {
              ...sampleResults[0]!,
              canonicalNumber: "654321"
            },
            sampleResults[1]!
          ]
        })
      ).rejects.toThrow(DocumentIntegrityError);

      // verifyDrawArtifactReconciliation also rejects existing result content mismatch when counts match
      const reconWithValidResults = createValidReconciliationInput();
      reconWithValidResults.expectedResultRecords = [
        { id: "SM-75th-res-1", canonicalNumber: "123456", prizeTierId: "SM-75th-tier-1", rank: 1, isSuffix: false, series: "MA" },
        { id: "SM-75th-res-2", canonicalNumber: "0123", prizeTierId: "SM-75th-tier-4", rank: 4, isSuffix: true }
      ];
      reconWithValidResults.existingResultRecords = [
        { id: "SM-75th-res-1", canonicalNumber: "123456", prizeTierId: "SM-75th-tier-1", rank: 1, isSuffix: false, series: "MA" },
        { id: "SM-75th-res-2", canonicalNumber: "9999", prizeTierId: "SM-75th-tier-4", rank: 4, isSuffix: true }
      ];
      expect(() => verifyDrawArtifactReconciliation(reconWithValidResults)).toThrowError(
        /Existing result 'SM-75th-res-2' canonicalNumber '9999' does not match expected '0123'/
      );
    });

    it("FirestoreRestWinningResultRepository.save verifies existing Firestore document on HTTP 409 and fails closed on content mismatch", async () => {
      const repo = new FirestoreRestWinningResultRepository({
        projectId: "kerala-lottery-intel-dev",
        getAccessToken: async () => "mock_adc_token"
      });

      // Mock initial GET returning 404, POST returning 409 ALREADY_EXISTS, followed by recovery GET returning an existing result with corrupted canonicalNumber
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(new Response("Not Found", { status: 404 }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: { status: "ALREADY_EXISTS" } }), { status: 409 })
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              name: "projects/kerala-lottery-intel-dev/databases/(default)/documents/winning_results/SM-75th-res-1",
              fields: {
                id: { stringValue: "SM-75th-res-1" },
                documentSha256: { stringValue: SAMPLE_PDF_SHA256 },
                pageId: { stringValue: `${SAMPLE_PDF_SHA256}_1` },
                pageNumber: { integerValue: "1" },
                sourceTextBlockOrders: { arrayValue: { values: [{ integerValue: "5" }] } },
                rawSourceText: { stringValue: "1) MA 123456 (ERNAKULAM)" },
                parserRule: { stringValue: "rule.result.full_ticket_v1" },
                parserVersion: { stringValue: "v1.0.0-entity-parser" },
                drawId: { stringValue: "SM-75th" },
                prizeTierId: { stringValue: "SM-75th-tier-1" },
                prizeTierName: { stringValue: "1st Prize" },
                rank: { integerValue: "1" },
                amount: { integerValue: "10000000" },
                canonicalNumber: { stringValue: "000000" },
                numberLength: { integerValue: "6" },
                series: { stringValue: "MA" },
                isSuffix: { booleanValue: false },
                location: { stringValue: "ERNAKULAM" },
                confidence: { doubleValue: 1.0 },
                validationStatus: { stringValue: "VALID" },
                createdAt: { stringValue: "2026-10-16T00:00:00.000Z" }
              }
            }),
            { status: 200 }
          )
        );

      await expect(repo.save(sampleResults[0]!)).rejects.toThrow(DocumentIntegrityError);
    });
  });
});
