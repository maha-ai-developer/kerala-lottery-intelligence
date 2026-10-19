import { NextRequest } from "next/server";
import { ResearchDataService } from "@kerala-lottery/data";
import { apiSuccess, apiError, methodNotAllowed } from "../../../../../lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const service = ResearchDataService.getInstance();
    const findingId = searchParams.get("findingId");

    if (!findingId) {
      return apiSuccess({
        error: "BAD_REQUEST",
        message: "findingId query parameter is required."
      }, { status: 400 });
    }

    const lineage = await service.getGeographicLineage(findingId);
    return apiSuccess(lineage);
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
