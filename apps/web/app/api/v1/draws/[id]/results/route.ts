import { NextRequest, NextResponse } from "next/server";
import { ResearchDataService } from "@kerala-lottery/data";
import { apiSuccess, apiError, methodNotAllowed } from "../../../../../../lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const { searchParams } = new URL(req.url);
    const service = ResearchDataService.getInstance();

    const prizeTier = searchParams.get("prizeTier") || undefined;
    const rank = searchParams.get("rank") ? parseInt(searchParams.get("rank")!, 10) : undefined;
    const series = searchParams.get("series") || undefined;
    const ticketNumber = searchParams.get("ticketNumber") || undefined;
    const isSuffix = searchParams.has("isSuffix") ? searchParams.get("isSuffix") === "true" : undefined;
    const page = searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : undefined;
    const pageSize = searchParams.get("pageSize")
      ? parseInt(searchParams.get("pageSize")!, 10)
      : searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!, 10)
      : undefined;

    const result = await service.getDrawResults(id, {
      prizeTier,
      rank,
      series,
      ticketNumber,
      isSuffix,
      page,
      pageSize
    });

    if (!result) {
      return NextResponse.json(
        {
          error: "NOT_FOUND",
          message: `Draw '${id}' was not found.`,
          statusCode: 404
        },
        { status: 404 }
      );
    }

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
