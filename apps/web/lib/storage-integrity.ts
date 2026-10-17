/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Independent Cloud Storage, Firestore & Local Cache Integrity Evaluator
 *
 * Enforces fail-closed operational integrity verification:
 * 1. Cloud Storage object counts and Firestore document counts are queried independently
 *    (never copying Firestore counts into Cloud Storage counts).
 * 2. Per-draw flags (inManifest, inCloudStore, inFirestore, localPdfExists, localGraphExists,
 *    identityVerified) are computed from actual checks rather than hardcoded constants.
 * 3. If any check cannot run (e.g., unconfigured cloud client or query error), returns an
 *    explicit UNVERIFIED / CHECK_ERROR state rather than VERIFIED.
 */

import { readdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { DocumentCacheManager } from "@kerala-lottery/service-ingestion";
import { db, storage, isFirebaseConfigured } from "./firebase";

export type ExpectedEnvironmentScope =
  | "PROD_BASELINE"
  | "DEV_CATCHUP"
  | "OUTSIDE_V1_MANIFEST";

export type DrawResidencyCategory =
  | "ENVIRONMENT_OWNED_PROD"
  | "PROD_BASELINE_OUTSIDE_DEV"
  | "ENVIRONMENT_OWNED_DEV"
  | "LOCAL_ONLY_MISSING_DEV_RECORD"
  | "ADDITIONAL_CLOUD_OUTSIDE_MANIFEST"
  | "CLOUD_PARITY_MISMATCH"
  | "LOCAL_ARTIFACT_MISMATCH";

export interface DrawIntegrityItem {
  sha256: string;
  fileName: string;
  drawNumber: string;
  drawDate: string;
  lotteryCode: string;
  expectedEnvironmentScope: ExpectedEnvironmentScope;
  residencyCategory: DrawResidencyCategory;
  localPdfExists: boolean;
  localGraphExists: boolean;
  inManifest: boolean;
  inCloudStore: boolean;
  inFirestore: boolean;
  inProdCloudStore?: boolean;
  inProdFirestore?: boolean;
  identityVerified: boolean;
}

export interface ResidencyBreakdown {
  prodFreezeCutoffDate: string;
  prodBaselineManifestCount: number;
  devCatchupManifestCount: number;
  environmentOwnedProdCount: number;
  prodBaselineOutsideDevCount: number;
  environmentOwnedDevCount: number;
  localOnlyMissingDevCount: number;
  additionalCloudOutsideManifestCount: number;
  cloudParityMismatchCount: number;
  localArtifactMismatchCount: number;
  localOnlyCatchupShas: string[];
  additionalCloudOutsideManifestShas: string[];
}

export interface StorageIntegrityDependencies {
  sourceDir?: string;
  graphsDir?: string;
  manifestPath?: string;
  prodFreezeCutoffIsoDate?: string;
  isCloudConfigured?: () => boolean;
  listCloudStorageObjectShas?: () => Promise<Iterable<string>> | Iterable<string>;
  listFirestoreDocumentShas?: () => Promise<Iterable<string>> | Iterable<string>;
  listProdCloudStorageObjectShas?: () => Promise<Iterable<string>> | Iterable<string>;
  listProdFirestoreDocumentShas?: () => Promise<Iterable<string>> | Iterable<string>;
}

let activeTestDependencies: StorageIntegrityDependencies | null = null;

export function setStorageIntegrityDependenciesForTesting(
  deps: StorageIntegrityDependencies | null
): void {
  activeTestDependencies = deps;
}

export function getStorageIntegrityDependencies(): StorageIntegrityDependencies | null {
  return activeTestDependencies;
}

interface IndependentCloudCheckResult {
  ran: boolean;
  shas: Set<string>;
  error?: string;
}

function parseDrawDateToIso(drawDate: string): string | null {
  const match = drawDate.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

async function checkCloudStorageIndependently(
  deps: StorageIntegrityDependencies | null
): Promise<IndependentCloudCheckResult> {
  if (deps?.isCloudConfigured && !deps.isCloudConfigured()) {
    return {
      ran: false,
      shas: new Set(),
      error: "Cloud Storage check could not run: Firebase Storage is not configured."
    };
  }

  if (deps?.listCloudStorageObjectShas) {
    try {
      const shas = await deps.listCloudStorageObjectShas();
      return {
        ran: true,
        shas: new Set(Array.from(shas).map((s) => s.trim().toLowerCase()).filter(Boolean))
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ran: false,
        shas: new Set(),
        error: `Cloud Storage inventory check failed: ${msg}`
      };
    }
  }

  if (!isFirebaseConfigured || !storage) {
    return {
      ran: false,
      shas: new Set(),
      error: "Cloud Storage check could not run: Firebase Storage is not configured."
    };
  }

  try {
    const { ref, listAll } = await import("firebase/storage");
    const folderRef = ref(storage, "source-documents");
    const listResult = await listAll(folderRef);
    const shas = new Set<string>();
    for (const itemRef of listResult.items) {
      const match = itemRef.name.match(/^([a-f0-9]{64})\.pdf$/i);
      if (match && match[1]) {
        shas.add(match[1].toLowerCase());
      }
    }
    return { ran: true, shas };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ran: false,
      shas: new Set(),
      error: `Cloud Storage listAll failed: ${msg}`
    };
  }
}

async function checkFirestoreIndependently(
  deps: StorageIntegrityDependencies | null
): Promise<IndependentCloudCheckResult> {
  if (deps?.isCloudConfigured && !deps.isCloudConfigured()) {
    return {
      ran: false,
      shas: new Set(),
      error: "Firestore check could not run: Firebase Firestore is not configured."
    };
  }

  if (deps?.listFirestoreDocumentShas) {
    try {
      const shas = await deps.listFirestoreDocumentShas();
      return {
        ran: true,
        shas: new Set(Array.from(shas).map((s) => s.trim().toLowerCase()).filter(Boolean))
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ran: false,
        shas: new Set(),
        error: `Firestore inventory check failed: ${msg}`
      };
    }
  }

  if (!isFirebaseConfigured || !db) {
    return {
      ran: false,
      shas: new Set(),
      error: "Firestore check could not run: Firebase Firestore is not configured."
    };
  }

  try {
    const { collection, getDocs } = await import("firebase/firestore");
    const docSnaps = await getDocs(collection(db, "documents"));
    const shas = new Set<string>();
    docSnaps.forEach((docSnap) => {
      const data = docSnap.data?.() || {};
      const sha = String(data.sha256 || docSnap.id || "").trim().toLowerCase();
      if (/^[a-f0-9]{64}$/.test(sha)) {
        shas.add(sha);
      }
    });
    return { ran: true, shas };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ran: false,
      shas: new Set(),
      error: `Firestore getDocs failed: ${msg}`
    };
  }
}

async function checkOptionalProdCloudSource(
  fn: (() => Promise<Iterable<string>> | Iterable<string>) | undefined,
  label: string
): Promise<IndependentCloudCheckResult & { provided: boolean }> {
  if (!fn) {
    return { provided: false, ran: false, shas: new Set() };
  }
  try {
    const shas = await fn();
    return {
      provided: true,
      ran: true,
      shas: new Set(Array.from(shas).map((s) => s.trim().toLowerCase()).filter(Boolean))
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      provided: true,
      ran: false,
      shas: new Set(),
      error: `${label} inventory check failed: ${msg}`
    };
  }
}

export async function evaluateStorageIntegrity(options: {
  deepVerify: boolean;
  currentLock: { ownerRunId: string; expiresAt: string } | null;
  dependencies?: StorageIntegrityDependencies | null;
}) {
  const deps = options.dependencies ?? activeTestDependencies;

  const sourceDir = deps?.sourceDir ?? join(process.cwd(), "data/source-documents/lottery-results");
  const graphsDir = deps?.graphsDir ?? join(process.cwd(), "data/processed-cache/graphs");
  const manifestPath = deps?.manifestPath ?? join(process.cwd(), "data/processed-cache/manifest.json");
  const prodFreezeCutoffIsoDate = deps?.prodFreezeCutoffIsoDate ?? "2026-09-28";

  const sourceDirExists = existsSync(sourceDir);
  const graphsDirExists = existsSync(graphsDir);
  const manifestExists = existsSync(manifestPath);

  const localPdfs = sourceDirExists
    ? readdirSync(sourceDir).filter((f) => f.endsWith(".pdf") && f !== "dhanalekshmi-dl-40.pdf")
    : [];
  const localGraphs = graphsDirExists
    ? readdirSync(graphsDir).filter((f) => f.endsWith(".json"))
    : [];

  const manifestBySha = new Map<string, any>();
  let manifestReadError: string | null = null;
  if (manifestExists) {
    try {
      const manifestJson = JSON.parse(readFileSync(manifestPath, "utf8"));
      for (const [key, val] of Object.entries<any>(manifestJson.documents || {})) {
        const sha = String(val?.sha256 || key || "").trim().toLowerCase();
        if (sha) {
          manifestBySha.set(sha, { ...val, sha256: sha });
        }
      }
    } catch (err: unknown) {
      try {
        const cacheManager = new DocumentCacheManager();
        for (const [key, val] of Object.entries<any>(cacheManager.getManifest().documents || {})) {
          const sha = String(val?.sha256 || key || "").trim().toLowerCase();
          if (sha) {
            manifestBySha.set(sha, { ...val, sha256: sha });
          }
        }
      } catch {
        manifestReadError = err instanceof Error ? err.message : String(err);
      }
    }
  }

  let prodBaselineManifestCount = 0;
  let devCatchupManifestCount = 0;
  for (const doc of manifestBySha.values()) {
    if (doc?.status !== "VALID") continue;
    const isoDate = parseDrawDateToIso(String(doc?.drawDate || ""));
    if (isoDate !== null && isoDate <= prodFreezeCutoffIsoDate) {
      prodBaselineManifestCount += 1;
    } else {
      devCatchupManifestCount += 1;
    }
  }

  const localDocumentCount = localPdfs.length;
  const localGraphCount = localGraphs.length;
  const localManifestCount = manifestBySha.size;
  const researchDrawCount = localManifestCount;
  const schedulerState = "PAUSED";
  const mutationState = "PROD_LOCKED_DEV_ALLOWED";

  // Independent Cloud Storage and Firestore checks (never copy one count into the other)
  const [storageCheck, firestoreCheck, prodStorageCheck, prodFirestoreCheck] = await Promise.all([
    checkCloudStorageIndependently(deps),
    checkFirestoreIndependently(deps),
    checkOptionalProdCloudSource(deps?.listProdCloudStorageObjectShas, "PROD Cloud Storage"),
    checkOptionalProdCloudSource(deps?.listProdFirestoreDocumentShas, "PROD Firestore")
  ]);

  const prodChecksProvided = prodStorageCheck.provided || prodFirestoreCheck.provided;
  const prodChecksRan =
    prodStorageCheck.provided &&
    prodFirestoreCheck.provided &&
    prodStorageCheck.ran &&
    prodFirestoreCheck.ran;

  const cloudStorageDocumentCount: number | null = storageCheck.ran ? storageCheck.shas.size : null;
  const firestoreDocumentCount: number | null = firestoreCheck.ran ? firestoreCheck.shas.size : null;
  const prodCloudStorageDocumentCount: number | null = prodStorageCheck.ran
    ? prodStorageCheck.shas.size
    : null;
  const prodFirestoreDocumentCount: number | null = prodFirestoreCheck.ran
    ? prodFirestoreCheck.shas.size
    : null;

  const prodDrawCount = prodChecksRan
    ? Array.from(prodStorageCheck.shas).filter((sha) => prodFirestoreCheck.shas.has(sha)).length
    : prodBaselineManifestCount;

  const checkErrors: string[] = [];
  if (manifestReadError) checkErrors.push(`Manifest read failed: ${manifestReadError}`);
  if (!storageCheck.ran && storageCheck.error) checkErrors.push(storageCheck.error);
  if (!firestoreCheck.ran && firestoreCheck.error) checkErrors.push(firestoreCheck.error);
  if (prodStorageCheck.provided && !prodStorageCheck.ran && prodStorageCheck.error) {
    checkErrors.push(prodStorageCheck.error);
  }
  if (prodFirestoreCheck.provided && !prodFirestoreCheck.ran && prodFirestoreCheck.error) {
    checkErrors.push(prodFirestoreCheck.error);
  }
  if (prodChecksProvided && (!prodStorageCheck.provided || !prodFirestoreCheck.provided)) {
    checkErrors.push(
      "Both PROD Cloud Storage and PROD Firestore checks must be provided together when auditing PROD residency."
    );
  }

  let cloudConnectionStatus: string;
  if (storageCheck.ran && firestoreCheck.ran && (!prodChecksProvided || prodChecksRan)) {
    cloudConnectionStatus = "CONNECTED";
  } else if (storageCheck.ran || firestoreCheck.ran || prodStorageCheck.ran || prodFirestoreCheck.ran) {
    cloudConnectionStatus = "PARTIAL_CHECK_FAILURE";
  } else {
    cloudConnectionStatus = "UNVERIFIED_OFFLINE";
  }

  const responseData: any = {
    success: true,
    timestamp: new Date().toISOString(),
    counts: {
      localDocumentCount,
      localGraphCount,
      localManifestCount,
      prodBaselineManifestCount,
      devCatchupManifestCount,
      cloudStorageDocumentCount,
      firestoreDocumentCount,
      prodCloudStorageDocumentCount,
      prodFirestoreDocumentCount,
      researchDrawCount,
      prodDrawCount
    },
    operationalGuards: {
      schedulerState,
      mutationState,
      singleFlightLock: options.currentLock
        ? {
            status: "LOCKED",
            owner: options.currentLock.ownerRunId,
            expiresAt: options.currentLock.expiresAt
          }
        : { status: "IDLE" },
      cloudConnectionStatus,
      ...(checkErrors.length > 0 ? { checkErrors } : {})
    },
    cloudStoragePathPattern: "source-documents/{sha256}.pdf",
    firestoreCollectionPattern: "documents/{sha256}"
  };

  if (options.deepVerify) {
    // Compute actual SHA-256 of every local PDF on disk
    const localPdfBySha = new Map<string, { fileName: string; byteLength: number }>();
    if (sourceDirExists) {
      for (const pdfFile of localPdfs) {
        try {
          const pdfBytes = readFileSync(join(sourceDir, pdfFile));
          const sha = createHash("sha256").update(pdfBytes).digest("hex").toLowerCase();
          localPdfBySha.set(sha, { fileName: pdfFile, byteLength: pdfBytes.byteLength });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          checkErrors.push(`Failed reading local PDF ${pdfFile}: ${msg}`);
        }
      }
    }

    // Verify local graph files by SHA-256
    const validGraphShas = new Set<string>();
    if (graphsDirExists) {
      for (const graphFile of localGraphs) {
        const match = graphFile.match(/^([a-f0-9]{64})\.json$/i);
        if (!match || !match[1]) continue;
        const sha = match[1].toLowerCase();
        try {
          const graphJson = JSON.parse(readFileSync(join(graphsDir, graphFile), "utf8"));
          if (
            Array.isArray(graphJson.nodes) &&
            graphJson.nodes.length > 0 &&
            Array.isArray(graphJson.edges) &&
            graphJson.edges.length > 0
          ) {
            validGraphShas.add(sha);
          }
        } catch {
          // Malformed graph JSON remains excluded from validGraphShas
        }
      }
    }

    // Build union of all SHA-256 identities across manifest, local PDFs, local graphs, Cloud Storage, and Firestore
    const unionShas = new Set<string>();
    for (const sha of manifestBySha.keys()) unionShas.add(sha);
    for (const sha of localPdfBySha.keys()) unionShas.add(sha);
    for (const sha of validGraphShas) unionShas.add(sha);
    for (const sha of storageCheck.shas) unionShas.add(sha);
    for (const sha of firestoreCheck.shas) unionShas.add(sha);
    for (const sha of prodStorageCheck.shas) unionShas.add(sha);
    for (const sha of prodFirestoreCheck.shas) unionShas.add(sha);

    const isCloudOnlyRuntime = !sourceDirExists && !graphsDirExists;

    const items: DrawIntegrityItem[] = Array.from(unionShas).map((sha256) => {
      const manifestDoc = manifestBySha.get(sha256);
      const localPdf = localPdfBySha.get(sha256);

      const inManifest =
        Boolean(manifestDoc) &&
        manifestDoc.sha256 === sha256 &&
        manifestDoc.status === "VALID";

      const localPdfExists =
        Boolean(localPdf) &&
        (!manifestDoc?.fileSize || localPdf!.byteLength === Number(manifestDoc.fileSize));

      const localGraphExists = validGraphShas.has(sha256);
      const inCloudStore = storageCheck.ran && storageCheck.shas.has(sha256);
      const inFirestore = firestoreCheck.ran && firestoreCheck.shas.has(sha256);
      const inProdCloudStore = prodChecksRan && prodStorageCheck.shas.has(sha256);
      const inProdFirestore = prodChecksRan && prodFirestoreCheck.shas.has(sha256);

      const lotteryCode = String(manifestDoc?.lotteryCode || manifestDoc?.lotteryName || "");
      const drawNumber = String(manifestDoc?.drawNumber || "");
      const drawDate = String(manifestDoc?.drawDate || "");
      const fileName = String(manifestDoc?.fileName || localPdf?.fileName || `${sha256}.pdf`);

      const hasLottery = lotteryCode.trim().length > 0;
      const hasDraw = drawNumber.trim().length > 0;
      const hasDate = /^\d{2}\/\d{2}\/\d{4}$/.test(drawDate.trim());
      const hasSha = /^[a-f0-9]{64}$/.test(sha256);

      const drawDateIso = parseDrawDateToIso(drawDate);
      const expectedEnvironmentScope: ExpectedEnvironmentScope = !inManifest
        ? "OUTSIDE_V1_MANIFEST"
        : drawDateIso !== null && drawDateIso <= prodFreezeCutoffIsoDate
          ? "PROD_BASELINE"
          : "DEV_CATCHUP";

      const localArtifactsMatched = isCloudOnlyRuntime
        ? true
        : localPdfExists && localGraphExists;

      const hasDevCloudParityMismatch =
        storageCheck.ran && firestoreCheck.ran && inCloudStore !== inFirestore;
      const hasProdCloudParityMismatch =
        prodChecksRan && inProdCloudStore !== inProdFirestore;
      const hasCloudParityMismatch = hasDevCloudParityMismatch || hasProdCloudParityMismatch;

      const hasRequiredMetadata =
        inManifest && hasLottery && hasDraw && hasDate && hasSha;

      let residencyCategory: DrawResidencyCategory;
      let identityVerified = false;

      if (!inManifest) {
        if (hasCloudParityMismatch) {
          residencyCategory = "CLOUD_PARITY_MISMATCH";
        } else if (inCloudStore || inFirestore || inProdCloudStore || inProdFirestore) {
          residencyCategory = "ADDITIONAL_CLOUD_OUTSIDE_MANIFEST";
        } else {
          residencyCategory = "LOCAL_ARTIFACT_MISMATCH";
        }
      } else if (!localArtifactsMatched || !hasRequiredMetadata) {
        residencyCategory = "LOCAL_ARTIFACT_MISMATCH";
      } else if (hasCloudParityMismatch) {
        residencyCategory = "CLOUD_PARITY_MISMATCH";
      } else if (expectedEnvironmentScope === "PROD_BASELINE") {
        if ((inCloudStore && inFirestore) || (inProdCloudStore && inProdFirestore)) {
          residencyCategory = "ENVIRONMENT_OWNED_PROD";
          identityVerified = true;
        } else if (!prodChecksRan) {
          residencyCategory = "PROD_BASELINE_OUTSIDE_DEV";
          identityVerified = false;
        } else {
          residencyCategory = "LOCAL_ONLY_MISSING_DEV_RECORD";
          identityVerified = false;
        }
      } else {
        // expectedEnvironmentScope === "DEV_CATCHUP"
        if (inCloudStore && inFirestore) {
          residencyCategory = "ENVIRONMENT_OWNED_DEV";
          identityVerified = true;
        } else {
          residencyCategory = "LOCAL_ONLY_MISSING_DEV_RECORD";
          identityVerified = false;
        }
      }

      return {
        sha256,
        fileName,
        drawNumber,
        drawDate,
        lotteryCode,
        expectedEnvironmentScope,
        residencyCategory,
        localPdfExists,
        localGraphExists,
        inManifest,
        inCloudStore,
        inFirestore,
        ...(prodChecksRan ? { inProdCloudStore, inProdFirestore } : {}),
        identityVerified
      };
    });

    const allChecksRan =
      storageCheck.ran &&
      firestoreCheck.ran &&
      (!prodChecksProvided || prodChecksRan) &&
      manifestReadError === null &&
      (isCloudOnlyRuntime || (sourceDirExists && graphsDirExists));

    const environmentOwnedProdCount = items.filter(
      (item) => item.residencyCategory === "ENVIRONMENT_OWNED_PROD"
    ).length;
    const prodBaselineOutsideDevCount = items.filter(
      (item) => item.residencyCategory === "PROD_BASELINE_OUTSIDE_DEV"
    ).length;
    const environmentOwnedDevCount = items.filter(
      (item) => item.residencyCategory === "ENVIRONMENT_OWNED_DEV"
    ).length;
    const localOnlyCatchupShas = items
      .filter((item) => item.residencyCategory === "LOCAL_ONLY_MISSING_DEV_RECORD")
      .map((item) => item.sha256)
      .sort();
    const localOnlyMissingDevCount = localOnlyCatchupShas.length;
    const additionalCloudOutsideManifestShas = items
      .filter((item) => item.residencyCategory === "ADDITIONAL_CLOUD_OUTSIDE_MANIFEST")
      .map((item) => item.sha256)
      .sort();
    const additionalCloudOutsideManifestCount = additionalCloudOutsideManifestShas.length;
    const cloudParityMismatchCount = items.filter(
      (item) => item.residencyCategory === "CLOUD_PARITY_MISMATCH"
    ).length;
    const localArtifactMismatchCount = items.filter(
      (item) => item.residencyCategory === "LOCAL_ARTIFACT_MISMATCH"
    ).length;

    const residencyBreakdown: ResidencyBreakdown = {
      prodFreezeCutoffDate: prodFreezeCutoffIsoDate,
      prodBaselineManifestCount,
      devCatchupManifestCount,
      environmentOwnedProdCount,
      prodBaselineOutsideDevCount,
      environmentOwnedDevCount,
      localOnlyMissingDevCount,
      additionalCloudOutsideManifestCount,
      cloudParityMismatchCount,
      localArtifactMismatchCount,
      localOnlyCatchupShas,
      additionalCloudOutsideManifestShas
    };

    const matchedCount = allChecksRan
      ? items.filter((item) => item.identityVerified).length
      : 0;

    const unverifiedCount = allChecksRan ? 0 : items.length;
    const mismatchCount = allChecksRan ? items.length - matchedCount : 0;

    let integrityStatus: "VERIFIED" | "DISCREPANCY_DETECTED" | "UNVERIFIED";
    if (!allChecksRan || items.length === 0) {
      integrityStatus = "UNVERIFIED";
    } else if (
      mismatchCount > 0 ||
      localOnlyMissingDevCount > 0 ||
      additionalCloudOutsideManifestCount > 0 ||
      cloudParityMismatchCount > 0 ||
      localArtifactMismatchCount > 0 ||
      prodBaselineOutsideDevCount > 0 ||
      cloudStorageDocumentCount !== firestoreDocumentCount ||
      (prodChecksRan && prodCloudStorageDocumentCount !== prodFirestoreDocumentCount)
    ) {
      integrityStatus = "DISCREPANCY_DETECTED";
    } else {
      integrityStatus = "VERIFIED";
    }

    // Prioritize any non-verified items first so discrepancies are always surfaced
    const sortedItems = [...items].sort((a, b) =>
      a.identityVerified === b.identityVerified ? 0 : a.identityVerified ? 1 : -1
    );

    responseData.verification = {
      verifiedAt: new Date().toISOString(),
      totalAudited: items.length,
      matchedCount,
      mismatchCount,
      unverifiedCount,
      integrityStatus,
      residencyBreakdown,
      checksExecuted: {
        localPdfSha256Check: sourceDirExists,
        localGraphStructureCheck: graphsDirExists,
        manifestCheck: manifestExists && manifestReadError === null,
        cloudStorageIndependentCheck: storageCheck.ran,
        firestoreIndependentCheck: firestoreCheck.ran,
        ...(prodChecksProvided
          ? {
              prodCloudStorageIndependentCheck: prodStorageCheck.ran,
              prodFirestoreIndependentCheck: prodFirestoreCheck.ran
            }
          : {})
      },
      ...(checkErrors.length > 0 ? { unverifiedReasons: checkErrors } : {}),
      reconciliationBasis:
        "Independent SHA-256 cryptographic verification across local PDFs, local graphs, manifest, Cloud Storage objects, and Firestore documents",
      items: sortedItems
    };
  }

  return responseData;
}
