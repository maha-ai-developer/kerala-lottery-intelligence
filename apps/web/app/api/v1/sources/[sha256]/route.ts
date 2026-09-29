import { NextRequest, NextResponse } from "next/server";
import { ResearchDataService } from "@kerala-lottery/data";
import { apiSuccess, apiError, methodNotAllowed } from "../../../../../lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ sha256: string }> }
) {
  try {
    const { sha256 } = await props.params;
    const service = ResearchDataService.getInstance();
    const source = await service.getSourceBySha256(sha256);

    if (!source) {
      return NextResponse.json(
        {
          error: "NOT_FOUND",
          message: `Source document with SHA-256 '${sha256}' was not found.`,
          statusCode: 404
        },
        { status: 404 }
      );
    }

    return apiSuccess({ data: source });
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
