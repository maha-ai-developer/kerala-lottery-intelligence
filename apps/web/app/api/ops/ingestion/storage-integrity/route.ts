/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Operational Ingestion API — Cloud/Local Storage Integrity
 * GET /api/ops/ingestion/storage-integrity
 *
 * Audits and reconciles local workspace cache against authoritative Cloud Storage
 * and Firestore documents using independent checks.
 * Compares by SHA-256 cryptographic hash and draw identity (lottery code, draw number, draw date).
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyOpsAuthorization, getOpsLockManager } from "../../../../../lib/ops-guard";
import {
  evaluateStorageIntegrity,
  type DrawIntegrityItem
} from "../../../../../lib/storage-integrity";

export const dynamic = "force-dynamic";
export type { DrawIntegrityItem };

export async function GET(req: NextRequest) {
  // 1. Authorization Verification
  const auth = verifyOpsAuthorization(req);
  if (!auth.authorized) {
    return auth.errorResponse!;
  }

  try {
    const { searchParams } = new URL(req.url);
    const deepVerify = searchParams.get("verify") === "true";

    const lockManager = getOpsLockManager();
    const currentLock = await lockManager.getCurrentLock();

    const responseData = await evaluateStorageIntegrity({
      deepVerify,
      currentLock: currentLock
        ? { ownerRunId: currentLock.ownerRunId, expiresAt: currentLock.expiresAt }
        : null
    });

    return NextResponse.json(responseData);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: "STORAGE_INTEGRITY_CHECK_FAILED",
        message: `Storage integrity check failed: ${message}`,
        statusCode: 500
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json(
    {
      error: "METHOD_NOT_ALLOWED",
      message: "POST is not allowed on /api/ops/ingestion/storage-integrity. This endpoint is GET-only.",
      statusCode: 405
    },
    { status: 405, headers: { Allow: "GET" } }
  );
}
