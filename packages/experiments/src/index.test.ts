import { describe, it, expect } from "vitest";
import {
  assertNoTemporalLeakage,
  createMulberry32,
  generateUniformRandomCandidate
} from "./index";

describe("Experiment Engine & Temporal Invariants", () => {
  it("allows training dates strictly before the prediction cut-off", () => {
    expect(() => {
      assertNoTemporalLeakage(["2026-09-01", "2026-09-10"], "2026-09-15T00:00:00Z");
    }).not.toThrow();
  });

  it("REJECTS temporal leakage when a training date is on or after the cut-off", () => {
    expect(() => {
      assertNoTemporalLeakage(["2026-09-10", "2026-09-15"], "2026-09-15T00:00:00Z");
    }).toThrowError(/TEMPORAL LEAKAGE VIOLATION/);

    expect(() => {
      assertNoTemporalLeakage(["2026-09-16"], "2026-09-15T00:00:00Z");
    }).toThrowError(/TEMPORAL LEAKAGE VIOLATION/);
  });

  it("reproduces identical pseudo-random outputs given the same seed", () => {
    const rng1 = createMulberry32(42);
    const rng2 = createMulberry32(42);

    const val1 = rng1();
    const val2 = rng2();
    expect(val1).toBe(val2);

    const cand1 = generateUniformRandomCandidate(rng1, 4);
    const cand2 = generateUniformRandomCandidate(rng2, 4);
    expect(cand1).toBe(cand2);
    expect(cand1.length).toBe(4);
  });

  it("preserves leading zeros in uniform random candidate generation", () => {
    // Seed configured to produce values with leading zeros
    const rng = () => 0.0025; // 0.0025 * 10000 = 25 -> "0025"
    const cand = generateUniformRandomCandidate(rng, 4);
    expect(cand).toBe("0025");
  });
});
