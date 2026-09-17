import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const healthInfo = {
    status: "healthy",
    service: "@kerala-lottery/web",
    version: process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0",
    environment: process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || "development",
    commit: process.env.NEXT_PUBLIC_GIT_COMMIT_SHA || "051cced",
    timestamp: new Date().toISOString()
  };

  return NextResponse.json(healthInfo, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, max-age=0"
    }
  });
}
