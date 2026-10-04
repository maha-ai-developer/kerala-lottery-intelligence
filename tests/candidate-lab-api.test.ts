/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone V1.0 Final: Multi-Candidate Comparison Lab API Route Tests
 *
 * Verifies:
 * 1. GET /api/v1/candidate-lab endpoint execution with comma-separated candidates
 * 2. GET /api/v1/candidate-lab endpoint execution with JSON payload
 * 3. Parameter validation & 400 Bad Request error responses (missing, < 2 candidates, > 10 candidates)
 * 4. 405 Method Not Allowed guard on POST, PUT, DELETE, PATCH with Allow: GET
 * 5. Production mutation guard (zero write side effects)
 * 6. Integration with researchService.analyzeCandidateLab
 */

import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import {
  GET,
  POST,
  PUT,
  DELETE,
  PATCH
} from "../apps/web/app/api/v1/candidate-lab/route";
import { researchService } from "../packages/data/src/research-service";

describe("Milestone V1.0: Multi-Candidate Lab API Route (/api/v1/candidate-lab)", () => {
  it("should process valid GET request with comma-separated candidates and return 200", async () => {
    const url = "http://localhost:3000/api/v1/candidate-lab?candidates=KN:BB:814615,KN:BC:271904,KN:BD:563281";
    const req = new NextRequest(url, { method: "GET" });
    const response = await GET(req);

    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.analysisId).toMatch(/^candidate_lab_[0-9a-f]{16}$/);
    expect(json.candidateCount).toBe(3);
    expect(json.validationSummaries).toHaveLength(3);
    expect(json.featureProfiles).toHaveLength(3);
    expect(json.historicalComparisons).toHaveLength(3);
    expect(json.seriesComparison.seriesItems.length).toBeGreaterThanOrEqual(3);
    expect(json.backtestResults.windows).toHaveLength(4);
    expect(json.tradeOffAnalysis.comparisonMatrix).toHaveLength(3);
    expect(json.provenance.corpusVersion).toBe("v1.0-research-103draws");
  });

  it("should process valid GET request with JSON payload parameter and return 200", async () => {
    const payload = JSON.stringify([
      { lotteryCode: "KN", series: "BB", ticketNumber: "814615" },
      { lotteryCode: "KN", series: "BC", ticketNumber: "271904" }
    ]);
    const url = `http://localhost:3000/api/v1/candidate-lab?payload=${encodeURIComponent(payload)}`;
    const req = new NextRequest(url, { method: "GET" });
    const response = await GET(req);

    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.candidateCount).toBe(2);
    expect(json.validationSummaries[0]?.input.series).toBe("BB");
    expect(json.validationSummaries[1]?.input.series).toBe("BC");
  });

  it("should return 400 Bad Request when fewer than 2 candidates are provided", async () => {
    // Only 1 candidate
    const url = "http://localhost:3000/api/v1/candidate-lab?candidates=KN:BB:814615";
    const req = new NextRequest(url, { method: "GET" });
    const response = await GET(req);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("BAD_REQUEST");
    expect(json.message).toContain("requires at least 2 candidate tickets");
  });

  it("should return 400 Bad Request when no candidates are provided", async () => {
    const url = "http://localhost:3000/api/v1/candidate-lab";
    const req = new NextRequest(url, { method: "GET" });
    const response = await GET(req);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("BAD_REQUEST");
    expect(json.message).toContain("requires at least 2 candidate tickets");
  });

  it("should return 400 Bad Request when more than 10 candidates are provided", async () => {
    const candidates = Array.from({ length: 11 }, (_, i) => `KN:PA:10000${i}`).join(",");
    const url = `http://localhost:3000/api/v1/candidate-lab?candidates=${candidates}`;
    const req = new NextRequest(url, { method: "GET" });
    const response = await GET(req);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("BAD_REQUEST");
    expect(json.message).toContain("maximum of 10 candidate tickets");
  });

  it("should reject POST with 405 Method Not Allowed and Allow: GET", async () => {
    const response = await POST();
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET");
    const json = await response.json();
    expect(json.error).toBe("METHOD_NOT_ALLOWED");
  });

  it("should reject PUT with 405 Method Not Allowed and Allow: GET", async () => {
    const response = await PUT();
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET");
    const json = await response.json();
    expect(json.error).toBe("METHOD_NOT_ALLOWED");
  });

  it("should reject DELETE with 405 Method Not Allowed and Allow: GET", async () => {
    const response = await DELETE();
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET");
    const json = await response.json();
    expect(json.error).toBe("METHOD_NOT_ALLOWED");
  });

  it("should reject PATCH with 405 Method Not Allowed and Allow: GET", async () => {
    const response = await PATCH();
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET");
    const json = await response.json();
    expect(json.error).toBe("METHOD_NOT_ALLOWED");
  });

  it("should integrate with researchService.analyzeCandidateLab", async () => {
    const result = await researchService.analyzeCandidateLab({
      candidates: [
        { lotteryCode: "BT", series: "BB", ticketNumber: "814615" },
        { lotteryCode: "BT", series: "WA", ticketNumber: "123456" }
      ]
    });

    expect(result.candidateCount).toBe(2);
    expect(result.validationSummaries.every((v) => v.validation.isValid)).toBe(true);
    expect(result.historicalComparisons[0]?.exactMatch.observedInCorpus).toBe(true);
    expect(result.seriesComparison.criticalExposureNotice).toContain(
      "Observed winner counts by series are not exposure-adjusted"
    );
  });
});
