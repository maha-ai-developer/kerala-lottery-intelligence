import { ResearchDataService } from "@kerala-lottery/data";
import { apiSuccess, apiError, methodNotAllowed } from "../../../../lib/api-response";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const service = ResearchDataService.getInstance();
    const models = await service.getModels();
    return apiSuccess({
      data: models,
      meta: {
        totalModels: models.length,
        disclaimer: "Historical benchmarking models only. Non-predictive."
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
