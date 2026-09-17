import { describe, it, expect } from "vitest";
import {
  calculateFrequency,
  calculateDigitDistribution,
  calculateEntropy,
  calculateChiSquareUniform,
  calculateRunsTest
} from "./index";

describe("Deterministic Statistics Engine", () => {
  it("calculates frequencies and totals accurately", () => {
    const data = ["0276", "1123", "0276", "9999"];
    const result = calculateFrequency(data);

    expect(result.total).toBe(4);
    expect(result.counts["0276"]).toBe(2);
    expect(result.frequencies["0276"]).toBe(0.5);
    expect(result.counts["1123"]).toBe(1);
    expect(result.frequencies["1123"]).toBe(0.25);
  });

  it("calculates digit distributions across positions", () => {
    const numbers = ["0276", "0386"];
    const dist = calculateDigitDistribution(numbers);

    // Position 0: both '0'
    expect(dist[0]?.["0"]).toBe(2);
    // Position 1: '2' and '3'
    expect(dist[1]?.["2"]).toBe(1);
    expect(dist[1]?.["3"]).toBe(1);
    // Position 3: both '6'
    expect(dist[3]?.["6"]).toBe(2);
  });

  it("calculates Shannon Entropy deterministically", () => {
    // Fair 2-outcome coin has 1 bit entropy
    const coinEntropy = calculateEntropy([0.5, 0.5]);
    expect(coinEntropy).toBeCloseTo(1.0, 5);

    // Completely deterministic single outcome has 0 bits entropy
    const zeroEntropy = calculateEntropy([1.0]);
    expect(zeroEntropy).toBe(0);
  });

  it("calculates Chi-Square statistic against uniform expectation", () => {
    const uniform = [10, 10, 10, 10];
    const result = calculateChiSquareUniform(uniform);
    expect(result.chiSquare).toBe(0);
    expect(result.degreesOfFreedom).toBe(3);

    const biased = [20, 0, 10, 10];
    const biasedResult = calculateChiSquareUniform(biased);
    expect(biasedResult.chiSquare).toBeGreaterThan(0);
  });

  it("calculates Runs Test for randomness", () => {
    const alternating = [1, 2, 1, 2, 1, 2, 1, 2];
    const res = calculateRunsTest(alternating);
    expect(res.runs).toBeGreaterThan(1);
  });
});
