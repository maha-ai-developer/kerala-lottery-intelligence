import { ResearchDataService } from "@kerala-lottery/data";
import { apiSuccess, apiError, methodNotAllowed } from "../../../../lib/api-response";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const service = ResearchDataService.getInstance();
    const lotteries = await service.getLotteries();
    return apiSuccess({
      data: lotteries,
      meta: {
        totalLotteries: lotteries.length,
        state: "Kerala",
        sourceAuthority: "Directorate of Kerala State Lotteries"
      }
    });
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
