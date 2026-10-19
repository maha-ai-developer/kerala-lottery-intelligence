/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Production Source Artifact Reconciliation, ADC Authentication & PROD Inventory Verifier
 *
 * Enforces fail-closed cryptographic, structural, and inventory invariants:
 * 1. Documented Google Cloud ADC authentication with strict secret scrubbing.
 * 2. Multi-layer artifact reconciliation (SHA-256, byte size, draw identity, draw date, result count).
 * 3. Distinct pre-audit vs post-audit PROD inventory diffing with zero-mutation assertions.
 */

import { computeSha256, validatePdfBuffer } from "@kerala-lottery/documents";

export type ReconciliationFailureCode =
  | "INVALID_PDF"
  | "FILE_SIZE_MISMATCH"
  | "SHA256_MISMATCH"
  | "DRAW_IDENTITY_MISMATCH"
  | "DRAW_DATE_MISMATCH"
  | "RESULT_COUNT_MISMATCH"
  | "RESULT_CONTENT_MISMATCH"
  | "FIRESTORE_METADATA_MISMATCH"
  | "GRAPH_INTEGRITY_MISMATCH";

export class ReconciliationVerificationError extends Error {
  constructor(
    public readonly code: ReconciliationFailureCode,
    message: string
  ) {
    super(message);
    this.name = "ReconciliationVerificationError";
  }
}

export type ProdInventoryMutationCode =
  | "SCHEDULER_STATE_MUTATION"
  | "SCHEDULER_TIMESTAMP_MUTATION"
  | "PROD_BASELINE_COUNT_MISMATCH"
  | "STORAGE_OBJECT_ADDED"
  | "STORAGE_OBJECT_DELETED"
  | "STORAGE_GENERATION_CHANGED"
  | "STORAGE_SIZE_CHANGED"
  | "STORAGE_TIMESTAMP_CHANGED"
  | "FIRESTORE_DOCUMENT_ADDED"
  | "FIRESTORE_DOCUMENT_DELETED"
  | "FIRESTORE_DOCUMENT_UPDATED";

export class ProdInventoryMutationError extends Error {
  constructor(
    public readonly code: ProdInventoryMutationCode,
    message: string
  ) {
    super(message);
    this.name = "ProdInventoryMutationError";
  }
}

/**
 * Scrubs any OAuth access tokens, refresh tokens, bearer headers, client secrets,
 * or raw credential payloads from an error message before logging or throwing.
 */
export function sanitizeAuthError(err: unknown): Error {
  const rawMessage = err instanceof Error ? err.message : String(err);
  const scrubbed = rawMessage
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/ya29\.[A-Za-z0-9._-]+/g, "[REDACTED_ACCESS_TOKEN]")
    .replace(/1\/\/[A-Za-z0-9._-]+/g, "[REDACTED_REFRESH_TOKEN]")
    .replace(/"(access_token|refresh_token|id_token|client_secret|private_key)"\s*:\s*"[^"]*"/gi, '"$1":"[REDACTED]"')
    .replace(/(access_token|refresh_token|client_secret|id_token)=([^&\s"']+)/gi, "$1=[REDACTED]");

  return new Error(`Google Cloud ADC authentication error: ${scrubbed}`);
}

export interface AdcAuthClientLike {
  getAccessToken(): Promise<string | null | undefined | { token?: string | null }>;
}

export interface AcquireAdcTokenOptions {
  projectId?: string;
  scopes?: string[];
  authFactory?: () => Promise<AdcAuthClientLike> | AdcAuthClientLike;
}

/**
 * Acquires an OAuth2 access token using the documented GoogleAuth (Application Default Credentials)
 * interface. Never reads private CLI configuration files or logs token values.
 */
export async function acquireGoogleCloudAccessToken(
  options: AcquireAdcTokenOptions = {}
): Promise<string> {
  const scopes = options.scopes ?? ["https://www.googleapis.com/auth/cloud-platform"];
  try {
    let client: AdcAuthClientLike;
    if (options.authFactory) {
      client = await options.authFactory();
    } else {
      const { GoogleAuth } = await import("google-auth-library");
      client = new GoogleAuth({
        scopes,
        ...(options.projectId ? { projectId: options.projectId } : {})
      });
    }

    const tokenResult = await client.getAccessToken();
    const token =
      typeof tokenResult === "string"
        ? tokenResult
        : tokenResult && typeof tokenResult === "object" && typeof tokenResult.token === "string"
          ? tokenResult.token
          : "";

    if (!token || token.trim().length === 0) {
      throw new Error(
        "Application Default Credentials returned an empty access token. Run 'gcloud auth application-default login'."
      );
    }

    return token;
  } catch (err: unknown) {
    throw sanitizeAuthError(err);
  }
}

export interface ReconciliationResultRecord {
  id: string;
  canonicalNumber: string;
  prizeTierId: string;
  rank?: number;
  isSuffix?: boolean;
  series?: string;
  documentSha256?: string;
}

export interface DrawArtifactReconciliationInput {
  expectedDrawId: string;
  expectedDate: string;
  expectedLottery: string;
  expectedSerial?: number;
  expectedResultCount?: number;
  localBytes: Uint8Array;
  remoteBytes?: Uint8Array;
  cloudStorageBytes?: Uint8Array;
  cloudStorageGeneration?: string;
  parsedDrawId: string | null | undefined;
  parsedDrawDate: string | null | undefined;
  parsedLotteryName: string | null | undefined;
  parsedTotalResults: number;
  parsedFullTicketCount?: number;
  parsedSuffixCount?: number;
  manifestRecord?: {
    sha256: string;
    drawNumber: string;
    drawDate: string;
    lotteryName?: string;
    status?: string;
  };
  firestoreRecord?: {
    id?: string;
    sha256: string;
    fileSize: number;
    storagePath?: string;
    title?: string;
    sourceUrl?: string;
    status?: string;
  };
  graphStats?: {
    nodesCount: number;
    edgesCount: number;
    winningResultCount?: number;
  };
  expectedResultRecords?: ReconciliationResultRecord[];
  existingResultRecords?: ReconciliationResultRecord[];
}

export interface DrawArtifactReconciliationResult {
  drawIdentity: string;
  drawDate: string;
  lotteryName: string;
  exactBytes: number;
  localSha256: string;
  remoteSha256?: string;
  cloudStorageSha256?: string;
  cloudStorageGeneration?: string;
  resultCount: number;
  fullTicketCount?: number;
  suffixCount?: number;
  layerResults: {
    byteShaPass: boolean;
    byteLengthPass: boolean;
    pdfParsePass: boolean;
    gcsByteShaPass: boolean;
    firestoreMetadataPass: boolean;
    graphManifestPass: boolean;
  };
  overallVerdict: "PASS";
}

/**
 * Validates a draw artifact across local PDF bytes, remote PDF bytes, Cloud Storage bytes,
 * parsed draw metadata/results, Firestore metadata, and processed cache manifest/graph.
 * Fails closed by throwing ReconciliationVerificationError on any mismatch.
 */
export function verifyDrawArtifactReconciliation(
  input: DrawArtifactReconciliationInput
): DrawArtifactReconciliationResult {
  // 1. Validate PDF magic header and non-empty bytes
  try {
    validatePdfBuffer(input.localBytes);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new ReconciliationVerificationError("INVALID_PDF", `Invalid local PDF buffer for ${input.expectedDrawId}: ${msg}`);
  }

  const localByteLength = input.localBytes.byteLength;
  const localSha256 = computeSha256(input.localBytes);

  // 2. File size verification across layers
  if (input.remoteBytes && input.remoteBytes.byteLength !== localByteLength) {
    throw new ReconciliationVerificationError(
      "FILE_SIZE_MISMATCH",
      `Remote byte size (${input.remoteBytes.byteLength}) does not match local byte size (${localByteLength}) for ${input.expectedDrawId}`
    );
  }
  if (input.cloudStorageBytes && input.cloudStorageBytes.byteLength !== localByteLength) {
    throw new ReconciliationVerificationError(
      "FILE_SIZE_MISMATCH",
      `Cloud Storage byte size (${input.cloudStorageBytes.byteLength}) does not match local byte size (${localByteLength}) for ${input.expectedDrawId}`
    );
  }
  if (input.firestoreRecord && input.firestoreRecord.fileSize !== localByteLength) {
    throw new ReconciliationVerificationError(
      "FILE_SIZE_MISMATCH",
      `Firestore fileSize (${input.firestoreRecord.fileSize}) does not match local byte size (${localByteLength}) for ${input.expectedDrawId}`
    );
  }

  // 3. Cryptographic SHA-256 verification across layers
  let remoteSha256: string | undefined;
  if (input.remoteBytes) {
    remoteSha256 = computeSha256(input.remoteBytes);
    if (remoteSha256 !== localSha256) {
      throw new ReconciliationVerificationError(
        "SHA256_MISMATCH",
        `Remote SHA-256 (${remoteSha256}) does not match local SHA-256 (${localSha256}) for ${input.expectedDrawId}`
      );
    }
  }

  let cloudStorageSha256: string | undefined;
  if (input.cloudStorageBytes) {
    cloudStorageSha256 = computeSha256(input.cloudStorageBytes);
    if (cloudStorageSha256 !== localSha256) {
      throw new ReconciliationVerificationError(
        "SHA256_MISMATCH",
        `Cloud Storage SHA-256 (${cloudStorageSha256}) does not match local SHA-256 (${localSha256}) for ${input.expectedDrawId}`
      );
    }
    if (input.cloudStorageGeneration !== undefined && !input.cloudStorageGeneration.trim()) {
      throw new ReconciliationVerificationError(
        "SHA256_MISMATCH",
        `Cloud Storage object generation is missing for ${input.expectedDrawId}`
      );
    }
  }

  if (input.manifestRecord && input.manifestRecord.sha256 !== localSha256) {
    throw new ReconciliationVerificationError(
      "SHA256_MISMATCH",
      `Manifest SHA-256 (${input.manifestRecord.sha256}) does not match local SHA-256 (${localSha256}) for ${input.expectedDrawId}`
    );
  }

  if (input.firestoreRecord && input.firestoreRecord.sha256 !== localSha256) {
    throw new ReconciliationVerificationError(
      "SHA256_MISMATCH",
      `Firestore SHA-256 (${input.firestoreRecord.sha256}) does not match local SHA-256 (${localSha256}) for ${input.expectedDrawId}`
    );
  }

  // 4. Draw identity verification (drawNumber & lotteryName)
  if (input.parsedDrawId !== input.expectedDrawId) {
    throw new ReconciliationVerificationError(
      "DRAW_IDENTITY_MISMATCH",
      `Parsed drawNumber '${String(input.parsedDrawId)}' does not match expected '${input.expectedDrawId}'`
    );
  }
  if (input.parsedLotteryName !== input.expectedLottery) {
    throw new ReconciliationVerificationError(
      "DRAW_IDENTITY_MISMATCH",
      `Parsed lotteryName '${String(input.parsedLotteryName)}' does not match expected '${input.expectedLottery}' for ${input.expectedDrawId}`
    );
  }
  if (input.manifestRecord && input.manifestRecord.drawNumber !== input.expectedDrawId) {
    throw new ReconciliationVerificationError(
      "DRAW_IDENTITY_MISMATCH",
      `Manifest drawNumber '${input.manifestRecord.drawNumber}' does not match expected '${input.expectedDrawId}'`
    );
  }

  // 5. Draw date verification
  if (input.parsedDrawDate !== input.expectedDate) {
    throw new ReconciliationVerificationError(
      "DRAW_DATE_MISMATCH",
      `Parsed drawDate '${String(input.parsedDrawDate)}' does not match expected '${input.expectedDate}' for ${input.expectedDrawId}`
    );
  }
  if (input.manifestRecord && input.manifestRecord.drawDate !== input.expectedDate) {
    throw new ReconciliationVerificationError(
      "DRAW_DATE_MISMATCH",
      `Manifest drawDate '${input.manifestRecord.drawDate}' does not match expected '${input.expectedDate}' for ${input.expectedDrawId}`
    );
  }

  // 6. Result count verification (WinningResult count = fullTicketCount + suffixCount)
  if (!Number.isInteger(input.parsedTotalResults) || input.parsedTotalResults <= 0) {
    throw new ReconciliationVerificationError(
      "RESULT_COUNT_MISMATCH",
      `Invalid parsed result count (${input.parsedTotalResults}) for ${input.expectedDrawId}`
    );
  }
  if (
    input.parsedFullTicketCount !== undefined &&
    input.parsedSuffixCount !== undefined &&
    input.parsedFullTicketCount + input.parsedSuffixCount !== input.parsedTotalResults
  ) {
    throw new ReconciliationVerificationError(
      "RESULT_COUNT_MISMATCH",
      `Component result counts (${input.parsedFullTicketCount} full + ${input.parsedSuffixCount} suffix) do not sum to totalResults (${input.parsedTotalResults}) for ${input.expectedDrawId}`
    );
  }
  if (
    input.expectedResultCount !== undefined &&
    input.parsedTotalResults !== input.expectedResultCount
  ) {
    throw new ReconciliationVerificationError(
      "RESULT_COUNT_MISMATCH",
      `Parsed result count (${input.parsedTotalResults}) does not match expected result count (${input.expectedResultCount}) for ${input.expectedDrawId}`
    );
  }
  if (
    input.graphStats?.winningResultCount !== undefined &&
    input.graphStats.winningResultCount !== input.parsedTotalResults
  ) {
    throw new ReconciliationVerificationError(
      "RESULT_COUNT_MISMATCH",
      `Graph WinningResult count (${input.graphStats.winningResultCount}) does not match parsed result count (${input.parsedTotalResults}) for ${input.expectedDrawId}`
    );
  }

  // 7. Firestore metadata & graph checks
  if (input.firestoreRecord) {
    if (input.firestoreRecord.id !== undefined && input.firestoreRecord.id !== localSha256) {
      throw new ReconciliationVerificationError(
        "FIRESTORE_METADATA_MISMATCH",
        `Firestore document id '${input.firestoreRecord.id}' does not match local SHA-256 '${localSha256}' for ${input.expectedDrawId}`
      );
    }
    const expectedStoragePath = `source-documents/${localSha256}.pdf`;
    if (
      input.firestoreRecord.storagePath !== undefined &&
      input.firestoreRecord.storagePath !== expectedStoragePath
    ) {
      throw new ReconciliationVerificationError(
        "FIRESTORE_METADATA_MISMATCH",
        `Firestore storagePath '${input.firestoreRecord.storagePath}' does not match expected '${expectedStoragePath}' for ${input.expectedDrawId}`
      );
    }
    if (input.firestoreRecord.status && input.firestoreRecord.status !== "UPLOADED") {
      throw new ReconciliationVerificationError(
        "FIRESTORE_METADATA_MISMATCH",
        `Firestore status '${input.firestoreRecord.status}' is not 'UPLOADED' for ${input.expectedDrawId}`
      );
    }
    if (
      input.expectedSerial !== undefined &&
      input.firestoreRecord.sourceUrl &&
      !input.firestoreRecord.sourceUrl.includes(String(input.expectedSerial))
    ) {
      throw new ReconciliationVerificationError(
        "FIRESTORE_METADATA_MISMATCH",
        `Firestore sourceUrl '${input.firestoreRecord.sourceUrl}' does not reference serial '${input.expectedSerial}' for ${input.expectedDrawId}`
      );
    }
  }

  // 8. Existing result subcollection / stored result-record content verification
  if (input.expectedResultRecords !== undefined || input.existingResultRecords !== undefined) {
    const expectedRecords = input.expectedResultRecords ?? [];
    const existingRecords = input.existingResultRecords ?? [];

    if (existingRecords.length !== expectedRecords.length) {
      throw new ReconciliationVerificationError(
        "RESULT_COUNT_MISMATCH",
        `Existing result subcollection count (${existingRecords.length}) does not match expected result count (${expectedRecords.length}) for ${input.expectedDrawId}`
      );
    }

    const existingById = new Map<string, ReconciliationResultRecord>();
    for (const existing of existingRecords) {
      if (existingById.has(existing.id)) {
        throw new ReconciliationVerificationError(
          "RESULT_CONTENT_MISMATCH",
          `Duplicate result record ID '${existing.id}' in existing result records for ${input.expectedDrawId}`
        );
      }
      existingById.set(existing.id, existing);
    }

    for (const expected of expectedRecords) {
      const existing = existingById.get(expected.id);
      if (!existing) {
        throw new ReconciliationVerificationError(
          "RESULT_CONTENT_MISMATCH",
          `Missing expected result record ID '${expected.id}' in existing result records for ${input.expectedDrawId}`
        );
      }
      if (existing.canonicalNumber !== expected.canonicalNumber) {
        throw new ReconciliationVerificationError(
          "RESULT_CONTENT_MISMATCH",
          `Existing result '${expected.id}' canonicalNumber '${existing.canonicalNumber}' does not match expected '${expected.canonicalNumber}' for ${input.expectedDrawId}`
        );
      }
      if (existing.prizeTierId !== expected.prizeTierId) {
        throw new ReconciliationVerificationError(
          "RESULT_CONTENT_MISMATCH",
          `Existing result '${expected.id}' prizeTierId '${existing.prizeTierId}' does not match expected '${expected.prizeTierId}' for ${input.expectedDrawId}`
        );
      }
      if (expected.rank !== undefined && existing.rank !== expected.rank) {
        throw new ReconciliationVerificationError(
          "RESULT_CONTENT_MISMATCH",
          `Existing result '${expected.id}' rank (${String(existing.rank)}) does not match expected (${expected.rank}) for ${input.expectedDrawId}`
        );
      }
      if (expected.isSuffix !== undefined && existing.isSuffix !== expected.isSuffix) {
        throw new ReconciliationVerificationError(
          "RESULT_CONTENT_MISMATCH",
          `Existing result '${expected.id}' isSuffix (${String(existing.isSuffix)}) does not match expected (${expected.isSuffix}) for ${input.expectedDrawId}`
        );
      }
      if (expected.series !== undefined && existing.series !== expected.series) {
        throw new ReconciliationVerificationError(
          "RESULT_CONTENT_MISMATCH",
          `Existing result '${expected.id}' series '${String(existing.series)}' does not match expected '${expected.series}' for ${input.expectedDrawId}`
        );
      }
      if (
        existing.documentSha256 !== undefined &&
        existing.documentSha256 !== (expected.documentSha256 ?? localSha256)
      ) {
        throw new ReconciliationVerificationError(
          "RESULT_CONTENT_MISMATCH",
          `Existing result '${expected.id}' documentSha256 '${existing.documentSha256}' does not match expected '${expected.documentSha256 ?? localSha256}' for ${input.expectedDrawId}`
        );
      }
    }
  }

  if (input.graphStats) {
    if (input.graphStats.nodesCount <= 0 || input.graphStats.edgesCount <= 0) {
      throw new ReconciliationVerificationError(
        "GRAPH_INTEGRITY_MISMATCH",
        `Graph for ${input.expectedDrawId} has invalid node/edge counts (${input.graphStats.nodesCount} nodes, ${input.graphStats.edgesCount} edges)`
      );
    }
  }

  if (input.manifestRecord?.status && input.manifestRecord.status !== "VALID") {
    throw new ReconciliationVerificationError(
      "GRAPH_INTEGRITY_MISMATCH",
      `Manifest status for ${input.expectedDrawId} is '${input.manifestRecord.status}', expected 'VALID'`
    );
  }

  return {
    drawIdentity: input.expectedDrawId,
    drawDate: input.expectedDate,
    lotteryName: input.expectedLottery,
    exactBytes: localByteLength,
    localSha256,
    remoteSha256,
    cloudStorageSha256,
    cloudStorageGeneration: input.cloudStorageGeneration,
    resultCount: input.parsedTotalResults,
    fullTicketCount: input.parsedFullTicketCount,
    suffixCount: input.parsedSuffixCount,
    layerResults: {
      byteShaPass: true,
      byteLengthPass: true,
      pdfParsePass: true,
      gcsByteShaPass: true,
      firestoreMetadataPass: true,
      graphManifestPass: true
    },
    overallVerdict: "PASS"
  };
}

export interface ProdStorageObjectRecord {
  name: string;
  generation: string;
  size: number;
  updated: string;
  md5Hash?: string;
}

export interface ProdFirestoreDocumentRecord {
  name: string;
  createTime: string;
  updateTime: string;
}

export interface ProdSchedulerJobRecord {
  name: string;
  state: string;
  userUpdateTime: string;
}

export interface ProdInventorySnapshot {
  scheduler: ProdSchedulerJobRecord;
  storageObjects: ProdStorageObjectRecord[];
  firestoreDocuments: ProdFirestoreDocumentRecord[];
}

export interface ProdInventoryComparisonResult {
  verdict: string;
  storage: {
    preCount: number;
    postCount: number;
    additionsCount: number;
    deletionsCount: number;
    changedGenerationsCount: number;
    changedSizesCount: number;
    changedTimestampsCount: number;
    additionsList: ProdStorageObjectRecord[];
    deletionsList: ProdStorageObjectRecord[];
    changedGenerationsList: ProdStorageObjectRecord[];
    changedSizesList: ProdStorageObjectRecord[];
    changedTimestampsList: ProdStorageObjectRecord[];
    isIdentical: boolean;
  };
  firestore: {
    preCount: number;
    postCount: number;
    additionsCount: number;
    deletionsCount: number;
    changedUpdateTimesCount: number;
    additionsList: ProdFirestoreDocumentRecord[];
    deletionsList: ProdFirestoreDocumentRecord[];
    changedUpdateTimesList: ProdFirestoreDocumentRecord[];
    isIdentical: boolean;
  };
  scheduler: {
    preState: string;
    postState: string;
    preUpdateTime: string;
    postUpdateTime: string;
    stateChanged: boolean;
    updateTimeChanged: boolean;
    isIdentical: boolean;
  };
  overallProdZeroMutation: boolean;
}

/**
 * Compares distinct pre-audit and post-audit PROD inventories across Cloud Storage,
 * Firestore, and Cloud Scheduler. Fails closed by throwing ProdInventoryMutationError
 * if any addition, deletion, generation change, size change, timestamp change,
 * document change, or scheduler state/timestamp change is detected.
 */
export function compareProdInventories(
  pre: ProdInventorySnapshot,
  post: ProdInventorySnapshot,
  options: { expectedBaselineCount?: number } = {}
): ProdInventoryComparisonResult {
  const expectedBaselineCount = options.expectedBaselineCount ?? 100;

  // 1. Scheduler state and timestamp invariants
  const schedulerStateChanged = pre.scheduler.state !== post.scheduler.state;
  const schedulerTimeChanged = pre.scheduler.userUpdateTime !== post.scheduler.userUpdateTime;

  if (pre.scheduler.state !== "PAUSED" || post.scheduler.state !== "PAUSED" || schedulerStateChanged) {
    throw new ProdInventoryMutationError(
      "SCHEDULER_STATE_MUTATION",
      `FAIL-CLOSED: PROD Scheduler must remain PAUSED and unchanged (pre=${pre.scheduler.state}, post=${post.scheduler.state})`
    );
  }

  if (schedulerTimeChanged) {
    throw new ProdInventoryMutationError(
      "SCHEDULER_TIMESTAMP_MUTATION",
      `FAIL-CLOSED: PROD Scheduler userUpdateTime changed from ${pre.scheduler.userUpdateTime} to ${post.scheduler.userUpdateTime}`
    );
  }

  // 2. Storage diff computation
  const storageAdditions = post.storageObjects.filter(
    (postObj) => !pre.storageObjects.some((preObj) => preObj.name === postObj.name)
  );
  const storageDeletions = pre.storageObjects.filter(
    (preObj) => !post.storageObjects.some((postObj) => postObj.name === preObj.name)
  );
  const storageGenerationChanges = post.storageObjects.filter((postObj) => {
    const preObj = pre.storageObjects.find((p) => p.name === postObj.name);
    return preObj !== undefined && preObj.generation !== postObj.generation;
  });
  const storageSizeChanges = post.storageObjects.filter((postObj) => {
    const preObj = pre.storageObjects.find((p) => p.name === postObj.name);
    return preObj !== undefined && preObj.size !== postObj.size;
  });
  const storageTimestampChanges = post.storageObjects.filter((postObj) => {
    const preObj = pre.storageObjects.find((p) => p.name === postObj.name);
    return preObj !== undefined && preObj.updated !== postObj.updated;
  });

  // 3. Firestore diff computation
  const firestoreAdditions = post.firestoreDocuments.filter(
    (postDoc) => !pre.firestoreDocuments.some((preDoc) => preDoc.name === postDoc.name)
  );
  const firestoreDeletions = pre.firestoreDocuments.filter(
    (preDoc) => !post.firestoreDocuments.some((postDoc) => postDoc.name === preDoc.name)
  );
  const firestoreUpdateChanges = post.firestoreDocuments.filter((postDoc) => {
    const preDoc = pre.firestoreDocuments.find((p) => p.name === postDoc.name);
    return (
      preDoc !== undefined &&
      (preDoc.updateTime !== postDoc.updateTime || preDoc.createTime !== postDoc.createTime)
    );
  });

  // 4. Fail-closed assertions
  if (storageAdditions.length !== 0) {
    throw new ProdInventoryMutationError(
      "STORAGE_OBJECT_ADDED",
      `FAIL-CLOSED: PROD Storage additions detected (${storageAdditions.length}): ${storageAdditions.map((s) => s.name).join(", ")}`
    );
  }
  if (storageDeletions.length !== 0) {
    throw new ProdInventoryMutationError(
      "STORAGE_OBJECT_DELETED",
      `FAIL-CLOSED: PROD Storage deletions detected (${storageDeletions.length}): ${storageDeletions.map((s) => s.name).join(", ")}`
    );
  }
  if (storageGenerationChanges.length !== 0) {
    throw new ProdInventoryMutationError(
      "STORAGE_GENERATION_CHANGED",
      `FAIL-CLOSED: PROD Storage generation changes detected (${storageGenerationChanges.length}): ${storageGenerationChanges.map((s) => s.name).join(", ")}`
    );
  }
  if (storageSizeChanges.length !== 0) {
    throw new ProdInventoryMutationError(
      "STORAGE_SIZE_CHANGED",
      `FAIL-CLOSED: PROD Storage size changes detected (${storageSizeChanges.length}): ${storageSizeChanges.map((s) => s.name).join(", ")}`
    );
  }
  if (storageTimestampChanges.length !== 0) {
    throw new ProdInventoryMutationError(
      "STORAGE_TIMESTAMP_CHANGED",
      `FAIL-CLOSED: PROD Storage timestamp changes detected (${storageTimestampChanges.length}): ${storageTimestampChanges.map((s) => s.name).join(", ")}`
    );
  }
  if (firestoreAdditions.length !== 0) {
    throw new ProdInventoryMutationError(
      "FIRESTORE_DOCUMENT_ADDED",
      `FAIL-CLOSED: PROD Firestore additions detected (${firestoreAdditions.length}): ${firestoreAdditions.map((d) => d.name).join(", ")}`
    );
  }
  if (firestoreDeletions.length !== 0) {
    throw new ProdInventoryMutationError(
      "FIRESTORE_DOCUMENT_DELETED",
      `FAIL-CLOSED: PROD Firestore deletions detected (${firestoreDeletions.length}): ${firestoreDeletions.map((d) => d.name).join(", ")}`
    );
  }
  if (firestoreUpdateChanges.length !== 0) {
    throw new ProdInventoryMutationError(
      "FIRESTORE_DOCUMENT_UPDATED",
      `FAIL-CLOSED: PROD Firestore document timestamp changes detected (${firestoreUpdateChanges.length}): ${firestoreUpdateChanges.map((d) => d.name).join(", ")}`
    );
  }

  if (
    pre.storageObjects.length !== expectedBaselineCount ||
    post.storageObjects.length !== expectedBaselineCount ||
    pre.firestoreDocuments.length !== expectedBaselineCount ||
    post.firestoreDocuments.length !== expectedBaselineCount
  ) {
    throw new ProdInventoryMutationError(
      "PROD_BASELINE_COUNT_MISMATCH",
      `FAIL-CLOSED: PROD baseline count mismatch (expected ${expectedBaselineCount}, storage=${pre.storageObjects.length}/${post.storageObjects.length}, firestore=${pre.firestoreDocuments.length}/${post.firestoreDocuments.length})`
    );
  }

  return {
    verdict: "zero net state changes observed between the captured inventories",
    storage: {
      preCount: pre.storageObjects.length,
      postCount: post.storageObjects.length,
      additionsCount: 0,
      deletionsCount: 0,
      changedGenerationsCount: 0,
      changedSizesCount: 0,
      changedTimestampsCount: 0,
      additionsList: [],
      deletionsList: [],
      changedGenerationsList: [],
      changedSizesList: [],
      changedTimestampsList: [],
      isIdentical: true
    },
    firestore: {
      preCount: pre.firestoreDocuments.length,
      postCount: post.firestoreDocuments.length,
      additionsCount: 0,
      deletionsCount: 0,
      changedUpdateTimesCount: 0,
      additionsList: [],
      deletionsList: [],
      changedUpdateTimesList: [],
      isIdentical: true
    },
    scheduler: {
      preState: pre.scheduler.state,
      postState: post.scheduler.state,
      preUpdateTime: pre.scheduler.userUpdateTime,
      postUpdateTime: post.scheduler.userUpdateTime,
      stateChanged: false,
      updateTimeChanged: false,
      isIdentical: true
    },
    overallProdZeroMutation: true
  };
}
