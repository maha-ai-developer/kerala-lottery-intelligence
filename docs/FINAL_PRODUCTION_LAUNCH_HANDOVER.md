# Final Production Launch, Corpus Synchronization, Multilingual UX & Release Freeze Handover

**Project:** Kerala Lottery Intelligence (`maha-ai-developer/kerala-lottery-intelligence`)
**Release State:** Production Launch & Post-Release Maintenance Freeze
**Active Research Corpus:** `corpus_2dd9b930c32ea047` (`active-research-119draws`, cutoff `18/10/2026`, `119` draws, `45,600` `WinningResult` records)
**Preserved V1.0 Baseline:** `corpus_981356dd505db164` (`v1.0-research-114draws`, cutoff `13/10/2026`, `114` draws, `43,712` `WinningResult` records)

---

## 1. Executive Summary

Kerala Lottery Intelligence has completed its final planned implementation release:
1. **Production Data Parity & Verified Results:** All `119` verified official Kerala State Lotteries draws through **SAMRUDHI `SM-77th` (`18/10/2026`)** (`45,600` total `WinningResult` records: `1,728` full tickets + `43,872` 4-digit suffixes) are present and cryptographically verified across local repository caches, PROD Cloud Storage (`gs://kerala-lottery-intelligence.firebasestorage.app/source-documents/{sha256}.pdf`), and PROD Cloud Firestore (`documents/{sha256}`).
2. **Corpus Synchronization & Post-Ingestion Refresh Pipeline:** A single post-ingestion refresh service (`apps/web/lib/post-ingestion-refresh.ts`) synchronizes active corpus versions, invalidates server-side caches, recomputes active statistics, refreshes deterministic experiment baselines (`EXP-001`, `EXP-002`, `EXP-003`), updates versioned findings and evidence bundles, and clearly distinguishes the **Active Research Corpus** (`119` draws), **Frozen V1.0 Baseline** (`114` draws), and **Curated Geography Snapshot** (`103` draws / `380` top-tier prize location records).
3. **Guided User Journey & Transparent Decision Guide:** The main dashboard (`apps/web/app/page.tsx`) provides a clean 3-step user journey (**Step 1: Official Results**, **Step 2: Ticket / Suffix Analysis & Transparent Decision Guide**, **Step 3: Research & Evidence Overview**) while moving low-level engineering diagnostics into a collapsible **Advanced Operational & Provenance Details** drawer.
4. **Multilingual Support (`en`, `ml`, `ta`):** Full support for **English (Default)**, **മലയാളം (Malayalam)**, and **தமிழ் (Tamil)** via a persistent header language selector (`apps/web/components/navigation.tsx`), static dictionary + glossary (`apps/web/lib/i18n.tsx`), and dynamic translation fallback (`POST /api/v1/translate`) with strict canonical token preservation (`maskCanonicalTokens` / `restoreCanonicalTokens`) that never alters draw codes, ticket numbers, SHA-256 hashes, dates, or numeric values.
5. **Dual Acceptance Verification Gates:** Both `npm run verify:v1` (`28/28` gates preserving the immutable V1.0 baseline) and `npm run verify:active-corpus` (`6/6` gates verifying the 119-draw active corpus and PROD parity) execute in CI and pass 100%.

---

## 2. Production Defects Resolved (Phase 2 Root-Cause Summary)

| Surface / Defect | Root Cause | Resolution |
| :--- | :--- | :--- |
| **Results Navigation Stopping at 28 Sep 2026 in PROD** | PROD Firestore (`kerala-lottery-intelligence`) only held the initial 100-draw baseline through `28/09/2026`, and `apps/web/lib/data-loader.ts` halted once Firestore returned a non-empty snapshot instead of merging validated local active-corpus draws. | Updated `apps/web/lib/data-loader.ts` to merge Firestore draws with verified local active-corpus cache files (`deduplicated by drawId`) and migrated all 19 verified post-28/09 official draws (`SS-539th` through `SM-77th`) to PROD Cloud Storage and Firestore using create-only semantics. |
| **Statistics Displaying Stale / Conflicting Denominators** | Statistics surfaces mixed historical baseline counts (`38,416` / `43,712`) with active corpus counts without distinguishing observation denominators. | Added `corpusSummary` to `GET /api/v1/statistics` and `apps/web/app/statistics/page.tsx`, explicitly separating **Active Corpus Draws (`119`)**, **Active WinningResult Records (`45,600`)**, **Full-Ticket Records (`1,728`)**, **4-Digit Suffix Records (`43,872`)**, **Distinct WinningNumber Nodes (`9,820`)**, and **Preserved V1.0 Baseline (`114` draws / `43,712` records)**. |
| **Continuous Research & Milestone 9B Labeling** | Experiment runs and findings from the 114-draw V1.0 baseline were displayed without distinguishing active-corpus evaluations from historical V1.0 snapshots. | Added `services/ingestion/scripts/refresh-active-research.ts` and `apps/web/lib/post-ingestion-refresh.ts` to evaluate `EXP-001`, `EXP-002`, and `EXP-003` against the active 119-draw corpus (`corpus_2dd9b930c32ea047`), while preserving V1.0 runs (`corpus_981356dd505db164`) as historical records. |
| **Historical Evidence & Cross-Surface Corpus Metadata** | Research surfaces (`Findings`, `Experiments`, `Geography`, `Research Sandbox`, `Candidate Lab`) did not expose a unified active-corpus vs. historical-snapshot banner. | Standardized `activeCorpus` and `frozenV1Baseline` metadata across `/api/v1/draws`, `/api/v1/statistics`, `/api/v1/findings`, `/api/v1/experiment-results`, `/api/v1/geography`, `/api/v1/research-sandbox`, and `/api/v1/candidate-lab`, and added regression tests in `apps/web/__tests__/api-routes.test.ts`. |

---

## 3. Data Architecture & Corpus Identity Ledger (Phase 3)

| Corpus Identity | Corpus Version ID | Version Tag | Total Draws | Total `WinningResult` Records | Full-Ticket Records | 4-Digit Suffix Records | Date Window (IST) | Latest Draw |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Active Research Corpus** | `corpus_2dd9b930c32ea047` | `active-research-119draws` | `119` | `45,600` | `1,728` | `43,872` | `20/06/2026` – `18/10/2026` | `SM-77th` (`18/10/2026`) |
| **Preserved V1.0 Baseline** | `corpus_981356dd505db164` | `v1.0-research-114draws` | `114` | `43,712` | `1,658` | `42,054` | `20/06/2026` – `13/10/2026` | `BT-24th` (`13/10/2026`) |
| **Curated Geography Snapshot** | `geo-curated-103draws` | `103-draw-380-obs-snapshot` | `103` | `380` (location obs.) | `380` | `0` | `20/06/2026` – `01/10/2026` | Curated top-tier district dataset |

### Active Corpus Research Lineage (`corpus_2dd9b930c32ea047`)
- **Experiment Runs:**
  - `EXP-001` (4-Digit Uniformity): `run_6b4bb339e1b860b7` -> Validation `val_430b991a778c35e1` -> Finding `find_ca864c23f10ca51e` -> Evidence `evb_30ee982eb21a568a` -> Report `rep_ca864c23f10ca51e`
  - `EXP-002` (Serial Autocorrelation): `run_53259e1b8cbdee3c` -> Validation `val_77cadde0f85c7f33` -> Finding `find_a92351bde8c69c6a` -> Evidence `evb_8ddd0743b2e312a3` -> Report `rep_a92351bde8c69c6a`
  - `EXP-003` (Prize Structure Variance): `run_eac739264b7b9c56` -> Validation `val_77cadde0f85c7f33` / `val_e9a58626c876364e` -> Finding `find_b2d254e1771b18ef` -> Evidence `evb_42885ed784aaf71d` -> Report `rep_b2d254e1771b18ef`

---

## 4. Production Cloud Migration Evidence (Phase 6)

- **Pre-Migration PROD Inventory (`docs/evidence/prod-pre-migration-inventory.json`):**
  - GCP Project: `kerala-lottery-intelligence` (`315623577179`)
  - Cloud Storage (`gs://kerala-lottery-intelligence.firebasestorage.app/source-documents/`): `100` objects
  - Cloud Firestore (`documents/{sha256}`): `100` documents (cutoff `28/09/2026`, `BT-22nd`)
  - Cloud Scheduler (`prod-daily-lottery-ingestion`): `PAUSED`
- **Migration Execution (`19` Verified Official Draws `SS-539th` through `SM-77th`):**
  - Every PDF was cryptographically verified (SHA-256 + `%PDF-` magic header) and cross-checked against its hydrated knowledge graph (`status === "CONSTRUCTED"`).
  - DEV-only test fixtures (`2b8ed894...` and `9bc76b60...`) were strictly excluded.
  - All `19` PDFs were uploaded to PROD Cloud Storage with `ifGenerationMatch: 0` (create-only, zero overwrites).
  - All `19` document records were created in PROD Firestore with `.create()` (create-only, zero overwrites).
- **Post-Migration PROD Inventory (`docs/evidence/prod-post-migration-inventory.json`):**
  - Cloud Storage Objects: `119` (`100` pre-existing untouched + `19` created)
  - Cloud Firestore Documents: `119` (`100` pre-existing untouched + `19` created)
  - Pre-existing Generation & Timestamp Immutability: `100%` verified (`0` overwrites, `0` deletions)
  - Cloud Scheduler (`prod-daily-lottery-ingestion`): `PAUSED`

---

## 5. Verification Gates & Test Suite Results (Phase 7)

All local and CI verification gates pass with zero errors:
- `npm run typecheck`: **PASS** (`0` TypeScript errors across workspace)
- `CI=true npx vitest run`: **PASS** (`44` test files, `670` tests passed, `0` failed)
- `npm run build`: **PASS** (Next.js 15 production build succeeded across all routes)
- `npm run verify:v1`: **PASS** (`28/28` frozen V1.0 baseline gates passed)
- `npm run verify:active-corpus`: **PASS** (`6/6` active-corpus & PROD parity gates passed)
- `git diff --check`: **PASS** (clean formatting)

---

## 6. Post-Release Maintenance Freeze Policy (Phase 9)

Following the merge of this release into `main` and deployment to Production (`kerala-lottery-intelligence`):
1. **Code Freeze:** Open-ended feature development is frozen. Only security patches, critical defect fixes, and controlled operational maintenance are permitted.
2. **Branch Protection:** `main` requires pull request review and passing CI status checks (`Lint, Typecheck, Test & Build`, including `verify:v1` and `verify:active-corpus`). Direct pushes to `main` are prohibited.
3. **Cloud Scheduler Posture:** `prod-daily-lottery-ingestion` in `kerala-lottery-intelligence` remains `PAUSED` by default; ingestion runs via controlled operator catch-up or verified manual PDF upload with create-only cloud guarantees.
4. **Immutable Baseline Preservation:** Never modify or delete the frozen V1.0 baseline artifacts (`corpus_981356dd505db164` / `docs/evidence/v1-*`).
