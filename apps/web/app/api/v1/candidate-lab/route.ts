import { NextRequest } from "next/server";
import { ResearchDataService, ResearchApiError } from "@kerala-lottery/data";
import { type CandidateLabTicketInput } from "@kerala-lottery/experiments";
import { apiSuccess, apiError, methodNotAllowed } from "../../../../lib/api-response";

export const dynamic = "force-dynamic";

/**
 * Parses candidate specifications from multiple potential query parameter styles:
 * 1. JSON string: ?payload=[{"lotteryCode":"KN","series":"BB","ticketNumber":"814615"},...]
 * 2. Comma-separated list: ?candidates=KN:BB:814615,KN:BC:271904,KN:BD:563281
 * 3. Repeated param: ?candidate=KN:BB:814615&candidate=KN:BC:271904
 */
function parseCandidatesFromQuery(searchParams: URLSearchParams): CandidateLabTicketInput[] {
  const candidates: CandidateLabTicketInput[] = [];

  // Check JSON payload
  const jsonPayload = searchParams.get("payload") || searchParams.get("q");
  if (jsonPayload) {
    try {
      const parsed = JSON.parse(jsonPayload);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === "object") {
            candidates.push({
              id: item.id,
              lotteryCode: item.lotteryCode || item.lottery || "",
              schemeVersionId: item.schemeVersionId || item.scheme,
              series: item.series || "",
              ticketNumber: String(item.ticketNumber || item.number || ""),
              userLabel: item.userLabel || item.label
            });
          }
        }
      }
    } catch {
      // Ignore JSON parse error, fall through to string parsing
    }
  }

  if (candidates.length > 0) {
    return candidates;
  }

  // Check comma-separated string or repeated candidate params
  const rawList: string[] = [];
  const commaSeparated = searchParams.get("candidates");
  if (commaSeparated) {
    rawList.push(...commaSeparated.split(","));
  }

  const repeated = searchParams.getAll("candidate");
  if (repeated.length > 0) {
    rawList.push(...repeated);
  }

  for (const raw of rawList) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    // Supported formats:
    // lottery:series:number (e.g. KN:BB:814615)
    // lottery:series:number:label (e.g. KN:BB:814615:Candidate_A)
    // lottery:scheme:series:number (e.g. KN:KN_DEFAULT:BB:814615)
    const parts = trimmed.split(":");
    if (parts.length === 3) {
      candidates.push({
        lotteryCode: parts[0]!.trim(),
        series: parts[1]!.trim(),
        ticketNumber: parts[2]!.trim()
      });
    } else if (parts.length === 4) {
      // Check if parts[1] looks like a scheme ID or parts[3] is label
      if (parts[1]!.includes("_") || parts[1]!.length > 4) {
        candidates.push({
          lotteryCode: parts[0]!.trim(),
          schemeVersionId: parts[1]!.trim(),
          series: parts[2]!.trim(),
          ticketNumber: parts[3]!.trim()
        });
      } else {
        candidates.push({
          lotteryCode: parts[0]!.trim(),
          series: parts[1]!.trim(),
          ticketNumber: parts[2]!.trim(),
          userLabel: parts[3]!.trim()
        });
      }
    }
  }

  return candidates;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const candidates = parseCandidatesFromQuery(searchParams);

    if (candidates.length < 2) {
      throw new ResearchApiError(
        400,
        "BAD_REQUEST",
        "Multi-Candidate Lab requires at least 2 candidate tickets for comparison. Provide tickets via 'candidates=LOTTERY:SERIES:NUMBER,LOTTERY:SERIES:NUMBER' or JSON 'payload'."
      );
    }

    if (candidates.length > 10) {
      throw new ResearchApiError(
        400,
        "BAD_REQUEST",
        "Multi-Candidate Lab accepts a maximum of 10 candidate tickets per comparative analysis."
      );
    }

    // Optional query parameters
    const temporalCutoffDate =
      searchParams.get("cutoffDate") || searchParams.get("temporalCutoffDate") || undefined;
    const rawWindows = searchParams.get("windows") || searchParams.get("backtestWindows");
    const backtestWindows = rawWindows ? parseInt(rawWindows, 10) : undefined;

    const service = ResearchDataService.getInstance();
    const result = await service.analyzeCandidateLab({
      candidates,
      temporalCutoffDate,
      backtestWindows
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
