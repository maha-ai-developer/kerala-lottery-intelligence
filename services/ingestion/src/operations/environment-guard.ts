/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestones 8B & 8C — Environment Isolation & Safety Guard
 *
 * Enforces strict environment separation for scheduled daily operations:
 * - DEV:  kerala-lottery-intel-dev (Project Number: 608186999779)
 * - PROD: kerala-lottery-intelligence (Project Number: 660682986882)
 *
 * Enforces fail-closed safety:
 * - Wrong project -> abort
 * - Wrong environment -> abort
 * - Missing required configuration -> abort
 * - Cross-environment pollution -> abort
 */

import { IngestionFailureError } from "./types";

export const DEV_PROJECT_ID = "kerala-lottery-intel-dev";
export const DEV_PROJECT_NUMBER = "608186999779";
export const DEV_STORAGE_BUCKET = "kerala-lottery-intel-dev.firebasestorage.app";
export const DEV_SCHEDULER_SERVICE_ACCOUNT = "dev-ingestion-scheduler@kerala-lottery-intel-dev.iam.gserviceaccount.com";

export const PROD_PROJECT_ID = "kerala-lottery-intelligence";
export const PROD_PROJECT_NUMBER = "660682986882";
export const PROD_STORAGE_BUCKET = "kerala-lottery-intelligence.firebasestorage.app";
export const PROD_SCHEDULER_SERVICE_ACCOUNT = "prod-ingestion-scheduler@kerala-lottery-intelligence.iam.gserviceaccount.com";

export class EnvironmentViolationError extends IngestionFailureError {
  constructor(message: string, context?: { details?: Record<string, unknown> }) {
    super("CONFIGURATION_FAILURE", message, context);
    this.name = "EnvironmentViolationError";
  }
}

export interface EnvironmentGuardOptions {
  projectId?: string;
  environment?: string;
  nodeEnv?: string;
  messagingSenderId?: string;
  storageBucket?: string;
  allowOffline?: boolean;
}

/**
 * Validates that the runtime environment is strictly DEV.
 * Throws EnvironmentViolationError if PROD is targeted or environment is unauthorized.
 * Returns the validated project ID.
 */
export function assertDevEnvironment(options?: EnvironmentGuardOptions): string {
  const envVarProject =
    process.env.GCP_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_CONFIG_PROJECT_ID ||
    process.env.GCLOUD_PROJECT;

  const rawProjectId = (options?.projectId || envVarProject || "").trim();
  const rawEnv = (
    options?.environment ||
    options?.nodeEnv ||
    process.env.NEXT_PUBLIC_APP_ENV ||
    process.env.APP_ENV ||
    process.env.NODE_ENV ||
    "development"
  ).trim().toLowerCase();

  // 1. Explicit prohibition against production identifiers in DEV
  if (
    rawProjectId === PROD_PROJECT_ID ||
    rawEnv === "production" ||
    rawEnv === "prod"
  ) {
    throw new EnvironmentViolationError(
      `FATAL: DEV environment guard violation. Detected target project '${rawProjectId}' / environment '${rawEnv}'. Production execution is strictly prohibited. DEV runtime cannot execute against PROD.`,
      {
        details: {
          targetProject: rawProjectId,
          environment: rawEnv,
          rule: "REQUIREMENT_DEV_ISOLATION"
        }
      }
    );
  }

  // Check cross-environment pollution
  const senderId = options?.messagingSenderId || process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  if (senderId === PROD_PROJECT_NUMBER) {
    throw new EnvironmentViolationError(
      `FATAL: Cross-environment configuration mismatch. DEV cannot use PROD messagingSenderId (${PROD_PROJECT_NUMBER}).`,
      { details: { messagingSenderId: senderId } }
    );
  }

  const bucket = options?.storageBucket || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.GCS_BUCKET_DOCUMENTS;
  if (bucket && (bucket.includes(PROD_PROJECT_ID) || bucket === PROD_STORAGE_BUCKET)) {
    throw new EnvironmentViolationError(
      `FATAL: Cross-environment configuration mismatch. DEV cannot use PROD storage bucket (${bucket}).`,
      { details: { storageBucket: bucket } }
    );
  }

  // 2. Allow offline/emulator testing if designated
  const isEmulator = Boolean(
    process.env.FIRESTORE_EMULATOR_HOST ||
    process.env.FIREBASE_STORAGE_EMULATOR_HOST ||
    options?.allowOffline
  );

  // 3. Project ID assertion: must be either DEV_PROJECT_ID or a recognized local test identifier
  const validDevProjects = [
    DEV_PROJECT_ID,
    "kerala-lottery-rules-test",
    "test-project",
    "offline-test"
  ];

  if (rawProjectId && !validDevProjects.includes(rawProjectId) && !isEmulator) {
    throw new EnvironmentViolationError(
      `FATAL: Unauthorized target project '${rawProjectId}'. Scheduled ingestion must strictly target '${DEV_PROJECT_ID}' in DEV.`,
      {
        details: {
          providedProjectId: rawProjectId,
          allowedProjects: validDevProjects
        }
      }
    );
  }

  return rawProjectId || DEV_PROJECT_ID;
}

/**
 * Validates that the runtime environment is strictly PROD (Requirement 8C.1 & 8C.6).
 * Fails closed immediately if DEV targets, DEV project numbers, or DEV buckets are detected.
 * Returns the validated project ID.
 */
export function assertProdEnvironment(options?: EnvironmentGuardOptions): string {
  const envVarProject =
    process.env.GCP_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_CONFIG_PROJECT_ID ||
    process.env.GCLOUD_PROJECT;

  const rawProjectId = (options?.projectId || envVarProject || "").trim();
  const rawEnv = (
    options?.environment ||
    options?.nodeEnv ||
    process.env.NEXT_PUBLIC_APP_ENV ||
    process.env.APP_ENV ||
    process.env.NODE_ENV ||
    ""
  ).trim().toLowerCase();

  // 1. Explicit prohibition against DEV identifiers in PROD
  if (
    rawProjectId === DEV_PROJECT_ID ||
    rawEnv === "development" ||
    rawEnv === "dev"
  ) {
    throw new EnvironmentViolationError(
      `FATAL: PROD environment guard violation. Detected DEV target project '${rawProjectId}' / environment '${rawEnv}'. PROD runtime cannot execute against DEV.`,
      {
        details: {
          targetProject: rawProjectId,
          environment: rawEnv,
          rule: "REQUIREMENT_8C_1_PROD_ISOLATION"
        }
      }
    );
  }

  // 2. Strict PROD project ID assertion
  const isEmulator = Boolean(
    process.env.FIRESTORE_EMULATOR_HOST ||
    process.env.FIREBASE_STORAGE_EMULATOR_HOST ||
    options?.allowOffline
  );

  const validProdProjects = [
    PROD_PROJECT_ID,
    "kerala-lottery-intelligence-test",
    "offline-test-prod"
  ];

  if (!rawProjectId) {
    throw new EnvironmentViolationError(
      "FATAL: Missing required project ID for PROD execution. Failing closed to prevent accidental corruption.",
      { details: { rule: "REQUIREMENT_8C_1_FAIL_CLOSED" } }
    );
  }

  if (!validProdProjects.includes(rawProjectId) && !isEmulator) {
    throw new EnvironmentViolationError(
      `FATAL: Invalid target project '${rawProjectId}' for PROD. Expected '${PROD_PROJECT_ID}'.`,
      {
        details: {
          providedProjectId: rawProjectId,
          expectedProjectId: PROD_PROJECT_ID
        }
      }
    );
  }

  // 3. Cross-environment pollution checks
  const senderId = options?.messagingSenderId || process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  if (senderId === DEV_PROJECT_NUMBER) {
    throw new EnvironmentViolationError(
      `FATAL: Cross-environment configuration mismatch. PROD cannot use DEV messagingSenderId (${DEV_PROJECT_NUMBER}).`,
      { details: { messagingSenderId: senderId } }
    );
  }

  const bucket = options?.storageBucket || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.GCS_BUCKET_DOCUMENTS;
  if (bucket && (bucket.includes(DEV_PROJECT_ID) || bucket === DEV_STORAGE_BUCKET)) {
    throw new EnvironmentViolationError(
      `FATAL: Cross-environment configuration mismatch. PROD cannot use DEV storage bucket (${bucket}).`,
      { details: { storageBucket: bucket } }
    );
  }

  return rawProjectId;
}

/**
 * Universal Environment Assertion Guard.
 * Dispatches to assertDevEnvironment or assertProdEnvironment based on environment selector.
 */
export function assertEnvironment(options?: EnvironmentGuardOptions): {
  projectId: string;
  environment: "DEV" | "PROD";
} {
  const env = (
    options?.environment ||
    process.env.NEXT_PUBLIC_APP_ENV ||
    process.env.APP_ENV ||
    (process.env.NODE_ENV === "production" ? "PROD" : "DEV")
  ).trim().toUpperCase();

  if (env === "PROD" || env === "PRODUCTION") {
    const projectId = assertProdEnvironment(options);
    return { projectId, environment: "PROD" };
  }

  const projectId = assertDevEnvironment(options);
  return { projectId, environment: "DEV" };
}
