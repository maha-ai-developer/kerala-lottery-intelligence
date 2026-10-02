# Milestone 9A: Production Research API & Read-Only Application Specification

**Status**: VERIFIED & PASSING (15/15 Quality Gates)  
**Date**: September 29, 2026  
**Environment**: Production (`kerala-lottery-intelligence`)  
**Branch**: `develop`  
**Security Posture**: Read-Only Research Surface; Zero Mutation; Secret Sanitization Enforced  
**Scheduler Posture**: Strictly `PAUSED` / `DISABLED`  

---

## 1. Executive Summary & Architecture

Milestone 9A delivers the official read-only research surface for the verified Kerala State Lottery Intelligence platform. It exposes the authoritative corpus of 100 historical gazetted draws and 38,416 cryptographically ground-truth winning results to human researchers and scientific consumers without permitting any data mutation.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   PRODUCTION VERIFIED DATA (IMMUTABLE)                 │
│  - 100 Gazetted PDF Source Documents (SHA-256 Verified)                │
│  - 100 Historical Draws & 38,416 Winning Results                      │
│  - 16 Authoritative Prize Schemes (15 Official, 1 Observed Archetype)  │
│  - Empirical Statistical Distributions & Chronological Holdout Models  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   READ-ONLY RESEARCH API (/api/v1)                     │
│  - 13 Versioned REST Endpoints with Deterministic Pagination           │
│  - Strict HTTP 405 Method Not Allowed for POST/PUT/DELETE/PATCH        │
│  - Immutable Cache-Control Headers for Historical Facts                │
│  - Zero Secret Leakage (Sanitized Operational Telemetry)               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                WEB RESEARCH APPLICATION (apps/web)                     │
│  - 11 Dedicated Research & Provenance Inspection Screens               │
│  - Anchor Investigation: BHAGYATHARA BT-73 End-to-End Traversal        │
│  - Canonical Leading Zero String Preservation ("0276")                 │
│  - Prominent Non-Predictive Scientific Boundary Notices                │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
                             HUMAN RESEARCHER
```

---

## 2. Research Data Domains (12 Domains)

The research platform exposes read access across 12 structured domains:

| # | Domain | Primary Identifier | Population | Authority Level |
|---|---|---|---|---|
| 1 | **Source Documents** | SHA-256 Hash | 100 PDFs | Gazette SRO / Directorate |
| 2 | **Lotteries** | Series Code (`BT`, `KR`, `SS`, etc.) | 9 Families | Directorate of Kerala State Lotteries |
| 3 | **Draws** | `draw_{cleanDrawNum}` | 100 Draws | Official Gazetted Draws |
| 4 | **Prize Schemes** | Scheme Version ID | 16 Schemes | 15 Official, 1 Observed Archetype |
| 5 | **Winning Results** | Result Node UUID | 38,416 Numbers | Gazette Verified |
| 6 | **Series** | 2-Letter Code (`WA`–`WM`) | 10–12 Series/Draw | Authorized Ticket Series |
| 7 | **Historical Statistics** | Statistical Population | 38,416 Records | Empirical Descriptive |
| 8 | **Statistical Experiments** | Experiment ID | Holdout / Rolling | Reproducible Benchmarks |
| 9 | **Backtests** | Backtest ID | Folds 1..19 | Chronological Walk-Forward |
| 10 | **Evaluation Models** | Model ID | 3 Baselines | Uniform, Empirical, Majority |
| 11 | **Ingestion Runs** | Ingestion Run ID | Audited Runs | Sanitized Operational Telemetry |
| 12 | **Search & Lookup** | Cross-domain query `q` | Real-time Index | Deterministic Token Match |

---

## 3. Versioned REST API Contracts (`/api/v1/...`)

All endpoints are hosted under `apps/web/app/api/v1/` and enforce HTTP read-only semantics.

### Endpoints Catalog

1. `GET /api/v1/lotteries`: Lists all 9 active/seasonal Kerala lottery families.
2. `GET /api/v1/draws`: Lists historical draws with deterministic bounded pagination and filtering.
3. `GET /api/v1/draws/:drawId`: Returns complete metadata, series, prize tiers, and provenance for a draw.
4. `GET /api/v1/draws/:drawId/results`: Returns paginated winning numbers for a draw with leading-zero preservation.
5. `GET /api/v1/schemes`: Lists all 16 registered prize schemes with authority classification.
6. `GET /api/v1/schemes/:schemeId`: Returns tier rules, payouts, prize counts, and statutory citations.
7. `GET /api/v1/sources/:sha256`: Returns cryptographic provenance, GCS path, and byte size for a source PDF.
8. `GET /api/v1/statistics`: Returns empirical digit distributions, Shannon entropy, and Chi-square uniformity metrics.
9. `GET /api/v1/experiments`: Returns temporal holdout experiment definitions and evaluation metrics.
10. `GET /api/v1/backtests`: Returns walk-forward validation results across chronological folds.
11. `GET /api/v1/models`: Returns baseline statistical reference models and theoretical accuracy bounds.
12. `GET /api/v1/ingestion/runs`: Returns sanitized pipeline execution history and audit logs.
13. `GET /api/v1/search?q=...`: Cross-domain search across draw numbers, lottery names, and ticket digits.

### Pagination Contract

Every list endpoint requires bounded pagination:
- `page`: 1-based page index (default: `1`).
- `pageSize` or `limit`: Items per page (default: `20`, maximum: `100`).
- Values above 100 are automatically clamped to 100.
- Responses contain a standard `pagination` envelope:
  ```json
  {
    "page": 1,
    "pageSize": 20,
    "totalCount": 100,
    "totalPages": 5,
    "hasMore": true
  }
  ```

### HTTP Response & Cache Header Specification

| Response Type | HTTP Status | Cache-Control Header | Security Headers |
|---|---|---|---|
| Historical Data (Immutable) | `200 OK` | `public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400` | `X-Content-Type-Options: nosniff`<br>`X-Frame-Options: DENY` |
| Dynamic Telemetry / Ingestion | `200 OK` | `no-store, no-cache, must-revalidate` | `X-Content-Type-Options: nosniff` |
| Mutation Attempts (`POST`, `PUT`, `DELETE`, `PATCH`) | `405 Method Not Allowed` | `no-store, no-cache, must-revalidate`<br>`Allow: GET` | `X-Content-Type-Options: nosniff` |
| Bad Request / Not Found | `400 / 404` | `no-store, no-cache, must-revalidate` | `X-Content-Type-Options: nosniff` |

---

## 4. Real-World Anchor: BHAGYATHARA BT-73

The canonical reference draw **BHAGYATHARA BT-73** acts as the platform's anchor for end-to-end provenance:

- **Draw Number**: `BT-73rd`
- **Draw Date**: `28/09/2026`
- **Canonical Repository Filename**: `271-2346-28-09-2026.pdf` (adheres strictly to the repository's observed official gazette naming convention `<code1>-<code2>-<DD-MM-YYYY>.pdf`, where 2346 is the consecutive Monday sequence index following 2343, 2344, 2345)
- **Source HTTP Response Filename**: `BT-73.pdf` (returned dynamically via `Content-Disposition: inline; filename="BT-73.pdf"`)
- **Source Acquisition URL**: `http://result.keralalotteries.com/viewlotisresult.php?drawserial=75393`
- **Immutable Byte Identity (SHA-256)**: `cddb3d4d05c102b98f38050ac1ff297ad15bc442b12087c0505927f7bb1cf3dc`
- **Storage Location**: `gs://kerala-lottery-intelligence.firebasestorage.app/source-documents/cddb3d4d05c102b98f38050ac1ff297ad15bc442b12087c0505927f7bb1cf3dc.pdf`
- **Governing Scheme**: `scheme_ver_bt_v2025-11-sro1297` (`OFFICIAL_SCHEME`, S.R.O. No. 1297/2025)
- **Winning Numbers**: Exactly 378 verified winning numbers:
  - **Full Ticket (1st Prize + Consolation)**: 14 tickets (e.g. `WA 75382`)
  - **Suffix (2nd Prize through 8th Prize)**: 364 tickets (e.g. `0276`, `1234`)
  - **Leading Zeros**: String integrity strictly preserved (e.g. `"0276"` never cast to `276`).

```
[BT-73 Draw Record]
       │
       ├─► Source Document: cddb3d4d05c102b98f38050ac1ff297ad15bc442b12087c0505927f7bb1cf3dc (100% Match)
       │
       ├─► Prize Scheme: scheme_ver_bt_v2025-11-sro1297 (10 Tiers, OFFICIAL_SCHEME)
       │
       └─► 378 Winning Results (14 Full Ticket + 364 Suffix, Canonical Strings Intact)
```

---

## 5. Authoritative Prize Schemes & Authority Classification

The platform explicitly differentiates statutory rules from observed draw patterns:

1. **`OFFICIAL_SCHEME` (15 Schemes)**:
   - Grounded in published Kerala Gazette Extraordinary S.R.O. statutory orders.
   - Authority Priority: 1.
   - Example: `scheme_ver_bt_v2025-11-sro1297` (S.R.O. 1297/2025, G.O.(P) No.192/2025/TAXES).
2. **`OBSERVED_SCHEME_ARCHETYPE` (1 Scheme — BR-111)**:
   - Thiruvonam Bumper 2026 (BR-111) prize structure inferred directly from official gazetted result PDF `282-2338-26-09-2026.pdf`.
   - Authority Priority: 3.
   - Clearly flagged in API responses and UI with distinct warning badges indicating archetype status pending formal statutory gazette ingestion.

---

## 6. Empirical Statistics & Non-Predictive Boundary

Empirical analysis over the complete 38,416-result corpus (1,462 full-ticket, 36,954 suffix):
- **Shannon Entropy**: $H = 3.3219$ bits (near the theoretical discrete uniform maximum $\log_2(10) \approx 3.3219$ bits, $>99.99\%$ efficiency).
- **Chi-Square Goodness-of-Fit Uniformity**: Computed across digits 0–9 with degrees of freedom $df = 9$.
- **Hypothesis Result**: Consistent with uniform physical randomness.
- **Scientific Notice**:
  > "NON-PREDICTIVE MODELING FOUNDATION NOTICE: This read-only research surface exposes historical Kerala lottery records, gazetted draw results, deterministic prize structures, and empirical statistics for scientific research and educational inquiry only. State lottery draws are independent stochastic physical trials. Past digit frequencies possess strictly zero predictive power for future outcomes. All predictive, gambling, or betting claims are scientifically unfounded and strictly prohibited."

---

## 7. Web Application Research Screens (`apps/web`)

11 dedicated screens built in modern dark-mode scientific aesthetic:

1. **Overview (`/`)**: Key metrics (100 draws, 38,416 results, 100% SHA verified, 16 schemes), BT-73 anchor card, global search, and recent verified draws table.
2. **Lotteries (`/lotteries`)**: Grid of 9 lottery families with verified draw counts and active status.
3. **Draws (`/draws`)**: Filterable table of 100 draws with deterministic pagination, date filters, and links to source PDFs.
4. **Draw Detail (`/draws/:id`)**: Full provenance chain, tier payout hierarchy, and searchable winning numbers table.
5. **Results (`/results`)**: Platform-wide winning numbers search with tier filtering and canonical string verification.
6. **Prize Schemes (`/schemes`)**: Registry view with distinct authority badges (`OFFICIAL_SCHEME` vs `OBSERVED_SCHEME_ARCHETYPE`).
7. **Scheme Detail (`/schemes/:id`)**: Comprehensive breakdown of tier rules, payout amounts, and match lengths.
8. **Statistics (`/statistics`)**: Last-digit and first-digit frequency bars, Shannon entropy metrics, Chi-Square uniformity statistics, and prominent refutation banner.
9. **Experiments & Backtests (`/experiments`)**: Benchmark models (Uniform, Empirical, Majority), chronological holdout metrics, and walk-forward backtest folds.
10. **Ingestion Status (`/ingestion`)**: Operational status, sanitized audit runs, single-flight lock status (`IDLE`), and scheduler state (`DISABLED`).
11. **Source Document Provenance (`/sources/:sha256`)**: Cryptographic SHA-256 hash inspection, GCS bucket path, file attributes, and raw extraction snippet.

---

## 8. Verification Results (15/15 Quality Gates PASS)

The automated verifier `services/ingestion/scripts/verify-prod-research-surface-9a.ts` (`npm run verify:9a`) executed and passed all 15 gates:

```
Gate 01 [PASS]: Read-Only Safety Invariant (405 Method Not Allowed rejected)
Gate 02 [PASS]: 12 Data Domains Coverage (All domains active)
Gate 03 [PASS]: 100 Verified Historical Draws (Deterministic descending order)
Gate 04 [PASS]: 38,416 Total Results Invariant (1,462 full-ticket, 36,954 suffix)
Gate 05 [PASS]: Real-World Anchor BT-73 (28/09/2026, 378 results verified)
Gate 06 [PASS]: Canonical String Integrity (Leading zeros preserved)
Gate 07 [PASS]: Prize Scheme Classification (15 Official, 1 Observed BR-111)
Gate 08 [PASS]: Source Document Cryptographic Grounding (kerala-lottery-intelligence.firebasestorage.app)
Gate 09 [PASS]: Bounded Deterministic Pagination (Default 20, max clamped 100)
Gate 10 [PASS]: HTTP Header & Cache Contracts (Immutable cache & no-store)
Gate 11 [PASS]: Secret Scrubbing & Sanitization (Zero credentials exposed)
Gate 12 [PASS]: Operational State Integrity (Scheduler PAUSED, Lock IDLE)
Gate 13 [PASS]: Statistical Uniformity & Entropy (H = 3.3219 bits, df = 9)
Gate 14 [PASS]: Temporal Separation & Benchmarks (Holdout & Walk-forward, 3 formal models)
Gate 15 [PASS]: Non-Predictive Scientific Boundary (Mandatory disclaimers)
```
