import { NextRequest, NextResponse } from "next/server";
import { ResearchDataService } from "@kerala-lottery/data";
import { apiSuccess, apiError, methodNotAllowed } from "../../../../lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || searchParams.get("query") || "";

    if (!q.trim()) {
      return NextResponse.json(
        {
          error: "BAD_REQUEST",
          message: "Query parameter 'q' or 'query' is required.",
          statusCode: 400
        },
        { status: 400 }
      );
    }

    const service = ResearchDataService.getInstance();
    const result = await service.search(q);
    return apiSuccess({ data: result });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST() {
  return methodNotAllowed();
}
export async function PUT() {
  return methodNotAllowed();
}
export async function DELETE() {
  return methodNotAllowed();
}
export async function PATCH() {
  return methodNotAllowed();
}
