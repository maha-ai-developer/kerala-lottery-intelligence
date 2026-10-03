/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone V1.0 Final: Research Sandbox Types & Domain Contracts
 *
 * Provides types and interfaces for the user research sandbox:
 * - Candidate ticket input (lottery, scheme, series, number, optional draw/context)
 * - Strict structural & prize scheme validation
 * - Mathematical feature profile
 * - Retrospective historical comparison against the verified corpus
 * - Statistical baseline context (EXP-001, EXP-002, EXP-003)
 * - Geographic context & critical exposure denominator limitation
 * - Non-predictive research interpretations and limitations
 * - Lineage and provenance tracking
 *
 * STRICT NON-NEGOTIABLE INVARIANT:
 * Purely descriptive and retrospective empirical analysis.
 * Zero prediction, probability scoring, betting advice, or lucky metrics.
 */

export type ResearchDescriptiveClassification =
  | "COMMON"
  | "UNCOMMON"
  | "NOVEL"
  | "STRUCTURALLY_VALID"
  | "STRUCTURALLY_INVALID"
  | "WITHIN_HISTORICAL_DISTRIBUTION"
  | "RELATIVELY_RARE_FEATURE_COMBINATION"
  | "OUTSIDE_CURRENT_CORPUS_OBSERVATION";

export interface CandidateTicketInput {
  lotteryCode: string;
  schemeVersionId?: string;
  series: string;
  ticketNumber: string;
  drawId?: string;
  drawDate?: string;
  userProvidedContext?: string;
  isHistoricalReplay?: boolean;
  temporalCutoffDate?: string; // ISO date string (YYYY-MM-DD)
  temporalCutoffDrawId?: string;
}

export interface ValidationCheckItem {
  checkId: string;
  checkName: string;
  status: "PASS" | "FAIL" | "WARN";
  message: string;
}

export interface TicketValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  checks: ValidationCheckItem[];
  resolvedLottery?: {
    code: string;
    name: string;
  };
  resolvedScheme?: {
    id: string;
    version: string;
    name: string;
    authorityLevel: string;
    tierCount: number;
    ticketPrice: number;
  };
  seriesValidation?: {
    series: string;
    isValidForScheme: boolean;
    allowedSeries?: string[];
    numberOfSeries: number;
    explanation: string;
  };
  numberValidation?: {
    ticketNumber: string;
    length: number;
    expectedLength: number;
    hasLeadingZero: boolean;
    isValidDigitsOnly: boolean;
  };
}

export interface TicketFeatureProfile {
  canonicalNumber: string;
  numberLength: number;
  firstDigit: string;
  lastDigit: string;
  digits: number[];
  digitSum: number;
  uniqueDigitCount: number;
  repeatedDigitCount: number;
  hasRepeatedDigit: boolean;
  evenDigitCount: number;
  oddDigitCount: number;
  parityBalance: "EVEN_DOMINATED" | "ODD_DOMINATED" | "BALANCED";
  zeroCount: number;
  positionsLeft: Record<number, number>;
  positionsRight: Record<number, number>;
  suffix2: string;
  suffix3: string;
  suffix4: string;
  structural: {
    isPalindrome: boolean;
    allDigitsSame: boolean;
    isAlternating: boolean;
    isAscending: boolean;
    isDescending: boolean;
    repeatedAdjacentPairCount: number;
  };
  series: {
    seriesCode: string;
    length: number;
    characters: string[];
  };
}

export interface HistoricalMatchItem {
  drawId: string;
  drawNumber: string;
  drawDate: string;
  lotteryCode: string;
  lotteryName: string;
  prizeTierName: string;
  rank: number;
  amount?: number;
  series: string;
  canonicalNumber: string;
  sourceDocumentSha256: string;
  sourcePageNumber?: number;
  publishedDistrict?: string;
  publishedLocation?: string;
}

export interface HistoricalComparisonResult {
  corpusVersion: string;
  sampleSizeResults: number;
  sampleSizeDraws: number;
  fullTicketSampleSize: number;
  suffixSampleSize: number;
  temporalCutoffApplied: boolean;
  cutoffDate?: string;
  exactTicketMatch: {
    observedInCorpus: boolean;
    matchCount: number;
    matches: HistoricalMatchItem[];
  };
  lastDigitComparison: {
    inputDigit: string;
    observedCount: number;
    totalCount: number;
    empiricalFrequency: number;
    expectedUniformFrequency: number;
    differenceFromUniform: number;
    relativeCommonness: "RELATIVELY_COMMON" | "RELATIVELY_UNCOMMON" | "NEAR_EXPECTED";
    wilsonConfidenceInterval95: [number, number];
  };
  firstDigitComparison: {
    inputDigit: string;
    observedCount: number;
    totalCount: number;
    empiricalFrequency: number;
    expectedUniformFrequency: number;
    differenceFromUniform: number;
    relativeCommonness: "RELATIVELY_COMMON" | "RELATIVELY_UNCOMMON" | "NEAR_EXPECTED";
    wilsonConfidenceInterval95: [number, number];
  };
  suffixComparisons: {
    suffix2: {
      suffix: string;
      observedCount: number;
      sampleSize: number;
      empiricalFrequency: number;
    };
    suffix3: {
      suffix: string;
      observedCount: number;
      sampleSize: number;
      empiricalFrequency: number;
    };
    suffix4: {
      suffix: string;
      observedCount: number;
      sampleSize: number;
      empiricalFrequency: number;
    };
  };
  digitSumComparison: {
    inputSum: number;
    theoreticalRange: [number, number];
    theoreticalMean: number;
    empiricalPercentile: number;
    rarityClassification: "COMMON" | "MODERATE" | "RARE";
  };
  structuralPatternHistoricalFrequency: {
    isPalindromeObservedInCorpus: boolean;
    allDigitsSameObservedInCorpus: boolean;
    isAscendingObservedInCorpus: boolean;
    isDescendingObservedInCorpus: boolean;
  };
}

export interface BaselineExperimentContext {
  experimentId: string;
  name: string;
  modelType: string;
  relationToInput: string;
  benchmarkMetric: string;
  disclaimer: string;
}

export interface StatisticalContextResult {
  baselineExperiments: BaselineExperimentContext[];
  distributionContext: {
    lastDigitChiSquareUniformity: {
      chiSquare: number;
      degreesOfFreedom: number;
      isConsistentWithUniform: boolean;
      pText: string;
    };
    entropy: {
      lastDigitEntropy: number;
      theoreticalUniformEntropy: number;
    };
  };
  empiricalDescriptiveClassifications: ResearchDescriptiveClassification[];
}

export interface GeographicContextResult {
  status: "HISTORICAL_OBSERVATION_FOUND" | "USER_PROVIDED_CONTEXT" | "NO_GEOGRAPHIC_EVIDENCE_FOR_INPUT";
  observations: Array<{
    drawId: string;
    drawNumber: string;
    lotteryName: string;
    prizeTier: string;
    series: string;
    ticketNumber: string;
    rawLocation: string;
    normalizedDistrict: string;
    sourceDocumentSha256: string;
    sourcePage: number;
    authority: string;
  }>;
  userProvidedContext?: string;
  criticalExposureLimitation: string;
  isExposureAvailable: false;
}

export interface ResearchSandboxAnalysis {
  analysisId: string;
  analysisTimestamp: string;
  deterministicHash: string;
  input: CandidateTicketInput;
  validation: TicketValidationResult;
  featureProfile?: TicketFeatureProfile;
  historicalComparison?: HistoricalComparisonResult;
  statisticalContext?: StatisticalContextResult;
  geographicContext?: GeographicContextResult;
  researchInterpretation: {
    summary: string;
    classifications: ResearchDescriptiveClassification[];
    explanation: string;
  };
  limitations: {
    nonPredictiveDisclaimer: string;
    exposureLimitation: string;
    statisticalCaveats: string[];
  };
  provenance: {
    corpusVersion: string;
    featureVersion: string;
    datasetVersion: string;
    experimentVersion: string;
    validationVersion: string;
    geographicVersion: string;
    auditSha256: string;
  };
}
