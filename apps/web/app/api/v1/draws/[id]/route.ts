import { NextRequest, NextResponse } from "next/server";
import { ResearchDataService } from "@kerala-lottery/data";
import { apiSuccess, apiError, methodNotAllowed } from "../../../../../lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const service = ResearchDataService.getInstance();
    const draw = await service.getDrawById(id);

    if (!draw) {
      return NextResponse.json(
        {
          error: "NOT_FOUND",
          message: `Draw '${id}' was not found in the verified historical population.`,
          statusCode: 404
        },
        { status: 404 }
      );
    }

    return apiSuccess({ data: draw });
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
