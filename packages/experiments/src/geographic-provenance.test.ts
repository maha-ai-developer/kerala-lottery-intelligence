/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 10A: Geographic Provenance & Ticket Distribution Test Suite
 */

import { describe, it, expect } from "vitest";
import {
  normalizeLocationToDistrict,
  KERALA_OFFICIAL_DISTRICTS,
  KERALA_LOTTERY_OFFICES
} from "./district-normalization";
import {
  GeographicExtractionEngine
} from "./geographic-extraction-engine";
import {
  GeographicAnalysisEngine
} from "./geographic-analysis-engine";
import {
  GeographicRepository
} from "./geographic-repository";
import {
  computeGeographicObservationHash,
  deriveGeographicObservationId,
  computeExposureHash,
  type GeographicObservation,
  type TicketDistributionExposure
} from "./geographic-types";

describe("Milestone 10A — Geographic Provenance & Ticket Distribution", () => {
  const analysisEngine = new GeographicAnalysisEngine();
  const repo = new GeographicRepository();

  // ==========================================================================
  // 1. Authoritative District Normalization
  // ==========================================================================
  describe("District Normalization & Authority Mapping", () => {
    it("should correctly define all 14 official Kerala revenue districts", () => {
      expect(KERALA_OFFICIAL_DISTRICTS).toHaveLength(14);
      expect(KERALA_OFFICIAL_DISTRICTS).toContain("Thiruvananthapuram");
      expect(KERALA_OFFICIAL_DISTRICTS).toContain("Kasaragod");
      expect(KERALA_OFFICIAL_DISTRICTS).toContain("Palakkad");
    });

    it("should register all 35 official Kerala State Lotteries DLO and SLO offices", () => {
      const keys = Object.keys(KERALA_LOTTERY_OFFICES);
      expect(keys.length).toBe(35);
      const dlos = keys.filter(k => KERALA_LOTTERY_OFFICES[k]?.officeType === "DISTRICT_LOTTERY_OFFICE");
      const slos = keys.filter(k => KERALA_LOTTERY_OFFICES[k]?.officeType === "SUB_LOTTERY_OFFICE");
      expect(dlos.length).toBe(14);
      expect(slos.length).toBe(21);
    });

    it("should normalize explicit direct district names with 1.0 confidence", () => {
      const norm = normalizeLocationToDistrict("PALAKKAD");
      expect(norm.normalizedDistrict).toBe("Palakkad");
      expect(norm.officeType).toBe("DISTRICT_LOTTERY_OFFICE");
      expect(norm.normalizationRule).toBe("EXPLICIT_DISTRICT_MATCH");
      expect(norm.confidence).toBe(1.0);
    });

    it("should normalize sub-lottery offices to parent districts with administrative rule", () => {
      const payyanur = normalizeLocationToDistrict("PAYYANUR");
      expect(payyanur.normalizedDistrict).toBe("Kannur");
      expect(payyanur.officeType).toBe("SUB_LOTTERY_OFFICE");
      expect(payyanur.normalizationRule).toBe("OFFICIAL_SUB_LOTTERY_OFFICE_TO_DISTRICT_MAP");

      const karunagapally = normalizeLocationToDistrict("KARUNAGAPALLY");
      expect(karunagapally.normalizedDistrict).toBe("Kollam");

      const vadakara = normalizeLocationToDistrict("VADAKARA");
      expect(vadakara.normalizedDistrict).toBe("Kozhikode");

      const attingal = normalizeLocationToDistrict("ATTINGAL");
      expect(attingal.normalizedDistrict).toBe("Thiruvananthapuram");

      const kanhangad = normalizeLocationToDistrict("KANHANGAD");
      expect(kanhangad.normalizedDistrict).toBe("Kasaragod");
    });

    it("should handle spelling variations from gazette PDFs", () => {
      const kozhikode = normalizeLocationToDistrict("KOZHIKKODE");
      expect(kozhikode.normalizedDistrict).toBe("Kozhikode");

      const wayanad = normalizeLocationToDistrict("WAYANADU");
      expect(wayanad.normalizedDistrict).toBe("Wayanad");

      const tirur = normalizeLocationToDistrict("THIRUR");
      expect(tirur.normalizedDistrict).toBe("Malappuram");

      const vaikom = normalizeLocationToDistrict("VAIKKOM");
      expect(vaikom.normalizedDistrict).toBe("Kottayam");
    });

    it("should strictly fail closed and return UNKNOWN for unrecognized locations", () => {
      const unknown = normalizeLocationToDistrict("MUMBAI");
      expect(unknown.normalizedDistrict).toBe("UNKNOWN");
      expect(unknown.confidence).toBe(0.0);
      expect(unknown.normalizationRule).toBe("UNRECOGNIZED_LOCATION_FAIL_CLOSED");

      const empty = normalizeLocationToDistrict("");
      expect(empty.normalizedDistrict).toBe("UNKNOWN");
    });
  });

  // ==========================================================================
  // 2. Canonical 103-PDF Extraction Verification
  // ==========================================================================
  describe("Canonical 103-PDF Extraction Engine", () => {
    it("should enumerate exactly 103 canonical result PDF files", () => {
      const engine = new GeographicExtractionEngine();
      const files = engine.enumerateCanonicalPdfFiles();
      expect(files).toHaveLength(103);
    });

    it("should load the cached canonical GeographicWinnerDataset with exact numbers", () => {
      const dataset = repo.getGeographicDataset();
      expect(dataset).not.toBeNull();
      if (!dataset) return;

      expect(dataset.sourceDocumentCount).toBe(103);
      expect(dataset.drawCount).toBe(103);
      expect(dataset.resultCount).toBe(39550);
      expect(dataset.geographicObservationCount).toBe(380);
      expect(dataset.explicitDistrictCount).toBe(196);
      expect(dataset.derivedDistrictCount).toBe(184);
      expect(dataset.unknownCount).toBe(0);
      expect(dataset.conflictCount).toBe(0);
      expect(dataset.suffixObservationsWithoutGeography).toBe(39170);
      expect(dataset.observations).toHaveLength(380);
    });

    it("should preserve exact source page, series, number, and raw location", () => {
      const dataset = repo.getGeographicDataset();
      expect(dataset).not.toBeNull();
      if (!dataset) return;

      const sample = dataset.observations[0];
      expect(sample).toBeDefined();
      if (!sample) return;

      expect(sample.drawId).toMatch(/^draw_[A-Za-z0-9\-]+$/);
      expect(sample.series).toMatch(/^[A-Z]{2}$/);
      expect(sample.winningNumber).toMatch(/^\d{6}$/);
      expect(sample.rawLocation).toBeTruthy();
      expect(sample.sourceDocumentSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(sample.sourcePage).toBeGreaterThanOrEqual(1);
      expect(sample.deterministicHash).toMatch(/^[a-f0-9]{64}$/);
      expect(sample.observationId).toMatch(/^geo_[a-f0-9]{16}$/);
    });
  });

  // ==========================================================================
  // 3. Mathematical Corpus Reconciliation & Semantic Breakdown
  // ==========================================================================
  describe("Mathematical Corpus Reconciliation & Scheme Semantics", () => {
    it("should reconcile exact tickets, consolation, and suffix prizes to 39,550", () => {
      const dataset = repo.getGeographicDataset();
      expect(dataset).not.toBeNull();
      if (!dataset) return;

      const exactCount = dataset.geographicObservationCount; // 380
      const nonGeoCount = dataset.suffixObservationsWithoutGeography; // 39,170
      expect(exactCount + nonGeoCount).toBe(39550);
    });

    it("should verify 1st prize location published for all 103 draws", () => {
      const dataset = repo.getGeographicDataset();
      expect(dataset).not.toBeNull();
      if (!dataset) return;

      const firstPrizeObs = dataset.observations.filter(o => o.prizeTier.toLowerCase().includes("1st"));
      expect(firstPrizeObs).toHaveLength(103);
    });
  });

  // ==========================================================================
  // 4. Ticket Exposure Denominator Guard & Statistical Safety
  // ==========================================================================
  describe("Ticket Exposure & Critical Denominator Guard", () => {
    it("should report EXPOSURE_UNAVAILABLE when ticket exposure is not provided", () => {
      const dataset = repo.getGeographicDataset();
      expect(dataset).not.toBeNull();
      if (!dataset) return;

      const analysis = analysisEngine.generateGeographicAnalysis({
        observations: dataset.observations
      });

      expect(analysis.exposureStatus).toBe("UNAVAILABLE");
      expect(analysis.hypothesisStatement).toContain("EXPOSURE_UNAVAILABLE");
      expect(analysis.exposureShare).toBeUndefined();
      expect(analysis.expectedWinners).toBeUndefined();
      expect(analysis.chiSquareStat).toBeUndefined();
      expect(analysis.limitations.length).toBeGreaterThan(0);
    });

    it("should compute expected winners and residuals when valid exposure is provided", () => {
      const dataset = repo.getGeographicDataset();
      expect(dataset).not.toBeNull();
      if (!dataset) return;

      // Create a mock uniform exposure across 14 districts
      const mockExposure: TicketDistributionExposure[] = KERALA_OFFICIAL_DISTRICTS.map(d => ({
        exposureId: `expo_${d}`,
        drawId: "draw_ALL",
        lotteryId: "ALL",
        series: null,
        geographicField: "ticketIssueDistrict",
        geographicValue: d,
        normalizedDistrict: d,
        ticketsIssued: 100000,
        ticketsSold: 90000,
        ticketsUnsold: 10000,
        exposureStatus: "AVAILABLE",
        sourceRef: "TEST_MOCK_AUDIT",
        sourceAuthority: "KERALA_LOTTERIES_DEPARTMENT",
        sourceType: "ADMINISTRATIVE_RULE",
        provenanceStatus: "VERIFIED_OFFICIAL",
        confidence: 1.0,
        deterministicHash: computeExposureHash({
          drawId: "draw_ALL",
          lotteryId: "ALL",
          series: null,
          geographicField: "ticketIssueDistrict",
          geographicValue: d,
          normalizedDistrict: d,
          ticketsIssued: 100000,
          ticketsSold: 90000,
          ticketsUnsold: 10000,
          exposureStatus: "AVAILABLE",
          sourceRef: "TEST_MOCK_AUDIT",
          sourceAuthority: "KERALA_LOTTERIES_DEPARTMENT",
          sourceType: "ADMINISTRATIVE_RULE",
          provenanceStatus: "VERIFIED_OFFICIAL",
          confidence: 1.0
        })
      }));

      const analysis = analysisEngine.generateGeographicAnalysis({
        observations: dataset.observations,
        exposureData: mockExposure
      });

      expect(analysis.exposureStatus).toBe("AVAILABLE");
      expect(analysis.exposureShare).toBeDefined();
      expect(analysis.expectedWinners).toBeDefined();
      expect(analysis.residuals).toBeDefined();
      expect(analysis.standardizedResiduals).toBeDefined();
      expect(analysis.chiSquareStat).toBeDefined();
      expect(typeof analysis.chiSquareStat).toBe("number");
    });
  });

  // ==========================================================================
  // 5. Anti-Prediction & Scientific Limitation Guardrails
  // ==========================================================================
  describe("Anti-Prediction & Guardrails", () => {
    it("should throw error if prohibited gambling/predictive terms are present", () => {
      expect(() => {
        analysisEngine.assertNonPredictiveStatement("This is a lucky district for betting.");
      }).toThrow(/ANTI-PREDICTION VIOLATION/);

      expect(() => {
        analysisEngine.assertNonPredictiveStatement("The hot district with highest winning probability.");
      }).toThrow(/ANTI-PREDICTION VIOLATION/);

      expect(() => {
        analysisEngine.assertNonPredictiveStatement("Calculate best district prediction score.");
      }).toThrow(/ANTI-PREDICTION VIOLATION/);
    });

    it("should accept valid objective descriptive statements", () => {
      expect(() => {
        analysisEngine.assertNonPredictiveStatement(
          "Palakkad had 61 observed major prize winners in the historical 103-draw corpus."
        );
      }).not.toThrow();
    });
  });

  // ==========================================================================
  // 6. 11-Stage Lineage DAG Construction
  // ==========================================================================
  describe("11-Stage Geographic Lineage DAG", () => {
    it("should build a complete unbroken 11-stage lineage chain", () => {
      const lineage = analysisEngine.buildGeographicLineage({
        findingId: "find_geo_palakkad_baseline",
        sourceDocumentSha256: "047ddf6d895529f55e5c70bb5dfd974be4a22ad395b28a8ab52157155fb21c7a",
        drawId: "draw_2254",
        prizeSchemeId: "SCHEME_BT_62",
        prizeTier: "1st",
        winningResultId: "result_BP_540430",
        observationId: "geo_test_obs",
        exposureStatus: "UNAVAILABLE",
        analysisId: "geoanalysis_test",
        validationId: "val_test",
        evidenceBundleId: "evb_test"
      });

      expect(lineage.totalStages).toBe(11);
      expect(lineage.stages).toHaveLength(11);
      expect(lineage.stages[0]?.stage).toBe("SOURCE_DOCUMENT");
      expect(lineage.stages[6]?.stage).toBe("TICKET_EXPOSURE");
      expect(lineage.stages[6]?.status).toBe("UNAVAILABLE");
      expect(lineage.stages[10]?.stage).toBe("EVIDENCE_BUNDLE");
      expect(lineage.deterministicHash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  // ==========================================================================
  // 7. Repository & Deterministic Hash Integrity
  // ==========================================================================
  describe("Repository & Hash Determinism", () => {
    it("should compute deterministic hash for identical observation payloads", () => {
      const samplePayload: Omit<GeographicObservation, "observationId" | "deterministicHash"> = {
        drawId: "draw_2254",
        lotteryId: "BHAGYATHARA",
        lotteryCode: "BT",
        drawNumber: "2254",
        drawDate: "13/07/2026",
        prizeTier: "1st",
        series: "BP",
        winningNumber: "540430",
        resultType: "EXACT_TICKET",
        geographicField: "issueOffice",
        rawLocation: "PALAKKAD",
        normalizedLocation: "PALAKKAD",
        normalizedDistrict: "Palakkad",
        sourceDocumentSha256: "047ddf6d895529f55e5c70bb5dfd974be4a22ad395b28a8ab52157155fb21c7a",
        canonicalFilename: "271-2254-13-07-2026.pdf",
        sourcePage: 1,
        sourceText: "1st Prize Rs :10000000/- 1) BP 540430 (PALAKKAD)",
        sourceType: "PDF_PRIMARY_EVIDENCE",
        authority: "KERALA_STATE_LOTTERIES_DEPARTMENT",
        extractionMethod: "PDF_REGEX_SPATIAL_V1",
        normalizationRule: "EXPLICIT_DISTRICT_MATCH",
        confidence: 1.0,
        provenanceStatus: "VERIFIED_OFFICIAL",
        createdAt: "2026-10-02T12:00:00.000Z"
      };

      const hash1 = computeGeographicObservationHash(samplePayload);
      const hash2 = computeGeographicObservationHash(samplePayload);
      expect(hash1).toBe(hash2);
      expect(deriveGeographicObservationId(hash1)).toBe(deriveGeographicObservationId(hash2));
    });
  });
});
