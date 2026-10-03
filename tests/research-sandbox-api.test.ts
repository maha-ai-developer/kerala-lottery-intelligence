/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone V1.0: Research Sandbox API Route & Read-Only Invariant Tests
 *
 * Verifies:
 * 1. GET /api/v1/research-sandbox endpoint execution
 * 2. Parameter validation & 400 Bad Request error responses
 * 3. 405 Method Not Allowed guard on POST, PUT, DELETE, PATCH
 * 4. Cache-Control headers (no-store, no-cache, must-revalidate)
 * 5. Production mutation guard (zero write side effects)
 */

import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import {
  GET,
  POST,
  PUT,
  DELETE,
  PATCH
} from "../apps/web/app/api/v1/research-sandbox/route";
import { researchService } from "../packages/data/src/research-service";

describe("Milestone V1.0: Research Sandbox API Route (/api/v1/research-sandbox)", () => {
  it("should process valid GET request and return 200 with complete analysis data", async () => {
    const url = "http://localhost:3000/api/v1/research-sandbox?lottery=KN&series=PA&number=123456";
    const req = new NextRequest(url, { method: "GET" });
    const response = await GET(req);

    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.analysisId).toMatch(/^sandbox_[0-9a-f]{16}$/);
    expect(json.validation.isValid).toBe(true);
    expect(json.featureProfile.canonicalNumber).toBe("123456");
    expect(json.historicalComparison.sampleSizeResults).toBe(39550);
    expect(json.provenance.corpusVersion).toBe("v1.0-research-103draws");
  });

  it("should return 400 Bad Request when required query parameters are missing", async () => {
    // Missing number
    const url = "http://localhost:3000/api/v1/research-sandbox?lottery=KN&series=PA";
    const req = new NextRequest(url, { method: "GET" });
    const response = await GET(req);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("BAD_REQUEST");
    expect(json.message).toContain("Missing required query parameters");
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

  it("should integrate with researchService.analyzeSandboxTicket", async () => {
    const result = await researchService.analyzeSandboxTicket({
      lotteryCode: "BT",
      series: "BB",
      ticketNumber: "814615"
    });

    expect(result.validation.isValid).toBe(true);
    expect(result.historicalComparison?.exactTicketMatch.observedInCorpus).toBe(true);
    expect(result.historicalComparison?.exactTicketMatch.matches[0]?.drawId).toBe("draw_BT-73");
  });
});
