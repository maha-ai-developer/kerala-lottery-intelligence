/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 10A: Ticket Distribution, Winning Geography & Geographic Provenance Contracts
 *
 * Grounding:
 * - 103-draw canonical research corpus (39,550 winning results)
 * - 100-draw production corpus (38,416 winning results) - decoupled
 * - 14 Official Revenue Districts of Kerala
 * - 35 Kerala State Lotteries District (14) & Sub-Lottery (21) Offices
 *
 * Strict Scientific Boundary:
 * - ZERO predictive claims, gambling recommendation, lucky/hot districts, or betting scores.
 * - Winner counts reflect observed occurrences; without ticket exposure data (eligible tickets sold),
 *   district winning probabilities CANNOT be computed.
 */

import { computeSha256 } from "./types";

// ============================================================================
// 1. Core Geographic Concepts & Provenance Status
// ============================================================================

export type GeographicProvenanceStatus =
  | "VERIFIED_OFFICIAL"
  | "VERIFIED_SECONDARY"
  | "CONFLICTING"
  | "UNVERIFIED"
  | "UNKNOWN"
  | "NOT_PRESENT_IN_SOURCE";

export type GeographicSourceType =
  | "PDF_PRIMARY_EVIDENCE"
  | "EXTERNAL_SECONDARY_EVIDENCE"
  | "ADMINISTRATIVE_RULE";

export type WinningResultClassification =
  | "EXACT_TICKET"
  | "CONSOLATION"
  | "SUFFIX_CLASS";

export type ExposureStatus =
  | "AVAILABLE"
  | "PARTIAL"
  | "UNAVAILABLE";

/**
 * 14 Official Revenue Districts of Kerala.
 */
export const KERALA_OFFICIAL_DISTRICTS = [
  "Thiruvananthapuram",
  "Kollam",
  "Pathanamthitta",
  "Alappuzha",
  "Kottayam",
  "Idukki",
  "Ernakulam",
  "Thrissur",
  "Palakkad",
  "Malappuram",
  "Kozhikode",
  "Wayanad",
  "Kannur",
  "Kasaragod"
] as const;

export type KeralaDistrict = (typeof KERALA_OFFICIAL_DISTRICTS)[number];

/**
 * Explicit separation of geographic concepts (Requirement 10A.6).
 * These must never be collapsed into a single generic 'district' field.
 */
export interface GeographicConceptSeparation {
  agentRegistrationDistrict?: string;
  ticketIssueDistrict?: string;
  issueOffice?: string;
  saleLocation?: string;
  publishedWinnerLocation?: string;
  winnerClaimLocation?: string;
}

// ============================================================================
// 2. District Normalization Contract
// ============================================================================

export interface DistrictNormalization {
  rawLocation: string;
  normalizedLocation: string;
  normalizedDistrict: KeralaDistrict | "UNKNOWN" | "AMBIGUOUS";
  officeType?: "DISTRICT_LOTTERY_OFFICE" | "SUB_LOTTERY_OFFICE" | "UNKNOWN";
  normalizationRule: string;
  normalizationSource: string;
  confidence: number;
}

// ============================================================================
// 3. Geographic Observation Contract (Requirement 10A.7)
// ============================================================================

export interface GeographicObservation {
  observationId: string; // Deterministic: `geo_${hash}`

  // Draw and result linkage
  drawId: string;
  lotteryId: string;
  lotteryCode: string;
  drawNumber: string;
  drawDate: string; // DD/MM/YYYY
  prizeTier: string; // e.g. "1st", "2nd", "3rd", "4th", "Consolation"
  series: string | null;
  winningNumber: string;
  resultType: WinningResultClassification;

  // Geographic fields
  geographicField: "publishedWinnerLocation" | "issueOffice" | "none";
  rawLocation: string | null;
  normalizedLocation: string | null;
  normalizedDistrict: KeralaDistrict | "UNKNOWN" | "AMBIGUOUS" | "NOT_PRESENT";

  // Provenance & Source Evidence
  sourceDocumentSha256: string;
  canonicalFilename: string;
  sourcePage: number;
  sourceText: string;
  sourceType: GeographicSourceType;
  authority: string;
  extractionMethod: string;
  normalizationRule: string | null;

  confidence: number;
  provenanceStatus: GeographicProvenanceStatus;

  createdAt: string;
  deterministicHash: string;
}

// ============================================================================
// 4. Winning Ticket Geography Contract (Requirement 10A.11)
// ============================================================================

export interface WinningTicketGeography {
  geographyId: string; // Deterministic: `wtgeo_${hash}`
  drawId: string;
  lotteryId: string;
  prizeTier: string;
  series: string | null;
  winningNumber: string;
  resultType: WinningResultClassification;

  geographicField: string;
  geographicValue: string;
  normalizedDistrict: KeralaDistrict;

  sourceRef: string; // source document SHA + page
  sourceType: GeographicSourceType;
  authority: string;

  extractionMethod: string;
  confidence: number;
  provenanceStatus: GeographicProvenanceStatus;

  createdAt: string;
  deterministicHash: string;
}

// ============================================================================
// 5. Ticket Distribution & Exposure Contract (Requirement 10A.12)
// ============================================================================

export interface TicketDistributionExposure {
  exposureId: string; // Deterministic: `expo_${hash}`

  drawId: string;
  lotteryId: string;
  series: string | null;

  geographicField: "ticketIssueDistrict" | "issueOffice" | "agentDistrict";
  geographicValue: string;
  normalizedDistrict: KeralaDistrict;

  ticketsIssued: number | null;
  ticketsSold: number | null;
  ticketsUnsold: number | null;

  exposureStatus: ExposureStatus;

  sourceRef: string | null;
  sourceAuthority: string | null;
  sourceType: GeographicSourceType | null;

  provenanceStatus: GeographicProvenanceStatus;
  confidence: number;

  deterministicHash: string;
}

// ============================================================================
// 6. Geographic Winner Dataset (Requirement 10A.15)
// ============================================================================

export interface GeographicWinnerDataset {
  datasetId: string; // Deterministic: `geowin_${hash}`
  sourceCorpusVersion: string;
  sourceDocumentCount: number; // 103
  drawCount: number; // 103
  resultCount: number; // 39,550

  // Coverage statistics
  geographicObservationCount: number; // observations extracted (380 in 103-PDF corpus)
  explicitDistrictCount: number; // published as direct district name
  derivedDistrictCount: number; // derived from official sub-lottery office
  unknownCount: number;
  ambiguousCount: number;
  conflictCount: number;
  suffixObservationsWithoutGeography: number; // 39,170 suffix/consolation rows

  observations: GeographicObservation[];
  deterministicHash: string;
  createdAt: string;
}

// ============================================================================
// 7. District Summary & Aggregation Views (Requirement 10A.17, 10A.18)
// ============================================================================

export interface DistrictSummaryRecord {
  district: KeralaDistrict;
  explicitPdfObservations: number;
  derivedObservations: number;
  totalObservedWinners: number;
  byPrizeTier: {
    firstPrize: number;
    consolation: number;
    secondPrize: number;
    thirdPrize: number;
    fourthPrize: number;
    fifthPrize: number;
    sixthThroughNinth: number;
  };
  byLottery: Record<string, number>;
  earliestDrawDate: string;
  latestDrawDate: string;
}

// ============================================================================
// 8. Geographic Statistical Analysis Contract (Requirements 10A.20-22)
// ============================================================================

export interface GeographicAnalysis {
  analysisId: string; // Deterministic: `geoanalysis_${hash}`
  exposureStatus: ExposureStatus; // Currently "UNAVAILABLE" for public gazette data
  hypothesisStatement: string;
  totalObservedMajorWinners: number; // e.g. 380
  districtSummaries: DistrictSummaryRecord[];

  // Statistical calculations (only populated when exposure is AVAILABLE)
  exposureShare?: Record<KeralaDistrict, number>;
  expectedWinners?: Record<KeralaDistrict, number>;
  residuals?: Record<KeralaDistrict, number>;
  standardizedResiduals?: Record<KeralaDistrict, number>;
  chiSquareStat?: number;
  pValue?: number;

  limitations: string[];
  nonPredictiveNotice: string;
  createdAt: string;
  deterministicHash: string;
}

// ============================================================================
// 9. 11-Stage Lineage Contract (Requirement 10A.28)
// ============================================================================

export type GeographicLineageStage =
  | "SOURCE_DOCUMENT"
  | "DRAW"
  | "PRIZE_SCHEME"
  | "PRIZE_TIER"
  | "WINNING_RESULT"
  | "GEOGRAPHIC_OBSERVATION"
  | "TICKET_EXPOSURE"
  | "GEOGRAPHIC_ANALYSIS"
  | "VALIDATION"
  | "FINDING"
  | "EVIDENCE_BUNDLE";

export interface GeographicLineageStep {
  stage: GeographicLineageStage;
  stageOrder: number; // 1 to 11
  nodeId: string;
  nodeType: string;
  status: "CONFIRMED" | "UNAVAILABLE" | "DERIVED";
  hash: string;
  summary: string;
  metadata?: Record<string, any>;
}

export interface GeographicFindingLineage {
  lineageId: string; // `geolineage_${hash}`
  findingId: string;
  observationId?: string;
  exposureStatus: ExposureStatus;
  totalStages: number; // 11
  stages: GeographicLineageStep[];
  deterministicHash: string;
  createdAt: string;
}

// ============================================================================
// 10. Hash Computation Utilities
// ============================================================================

export function computeGeographicObservationHash(obs: Omit<GeographicObservation, "observationId" | "deterministicHash">): string {
  const payload = [
    obs.drawId,
    obs.lotteryCode,
    obs.prizeTier,
    obs.series ?? "",
    obs.winningNumber,
    obs.resultType,
    obs.rawLocation ?? "",
    obs.normalizedDistrict,
    obs.sourceDocumentSha256,
    obs.sourcePage.toString(),
    obs.sourceText,
    obs.provenanceStatus
  ].join("::");
  return computeSha256(payload);
}

export function deriveGeographicObservationId(hash: string): string {
  return `geo_${hash.slice(0, 16)}`;
}

export function computeExposureHash(expo: Omit<TicketDistributionExposure, "exposureId" | "deterministicHash">): string {
  const payload = [
    expo.drawId,
    expo.lotteryId,
    expo.series ?? "",
    expo.normalizedDistrict,
    expo.exposureStatus,
    expo.ticketsIssued?.toString() ?? "null",
    expo.ticketsSold?.toString() ?? "null"
  ].join("::");
  return computeSha256(payload);
}

export function deriveExposureId(hash: string): string {
  return `expo_${hash.slice(0, 16)}`;
}

export function computeGeographicDatasetHash(dataset: Omit<GeographicWinnerDataset, "datasetId" | "deterministicHash">): string {
  const payload = [
    dataset.sourceCorpusVersion,
    dataset.sourceDocumentCount.toString(),
    dataset.drawCount.toString(),
    dataset.resultCount.toString(),
    dataset.geographicObservationCount.toString(),
    dataset.observations.map(o => o.deterministicHash).sort().join(",")
  ].join("::");
  return computeSha256(payload);
}

export function deriveGeographicDatasetId(hash: string): string {
  return `geowin_${hash.slice(0, 16)}`;
}
