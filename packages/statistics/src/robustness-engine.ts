/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 5E: Experimental Validation & Robustness Engine
 *
 * Implements deterministic algorithms for evaluating the stability and sensitivity
 * of historical statistical observations across explicit population partitions,
 * alternative baselines, and test configurations.
 *
 * Architectural Flow:
 * Experiment Definition
 *       ↓
 * Baseline Evaluation
 *       ↓
 * Variant Definitions
 *       ↓
 * Deterministic Variant Execution
 *       ↓
 * Sensitivity Analysis & Comparison
 *       ↓
 * Robustness Report
 *
 * Invariants:
 * - Purely descriptive historical robustness (OBSERVED DATA ONLY).
 * - Strictly NO prediction, betting strategies, lucky numbers, or future probability.
 * - Explicit population variants (never silently merge or fabricate populations).
 * - Preservation of string numbers with leading zeros intact.
 * - Effect size quantification via Cramér's V.
 * - Multiple comparison adjustments via Bonferroni correction.
 * - Small-sample safety guards (reject or flag insufficient sample sizes).
 * - Full provenance from robustness report back to source PDFs and SHA-256s.
 */

import { createHash } from "node:crypto";
import type { MultiDrawLotteryCorpus } from "./multi-draw-corpus";
import { StatisticalValidationError } from "./statistical-engine";
import {
  DEFAULT_EXPERIMENT_VERSION,
  type ExperimentDefinition,
  type ExperimentResult
} from "./experiment-types";
import {
  executeStatisticalExperiment,
  resolveExperimentPopulation,
  calculateChiSquareCriticalValue
} from "./experiment-engine";
import {
  DEFAULT_ROBUSTNESS_VERSION,
  HISTORICAL_ROBUSTNESS_DISCLAIMER,
  type RobustnessDefinition,
  type RobustnessReport,
  type RobustnessVariantDefinition,
  type RobustnessSensitivityMetric,
  type RobustnessEvaluationSummary,
  type EffectSizeMetrics,
  type EffectSizeMagnitude,
  type MultipleComparisonCorrectionMethod
} from "./robustness-types";

export interface RobustnessExecutionOptions {
  executedAt?: string;
  version?: string;
  baselineResult?: ExperimentResult;
  provenanceLimit?: number;
}

// ============================================================================
// Deterministic Statistical Utilities: Effect Size & Chi-Square Thresholds
// ============================================================================

/**
 * Computes Cramér's V effect size for Chi-Square goodness-of-fit test.
 * Formula: V = sqrt(chiSquare / (N * (k - 1)))
 *
 * Assumptions:
 * - 1D goodness-of-fit test with k discrete categories (k >= 2)
 * - Sample size N >= 1
 * - Standard magnitude scale: < 0.10 negligible, 0.10 - 0.29 small, 0.30 - 0.49 medium, >= 0.50 large
 */
export function calculateCramersV(
  chiSquare: number,
  sampleSize: number,
  categoryCount: number
): EffectSizeMetrics {
  const assumptions = [
    "Categorical goodness-of-fit with k discrete categories",
    "Sample size N >= 1 and k >= 2",
    "Quantifies practical magnitude of departure independently of sample size"
  ];

  if (sampleSize <= 0 || categoryCount <= 1 || chiSquare < 0) {
    return {
      name: "CRAMERS_V",
      value: 0,
      magnitude: "NEGLIGIBLE",
      formula: "V = sqrt(chi2 / (N * (k - 1)))",
      assumptions
    };
  }

  const denominator = sampleSize * (categoryCount - 1);
  const rawV = Math.sqrt(chiSquare / denominator);
  const value = Number(rawV.toFixed(4));

  let magnitude: EffectSizeMagnitude;
  if (value < 0.1) {
    magnitude = "NEGLIGIBLE";
  } else if (value < 0.3) {
    magnitude = "SMALL";
  } else if (value < 0.5) {
    magnitude = "MEDIUM";
  } else {
    magnitude = "LARGE";
  }

  return {
    name: "CRAMERS_V",
    value,
    magnitude,
    formula: "V = sqrt(chi2 / (N * (k - 1)))",
    assumptions
  };
}



// ============================================================================
// Deterministic Hashing
// ============================================================================

export function computeRobustnessDefinitionHash(
  def: Omit<RobustnessDefinition, "id" | "robustnessId">
): string {
  const payload = {
    version: def.version,
    sourceExperimentId: def.sourceExperimentId,
    researchQuestion: def.researchQuestion.trim(),
    hypothesis: def.hypothesis.trim(),
    variants: def.variants.map((v) => ({
      variantId: v.variantId,
      dimension: v.dimension,
      populationCriteria: v.populationCriteriaOverride || null,
      baselineOverride: v.baselineOverride || null,
      configOverride: v.configurationOverride || null
    })),
    configuration: {
      correctionMethod: def.configuration.correctionMethod,
      stabilityThreshold: def.configuration.stabilityThreshold,
      minSamplePerVariant: def.configuration.minSamplePerVariant,
      minExpectedCountPerCategory: def.configuration.minExpectedCountPerCategory
    },
    descriptiveOnly: true
  };

  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
}

export function computeRobustnessReportHash(
  robustnessId: string,
  sourceResultId: string,
  classification: string,
  concordanceRatio: number,
  evaluatedVariantsCount: number
): string {
  const payload = {
    robustnessId,
    sourceResultId,
    classification,
    concordanceRatio: Number(concordanceRatio.toFixed(4)),
    evaluatedVariantsCount
  };

  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
}

// ============================================================================
// Factory Helpers for Canonical Robustness Definitions
// ============================================================================

/**
 * Constructs standard population variants over the multi-draw corpus, covering:
 * 1. Each individual lottery game present in the corpus
 * 2. FULL_TICKET vs SUFFIX partitions
 * 3. Specific prize tier ranks (e.g. 7th prize tier)
 * 4. Sub-corpora / individual draws
 */
export function createStandardPopulationRobustnessVariants(
  corpus: MultiDrawLotteryCorpus
): RobustnessVariantDefinition[] {
  const variants: RobustnessVariantDefinition[] = [];

  // 1. Single Lottery Variants
  const distinctLotteries = Array.from(new Set(corpus.draws.map((d) => d.lotteryCode))).sort();
  for (const lotteryCode of distinctLotteries) {
    variants.push({
      variantId: `var_lottery_${lotteryCode.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
      label: `Lottery Partition: ${lotteryCode}`,
      description: `Evaluates stability strictly within ${lotteryCode} observations`,
      dimension: "POPULATION_LOTTERY",
      populationCriteriaOverride: { lotteryCode }
    });
  }

  // 2. Result Type Variants (FULL_TICKET vs SUFFIX)
  variants.push({
    variantId: "var_result_type_full_ticket",
    label: "Result Type: Full Ticket",
    description: "Evaluates stability strictly on 6-digit full ticket winning numbers",
    dimension: "POPULATION_RESULT_TYPE",
    populationCriteriaOverride: { resultType: "FULL_TICKET" }
  });

  variants.push({
    variantId: "var_result_type_suffix",
    label: "Result Type: Suffix",
    description: "Evaluates stability strictly on suffix numbers",
    dimension: "POPULATION_RESULT_TYPE",
    populationCriteriaOverride: { resultType: "SUFFIX" }
  });

  // 3. Prize Tier Rank Variant (e.g. Rank 7)
  variants.push({
    variantId: "var_prize_tier_rank_7",
    label: "Prize Tier: Rank 7",
    description: "Evaluates stability strictly within Rank 7 prize tier observations",
    dimension: "POPULATION_PRIZE_TIER",
    populationCriteriaOverride: { prizeTierRank: 7 }
  });

  // 4. Individual Draw Variant (First Draw in Corpus)
  if (corpus.draws.length > 0) {
    const firstDraw = corpus.draws[0]!;
    variants.push({
      variantId: `var_draw_${firstDraw.drawNumber.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
      label: `Draw Partition: ${firstDraw.drawNumber}`,
      description: `Evaluates stability strictly within draw ${firstDraw.drawNumber} (${firstDraw.drawDate})`,
      dimension: "POPULATION_DRAW",
      populationCriteriaOverride: { drawId: firstDraw.drawId }
    });
  }

  return variants;
}

/**
 * Creates a formal RobustnessDefinition evaluating an existing ExperimentDefinition
 * across standard population partitions and Bonferroni multiple-comparison correction.
 */
export function createPopulationRobustnessDefinition(
  sourceExperiment: ExperimentDefinition,
  corpus: MultiDrawLotteryCorpus,
  options?: {
    correctionMethod?: MultipleComparisonCorrectionMethod;
    stabilityThreshold?: number;
    customVariants?: RobustnessVariantDefinition[];
  }
): RobustnessDefinition {
  const variants = options?.customVariants || createStandardPopulationRobustnessVariants(corpus);
  const configuration = {
    correctionMethod: options?.correctionMethod || "BONFERRONI",
    stabilityThreshold: options?.stabilityThreshold ?? 0.8,
    minSamplePerVariant: 30,
    minExpectedCountPerCategory: 5
  };

  const rawDef: Omit<RobustnessDefinition, "id" | "robustnessId"> = {
    version: DEFAULT_ROBUSTNESS_VERSION,
    sourceExperimentId: sourceExperiment.id,
    sourceExperimentDefinition: sourceExperiment,
    researchQuestion: `Is the statistical finding in experiment '${sourceExperiment.id}' robust across distinct lottery games, result types, and prize tiers?`,
    hypothesis:
      "The statistical finding observed in the primary corpus persists across explicit sub-populations under corrected significance thresholds.",
    variants,
    configuration,
    descriptiveOnly: true
  };

  const hash = computeRobustnessDefinitionHash(rawDef);
  const id = `rob_${hash}`;

  return {
    ...rawDef,
    id,
    robustnessId: id
  };
}

// ============================================================================
// Robustness Execution Engine
// ============================================================================

export function executeRobustnessEvaluation(
  corpus: MultiDrawLotteryCorpus,
  definition: RobustnessDefinition,
  options?: RobustnessExecutionOptions
): RobustnessReport {
  if (!definition || !definition.descriptiveOnly) {
    throw new StatisticalValidationError(
      "Robustness definition must enforce descriptiveOnly invariant",
      "INVALID_ROBUSTNESS_DEFINITION"
    );
  }

  // 1. Resolve or execute baseline experiment
  const baselineResult =
    options?.baselineResult ||
    executeStatisticalExperiment(corpus, definition.sourceExperimentDefinition);

  const baselineCategoryCount = definition.sourceExperimentDefinition.baseline.categories.length;
  const baselineEffectSize = calculateCramersV(
    baselineResult.observedStatistic,
    baselineResult.sampleSize,
    baselineCategoryCount
  );

  const m = definition.variants.length;
  const alphaUnadjusted = definition.sourceExperimentDefinition.configuration.significanceLevel;
  const alphaAdjusted =
    definition.configuration.correctionMethod === "BONFERRONI" && m > 0
      ? alphaUnadjusted / m
      : alphaUnadjusted;

  const variantEvaluations: RobustnessSensitivityMetric[] = [];
  const variantDocumentShaMap: Record<string, string[]> = {};
  const allInvolvedDocShas = new Set<string>(baselineResult.populationScope.documentSha256s);

  let validVariantsCount = 0;
  let concordantVariantsCount = 0;
  let insufficientSampleVariantsCount = 0;
  const effectSizes: number[] = [];

  // 2. Execute each variant deterministically
  for (const variant of definition.variants) {
    // Construct variant ExperimentDefinition by merging overrides onto source experiment
    const variantCriteria = {
      ...definition.sourceExperimentDefinition.populationCriteria,
      ...(variant.populationCriteriaOverride || {})
    };

    const variantBaseline = {
      ...definition.sourceExperimentDefinition.baseline,
      ...(variant.baselineOverride || {})
    };

    const variantConfig = {
      ...definition.sourceExperimentDefinition.configuration,
      ...(variant.configurationOverride || {})
    };

    // Pre-check population size and boundaries
    let pop;
    try {
      pop = resolveExperimentPopulation(
        corpus,
        variantCriteria,
        variantConfig.targetMetric,
        variantConfig.positionIndex
      );
    } catch {
      pop = null;
    }

    if (!pop || pop.sampleSize === 0) {
      insufficientSampleVariantsCount++;
      variantEvaluations.push({
        variantId: variant.variantId,
        label: variant.label,
        dimension: variant.dimension,
        sampleSize: 0,
        observedStatistic: 0,
        expectedStatistic: 0,
        difference: 0,
        degreesOfFreedom: 0,
        unadjustedSignificanceLevel: alphaUnadjusted,
        adjustedSignificanceLevel: alphaAdjusted,
        criticalValue: 0,
        adjustedCriticalValue: 0,
        rejectsNullUnadjusted: false,
        rejectsNullAdjusted: false,
        effectSize: {
          name: "CRAMERS_V",
          value: 0,
          magnitude: "NEGLIGIBLE",
          formula: "V = sqrt(chi2 / (N * (k - 1)))",
          assumptions: ["Insufficient sample size (N=0)"]
        },
        status: "INSUFFICIENT_SAMPLE",
        assumptionsMet: {
          minExpectedCountMet: false,
          sampleSizeAdequate: false,
          reason: "Zero matching observations found in corpus for specified criteria"
        },
        resultSummary: `${variant.label}: INSUFFICIENT_SAMPLE (0 observations)`
      });
      continue;
    }

    // Record document SHA-256 provenance for this variant
    variantDocumentShaMap[variant.variantId] = pop.documentSha256s;
    for (const d of pop.documentSha256s) {
      allInvolvedDocShas.add(d);
    }

    // Small Sample Safety: Check minimum sample requirement
    const minSampleRequired = definition.configuration.minSamplePerVariant;
    const minExpectedPerCell = definition.configuration.minExpectedCountPerCategory;
    const categoryCount = variantBaseline.categories.length;
    const minExpectedSampleForBalance = minExpectedPerCell * categoryCount;

    if (pop.sampleSize < Math.max(minSampleRequired, minExpectedSampleForBalance)) {
      insufficientSampleVariantsCount++;
      variantEvaluations.push({
        variantId: variant.variantId,
        label: variant.label,
        dimension: variant.dimension,
        sampleSize: pop.sampleSize,
        observedStatistic: 0,
        expectedStatistic: categoryCount - 1,
        difference: 0,
        degreesOfFreedom: categoryCount - 1,
        unadjustedSignificanceLevel: alphaUnadjusted,
        adjustedSignificanceLevel: alphaAdjusted,
        criticalValue: calculateChiSquareCriticalValue(categoryCount - 1, alphaUnadjusted),
        adjustedCriticalValue: calculateChiSquareCriticalValue(categoryCount - 1, alphaAdjusted),
        rejectsNullUnadjusted: false,
        rejectsNullAdjusted: false,
        effectSize: {
          name: "CRAMERS_V",
          value: 0,
          magnitude: "NEGLIGIBLE",
          formula: "V = sqrt(chi2 / (N * (k - 1)))",
          assumptions: ["Sample size too small to evaluate Chi-Square test reliably"]
        },
        status: "INSUFFICIENT_SAMPLE",
        assumptionsMet: {
          minExpectedCountMet: false,
          sampleSizeAdequate: false,
          reason: `Sample size ${pop.sampleSize} is below required threshold ${Math.max(minSampleRequired, minExpectedSampleForBalance)}`
        },
        resultSummary: `${variant.label}: INSUFFICIENT_SAMPLE (N=${pop.sampleSize} < ${Math.max(minSampleRequired, minExpectedSampleForBalance)})`
      });
      continue;
    }

    // Execute variant experiment
    const variantDef: ExperimentDefinition = {
      id: `exp_var_${variant.variantId}`,
      experimentId: `exp_var_${variant.variantId}`,
      version: DEFAULT_EXPERIMENT_VERSION,
      experimentVersion: DEFAULT_EXPERIMENT_VERSION,
      researchQuestion: `Robustness variant: ${variant.description}`,
      hypothesis: definition.sourceExperimentDefinition.hypothesis,
      nullHypothesis: definition.sourceExperimentDefinition.nullHypothesis,
      alternativeHypothesis: definition.sourceExperimentDefinition.alternativeHypothesis,
      populationCriteria: variantCriteria,
      targetMetric: variantConfig.targetMetric,
      baseline: variantBaseline,
      configuration: variantConfig,
      statisticDefinition: variantConfig,
      descriptiveOnly: true,
      sourceAnalysisVersion: definition.sourceExperimentDefinition.sourceAnalysisVersion
    };

    let variantResult: ExperimentResult;
    try {
      variantResult = executeStatisticalExperiment(corpus, variantDef);
    } catch (err: any) {
      variantEvaluations.push({
        variantId: variant.variantId,
        label: variant.label,
        dimension: variant.dimension,
        sampleSize: pop.sampleSize,
        observedStatistic: 0,
        expectedStatistic: categoryCount - 1,
        difference: 0,
        degreesOfFreedom: categoryCount - 1,
        unadjustedSignificanceLevel: alphaUnadjusted,
        adjustedSignificanceLevel: alphaAdjusted,
        criticalValue: calculateChiSquareCriticalValue(categoryCount - 1, alphaUnadjusted),
        adjustedCriticalValue: calculateChiSquareCriticalValue(categoryCount - 1, alphaAdjusted),
        rejectsNullUnadjusted: false,
        rejectsNullAdjusted: false,
        effectSize: {
          name: "CRAMERS_V",
          value: 0,
          magnitude: "NEGLIGIBLE",
          formula: "V = sqrt(chi2 / (N * (k - 1)))",
          assumptions: ["Execution failed"]
        },
        status: "VALIDATION_FAILED",
        assumptionsMet: {
          minExpectedCountMet: false,
          sampleSizeAdequate: false,
          reason: err.message
        },
        resultSummary: `${variant.label}: VALIDATION_FAILED (${err.message})`
      });
      continue;
    }

    // Calculate effect size and adjusted critical threshold
    const df = variantResult.testMetadata.degreesOfFreedom;
    const adjustedCrit = calculateChiSquareCriticalValue(df, alphaAdjusted);
    const rejectsAdjusted = variantResult.observedStatistic > adjustedCrit;
    const v = calculateCramersV(variantResult.observedStatistic, variantResult.sampleSize, categoryCount);

    validVariantsCount++;
    effectSizes.push(v.value);

    // Check concordance: does this variant share the baseline's unadjusted conclusion?
    const isConcordant =
      variantResult.testMetadata.rejectsNullHypothesis === baselineResult.testMetadata.rejectsNullHypothesis;
    if (isConcordant) {
      concordantVariantsCount++;
    }

    variantEvaluations.push({
      variantId: variant.variantId,
      label: variant.label,
      dimension: variant.dimension,
      sampleSize: variantResult.sampleSize,
      observedStatistic: variantResult.observedStatistic,
      expectedStatistic: variantResult.expectedStatistic,
      difference: variantResult.difference,
      degreesOfFreedom: df,
      unadjustedSignificanceLevel: alphaUnadjusted,
      adjustedSignificanceLevel: alphaAdjusted,
      criticalValue: variantResult.testMetadata.criticalValue,
      adjustedCriticalValue: adjustedCrit,
      rejectsNullUnadjusted: variantResult.testMetadata.rejectsNullHypothesis,
      rejectsNullAdjusted: rejectsAdjusted,
      effectSize: v,
      status: "COMPLETED",
      assumptionsMet: variantResult.testMetadata.assumptionsMet,
      uncertainty: {
        standardErrorEstimated: Number(
          (Math.sqrt(0.1 * 0.9 / variantResult.sampleSize)).toFixed(4)
        ),
        notes: "Proportion standard error under uniform null hypothesis (p=0.10)"
      },
      resultSummary:
        `${variant.label}: N=${variantResult.sampleSize}, χ²=${variantResult.observedStatistic} (df=${df}), ` +
        `Rejects H0: ${variantResult.testMetadata.rejectsNullHypothesis} (Unadjusted), ${rejectsAdjusted} (Bonferroni), V=${v.value} (${v.magnitude})`
    });
  }

  // 3. Synthesis of Robustness Evaluation Summary
  const concordanceRatio = validVariantsCount > 0 ? concordantVariantsCount / validVariantsCount : 0;
  const stabilityThreshold = definition.configuration.stabilityThreshold;

  let classification: RobustnessEvaluationSummary["classification"];
  if (validVariantsCount < 2) {
    classification = "INCONCLUSIVE_INSUFFICIENT_POWER";
  } else if (concordanceRatio >= stabilityThreshold && validVariantsCount >= m / 2) {
    classification = "HIGHLY_ROBUST";
  } else if (concordanceRatio >= 0.5) {
    classification = "MODERATELY_ROBUST";
  } else {
    classification = "SENSITIVE_TO_SUBGROUP";
  }

  const minV = effectSizes.length > 0 ? Math.min(...effectSizes) : 0;
  const maxV = effectSizes.length > 0 ? Math.max(...effectSizes) : 0;
  const meanV =
    effectSizes.length > 0
      ? Number((effectSizes.reduce((s, val) => s + val, 0) / effectSizes.length).toFixed(4))
      : 0;

  const effectSizeStability = {
    baselineEffectSize: baselineEffectSize.value,
    minVariantEffectSize: Number(minV.toFixed(4)),
    maxVariantEffectSize: Number(maxV.toFixed(4)),
    meanVariantEffectSize: meanV,
    isStable: maxV - minV <= 0.15
  };

  let conclusion: string;
  if (classification === "HIGHLY_ROBUST") {
    conclusion =
      `HISTORICAL_ROBUSTNESS_CONCLUSION: The baseline finding in '${definition.sourceExperimentId}' is HIGHLY_ROBUST. ` +
      `The observed statistical distribution persisted with ${(concordanceRatio * 100).toFixed(1)}% concordance across ${validVariantsCount} valid historical sub-populations. ` +
      `Effect size remained in the ${baselineEffectSize.magnitude} range (mean V = ${meanV}). ` +
      `NON-PREDICTIVE NOTICE: Historical stability describes past publication structure and does NOT predict future lottery outcomes.`;
  } else if (classification === "MODERATELY_ROBUST") {
    conclusion =
      `HISTORICAL_ROBUSTNESS_CONCLUSION: The baseline finding in '${definition.sourceExperimentId}' is MODERATELY_ROBUST. ` +
      `The observation held in ${(concordanceRatio * 100).toFixed(1)}% of valid historical sub-populations but showed variation across specific partitions. ` +
      `NON-PREDICTIVE NOTICE: Historical variance does NOT imply non-randomness in upcoming draws.`;
  } else if (classification === "SENSITIVE_TO_SUBGROUP") {
    conclusion =
      `HISTORICAL_ROBUSTNESS_CONCLUSION: The baseline finding in '${definition.sourceExperimentId}' is SENSITIVE_TO_SUBGROUP. ` +
      `The observation did not persist consistently across sub-populations (concordance = ${(concordanceRatio * 100).toFixed(1)}%). ` +
      `The primary sample finding is largely driven by specific lottery games, tiers, or sample size effects rather than a uniform pattern. ` +
      `NON-PREDICTIVE NOTICE: Historical sensitivity indicates sampling variability across past draws and does NOT forecast future numbers.`;
  } else {
    conclusion =
      `HISTORICAL_ROBUSTNESS_CONCLUSION: INCONCLUSIVE. Insufficient statistical power across partitioned historical sub-populations. ` +
      `NON-PREDICTIVE NOTICE: No historical inference can be confirmed.`;
  }

  const evaluationSummary: RobustnessEvaluationSummary = {
    classification,
    totalVariantsEvaluated: m,
    validVariantsCount,
    insufficientSampleVariantsCount,
    concordantVariantsCount,
    discordantVariantsCount: validVariantsCount - concordantVariantsCount,
    concordanceRatio: Number(concordanceRatio.toFixed(4)),
    stabilityThreshold,
    effectSizeStability,
    robustnessCriteriaDescription:
      `Classified as HIGHLY_ROBUST if concordance >= ${stabilityThreshold * 100}% among valid partitions; ` +
      `MODERATELY_ROBUST if >= 50%; SENSITIVE_TO_SUBGROUP if < 50%.`,
    conclusion,
    recommendationsForResearchers: [
      "Review variant effect sizes alongside p-values to distinguish statistical significance from practical magnitude.",
      "Consider Bonferroni-adjusted thresholds when evaluating multiple concurrent hypothesis tests.",
      "Maintain population isolation: do not pool heterogeneous lottery games without separate subgroup checks."
    ]
  };

  const evaluatedAt = options?.executedAt || new Date().toISOString();
  const frameworkVersion = options?.version || DEFAULT_ROBUSTNESS_VERSION;

  const deterministicHash = computeRobustnessReportHash(
    definition.id,
    baselineResult.id,
    classification,
    concordanceRatio,
    validVariantsCount
  );

  return {
    id: `rob_rep_${deterministicHash}`,
    robustnessId: definition.id,
    sourceExperimentId: definition.sourceExperimentId,
    sourceExperimentResultId: baselineResult.id,
    frameworkVersion,
    evaluatedAt,
    status: "COMPLETED",
    numberOfComparisons: m,
    comparisonMethod:
      definition.configuration.correctionMethod === "BONFERRONI"
        ? `Chi-Square Goodness-of-Fit with Bonferroni correction (m = ${m}, adjusted α = ${alphaAdjusted.toFixed(5)})`
        : `Chi-Square Goodness-of-Fit without multiple comparison correction (α = ${alphaUnadjusted})`,
    correctionMethod: definition.configuration.correctionMethod,
    baselineEvaluation: {
      populationScope: baselineResult.populationScope,
      observedStatistic: baselineResult.observedStatistic,
      degreesOfFreedom: baselineResult.testMetadata.degreesOfFreedom,
      criticalValue: baselineResult.testMetadata.criticalValue,
      rejectsNullHypothesis: baselineResult.testMetadata.rejectsNullHypothesis,
      effectSize: baselineEffectSize,
      sampleSize: baselineResult.sampleSize
    },
    variantEvaluations,
    evaluationSummary,
    limitations: [
      HISTORICAL_ROBUSTNESS_DISCLAIMER,
      "DESCRIPTIVE_HISTORICAL_ONLY: Evaluated strictly over published Kerala State Gazette records in corpus.",
      "FINITE_SUBGROUP_SIZE: Subgroup partitions necessarily have smaller sample sizes and reduced statistical power.",
      "INDEPENDENT_RANDOM_SELECTION: Past lottery publications do not dictate or influence future outcomes.",
      "ZERO_BETTING_OR_PREDICTIVE_CLAIM: Findings cannot be used for gambling optimization or number prediction."
    ],
    provenanceSummary: {
      totalResultsTracked: baselineResult.sampleSize,
      totalDrawsTracked: baselineResult.populationScope.drawCount,
      documentSha256s: Array.from(allInvolvedDocShas).sort(),
      sampleProvenance: baselineResult.provenanceSummary.sampleProvenance,
      variantDocumentShaMap
    },
    deterministicHash,
    descriptiveOnly: true
  };
}
