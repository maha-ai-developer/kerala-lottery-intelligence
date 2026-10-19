/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 9D: Research Provenance & Publication-Grade Evidence Types
 *
 * Implements:
 * 1. Research Finding contract
 * 2. Scientific Claim Taxonomy (OBSERVATION, STATISTICAL_RESULT, INTERPRETATION, LIMITATION)
 * 3. Evidence Bundle contract (cryptographic grounding, source documents, artifact hashes)
 * 4. 9-Stage Complete Lineage DAG contract
 * 5. Publication-Grade Report structures
 *
 * Strict Non-Predictive Boundary:
 * All findings are retrospective descriptive statistics. Kerala State Lottery draws
 * operate as independent physical trials; past frequencies possess zero predictive power.
 */

import type { UncertaintyMetadata } from "./validation-types";

export const RESEARCH_PROVENANCE_DISCLAIMER =
  "SCIENTIFIC EVIDENCE INTEGRITY NOTICE: This publication-grade evidence bundle grounds retrospective statistical findings in an immutable cryptographic audit trail. Physical Kerala State Lottery draws are independent stochastic trials. Past digit distributions possess zero predictive power for future draws. All predictive, gambling, or betting claims are scientifically unfounded.";

export const DEFAULT_FINDING_VERSION = "1.0.0";
export const DEFAULT_EVIDENCE_BUNDLE_VERSION = "1.0.0";
export const DEFAULT_METHODOLOGY_NAME = "EXPANDING_WINDOW_HOLM_BONFERRONI_V1";
export const DEFAULT_METHODOLOGY_VERSION = "1.0.0";

// ============================================================================
// 1. Scientific Claim Taxonomy
// ============================================================================

export type ScientificClaimType =
  | "OBSERVATION"
  | "STATISTICAL_RESULT"
  | "INTERPRETATION"
  | "LIMITATION";

export const SCIENTIFIC_CLAIM_TYPES: ScientificClaimType[] = [
  "OBSERVATION",
  "STATISTICAL_RESULT",
  "INTERPRETATION",
  "LIMITATION"
];

// ============================================================================
// 2. Research Finding Contract (9D.1)
// ============================================================================

export interface ResearchFinding {
  findingId: string; // find_${hash}
  findingVersion: string;
  statement: string;
  claimType: ScientificClaimType;
  corpusVersion: string;
  datasetVersion: string;
  experimentId: string;
  experimentVersion: string;
  runId: string;
  validationId: string;
  methodology: string;
  methodologyVersion: string;
  parameters: {
    confidenceLevel: number;
    familyId: string;
    totalHypothesesInFamily: number;
    nullModelType: string;
    nullModelIterations: number;
    seed: number;
    walkForwardWindows: number;
    [key: string]: unknown;
  };
  evidence: {
    observedAccuracy: number;
    nullDistributionMean: number;
    nullDistributionStdDev: number;
    zScore: number;
    rawPValue: number;
    adjustedPValue: number;
    isSignificant: boolean;
    cohensH: number;
    relativeAccuracyRatio: number;
    walkForwardStabilityScore: number;
    holdoutDrawCount: number;
    holdoutRowCount: number;
    [key: string]: unknown;
  };
  uncertainty: UncertaintyMetadata & {
    wilsonScore95CI: [number, number];
    bootstrap95CI: [number, number];
  };
  interpretation: string;
  limitation: string;
  createdAt: string;
  deterministicHash: string; // SHA-256
}

// ============================================================================
// 3. Evidence Bundle Contract (9D.2)
// ============================================================================

export interface EvidenceArtifactReference {
  id: string;
  type:
    | "CORPUS"
    | "FEATURE_MATRIX"
    | "MODELING_DATASET"
    | "EXPERIMENT"
    | "RUN"
    | "RESULT_ARTIFACT"
    | "VALIDATION"
    | "FINDING";
  deterministicHash: string;
  verified: boolean;
}

export interface SoftwareEnvironmentMetadata {
  engine: string;
  version: string;
  nodeVersion: string;
  platform: string;
  arch: string;
  dependencies: Record<string, string>;
}

export interface EvidenceBundle {
  evidenceBundleId: string; // evb_${hash}
  bundleVersion: string;
  findingId: string;
  sourceDocumentCount: number;
  sourceDocumentShas: string[];
  drawCount: number;
  drawIds: string[];
  corpusRef: {
    corpusId: string;
    sha256Hash: string;
    drawCount: number;
    totalResults: number;
  };
  featureMatrixRef: {
    featureMatrixId: string;
  };
  modelingDatasetRef: {
    datasetId: string;
    totalRows: number;
    trainRows: number;
    testRows: number;
  };
  experimentRef: {
    experimentId: string;
    version: string;
    deterministicHash: string;
  };
  runRef: {
    runId: string;
    status: string;
    modelVersion: string;
    inputFingerprint: string;
  };
  resultArtifactRef: {
    artifactId: string;
    deterministicHash: string;
  };
  validationRef: {
    validationId: string;
    deterministicHash: string;
  };
  artifactHashes: Record<string, string>;
  softwareEnvironment: SoftwareEnvironmentMetadata;
  methodology: {
    name: string;
    version: string;
    description: string;
    disclaimer: string;
  };
  verifiedAt: string;
  isIntegrityVerified: boolean;
  integrityErrors: string[];
  deterministicHash: string; // SHA-256
}

// ============================================================================
// 4. 9-Stage Complete Lineage Graph (9D.3)
// ============================================================================

export type FindingLineageStage =
  | "SOURCE_DOCUMENTS"
  | "DRAWS"
  | "CORPUS"
  | "FEATURE_MATRIX"
  | "MODELING_DATASET"
  | "EXPERIMENT_DEFINITION"
  | "EXPERIMENT_RUN"
  | "RESULT_ARTIFACT"
  | "VALIDATION"
  | "FINDING";

export interface FindingLineageStep {
  stageNumber: number; // 1 to 9
  step: FindingLineageStage;
  identity: string;
  deterministicHash?: string;
  attributes: Record<string, unknown>;
}

export interface ResearchFindingLineage {
  findingId: string;
  runId: string;
  validationId: string;
  experimentId: string;
  corpusVersion: string;
  datasetVersion: string;
  sourceDocumentCount: number;
  sourceDocumentShas: string[];
  drawCount: number;
  drawIds: string[];
  chain: FindingLineageStep[];
  isComplete: boolean;
}

// ============================================================================
// 5. Publication-Grade Research Report (9D.7)
// ============================================================================

export interface PublicationReport {
  reportId: string;
  findingId: string;
  evidenceBundleId: string;
  title: string;
  abstract: string;
  claimType: ScientificClaimType;
  generatedAt: string;
  markdownContent: string;
  structuredJson: {
    finding: ResearchFinding;
    evidenceBundle: EvidenceBundle;
    lineage: ResearchFindingLineage;
  };
  deterministicHash: string;
}

// ============================================================================
// 6. Identity Derivation Helpers
// ============================================================================

import { computeSha256Short } from "./types";

export function deriveFindingId(findingData: {
  runId: string;
  validationId: string;
  claimType: ScientificClaimType;
  methodology: string;
}): string {
  const seed = `${findingData.runId}:${findingData.validationId}:${findingData.claimType}:${findingData.methodology}`;
  return `find_${computeSha256Short(seed)}`;
}

export function deriveEvidenceBundleId(bundleData: {
  findingId: string;
  validationId: string;
  corpusVersion: string;
  datasetVersion: string;
}): string {
  const seed = `${bundleData.findingId}:${bundleData.validationId}:${bundleData.corpusVersion}:${bundleData.datasetVersion}`;
  return `evb_${computeSha256Short(seed)}`;
}
