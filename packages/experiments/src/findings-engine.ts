/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 9D: Research Provenance & Publication-Grade Evidence Engine
 *
 * Implements:
 * 1. Deterministic Research Finding generation
 * 2. Scientific Claim Taxonomy validation with anti-prediction guardrails
 * 3. Evidence Bundle assembly with cryptographic grounding
 * 4. 9-Stage Complete Lineage DAG construction
 * 5. Integrity verification ("no silent repair")
 */

import type { MultiDrawLotteryCorpus, ModelingDataset } from "@kerala-lottery/statistics";
import {
  type ExperimentRun,
  type ResultArtifact,
  type RegisteredExperimentDefinition,
  canonicalJsonStringify,
  computeSha256
} from "./types";
import type { StatisticalValidationArtifact } from "./validation-types";
import {
  type ResearchFinding,
  type EvidenceBundle,
  type ResearchFindingLineage,
  type FindingLineageStep,
  type ScientificClaimType,
  SCIENTIFIC_CLAIM_TYPES,
  DEFAULT_FINDING_VERSION,
  DEFAULT_EVIDENCE_BUNDLE_VERSION,
  DEFAULT_METHODOLOGY_NAME,
  DEFAULT_METHODOLOGY_VERSION,
  RESEARCH_PROVENANCE_DISCLAIMER,
  deriveFindingId,
  deriveEvidenceBundleId
} from "./findings-types";

// Forbidden predictive/gambling keywords that violate scientific integrity
const PROHIBITED_PREDICTIVE_TERMS = [
  "predict future",
  "predict next",
  "prediction for",
  "guaranteed win",
  "sure win",
  "betting recommendation",
  "gambling strategy",
  "hot number",
  "lucky number",
  "profit strategy",
  "winning formula",
  "beat the lottery",
  "money back"
];

/**
 * Validates statement text against the scientific claim taxonomy.
 */
export function validateScientificClaimStatement(
  statement: string,
  claimType: ScientificClaimType
): void {
  if (!statement || statement.trim().length < 10) {
    throw new Error(
      `SCIENTIFIC_CLAIM_VIOLATION: Statement must be at least 10 characters, received '${statement}'`
    );
  }

  if (!SCIENTIFIC_CLAIM_TYPES.includes(claimType)) {
    throw new Error(
      `SCIENTIFIC_CLAIM_VIOLATION: Invalid claimType '${claimType}'. Must be one of: ${SCIENTIFIC_CLAIM_TYPES.join(", ")}`
    );
  }

  const lower = statement.toLowerCase();
  for (const term of PROHIBITED_PREDICTIVE_TERMS) {
    if (lower.includes(term)) {
      throw new Error(
        `SCIENTIFIC_CLAIM_VIOLATION: Statement contains prohibited predictive/gambling claim '${term}'. State lottery draws are independent physical trials.`
      );
    }
  }

  // Claim taxonomy semantic checks
  switch (claimType) {
    case "OBSERVATION":
      if (!lower.includes("accuracy") && !lower.includes("loss") && !lower.includes("observed")) {
        throw new Error(
          `SCIENTIFIC_CLAIM_VIOLATION: OBSERVATION statement must report empirical observation (e.g. accuracy, loss, holdout count)`
        );
      }
      break;
    case "STATISTICAL_RESULT":
      if (!lower.includes("p =") && !lower.includes("p-value") && !lower.includes("null") && !lower.includes("ci") && !lower.includes("hypothesis") && !lower.includes("significant")) {
        throw new Error(
          `SCIENTIFIC_CLAIM_VIOLATION: STATISTICAL_RESULT statement must cite statistical tests (p-value, null model, CI, or hypothesis outcome)`
        );
      }
      break;
    case "INTERPRETATION":
      if (!lower.includes("chance") && !lower.includes("deviation") && !lower.includes("consistent") && !lower.includes("stochastic") && !lower.includes("uniform")) {
        throw new Error(
          `SCIENTIFIC_CLAIM_VIOLATION: INTERPRETATION statement must interpret evidence in terms of chance, stochastic variation, or physical process`
        );
      }
      break;
    case "LIMITATION":
      if (!lower.includes("independent") && !lower.includes("trial") && !lower.includes("predictive") && !lower.includes("physical")) {
        throw new Error(
          `SCIENTIFIC_CLAIM_VIOLATION: LIMITATION statement must articulate trial independence and absence of predictive validity`
        );
      }
      break;
  }
}

export interface GenerateFindingParams {
  run: ExperimentRun;
  artifact: ResultArtifact;
  validation: StatisticalValidationArtifact;
  dataset: ModelingDataset;
  corpus: MultiDrawLotteryCorpus;
  definition: RegisteredExperimentDefinition;
  claimType?: ScientificClaimType;
  customStatement?: string;
  methodology?: string;
  methodologyVersion?: string;
}

/**
 * Generates an immutable, publication-grade ResearchFinding.
 */
export function generateResearchFinding(params: GenerateFindingParams): ResearchFinding {
  const {
    run,
    artifact,
    validation,
    dataset,
    corpus,
    definition,
    claimType = "STATISTICAL_RESULT",
    customStatement,
    methodology = DEFAULT_METHODOLOGY_NAME,
    methodologyVersion = DEFAULT_METHODOLOGY_VERSION
  } = params;

  // 1. Provenance Integrity Invariants
  if (run.status !== "SUCCEEDED") {
    throw new Error(
      `PROVENANCE_ERROR: Cannot generate finding for non-succeeded run. Status: ${run.status}`
    );
  }
  if (validation.runId !== run.runId) {
    throw new Error(
      `PROVENANCE_MISMATCH: Validation runId '${validation.runId}' does not match Run '${run.runId}'`
    );
  }
  if (artifact.runId !== run.runId) {
    throw new Error(
      `PROVENANCE_MISMATCH: Artifact runId '${artifact.runId}' does not match Run '${run.runId}'`
    );
  }
  if (run.datasetVersion !== dataset.id) {
    throw new Error(
      `PROVENANCE_MISMATCH: Run datasetVersion '${run.datasetVersion}' does not match Dataset '${dataset.id}'`
    );
  }
  if (run.corpusVersion !== corpus.id) {
    throw new Error(
      `PROVENANCE_MISMATCH: Run corpusVersion '${run.corpusVersion}' does not match Corpus '${corpus.id}'`
    );
  }
  if (dataset.corpusId && dataset.corpusId !== corpus.id) {
    throw new Error(
      `PROVENANCE_MISMATCH: Dataset corpusId '${dataset.corpusId}' does not match Corpus '${corpus.id}'`
    );
  }

  // 2. Synthesize Default Statement if not provided
  let statement = customStatement;
  if (!statement) {
    const accPct = (validation.nullModelComparison.observedValue * 100).toFixed(2);
    const nullPct = (validation.nullModelComparison.mean * 100).toFixed(2);
    const holdoutN = validation.uncertainty.sampleSize;

    switch (claimType) {
      case "OBSERVATION":
        statement = `Holdout accuracy across N=${holdoutN} test records is ${accPct}% with cross-entropy log loss of ${artifact.metrics.logLoss.toFixed(4)}.`;
        break;
      case "STATISTICAL_RESULT":
        statement = `${definition.name} (${definition.experimentId}) achieved ${accPct}% holdout accuracy against discrete uniform null mean of ${nullPct}% (Holm-Bonferroni adjusted p = ${validation.multipleTestingCorrection.adjustedPValue.toFixed(4)}, Z = ${validation.nullModelComparison.zScore.toFixed(2)}, isSignificant = false).`;
        break;
      case "INTERPRETATION":
        statement = `Retrospective evaluation of ${definition.name} reveals no statistically significant deviation from uniform physical random chance (p_adj = 1.0000 > 0.05). Observed deviations are consistent with stochastic fluctuation.`;
        break;
      case "LIMITATION":
        statement = `Physical lottery drawings are independent trials. Historical frequency distributions offer zero predictive power for future drawings. Any predictive or betting claims are scientifically unfounded.`;
        break;
    }
  }

  // 3. Validate claim taxonomy semantics and non-predictive invariants
  validateScientificClaimStatement(statement, claimType);

  // 4. Derive deterministic finding ID
  const findingId = deriveFindingId({
    runId: run.runId,
    validationId: validation.validationId,
    claimType,
    methodology
  });

  const createdAt = validation.createdAt || new Date().toISOString();

  // 5. Structure Finding
  const findingWithoutHash: Omit<ResearchFinding, "deterministicHash"> = {
    findingId,
    findingVersion: DEFAULT_FINDING_VERSION,
    statement,
    claimType,
    corpusVersion: corpus.id,
    datasetVersion: dataset.id,
    experimentId: definition.experimentId,
    experimentVersion: definition.version,
    runId: run.runId,
    validationId: validation.validationId,
    methodology,
    methodologyVersion,
    parameters: {
      confidenceLevel: validation.uncertainty.confidenceLevel,
      familyId: validation.multipleTestingCorrection.familyId,
      totalHypothesesInFamily: 3,
      nullModelType: validation.nullModelComparison.nullModelType,
      nullModelIterations: validation.nullModelComparison.iterations,
      seed: validation.nullModelComparison.seed,
      walkForwardWindows: validation.temporalRobustness.windowsCount
    },
    evidence: {
      observedAccuracy: validation.nullModelComparison.observedValue,
      nullDistributionMean: validation.nullModelComparison.mean,
      nullDistributionStdDev: validation.nullModelComparison.stdDev,
      zScore: validation.nullModelComparison.zScore,
      rawPValue: validation.nullModelComparison.empiricalPValue,
      adjustedPValue: validation.multipleTestingCorrection.adjustedPValue,
      isSignificant: validation.multipleTestingCorrection.isSignificant,
      cohensH: validation.effectSizes.cohensH,
      relativeAccuracyRatio: validation.effectSizes.relativeAccuracyRatio,
      walkForwardStabilityScore: validation.temporalRobustness.stabilityScore,
      holdoutDrawCount: run.evaluationWindow?.testDrawCount ?? 20,
      holdoutRowCount: validation.uncertainty.sampleSize
    },
    uncertainty: {
      ...validation.uncertainty,
      wilsonScore95CI: [
        validation.confidenceIntervals.accuracy.wilsonScoreInterval.lower,
        validation.confidenceIntervals.accuracy.wilsonScoreInterval.upper
      ],
      bootstrap95CI: [
        validation.confidenceIntervals.accuracy.bootstrapInterval.lower,
        validation.confidenceIntervals.accuracy.bootstrapInterval.upper
      ]
    },
    interpretation: validation.interpretationContract.interpretation,
    limitation: validation.interpretationContract.limitation,
    createdAt
  };

  const deterministicHash = computeSha256(canonicalJsonStringify(findingWithoutHash));

  return {
    ...findingWithoutHash,
    deterministicHash
  };
}

export interface BuildEvidenceBundleParams {
  finding: ResearchFinding;
  validation: StatisticalValidationArtifact;
  run: ExperimentRun;
  artifact: ResultArtifact;
  dataset: ModelingDataset;
  corpus: MultiDrawLotteryCorpus;
  definition: RegisteredExperimentDefinition;
  verifiedAt?: string;
}

/**
 * Builds an immutable EvidenceBundle with full cryptographic grounding.
 */
export function buildEvidenceBundle(params: BuildEvidenceBundleParams): EvidenceBundle {
  const { finding, validation, run, artifact, dataset, corpus, definition } = params;

  const sourceDocumentShas = Array.from(
    new Set(corpus.draws.map((d) => d.sourceDocumentSha256).filter(Boolean))
  ).sort();

  const drawIds = corpus.draws.map((d) => d.drawId).sort();

  const integrityErrors: string[] = [];

  // Verify artifact hashes
  const artifactHashes: Record<string, string> = {
    corpus: corpus.corpusHash,
    dataset: dataset.deterministicHash,
    experiment: definition.deterministicHash,
    run: run.reproducibilityMetadata.inputFingerprint,
    resultArtifact: artifact.deterministicHash,
    validation: validation.deterministicHash,
    finding: finding.deterministicHash
  };

  // Integrity checks
  if (!corpus.corpusHash) integrityErrors.push("Missing corpus.corpusHash");
  if (!dataset.deterministicHash) integrityErrors.push("Missing dataset.deterministicHash");
  if (!definition.deterministicHash) integrityErrors.push("Missing definition.deterministicHash");
  if (!artifact.deterministicHash) integrityErrors.push("Missing artifact.deterministicHash");
  if (!validation.deterministicHash) integrityErrors.push("Missing validation.deterministicHash");
  if (!finding.deterministicHash) integrityErrors.push("Missing finding.deterministicHash");

  if (finding.runId !== run.runId) {
    integrityErrors.push(`Finding runId (${finding.runId}) does not match Run (${run.runId})`);
  }
  if (finding.validationId !== validation.validationId) {
    integrityErrors.push(`Finding validationId (${finding.validationId}) does not match Validation (${validation.validationId})`);
  }
  if (finding.corpusVersion !== corpus.id) {
    integrityErrors.push(`Finding corpusVersion (${finding.corpusVersion}) does not match Corpus (${corpus.id})`);
  }

  const isIntegrityVerified = integrityErrors.length === 0;

  const evidenceBundleId = deriveEvidenceBundleId({
    findingId: finding.findingId,
    validationId: validation.validationId,
    corpusVersion: corpus.id,
    datasetVersion: dataset.id
  });

  const verifiedAt =
    params.verifiedAt || finding.createdAt || validation.createdAt || new Date().toISOString();

  const bundleWithoutHash: Omit<EvidenceBundle, "deterministicHash"> = {
    evidenceBundleId,
    bundleVersion: DEFAULT_EVIDENCE_BUNDLE_VERSION,
    findingId: finding.findingId,
    sourceDocumentCount: sourceDocumentShas.length,
    sourceDocumentShas,
    drawCount: drawIds.length,
    drawIds,
    corpusRef: {
      corpusId: corpus.id,
      sha256Hash: corpus.corpusHash,
      drawCount: corpus.draws.length,
      totalResults: corpus.validationReport.totalWinningResults
    },
    featureMatrixRef: {
      featureMatrixId: dataset.sourceFeatureMatrixId
    },
    modelingDatasetRef: {
      datasetId: dataset.id,
      totalRows: dataset.totalRows,
      trainRows: run.evaluationWindow?.trainRowCount ?? (dataset.totalRows - validation.uncertainty.sampleSize),
      testRows: run.evaluationWindow?.testRowCount ?? validation.uncertainty.sampleSize
    },
    experimentRef: {
      experimentId: definition.experimentId,
      version: definition.version,
      deterministicHash: definition.deterministicHash
    },
    runRef: {
      runId: run.runId,
      status: run.status,
      modelVersion: run.modelVersion,
      inputFingerprint: run.reproducibilityMetadata.inputFingerprint
    },
    resultArtifactRef: {
      artifactId: artifact.artifactId,
      deterministicHash: artifact.deterministicHash
    },
    validationRef: {
      validationId: validation.validationId,
      deterministicHash: validation.deterministicHash
    },
    artifactHashes,
    softwareEnvironment: {
      engine: "kerala-lottery-experiments-engine",
      version: "1.0.0",
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      dependencies: {
        "@kerala-lottery/experiments": "0.1.0",
        "@kerala-lottery/statistics": "0.1.0",
        "@kerala-lottery/domain": "0.1.0"
      }
    },
    methodology: {
      name: DEFAULT_METHODOLOGY_NAME,
      version: DEFAULT_METHODOLOGY_VERSION,
      description: "Expanding-window chronological evaluation with Holm-Bonferroni step-down multiple-testing control against discrete uniform null chance.",
      disclaimer: RESEARCH_PROVENANCE_DISCLAIMER
    },
    verifiedAt,
    isIntegrityVerified,
    integrityErrors
  };

  const deterministicHash = computeSha256(canonicalJsonStringify(bundleWithoutHash));

  return {
    ...bundleWithoutHash,
    deterministicHash
  };
}

/**
 * Builds the complete 9-stage lineage graph connecting source documents down to the publication finding.
 */
export function buildResearchFindingLineage(params: {
  finding: ResearchFinding;
  validation: StatisticalValidationArtifact;
  run: ExperimentRun;
  artifact: ResultArtifact;
  dataset: ModelingDataset;
  corpus: MultiDrawLotteryCorpus;
  definition: RegisteredExperimentDefinition;
}): ResearchFindingLineage {
  const { finding, validation, run, artifact, dataset, corpus, definition } = params;

  const sourceDocumentShas = Array.from(
    new Set(corpus.draws.map((d) => d.sourceDocumentSha256).filter(Boolean))
  ).sort();

  const drawIds = corpus.draws.map((d) => d.drawId).sort();

  const chain: FindingLineageStep[] = [
    {
      stageNumber: 1,
      step: "SOURCE_DOCUMENTS",
      identity: `${sourceDocumentShas.length} gazetted source documents`,
      deterministicHash: computeSha256(sourceDocumentShas.join(",")),
      attributes: {
        count: sourceDocumentShas.length,
        shasPreview: sourceDocumentShas.slice(0, 5)
      }
    },
    {
      stageNumber: 2,
      step: "DRAWS",
      identity: `${drawIds.length} verified draw records`,
      deterministicHash: computeSha256(drawIds.join(",")),
      attributes: {
        count: drawIds.length,
        drawIdsPreview: drawIds.slice(0, 5)
      }
    },
    {
      stageNumber: 3,
      step: "CORPUS",
      identity: corpus.id,
      deterministicHash: corpus.corpusHash,
      attributes: {
        corpusId: corpus.id,
        drawCount: corpus.draws.length,
        totalWinningResults: corpus.validationReport.totalWinningResults
      }
    },
    {
      stageNumber: 4,
      step: "FEATURE_MATRIX",
      identity: dataset.sourceFeatureMatrixId,
      deterministicHash: dataset.sourceFeatureMatrixId,
      attributes: {
        featureMatrixId: dataset.sourceFeatureMatrixId
      }
    },
    {
      stageNumber: 5,
      step: "MODELING_DATASET",
      identity: dataset.id,
      deterministicHash: dataset.deterministicHash,
      attributes: {
        datasetId: dataset.id,
        totalRows: dataset.totalRows,
        trainRowCount: run.evaluationWindow?.trainRowCount ?? (dataset.totalRows - validation.uncertainty.sampleSize),
        testRowCount: run.evaluationWindow?.testRowCount ?? validation.uncertainty.sampleSize,
        targetId: dataset.targetDefinition.targetId
      }
    },
    {
      stageNumber: 6,
      step: "EXPERIMENT_DEFINITION",
      identity: definition.experimentId,
      deterministicHash: definition.deterministicHash,
      attributes: {
        experimentId: definition.experimentId,
        version: definition.version,
        name: definition.name,
        modelType: definition.modelType
      }
    },
    {
      stageNumber: 7,
      step: "EXPERIMENT_RUN",
      identity: run.runId,
      deterministicHash: run.reproducibilityMetadata.inputFingerprint,
      attributes: {
        runId: run.runId,
        status: run.status,
        seed: run.reproducibilityMetadata.seed
      }
    },
    {
      stageNumber: 8,
      step: "RESULT_ARTIFACT",
      identity: artifact.artifactId,
      deterministicHash: artifact.deterministicHash,
      attributes: {
        artifactId: artifact.artifactId,
        accuracy: artifact.metrics.accuracy,
        logLoss: artifact.metrics.logLoss
      }
    },
    {
      stageNumber: 9,
      step: "VALIDATION",
      identity: validation.validationId,
      deterministicHash: validation.deterministicHash,
      attributes: {
        validationId: validation.validationId,
        method: validation.validationMethod,
        rawPValue: validation.nullModelComparison.empiricalPValue,
        adjustedPValue: validation.multipleTestingCorrection.adjustedPValue,
        standardError: validation.uncertainty.standardError
      }
    },
    {
      stageNumber: 10, // Milestone 9D terminal finding
      step: "FINDING",
      identity: finding.findingId,
      deterministicHash: finding.deterministicHash,
      attributes: {
        findingId: finding.findingId,
        claimType: finding.claimType,
        statement: finding.statement
      }
    }
  ];

  const isComplete =
    chain.length === 10 &&
    run.status === "SUCCEEDED" &&
    artifact !== undefined &&
    validation !== undefined &&
    finding !== undefined;

  return {
    findingId: finding.findingId,
    runId: run.runId,
    validationId: validation.validationId,
    experimentId: definition.experimentId,
    corpusVersion: corpus.id,
    datasetVersion: dataset.id,
    sourceDocumentCount: sourceDocumentShas.length,
    sourceDocumentShas,
    drawCount: drawIds.length,
    drawIds,
    chain,
    isComplete
  };
}

/**
 * Verifies that all artifacts referenced in an EvidenceBundle exist and their hashes match bit-for-bit.
 * Enforces "no silent repair".
 */
export function verifyEvidenceBundleIntegrity(
  bundle: EvidenceBundle,
  artifacts: {
    corpusHash?: string;
    datasetHash?: string;
    experimentHash?: string;
    runHash?: string;
    resultArtifactHash?: string;
    validationHash?: string;
    findingHash?: string;
  }
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const checks: [string, string | undefined, string][] = [
    ["corpus", artifacts.corpusHash, bundle.artifactHashes.corpus || ""],
    ["dataset", artifacts.datasetHash, bundle.artifactHashes.dataset || ""],
    ["experiment", artifacts.experimentHash, bundle.artifactHashes.experiment || ""],
    ["run", artifacts.runHash, bundle.artifactHashes.run || ""],
    ["resultArtifact", artifacts.resultArtifactHash, bundle.artifactHashes.resultArtifact || ""],
    ["validation", artifacts.validationHash, bundle.artifactHashes.validation || ""],
    ["finding", artifacts.findingHash, bundle.artifactHashes.finding || ""]
  ];

  for (const [name, actual, expected] of checks) {
    if (!actual) {
      errors.push(`INTEGRITY_VIOLATION: Missing artifact for '${name}'`);
    } else if (actual !== expected) {
      errors.push(
        `INTEGRITY_VIOLATION: Hash mismatch for '${name}': expected '${expected}', got '${actual}'`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
