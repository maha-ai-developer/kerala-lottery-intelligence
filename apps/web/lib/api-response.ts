/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 9A — API Response & Error Utilities
 */

import { NextResponse } from "next/server";
import { ResearchApiError } from "@kerala-lottery/data";

export const IMMUTABLE_CACHE_HEADER = "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400";
export const NO_CACHE_HEADER = "no-store, no-cache, must-revalidate";

export function apiSuccess<T>(data: T, options?: { cache?: boolean; status?: number }) {
  const status = options?.status ?? 200;
  const cacheHeader = options?.cache === false ? NO_CACHE_HEADER : IMMUTABLE_CACHE_HEADER;

  return NextResponse.json(data, {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": cacheHeader,
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY"
    }
  });
}

export function apiError(err: unknown) {
  if (err instanceof ResearchApiError) {
    return NextResponse.json(
      {
        error: err.error,
        message: err.message,
        statusCode: err.statusCode,
        details: err.details
      },
      {
        status: err.statusCode,
        headers: { "Cache-Control": NO_CACHE_HEADER }
      }
    );
  }

  const message = err instanceof Error ? err.message : "Internal Server Error";
  console.error(`[API Error: ${message}]`, err);

  return NextResponse.json(
    {
      error: "INTERNAL_ERROR",
      message: "An internal server error occurred while processing the research request.",
      statusCode: 500
    },
    {
      status: 500,
      headers: { "Cache-Control": NO_CACHE_HEADER }
    }
  );
}

export function methodNotAllowed() {
  return NextResponse.json(
    {
      error: "METHOD_NOT_ALLOWED",
      message: "The requested method is not allowed. Production research endpoints are strictly read-only.",
      statusCode: 405
    },
    {
      status: 405,
      headers: {
        Allow: "GET",
        "Cache-Control": NO_CACHE_HEADER
      }
    }
  );
}
