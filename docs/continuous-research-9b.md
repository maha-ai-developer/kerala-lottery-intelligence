# Milestone 9B: Continuous Research & Experimentation Engine Specification

**Status**: VERIFIED & PASSING (12/12 Quality Gates)  
**Date**: October 2, 2026  
**Environment**: Continuous Research (`kerala-lottery-intelligence`)  
**Branch**: `develop`  
**Security Posture**: Read-Only Research Surface; Zero Mutation; Temporal Leakage Mathematically Guarded  
**Scheduler Posture**: Strictly `PAUSED` / `DISABLED`  

---

## 1. Executive Summary & Architecture

Milestone 9B establishes the automated, reproducible, scientific research and experimentation engine for the Kerala State Lottery Intelligence platform. It operationalizes a continuous pipeline that transforms validated canonical lottery evidence into immutable modeling datasets, executes formal statistical baseline experiments, records versioned result artifacts, and provides an end-to-end 8-stage lineage DAG exposed via read-only APIs and an interactive research UI.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CANONICAL CORPUS (103 DRAWS)                    │
│  - 103 Gazetted PDF Source Documents (SHA-256 Grounded)                │
│  - 39,550 Total Verified Results (1,504 FULL_TICKET, 38,046 SUFFIX)    │
│  - Immutable Corpus ID: corpus_${corpusHash}                           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        FEATURE MATRIX REFRESH                          │
│  - Deterministic Feature Matrix ID: fmat_${featureHash}                │
│  - Descriptive features: observed_last_digit, sum_of_digits, parity   │
│  - Backward temporal window evaluation (zero future leakage)           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       MODELING DATASET GENERATION                      │
│  - Deterministic Modeling Dataset ID: mdset_${datasetHash}             │
│  - Canonical Target: tgt_observed_last_digit (0–9 discrete classes)   │
│  - Strict Chronological Holdout Partitioning (80% train / 20% test)    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        FORMAL EXPERIMENT REGISTRY                      │
│  - EXP-001-UNIFORM-BASELINE: Uniform Random Categorical Baseline       │
│  - EXP-002-EMPIRICAL-BASELINE: Empirical Marginal Frequency Baseline   │
│  - EXP-003-MAJORITY-BASELINE: Majority Class Categorical Baseline      │
│  - Strict Definition Hashes & Non-Predictive Foundation Notices        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      DETERMINISTIC EXPERIMENT RUNNER                   │
│  - Seed-controlled PRNG: Mulberry32                                    │
│  - Deterministic Run ID: run_${runHash}                                │
│  - Pre-execution Temporal Leakage Assertion Guard                      │
│  - Lifecycle: PENDING -> RUNNING -> SUCCEEDED | FAILED                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        VERSIONED RESULT ARTIFACTS                      │
│  - Deterministic Artifact ID: art_${artifactHash}                      │
│  - Categorical Metrics: Accuracy, Balanced Accuracy, Log Loss, Samples │
│  - Sample Predictions & Confusion Matrix                               │
│  - Immutable Storage under data/processed-cache/experiments/           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         TYPED 8-STAGE LINEAGE DAG                      │
│  SourceDocuments ➔ Draws ➔ Corpus ➔ FeatureMatrix ➔ ModelingDataset    │
│            ➔ ExperimentDefinition ➔ ExperimentRun ➔ ResultArtifact     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     RESEARCH ACCESS LAYER (API & UI)                   │
│  - Read-Only REST Endpoints (/api/v1/experiment-runs, /results, etc.)  │
│  - HTTP 405 Method Not Allowed Enforced on Mutation Attempts           │
│  - Next.js Web Surface: /experiments (Interactive Lineage & Metrics)   │
│  - CLI Tooling: npm run experiments:run-all, refresh:research, inspect │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Strict Non-Predictive Scientific Research Boundary

All components in Milestone 9B operate strictly under the following non-negotiable scientific boundary:

> **NON-PREDICTIVE MODELING FOUNDATION NOTICE**: This experiment evaluates reproducible mathematical baselines on historical Kerala State Lottery publications for empirical statistical study only. State lotteries operate as physically stochastic, independent trials where historical digit distributions have zero predictive validity for future drawings. Any gambling or predictive claims are strictly prohibited and scientifically unfounded.

### Invariant Guardrails
1. **Zero Predictive Claims**: All models are retrospective, descriptive benchmarks against chance.
2. **Mandatory Random Baseline**: No experiment runs without comparison against theoretical discrete uniform expectation ($p = 0.10, -\ln(0.10) \approx 2.3026$).
3. **No Betting Engines**: Zero ticket selection, staking algorithms, number generation for gambling, or confidence scores implying non-randomness.
4. **Permanent Prominence**: Notice rendered in all registered experiment metadata, run records, artifact files, API responses, and UI dashboards.

---

## 3. Version Identity & Determinism Contracts (9B.1)

Every asset in the research pipeline is assigned an immutable, content-grounded deterministic identifier derived from cryptographic SHA-256 hashes of canonical inputs:

| Version Identity | Contract Prefix | Input Dependencies | Hash Length | Example Format |
|---|---|---|---|---|
| **Corpus Version** | `corpus_` | Graph document SHAs, validation report, total results | 16 hex chars | `corpus_3630f9a23d4bbbe9` |
| **Feature Version** | `fmat_` | Corpus ID, feature definitions, schema version | 16 hex chars | `fmat_7b194d802998a69e` |
| **Dataset Version** | `mdset_` | Corpus ID, Feature Matrix ID, target specification | 16 hex chars | `mdset_34da8489a9e874a6` |
| **Run ID** | `run_` | Experiment ID, version, dataset version, model, seed | 16 hex chars | `run_6fc531017d3cc68b` |
| **Artifact ID** | `art_` | Run ID, metric evaluation hash | 16 hex chars | `art_9f143714c77cbbcf` |

### Deterministic Hash Derivations
- **JSON Normalization**: `canonicalJsonStringify()` recursively sorts object keys and serializes deterministic strings before hashing.
- **Repeatability**: Multiple executions across distinct machines or runtimes yield identical version strings given identical input data.

---

## 4. Formal Experiment Registry (9B.2)

The platform maintains a formal registry of peer-reviewed, reproducible scientific experiments. All registered definitions include a deterministic definition hash ensuring tamper-evident version control:

### 1. `EXP-001-UNIFORM-BASELINE`
- **Name**: Uniform Random Categorical Baseline
- **Model Type**: Discrete Uniform Baseline (`UNIFORM`)
- **Target**: `tgt_observed_last_digit` (10 discrete classes: `"0"` through `"9"`)
- **Parameters**: `allowedValues: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]`, `seed: 42`
- **Methodology**: Theoretical discrete uniform distribution assigns equal probability $P(\text{digit} = d) = 0.10$. Evaluates expected performance under pure physical chance.
- **Metrics**: `ACCURACY`, `BALANCED_ACCURACY`, `LOG_LOSS`, `SAMPLE_SIZE`
- **Theoretical Target**: Accuracy $\approx 10\%$, Log Loss $= -\ln(0.1) \approx 2.302585$.

### 2. `EXP-002-EMPIRICAL-BASELINE`
- **Name**: Empirical Marginal Frequency Baseline
- **Model Type**: Historical Frequency Baseline (`EMPIRICAL`)
- **Target**: `tgt_observed_last_digit`
- **Parameters**: `smoothing: "EPSILON_CLIPPED_1E_15"`, `tieBreaking: "LEXICOGRAPHICAL_ASCENDING"`
- **Methodology**: Calculates marginal distribution $P(\text{digit} = d)$ strictly from training partition draws. Evaluates whether historical digit frequency drifts deviate from chance on subsequent unseen draws.
- **Metrics**: `ACCURACY`, `BALANCED_ACCURACY`, `LOG_LOSS`, `SAMPLE_SIZE`

### 3. `EXP-003-MAJORITY-BASELINE`
- **Name**: Majority Class Baseline
- **Model Type**: Majority Class Baseline (`MAJORITY`)
- **Target**: `tgt_observed_last_digit`
- **Parameters**: `tieBreaking: "LEXICOGRAPHICAL_ASCENDING"`
- **Methodology**: Deterministic argmax of training frequencies. Serves as minimal performance threshold for categorical accuracy.
- **Metrics**: `ACCURACY`, `BALANCED_ACCURACY`, `LOG_LOSS`, `SAMPLE_SIZE`

---

## 5. Temporal Leakage Protection & Invariants (9B.5)

To ensure scientific validity, temporal leakage protection is strictly enforced at multiple independent stages of the execution pipeline:

1. **Chronological Holdout Split**:
   - The verified draws are sorted chronologically ascending by draw date.
   - The first 80% of draws form the training partition (83 draws, 31,700 rows).
   - The final 20% of draws form the evaluation test partition (20 draws, 7,850 rows).
   - $\max(\text{trainDrawDates}) < \min(\text{testDrawDates})$ strictly.

2. **Temporal Assertion Guards**:
   - `assertNoTemporalLeakage(trainDrawDates, predictionCutoff)` checks every training draw timestamp.
   - Throws `TEMPORAL LEAKAGE VIOLATION` if any training draw date is on or after `predictionCutoff`.
   - `validateSplitLeakage(split)` performs set-disjointness assertions across draw IDs and dates.

3. **Fail-Closed Execution**:
   - If corrupted or future-dated records enter the runner, the run immediately halts with status `FAILED` and `error.stage = "LEAKAGE_VALIDATION"`.
   - Contaminated runs never produce result artifacts.

---

## 6. Seed Control & Deterministic PRNG (9B.4)

Stochastic baseline sampling utilizes a deterministic implementation of the 32-bit Mulberry32 pseudo-random number generator:
- Seed parameter is stored in `ReproducibilityMetadata.seed`.
- Re-executing an experiment with identical seed and dataset generates 100% bitwise-identical prediction rows, confusion matrices, and metrics.
- Varying the seed produces an independent run ID (`run_${hash}`), ensuring zero cross-run collision.

---

## 7. Experiment Lineage Graph & DAG Traversal (9B.6)

Every successful experiment run is anchored to an 8-stage typed lineage Directed Acyclic Graph (DAG):

```
Stage 1: [SOURCE_DOCUMENTS]   --> 103 Gazetted PDF SHA-256 hashes
Stage 2: [DRAWS]              --> 103 Verified Draw IDs
Stage 3: [CORPUS]             --> corpus_3630f9a23d4bbbe9 (39,550 winning results)
Stage 4: [FEATURE_MATRIX]     --> fmat_7b194d802998a69e
Stage 5: [MODELING_DATASET]   --> mdset_34da8489a9e874a6 (39,550 rows, last_digit)
Stage 6: [EXPERIMENT_DEF]     --> EXP-001-UNIFORM-BASELINE (hash: fb4a29a0c7fcde93)
Stage 7: [EXPERIMENT_RUN]     --> run_6fc531017d3cc68b (status: SUCCEEDED)
Stage 8: [RESULT_ARTIFACT]    --> art_9f143714c77cbbcf (Acc: 10.13%, LogLoss: 2.3026)
```

- **Completeness Invariant**: `lineage.isComplete` is true only when all 8 stages are present, verified, and linked to a `SUCCEEDED` run and non-null `ResultArtifact`.
- **Queryable**: Accessible programmatically via `ExperimentRepository.getLineage(runId)` or HTTP GET `/api/v1/experiment-runs/:id/lineage`.

---

## 8. Run State Machine & Immutability Safeguards (9B.3)

### Lifecycle States
- `PENDING`: Scheduled for execution.
- `RUNNING`: Execution initiated, holdout split in progress.
- `SUCCEEDED`: Metrics calculated, artifact persisted, lineage verified.
- `FAILED`: Execution terminated with `ExperimentRunError` recorded.
- `PARTIAL`: Incomplete evaluation window.
- `CANCELLED`: User or system aborted.

### Immutability Protection
The `ExperimentRepository` strictly enforces write invariants:
- A `SUCCEEDED` run record is **immutable**.
- Calling `repo.saveRun()` with a `FAILED` or `PARTIAL` status for an existing `SUCCEEDED` run immediately throws `IMMUTABILITY_VIOLATION`.
- Prevents transient system crashes or pipeline failures from overwriting previously established scientific ground truth.

---

## 9. Pipeline Refresh Idempotency (9B.7)

The orchestration engine (`refreshResearchPipeline`) enables automated research continuation upon arrival of newly validated draws:
1. Discovers current corpus state from `data/processed-cache`.
2. Computes current corpus, feature, and dataset version hashes.
3. Inspects repository for existing runs matching `(experimentId, datasetVersion, seed, codeVersion)`.
4. If all registered baselines have `SUCCEEDED` runs on the current dataset:
   - Returns `status: "UNCHANGED"`.
   - Skips redundant execution (`skippedRuns: 3, executedRuns: 0`).
   - Zero redundant files or duplicate metrics written to disk.
5. If new draws are detected (corpus hash changes):
   - Derives new dataset version.
   - Executes all 3 baseline models against the new dataset.
   - Emits versioned artifacts and new lineage DAGs.

---

## 10. Local CLI Tooling & Operator Scripts (9B.8)

Operator commands are available via `npm` scripts:

```bash
# List all registered scientific experiments
npm run experiments:list

# Execute a single experiment by ID
npm run experiments:run -- EXP-001-UNIFORM-BASELINE

# Execute all registered baseline experiments
npm run experiments:run-all

# Execute continuous research refresh (idempotent)
npm run refresh:research

# Inspect full run details and lineage graph
npm run experiments:inspect -- run_6fc531017d3cc68b

# Run authoritative Milestone 9B verification suite
npm run verify:9b
```

---

## 11. Read-Only REST API Contracts (9B.9)

All experiment data is accessible via versioned, read-only REST endpoints adhering strictly to HTTP specifications:

| Endpoint | Method | Response Description |
|---|---|---|
| `/api/v1/registered-experiments` | `GET` | List registered experiment definitions with pagination |
| `/api/v1/experiments/:id` | `GET` | Retrieve specific experiment definition by ID |
| `/api/v1/experiment-runs` | `GET` | Paginated list of historical experiment runs |
| `/api/v1/experiment-runs/:id` | `GET` | Retrieve specific experiment run with window summary |
| `/api/v1/experiment-runs/:id/lineage` | `GET` | Retrieve complete 8-stage lineage DAG for a run |
| `/api/v1/experiment-results` | `GET` | Paginated list of versioned result artifacts |
| `/api/v1/experiment-results/:id` | `GET` | Retrieve artifact metrics, confusion matrix, sample rows |

### Read-Only Safety Invariant
Any attempt to call `POST`, `PUT`, `DELETE`, or `PATCH` on any research endpoint immediately returns `HTTP 405 Method Not Allowed` with header `Allow: GET`.

---

## 12. Interactive Research UI (9B.10)

The web research interface (`apps/web/app/experiments/page.tsx`) provides an interactive portal for exploring experiments:
- **Experiment Registry Cards**: Displays experiment ID, baseline type, target, parameters, and definition hash.
- **Run History Table**: Real-time table of runs with status badges (`SUCCEEDED`, `FAILED`), dataset version, seed, accuracy, log loss, and execution timestamps.
- **Interactive Run Detail**: Deep-dive inspector displaying evaluation window dates (train vs test draws and row counts).
- **8-Stage Lineage Visualizer**: Interactive step-by-step audit showing cryptographic identifiers from raw source documents through to the result artifact.
- **Empirical Sample Table**: Shows sample predictions with hit/miss indicators.
- **Non-Predictive Disclaimer**: Prominent header notice on every screen.

---

## 13. Canonical 103-Draw Baseline Results

The baseline models were evaluated against the canonical 103-draw historical research corpus:
- **Corpus Version**: `corpus_3630f9a23d4bbbe9`
- **Total Draws**: 103 (May 15, 2026 to October 1, 2026)
- **Total Winning Numbers**: 39,550 results (1,504 FULL_TICKET, 38,046 SUFFIX)
- **Modeling Dataset**: `mdset_34da8489a9e874a6`
- **Target**: `tgt_observed_last_digit` (10 discrete classes)
- **Holdout Partition**: 83 training draws (31,700 rows) / 20 test draws (7,850 rows)

### Empirical Metric Results

| Metric | Theoretical Uniform | EXP-001 (Uniform Random) | EXP-002 (Empirical Frequency) | EXP-003 (Majority Class) |
|---|---|---|---|---|
| **Accuracy** | $10.00\%$ | **10.13%** | **9.92%** | **9.92%** |
| **Balanced Accuracy** | $10.00\%$ | **10.13%** | **9.92%** | **10.00%** |
| **Log Loss** | $-\ln(0.1) \approx 2.3026$ | **2.3026** | **2.3030** | **31.1113** |
| **Test Sample Size** | 7,850 | **7,850** | **7,850** | **7,850** |
| **Status** | Analytical Bound | `SUCCEEDED` | `SUCCEEDED` | `SUCCEEDED` |

### Scientific Interpretation
- The uniform random baseline accuracy of **10.13%** and cross-entropy log loss of **2.3026** align with theoretical expectations ($1/10$ chance).
- The historical empirical frequency baseline achieves **9.92%** accuracy, demonstrating that historical digit frequencies fail to outperform pure chance on subsequent unseen draws.
- The majority class baseline exhibits an extreme log loss of **31.1113**, reflecting the high cross-entropy penalty incurred when assigning all probability mass to a single digit class that occurs with ~10% frequency.

---

## 14. Verification Quality Gates Summary (12/12 PASS)

The Milestone 9B verification suite (`npm run verify:9b`) validates all 12 quality gates:

```
============================================================
MILESTONE 9B VERIFICATION SUMMARY
============================================================
[GATE  1] [PASS] Formal Registry Integrity
        All 3 canonical baseline experiments registered with valid deterministic hashes and non-predictive notices.
[GATE  2] [PASS] Version Identity & Determinism
        Corpus, Feature, Dataset, Run, and Artifact versions deterministically derived with unique prefixes.
[GATE  3] [PASS] Deterministic Experiment Execution
        Repeated execution with identical inputs produces identical run ID, artifact ID, and metric values.
[GATE  4] [PASS] Baseline Evaluation Metrics & Theoretical Bounds
        Uniform Baseline accuracy = 10.13%, Log Loss = 2.3026 (matches theoretical -ln(0.1)=2.3026).
[GATE  5] [PASS] Temporal Leakage Protection
        Strict chronological holdout enforced. Future training draws provably throw TEMPORAL LEAKAGE VIOLATION.
[GATE  6] [PASS] Run State Machine & Immutability Enforcement
        Lifecycle transitions enforced. Succeeded runs are immutable against corruption or overwriting.
[GATE  7] [PASS] Complete 8-Stage Lineage Verifiability
        Full 8-stage lineage DAG verified from raw source document to versioned result artifact.
[GATE  8] [PASS] Pipeline Refresh Idempotency
        Pipeline refresh confirmed idempotent: status UNCHANGED, 3 runs skipped, zero duplicate records.
[GATE  9] [PASS] Research Service & API Surface
        ResearchDataService exposes registered experiments, runs, artifacts, and lineage with complete type fidelity.
[GATE 10] [PASS] Mutation Rejection (405 Method Not Allowed)
        HTTP 405 Method Not Allowed and Allow: GET header enforced on mutation attempts across all research routes.
[GATE 11] [PASS] Canonical 103-Draw Research Corpus Grounding
        Corpus verified at exactly 103 draws and 39,550 results (train: 83 draws / 31700 rows, test: 20 draws / 7850 rows).
[GATE 12] [PASS] Production Boundary & Non-Predictive Invariance
        PROD scheduler confirmed PAUSED, zero PROD state mutation, strict non-predictive disclaimer enforced.
============================================================

>>> ALL 12/12 QUALITY GATES PASSED SUCCESSFULLY <<<
Milestone 9B Continuous Research & Experimentation Engine is OPERATIONAL.
```

---

## 15. Operational & Production Safety Invariant

- **PROD State**: Untouched. PROD database retains its baseline state.
- **PROD Scheduler**: Strictly `PAUSED` / `DISABLED` in Cloud Scheduler and Firestore.
- **Git Branch**: Branch `main` remains untouched at commit `728ebc5`. All Milestone 9B developments reside exclusively on `develop`.
