import { NextRequest } from "next/server";
import { ResearchDataService } from "@kerala-lottery/data";
import { apiSuccess, apiError, methodNotAllowed } from "../../../../lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const service = ResearchDataService.getInstance();

    const lottery = searchParams.get("lottery") || undefined;
    const drawNumber = searchParams.get("drawNumber") || undefined;
    const drawDate = searchParams.get("drawDate") || undefined;
    const startDate = searchParams.get("startDate") || searchParams.get("from") || undefined;
    const endDate = searchParams.get("endDate") || searchParams.get("to") || undefined;
    const schemeId = searchParams.get("schemeId") || undefined;
    const sourceSha = searchParams.get("sourceSha") || undefined;
    const q = searchParams.get("q") || searchParams.get("search") || undefined;
    const page = searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : undefined;
    const pageSize = searchParams.get("pageSize")
      ? parseInt(searchParams.get("pageSize")!, 10)
      : searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!, 10)
      : undefined;

    const result = await service.getDraws({
      lottery,
      drawNumber,
      drawDate,
      startDate,
      endDate,
      schemeId,
      sourceSha,
      q,
      page,
      pageSize
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
