/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 9C: Temporal Robustness & Walk-Forward Evaluation
 *
 * Implements:
 * - Expanding-window chronological walk-forward evaluation
 * - Strict assertion of zero temporal leakage across all windows
 * - Inter-window metric volatility and stability scoring
 * - Chronological isolation preservation
 *
 * Non-Predictive Boundary:
 * Tests retrospective stability across historical periods; zero forward predictive claims.
 */

import type { ModelingDataset } from "@kerala-lottery/statistics";
import { assertNoTemporalLeakage } from "./index";
import type {
  WalkForwardWindowResult,
  TemporalRobustnessSummary
} from "./validation-types";

export interface WalkForwardOptions {
  windowCount?: number; // e.g. 3 or 4 expanding windows
  minTrainRatio?: number; // e.g. 0.60
  windowStepRatio?: number; // e.g. 0.10
}

/**
 * Executes chronological expanding-window evaluation across dataset records.
 */
export function evaluateTemporalRobustness(
  dataset: ModelingDataset,
  options: WalkForwardOptions = {}
): TemporalRobustnessSummary {
  const windowCount = options.windowCount ?? 3;
  const minTrainRatio = options.minTrainRatio ?? 0.60;

  if (windowCount < 2) {
    throw new Error(`Walk-forward evaluation requires at least 2 windows, received ${windowCount}`);
  }

  // Get distinct draw dates sorted chronologically ascending
  const drawDateMap = new Map<string, Array<{ target: string }>>();
  for (const row of dataset.rows) {
    const dIso = row.drawDateIso;
    if (!drawDateMap.has(dIso)) {
      drawDateMap.set(dIso, []);
    }
    drawDateMap.get(dIso)!.push({ target: String(row.targetValue) });
  }

  const sortedDrawDates = Array.from(drawDateMap.keys()).sort();
  const totalDraws = sortedDrawDates.length;

  if (totalDraws < 10) {
    throw new Error(`Insufficient draws for walk-forward evaluation: ${totalDraws}`);
  }

  const initialTrainDrawCount = Math.max(5, Math.floor(totalDraws * minTrainRatio));
  const remainingDraws = totalDraws - initialTrainDrawCount;
  const windowStep = Math.max(1, Math.floor(remainingDraws / windowCount));

  const windowResults: WalkForwardWindowResult[] = [];

  for (let w = 0; w < windowCount; w++) {
    const currentTrainEndIdx = initialTrainDrawCount + w * windowStep;
    const currentTestStartIdx = currentTrainEndIdx;
    const currentTestEndIdx =
      w === windowCount - 1
        ? totalDraws
        : Math.min(totalDraws, currentTestStartIdx + windowStep);

    if (currentTestStartIdx >= totalDraws) break;

    const trainDates = sortedDrawDates.slice(0, currentTrainEndIdx);
    const testDates = sortedDrawDates.slice(currentTestStartIdx, currentTestEndIdx);

    if (testDates.length === 0) break;

    // Strict temporal leakage check: every train date must strictly precede cutoff
    const cutoffIso = testDates[0]!;
    assertNoTemporalLeakage(trainDates, cutoffIso);

    // Compute training frequencies
    const trainFrequencies: Record<string, number> = {};
    let trainRowCount = 0;
    for (const d of trainDates) {
      const records = drawDateMap.get(d) || [];
      trainRowCount += records.length;
      for (const rec of records) {
        trainFrequencies[rec.target] = (trainFrequencies[rec.target] || 0) + 1;
      }
    }

    // Evaluate test window (Discrete uniform or majority benchmark)
    let testRowCount = 0;
    let hits = 0;
    let logLossSum = 0;

    for (const d of testDates) {
      const records = drawDateMap.get(d) || [];
      testRowCount += records.length;
      for (const rec of records) {
        // Uniform expectation: 1/10 accuracy, -ln(0.1) log loss
        const isHit = rec.target === "0"; // reference single class hit rate ~ 0.10
        if (isHit) hits++;
        logLossSum += -Math.log(0.1);
      }
    }

    const accuracy = testRowCount > 0 ? hits / testRowCount : 0.10;
    const logLoss = testRowCount > 0 ? logLossSum / testRowCount : 2.3026;

    windowResults.push({
      windowIndex: w + 1,
      trainDrawCount: trainDates.length,
      testDrawCount: testDates.length,
      trainRowCount,
      testRowCount,
      trainDateRange: {
        earliestIso: trainDates[0]!,
        latestIso: trainDates[trainDates.length - 1]!
      },
      testDateRange: {
        earliestIso: testDates[0]!,
        latestIso: testDates[testDates.length - 1]!
      },
      accuracy,
      logLoss,
      zeroLeakageConfirmed: true
    });
  }

  if (windowResults.length === 0) {
    throw new Error("Walk-forward evaluation generated 0 valid windows");
  }

  const accuracies = windowResults.map((r) => r.accuracy);
  const meanAccuracy = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
  const variance =
    accuracies.reduce((acc, v) => acc + Math.pow(v - meanAccuracy, 2), 0) /
    (accuracies.length - 1 || 1);
  const stdDevAccuracy = Math.sqrt(variance);

  const minAccuracy = Math.min(...accuracies);
  const maxAccuracy = Math.max(...accuracies);

  // Stability score: 1 - (stdDev / mean), clamped [0, 1]
  const cv = meanAccuracy > 0 ? stdDevAccuracy / meanAccuracy : 1;
  const stabilityScore = Math.max(0, Math.min(1, 1 - cv));

  return {
    strategy: "EXPANDING_WINDOW_WALK_FORWARD",
    windowsCount: windowResults.length,
    windowResults,
    meanAccuracy,
    stdDevAccuracy,
    minAccuracy,
    maxAccuracy,
    stabilityScore,
    zeroLeakageConfirmed: true
  };
}
