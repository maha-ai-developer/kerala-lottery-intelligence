import { NextRequest } from "next/server";
import { ResearchDataService, ResearchApiError } from "@kerala-lottery/data";
import { apiSuccess, apiError, methodNotAllowed } from "../../../../lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lotteryCode = searchParams.get("lottery") || searchParams.get("lotteryCode") || "";
    const schemeVersionId = searchParams.get("scheme") || searchParams.get("schemeVersionId") || undefined;
    const series = searchParams.get("series") || "";
    const ticketNumber = searchParams.get("number") || searchParams.get("ticketNumber") || "";
    const drawId = searchParams.get("drawId") || undefined;
    const drawDate = searchParams.get("drawDate") || undefined;
    const temporalCutoffDate =
      searchParams.get("cutoffDate") || searchParams.get("temporalCutoffDate") || undefined;
    const userProvidedContext =
      searchParams.get("context") || searchParams.get("userProvidedContext") || undefined;

    if (!lotteryCode || !series || !ticketNumber) {
      throw new ResearchApiError(
        400,
        "BAD_REQUEST",
        "Missing required query parameters. Required: 'lottery' (or 'lotteryCode'), 'series', and 'number' (or 'ticketNumber'). Optional: 'scheme', 'drawId', 'drawDate', 'cutoffDate', 'context'."
      );
    }

    const service = ResearchDataService.getInstance();
    const result = await service.analyzeSandboxTicket({
      lotteryCode,
      schemeVersionId,
      series,
      ticketNumber,
      drawId,
      drawDate,
      temporalCutoffDate,
      userProvidedContext
    });

    return apiSuccess(result, { cache: false });
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
