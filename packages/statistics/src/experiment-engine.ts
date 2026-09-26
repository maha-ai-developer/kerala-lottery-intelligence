/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 5D: Statistical Experiment Framework Engine
 *
 * Implements deterministic, provenance-preserving hypothesis testing algorithms
 * over validated historical lottery observations.
 *
 * Architecture:
 * ExperimentDefinition
 *       ↓
 * PopulationResolver
 *       ↓
 * BaselineResolver
 *       ↓
 * StatisticCalculator
 *       ↓
 * ExperimentExecutor
 *       ↓
 * ExperimentResult
 *
 * Strict Invariants:
 * - Purely descriptive statistical tests (OBSERVED HISTORICAL DATA ONLY).
 * - Strictly NO prediction, betting strategies, lucky numbers, or future probability.
 * - Explicit, immutable population boundaries.
 * - String preservation of lottery numbers with exact leading zeros preserved.
 * - Deterministic computation and versioning.
 */

import { createHash } from "node:crypto";
import type { MultiDrawLotteryCorpus } from "./multi-draw-corpus";
import { StatisticalValidationError } from "./statistical-engine";
import { extractAnalysisProvenanceRecords } from "./historical-analysis-engine";
import {
  DEFAULT_EXPERIMENT_VERSION,
  HISTORICAL_EXPERIMENT_DISCLAIMER,
  type ExperimentDefinition,
  type ExperimentResult,
  type ExperimentPopulationCriteria,
  type ResolvedExperimentPopulation,
  type ExperimentBaselineDefinition,
  type ExperimentTestConfiguration,
  type CategoryTestDetail,
  type ExperimentStatisticalTestResult,
  type ExperimentTargetMetric
} from "./experiment-types";

export interface ExperimentExecutionOptions {
  version?: string;
  executedAt?: string;
  provenanceLimit?: number;
}

export type RawExperimentDefinition = Omit<
  ExperimentDefinition,
  "id" | "experimentId" | "experimentVersion" | "statisticDefinition"
>;

// ============================================================================
// Deterministic Hashing
// ============================================================================

export function computeExperimentDefinitionHash(
  def: RawExperimentDefinition | ExperimentDefinition
): string {

  const payload = {
    version: def.version,
    researchQuestion: def.researchQuestion.trim(),
    hypothesis: def.hypothesis.trim(),
    nullHypothesis: def.nullHypothesis.trim(),
    alternativeHypothesis: def.alternativeHypothesis.trim(),
    populationCriteria: {
      lotteryCode: def.populationCriteria.lotteryCode?.toUpperCase() || "ALL_LOTTERIES",
      drawId: def.populationCriteria.drawId || null,
      drawIds: def.populationCriteria.drawIds ? [...def.populationCriteria.drawIds].sort() : null,
      prizeTierId: def.populationCriteria.prizeTierId || null,
      prizeTierRank: def.populationCriteria.prizeTierRank ?? null,
      resultType: def.populationCriteria.resultType || "ALL",
      numberLength: def.populationCriteria.numberLength ?? null
    },
    targetMetric: def.targetMetric,
    baseline: {
      type: def.baseline.type,
      categories: [...def.baseline.categories].sort(),
      expectedProportions: def.baseline.expectedProportions
    },
    configuration: {
      testType: def.configuration.testType,
      significanceLevel: def.configuration.significanceLevel,
      minExpectedCountPerCategory: def.configuration.minExpectedCountPerCategory,
      targetMetric: def.configuration.targetMetric,
      positionIndex: def.configuration.positionIndex ?? null
    },
    descriptiveOnly: true
  };

  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
}

export function computeExperimentResultHash(
  experimentId: string,
  populationHash: string,
  observedStatistic: number,
  degreesOfFreedom: number
): string {
  const payload = {
    experimentId,
    populationHash,
    observedStatistic: Number(observedStatistic.toFixed(4)),
    degreesOfFreedom
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
}

// ============================================================================
// Factory Helpers for Canonical Experiments
// ============================================================================

export function createLastDigitUniformityExperiment(
  criteria: ExperimentPopulationCriteria = {},
  options?: {
    researchQuestion?: string;
    significanceLevel?: number;
  }
): ExperimentDefinition {
  const categories = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
  const expectedProportions: Record<string, number> = {};
  for (const c of categories) {
    expectedProportions[c] = 0.1;
  }

  const baseline: ExperimentBaselineDefinition = {
    type: "DISCRETE_UNIFORM",
    description: "Theoretical discrete uniform distribution over terminal digits 0 through 9 (10% per digit)",
    categories,
    expectedProportions
  };

  const configuration: ExperimentTestConfiguration = {
    testType: "CHI_SQUARE_GOODNESS_OF_FIT",
    significanceLevel: options?.significanceLevel ?? 0.05,
    minExpectedCountPerCategory: 5,
    targetMetric: "LAST_DIGIT_DISTRIBUTION"
  };

  const lotteryLabel = criteria.lotteryCode || "all lotteries in corpus";
  const researchQuestion =
    options?.researchQuestion ||
    `Do the observed last digits of winning lottery numbers in ${lotteryLabel} follow a discrete uniform distribution?`;

  const rawDef: RawExperimentDefinition = {
    version: DEFAULT_EXPERIMENT_VERSION,
    researchQuestion,
    hypothesis:
      "Historical winning numbers exhibit terminal digits that follow a discrete uniform distribution over {0..9}.",
    nullHypothesis:
      "H0: The observed terminal digits follow a discrete uniform distribution across {0..9} (p_i = 0.10 for all i).",
    alternativeHypothesis:
      "H1: The observed terminal digits deviate significantly from a discrete uniform distribution across {0..9}.",
    populationCriteria: criteria,
    targetMetric: "LAST_DIGIT_DISTRIBUTION",
    baseline,
    configuration,
    descriptiveOnly: true,
    sourceAnalysisVersion: "v1.0.0-historical-analysis"
  };

  const id = `exp_${computeExperimentDefinitionHash(rawDef)}`;
  return {
    ...rawDef,
    id,
    experimentId: id,
    version: rawDef.version,
    experimentVersion: rawDef.version,
    statisticDefinition: rawDef.configuration
  };
}

export function createDigitPositionUniformityExperiment(
  positionIndex: number, // 1-indexed from left
  numberLength: number,
  criteria: ExperimentPopulationCriteria = {},
  options?: {
    significanceLevel?: number;
  }
): ExperimentDefinition {
  if (positionIndex < 1 || positionIndex > numberLength) {
    throw new StatisticalValidationError(
      `Invalid positionIndex ${positionIndex} for numberLength ${numberLength}`,
      "INVALID_POSITION_INDEX"
    );
  }

  const categories = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
  const expectedProportions: Record<string, number> = {};
  for (const c of categories) {
    expectedProportions[c] = 0.1;
  }

  const baseline: ExperimentBaselineDefinition = {
    type: "DISCRETE_UNIFORM",
    description: `Theoretical discrete uniform distribution for digit position ${positionIndex} of ${numberLength}-digit numbers`,
    categories,
    expectedProportions
  };

  const populationCriteria: ExperimentPopulationCriteria = {
    ...criteria,
    numberLength
  };

  const configuration: ExperimentTestConfiguration = {
    testType: "CHI_SQUARE_GOODNESS_OF_FIT",
    significanceLevel: options?.significanceLevel ?? 0.05,
    minExpectedCountPerCategory: 5,
    targetMetric: "DIGIT_POSITION_DISTRIBUTION",
    positionIndex
  };

  const rawDef: RawExperimentDefinition = {
    version: DEFAULT_EXPERIMENT_VERSION,
    researchQuestion: `Do the observed digits at position ${positionIndex} of ${numberLength}-digit numbers follow a discrete uniform distribution?`,
    hypothesis: `Digits at position ${positionIndex} follow a discrete uniform distribution over {0..9}.`,
    nullHypothesis: `H0: Digits at position ${positionIndex} follow a discrete uniform distribution across {0..9}.`,
    alternativeHypothesis: `H1: Digits at position ${positionIndex} deviate from a discrete uniform distribution across {0..9}.`,
    populationCriteria,
    targetMetric: "DIGIT_POSITION_DISTRIBUTION",
    baseline,
    configuration,
    descriptiveOnly: true,
    sourceAnalysisVersion: "v1.0.0-historical-analysis"
  };

  const id = `exp_${computeExperimentDefinitionHash(rawDef)}`;
  return {
    ...rawDef,
    id,
    experimentId: id,
    version: rawDef.version,
    experimentVersion: rawDef.version,
    statisticDefinition: rawDef.configuration
  };
}

// ============================================================================
// 1. Population Resolver
// ============================================================================

export function resolveExperimentPopulation(
  corpus: MultiDrawLotteryCorpus,
  criteria: ExperimentPopulationCriteria,
  targetMetric: ExperimentTargetMetric,
  positionIndex?: number
): ResolvedExperimentPopulation {
  if (!corpus || !Array.isArray(corpus.draws) || corpus.draws.length === 0) {
    throw new StatisticalValidationError(
      "Cannot resolve experiment population from empty or invalid corpus",
      "EMPTY_CORPUS"
    );
  }

  // 1. Validate lottery isolation if specified
  let targetDraws = corpus.draws;
  if (criteria.lotteryCode && criteria.lotteryCode !== "ALL_LOTTERIES") {
    const code = criteria.lotteryCode.toUpperCase();
    targetDraws = targetDraws.filter((d) => d.lotteryCode.toUpperCase() === code);
    if (targetDraws.length === 0) {
      throw new StatisticalValidationError(
        `Lottery code '${criteria.lotteryCode}' not found in corpus`,
        "HETEROGENEOUS_POPULATION_MISMATCH"
      );
    }
  }

  // 2. Validate draw isolation if specified
  if (criteria.drawId) {
    targetDraws = targetDraws.filter((d) => d.drawId === criteria.drawId);
    if (targetDraws.length === 0) {
      throw new StatisticalValidationError(
        `Draw ID '${criteria.drawId}' not found in corpus`,
        "DRAW_NOT_FOUND"
      );
    }
  }

  if (criteria.drawIds && criteria.drawIds.length > 0) {
    const allowedSet = new Set(criteria.drawIds);
    targetDraws = targetDraws.filter((d) => allowedSet.has(d.drawId));
    if (targetDraws.length === 0) {
      throw new StatisticalValidationError(
        `None of specified draw IDs exist in corpus`,
        "DRAWS_NOT_FOUND"
      );
    }
  }

  const validDrawIds = new Set(targetDraws.map((d) => d.drawId));
  const rawResults = corpus.combinedEntities.winningResults || [];

  // 3. Filter winning results according to explicit population criteria
  const matchingItems: ResolvedExperimentPopulation["observedItems"] = [];

  for (const r of rawResults) {
    if (!r.drawId || !validDrawIds.has(r.drawId)) continue;
    if (criteria.prizeTierId && r.prizeTierId !== criteria.prizeTierId) continue;
    if (criteria.prizeTierRank !== undefined && r.rank !== criteria.prizeTierRank) continue;
    if (criteria.resultType === "FULL_TICKET" && r.isSuffix) continue;
    if (criteria.resultType === "SUFFIX" && !r.isSuffix) continue;
    if (criteria.numberLength !== undefined && r.numberLength !== criteria.numberLength) continue;

    // Extract metric value under test
    let extractedValue: string | undefined;

    if (targetMetric === "LAST_DIGIT_DISTRIBUTION") {
      extractedValue = r.canonicalNumber ? r.canonicalNumber.slice(-1) : undefined;
    } else if (targetMetric === "DIGIT_POSITION_DISTRIBUTION") {
      const idx = (positionIndex ?? 1) - 1;
      if (r.canonicalNumber && idx >= 0 && idx < r.canonicalNumber.length) {
        extractedValue = r.canonicalNumber[idx];
      }
    } else if (targetMetric === "SERIES_DISTRIBUTION") {
      extractedValue = r.series;
    }

    if (extractedValue !== undefined) {
      matchingItems.push({
        resultId: r.id,
        canonicalNumber: r.canonicalNumber,
        extractedValue,
        isSuffix: r.isSuffix,
        rank: r.rank,
        drawId: r.drawId,
        documentSha256: r.documentSha256
      });
    }
  }

  if (matchingItems.length === 0) {
    throw new StatisticalValidationError(
      "Resolved experiment population contains 0 matching observations",
      "EMPTY_POPULATION"
    );
  }

  if (targetMetric === "DIGIT_POSITION_DISTRIBUTION") {
    const lengths = new Set(matchingItems.map((m) => m.canonicalNumber.length));
    if (lengths.size > 1) {
      throw new StatisticalValidationError(
        `Cannot evaluate digit position across heterogeneous number lengths (${Array.from(lengths).join(", ")}). Must isolate by numberLength.`,
        "HETEROGENEOUS_POPULATION_LENGTH"
      );
    }
  }

  if (targetMetric === "SERIES_DISTRIBUTION") {
    const suffixItems = matchingItems.filter((m) => m.isSuffix);
    if (suffixItems.length > 0) {
      throw new StatisticalValidationError(
        "Cannot evaluate series distribution on population containing SUFFIX results. Must isolate by resultType: FULL_TICKET.",
        "HETEROGENEOUS_POPULATION_SERIES"
      );
    }
  }

  const drawIds = Array.from(new Set(matchingItems.map((item) => item.drawId))).sort();
  const documentSha256s = Array.from(new Set(matchingItems.map((item) => item.documentSha256))).sort();

  const drawDates = targetDraws
    .map((d) => d.drawDate)
    .filter(Boolean)
    .sort();

  const populationHash = createHash("sha256")
    .update(
      JSON.stringify({
        lotteryCode: criteria.lotteryCode || "ALL_LOTTERIES",
        drawIds,
        documentSha256s,
        prizeTierRank: criteria.prizeTierRank ?? null,
        resultType: criteria.resultType || "ALL",
        numberLength: criteria.numberLength ?? null,
        sampleSize: matchingItems.length
      })
    )
    .digest("hex")
    .slice(0, 16);

  return {
    populationHash,
    lotteryCode: criteria.lotteryCode || "ALL_LOTTERIES",
    drawIds,
    drawCount: drawIds.length,
    documentSha256s,
    dateRange: {
      earliest: drawDates[0],
      latest: drawDates[drawDates.length - 1]
    },
    prizeTierId: criteria.prizeTierId,
    prizeTierRank: criteria.prizeTierRank,
    resultType: criteria.resultType || "ALL",
    numberLength: criteria.numberLength,
    sampleSize: matchingItems.length,
    observedItems: matchingItems
  };
}

// ============================================================================
// 2. Baseline Resolver
// ============================================================================

export function resolveBaselineExpectedCounts(
  baseline: ExperimentBaselineDefinition,
  sampleSize: number
): {
  expectedCounts: Record<string, number>;
  expectedProportions: Record<string, number>;
} {
  const sumProportions = Object.values(baseline.expectedProportions).reduce(
    (acc, p) => acc + p,
    0
  );

  if (Math.abs(sumProportions - 1.0) > 0.0001) {
    throw new StatisticalValidationError(
      `Sum of expected proportions (${sumProportions}) does not equal 1.0`,
      "MALFORMED_BASELINE"
    );
  }

  const expectedCounts: Record<string, number> = {};
  const expectedProportions: Record<string, number> = {};

  for (const category of baseline.categories) {
    const prop = baseline.expectedProportions[category];
    if (prop === undefined) {
      throw new StatisticalValidationError(
        `Category '${category}' missing from baseline expected proportions`,
        "MALFORMED_BASELINE"
      );
    }
    expectedProportions[category] = prop;
    expectedCounts[category] = Number((sampleSize * prop).toFixed(4));
  }

  return { expectedCounts, expectedProportions };
}

// ============================================================================
// 3. Statistic Calculator (Pearson's Chi-Square Goodness-of-Fit)
// ============================================================================

export function calculateChiSquareCriticalValue(df: number, alpha: number): number {
  // Wilson-Hilferty transformation approximation for Chi-Square critical value
  let z = 1.64485; // alpha = 0.05
  if (alpha <= 0.001) {
    z = 3.09023;
  } else if (alpha <= 0.01) {
    z = 2.32635;
  }

  if (df === 1) return alpha === 0.01 ? 6.635 : alpha === 0.001 ? 10.828 : 3.841;
  if (df === 9) return alpha === 0.01 ? 21.666 : alpha === 0.001 ? 27.877 : 16.919;
  if (df === 11) return alpha === 0.01 ? 24.725 : alpha === 0.001 ? 31.264 : 19.675;

  const term = 1 - 2 / (9 * df) + z * Math.sqrt(2 / (9 * df));
  return Number((df * Math.pow(term, 3)).toFixed(4));
}

export function calculateChiSquareTest(
  observedCounts: Record<string, number>,
  expectedCounts: Record<string, number>,
  categories: string[],
  alpha = 0.05,
  minExpected = 5
): {
  testResult: ExperimentStatisticalTestResult;
  categoryDetails: CategoryTestDetail[];
} {
  const k = categories.length;
  if (k <= 1) {
    throw new StatisticalValidationError(
      "Chi-square test requires at least 2 distinct categories",
      "INSUFFICIENT_CATEGORIES"
    );
  }

  const df = k - 1;
  const criticalValue = calculateChiSquareCriticalValue(df, alpha);

  let totalObserved = 0;
  let chiSquareSum = 0;
  let allMinExpectedMet = true;

  for (const c of categories) {
    totalObserved += observedCounts[c] ?? 0;
  }

  const categoryDetails: CategoryTestDetail[] = [];

  for (const c of categories) {
    const obs = observedCounts[c] ?? 0;
    const exp = expectedCounts[c] ?? 0;

    if (exp < minExpected) {
      allMinExpectedMet = false;
    }

    const diff = obs - exp;
    const contribution = exp > 0 ? (diff * diff) / exp : 0;
    chiSquareSum += contribution;

    categoryDetails.push({
      category: c,
      observedCount: obs,
      observedProportion: totalObserved > 0 ? Number((obs / totalObserved).toFixed(4)) : 0,
      expectedCount: exp,
      expectedProportion: totalObserved > 0 ? Number((exp / totalObserved).toFixed(4)) : 0,
      difference: Number(diff.toFixed(4)),
      contributionToStatistic: Number(contribution.toFixed(4))
    });
  }

  const observedStatistic = Number(chiSquareSum.toFixed(4));
  const rejectsNullHypothesis = observedStatistic > criticalValue;

  const testResult: ExperimentStatisticalTestResult = {
    testType: "CHI_SQUARE_GOODNESS_OF_FIT",
    testStatisticName: "Pearson Chi-Square (χ²)",
    observedStatistic,
    degreesOfFreedom: df,
    significanceLevel: alpha,
    criticalValue,
    rejectsNullHypothesis,
    assumptionsMet: {
      minExpectedCountMet: allMinExpectedMet,
      sampleSizeAdequate: totalObserved >= k * minExpected
    }
  };

  return { testResult, categoryDetails };
}

// ============================================================================
// 4. Experiment Executor
// ============================================================================

export function executeStatisticalExperiment(
  corpus: MultiDrawLotteryCorpus,
  definition: ExperimentDefinition,
  options?: ExperimentExecutionOptions
): ExperimentResult {
  if (!definition || !definition.descriptiveOnly) {
    throw new StatisticalValidationError(
      "Experiment definition must enforce descriptiveOnly invariant",
      "INVALID_EXPERIMENT_DEFINITION"
    );
  }

  // 1. Resolve population
  const population = resolveExperimentPopulation(
    corpus,
    definition.populationCriteria,
    definition.targetMetric,
    definition.configuration.positionIndex
  );

  // 2. Resolve baseline expected counts
  const { expectedCounts } = resolveBaselineExpectedCounts(
    definition.baseline,
    population.sampleSize
  );

  // 3. Count observed occurrences per category
  const observedCounts: Record<string, number> = {};
  for (const c of definition.baseline.categories) {
    observedCounts[c] = 0;
  }

  for (const item of population.observedItems) {
    const cur = observedCounts[item.extractedValue];
    if (cur !== undefined) {
      observedCounts[item.extractedValue] = cur + 1;
    }
  }


  // 4. Calculate statistical test
  const { testResult, categoryDetails } = calculateChiSquareTest(
    observedCounts,
    expectedCounts,
    definition.baseline.categories,
    definition.configuration.significanceLevel,
    definition.configuration.minExpectedCountPerCategory
  );

  // 5. Synthesize deterministic interpretation (STRICTLY HISTORICAL DESCRIPTIVE ONLY)
  let interpretation: string;
  if (testResult.rejectsNullHypothesis) {
    interpretation =
      `HISTORICAL_FINDING: In the analyzed sample of ${population.sampleSize} winning numbers, the observed ` +
      `test statistic (χ² = ${testResult.observedStatistic}) exceeds the critical threshold (χ²_crit = ${testResult.criticalValue}, df = ${testResult.degreesOfFreedom}, α = ${testResult.significanceLevel}). ` +
      `The observed historical distribution departs statistically from theoretical uniformity within this specific historical sample. ` +
      `NON-PREDICTIVE NOTICE: This historical departure reflects past publication frequencies and does NOT predict or imply non-randomness in future draws.`;
  } else {
    interpretation =
      `HISTORICAL_FINDING: In the analyzed sample of ${population.sampleSize} winning numbers, the observed ` +
      `test statistic (χ² = ${testResult.observedStatistic}) does not exceed the critical threshold (χ²_crit = ${testResult.criticalValue}, df = ${testResult.degreesOfFreedom}, α = ${testResult.significanceLevel}). ` +
      `The historical distribution is consistent with theoretical uniformity under the specified baseline. ` +
      `NON-PREDICTIVE NOTICE: Statistical consistency within this historical sample does not guarantee identical distributions in future draws.`;
  }

  // 6. Mandatory Limitations
  const limitations = [
    HISTORICAL_EXPERIMENT_DISCLAIMER,
    `DESCRIPTIVE_ONLY: Evaluated on ${population.sampleSize} validated historical observations across ${population.drawCount} official draws.`,
    "FINITE_SAMPLE_SIZE: Statistical power is bounded by the size of the historical corpus.",
    "INDEPENDENT_TRIALS: Each Kerala State Lottery draw operates under independent random selection.",
    "ZERO_PREDICTIVE_CLAIM: Frequency deviations do NOT provide betting advantage or predictive capability."
  ];

  // 7. Provenance Tracking
  const provenanceSample = extractAnalysisProvenanceRecords(corpus, {
    drawId: definition.populationCriteria.drawId,
    lotteryCode: definition.populationCriteria.lotteryCode,
    prizeTierId: definition.populationCriteria.prizeTierId,
    resultType: definition.populationCriteria.resultType,
    limit: options?.provenanceLimit ?? 10
  });

  const executedAt = options?.executedAt || new Date().toISOString();
  const executionVersion = options?.version || DEFAULT_EXPERIMENT_VERSION;

  const resultHash = computeExperimentResultHash(
    definition.id,
    population.populationHash,
    testResult.observedStatistic,
    testResult.degreesOfFreedom
  );

  return {
    id: `exp_res_${resultHash}`,
    experimentId: definition.id,
    executionVersion,
    executedAt,
    status: "COMPLETED",
    observedStatistic: testResult.observedStatistic,
    expectedStatistic: testResult.degreesOfFreedom,
    difference: Number((testResult.observedStatistic - testResult.criticalValue).toFixed(4)),
    sampleSize: population.sampleSize,
    descriptiveOnly: true,
    populationScope: {
      populationHash: population.populationHash,
      lotteryCode: population.lotteryCode,
      drawIds: population.drawIds,
      drawCount: population.drawCount,
      documentSha256s: population.documentSha256s,
      dateRange: population.dateRange,
      prizeTierId: population.prizeTierId,
      prizeTierRank: population.prizeTierRank,
      resultType: population.resultType,
      numberLength: population.numberLength,
      sampleSize: population.sampleSize
    },
    baseline: {
      type: definition.baseline.type,
      description: definition.baseline.description,
      categoryCount: definition.baseline.categories.length
    },
    baselineMetadata: {
      type: definition.baseline.type,
      description: definition.baseline.description,
      categoryCount: definition.baseline.categories.length,
      categories: definition.baseline.categories
    },
    testMetadata: {
      testType: testResult.testType,
      testStatisticName: testResult.testStatisticName,
      degreesOfFreedom: testResult.degreesOfFreedom,
      significanceLevel: testResult.significanceLevel,
      criticalValue: testResult.criticalValue,
      rejectsNullHypothesis: testResult.rejectsNullHypothesis,
      assumptionsMet: testResult.assumptionsMet
    },
    statisticalTest: testResult,
    categoryDetails,
    interpretation,
    limitations,
    provenanceSummary: {
      totalResultsTracked: population.sampleSize,
      totalDrawsTracked: population.drawCount,
      documentSha256s: population.documentSha256s,
      sampleProvenance: provenanceSample
    }
  };
}
