# Milestone 10A: Winning Geography, Ticket Distribution & Geographic Provenance

## Executive Summary

Milestone 10A establishes an immutable scientific evidence and geographic provenance layer across the entire 103-draw canonical research corpus of the Kerala State Lottery Platform. Every published location finding is cryptographically grounded in official Kerala Government Gazette result PDFs through an unbroken 11-stage lineage DAG.

Crucially, Milestone 10A enforces the **Critical Denominator Rule**: because official gazette result sheets publish only winning ticket numbers and issuing office locations for top-tier prizes—without publishing district-level ticket sales volumes or unsold counterfoil returns—the system formally reports `EXPOSURE_UNAVAILABLE` and strictly declines to compute exposure-adjusted probabilities or make claims of geographic non-uniformity.

---

## 1. Ground Truth Source Corpus & Extraction Scope

- **Total Canonical PDFs Processed:** 103 of 103 (100.0% complete census).
- **Total Published Winning Results:** 39,550 winning records.
- **Published Major-Prize Locations Extracted:** 380 exact-ticket winning records.
- **Direct District Matches:** 196 (e.g. `PALAKKAD`, `THIRUVANANTHAPURAM`, `KOLLAM`).
- **Administrative Sub-Lottery Office Matches:** 184 (e.g. `PAYYANUR` → Kannur, `KARUNAGAPALLY` → Kollam, `VADAKARA` → Kozhikode, `CHITTUR` → Palakkad).
- **Unmapped / Unknown Locations:** 0 (100.0% verified against official directory).
- **Official Kerala Revenue Districts Represented:** 14 of 14 (100.0%).

---

## 2. Mathematical Corpus Reconciliation & Scheme Semantics

Kerala State Lotteries utilize tiered prize structures with distinct geographic publishing semantics:

| Prize Category | Winning Results | Published Location in Gazette? | Extraction & Representation |
| :--- | :---: | :---: | :--- |
| **Exact-Ticket Major Prizes** (1st, 2nd, 3rd, bumper 4th/5th) | **380** | **YES** (In parentheses `(...)`) | Extracted as `GeographicObservation` with full provenance, page, and text. |
| **Consolation Prizes** | **1,124** | **NO** | Awarded to 1st prize 6-digit number across other series; gazette does not reprint location. |
| **Suffix-Class Prizes** (4th through 9th) | **38,046** | **NO** | Awarded to all tickets in all series matching the 4-digit suffix. Series and location do not exist in gazette. |
| **Total Published Results** | **39,550** | — | **Reconciliation:** $380 + 1,124 + 38,046 = 39,550$ (100.0% exact match). |

---

## 3. Authoritative District Normalization Engine

Kerala consists of exactly **14 official revenue districts**. The Directorate of Kerala State Lotteries administers distribution through **14 District Lottery Offices (DLO)** and **21 Sub Lottery Offices (SLO)**:

1. **Thiruvananthapuram** (DLO Thiruvananthapuram; SLO Attingal, Nedumangad)
2. **Kollam** (DLO Kollam; SLO Karunagapally, Kottarakkara, Punalur)
3. **Pathanamthitta** (DLO Pathanamthitta; SLO Adoor, Thiruvalla)
4. **Alappuzha** (DLO Alappuzha; SLO Chengannur, Cherthala, Kayamkulam)
5. **Kottayam** (DLO Kottayam; SLO Changanassery, Pala, Vaikom)
6. **Idukki** (DLO Idukki / Painavu; SLO Kattappana, Thodupuzha)
7. **Ernakulam** (DLO Ernakulam; SLO Aluva, Muvattupuzha, North Paravur, Perumbavoor)
8. **Thrissur** (DLO Thrissur; SLO Chavakkad, Irinjalakuda, Wadakkancherry)
9. **Palakkad** (DLO Palakkad; SLO Chittur, Pattambi)
10. **Malappuram** (DLO Malappuram; SLO Tirur)
11. **Kozhikode** (DLO Kozhikode; SLO Koyilandy, Thamarassery, Vadakara)
12. **Wayanad** (DLO Wayanad / Mananthavady; SLO Sulthan Bathery, Vythiri)
13. **Kannur** (DLO Kannur; SLO Payyanur, Thalassery, Iritty)
14. **Kasaragod** (DLO Kasaragod; SLO Kanhangad)

### Normalization Guarantees
- **Direct Match:** Exact district name matches receive confidence `1.0` under rule `EXPLICIT_DISTRICT_MATCH`.
- **Administrative Mapping:** Sub-lottery offices cleanly map to parent revenue district under rule `OFFICIAL_SUB_LOTTERY_OFFICE_TO_DISTRICT_MAP`.
- **Fail-Closed Principle:** Any unrecognized or ambiguous string yields `UNKNOWN` with confidence `0.0`. The system never guesses.

---

## 4. Retrospective District Winner Distribution (103 Draws)

| District | Total Major Winners | Direct DLO Matches | Sub-Office SLO Matches | 1st Prize | 2nd Prize | 3rd Prize | 4th/5th Prize |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Palakkad** | **61** | 34 | 27 | 15 | 16 | 26 | 4 |
| **Thrissur** | **42** | 22 | 20 | 17 | 10 | 11 | 4 |
| **Ernakulam** | **35** | 19 | 16 | 12 | 6 | 12 | 5 |
| **Thiruvananthapuram** | **33** | 24 | 9 | 9 | 16 | 6 | 2 |
| **Alappuzha** | **31** | 15 | 16 | 5 | 16 | 10 | 0 |
| **Kottayam** | **29** | 12 | 17 | 8 | 8 | 12 | 1 |
| **Kollam** | **28** | 11 | 17 | 9 | 11 | 6 | 2 |
| **Kannur** | **27** | 10 | 17 | 9 | 8 | 8 | 2 |
| **Idukki** | **22** | 9 | 13 | 3 | 10 | 9 | 0 |
| **Kozhikode** | **21** | 12 | 9 | 3 | 6 | 10 | 2 |
| **Malappuram** | **19** | 11 | 8 | 5 | 8 | 5 | 1 |
| **Pathanamthitta** | **13** | 6 | 7 | 3 | 4 | 5 | 1 |
| **Kasaragod** | **12** | 7 | 5 | 3 | 4 | 4 | 1 |
| **Wayanad** | **7** | 4 | 3 | 2 | 3 | 2 | 0 |
| **Total** | **380** | **196** | **184** | **103** | **126** | **126** | **25** |

*Note: Exactly 103 1st prize winning tickets are recorded across the 103 draws (100% coverage).*

---

## 5. Critical Denominator Rule & Exposure Boundary

### The Core Scientific Dilemma
In lottery statistical analysis, evaluating whether geographic winner distribution conforms to random chance requires knowledge of **ticket exposure** ($E_d = N \cdot \frac{S_d}{S_{\text{total}}}$), where $S_d$ is the number of eligible tickets sold in district $d$.

### Public Data Reality
Official Kerala Government Gazette result sheets publish only the winning ticket serials and the issuing office. **District ticket sales volumes and returned unsold counterfoils are NOT published in the gazette.**

### Platform Invariants
1. **No Surrogate Denominators:** The platform strictly prohibits using raw winner counts, census population, or arbitrary proxies as exposure denominators.
2. **Explicit UNAVAILABLE Notice:** The system emits status `EXPOSURE_UNAVAILABLE` on all geographic analysis artifacts.
3. **No Probability Estimates:** The system declines to calculate exposure-adjusted probabilities or claim geographic bias.
4. **Anti-Prediction Guardrail:** The platform enforces automated rejection of prohibited concepts such as "lucky districts", "hot districts", "best district", or betting recommendations.

---

## 6. Complete 11-Stage Geographic Provenance DAG

Extending Milestone 9D's 10-stage architecture, Milestone 10A implements an 11-stage lineage pipeline:

```
[1. SOURCE_DOCUMENT] (103 Official Kerala Gazette PDFs; SHA-256)
        │
        ▼
[2. DRAW] (103 Verified Draw entities with authoritative dates)
        │
        ▼
[3. PRIZE_SCHEME] (16 Authoritative gazetted prize schemes)
        │
        ▼
[4. PRIZE_TIER] (Explicit prize tier mapping: 1st to 9th, Consolation)
        │
        ▼
[5. WINNING_RESULT] (39,550 Published winning numbers & series)
        │
        ▼
[6. GEOGRAPHIC_OBSERVATION] (380 Exact-ticket issuing office observations)
        │
        ▼
[7. TICKET_EXPOSURE] (STATUS: UNAVAILABLE; Not published in Gazette)
        │
        ▼
[8. GEOGRAPHIC_ANALYSIS] (Descriptive winner frequency distributions)
        │
        ▼
[9. VALIDATION] (Scientific validation enforcing non-predictive guardrails)
        │
        ▼
[10. FINDING] (Retrospective descriptive finding on observed occurrences)
        │
        ▼
[11. EVIDENCE_BUNDLE] (Cryptographic audit trail linking to 103 source SHAs)
```

---

## 7. Read-Only REST API Specification

All endpoints are strictly read-only (`GET` only) with `405 Method Not Allowed` guards on `POST`, `PUT`, `DELETE`, and `PATCH`:

- `GET /api/v1/geography`: Full canonical `GeographicWinnerDataset` (`geowin_544905001fe8711c`).
- `GET /api/v1/geography/districts`: Summaries across all 14 revenue districts.
- `GET /api/v1/geography/winners`: Paginated observations with `district`, `drawId`, `prizeTier` filters.
- `GET /api/v1/geography/draws/:id`: Published geographic observations for a specific draw.
- `GET /api/v1/geography/exposure`: District ticket exposure status (`EXPOSURE_UNAVAILABLE`).
- `GET /api/v1/geography/analysis`: Descriptive statistical analysis and limitation disclosures.
- `GET /api/v1/geography/lineage`: 11-stage provenance lineage DAG for any finding.

---

## 8. Quality Gate Verification Results

All 15 Quality Gates were verified via `npm run verify:10a`:

- **Gate 00 (PROD / Research Boundary):** `main` immutable at `728ebc532303719345daaf0d6698f5651974702b`; scheduler `PAUSED`.
- **Gate 01 (103 PDFs Enumeration):** 103/103 PDFs processed; 380 observations extracted.
- **Gate 02 (Prize-Tier Coverage):** 1st prize location published for 103/103 draws (100.0%).
- **Gate 03 (Prize Semantics Reconciliation):** $380 + 1,124 + 38,046 = 39,550$ results.
- **Gate 04 (Geographic Schema):** Concepts strictly separated; zero conflation with buyer residence.
- **Gate 05 (Provenance Grounding):** All 380 observations record PDF SHA, page number, and verbatim text.
- **Gate 06 (No Unsupported District Inference):** Maps strictly to 14 official districts; fail-closed.
- **Gate 07 (Conflict Preservation):** 0 conflicts across official gazettes; preserves conflicts without silent resolution.
- **Gate 08 (Exposure Denominator Integrity):** `EXPOSURE_UNAVAILABLE` strictly enforced.
- **Gate 09 (Dataset Immutability & Determinism):** Deterministic SHA-256; overwrite throws `IMMUTABILITY_VIOLATION`.
- **Gate 10 (API Read-Only Integrity):** All 7 routes verified with 405 guards.
- **Gate 11 (UI Integrity & Traceability):** Verified at `/geography` with traceability audit modal.
- **Gate 12 (Statistical Integrity & Exposure Guard):** Discloses 4 scientific limitations.
- **Gate 13 (Non-Predictive Boundary & Anti-Hotness):** Rejects gambling/predictive terms.
- **Gate 14 (11-Stage Lineage):** Complete unbroken 11-stage DAG verified.
