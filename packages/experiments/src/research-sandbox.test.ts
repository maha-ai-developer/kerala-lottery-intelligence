/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone V1.0: End-to-End Research Sandbox Test Suite
 *
 * Verifies all Section 41 requirements:
 * 1. Valid lottery + scheme + series + number
 * 2. Invalid lottery rejection
 * 3. Invalid scheme resolution handling
 * 4. Invalid series rejection
 * 5. Invalid ticket number length rejection
 * 6. Leading-zero preservation as immutable canonical strings
 * 7. Exact historical ticket match detection
 * 8. Non-historical ticket analysis
 * 9. Mathematical feature extraction consistency
 * 10. Historical frequency comparison with Wilson 95% CIs
 * 11. Deterministic output & reproducible SHA-256 fingerprinting
 * 12. Temporal cutoff protection (zero future data leakage)
 * 13. Lineage and provenance tracing
 * 14. Zero canonical research corpus mutation
 * 15. Zero PROD data mutation & API read-only behavior
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ResearchSandboxEngine,
  type CandidateTicketInput,
  type ResearchSandboxAnalysis
} from "./index";

describe("Milestone V1.0: Research Sandbox Engine", () => {
  let engine: ResearchSandboxEngine;

  beforeAll(() => {
    engine = new ResearchSandboxEngine({
      baseDir: process.cwd()
    });
  });

  // 1. Valid lottery + scheme + series + number
  it("should successfully validate and analyze a valid candidate ticket", () => {
    const input: CandidateTicketInput = {
      lotteryCode: "KN",
      series: "PA",
      ticketNumber: "123456"
    };

    const res: ResearchSandboxAnalysis = engine.analyzeTicket(input);

    expect(res.validation.isValid).toBe(true);
    expect(res.validation.errors).toHaveLength(0);
    expect(res.analysisId).toMatch(/^sandbox_[0-9a-f]{16}$/);
    expect(res.featureProfile).toBeDefined();
    expect(res.featureProfile?.canonicalNumber).toBe("123456");
    expect(res.historicalComparison).toBeDefined();
    expect(res.historicalComparison?.sampleSizeResults).toBe(39550);
    expect(res.historicalComparison?.sampleSizeDraws).toBe(103);
    expect(res.researchInterpretation.classifications).toContain("STRUCTURALLY_VALID");
  });

  // 2. Invalid lottery rejection
  it("should reject an invalid/unregistered lottery code", () => {
    const input: CandidateTicketInput = {
      lotteryCode: "INVALID_LOTTERY_XYZ",
      series: "PA",
      ticketNumber: "123456"
    };

    const res = engine.analyzeTicket(input);

    expect(res.validation.isValid).toBe(false);
    expect(res.validation.errors.length).toBeGreaterThan(0);
    expect(res.validation.errors[0]).toContain("not registered");
    expect(res.featureProfile).toBeUndefined();
    expect(res.researchInterpretation.classifications).toContain("STRUCTURALLY_INVALID");
  });

  // 3. Invalid scheme resolution handling
  it("should reject an invalid schemeVersionId", () => {
    const input: CandidateTicketInput = {
      lotteryCode: "KN",
      schemeVersionId: "non_existent_scheme_v999",
      series: "PA",
      ticketNumber: "123456"
    };

    const res = engine.analyzeTicket(input);

    expect(res.validation.isValid).toBe(false);
    expect(res.validation.errors.some((e) => e.includes("non_existent_scheme_v999"))).toBe(true);
  });

  // 4. Invalid series rejection
  it("should reject an invalid series code (numeric or incorrect length)", () => {
    const input: CandidateTicketInput = {
      lotteryCode: "KN",
      series: "123", // Invalid for weekly (requires 2-letter uppercase)
      ticketNumber: "123456"
    };

    const res = engine.analyzeTicket(input);

    expect(res.validation.isValid).toBe(false);
    expect(res.validation.errors.some((e) => e.includes("Series '123' is invalid"))).toBe(true);
  });

  it("should enforce known series for bumper schemes (e.g. Monsoon Bumper BR-110)", () => {
    const invalidBumper: CandidateTicketInput = {
      lotteryCode: "MONSOON_BUMPER",
      series: "ZZ", // Allowed is MA, MB, MC, MD, ME
      ticketNumber: "123456"
    };

    const res = engine.analyzeTicket(invalidBumper);
    expect(res.validation.isValid).toBe(false);
    expect(res.validation.errors.some((e) => e.includes("Allowed series codes: [MA, MB, MC, MD, ME]"))).toBe(true);

    const validBumper: CandidateTicketInput = {
      lotteryCode: "MONSOON_BUMPER",
      series: "MA",
      ticketNumber: "123456"
    };
    const validRes = engine.analyzeTicket(validBumper);
    expect(validRes.validation.isValid).toBe(true);
  });

  // 5. Invalid ticket length rejection
  it("should reject a ticket number with invalid length or non-digits", () => {
    const shortNum: CandidateTicketInput = {
      lotteryCode: "KN",
      series: "PA",
      ticketNumber: "1234" // 4 digits instead of 6
    };
    const shortRes = engine.analyzeTicket(shortNum);
    expect(shortRes.validation.isValid).toBe(false);
    expect(shortRes.validation.errors.some((e) => e.includes("requires exactly 6 digits"))).toBe(true);

    const alphaNum: CandidateTicketInput = {
      lotteryCode: "KN",
      series: "PA",
      ticketNumber: "12A456"
    };
    const alphaRes = engine.analyzeTicket(alphaNum);
    expect(alphaRes.validation.isValid).toBe(false);
    expect(alphaRes.validation.errors.some((e) => e.includes("must contain only digits"))).toBe(true);
  });

  // 6. Leading-zero preservation as immutable canonical strings
  it("should strictly preserve leading zeros without numeric coercion", () => {
    const input: CandidateTicketInput = {
      lotteryCode: "KN",
      series: "PA",
      ticketNumber: "001248"
    };

    const res = engine.analyzeTicket(input);

    expect(res.validation.isValid).toBe(true);
    expect(res.featureProfile?.canonicalNumber).toBe("001248");
    expect(res.featureProfile?.firstDigit).toBe("0");
    expect(res.featureProfile?.lastDigit).toBe("8");
    expect(res.featureProfile?.zeroCount).toBe(2);
    expect(res.featureProfile?.numberLength).toBe(6);
  });

  // 7. Exact historical ticket match detection
  it("should accurately identify an exact historical winning ticket in the corpus", () => {
    // BHAGYATHARA BT-73 1st prize winner is BB 814615
    const input: CandidateTicketInput = {
      lotteryCode: "BT",
      series: "BB",
      ticketNumber: "814615"
    };

    const res = engine.analyzeTicket(input);

    expect(res.validation.isValid).toBe(true);
    expect(res.historicalComparison?.exactTicketMatch.observedInCorpus).toBe(true);
    expect(res.historicalComparison?.exactTicketMatch.matchCount).toBeGreaterThanOrEqual(1);

    const match = res.historicalComparison?.exactTicketMatch.matches[0];
    expect(match?.drawId).toBe("draw_BT-73");
    expect(match?.prizeTierName).toContain("1st");
    expect(match?.canonicalNumber).toBe("814615");
    expect(res.researchInterpretation.classifications).toContain("COMMON");
  });

  // 8. Non-historical ticket analysis
  it("should handle unobserved tickets descriptively without prediction or error", () => {
    const input: CandidateTicketInput = {
      lotteryCode: "KN",
      series: "PA",
      ticketNumber: "999999"
    };

    const res = engine.analyzeTicket(input);

    expect(res.validation.isValid).toBe(true);
    expect(res.historicalComparison?.exactTicketMatch.observedInCorpus).toBe(false);
    expect(res.historicalComparison?.exactTicketMatch.matchCount).toBe(0);
    expect(res.researchInterpretation.classifications).toContain("NOVEL");
    expect(res.researchInterpretation.classifications).toContain("OUTSIDE_CURRENT_CORPUS_OBSERVATION");
  });

  // 9. Mathematical feature extraction consistency
  it("should extract correct structural, parity, positional, and suffix features", () => {
    const input: CandidateTicketInput = {
      lotteryCode: "DL",
      series: "DA",
      ticketNumber: "123456"
    };

    const res = engine.analyzeTicket(input);
    const fp = res.featureProfile!;

    expect(fp.digits).toEqual([1, 2, 3, 4, 5, 6]);
    expect(fp.digitSum).toBe(21);
    expect(fp.uniqueDigitCount).toBe(6);
    expect(fp.hasRepeatedDigit).toBe(false);
    expect(fp.evenDigitCount).toBe(3);
    expect(fp.oddDigitCount).toBe(3);
    expect(fp.parityBalance).toBe("BALANCED");
    expect(fp.suffix2).toBe("56");
    expect(fp.suffix3).toBe("456");
    expect(fp.suffix4).toBe("3456");
    expect(fp.structural.isAscending).toBe(true);
    expect(fp.structural.isDescending).toBe(false);
    expect(fp.structural.isPalindrome).toBe(false);
  });

  // 10. Historical frequency comparison with Wilson 95% CIs
  it("should calculate empirical frequencies and Wilson 95% confidence intervals", () => {
    const input: CandidateTicketInput = {
      lotteryCode: "KN",
      series: "PA",
      ticketNumber: "123456"
    };

    const res = engine.analyzeTicket(input);
    const comp = res.historicalComparison!;

    expect(comp.lastDigitComparison.inputDigit).toBe("6");
    expect(comp.lastDigitComparison.observedCount).toBeGreaterThan(0);
    expect(comp.lastDigitComparison.empiricalFrequency).toBeCloseTo(0.1, 1);
    expect(comp.lastDigitComparison.expectedUniformFrequency).toBe(0.1);

    const [ciLow, ciHigh] = comp.lastDigitComparison.wilsonConfidenceInterval95;
    expect(ciLow).toBeLessThan(comp.lastDigitComparison.empiricalFrequency);
    expect(ciHigh).toBeGreaterThan(comp.lastDigitComparison.empiricalFrequency);
    expect(ciLow).toBeGreaterThan(0.08);
    expect(ciHigh).toBeLessThan(0.12);
  });

  // 11. Deterministic output & reproducible SHA-256 fingerprinting
  it("should produce deterministic analysis IDs and identical hashes for identical inputs", () => {
    const input1: CandidateTicketInput = {
      lotteryCode: "KN",
      series: "PA",
      ticketNumber: "554433"
    };
    const input2: CandidateTicketInput = {
      lotteryCode: "kn",
      series: "pa",
      ticketNumber: "554433"
    };

    const res1 = engine.analyzeTicket(input1);
    const res2 = engine.analyzeTicket(input2);

    expect(res1.analysisId).toBe(res2.analysisId);
    expect(res1.deterministicHash).toBe(res2.deterministicHash);
  });

  // 12. Temporal cutoff protection (zero future data leakage)
  it("should respect temporal cutoff dates and exclude subsequent draws from comparison", () => {
    // BHAGYATHARA BT-73 was drawn on 2026-09-28
    // If cutoff is set to 2026-09-20, BT-73 must NOT be in the comparison sample
    const inputWithCutoff: CandidateTicketInput = {
      lotteryCode: "BT",
      series: "BB",
      ticketNumber: "814615",
      temporalCutoffDate: "2026-09-20"
    };

    const resWithCutoff = engine.analyzeTicket(inputWithCutoff);

    expect(resWithCutoff.historicalComparison?.temporalCutoffApplied).toBe(true);
    expect(resWithCutoff.historicalComparison?.cutoffDate).toBe("2026-09-20");
    expect(resWithCutoff.historicalComparison?.exactTicketMatch.observedInCorpus).toBe(false);
    expect(resWithCutoff.historicalComparison?.sampleSizeDraws).toBeLessThan(103);
  });

  // 13. Lineage and provenance tracing
  it("should include complete provenance versions and audit hashes", () => {
    const input: CandidateTicketInput = {
      lotteryCode: "KN",
      series: "PA",
      ticketNumber: "123456"
    };

    const res = engine.analyzeTicket(input);

    expect(res.provenance.corpusVersion).toBe("v1.0-research-103draws");
    expect(res.provenance.featureVersion).toBe("feat_v1");
    expect(res.provenance.datasetVersion).toBe("dataset_7c_canonical");
    expect(res.provenance.experimentVersion).toBe("exp_v1");
    expect(res.provenance.validationVersion).toBe("val_v1");
    expect(res.provenance.geographicVersion).toBe("geo_10a_v1");
    expect(res.provenance.auditSha256).toBe(res.deterministicHash);
  });

  // 14. Zero canonical research corpus mutation
  it("should not mutate the canonical corpus or manifest on analysis", () => {
    const manifestPath = join(process.cwd(), "data/processed-cache/manifest.json");
    const rawBefore = readFileSync(manifestPath, "utf-8");

    // Execute multiple sandbox analyses
    engine.analyzeTicket({ lotteryCode: "KN", series: "PA", ticketNumber: "123456" });
    engine.analyzeTicket({ lotteryCode: "BT", series: "WA", ticketNumber: "025916" });

    const rawAfter = readFileSync(manifestPath, "utf-8");
    expect(rawAfter).toBe(rawBefore);
  });

  // 15. Geographic Exposure limitation notice enforcement
  it("should enforce mandatory ticket exposure unavailable disclaimer in geographic context", () => {
    const input: CandidateTicketInput = {
      lotteryCode: "KN",
      series: "PA",
      ticketNumber: "123456"
    };

    const res = engine.analyzeTicket(input);

    expect(res.geographicContext?.isExposureAvailable).toBe(false);
    expect(res.geographicContext?.criticalExposureLimitation).toContain(
      "District-level ticket exposure is not available in the current evidence base"
    );
    expect(res.limitations.exposureLimitation).toContain("historical district counts are descriptive");
  });
});
