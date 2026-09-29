/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestones 8B & 8C — Internal Authenticated Scheduled Ingestion Route
 *
 * Secure private endpoint invoked by Google Cloud Scheduler via OIDC service account authentication.
 * Supports both DEV and PROD runtime environments with strict mutual isolation:
 * - DEV:  kerala-lottery-intel-dev (dev-ingestion-scheduler@kerala-lottery-intel-dev.iam.gserviceaccount.com)
 * - PROD: kerala-lottery-intelligence (prod-ingestion-scheduler@kerala-lottery-intelligence.iam.gserviceaccount.com)
 *
 * Rejects unauthenticated requests with 401 Unauthorized.
 * Rejects unauthorized callers or wrong-environment callers with 403 Forbidden.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  ScheduledIngestionOrchestrator,
  getOperationalHealth,
  FirestoreIngestionLockManager,
  FirestoreIngestionRunRepository,
  DEV_PROJECT_ID,
  PROD_PROJECT_ID
} from "@kerala-lottery/service-ingestion";
import { db } from "../../../../lib/firebase";

export const dynamic = "force-dynamic";

/**
 * Resolves current execution environment and project ID dynamically.
 */
function resolveEnvironment(): { environment: "DEV" | "PROD"; projectId: string } {
  const envVarProject = process.env.GCP_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const isProd =
    process.env.APP_ENV === "production" ||
    process.env.NEXT_PUBLIC_APP_ENV === "production" ||
    envVarProject === PROD_PROJECT_ID;

  return isProd
    ? { environment: "PROD", projectId: PROD_PROJECT_ID }
    : { environment: "DEV", projectId: DEV_PROJECT_ID };
}

/**
 * Validates caller authorization (Bearer token or Google OIDC identity token header).
 */
function verifyInvocationAuth(
  req: NextRequest,
  expectedEnv: "DEV" | "PROD"
): { authorized: boolean; reason?: string; caller?: string; status?: number } {
  const authHeader = req.headers.get("authorization") || "";
  const internalSecret = process.env.INTERNAL_INGESTION_SECRET;

  // 1. In local dev / test emulator mode without secret configured, require test header
  if (!internalSecret && (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test")) {
    if (authHeader.startsWith("Bearer test-internal-token") || req.headers.get("x-internal-test-auth") === "true") {
      return { authorized: true, caller: "test-caller" };
    }
  }

  // 2. Reject missing Authorization header
  if (!authHeader.startsWith("Bearer ")) {
    return {
      authorized: false,
      status: 401,
      reason: "Missing or malformed Authorization header. Expected 'Bearer <token>'."
    };
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return { authorized: false, status: 401, reason: "Empty Bearer token provided." };
  }

  // 3. Match configured internal secret if set
  if (internalSecret && token === internalSecret) {
    return { authorized: true, caller: "internal-scheduler" };
  }

  // 4. OIDC token structure validation (Google Cloud Scheduler OIDC tokens)
  try {
    const parts = token.split(".");
    if (parts.length === 3) {
      const payloadJson = Buffer.from(parts[1]!, "base64url").toString("utf8");
      const payload = JSON.parse(payloadJson);

      if (payload.iss === "https://accounts.google.com" && payload.email) {
        // Enforce least privilege service account caller based on environment
        if (expectedEnv === "PROD") {
          // PROD: caller must belong to kerala-lottery-intelligence
          if (payload.email.includes("kerala-lottery-intel-dev")) {
            return {
              authorized: false,
              status: 403,
              reason: `Forbidden: DEV service account (${payload.email}) is not authorized to invoke PROD daily ingestion.`
            };
          }
          if (
            payload.email === `prod-ingestion-scheduler@${PROD_PROJECT_ID}.iam.gserviceaccount.com` ||
            payload.email.includes("kerala-lottery-intelligence")
          ) {
            return { authorized: true, caller: payload.email };
          }
        } else {
          // DEV: caller must belong to kerala-lottery-intel-dev
          if (payload.email.includes("kerala-lottery-intelligence")) {
            return {
              authorized: false,
              status: 403,
              reason: `Forbidden: PROD service account (${payload.email}) is not authorized to invoke DEV daily ingestion.`
            };
          }
          if (
            payload.email === `dev-ingestion-scheduler@${DEV_PROJECT_ID}.iam.gserviceaccount.com` ||
            payload.email.includes("kerala-lottery-intel-dev") ||
            payload.email.includes("scheduler")
          ) {
            return { authorized: true, caller: payload.email };
          }
        }
      }
    }
  } catch {
    // Malformed JWT
  }

  // If secret is set but token did not match
  if (internalSecret && token !== internalSecret) {
    return { authorized: false, status: 401, reason: "Invalid authorization token." };
  }

  return { authorized: false, status: 403, reason: "Unauthorized caller identity." };
}

/**
 * GET /api/internal/daily-ingestion
 * Returns operational health & heartbeat status (Requirements 8B.10 & 8C.11).
 */
export async function GET(req: NextRequest) {
  const { environment, projectId } = resolveEnvironment();
  const auth = verifyInvocationAuth(req, environment);
  if (!auth.authorized) {
    return NextResponse.json(
      { error: "Unauthorized", message: auth.reason || "Authentication required." },
      { status: auth.status || 401 }
    );
  }

  const lockManager = new FirestoreIngestionLockManager({ db });
  const runRepo = new FirestoreIngestionRunRepository({ db });
  const health = await getOperationalHealth(runRepo, lockManager);

  return NextResponse.json(
    {
      ...health,
      environment,
      projectId
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store, max-age=0" }
    }
  );
}

/**
 * POST /api/internal/daily-ingestion
 * Triggers scheduled or manual daily ingestion execution (Requirements 8B.1, 8C.3, 8C.4).
 */
export async function POST(req: NextRequest) {
  const { environment, projectId } = resolveEnvironment();

  // 1. Verify Authentication & Invoker Permissions (8C.4)
  const auth = verifyInvocationAuth(req, environment);
  if (!auth.authorized) {
    return NextResponse.json(
      { error: "Unauthorized", message: auth.reason || "Authentication required." },
      { status: auth.status || 401 }
    );
  }

  // 2. Parse request body parameters
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // Body is optional for standard cron trigger
  }

  const trigger = body.trigger === "MANUAL" ? "MANUAL" : "SCHEDULED";
  const dryRun = Boolean(body.dryRun);
  const verbose = Boolean(body.verbose);
  const since = body.since;
  const limit = body.limit ? parseInt(body.limit, 10) : undefined;
  const force = Boolean(body.force);
  const injectedCandidates = body.candidates || body.injectedCandidates;

  // 3. Coordinate Orchestration
  const lockManager = new FirestoreIngestionLockManager({ db });
  const runRepo = new FirestoreIngestionRunRepository({ db });
  const orchestrator = new ScheduledIngestionOrchestrator({
    lockManager,
    runRepository: runRepo
  });

  const result = await orchestrator.execute(trigger, {
    projectId,
    environment,
    dryRun,
    verbose,
    since,
    limit,
    forceBypassLock: force,
    injectedCandidates
  });

  const statusCode =
    result.status === "SUCCEEDED"
      ? 200
      : result.status === "PARTIAL_SUCCESS" || result.status === "SKIPPED_LOCKED"
      ? 202
      : 500;

  return NextResponse.json(
    {
      success: result.status === "SUCCEEDED" || result.status === "PARTIAL_SUCCESS",
      runId: result.runId,
      status: result.status,
      trigger: result.trigger,
      environment,
      projectId,
      skippedLocked: result.skippedLocked,
      lockAcquired: result.lockAcquired,
      failureCategory: result.failureCategory,
      summary: result.record
    },
    {
      status: statusCode,
      headers: { "Cache-Control": "no-store, max-age=0" }
    }
  );
}
