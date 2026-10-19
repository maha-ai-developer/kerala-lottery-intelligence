import { NextRequest, NextResponse } from "next/server";
import { ResearchDataService } from "@kerala-lottery/data";
import { apiSuccess, apiError, methodNotAllowed, IMMUTABLE_CACHE_HEADER } from "../../../../../../lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format");

    const service = ResearchDataService.getInstance();
    const result = await service.getFindingReport(id);

    if (format === "md" || format === "markdown") {
      return new NextResponse(result.markdownContent, {
        status: 200,
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Cache-Control": IMMUTABLE_CACHE_HEADER,
          "Content-Disposition": `attachment; filename="${result.reportId}.md"`
        }
      });
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
