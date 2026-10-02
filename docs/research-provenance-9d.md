# Milestone 9D: Research Provenance & Publication-Grade Evidence Specification

**Status**: VERIFIED & PASSING (12/12 Quality Gates)  
**Date**: October 2, 2026  
**Environment**: Continuous Research (`kerala-lottery-intelligence`)  
**Branch**: `develop`  
**Security Posture**: Read-Only Research Surface; Zero Mutation; Cryptographic Grounding  
**Scheduler Posture**: Strictly `PAUSED` / `DISABLED`  

---

## 1. Executive Summary & Architecture

Milestone 9D establishes an immutable scientific evidence and research provenance layer on top of completed Milestones 9A (Production Research API), 9B (Continuous Experimentation Engine), and 9C (Scientific Validation).

Every terminal scientific finding in the platform is cryptographically grounded in raw source gazette PDF documents through an unbroken 10-stage directed acyclic graph (DAG). The architecture enforces strict **"no silent repair"**: any missing or altered artifact invalidates the evidence bundle with explicit failure, preventing silent data drift or tampering.

```
┌────────────────────────────────────────────────────────────────────────┐
│                      10-STAGE COMPLETE LINEAGE DAG                     │
├────────────────────────────────────────────────────────────────────────┤
│  [Stage 1]  SOURCE_DOCUMENTS   103 Gazetted PDF source documents       │
│                                (all verified via SHA-256)              │
│                                   │                                    │
│                                   ▼                                    │
│  [Stage 2]  DRAWS              103 Verified Draw Records               │
│                                   │                                    │
│                                   ▼                                    │
│  [Stage 3]  CORPUS             Canonical Research Corpus               │
│                                (39,550 winning results)                │
│                                   │                                    │
│                                   ▼                                    │
│  [Stage 4]  FEATURE_MATRIX     Extracted Historical Features           │
│                                   │                                    │
│                                   ▼                                    │
│  [Stage 5]  MODELING_DATASET   Chronologically Partitioned Dataset     │
│                                (31,700 Train / 7,850 Test)             │
│                                   │                                    │
│                                   ▼                                    │
│  [Stage 6]  EXPERIMENT_DEF     Registered Baseline Definition          │
│                                (EXP-001, EXP-002, EXP-003)             │
│                                   │                                    │
│                                   ▼                                    │
│  [Stage 7]  EXPERIMENT_RUN     Deterministic Execution (Seed 42)       │
│                                   │                                    │
│                                   ▼                                    │
│  [Stage 8]  RESULT_ARTIFACT    Evaluation Metrics (Acc, Loss, Brier)   │
│                                   │                                    │
│                                   ▼                                    │
│  [Stage 9]  VALIDATION         Statistical Inference (Wilson CI, SE,   │
│                                Holm-Bonferroni, Null Model)            │
│                                   │                                    │
│                                   ▼                                    │
│  [Stage 10] FINDING            Terminal Research Finding Contract      │
│                                (Grounded in Evidence Bundle)           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   PUBLICATION & PRESENTATION LAYER                     │
│  - Publication Report Generator (Academic Markdown & Structured JSON)  │
│  - Read-Only REST API (GET /findings, /evidence, /lineage, /report)    │
│  - Interactive Research UI (/findings with 10-stage visualizer)        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Research Finding Contract (9D.1)

Every scientific discovery or baseline outcome is formalized in an immutable `ResearchFinding` structure:

```typescript
export interface ResearchFinding {
  findingId: string;              // Deterministic: find_${hash}
  findingVersion: string;         // SemVer "1.0.0"
  statement: string;              // Formal claim statement conforming to taxonomy
  claimType: ScientificClaimType; // "OBSERVATION" | "STATISTICAL_RESULT" | "INTERPRETATION" | "LIMITATION"
  corpusVersion: string;          // Canonical corpus reference (e.g. corpus_07971b8e8aa2a79c)
  datasetVersion: string;         // Partitioned modeling dataset reference
  experimentId: string;           // E.g. "EXP-001-UNIFORM-BASELINE"
  experimentVersion: string;      // E.g. "1.0.0"
  runId: string;                  // Deterministic run ID
  validationId: string;           // Statistical validation artifact ID
  methodology: string;            // E.g. "EXPANDING_WINDOW_HOLM_BONFERRONI_V1"
  methodologyVersion: string;     // E.g. "1.0.0"
  parameters: {
    confidenceLevel: number;      // 0.95
    familyId: string;             // "EXP_FAMILY_CANONICAL_BASELINES"
    totalHypothesesInFamily: number; // 3
    nullModelType: string;        // "DISCRETE_UNIFORM_NULL"
    nullModelIterations: number;  // 1000
    seed: number;                 // 42
    walkForwardWindows: number;   // 3
  };
  evidence: {
    observedAccuracy: number;     // E.g. 0.10127 (10.13%)
    nullDistributionMean: number; // E.g. 0.10005 (10.01%)
    nullDistributionStdDev: number; // 0.00349
    zScore: number;               // 0.349
    rawPValue: number;            // 0.3696
    adjustedPValue: number;       // 1.0000 (Holm-Bonferroni)
    isSignificant: boolean;       // false
    cohensH: number;              // 0.0042
    relativeAccuracyRatio: number;// 1.013x
    walkForwardStabilityScore: number; // 0.975 (97.5%)
    holdoutDrawCount: number;     // 20
    holdoutRowCount: number;      // 7850
  };
  uncertainty: {
    sampleSize: number;           // 7850
    standardError: number;        // 0.003405 (0.34%)
    marginOfError: number;        // 0.006674 (±0.67%)
    confidenceLevel: number;      // 0.95
    wilsonScore95CI: [number, number]; // [0.0948, 0.1081]
    bootstrap95CI: [number, number];   // [0.0945, 0.1084]
  };
  interpretation: string;
  limitation: string;
  createdAt: string;
  deterministicHash: string;      // 64-char SHA-256 of canonical JSON
}
```

---

## 3. Evidence Bundle Contract & Cryptographic Grounding (9D.2)

The `EvidenceBundle` cryptographically binds the terminal finding to its foundational source documents and intermediate artifacts:

```typescript
export interface EvidenceBundle {
  evidenceBundleId: string;       // Deterministic: evb_${hash}
  bundleVersion: string;          // "1.0.0"
  findingId: string;              // Target finding reference
  sourceDocumentCount: number;    // Exactly 103
  sourceDocumentShas: string[];   // All 103 source gazette PDF SHA-256 digests
  drawCount: number;              // Exactly 103
  drawIds: string[];              // Canonical sorted draw ID list
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
  artifactHashes: Record<string, string>; // Complete hash table
  softwareEnvironment: {
    engine: string;
    version: string;
    nodeVersion: string;
    platform: string;
    arch: string;
    dependencies: Record<string, string>;
  };
  methodology: {
    name: string;
    version: string;
    description: string;
    disclaimer: string;
  };
  verifiedAt: string;
  isIntegrityVerified: boolean;
  integrityErrors: string[];
  deterministicHash: string;
}
```

---

## 4. Integrity Verification & "No Silent Repair" (9D.4)

In contrast to commercial software that silently repairs or regenerates missing dependencies, scientific provenance mandates absolute fidelity:

1. **Bitwise Hash Verification**: `verifyEvidenceBundleIntegrity()` inspects every artifact hash in the bundle (`corpus`, `dataset`, `experiment`, `run`, `resultArtifact`, `validation`, `finding`).
2. **Strict Failure upon Mutation**: If any hash differs by even a single bit, the bundle is marked `valid: false` and explicit `INTEGRITY_VIOLATION` errors are logged.
3. **Strict Failure upon Missing Data**: If any intermediate artifact file is missing from disk, validation immediately fails without attempting to re-synthesize it silently.
4. **Zero Overwrite Protection**: The repository enforces that existing findings, evidence bundles, and reports cannot be overwritten with differing hashes (`IMMUTABILITY_VIOLATION`).

---

## 5. Scientific Claim Taxonomy & Anti-Prediction Guardrails (9D.6)

To protect research from pseudoscience and gambling claims, the engine enforces a formal claim taxonomy:

| Claim Type | Scope & Definition | Validation Invariant |
| :--- | :--- | :--- |
| **`OBSERVATION`** | Descriptive reporting of empirical measurements | Must cite observable empirical metrics (e.g., accuracy, log loss, sample size). |
| **`STATISTICAL_RESULT`** | Statistical inference under hypothesis testing | Must cite inferential statistics (p-value, null model, confidence intervals, effect size). |
| **`INTERPRETATION`** | Plain-English scientific evaluation | Must frame outcomes in terms of chance, stochastic variation, or physical process. |
| **`LIMITATION`** | Boundaries of validity and domain constraints | Must articulate physical trial independence and zero predictive validity. |

### Anti-Prediction Blacklist
Any statement containing the following keywords or intent is immediately rejected with a `SCIENTIFIC_CLAIM_VIOLATION`:
- `"predict future"`, `"predict next"`, `"prediction for"`
- `"guaranteed win"`, `"sure win"`, `"beat the lottery"`
- `"betting recommendation"`, `"gambling strategy"`, `"profit strategy"`
- `"hot number"`, `"lucky number"`, `"winning formula"`, `"money back"`

---

## 6. Publication-Grade Report Generator (9D.7)

The `generatePublicationReport()` function compiles immutable artifacts into publication-ready academic reports in two synchronized representations:
1. **Academic Markdown**: Fully formatted research paper with abstract, claim classification, evaluation population table, uncertainty quantifications, walk-forward evaluation fold tables, and formal citations.
2. **Structured JSON**: Machine-readable payload containing complete finding metadata, evidence bundle, and lineage DAG.

Generated reports are persisted under `data/processed-cache/experiments/reports/` and served via REST API and Web UI.

---

## 7. Read-Only REST API (9D.8)

All research provenance endpoints are strictly read-only:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/findings` | Paginated listing of registered research findings (supports `experimentId`, `claimType`, `runId` filters) |
| `GET` | `/api/v1/findings/:id` | Single research finding by ID |
| `GET` | `/api/v1/findings/:id/evidence` | Cryptographic evidence bundle for a finding |
| `GET` | `/api/v1/findings/:id/lineage` | Complete 10-stage lineage DAG for a finding |
| `GET` | `/api/v1/findings/:id/report` | Publication report (JSON or Markdown via `?format=md`) |

### Mutation Rejection
Any attempt to call `POST`, `PUT`, `DELETE`, or `PATCH` on these endpoints returns:
- **HTTP Status**: `405 Method Not Allowed`
- **Response Header**: `Allow: GET`
- **Payload**: `{"error": "METHOD_NOT_ALLOWED", "message": "The requested method is not allowed. Production research endpoints are strictly read-only."}`

---

## 8. Research Web UI (`/findings`) (9D.9)

The web presentation layer provides an interactive scientific audit interface:
- **Finding Registry**: Table view with claim taxonomy badges, holdout accuracies, standard errors, and Holm-Bonferroni adjusted p-values.
- **10-Stage Lineage Visualizer**: Complete DAG rendering from source gazettes to terminal findings with stage numbers, node identities, and SHA-256 hashes.
- **Evidence Bundle Auditor**: Artifact hash verification table and full expandable list of 103 source gazette PDF SHA-256 hashes.
- **Uncertainty & Inference Panel**: Wilson score 95% CIs, percentile bootstrap CIs, standard error formulas, null hypothesis distributions, and Holm-Bonferroni step-down corrections.
- **Publication Report Preview & Export**: In-browser report viewer with single-click "Copy Markdown" and "Download .md Report" functionality.

---

## 9. Canonical Baseline Findings (103-Draw Corpus) (9D.10)

All three canonical baselines have been formally evaluated, validated, and registered:

| Experiment ID | Model Family | Holdout Accuracy | Wilson 95% CI | Standard Error (SE) | Raw P-Value | Holm Adjusted P | Significant? |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **`EXP-001-UNIFORM-BASELINE`** | Uniform Random | **10.13%** | [9.48%, 10.81%] | **0.34%** (`0.003405`) | 0.3696 | **1.0000** | **NO** |
| **`EXP-002-EMPIRICAL-BASELINE`** | Marginal Frequency | **9.92%** | [9.28%, 10.60%] | **0.34%** (`0.003378`) | 0.4076 | **1.0000** | **NO** |
| **`EXP-003-MAJORITY-BASELINE`** | Majority Class | **9.92%** | [9.28%, 10.60%] | **0.34%** (`0.003378`) | 0.4076 | **1.0000** | **NO** |

### Scientific Conclusion
Across N = 7,850 chronological holdout test records from 20 draws:
- No baseline exhibits a statistically significant deviation from theoretical uniform chance (10.00%).
- Holm-Bonferroni adjusted p-values equal **1.0000** for all models.
- Temporal stability exceeds **97%** with zero data leakage across 3 expanding windows.
- Empirical evidence confirms that physical lottery drawings operate as independent stochastic physical trials.

---

## 10. Verification Quality Gates Summary (9D.12)

The `npm run verify:9d` test runner validates all 12 quality gates:

```
============================================================
 Kerala Lottery Platform — Milestone 9D Research Provenance
 Publication-Grade Scientific Evidence Layer Verifier
============================================================

Gate 01/12: Research Finding Contract Completeness... [PASS]
Gate 02/12: Evidence Bundle Cryptographic Grounding... [PASS]
Gate 03/12: Complete 10-Stage Lineage Chain Verification... [PASS]
Gate 04/12: Integrity Verification & 'No Silent Repair'... [PASS]
Gate 05/12: Deterministic Finding & Evidence Bundle Derivation... [PASS]
Gate 06/12: Scientific Claim Taxonomy & Anti-Prediction Guardrails... [PASS]
Gate 07/12: Publication-Grade Report Generation & Verification... [PASS]
Gate 08/12: Read-Only REST API & HTTP 405 Mutation Guards... [PASS]
Gate 09/12: Research UI & Web Presentation Surface Integrity... [PASS]
Gate 10/12: Canonical 103-Draw Baseline Finding Verification... [PASS]
Gate 11/12: Reproducibility Unit Test Suite Execution... [PASS]
Gate 12/12: Production Boundary & Scheduler Invariance Guard... [PASS]

============================================================
 Verification Summary: 12 PASSED, 0 FAILED (12 total)
============================================================

✅ All Milestone 9D Quality Gates Passed with Zero Violations.
```

---

## 11. Production Boundary & Safety Guarantees

1. **PROD Data Unmodified**: The verified production database remains untouched with exactly 100 draws and 38,416 winning results.
2. **Ingestion Scheduler Disabled**: The ingestion scheduler remains strictly `PAUSED` / `DISABLED`.
3. **Main Branch Untouched**: Git branch `main` remains untouched at `728ebc532303719345daaf0d6698f5651974702b`.
4. **Develop Branch Only**: All Milestone 9D changes exist exclusively on branch `develop`.
