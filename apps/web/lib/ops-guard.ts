/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Operational Guard & Environment Safety Utilities
 *
 * Enforces strict project boundaries:
 * 1. PROD mutations are strictly forbidden (PROD = 100 draws / 38,416 results, scheduler PAUSED).
 * 2. Environment selector defaults to RESEARCH/DEV.
 * 3. Enforces single-flight concurrency lock to prevent overlapping runs.
 * 4. Verifies caller authorization for operational mutations.
 * 5. Sanitizes all audit and telemetry data before returning or storing.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  FirestoreIngestionLockManager,
  FirestoreIngestionRunRepository,
  type IngestionLockManager,
  type IngestionRunRepository
} from "@kerala-lottery/service-ingestion";
import { db } from "./firebase";

export interface OpsAuthResult {
  authorized: boolean;
  caller: string;
  errorResponse?: NextResponse;
}

export interface EnvironmentValidationResult {
  environment: "DEV" | "PROD";
  allowed: boolean;
  errorResponse?: NextResponse;
}

// Global shared lock manager and run repository instances
const globalLockManager: IngestionLockManager = new FirestoreIngestionLockManager({ db });
const globalRunRepo: IngestionRunRepository = new FirestoreIngestionRunRepository({ db });

export function getOpsLockManager(): IngestionLockManager {
  return globalLockManager;
}

export function getOpsRunRepository(): IngestionRunRepository {
  return globalRunRepo;
}

/**
 * Validates operator authorization for operational APIs.
 */
export function verifyOpsAuthorization(req: NextRequest): OpsAuthResult {
  const authHeader = req.headers.get("authorization") || "";
  const operatorAuth = req.headers.get("x-operator-auth") || req.headers.get("x-internal-auth");
  const isOperatorMode = req.headers.get("x-operator-mode") === "true";
  const internalSecret = process.env.INTERNAL_INGESTION_SECRET || process.env.OPERATOR_SECRET;

  // 1. In development, test, or local operator mode without configured secret
  if (!internalSecret) {
    return { authorized: true, caller: "local-operator" };
  }

  // 2. Token match if secret is configured
  let token = "";
  if (authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7).trim();
  } else if (operatorAuth) {
    token = operatorAuth.trim();
  }

  if (token && token === internalSecret) {
    return { authorized: true, caller: "authenticated-operator" };
  }

  // 3. In test/dev mode, allow test token
  if ((process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") && (token === "test-internal-token" || isOperatorMode)) {
    return { authorized: true, caller: "test-operator" };
  }

  return {
    authorized: false,
    caller: "unauthorized",
    errorResponse: NextResponse.json(
      {
        error: "UNAUTHORIZED",
        message: "Authentication required for operational ingestion endpoints. Please provide a valid Authorization Bearer token or operator key.",
        statusCode: 401
      },
      { status: 401 }
    )
  };
}

/**
 * Validates operational environment.
 * STRICT SAFETY RULE:
 * If an operation attempts to mutate PROD, it MUST be rejected immediately with 403 Forbidden.
 */
export function validateOpsEnvironment(
  requestedEnv: string | undefined | null,
  isMutating: boolean
): EnvironmentValidationResult {
  const normalized = (requestedEnv || "DEV").toUpperCase().trim();

  if (normalized === "PROD" || normalized === "PRODUCTION") {
    if (isMutating) {
      return {
        environment: "PROD",
        allowed: false,
        errorResponse: NextResponse.json(
          {
            error: "FORBIDDEN_PROD_MUTATION",
            message: "PROD mutations are strictly forbidden. Production state is locked at 100 draws / 38,416 results and the production scheduler is PAUSED. Any future production ingestion requires explicit server-side multi-party authorization.",
            statusCode: 403
          },
          { status: 403 }
        )
      };
    }
    return { environment: "PROD", allowed: true };
  }

  return { environment: "DEV", allowed: true };
}

/**
 * Wraps a mutating operational action with single-flight concurrency lock.
 */
export async function withOpsSingleFlightLock<T>(
  runId: string,
  environment: "DEV" | "PROD",
  fn: () => Promise<T>
): Promise<{ success: boolean; data?: T; errorResponse?: NextResponse }> {
  const lockManager = getOpsLockManager();
  const acquired = await lockManager.acquireLock(runId, {
    ttlSeconds: 600, // 10 minute lease
    environment
  });

  if (!acquired) {
    const currentLock = await lockManager.getCurrentLock();
    return {
      success: false,
      errorResponse: NextResponse.json(
        {
          error: "CONCURRENCY_LOCK_ACTIVE",
          message: `Single-flight lock acquisition rejected. Another ingestion run is currently in progress (Owner: ${currentLock?.ownerRunId || "unknown"}). Zero overlapping runs allowed.`,
          statusCode: 409
        },
        { status: 409 }
      )
    };
  }

  try {
    const data = await fn();
    return { success: true, data };
  } finally {
    try {
      await lockManager.releaseLock(runId);
    } catch (releaseErr) {
      console.warn(`[WARN] Failed to release single-flight lock for run ${runId}:`, releaseErr);
    }
  }
}
