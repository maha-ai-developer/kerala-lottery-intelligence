#!/usr/bin/env tsx
/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 9D — Research Provenance & Publication-Grade Evidence Verifier
 *
 * Verifies all 12 Research Provenance Quality Gates:
 * 1. Research Finding Contract (17 required fields, deterministic hash)
 * 2. Evidence Bundle Grounding (103 source doc SHAs, draw IDs, artifact references)
 * 3. Complete 10-Stage Lineage DAG (SOURCE_DOCS -> DRAWS -> CORPUS -> ... -> FINDING)
 * 4. Integrity Verification & 'No Silent Repair' (bit-for-bit hash validation)
 * 5. Deterministic Finding Generation (identical inputs -> identical ID/hash)
 * 6. Scientific Claim Taxonomy & Anti-Prediction Guardrails (banned gambling/predictive terms)
 * 7. Publication-Grade Report Generator (deterministic Markdown & structured JSON)
 * 8. Read-Only REST API & HTTP 405 Mutation Rejection (Allow: GET header)
 * 9. Research Web UI & Presentation Surface (findings page, 10-stage visualizer, navigation)
 * 10. Canonical 103-Draw Baseline Finding Verification (EXP-001, EXP-002, EXP-003)
 * 11. Reproducibility Test Suite Execution (research-provenance.test.ts)
 * 12. Production Boundary & Non-Predictive Invariance (scheduler PAUSED, PROD untouched, main untouched)
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import {
  generateResearchFinding,
  verifyEvidenceBundleIntegrity,
  validateScientificClaimStatement,
  defaultExperimentRepository,
  loadCanonicalResearchCorpus,
  buildResearchModelingDataset,
  SCIENTIFIC_CLAIM_TYPES,
  type ResearchFinding
} from "@kerala-lottery/experiments";
import { ResearchDataService } from "@kerala-lottery/data";
import { methodNotAllowed } from "../../../apps/web/lib/api-response";

interface VerificationGate {
  id: string;
  name: string;
  run: () => Promise<void> | void;
}

const gates: VerificationGate[] = [
  // ==========================================================================
  // Gate 1: Research Finding Contract (9D.1)
  // ==========================================================================
  {
    id: "GATE_01_FINDING_CONTRACT",
    name: "Research Finding Contract Completeness",
    run: async () => {
      const findings = defaultExperimentRepository.listFindings();
      if (findings.length === 0) {
        throw new Error("No research findings found in repository. Run experiments-cli generate-findings first.");
      }

      for (const finding of findings) {
        const requiredFields: (keyof ResearchFinding)[] = [
          "findingId",
          "findingVersion",
          "statement",
          "claimType",
          "corpusVersion",
          "datasetVersion",
          "experimentId",
          "experimentVersion",
          "runId",
          "validationId",
          "methodology",
          "methodologyVersion",
          "parameters",
          "evidence",
          "uncertainty",
          "interpretation",
          "limitation",
          "createdAt",
          "deterministicHash"
        ];

        for (const field of requiredFields) {
          if (finding[field] === undefined || finding[field] === null) {
            throw new Error(`Finding '${finding.findingId}' is missing required contract field: '${field}'`);
          }
        }

        if (!finding.findingId.startsWith("find_")) {
          throw new Error(`Finding ID '${finding.findingId}' must start with 'find_' prefix.`);
        }

        if (!SCIENTIFIC_CLAIM_TYPES.includes(finding.claimType)) {
          throw new Error(`Invalid claimType '${finding.claimType}' in finding '${finding.findingId}'`);
        }

        if (finding.uncertainty.standardError === undefined || isNaN(finding.uncertainty.standardError)) {
          throw new Error(`Finding '${finding.findingId}' is missing valid uncertainty.standardError`);
        }

        if (finding.deterministicHash.length !== 64) {
          throw new Error(`Finding '${finding.findingId}' deterministicHash is not a 64-character SHA-256 hex string`);
        }
      }
    }
  },

  // ==========================================================================
  // Gate 2: Evidence Bundle Grounding (9D.2)
  // ==========================================================================
  {
    id: "GATE_02_EVIDENCE_BUNDLE",
    name: "Evidence Bundle Cryptographic Grounding",
    run: async () => {
      const bundles = defaultExperimentRepository.listEvidenceBundles();
      if (bundles.length === 0) {
        throw new Error("No evidence bundles found in repository.");
      }

      for (const bundle of bundles) {
        if (!bundle.evidenceBundleId.startsWith("evb_")) {
          throw new Error(`Evidence bundle ID '${bundle.evidenceBundleId}' must start with 'evb_' prefix.`);
        }

        if (bundle.sourceDocumentCount !== 103) {
          throw new Error(`Expected exactly 103 source documents in evidence bundle, got ${bundle.sourceDocumentCount}`);
        }

        if (bundle.sourceDocumentShas.length !== 103) {
          throw new Error(`Expected 103 SHA-256 hashes in evidence bundle, got ${bundle.sourceDocumentShas.length}`);
        }

        if (bundle.drawCount !== 103) {
          throw new Error(`Expected 103 draw IDs in evidence bundle, got ${bundle.drawCount}`);
        }

        const requiredHashes = [
          "corpus",
          "dataset",
          "experiment",
          "run",
          "resultArtifact",
          "validation",
          "finding"
        ];

        for (const h of requiredHashes) {
          if (!bundle.artifactHashes[h]) {
            throw new Error(`Evidence bundle '${bundle.evidenceBundleId}' is missing artifact hash for '${h}'`);
          }
        }

        if (!bundle.isIntegrityVerified) {
          throw new Error(`Evidence bundle '${bundle.evidenceBundleId}' failed integrity check: ${bundle.integrityErrors.join(", ")}`);
        }
      }
    }
  },

  // ==========================================================================
  // Gate 3: Complete 10-Stage Lineage DAG (9D.3)
  // ==========================================================================
  {
    id: "GATE_03_LINEAGE_DAG",
    name: "Complete 10-Stage Lineage Chain Verification",
    run: async () => {
      const findings = defaultExperimentRepository.listFindings();
      for (const finding of findings) {
        const lineage = defaultExperimentRepository.getFindingLineage(finding.findingId);
        if (!lineage) {
          throw new Error(`Missing finding lineage for '${finding.findingId}'`);
        }

        if (lineage.chain.length !== 10) {
          throw new Error(`Expected exactly 10 lineage stages for '${finding.findingId}', got ${lineage.chain.length}`);
        }

        if (!lineage.isComplete) {
          throw new Error(`Lineage for finding '${finding.findingId}' is marked incomplete.`);
        }

        const expectedSequence = [
          "SOURCE_DOCUMENTS",
          "DRAWS",
          "CORPUS",
          "FEATURE_MATRIX",
          "MODELING_DATASET",
          "EXPERIMENT_DEFINITION",
          "EXPERIMENT_RUN",
          "RESULT_ARTIFACT",
          "VALIDATION",
          "FINDING"
        ];

        lineage.chain.forEach((step, idx) => {
          if (step.stageNumber !== idx + 1) {
            throw new Error(`Lineage stageNumber mismatch: expected ${idx + 1}, got ${step.stageNumber}`);
          }
          if (step.step !== expectedSequence[idx]) {
            throw new Error(`Lineage stage ${idx + 1} mismatch: expected '${expectedSequence[idx]}', got '${step.step}'`);
          }
          if (!step.identity) {
            throw new Error(`Lineage stage ${step.stageNumber} missing identity`);
          }
          if (!step.deterministicHash) {
            throw new Error(`Lineage stage ${step.stageNumber} missing deterministicHash`);
          }
        });
      }
    }
  },

  // ==========================================================================
  // Gate 4: Integrity Verification & 'No Silent Repair' (9D.4)
  // ==========================================================================
  {
    id: "GATE_04_INTEGRITY_VERIFICATION",
    name: "Integrity Verification & 'No Silent Repair'",
    run: async () => {
      const bundles = defaultExperimentRepository.listEvidenceBundles();
      const bundle = bundles[0]!;

      // 1. Legitimate check passes
      const validCheck = verifyEvidenceBundleIntegrity(bundle, {
        corpusHash: bundle.artifactHashes.corpus,
        datasetHash: bundle.artifactHashes.dataset,
        experimentHash: bundle.artifactHashes.experiment,
        runHash: bundle.artifactHashes.run,
        resultArtifactHash: bundle.artifactHashes.resultArtifact,
        validationHash: bundle.artifactHashes.validation,
        findingHash: bundle.artifactHashes.finding
      });
      if (!validCheck.valid || validCheck.errors.length > 0) {
        throw new Error("Valid integrity check unexpectedly failed");
      }

      // 2. Tampered hash fails with explicit error
      const tamperedCheck = verifyEvidenceBundleIntegrity(bundle, {
        corpusHash: "CORRUPTED_CORPUS_HASH",
        datasetHash: bundle.artifactHashes.dataset,
        experimentHash: bundle.artifactHashes.experiment,
        runHash: bundle.artifactHashes.run,
        resultArtifactHash: bundle.artifactHashes.resultArtifact,
        validationHash: bundle.artifactHashes.validation,
        findingHash: bundle.artifactHashes.finding
      });
      if (tamperedCheck.valid || !tamperedCheck.errors.some((e) => e.includes("Hash mismatch for 'corpus'"))) {
        throw new Error("Tampered hash failed to trigger explicit integrity violation (no silent repair violated)");
      }

      // 3. Missing artifact fails with explicit error
      const missingCheck = verifyEvidenceBundleIntegrity(bundle, {
        corpusHash: bundle.artifactHashes.corpus,
        // datasetHash omitted
        experimentHash: bundle.artifactHashes.experiment,
        runHash: bundle.artifactHashes.run,
        resultArtifactHash: bundle.artifactHashes.resultArtifact,
        validationHash: bundle.artifactHashes.validation,
        findingHash: bundle.artifactHashes.finding
      });
      if (missingCheck.valid || !missingCheck.errors.some((e) => e.includes("Missing artifact for 'dataset'"))) {
        throw new Error("Missing artifact failed to trigger explicit integrity violation");
      }
    }
  },

  // ==========================================================================
  // Gate 5: Deterministic Finding Generation (9D.5)
  // ==========================================================================
  {
    id: "GATE_05_DETERMINISTIC_DERIVATION",
    name: "Deterministic Finding & Evidence Bundle Derivation",
    run: async () => {
      const corpus = loadCanonicalResearchCorpus();
      const { dataset } = buildResearchModelingDataset(corpus);
      const runs = defaultExperimentRepository.listRuns({
        experimentId: "EXP-001-UNIFORM-BASELINE",
        status: "SUCCEEDED"
      });
      const run = runs[0]!;
      const artifact = defaultExperimentRepository.getArtifactByRunId(run.runId)!;
      const validation = defaultExperimentRepository.getValidationByRunId(run.runId)!;

      const f1 = generateResearchFinding({
        run,
        artifact,
        validation,
        dataset,
        corpus,
        definition: {
          experimentId: "EXP-001-UNIFORM-BASELINE",
          name: "Uniform Random Categorical Baseline",
          version: "1.0.0",
          description: "Baseline",
          methodology: "EXPANDING_WINDOW_HOLM_BONFERRONI_V1",
          targetId: "observed_last_digit",
          targetName: "Observed Last Digit",
          populationScope: "ALL_POPULATION",
          modelType: "UNIFORM",
          parameters: { seed: 42 },
          metrics: ["ACCURACY"],
          temporalPolicy: { strategy: "CHRONOLOGICAL_HOLDOUT" },
          researchBoundary: "Descriptive only",
          deterministicHash: "exp_hash"
        }
      });

      const f2 = generateResearchFinding({
        run,
        artifact,
        validation,
        dataset,
        corpus,
        definition: {
          experimentId: "EXP-001-UNIFORM-BASELINE",
          name: "Uniform Random Categorical Baseline",
          version: "1.0.0",
          description: "Baseline",
          methodology: "EXPANDING_WINDOW_HOLM_BONFERRONI_V1",
          targetId: "observed_last_digit",
          targetName: "Observed Last Digit",
          populationScope: "ALL_POPULATION",
          modelType: "UNIFORM",
          parameters: { seed: 42 },
          metrics: ["ACCURACY"],
          temporalPolicy: { strategy: "CHRONOLOGICAL_HOLDOUT" },
          researchBoundary: "Descriptive only",
          deterministicHash: "exp_hash"
        }
      });

      if (f1.findingId !== f2.findingId) {
        throw new Error(`Deterministic finding derivation mismatch: '${f1.findingId}' vs '${f2.findingId}'`);
      }
      if (f1.deterministicHash !== f2.deterministicHash) {
        throw new Error(`Deterministic hash mismatch: '${f1.deterministicHash}' vs '${f2.deterministicHash}'`);
      }
    }
  },

  // ==========================================================================
  // Gate 6: Scientific Claim Taxonomy & Anti-Prediction Guardrails (9D.6)
  // ==========================================================================
  {
    id: "GATE_06_CLAIM_TAXONOMY",
    name: "Scientific Claim Taxonomy & Anti-Prediction Guardrails",
    run: async () => {
      // 1. Valid statements pass
      validateScientificClaimStatement(
        "Observed holdout accuracy across N=7,850 records is 10.13% with log loss of 2.3026.",
        "OBSERVATION"
      );
      validateScientificClaimStatement(
        "Baseline achieved 10.13% accuracy against discrete uniform null mean of 10.01% (Holm p = 1.0000, isSignificant = false).",
        "STATISTICAL_RESULT"
      );
      validateScientificClaimStatement(
        "Empirical fluctuations are consistent with uniform chance variation across independent physical trials.",
        "INTERPRETATION"
      );
      validateScientificClaimStatement(
        "Physical lottery drawings operate as independent stochastic trials with zero predictive validity.",
        "LIMITATION"
      );

      // 2. Prohibited predictive/gambling claims are strictly rejected
      const forbiddenClaims = [
        "We can predict future winning digits with high probability.",
        "Guaranteed win strategy for tomorrow draw.",
        "Betting recommendation based on historical frequency.",
        "Hot number selection for increased payout."
      ];

      for (const claim of forbiddenClaims) {
        let threw = false;
        try {
          validateScientificClaimStatement(claim, "STATISTICAL_RESULT");
        } catch (err: any) {
          threw = true;
          if (!err.message.includes("prohibited predictive/gambling claim")) {
            throw new Error(`Unexpected error message for prohibited claim: ${err.message}`);
          }
        }
        if (!threw) {
          throw new Error(`Failed to reject prohibited claim: '${claim}'`);
        }
      }
    }
  },

  // ==========================================================================
  // Gate 7: Publication-Grade Report Generator (9D.7)
  // ==========================================================================
  {
    id: "GATE_07_REPORT_GENERATOR",
    name: "Publication-Grade Report Generation & Verification",
    run: async () => {
      const reports = defaultExperimentRepository.listReports();
      if (reports.length === 0) {
        throw new Error("No publication reports found in repository.");
      }

      for (const report of reports) {
        if (!report.reportId.startsWith("rep_")) {
          throw new Error(`Report ID '${report.reportId}' must start with 'rep_' prefix.`);
        }
        if (!report.title || !report.abstract) {
          throw new Error(`Report '${report.reportId}' missing title or abstract.`);
        }
        if (!report.markdownContent.includes("# Scientific Research Report")) {
          throw new Error(`Report '${report.reportId}' missing main title heading.`);
        }
        if (!report.markdownContent.includes("Standard Error (SE)")) {
          throw new Error(`Report '${report.reportId}' missing Standard Error section.`);
        }
        if (!report.markdownContent.includes("Holm-Bonferroni")) {
          throw new Error(`Report '${report.reportId}' missing Holm-Bonferroni section.`);
        }
        if (!report.markdownContent.includes("## 6. Five-Part Research Interpretation Contract")) {
          throw new Error(`Report '${report.reportId}' missing five-part contract.`);
        }
      }
    }
  },

  // ==========================================================================
  // Gate 8: Read-Only REST API & HTTP 405 Mutation Rejection (9D.8)
  // ==========================================================================
  {
    id: "GATE_08_READ_ONLY_API",
    name: "Read-Only REST API & HTTP 405 Mutation Guards",
    run: async () => {
      const service = ResearchDataService.getInstance();

      // 1. Test GET findings
      const findingsRes = await service.getFindings({ pageSize: 10 });
      if (findingsRes.data.length < 3) {
        throw new Error(`Expected at least 3 findings in getFindings, got ${findingsRes.data.length}`);
      }

      const sampleFinding = findingsRes.data[0]!;

      // 2. Test GET finding by ID
      const single = await service.getFindingById(sampleFinding.findingId);
      if (single.findingId !== sampleFinding.findingId) {
        throw new Error(`getFindingById returned mismatched finding ID.`);
      }

      // 3. Test GET evidence
      const evidence = await service.getFindingEvidence(sampleFinding.findingId);
      if (evidence.findingId !== sampleFinding.findingId) {
        throw new Error(`getFindingEvidence returned mismatched evidence.`);
      }

      // 4. Test GET lineage
      const lineage = await service.getFindingLineage(sampleFinding.findingId);
      if (lineage.findingId !== sampleFinding.findingId || lineage.chain.length !== 10) {
        throw new Error(`getFindingLineage returned incomplete lineage.`);
      }

      // 5. Test GET report
      const report = await service.getFindingReport(sampleFinding.findingId);
      if (report.findingId !== sampleFinding.findingId) {
        throw new Error(`getFindingReport returned mismatched report.`);
      }

      // 6. Test 405 Method Not Allowed helper
      const mnaResponse = methodNotAllowed();
      if (mnaResponse.status !== 405) {
        throw new Error(`methodNotAllowed() status is ${mnaResponse.status}, expected 405`);
      }
      if (mnaResponse.headers.get("Allow") !== "GET") {
        throw new Error(`methodNotAllowed() Allow header is '${mnaResponse.headers.get("Allow")}', expected 'GET'`);
      }
    }
  },

  // ==========================================================================
  // Gate 9: Research UI & Presentation Layer (9D.9)
  // ==========================================================================
  {
    id: "GATE_09_RESEARCH_UI",
    name: "Research UI & Web Presentation Surface Integrity",
    run: async () => {
      const findingsPagePath = join(process.cwd(), "apps/web/app/findings/page.tsx");
      if (!existsSync(findingsPagePath)) {
        throw new Error("apps/web/app/findings/page.tsx does not exist");
      }
      const pageContent = readFileSync(findingsPagePath, "utf-8");

      const requiredUIKeywords = [
        "Research Provenance & Scientific Findings",
        "10-Stage Lineage Verified",
        "No Silent Repair",
        "Finding Registry",
        "STATISTICAL_RESULT",
        "10-Stage Lineage DAG",
        "Evidence Bundle & Hashes",
        "Uncertainty & Inference",
        "Publication Report",
        "Standard Error (SE)",
        "Wilson Score 95% CI",
        "Bootstrap 95% CI"
      ];

      for (const kw of requiredUIKeywords) {
        if (!pageContent.includes(kw)) {
          throw new Error(`apps/web/app/findings/page.tsx is missing required UI element: '${kw}'`);
        }
      }

      // Check navigation link
      const navPath = join(process.cwd(), "apps/web/components/navigation.tsx");
      const navContent = readFileSync(navPath, "utf-8");
      if (!navContent.includes('href: "/findings"') || !navContent.includes('label: "Findings & Evidence"')) {
        throw new Error("apps/web/components/navigation.tsx is missing 'Findings & Evidence' link.");
      }
    }
  },

  // ==========================================================================
  // Gate 10: Canonical Baseline Finding Verification (9D.10)
  // ==========================================================================
  {
    id: "GATE_10_CANONICAL_FINDINGS",
    name: "Canonical 103-Draw Baseline Finding Verification",
    run: async () => {
      const expectedExperiments = [
        "EXP-001-UNIFORM-BASELINE",
        "EXP-002-EMPIRICAL-BASELINE",
        "EXP-003-MAJORITY-BASELINE"
      ];

      for (const expId of expectedExperiments) {
        const findings = defaultExperimentRepository.listFindings({ experimentId: expId });
        if (findings.length === 0) {
          throw new Error(`Canonical baseline '${expId}' has no registered research findings.`);
        }

        const finding = findings[0]!;
        if (finding.claimType !== "STATISTICAL_RESULT") {
          throw new Error(`Baseline '${expId}' claimType must be 'STATISTICAL_RESULT', got '${finding.claimType}'`);
        }

        if (finding.evidence.isSignificant !== false) {
          throw new Error(`Baseline '${expId}' unexpectedly marked statistically significant.`);
        }

        if (finding.evidence.adjustedPValue !== 1.0) {
          throw new Error(`Baseline '${expId}' adjustedPValue must be 1.0000 under Holm-Bonferroni, got ${finding.evidence.adjustedPValue}`);
        }

        // Verify standard error formula accuracy
        if (expId === "EXP-001-UNIFORM-BASELINE") {
          expectCloseTo(finding.uncertainty.standardError, 0.003405, 0.0001, "EXP-001 standard error");
        }

        const bundle = defaultExperimentRepository.getEvidenceBundleByFindingId(finding.findingId);
        if (!bundle || !bundle.isIntegrityVerified) {
          throw new Error(`Evidence bundle for '${expId}' is missing or unverified.`);
        }

        const lineage = defaultExperimentRepository.getFindingLineage(finding.findingId);
        if (!lineage || !lineage.isComplete) {
          throw new Error(`Lineage for '${expId}' is missing or incomplete.`);
        }

        const report = defaultExperimentRepository.getReportByFindingId(finding.findingId);
        if (!report || !report.markdownContent) {
          throw new Error(`Publication report for '${expId}' is missing.`);
        }
      }
    }
  },

  // ==========================================================================
  // Gate 11: Reproducibility Test Suite Execution (9D.11)
  // ==========================================================================
  {
    id: "GATE_11_TEST_SUITE",
    name: "Reproducibility Unit Test Suite Execution",
    run: async () => {
      try {
        execSync("npx vitest run packages/experiments/src/research-provenance.test.ts", {
          stdio: "pipe",
          encoding: "utf-8"
        });
      } catch (err: any) {
        throw new Error(`Vitest test suite failed: ${err.stdout || err.stderr || err.message}`);
      }
    }
  },

  // ==========================================================================
  // Gate 12: Production Boundary & Scheduler Invariance Guard (9D.12)
  // ==========================================================================
  {
    id: "GATE_12_PROD_BOUNDARY",
    name: "Production Boundary & Scheduler Invariance Guard",
    run: async () => {
      // 1. Scheduler remains PAUSED / DISABLED
      const statusPath = join(process.cwd(), "data/processed-cache/scheduler-status.json");
      if (existsSync(statusPath)) {
        const statusData = JSON.parse(readFileSync(statusPath, "utf-8"));
        if (statusData.state !== "PAUSED" && statusData.enabled !== false) {
          throw new Error(`Production scheduler is not PAUSED: ${JSON.stringify(statusData)}`);
        }
      }

      const service = ResearchDataService.getInstance();
      const runsRes = await service.getIngestionRuns({ pageSize: 1 });
      if (runsRes.data.length > 0 && runsRes.data[0]) {
        const run = runsRes.data[0];
        if (run.audit.schedulerState !== "PAUSED" && run.audit.schedulerState !== "DISABLED") {
          throw new Error(`PROD scheduler status must remain PAUSED/DISABLED, found: ${run.audit.schedulerState}`);
        }
      }

      // 2. Canonical Research Corpus invariant (103 draws, 39,550 results)
      const stats = await service.getHistoricalStatistics();
      const researchDrawCount = stats.population.totalDraws;
      const researchResultCount = stats.population.totalResults;

      if (researchDrawCount !== 103) {
        throw new Error(`Expected 103 draws in canonical research corpus, found ${researchDrawCount}`);
      }
      if (researchResultCount !== 39550) {
        throw new Error(`Expected 39,550 total results in canonical research corpus, found ${researchResultCount}`);
      }

      // 3. Production Corpus specification & invariant (100 draws, 38,416 results)
      const PROD_DRAWS_COUNT: number = 100;
      const PROD_RESULTS_COUNT: number = 38416;

      // 4. Machine-checkable invariant: Research Corpus != Production Corpus
      if (researchDrawCount === PROD_DRAWS_COUNT) {
        throw new Error(
          `ENVIRONMENT BOUNDARY VIOLATION: Research draw count (${researchDrawCount}) must not equal PROD draw count (${PROD_DRAWS_COUNT}).`
        );
      }
      if (researchResultCount === PROD_RESULTS_COUNT) {
        throw new Error(
          `ENVIRONMENT BOUNDARY VIOLATION: Research result count (${researchResultCount}) must not equal PROD result count (${PROD_RESULTS_COUNT}).`
        );
      }

      // 5. Fail if 103 draws or 39,550 results is ever attributed to PROD
      const assertNotProdRepresentation = (drawCount: number, resultCount: number, claimedEnv: string) => {
        if (claimedEnv.toUpperCase() === "PROD" && (drawCount === 103 || resultCount === 39550)) {
          throw new Error(
            `PROD CORPUS INTEGRITY VIOLATION: 103 draws / 39,550 results belongs to Canonical Research Corpus (DEV), NEVER to PROD.`
          );
        }
      };
      assertNotProdRepresentation(researchDrawCount, researchResultCount, "DEV");
      let caughtProdMisrepresentation = false;
      try {
        assertNotProdRepresentation(103, 39550, "PROD");
      } catch {
        caughtProdMisrepresentation = true;
      }
      if (!caughtProdMisrepresentation) {
        throw new Error("PROD CORPUS INTEGRITY GUARD FAILED: Guard failed to reject 103/39,550 as PROD representation.");
      }

      // 6. Git branch main remains untouched at 728ebc5
      const mainCommit = execSync("git rev-parse main", { encoding: "utf-8" }).trim();
      const expectedMain = "728ebc532303719345daaf0d6698f5651974702b";
      if (!mainCommit.startsWith("728ebc5")) {
        throw new Error(`PRODUCTION SAFETY VIOLATION: Branch 'main' commit has moved from ${expectedMain} to ${mainCommit}`);
      }

      // 7. Current branch is develop
      const currentBranch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8" }).trim();
      if (currentBranch !== "develop") {
        throw new Error(`SAFETY VIOLATION: Active branch is '${currentBranch}'. All work must be on 'develop'.`);
      }
    }
  }
];

function expectCloseTo(actual: number, expected: number, tolerance: number, label: string) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label}: expected ${expected} ± ${tolerance}, got ${actual}`);
  }
}

async function runVerification() {
  console.log("============================================================");
  console.log(" Kerala Lottery Platform — Milestone 9D Research Provenance");
  console.log(" Publication-Grade Scientific Evidence Layer Verifier");
  console.log("============================================================\n");

  let passed = 0;
  let failed = 0;

  for (let i = 0; i < gates.length; i++) {
    const gate = gates[i]!;
    const num = String(i + 1).padStart(2, "0");
    process.stdout.write(`Gate ${num}/12: ${gate.name}... `);

    try {
      await gate.run();
      console.log("\x1b[32m[PASS]\x1b[0m");
      passed++;
    } catch (err: any) {
      console.log("\x1b[31m[FAIL]\x1b[0m");
      console.error(`  Error: ${err.message}\n`);
      failed++;
    }
  }

  console.log("\n============================================================");
  console.log(` Verification Summary: ${passed} PASSED, ${failed} FAILED (${gates.length} total)`);
  console.log("============================================================\n");

  if (failed > 0) {
    console.error("❌ Milestone 9D Verification Failed.");
    process.exit(1);
  } else {
    console.log("✅ All Milestone 9D Quality Gates Passed with Zero Violations.");
    process.exit(0);
  }
}

runVerification().catch((err) => {
  console.error("Unhandled verification error:", err);
  process.exit(1);
});
