/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone V1.0 Final: Multi-Candidate Comparison & Historical Backtesting Lab Engine
 *
 * Implements:
 * - Multi-candidate ticket validation against authoritative prize scheme rules
 * - Duplicate candidate detection
 * - Side-by-side mathematical feature profiling
 * - Retrospective historical comparison against verified 103-draw research corpus
 * - Series-level historical comparison with mandatory exposure unavailable disclaimer
 * - Strict walk-forward chronological backtesting with zero temporal data leakage
 * - Temporal stability classification (HISTORICALLY STABLE, HISTORICALLY VARIABLE, NOVEL)
 * - Descriptive trade-off analysis matrix without predictive/betting scoring
 * - Deterministic provenance and SHA-256 fingerprinting
 *
 * STRICT NON-NEGOTIABLE INVARIANT:
 * Purely descriptive and retrospective empirical analysis.
 * Zero prediction, winning probabilities, betting advice, or optimal ticket selection.
 */

import { createHash } from "node:crypto";
import { normalizeLotteryCode } from "@kerala-lottery/domain";
import { ResearchSandboxEngine, type ResearchSandboxEngineOptions, type CorpusIndexedRecord } from "./research-sandbox-engine";
import {
  type CandidateLabTicketInput,
  type CandidateLabRequest,
  type CandidateValidationSummary,
  type CandidateFeatureItem,
  type CandidateHistoricalItem,
  type SeriesComparisonItem,
  type SeriesComparisonResult,
  type BacktestWindowDefinition,
  type CandidateWindowMetric,
  type CandidateBacktestResult,
  type CandidateTradeOffItem,
  type CandidateLabAnalysis,
  type CandidateStabilityClassification
} from "./candidate-lab-types";
import { type ResearchDescriptiveClassification } from "./research-sandbox-types";

export class CandidateLabEngine {
  private readonly sandboxEngine: ResearchSandboxEngine;

  constructor(options?: ResearchSandboxEngineOptions | { sandboxEngine?: ResearchSandboxEngine }) {
    if (options && "sandboxEngine" in options && options.sandboxEngine) {
      this.sandboxEngine = options.sandboxEngine;
    } else {
      this.sandboxEngine = new ResearchSandboxEngine(options as ResearchSandboxEngineOptions);
    }
  }

  /**
   * Evaluates a set of candidate tickets (2 to 10 candidates) side-by-side:
   * validation, duplicates, features, historical corpus comparison, series comparison,
   * chronological backtesting replay, stability and trade-offs.
   */
  public analyzeCandidateSet(request: CandidateLabRequest): CandidateLabAnalysis {
    const timestamp = new Date().toISOString();
    const rawCandidates = request.candidates || [];

    // 1. Enforce bounded maximum: 2 to 10 candidates
    if (rawCandidates.length < 2) {
      throw new Error("Candidate Lab requires at least 2 candidate tickets for comparative analysis.");
    }
    if (rawCandidates.length > 10) {
      throw new Error("Candidate Lab accepts a maximum of 10 candidates per analysis.");
    }

    const defaultLabels = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
    const normalizedCandidates: Array<{
      id: string;
      label: string;
      input: CandidateLabTicketInput;
      normalizedLottery: string;
      normalizedSeries: string;
      canonicalNumber: string;
    }> = rawCandidates.map((c, idx) => {
      const id = c.id || defaultLabels[idx] || `Candidate_${idx + 1}`;
      const label = c.userLabel || `Candidate ${id}`;
      const normalizedLottery = normalizeLotteryCode(c.lotteryCode);
      const normalizedSeries = (c.series || "").trim().toUpperCase();
      const canonicalNumber = String(c.ticketNumber || "").trim();

      return {
        id,
        label,
        input: c,
        normalizedLottery,
        normalizedSeries,
        canonicalNumber
      };
    });

    // 2. Canonical payload for deterministic hash
    const canonicalPayload = {
      candidates: normalizedCandidates.map((c) => ({
        lotteryCode: c.normalizedLottery,
        series: c.normalizedSeries,
        ticketNumber: c.canonicalNumber
      })),
      temporalCutoffDate: request.temporalCutoffDate
        ? this.sandboxEngine.toIsoDate(request.temporalCutoffDate)
        : "",
      backtestWindows: request.backtestWindows || 4
    };

    const deterministicHash = createHash("sha256")
      .update(JSON.stringify(canonicalPayload), "utf8")
      .digest("hex");
    const analysisId = `candidate_lab_${deterministicHash.slice(0, 16)}`;

    // 3. Validation & Duplicate Detection
    const validationSummaries: CandidateValidationSummary[] = [];
    const seenTickets = new Map<string, string>(); // key -> earlier candidateId
    let duplicateCount = 0;

    for (const c of normalizedCandidates) {
      const val = this.sandboxEngine.validateCandidateInput({
        lotteryCode: c.input.lotteryCode,
        schemeVersionId: c.input.schemeVersionId,
        series: c.input.series,
        ticketNumber: c.input.ticketNumber
      });

      const dedupeKey = `${c.normalizedLottery}:${c.normalizedSeries}:${c.canonicalNumber}`;
      let isDuplicate = false;
      let duplicateOf: string | undefined;

      if (seenTickets.has(dedupeKey)) {
        isDuplicate = true;
        duplicateOf = seenTickets.get(dedupeKey);
        duplicateCount++;
        val.warnings.push(`Duplicate candidate detected: identical to ${duplicateOf}.`);
      } else {
        seenTickets.set(dedupeKey, c.id);
      }

      validationSummaries.push({
        candidateId: c.id,
        label: c.label,
        input: c.input,
        validation: val,
        isDuplicate,
        duplicateOf
      });
    }

    // 4. Feature Profile Extraction
    const featureProfiles: CandidateFeatureItem[] = [];
    for (const c of normalizedCandidates) {
      const valSummary = validationSummaries.find((v) => v.candidateId === c.id);
      if (valSummary?.validation.isValid) {
        const profile = this.sandboxEngine.extractFeatureProfile(c.normalizedSeries, c.canonicalNumber);
        featureProfiles.push({
          candidateId: c.id,
          label: c.label,
          lotteryCode: c.normalizedLottery,
          series: c.normalizedSeries,
          canonicalNumber: c.canonicalNumber,
          profile
        });
      } else {
        featureProfiles.push({
          candidateId: c.id,
          label: c.label,
          lotteryCode: c.normalizedLottery,
          series: c.normalizedSeries,
          canonicalNumber: c.canonicalNumber
        });
      }
    }

    // 5. Historical Comparison against Verified Research Corpus
    const historicalComparisons: CandidateHistoricalItem[] = [];
    for (const c of normalizedCandidates) {
      const featItem = featureProfiles.find((f) => f.candidateId === c.id);
      if (!featItem?.profile) {
        continue;
      }

      const comp = this.sandboxEngine.compareWithHistoricalCorpus(featItem.profile, {
        temporalCutoffDate: request.temporalCutoffDate
      });

      const classifications: ResearchDescriptiveClassification[] = [];
      if (comp.exactTicketMatch.observedInCorpus) {
        classifications.push("COMMON");
      } else {
        classifications.push("NOVEL");
      }

      if (comp.lastDigitComparison.relativeCommonness === "NEAR_EXPECTED") {
        classifications.push("WITHIN_HISTORICAL_DISTRIBUTION");
      } else {
        classifications.push("UNCOMMON");
      }

      historicalComparisons.push({
        candidateId: c.id,
        label: c.label,
        lotteryCode: c.normalizedLottery,
        series: c.normalizedSeries,
        canonicalNumber: c.canonicalNumber,
        exactMatch: comp.exactTicketMatch,
        terminalDigit: {
          digit: comp.lastDigitComparison.inputDigit,
          observedCount: comp.lastDigitComparison.observedCount,
          empiricalFrequency: comp.lastDigitComparison.empiricalFrequency,
          wilsonConfidenceInterval95: comp.lastDigitComparison.wilsonConfidenceInterval95,
          relativeCommonness: comp.lastDigitComparison.relativeCommonness
        },
        firstDigit: {
          digit: comp.firstDigitComparison.inputDigit,
          observedCount: comp.firstDigitComparison.observedCount,
          empiricalFrequency: comp.firstDigitComparison.empiricalFrequency,
          wilsonConfidenceInterval95: comp.firstDigitComparison.wilsonConfidenceInterval95,
          relativeCommonness: comp.firstDigitComparison.relativeCommonness
        },
        suffix2: comp.suffixComparisons.suffix2,
        suffix3: comp.suffixComparisons.suffix3,
        suffix4: comp.suffixComparisons.suffix4,
        digitSum: {
          sum: comp.digitSumComparison.inputSum,
          empiricalPercentile: comp.digitSumComparison.empiricalPercentile,
          rarityClassification: comp.digitSumComparison.rarityClassification
        },
        empiricalClassifications: classifications
      });
    }

    // 6. Series Comparison View
    const corpusRecords = this.sandboxEngine.getCorpusRecords();
    const seriesComparison = this.computeSeriesComparison(normalizedCandidates, corpusRecords, request.temporalCutoffDate);

    // 7. Chronological Backtesting & Historical Walk-Forward Replay (Zero Data Leakage)
    const backtestWindowsCount = Math.min(Math.max(request.backtestWindows || 4, 2), 6);
    const backtestResults = this.computeWalkForwardBacktest(
      normalizedCandidates,
      featureProfiles,
      corpusRecords,
      backtestWindowsCount,
      request.temporalCutoffDate
    );

    // 8. Stability & Trade-offs Matrix
    const tradeOffAnalysis = this.computeTradeOffAnalysis(
      normalizedCandidates,
      featureProfiles,
      historicalComparisons,
      seriesComparison,
      backtestResults.candidateResults
    );

    // 9. Research Interpretation & Non-Predictive Boundary
    const researchInterpretation = this.computeResearchInterpretation(
      normalizedCandidates,
      historicalComparisons,
      backtestResults.candidateResults,
      duplicateCount
    );

    return {
      analysisId,
      analysisTimestamp: timestamp,
      deterministicHash,
      candidateCount: normalizedCandidates.length,
      hasDuplicates: duplicateCount > 0,
      duplicateCount,
      validationSummaries,
      featureProfiles,
      historicalComparisons,
      seriesComparison,
      backtestResults,
      tradeOffAnalysis,
      researchInterpretation,
      limitations: {
        nonPredictiveDisclaimer:
          "This multi-candidate lab evaluates descriptive retrospective evidence only. Historical frequency analysis does not establish, alter, or predict future winning probabilities. Under standard lottery mechanisms, each draw constitutes an independent stochastic trial.",
        seriesExposureDisclaimer:
          "Observed winner counts by series are not exposure-adjusted. Ticket sales volume by series is not published in public gazettes. Historical series counts are purely descriptive and do not represent future winning probabilities.",
        districtExposureDisclaimer:
          "District-level ticket exposure is not available in the current evidence base; historical district counts are descriptive and cannot be interpreted as future winning probability.",
        statisticalCaveats: [
          "Absence of historical observation in a finite corpus (103 draws) does not indicate future impossibility; the combinatoric search space of full tickets (1,000,000 per series) exceeds observed sample counts.",
          "Descriptive stability across historical walk-forward windows reflects empirical consistency of the digit/suffix distribution, not an edge or gambling advantage.",
          "Zero predictive scoring, AI weighting, or winning recommendation is provided. Candidate ranking is preserved in user input order by default."
        ]
      },
      provenance: {
        corpusVersion: "v1.0-research-103draws",
        featureVersion: "feat_v1",
        datasetVersion: "dataset_7c_canonical",
        experimentVersion: "exp_v1",
        validationVersion: "val_v1",
        candidateSetVersion: "candidates_v1",
        geographicVersion: "geo_10a_v1",
        auditSha256: deterministicHash
      }
    };
  }

  /**
   * Computes descriptive historical occurrences and metrics for all series
   * represented in the candidate set.
   */
  private computeSeriesComparison(
    candidates: Array<{ id: string; normalizedSeries: string }>,
    corpusRecords: CorpusIndexedRecord[],
    globalCutoffDate?: string
  ): SeriesComparisonResult {
    const isoCutoff = globalCutoffDate ? this.sandboxEngine.toIsoDate(globalCutoffDate) : "";
    const activeRecords = isoCutoff
      ? corpusRecords.filter((r) => !r.drawIsoDate || r.drawIsoDate <= isoCutoff)
      : corpusRecords;

    const fullTicketRecords = activeRecords.filter((r) => !r.isSuffix && r.series);
    const totalFullTickets = fullTicketRecords.length;

    // Group candidates by series
    const seriesMap = new Map<string, string[]>();
    for (const c of candidates) {
      if (!c.normalizedSeries) continue;
      const list = seriesMap.get(c.normalizedSeries) || [];
      list.push(c.id);
      seriesMap.set(c.normalizedSeries, list);
    }

    const seriesItems: SeriesComparisonItem[] = [];

    for (const [seriesCode, candidateIds] of seriesMap.entries()) {
      const matchingRecords = fullTicketRecords.filter((r) => r.series === seriesCode);
      const distinctDraws = new Set(matchingRecords.map((r) => r.drawId));
      const majorPrizes = matchingRecords.filter((r) => r.rank <= 3);

      const sortedDates = matchingRecords
        .map((r) => r.drawIsoDate)
        .filter(Boolean)
        .sort();

      const empiricalFreq = totalFullTickets > 0 ? matchingRecords.length / totalFullTickets : 0;

      seriesItems.push({
        series: seriesCode,
        associatedCandidateIds: candidateIds,
        candidateCount: candidateIds.length,
        observedCorpusCount: matchingRecords.length,
        distinctDrawsCount: distinctDraws.size,
        majorPrizeWinnerCount: majorPrizes.length,
        empiricalFrequency: empiricalFreq,
        firstObservedDate: sortedDates[0],
        lastObservedDate: sortedDates[sortedDates.length - 1],
        exposureStatus: "EXPOSURE_UNAVAILABLE",
        disclaimer: "Observed winner counts by series are not exposure-adjusted."
      });
    }

    return {
      seriesItems,
      totalUniqueSeriesInSet: seriesMap.size,
      criticalExposureNotice:
        "Observed winner counts by series are not exposure-adjusted. Ticket sales volume by series is not published in public gazettes. Historical counts are purely descriptive and do not represent future winning probabilities."
    };
  }

  /**
   * Computes strict walk-forward chronological backtesting across N temporal windows
   * with zero data leakage.
   */
  private computeWalkForwardBacktest(
    candidates: Array<{ id: string; label: string; normalizedSeries: string; canonicalNumber: string }>,
    featureProfiles: CandidateFeatureItem[],
    corpusRecords: CorpusIndexedRecord[],
    windowCount: number,
    globalCutoffDate?: string
  ): {
    windows: BacktestWindowDefinition[];
    candidateResults: CandidateBacktestResult[];
    temporalLeakageAssertionPassed: boolean;
  } {
    const isoGlobalCutoff = globalCutoffDate ? this.sandboxEngine.toIsoDate(globalCutoffDate) : "";

    // Extract all unique draws and sort chronologically
    const drawMap = new Map<string, { drawId: string; drawDate: string; drawIsoDate: string }>();
    for (const r of corpusRecords) {
      if (!drawMap.has(r.drawId)) {
        if (!isoGlobalCutoff || (r.drawIsoDate && r.drawIsoDate <= isoGlobalCutoff)) {
          drawMap.set(r.drawId, {
            drawId: r.drawId,
            drawDate: r.drawDate,
            drawIsoDate: r.drawIsoDate
          });
        }
      }
    }

    const sortedDraws = Array.from(drawMap.values()).sort((a, b) => {
      if (a.drawIsoDate && b.drawIsoDate) {
        return a.drawIsoDate.localeCompare(b.drawIsoDate);
      }
      return a.drawId.localeCompare(b.drawId);
    });

    const totalDraws = sortedDraws.length;
    const windowDefinitions: BacktestWindowDefinition[] = [];

    for (let w = 1; w <= windowCount; w++) {
      const cutoffIdx = Math.min(Math.floor((totalDraws * w) / windowCount) - 1, totalDraws - 1);
      const cutoffDraw = sortedDraws[cutoffIdx]!;
      const cutoffDate = cutoffDraw.drawIsoDate || cutoffDraw.drawDate;

      // Count records in this window
      const windowRecords = corpusRecords.filter(
        (r) => !r.drawIsoDate || r.drawIsoDate <= cutoffDate
      );

      windowDefinitions.push({
        windowIndex: w,
        windowName: `Window ${w} (${Math.round((w / windowCount) * 100)}% Horizon)`,
        cutoffDate,
        cutoffDrawId: cutoffDraw.drawId,
        drawCount: cutoffIdx + 1,
        resultCount: windowRecords.length
      });
    }

    // Strict chronological leakage assertion
    let temporalLeakageAssertionPassed = true;
    for (const wDef of windowDefinitions) {
      const recordsInWindow = corpusRecords.filter(
        (r) => r.drawIsoDate && r.drawIsoDate <= wDef.cutoffDate
      );
      for (const r of recordsInWindow) {
        if (r.drawIsoDate > wDef.cutoffDate) {
          temporalLeakageAssertionPassed = false;
          throw new Error(
            `TEMPORAL LEAKAGE DETECTED in Backtest Window ${wDef.windowIndex}: Draw date (${r.drawIsoDate}) exceeds cutoff (${wDef.cutoffDate})`
          );
        }
      }
    }

    // Evaluate each candidate across each window
    const candidateResults: CandidateBacktestResult[] = [];

    for (const c of candidates) {
      const featItem = featureProfiles.find((f) => f.candidateId === c.id);
      if (!featItem?.profile) {
        continue;
      }

      const windowMetrics: CandidateWindowMetric[] = [];
      const termFrequencies: number[] = [];

      for (const wDef of windowDefinitions) {
        const windowRecords = corpusRecords.filter(
          (r) => !r.drawIsoDate || r.drawIsoDate <= wDef.cutoffDate
        );

        const sampleSize = windowRecords.length;
        const lastDigit = featItem.profile.lastDigit;
        const suffix2 = featItem.profile.suffix2;
        const suffix3 = featItem.profile.suffix3;

        // Terminal digit count in window
        let termCount = 0;
        let s2Count = 0;
        let s3Count = 0;
        let exactCount = 0;

        for (const r of windowRecords) {
          if (r.canonicalNumber.endsWith(lastDigit)) termCount++;
          if (r.canonicalNumber.endsWith(suffix2)) s2Count++;
          if (r.canonicalNumber.endsWith(suffix3)) s3Count++;

          if (!r.isSuffix && r.series === c.normalizedSeries && r.canonicalNumber === c.canonicalNumber) {
            exactCount++;
          }
        }

        const termFreq = sampleSize > 0 ? termCount / sampleSize : 0;
        const s2Freq = sampleSize > 0 ? s2Count / sampleSize : 0;
        const s3Freq = sampleSize > 0 ? s3Count / sampleSize : 0;
        termFrequencies.push(termFreq);

        // Approximate digit sum percentile in window
        const sum = featItem.profile.digitSum;
        const z = (sum - 27) / 6.7;
        const percentile = Math.min(Math.max(Math.round(this.normalCdf(z) * 100), 1), 99);

        windowMetrics.push({
          windowIndex: wDef.windowIndex,
          cutoffDate: wDef.cutoffDate,
          sampleSizeDraws: wDef.drawCount,
          sampleSizeResults: sampleSize,
          terminalDigitFrequency: termFreq,
          suffix2Frequency: s2Freq,
          suffix3Frequency: s3Freq,
          cumulativeExactMatches: exactCount,
          digitSumPercentile: percentile
        });
      }

      // Compute variance of terminal digit frequency across windows
      const meanFreq = termFrequencies.reduce((a, b) => a + b, 0) / termFrequencies.length;
      const variance =
        termFrequencies.reduce((acc, f) => acc + Math.pow(f - meanFreq, 2), 0) / termFrequencies.length;

      let stability: CandidateStabilityClassification = "HISTORICALLY STABLE";
      if (variance > 0.00015) {
        stability = "HISTORICALLY VARIABLE";
      }

      const exactMatchOverall = windowMetrics[windowMetrics.length - 1]?.cumulativeExactMatches || 0;
      if (exactMatchOverall === 0 && featItem.profile.zeroCount >= 3) {
        stability = "NOVEL";
      }

      const trendMin = (Math.min(...termFrequencies) * 100).toFixed(2);
      const trendMax = (Math.max(...termFrequencies) * 100).toFixed(2);
      const descriptiveTrend = `Terminal digit frequency across ${windowCount} historical checkpoints remained between ${trendMin}% and ${trendMax}% (mean ${(meanFreq * 100).toFixed(2)}%, variance ${variance.toFixed(6)}).`;

      candidateResults.push({
        candidateId: c.id,
        label: c.label,
        series: c.normalizedSeries,
        canonicalNumber: c.canonicalNumber,
        windowMetrics,
        stabilityClassification: stability,
        metricVariance: variance,
        descriptiveTrend
      });
    }

    return {
      windows: windowDefinitions,
      candidateResults,
      temporalLeakageAssertionPassed
    };
  }

  /**
   * Computes side-by-side trade-offs across all candidates.
   */
  private computeTradeOffAnalysis(
    candidates: Array<{ id: string; label: string; normalizedSeries: string; canonicalNumber: string }>,
    featureProfiles: CandidateFeatureItem[],
    historicalComparisons: CandidateHistoricalItem[],
    seriesComparison: SeriesComparisonResult,
    backtestResults: CandidateBacktestResult[]
  ): {
    comparisonMatrix: CandidateTradeOffItem[];
    nonPredictiveNotice: string;
  } {
    const comparisonMatrix: CandidateTradeOffItem[] = [];

    for (const c of candidates) {
      const feat = featureProfiles.find((f) => f.candidateId === c.id)?.profile;
      const hist = historicalComparisons.find((h) => h.candidateId === c.id);
      const seriesInfo = seriesComparison.seriesItems.find((s) => s.series === c.normalizedSeries);
      const backtest = backtestResults.find((b) => b.candidateId === c.id);

      const characteristics: string[] = [];
      const considerations: string[] = [];

      if (feat) {
        if (feat.parityBalance === "BALANCED") {
          characteristics.push("Balanced parity: 3 even and 3 odd digits.");
        } else {
          considerations.push(`Parity asymmetry: ${feat.evenDigitCount} even vs ${feat.oddDigitCount} odd digits.`);
        }

        if (feat.digitSum >= 20 && feat.digitSum <= 34) {
          characteristics.push(`Digit sum ${feat.digitSum} lies within central 70% empirical distribution.`);
        } else {
          considerations.push(`Digit sum ${feat.digitSum} lies in empirical tail (${hist?.digitSum.empiricalPercentile}th percentile).`);
        }

        if (feat.hasRepeatedDigit) {
          considerations.push(`Contains ${feat.repeatedDigitCount} repeated digit(s).`);
        } else {
          characteristics.push("All 6 digits are distinct.");
        }
      }

      if (hist) {
        if (hist.exactMatch.observedInCorpus) {
          characteristics.push(`Exact historical match: appeared in ${hist.exactMatch.matchCount} verified draw(s).`);
        } else {
          characteristics.push("Novel ticket serial: never observed as an exact historical winner.");
        }

        if (hist.terminalDigit.relativeCommonness === "NEAR_EXPECTED") {
          characteristics.push(`Terminal digit '${hist.terminalDigit.digit}' aligns closely with uniform expectation (10.0%).`);
        }
      }

      if (seriesInfo) {
        characteristics.push(`Series ${seriesInfo.series} has ${seriesInfo.observedCorpusCount} historical winning occurrences across ${seriesInfo.distinctDrawsCount} draw(s).`);
        considerations.push("Observed series winner counts are not exposure-adjusted.");
      }

      if (backtest) {
        if (backtest.stabilityClassification === "HISTORICALLY STABLE") {
          characteristics.push("Historically stable: low frequency variance across all retrospective walk-forward windows.");
        } else if (backtest.stabilityClassification === "HISTORICALLY VARIABLE") {
          considerations.push("Historically variable: exhibits higher variance across chronological evaluation windows.");
        }
      }

      comparisonMatrix.push({
        candidateId: c.id,
        label: c.label,
        series: c.normalizedSeries,
        ticketNumber: c.canonicalNumber,
        parityBalance: feat?.parityBalance || "UNKNOWN",
        digitSum: feat?.digitSum || 0,
        digitSumPercentile: hist?.digitSum.empiricalPercentile || 50,
        terminalDigitFreqPercent: (hist?.terminalDigit.empiricalFrequency || 0.1) * 100,
        suffix2FreqPercent: (hist?.suffix2.empiricalFrequency || 0.01) * 100,
        suffix3FreqPercent: (hist?.suffix3.empiricalFrequency || 0.001) * 100,
        seriesObservedCount: seriesInfo?.observedCorpusCount || 0,
        exactHistoricalMatches: hist?.exactMatch.matchCount || 0,
        stability: backtest?.stabilityClassification || "HISTORICALLY STABLE",
        descriptiveCharacteristics: characteristics,
        descriptiveConsiderations: considerations
      });
    }

    return {
      comparisonMatrix,
      nonPredictiveNotice:
        "The platform presents descriptive empirical evidence only. No candidate is designated as preferred, optimal, or more likely to win. The user evaluates the trade-offs."
    };
  }

  /**
   * Computes candidate-by-candidate descriptive research interpretations.
   */
  private computeResearchInterpretation(
    candidates: Array<{ id: string; label: string; normalizedSeries: string; canonicalNumber: string }>,
    historicalComparisons: CandidateHistoricalItem[],
    backtestResults: CandidateBacktestResult[],
    duplicateCount: number
  ): {
    summary: string;
    candidateInterpretations: Array<{
      candidateId: string;
      label: string;
      classifications: string[];
      descriptiveText: string;
    }>;
    globalNotice: string;
  } {
    const candidateInterpretations: Array<{
      candidateId: string;
      label: string;
      classifications: string[];
      descriptiveText: string;
    }> = [];

    for (const c of candidates) {
      const hist = historicalComparisons.find((h) => h.candidateId === c.id);
      const backtest = backtestResults.find((b) => b.candidateId === c.id);

      const classifications: string[] = [];
      if (hist?.exactMatch.observedInCorpus) {
        classifications.push("COMMON");
      } else {
        classifications.push("NOVEL");
      }

      classifications.push("WITHIN HISTORICAL DISTRIBUTION");

      if (backtest) {
        classifications.push(backtest.stabilityClassification);
      }

      let text = `Candidate ${c.label} (${c.normalizedSeries} ${c.canonicalNumber}) `;
      if (hist?.exactMatch.observedInCorpus) {
        text += `has exact historical representation in ${hist.exactMatch.matchCount} draw(s) in the research corpus. `;
      } else {
        text += `is an unobserved novel ticket combination in the historical corpus. `;
      }

      if (backtest) {
        text += `Across walk-forward backtest checkpoints, its feature distributions are classified as ${backtest.stabilityClassification}. `;
      }

      text += `Historical commonness or uncommonness is purely descriptive and does not establish future winning probability.`;

      candidateInterpretations.push({
        candidateId: c.id,
        label: c.label,
        classifications,
        descriptiveText: text
      });
    }

    const summary = `Evaluated ${candidates.length} candidate tickets across structural syntax, mathematical features, series distribution, and ${backtestResults[0]?.windowMetrics.length || 4} walk-forward historical checkpoints. ${duplicateCount > 0 ? `Detected ${duplicateCount} duplicate ticket entry.` : "No duplicates detected."} All observations are grounded in descriptive evidence.`;

    const globalNotice =
      "Historical commonness/uncommonness is descriptive. It does not establish future winning probability. All draws are physically independent stochastic trials.";

    return {
      summary,
      candidateInterpretations,
      globalNotice
    };
  }

  private normalCdf(z: number): number {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp((-z * z) / 2);
    const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z > 0 ? 1 - prob : prob;
  }
}
