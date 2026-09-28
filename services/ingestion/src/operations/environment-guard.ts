/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 8B — Environment Isolation & Safety Guard
 *
 * Enforces strict DEV isolation for scheduled daily operations.
 * Fails closed immediately if executed against or configured with PROD targets.
 */

import { IngestionFailureError } from "./types";

export const DEV_PROJECT_ID = "kerala-lottery-intel-dev";
export const PROD_PROJECT_ID = "kerala-lottery-intelligence";

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

  // 1. Explicit prohibition against production identifiers
  if (
    rawProjectId === PROD_PROJECT_ID ||
    rawEnv === "production" ||
    rawEnv === "prod"
  ) {
    throw new EnvironmentViolationError(
      `FATAL: Automated daily ingestion locked to DEV environment only. Detected target project '${rawProjectId}' / environment '${rawEnv}'. Production execution is strictly prohibited in Milestone 8B.`,
      {
        details: {
          targetProject: rawProjectId,
          environment: rawEnv,
          rule: "REQUIREMENT_8B_16_DEV_ONLY"
        }
      }
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
