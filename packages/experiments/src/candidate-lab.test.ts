/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone V1.0 Final: Multi-Candidate Comparison & Historical Backtesting Lab Test Suite
 *
 * Verifies:
 * 1. Bounded candidate entry (2 to 10 candidates)
 * 2. Less than 2 candidates rejection
 * 3. Greater than 10 candidates rejection
 * 4. Duplicate candidate detection & warning
 * 5. Individual candidate structural scheme validation
 * 6. Leading-zero preservation across all candidates
 * 7. Mathematical feature extraction consistency across candidates
 * 8. Historical comparison against the 103-draw research corpus
 * 9. Series comparison metrics & mandatory exposure disclaimer
 * 10. Walk-forward chronological backtesting with zero future data leakage
 * 11. Temporal stability classification (HISTORICALLY STABLE, HISTORICALLY VARIABLE, NOVEL)
 * 12. Comparative trade-off matrix & non-predictive guardrails
 * 13. Descriptive research interpretation & decision authority
 * 14. Deterministic output & reproducible SHA-256 fingerprinting
 * 15. Complete provenance lineage (corpusVersion, featureVersion, candidateSetVersion, etc.)
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  CandidateLabEngine,
  type CandidateLabRequest,
  type CandidateLabAnalysis
} from "./index";

describe("Milestone V1.0: Multi-Candidate Comparison & Historical Backtesting Lab", () => {
  let engine: CandidateLabEngine;

  beforeAll(() => {
    engine = new CandidateLabEngine({
      baseDir: process.cwd()
    });
  });

  // 1. Valid multi-candidate analysis (Prompt example: Karunya BB, BC, BD)
  it("should successfully analyze multiple candidates side-by-side (Prompt Example)", () => {
    const req: CandidateLabRequest = {
      candidates: [
        { id: "A", lotteryCode: "KN", series: "BB", ticketNumber: "814615" },
        { id: "B", lotteryCode: "KN", series: "BC", ticketNumber: "271904" },
        { id: "C", lotteryCode: "KN", series: "BD", ticketNumber: "563281" }
      ],
      backtestWindows: 4
    };

    const res: CandidateLabAnalysis = engine.analyzeCandidateSet(req);

    expect(res.candidateCount).toBe(3);
    expect(res.analysisId).toMatch(/^candidate_lab_[0-9a-f]{16}$/);
    expect(res.deterministicHash).toHaveLength(64);
    expect(res.validationSummaries).toHaveLength(3);
    expect(res.validationSummaries.every((v) => v.validation.isValid)).toBe(true);

    // Feature Profiles
    expect(res.featureProfiles).toHaveLength(3);
    expect(res.featureProfiles[0]?.canonicalNumber).toBe("814615");
    expect(res.featureProfiles[1]?.canonicalNumber).toBe("271904");
    expect(res.featureProfiles[2]?.canonicalNumber).toBe("563281");

    // Historical Comparisons
    expect(res.historicalComparisons).toHaveLength(3);

    // Series Comparison
    expect(res.seriesComparison.seriesItems.length).toBeGreaterThanOrEqual(3);
    expect(res.seriesComparison.criticalExposureNotice).toContain(
      "Observed winner counts by series are not exposure-adjusted"
    );

    // Walk-Forward Backtesting
    expect(res.backtestResults.windows).toHaveLength(4);
    expect(res.backtestResults.candidateResults).toHaveLength(3);
    expect(res.backtestResults.temporalLeakageAssertionPassed).toBe(true);

    // Trade-off Analysis
    expect(res.tradeOffAnalysis.comparisonMatrix).toHaveLength(3);
    expect(res.tradeOffAnalysis.nonPredictiveNotice).toContain("descriptive empirical evidence only");

    // Provenance
    expect(res.provenance.corpusVersion).toBe("v1.0-research-103draws");
    expect(res.provenance.candidateSetVersion).toBe("candidates_v1");
  });

  // 2. Reject less than 2 candidates
  it("should reject a request with fewer than 2 candidates", () => {
    const singleReq: CandidateLabRequest = {
      candidates: [{ lotteryCode: "KN", series: "BB", ticketNumber: "814615" }]
    };

    expect(() => engine.analyzeCandidateSet(singleReq)).toThrow(
      /Candidate Lab requires at least 2 candidate tickets/
    );

    const emptyReq: CandidateLabRequest = {
      candidates: []
    };

    expect(() => engine.analyzeCandidateSet(emptyReq)).toThrow(
      /Candidate Lab requires at least 2 candidate tickets/
    );
  });

  // 3. Reject more than 10 candidates
  it("should reject a request with more than 10 candidates", () => {
    const overReq: CandidateLabRequest = {
      candidates: Array.from({ length: 11 }, (_, i) => ({
        lotteryCode: "KN",
        series: "PA",
        ticketNumber: `10000${i}`
      }))
    };

    expect(() => engine.analyzeCandidateSet(overReq)).toThrow(
      /Candidate Lab accepts a maximum of 10 candidates/
    );
  });

  // 4. Duplicate candidate detection & warning
  it("should detect and flag duplicate candidate tickets", () => {
    const dupReq: CandidateLabRequest = {
      candidates: [
        { id: "A", lotteryCode: "KN", series: "BB", ticketNumber: "814615" },
        { id: "B", lotteryCode: "KN", series: "BC", ticketNumber: "271904" },
        { id: "C", lotteryCode: "KN", series: "BB", ticketNumber: "814615" } // Duplicate of A
      ]
    };

    const res = engine.analyzeCandidateSet(dupReq);

    expect(res.hasDuplicates).toBe(true);
    expect(res.duplicateCount).toBe(1);

    const dupC = res.validationSummaries.find((v) => v.candidateId === "C");
    expect(dupC?.isDuplicate).toBe(true);
    expect(dupC?.duplicateOf).toBe("A");
    expect(dupC?.validation.warnings.some((w) => w.includes("Duplicate candidate detected"))).toBe(true);

    const dupA = res.validationSummaries.find((v) => v.candidateId === "A");
    expect(dupA?.isDuplicate).toBe(false);
  });

  // 5. Individual candidate structural scheme validation
  it("should validate each candidate independently and diagnose invalid inputs", () => {
    const mixedReq: CandidateLabRequest = {
      candidates: [
        { id: "A", lotteryCode: "KN", series: "PA", ticketNumber: "123456" },
        { id: "B", lotteryCode: "INVALID_LOTTERY", series: "PA", ticketNumber: "123456" },
        { id: "C", lotteryCode: "KN", series: "123", ticketNumber: "123456" }, // Invalid series
        { id: "D", lotteryCode: "KN", series: "PA", ticketNumber: "999" } // Invalid length
      ]
    };

    const res = engine.analyzeCandidateSet(mixedReq);

    const valA = res.validationSummaries.find((v) => v.candidateId === "A")!;
    expect(valA.validation.isValid).toBe(true);

    const valB = res.validationSummaries.find((v) => v.candidateId === "B")!;
    expect(valB.validation.isValid).toBe(false);
    expect(valB.validation.errors.some((e) => e.includes("not registered"))).toBe(true);

    const valC = res.validationSummaries.find((v) => v.candidateId === "C")!;
    expect(valC.validation.isValid).toBe(false);
    expect(valC.validation.errors.some((e) => e.includes("Series '123' is invalid"))).toBe(true);

    const valD = res.validationSummaries.find((v) => v.candidateId === "D")!;
    expect(valD.validation.isValid).toBe(false);
    expect(valD.validation.errors.some((e) => e.includes("requires exactly 6 digits"))).toBe(true);
  });

  // 6. Leading-zero preservation across all candidates
  it("should strictly preserve leading zeros as immutable canonical strings", () => {
    const lzReq: CandidateLabRequest = {
      candidates: [
        { id: "A", lotteryCode: "KN", series: "PA", ticketNumber: "001248" },
        { id: "B", lotteryCode: "KN", series: "PB", ticketNumber: "000005" }
      ]
    };

    const res = engine.analyzeCandidateSet(lzReq);

    const featA = res.featureProfiles.find((f) => f.candidateId === "A")!;
    expect(featA.canonicalNumber).toBe("001248");
    expect(featA.profile?.firstDigit).toBe("0");
    expect(featA.profile?.zeroCount).toBe(2);

    const featB = res.featureProfiles.find((f) => f.candidateId === "B")!;
    expect(featB.canonicalNumber).toBe("000005");
    expect(featB.profile?.firstDigit).toBe("0");
    expect(featB.profile?.zeroCount).toBe(5);
  });

  // 7. Mathematical feature extraction consistency
  it("should extract parity balance, digit sum, unique digits, and structural patterns", () => {
    const req: CandidateLabRequest = {
      candidates: [
        { id: "A", lotteryCode: "DL", series: "DA", ticketNumber: "123456" }, // Ascending, balanced parity
        { id: "B", lotteryCode: "SS", series: "SA", ticketNumber: "456654" } // Palindrome, balanced parity
      ]
    };

    const res = engine.analyzeCandidateSet(req);

    const pA = res.featureProfiles.find((f) => f.candidateId === "A")?.profile!;
    expect(pA.digitSum).toBe(21);
    expect(pA.parityBalance).toBe("BALANCED");
    expect(pA.structural.isAscending).toBe(true);
    expect(pA.structural.isPalindrome).toBe(false);

    const pB = res.featureProfiles.find((f) => f.candidateId === "B")?.profile!;
    expect(pB.digitSum).toBe(30);
    expect(pB.structural.isPalindrome).toBe(true);
    expect(pB.structural.isAscending).toBe(false);
  });

  // 8. Historical comparison against the 103-draw research corpus
  it("should accurately compare exact matches, terminal digits, and suffixes", () => {
    const req: CandidateLabRequest = {
      candidates: [
        // BT-73 1st prize winner BB 814615
        { id: "A", lotteryCode: "BT", series: "BB", ticketNumber: "814615" },
        // Unobserved candidate
        { id: "B", lotteryCode: "BT", series: "WA", ticketNumber: "999999" }
      ]
    };

    const res = engine.analyzeCandidateSet(req);

    const histA = res.historicalComparisons.find((h) => h.candidateId === "A")!;
    expect(histA.exactMatch.observedInCorpus).toBe(true);
    expect(histA.exactMatch.matchCount).toBeGreaterThanOrEqual(1);
    expect(histA.exactMatch.matches[0]?.drawId).toBe("draw_BT-73");
    expect(histA.empiricalClassifications).toContain("COMMON");

    const histB = res.historicalComparisons.find((h) => h.candidateId === "B")!;
    expect(histB.exactMatch.observedInCorpus).toBe(false);
    expect(histB.exactMatch.matchCount).toBe(0);
    expect(histB.empiricalClassifications).toContain("NOVEL");
  });

  // 9. Series comparison metrics & mandatory exposure disclaimer
  it("should calculate series metrics and enforce mandatory exposure notice", () => {
    const req: CandidateLabRequest = {
      candidates: [
        { id: "A", lotteryCode: "KN", series: "BB", ticketNumber: "814615" },
        { id: "B", lotteryCode: "KN", series: "BC", ticketNumber: "271904" },
        { id: "C", lotteryCode: "KN", series: "BB", ticketNumber: "123456" } // Shared series BB
      ]
    };

    const res = engine.analyzeCandidateSet(req);

    const seriesResult = res.seriesComparison;
    expect(seriesResult.seriesItems.length).toBe(2); // BB and BC

    const itemBB = seriesResult.seriesItems.find((s) => s.series === "BB")!;
    expect(itemBB.associatedCandidateIds).toEqual(["A", "C"]);
    expect(itemBB.observedCorpusCount).toBeGreaterThan(0);
    expect(itemBB.distinctDrawsCount).toBeGreaterThan(0);
    expect(itemBB.exposureStatus).toBe("EXPOSURE_UNAVAILABLE");
    expect(itemBB.disclaimer).toContain("Observed winner counts by series are not exposure-adjusted");

    expect(seriesResult.criticalExposureNotice).toContain(
      "Observed winner counts by series are not exposure-adjusted"
    );
  });

  // 10. Walk-forward chronological backtesting with zero future data leakage
  it("should perform walk-forward backtesting with strict chronological protection", () => {
    const req: CandidateLabRequest = {
      candidates: [
        { id: "A", lotteryCode: "KN", series: "BB", ticketNumber: "814615" },
        { id: "B", lotteryCode: "KN", series: "BC", ticketNumber: "271904" }
      ],
      backtestWindows: 4
    };

    const res = engine.analyzeCandidateSet(req);

    expect(res.backtestResults.temporalLeakageAssertionPassed).toBe(true);
    expect(res.backtestResults.windows).toHaveLength(4);

    // Verify windows are strictly monotonically non-decreasing in cutoff date and draw count
    for (let i = 1; i < res.backtestResults.windows.length; i++) {
      const prev = res.backtestResults.windows[i - 1]!;
      const curr = res.backtestResults.windows[i]!;
      expect(curr.drawCount).toBeGreaterThan(prev.drawCount);
      expect(curr.cutoffDate >= prev.cutoffDate).toBe(true);
    }

    // Verify candidate window metrics exist for each window
    for (const candRes of res.backtestResults.candidateResults) {
      expect(candRes.windowMetrics).toHaveLength(4);
      for (const m of candRes.windowMetrics) {
        expect(m.sampleSizeResults).toBeGreaterThan(0);
        expect(m.terminalDigitFrequency).toBeGreaterThan(0);
      }
    }
  });

  // 11. Temporal stability classification
  it("should classify candidates into descriptive stability categories", () => {
    const req: CandidateLabRequest = {
      candidates: [
        { id: "A", lotteryCode: "KN", series: "BB", ticketNumber: "814615" },
        { id: "B", lotteryCode: "KN", series: "BC", ticketNumber: "000001" } // Novel / rare
      ],
      backtestWindows: 4
    };

    const res = engine.analyzeCandidateSet(req);

    const validClassifications = ["HISTORICALLY STABLE", "HISTORICALLY VARIABLE", "NOVEL"];
    for (const candRes of res.backtestResults.candidateResults) {
      expect(validClassifications).toContain(candRes.stabilityClassification);
      expect(candRes.descriptiveTrend).toContain("Terminal digit frequency across 4 historical checkpoints");
    }
  });

  // 12. Comparative trade-off matrix & non-predictive guardrails
  it("should construct trade-off matrix without predictive scores or preferred selection", () => {
    const req: CandidateLabRequest = {
      candidates: [
        { id: "A", lotteryCode: "KN", series: "BB", ticketNumber: "814615" },
        { id: "B", lotteryCode: "KN", series: "BC", ticketNumber: "271904" },
        { id: "C", lotteryCode: "KN", series: "BD", ticketNumber: "563281" }
      ]
    };

    const res = engine.analyzeCandidateSet(req);

    const matrix = res.tradeOffAnalysis.comparisonMatrix;
    expect(matrix).toHaveLength(3);

    // Verify default order matches user input order (A, B, C)
    expect(matrix[0]?.candidateId).toBe("A");
    expect(matrix[1]?.candidateId).toBe("B");
    expect(matrix[2]?.candidateId).toBe("C");

    for (const row of matrix) {
      expect(row.descriptiveCharacteristics.length).toBeGreaterThan(0);
      expect(row.stability).toBeDefined();
      // Ensure no forbidden score fields exist
      expect((row as any).aiScore).toBeUndefined();
      expect((row as any).winningScore).toBeUndefined();
      expect((row as any).winningProbability).toBeUndefined();
      expect((row as any).preferred).toBeUndefined();
    }

    expect(res.tradeOffAnalysis.nonPredictiveNotice).toContain("descriptive empirical evidence only");
  });

  // 13. Descriptive research interpretation & decision authority
  it("should generate descriptive research interpretation with explicit user decision authority", () => {
    const req: CandidateLabRequest = {
      candidates: [
        { id: "A", lotteryCode: "KN", series: "BB", ticketNumber: "814615" },
        { id: "B", lotteryCode: "KN", series: "BC", ticketNumber: "271904" }
      ]
    };

    const res = engine.analyzeCandidateSet(req);

    const interp = res.researchInterpretation;
    expect(interp.summary).toContain("Evaluated 2 candidate tickets");
    expect(interp.globalNotice).toContain(
      "Historical commonness/uncommonness is descriptive. It does not establish future winning probability"
    );

    for (const ci of interp.candidateInterpretations) {
      expect(ci.descriptiveText).toContain("Historical commonness or uncommonness is purely descriptive");
    }
  });

  // 14. Deterministic output & reproducible SHA-256 fingerprinting
  it("should produce identical analysis IDs and deterministic hashes for identical inputs", () => {
    const req1: CandidateLabRequest = {
      candidates: [
        { lotteryCode: "KN", series: "BB", ticketNumber: "814615" },
        { lotteryCode: "KN", series: "BC", ticketNumber: "271904" }
      ]
    };

    const req2: CandidateLabRequest = {
      candidates: [
        { lotteryCode: "kn", series: "bb", ticketNumber: "814615" },
        { lotteryCode: "kn", series: "bc", ticketNumber: "271904" }
      ]
    };

    const res1 = engine.analyzeCandidateSet(req1);
    const res2 = engine.analyzeCandidateSet(req2);

    expect(res1.analysisId).toBe(res2.analysisId);
    expect(res1.deterministicHash).toBe(res2.deterministicHash);
  });

  // 15. Complete provenance lineage
  it("should include complete provenance versions and audit hashes", () => {
    const req: CandidateLabRequest = {
      candidates: [
        { lotteryCode: "KN", series: "BB", ticketNumber: "814615" },
        { lotteryCode: "KN", series: "BC", ticketNumber: "271904" }
      ]
    };

    const res = engine.analyzeCandidateSet(req);

    expect(res.provenance.corpusVersion).toBe("v1.0-research-103draws");
    expect(res.provenance.featureVersion).toBe("feat_v1");
    expect(res.provenance.datasetVersion).toBe("dataset_7c_canonical");
    expect(res.provenance.experimentVersion).toBe("exp_v1");
    expect(res.provenance.validationVersion).toBe("val_v1");
    expect(res.provenance.candidateSetVersion).toBe("candidates_v1");
    expect(res.provenance.geographicVersion).toBe("geo_10a_v1");
    expect(res.provenance.auditSha256).toBe(res.deterministicHash);
  });
});
