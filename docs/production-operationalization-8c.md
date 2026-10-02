# Milestone 8C: Production Operationalization & Architecture Runbook

> **SCIENTIFIC BENCHMARKING NOTICE**: This daily lottery ingestion platform discovers, acquires, validates, ingests, and promotes historical Kerala State Lottery draw records for descriptive historical research and statistical benchmarking only. It contains **NO winning-number predictions, betting advice, gambling strategy, or future probability claims**.

> **ENVIRONMENT POLICY**: Strict fail-closed boundary between **DEV** (`kerala-lottery-intel-dev`) and **PROD** (`kerala-lottery-intelligence`). Production never silently inherits development settings. Any misconfiguration aborts immediately.

---

## 1. Executive Summary & Operations Architecture

Milestone 8C establishes a safe, controlled production operationalization of the validated daily-ingestion architecture, ensuring zero code divergence between DEV and PROD while maintaining strict environment isolation.

```mermaid
flowchart TD
    subgraph Google Cloud Platform (PROD: kerala-lottery-intelligence)
        CS[Google Cloud Scheduler<br/>prod-daily-lottery-ingestion<br/>0 17 * * * Asia/Kolkata<br/>Initial State: DISABLED]
        OIDC[OIDC Service Account Token<br/>prod-ingestion-scheduler@...<br/>Audience: PROD App Hosting URL]
        Route[Private Authenticated Endpoint<br/>/api/internal/daily-ingestion]
        
        CS -->|HTTPS POST + OIDC Token| OIDC
        OIDC --> Route
    end

    subgraph Operations Runtime & Concurrency Control
        Guard[Environment Safety Guard<br/>Fail closed if target !== PROD]
        Lock[Single-Flight Lock Manager<br/>ingestion_locks/daily_ingestion_lock]
        RunRepo[Operational Run Repository<br/>ingestion_runs/{runId}]
        Engine[Daily Ingestion Engine<br/>Discovery -> Acquisition -> Validation -> Promotion]
        
        Route --> Guard
        Guard --> Lock
        Lock -->|Lease Acquired| RunRepo
        Lock -->|Lease Busy| Skipped[SKIPPED_LOCKED 423]
        RunRepo --> Engine
    end

    subgraph Production Source of Truth & Durability
        GCS[Cloud Storage (PROD)<br/>kerala-lottery-intelligence.firebasestorage.app<br/>source-documents/{sha256}.pdf]
        FS_Doc[Firestore Documents<br/>documents/{sha256}]
        FS_Runs[Firestore Ingestion Runs<br/>ingestion_runs/{runId}]
        Downstream[Canonical Derived Layers<br/>Corpus, Features, Modeling Dataset]
        
        Engine --> GCS
        Engine --> FS_Doc
        Engine --> Downstream
        Engine --> FS_Runs
    end
```

---

## 2. Environment Map & Fail-Closed Separation

DEV and PROD configurations are injected strictly at deployment/runtime rather than hardcoded:

| Parameter | Development (DEV) | Production (PROD) |
| :--- | :--- | :--- |
| **Project Name** | Kerala Lottery Intel DEV | Kerala Lottery Intel PROD |
| **Project ID** | `kerala-lottery-intel-dev` | `kerala-lottery-intelligence` |
| **Project Number** | `608186999779` | `660682986882` |
| **Storage Bucket** | `kerala-lottery-intel-dev.firebasestorage.app` | `kerala-lottery-intelligence.firebasestorage.app` |
| **Scheduler SA** | `dev-ingestion-scheduler@...` | `prod-ingestion-scheduler@...` |
| **Scheduler Job** | `dev-daily-lottery-ingestion` | `prod-daily-lottery-ingestion` |
| **Active Branch** | `develop` | `main` |
| **Runtime Region**| `asia-southeast1` | `asia-southeast1` |
| **Safety Guard** | `assertDevEnvironment` | `assertProdEnvironment` |

### Fail-Closed Invariants:
1. **Wrong Project ID:** An execution in PROD with `projectId !== "kerala-lottery-intelligence"` throws `EnvironmentViolationError` and halts before performing any mutation.
2. **Wrong Environment Name:** Non-PROD environment parameter in `assertProdEnvironment` immediately aborts.
3. **Cross-Project Storage Pollution:** Configuring a DEV storage bucket in PROD or vice-versa fails closed.
4. **Cross-Environment Service Account Ingress:** DEV service account calling PROD endpoint is rejected with `HTTP 403 Forbidden`. PROD service account calling DEV endpoint is rejected with `HTTP 403 Forbidden`.

---

## 3. Production Source of Truth

No production ingestion depends on developer laptop filesystems, Raspberry Pi filesystems, git working trees, or local caches.

1. **PROD Source Document Bytes**: Stored immutably in Google Cloud Storage:
   ```
   gs://kerala-lottery-intelligence.firebasestorage.app/source-documents/{sha256}.pdf
   ```
   - Persisted using atomic `putIfAbsent` to prevent overwrites.
   - Content Type: `application/pdf`.
2. **PROD Metadata & Run Records**: Stored in Cloud Firestore:
   - `/documents/{sha256}`: Validated document metadata, SHA256 checksum, extraction status, and provenance.
   - `/ingestion_runs/{runId}`: Operational run audits, candidate metrics, error summaries, and execution timing.
   - `/ingestion_locks/daily_ingestion_lock`: Durable single-flight lease state.
3. **PROD Knowledge & Derived Layers**:
   - `/lottery_corpora/{corpusId}`: Promoted multi-draw canonical population.
   - `/historical_analyses/{analysisId}`: Descriptive statistical distributions.
   - `/historical_model_feature_matrices/{matrixId}`: Extracted feature matrix.
   - `/historical_modeling_datasets/{datasetId}`: Benchmarking dataset for chronological splits.

---

## 4. Production Deployment & Runtime Configuration

The web application and internal ingestion routes run on **Firebase App Hosting / Google Cloud Run**:

- **Manifest**: `apps/web/apphosting.yaml`
- **CPU / Memory**: 1 CPU, 512 MiB RAM, concurrency 80.
- **Environment Ingestion**:
  ```yaml
  env:
    - variable: FIREBASE_APP_HOSTING
      value: "1"
    - variable: NEXT_PUBLIC_FIREBASE_PROJECT_ID
      value: "kerala-lottery-intelligence"
    - variable: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
      value: "kerala-lottery-intelligence.firebasestorage.app"
  ```
- **Code Divergence**: Identical TypeScript codebase (`DailyIngestionEngine`, `ScheduledIngestionOrchestrator`, `EnvironmentGuard`) runs in both DEV and PROD.

---

## 5. Production Authorization & Service Account Boundaries

The daily ingestion endpoint (`/api/internal/daily-ingestion`) is strictly private:

1. **Anonymous Invocations**: Blocked with `HTTP 401 Unauthorized`.
2. **Unauthorized Callers**: Blocked with `HTTP 403 Forbidden`.
3. **Authorized Schedulers**:
   - PROD Scheduler calls endpoint with Google OIDC ID token generated for:
     `prod-ingestion-scheduler@kerala-lottery-intelligence.iam.gserviceaccount.com`
   - OIDC audience must match the target URL.
   - Endpoint verifies `iss === "https://accounts.google.com"` and validates that the service account email belongs strictly to the target environment.

---

## 6. Production Scheduler Activation Strategy

In accordance with **Requirement 8C.5**, the PROD Cloud Scheduler job is initially deployed in a **DISABLED** state:

- **Manifest**: `infra/scheduler/prod-scheduled-ingestion.json`
- **Schedule**: `0 17 * * *` (5:00 PM IST daily)
- **Timezone**: `Asia/Kolkata`
- **Publication Buffer**: 15–75 minutes after the official 3:00 PM IST draw.
- **Initial State**: `DISABLED`
- **Controlled Manual Run**: Triggered via `POST /api/internal/daily-ingestion` using authorized OIDC bearer token.
- **Activation Gate**: The scheduler is transitioned to `ENABLED` only after verified manual execution, zero duplicate persistence, and audit validation.

---

## 7. Controlled First-Ingestion & Historical Bootstrap Strategy

To prevent uncontrolled re-ingestion or duplicate pollution, the historical 100-draw corpus is promoted through a dedicated, deterministic bootstrap procedure:

- **Command**: `npm run bootstrap:prod` (`services/ingestion/scripts/prod-bootstrap.ts`)
- **Execution Protocol**:
  1. **Inspection**: Verify PROD storage and Firestore document counts.
  2. **Extraction & Validation**: For each of the 100 historical PDFs:
     - Verify PDF header integrity (`%PDF-`).
     - Extract text blocks and segment into semantic regions.
     - Extract prize tiers and winning results.
     - Verify against the official prize scheme registry.
  3. **Atomic Persistence**:
     - Upload source bytes to `source-documents/{sha256}.pdf` with `putIfAbsent`.
     - Record metadata in `/documents/{sha256}`.
  4. **Downstream Promotion**:
     - Construct `MultiDrawLotteryCorpus` (`100 draws, 38,416 winning results`).
     - Calculate historical statistics.
     - Extract feature matrix and evaluate feature quality.
     - Construct canonical modeling dataset.
  5. **Verification**: Confirm target anchor draw `BHAGYATHARA BT-73` (`cddb3d4d05c102b98f38050ac1ff297ad15bc442b12087c0505927f7bb1cf3dc`) is present and immutable.

---

## 8. Real-World BT-73 Compatibility & Idempotency

The latest known real-world draw anchors our end-to-end idempotency test:

- **Draw**: BHAGYATHARA BT-73 (28/09/2026)
- **SHA256**: `cddb3d4d05c102b98f38050ac1ff297ad15bc442b12087c0505927f7bb1cf3dc`
- **Results**: 398 winning numbers (1st Prize: `BN 580007`, Consolation, 2nd–8th Prizes).

### Replay Invariant:
When BT-73 is presented a second time:
1. `DailyIngestionEngine` detects document exists in cache/manifest/storage.
2. Resulting status is marked `ALREADY_KNOWN`.
3. Ingested count is `0`.
4. Duplicate document writes are `0`.

---

## 9. Durable Concurrency Control & Single-Flight Locks

Concurrent executions in PROD are prevented via Firestore-backed leases:

- **Document**: `/ingestion_locks/daily_ingestion_lock`
- **Lease Duration**: 300 seconds (5 minutes TTL).
- **Worker A**: Acquires lease, records `ownerRunId`, updates state to `RUNNING`.
- **Worker B**: Attempts acquisition, detects active unexpired lease, updates run record to `SKIPPED_LOCKED`, responds with `HTTP 423 Locked`.
- **Stale Lock Recovery**: If Worker A crashes without releasing the lock, any worker after TTL expiration detects stale lease, evicts it, and acquires ownership safely.

---

## 10. Failure Recovery & Error Taxonomy

The complete 10-category failure taxonomy leaves coherent, persisted operational audit state in PROD without swallowing exceptions:

| Failure Category | Trigger Condition | System Behavior |
| :--- | :--- | :--- |
| `SOURCE_DISCOVERY_FAILURE` | State portal unavailable / DNS timeout | Fast-fail, record audit log, alert on-call |
| `ACQUISITION_FAILURE` | PDF download fails or times out | Retry with exponential backoff up to 3 times |
| `PDF_VALIDATION_FAILURE` | Corrupt PDF header or syntax | Quarantine document, log reason, continue batch |
| `SCHEME_RESOLUTION_FAILURE` | Draw archetype not registered | Reject document, quarantine, flag scheme review |
| `RESULT_VALIDATION_FAILURE` | Prize structure / tier count discrepancy | Mark CONFLICT, quarantine, do not promote |
| `PERSISTENCE_FAILURE` | Cloud Storage or Firestore write error | Retry transient storage failures, abort run if fatal |
| `PROMOTION_FAILURE` | Downstream corpus or feature failure | Retain source documents, mark PARTIAL_SUCCESS |
| `LOCK_FAILURE` | Active lease held by concurrent worker | Log SKIPPED_LOCKED, exit gracefully |
| `CONFIGURATION_FAILURE` | Project ID or environment mismatch | Fail closed immediately, 0 mutation |
| `UNKNOWN_FAILURE` | Unhandled process or unexpected error | Log stack trace, sanitize secrets, alert |

---

## 11. Production Observability & Secret Redaction

1. **Heartbeat & Status Endpoint**:
   - `GET /api/internal/daily-ingestion`
   - Returns JSON containing:
     - `operationalHealth`: `HEALTHY`, `DEGRADED`, or `DOWN`.
     - `lastSuccessfulRun`: Timestamp, runId, ingested count.
     - `lastFailedRun`: Timestamp, error category, failure summary.
     - `nextScheduledExecution`: Calculated next cron occurrence (5:00 PM IST).
     - `activeLock`: Whether a run is currently in progress.
2. **Secret Sanitization**:
   - Every operational record passes through `sanitizeOperationalRecord`.
   - Bearer tokens (`ya29...`), API keys (`AIzaSy...`), service account private keys, passwords, and tokens are scrubbed (`[REDACTED]`) before persistence.

---

## 12. Production Rollback Strategy

Production code rollbacks are strictly decoupled from immutable source data:

1. **Code Rollback**:
   - Redeploy a previous stable revision in Firebase App Hosting / Cloud Run.
   - Code rollback takes seconds and restores previous application logic.
2. **Data Preservation**:
   - Historical source PDFs (`source-documents/{sha256}.pdf`) are **NEVER deleted or mutated** during a code rollback.
   - Firestore audit records and historical run logs remain intact as immutable evidence.
3. **Derived Layer Re-computation**:
   - Downstream layers (corpus, feature matrices, modeling datasets) can be deterministically re-derived at any time from the immutable source PDFs.

---

## 13. Operational Runbook

### Step 1: Pre-Deployment Verification
Run quality gates and DEV verification:
```bash
npm test
npm run typecheck
npm run build
npx tsx services/ingestion/scripts/verify-dev-scheduled-ingestion-8b.ts
```

### Step 2: PROD Historical Baseline Bootstrap
Promote existing validated 100-draw corpus into PROD:
```bash
npm run bootstrap:prod
```

### Step 3: Execute Controlled PROD Verification
Run the 18 production operationalization gates:
```bash
npm run verify:8c
```

### Step 4: Enable PROD Daily Cloud Scheduler
Once verified, update scheduler state in `infra/scheduler/prod-scheduled-ingestion.json` from `DISABLED` to `ENABLED` and apply to GCP:
```bash
# Verify scheduler status
gcloud scheduler jobs describe prod-daily-lottery-ingestion --project=kerala-lottery-intelligence --location=asia-south1
```

### Step 5: Post-Execution Inspection
Inspect the operational health endpoint:
```bash
curl -H "Authorization: Bearer <TOKEN>" https://kerala-lottery-intelligence.web.app/api/internal/daily-ingestion
```
Verify `lastSuccessfulRun.status === "SUCCEEDED"` and `alreadyKnownCount >= 1`.

---

## 14. Milestone 8C Final Verification & Completion Report

This section documents the live verification executed on **29/09/2026** against the Google Cloud production project `kerala-lottery-intelligence`.

### Architectural State Distinction

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        MILESTONE 8C PRODUCTION ACTIVATION MATRIX                       │
├────────────────────────────────────────────────────┬───────────────────────────────────┤
│ PRODUCTION INFRASTRUCTURE READY                    │ PRODUCTION AUTOMATION ENABLED     │
│ [STATUS: COMPLETE & FULLY VERIFIED]                │ [STATUS: STRICTLY DISABLED/PAUSED]│
├────────────────────────────────────────────────────┼───────────────────────────────────┤
│ ✓ PROD GCP Project Identity (660682986882)         │ ⏸ Cloud Scheduler Cron Trigger   │
│ ✓ PROD Cloud Storage (100 immutable source PDFs)   │   Job: prod-daily-lottery-ingest  │
│ ✓ PROD Firestore Documents (100 verified draws)    │   State: PAUSED (Disabled)        │
│ ✓ Canonical Population: 100 draws / 38,416 results │   Schedule: 0 17 * * * Asia/Kolkata│
│ ✓ Anchor Draw BT-73 present & SHA verified         │                                   │
│ ✓ BT-73 Replay Idempotency (0 duplicates)          │ Reason: In accordance with safety │
│ ✓ OIDC Scheduler SA Authentication (prod-ingest...)│ directive #8, automated daily     │
│ ✓ Private Ingestion Route Authorization (401/403)  │ cron triggers remain disabled     │
│ ✓ Controlled Ingestion Execution (SUCCEEDED)       │ until all pre-flight verification │
│ ✓ Live PROD Firestore Audit Record Persisted       │ gates and explicit operational    │
│ ✓ Bidirectional DEV / PROD Isolation Fail-Closed   │ sign-off are completed.           │
│ ✓ All 18 Milestone 8C Quality Gates Passed         │                                   │
└────────────────────────────────────────────────────┴───────────────────────────────────┘
```

### 1. Live Production Resource Verification Facts
- **Google Cloud Project ID**: `kerala-lottery-intelligence`
- **Google Cloud Project Number**: `660682986882`
- **Google Cloud Storage Bucket**: `gs://kerala-lottery-intelligence.firebasestorage.app/`
  - Validated Object Count: **100 / 100** historical PDF documents present under `source-documents/{sha256}.pdf`.
  - Immutable Write Policy: `putIfAbsent` prevents overwrite mutation.
- **Cloud Firestore Database**: `projects/kerala-lottery-intelligence/databases/(default)`
  - Validated Collection Count: **100 / 100** source draw documents present under `/documents/{sha256}`.
- **Authoritative Baseline Corpus**:
  - Validated Historical Draws: **100**
  - Validated Winning Numbers: **38,416**
  - Corpus ID: `corpus_c81ab9977e59871d`
  - Canonical Modeling Dataset ID: `mdset_a98689605fd85f58`
- **Anchor Historical Draw**:
  - Draw: **BHAGYATHARA BT-73** (Draw Date: 28/09/2026)
  - Canonical SHA-256: `cddb3d4d05c102b98f38050ac1ff297ad15bc442b12087c0505927f7bb1cf3dc`
  - Presence: Confirmed in Cloud Storage and Firestore.

### 2. Replay Idempotency & Duplicate Elimination (BT-73)
- **Replay Candidate**: `271-2346-28-09-2026.pdf` (sourceResponseFilename: `BT-73.pdf`)
- **Observed Ingestion Outcome**:
  - Candidates Discovered: `1`
  - Action Taken: `ALREADY_KNOWN` (`1`)
  - Newly Ingested Documents: `0`
  - Duplicate Document Writes: `0`
  - Duplicate Result Writes: `0`
  - Run Status: `SUCCEEDED`

### 3. Cloud Scheduler State (Strictly Disabled)
- **Job Name**: `projects/kerala-lottery-intelligence/locations/asia-south1/jobs/prod-daily-lottery-ingestion`
- **Schedule**: `0 17 * * *` (5:00 PM IST daily)
- **Timezone**: `Asia/Kolkata`
- **Target URI**: `https://kerala-lottery-intelligence.web.app/api/internal/daily-ingestion`
- **OIDC Service Account**: `prod-ingestion-scheduler@kerala-lottery-intelligence.iam.gserviceaccount.com`
- **Live GCP API State**: `PAUSED` (Job is completely paused and will not trigger autonomously).

### 4. Scheduler Identity Authentication & Private Endpoint Proof
- **Anonymous Call**: `POST /api/internal/daily-ingestion` without auth header is rejected with `HTTP 401 Unauthorized`.
- **Cross-Environment Call**: Calling PROD endpoint with DEV service account token (`dev-ingestion-scheduler@kerala-lottery-intel-dev...`) is rejected with `HTTP 403 Forbidden`.
- **Authorized Invocation**: Service account `prod-ingestion-scheduler@kerala-lottery-intelligence.iam.gserviceaccount.com` is accepted.
- **Controlled Run Execution**:
  - Run ID: `run_scheduled_2026-09-29T02-40-00-698Z_5l2awt`
  - Trigger: `SCHEDULED`
  - Concurrency Lock: Acquired (`true`)
  - Execution Status: `SUCCEEDED`
- **Live PROD Firestore Audit**:
  - Path: `/ingestion_runs/run_scheduled_2026-09-29T02-40-00-698Z_5l2awt`
  - Status Field: `SUCCEEDED`
  - Environment Field: `PROD`
  - Ingested Count: `0` (Zero duplicate writes)

### 5. Bidirectional DEV / PROD Isolation Proof
- DEV configuration supplied to `assertProdEnvironment` is rejected immediately with `EnvironmentViolationError`.
- PROD configuration supplied to `assertDevEnvironment` is rejected immediately with `EnvironmentViolationError`.
- Cross-environment storage buckets (`kerala-lottery-intel-dev.firebasestorage.app` in PROD or `kerala-lottery-intelligence.firebasestorage.app` in DEV) fail closed immediately.
- Cross-environment service account tokens are rejected at route boundaries with `HTTP 403 Forbidden`.

### 6. Quality Gates Verification Matrix
| Quality Gate | Tool / Script | Status | Details |
| :--- | :--- | :--- | :--- |
| **8C Operationalization Gates** | `npm run verify:8c` | **PASS (18/18)** | All 18 production operationalization gates passed |
| **TypeScript Typecheck** | `npm run typecheck` | **PASS** | 0 type errors across monorepo (`tsconfig.base.json`) |
| **Unit & Integration Tests** | `npm test` | **PASS (437/437)** | 28 test suites, 437 passed, 19 skipped |
| **Firestore Security Rules** | `npm run test:rules` | **PASS (19/19)** | Security rules emulator verification passed |
| **Production Build** | `npm run build` | **PASS** | Next.js 15.5.25 optimized production build succeeded |
| **Live PROD Activation** | `verify-prod-activation.ts` | **PASS** | Live GCP identity, storage, firestore, audit verified |

