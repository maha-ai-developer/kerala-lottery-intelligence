import { NextRequest } from "next/server";
import { ResearchDataService } from "@kerala-lottery/data";
import { apiSuccess, apiError, methodNotAllowed } from "../../../../lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const service = ResearchDataService.getInstance();

    const page = searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : undefined;
    const pageSize = searchParams.get("pageSize")
      ? parseInt(searchParams.get("pageSize")!, 10)
      : searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!, 10)
      : undefined;

    const runId = searchParams.get("runId") || undefined;
    const experimentId = searchParams.get("experimentId") || undefined;

    const result = await service.getExperimentResults({
      page,
      pageSize,
      runId,
      experimentId
    });
    return apiSuccess(result);
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
