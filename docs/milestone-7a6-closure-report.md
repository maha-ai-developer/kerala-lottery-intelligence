# Milestone 7A.6 Closure Report — Prize Structure & Scheme Registry

## 1. Overview & Objective
Milestone 7A.6 introduces an authoritative, versioned Prize Scheme / Prize Structure Registry into the Kerala State Lottery Intelligence & Experiment Platform.

The registry rigorously establishes the boundary between:
1. **Official Scheme Rules**: Promulgated via Government of Kerala Extraordinary Gazettes and Statutory Rules & Orders (S.R.O.).
2. **Observed Draw Results**: Extracted from official daily result PDFs.
3. **Theoretical Scheme Capacity**: The mathematical "up to" ceiling defined by ticket issuance and repetition rules (e.g. $19 \times 1,080 = 20,520$).
4. **Actual Observed Winners**: The distinct winning numbers selected in a specific draw.

**Strict Scientific Invariant**: Descriptive Historical Research Only. Non-predictive.

---

## 2. Authoritative Source Hierarchy & Provenance
Scheme definitions adhere to the strict authority priority hierarchy:
1. **Priority 1: Government of Kerala Gazette / S.R.O. Notification** (Primary Authority)
2. **Priority 2: Official Kerala State Lotteries Publication**
3. **Priority 3: Official Result PDF** (Observed-result authority, fallback archetype)
4. **Priority 4: Third-Party Reference** (Discovery only, never authoritative)

### Verified Official S.R.O. Source Documents
| Lottery | Gazette No. | Order No. | S.R.O. No. | Publication Date | SHA-256 Digest |
|---|---|---|---|---|---|
| **Bhagyathara (BT)** | 3982 | G.O.(P) No.192/2025/TAXES | S.R.O. 1297/2025 | 10/11/2025 | `282cefde6d91660d1b897ed085ebf0cf0262e7c8d3ff0ed884c4d61a133e6703` |
| **Dhanalekshmi (DL)** | 3981 | G.O.(P) No.191/2025/TAXES | S.R.O. 1296/2025 | 10/11/2025 | `bd3ad7ea79750c4ab91f91d2c7c97935ce543aa8d62bcec8631129516b3588ab` |
| **Karunya Plus (KN)** | 3979 | G.O.(P) No.189/2025/TAXES | S.R.O. 1294/2025 | 10/11/2025 | `d4f8e6f2bda9bff364b0eb7ca8a375c843da311a6f78a2d17b50986818466b85` |

---

## 3. Scheme Registry Architecture & Contracts
Implemented in [`packages/domain/src/prize-scheme.ts`](file:///home/pi/kerela-lottery-project/kerala-lottery-intelligence/packages/domain/src/prize-scheme.ts):
- `SchemeType`: `"WEEKLY" | "BUMPER" | "OTHER"`
- `SchemeStatus`: `"ACTIVE" | "SUPERSEDED" | "PROPOSED" | "DRAFT"`
- `SelectionBasis`:
  - `COMMON_TO_ALL_SERIES`: 1 ticket across all series (1st, 2nd, 3rd in weekly; 1st in bumper)
  - `ONE_PER_SERIES`: 1 ticket per series (e.g. 5 prizes in Monsoon Bumper Tier II-IV; 10 in Thiruvonam Tier IV-V)
  - `N_PER_SERIES`: $N$ tickets per series (e.g. 2 per series = 20 in Thiruvonam Tier II-III)
  - `LAST_FOUR_DIGITS`: Suffix matching drawn repetition count
  - `CONSOLATION`: Winning ticket number in remaining series ($N-1$ series)
- `SeriesRule`: Encapsulates series count, naming patterns, and selection scope.
- `PrizeTierRule`: Rich specification including rank, category, amount, currency, selectionBasis, numberLength, seriesScope, drawCount, maximumPrizeCount, isConsolation, isSuffix, and sourceEvidence.
- `PrizeSchemeVersion`: Versioned unit of official scheme rule with temporal validity (`effectiveFrom`, `effectiveTo`, `supersedesSchemeId`).
- `PrizeScheme`: Multi-version container for a lottery family.

---

## 4. Scheme Versioning & Supersession
The registry models legal supersession over time without data loss:
- **Bhagyathara (BT)**:
  - Version 1 (`scheme_ver_bt_v2025-09-sro1062`): S.R.O. 1062/2025, effective 17/09/2025 to 09/11/2025. Status: `SUPERSEDED`.
  - Version 2 (`scheme_ver_bt_v2025-11-sro1297`): S.R.O. 1297/2025, effective 10/11/2025 onwards. Status: `ACTIVE`. Supersedes Version 1.
- **Dhanalekshmi (DL)**:
  - Version 1 (`scheme_ver_dl_v2025-09-sro1060`): S.R.O. 1060/2025, effective 17/09/2025 to 09/11/2025. Status: `SUPERSEDED`.
  - Version 2 (`scheme_ver_dl_v2025-11-sro1296`): S.R.O. 1296/2025, effective 10/11/2025 onwards. Status: `ACTIVE`. Supersedes Version 1.
- **Karunya Plus (KN)**:
  - Version 1 (`scheme_ver_kn_v2025-09-sro1061`): S.R.O. 1061/2025, effective 17/09/2025 to 09/11/2025. Status: `SUPERSEDED`.
  - Version 2 (`scheme_ver_kn_v2025-11-sro1294`): S.R.O. 1294/2025, effective 10/11/2025 onwards. Status: `ACTIVE`. Supersedes Version 1.

---

## 5. Weekly vs Bumper Scheme Archetypes
Weekly and Bumper lotteries are strictly separated in typing and structure:
- **Weekly Lotteries (BT, DL, KN)**:
  - `schemeType: "WEEKLY"`
  - 12 series (e.g. 1,08,00,000 tickets printed; 9,00,000 per series)
  - 1st, 2nd, 3rd prizes: `COMMON_TO_ALL_SERIES` (6-digit full tickets)
  - Consolation: `CONSOLATION` (11 prizes across remaining series)
  - 4th through 9th/10th prizes: `LAST_FOUR_DIGITS` (4-digit suffixes)
- **Monsoon Bumper (BR-110)**:
  - `schemeType: "BUMPER"`
  - 5 series (`MA`, `MB`, `MC`, `MD`, `ME`; 45,00,000 tickets printed)
  - 1st Prize: ₹10,00,00,000 (Common, 1 prize)
  - Consolation: ₹1,00,000 (4 prizes across remaining 4 series)
  - 2nd, 3rd, 4th Prizes: `ONE_PER_SERIES` (₹10L, ₹5L, ₹3L; 5 prizes each across MA..ME)
  - 5th to 8th Prizes: `LAST_FOUR_DIGITS` (30, 90, 252, 306 draws)
- **Thiruvonam Bumper (BR-111)**:
  - `schemeType: "BUMPER"`
  - 10 series (`TA`, `TB`, `TC`, `TD`, `TE`, `TG`, `TH`, `TJ`, `TK`, `TL`; 90,00,000 tickets printed)
  - 1st Prize: ₹30,00,00,000 (Common, 1 prize)
  - Consolation: ₹5,00,000 (9 prizes across remaining 9 series)
  - 2nd, 3rd Prizes: `N_PER_SERIES` (2 per series = 20 prizes each)
  - 4th, 5th Prizes: `ONE_PER_SERIES` (1 per series = 10 prizes each)
  - 6th to 9th Prizes: `LAST_FOUR_DIGITS` (60, 90, 138, 306 draws)

---

## 6. Draw-to-Scheme Resolution & Result Validation
### Resolution Engine (`resolvePrizeSchemeForDraw`)
Inputs: `lotteryName`, `drawDate`, optional `drawType`.
Outputs:
- `SCHEME_RESOLVED`: Deterministic match based on active validity window and supersession.
- `SCHEME_NOT_FOUND`: Explicitly returned when no authoritative scheme exists for the lottery or date. **No guessing or silent fallbacks.**
- `SCHEME_RESOLUTION_AMBIGUOUS`: Returned if multiple overlapping versions exist without supersession resolution.

### Validation Engine (`validateDrawAgainstPrizeScheme`)
Verifies:
- Lottery code and scheme type alignment
- Prize tier ranks, amounts, and currency
- Expected digit length (6 for full tickets, 4 for suffixes)
- Suffix vs Full Ticket mode compatibility
- Theoretical capacity vs observed winner count compatibility

---

## 7. Historical Corpus Validation Report (98 Draws)
Execution of `services/ingestion/scripts/verify-dev-prize-scheme-registry-7a6.ts`:

```
============================================================
HISTORICAL CORPUS PRIZE SCHEME VALIDATION REPORT
============================================================
TOTAL DRAWS:             98
SCHEME RESOLVED:         43
SCHEME NOT FOUND:        55
SCHEME AMBIGUOUS:        0
SCHEME VALIDATED:        43
SCHEME MISMATCH:         0
------------------------------------------------------------
Lottery Resolution Breakdown:
  - BHAGYATHARA                  Resolved: 14, Not Found:  0
  - STHREE-SAKTHI                Resolved:  0, Not Found: 14
  - DHANALEKSHMI                 Resolved: 13, Not Found:  0
  - KARUNYA PLUS                 Resolved: 14, Not Found:  0
  - SUVARNA KERALAM              Resolved:  0, Not Found: 15
  - KARUNYA                      Resolved:  0, Not Found: 12
  - SAMRUDHI                     Resolved:  0, Not Found: 14
  - MONSOON BUMPER               Resolved:  1, Not Found:  0
  - THIRUVONAM BUMPER LOTTERY    Resolved:  1, Not Found:  0
============================================================
```

### Unresolved Schemes Justification
- **Sthree-Sakthi (SS)**: 14 draws. Supplied PDF was a result PDF (`SS-537th`), not a Gazette S.R.O. Correctly left unassigned (`SCHEME_NOT_FOUND`).
- **Suvarna Keralam (SK)**: 15 draws. Supplied PDF was a result PDF (`SK-14th`), not a Gazette S.R.O. Correctly left unassigned (`SCHEME_NOT_FOUND`).
- **Karunya (KR)**: 12 draws. No Gazette S.R.O. supplied. Correctly left unassigned (`SCHEME_NOT_FOUND`).
- **Samrudhi (SM)**: 14 draws. No Gazette S.R.O. supplied. Correctly left unassigned (`SCHEME_NOT_FOUND`).

---

## 8. Quality Gates Status
| Quality Gate | Command | Result |
|---|---|---|
| Domain Unit Tests | `npm test` | **23 test files passed, 320 passed (18 skipped)** |
| Prize Scheme Tests | `vitest packages/domain/src/prize-scheme.test.ts` | **24/24 tests passed (723ms)** |
| TypeScript Typecheck | `npm run typecheck` | **0 errors, strict mode clean** |
| Production Build | `npm run build` | **All packages & Next.js web app built successfully** |
| Firestore Security Rules | `npm run test:rules` | **18/18 tests passed, emulator clean shutdown** |
| Canonical Dev Verifier | `npx tsx services/ingestion/scripts/verify-dev-prize-scheme-registry-7a6.ts` | **100% success, 0 mismatches across 98 draws** |

---

## 9. Git & Branch Verification
- **Branch**: `develop` (ONLY)
- **Commit**: `1f3391b` — `feat(domain): add versioned prize scheme registry`
- **Pushed To**: `origin/develop`
- **Main Status**: Untouched at `728ebc5` (`origin/main`, `main`)
