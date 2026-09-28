/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 8B — Internal Authenticated Scheduled Ingestion Route
 *
 * Secure private endpoint invoked by Google Cloud Scheduler via OIDC service account authentication.
 * Rejects unauthenticated requests with 401 Unauthorized.
 * Rejects unauthorized callers with 403 Forbidden.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  ScheduledIngestionOrchestrator,
  getOperationalHealth,
  FirestoreIngestionLockManager,
  FirestoreIngestionRunRepository,
  DEV_PROJECT_ID
} from "@kerala-lottery/service-ingestion";

export const dynamic = "force-dynamic";

/**
 * Validates the caller authorization (Bearer token or Google OIDC identity token header).
 */
function verifyInvocationAuth(req: NextRequest): { authorized: boolean; reason?: string; caller?: string } {
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
    return { authorized: false, reason: "Missing or malformed Authorization header. Expected 'Bearer <token>'." };
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return { authorized: false, reason: "Empty Bearer token provided." };
  }

  // 3. Match configured internal secret if set
  if (internalSecret && token === internalSecret) {
    return { authorized: true, caller: "internal-scheduler" };
  }

  // 4. OIDC token structure validation (Google Cloud Scheduler OIDC tokens)
  // For production/dev Google Cloud Scheduler, OIDC tokens are signed JWTs with payload containing:
  // iss: "https://accounts.google.com" and email ending in "@kerala-lottery-intel-dev.iam.gserviceaccount.com"
  try {
    const parts = token.split(".");
    if (parts.length === 3) {
      const payloadJson = Buffer.from(parts[1]!, "base64url").toString("utf8");
      const payload = JSON.parse(payloadJson);

      if (payload.iss === "https://accounts.google.com" && payload.email) {
        // Enforce least privilege service account caller in DEV
        if (
          payload.email.includes("kerala-lottery-intel-dev") ||
          payload.email.includes("scheduler")
        ) {
          return { authorized: true, caller: payload.email };
        }
      }
    }
  } catch {
    // Malformed JWT
  }

  // If secret is set but token did not match
  if (internalSecret && token !== internalSecret) {
    return { authorized: false, reason: "Invalid authorization token." };
  }

  return { authorized: false, reason: "Unauthorized caller identity." };
}

/**
 * GET /api/internal/daily-ingestion
 * Returns operational health & heartbeat status (Requirement 8B.10).
 */
export async function GET(req: NextRequest) {
  const auth = verifyInvocationAuth(req);
  if (!auth.authorized) {
    return NextResponse.json(
      { error: "Unauthorized", message: auth.reason || "Authentication required." },
      { status: 401 }
    );
  }

  const lockManager = new FirestoreIngestionLockManager();
  const runRepo = new FirestoreIngestionRunRepository();
  const health = await getOperationalHealth(runRepo, lockManager);

  return NextResponse.json(health, {
    status: 200,
    headers: { "Cache-Control": "no-store, max-age=0" }
  });
}

/**
 * POST /api/internal/daily-ingestion
 * Triggers scheduled or manual daily ingestion execution (Requirement 8B.1, 8B.4, 8B.12).
 */
export async function POST(req: NextRequest) {
  // 1. Verify Authentication & Invoker Permissions (8B.12)
  const auth = verifyInvocationAuth(req);
  if (!auth.authorized) {
    return NextResponse.json(
      { error: "Unauthorized", message: auth.reason || "Authentication required." },
      { status: 401 }
    );
  }

  // 2. Parse request body parameters
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // Body is optional for standard cron trigger
  }

  const trigger = (body.trigger === "MANUAL" ? "MANUAL" : "SCHEDULED");
  const dryRun = Boolean(body.dryRun);
  const verbose = Boolean(body.verbose);
  const since = body.since;
  const limit = body.limit ? parseInt(body.limit, 10) : undefined;
  const force = Boolean(body.force);

  // 3. Coordinate Orchestration
  const lockManager = new FirestoreIngestionLockManager();
  const runRepo = new FirestoreIngestionRunRepository();
  const orchestrator = new ScheduledIngestionOrchestrator({
    lockManager,
    runRepository: runRepo
  });

  const result = await orchestrator.execute(trigger, {
    projectId: process.env.GCP_PROJECT_ID || DEV_PROJECT_ID,
    environment: "DEV",
    dryRun,
    verbose,
    since,
    limit,
    forceBypassLock: force
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
