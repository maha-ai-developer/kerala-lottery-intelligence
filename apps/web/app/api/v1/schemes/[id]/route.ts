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
    const scheme = await service.getSchemeById(id);

    if (!scheme) {
      return NextResponse.json(
        {
          error: "NOT_FOUND",
          message: `Prize scheme '${id}' was not found in the authoritative registry.`,
          statusCode: 404
        },
        { status: 404 }
      );
    }

    return apiSuccess({ data: scheme });
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
