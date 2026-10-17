# V1.0 Audit Closeout Remediation & Result-Count Reconciliation

## 1. Overview

This document records the authoritative reconciliation of per-draw result counts across the V1.0 Kerala Lottery Intelligence corpus (`114` draws / `43,712` winning results through `13/10/2026`), the separation of distinct parser and knowledge-graph metrics, the remediation of authentication and operational integrity checks, and the durable preservation of audit evidence.

---

## 2. Parser & Knowledge-Graph Metric Definitions

In [`packages/documents/src/lottery-entity-extraction.ts`](../../packages/documents/src/lottery-entity-extraction.ts), the deterministic PDF parser and graph builder produce two distinct, mathematically related counts for every official Gazette draw PDF:

1. **`WinningResult` Count (`totalResults` / `resultCount`) — Primary Corpus Metric**
   - Every individual winning entry extracted from the official Gazette PDF creates one `WinningResult` entity (`type: "WinningResult"` in `data/processed-cache/graphs/{sha256}.json` and one entry in `data/processed-cache/winning-results-index.json`).
   - Decomposition:
     $$\text{totalResults} = \text{fullTicketCount} + \text{suffixCount}$$
   - For all standard 7-day weekly draws (`SAMRUDHI`, `BHAGYATHARA`, `STHREE-SAKTHI`, `DHANALEKSHMI`, `KARUNYA-PLUS`, `SUVARNA-KERALAM`, `KARUNYA`), the top full-ticket prizes consist of:
     - `1` First Prize (`1st`, full ticket with series + 6-digit number)
     - `11` Consolation Prizes (`consolation`, 11 remaining series sharing the First Prize 6-digit number)
     - `1` Second Prize (`2nd`, full ticket with series + 6-digit number)
     - `1` Third Prize (`3rd`, full ticket with series + 6-digit number)
     - Total `fullTicketCount` = **`14`** (for seasonal bumper `BR-110th`, `fullTicketCount` = **`20`**).
   - `suffixCount` is the exact number of 4-digit suffix winners across the 4th through 9th prize tiers (`360` to `368` depending on the weekly lottery family's prize structure).

2. **`WinningNumber` Node Count (`distinctCanonicalNumbers`) — Graph Node Metric**
   - In the per-draw knowledge graph (`data/processed-cache/graphs/{sha256}.json`), `WinningNumber` nodes (`id: "num_{canonicalNumber}"`) are deduplicated by `canonicalNumber` (the 6-digit or 4-digit numeric string without series prefix).
   - Because the `1` First Prize ticket and `11` Consolation Prize tickets share the exact same 6-digit `canonicalNumber` across 12 series, all `12` `WinningResult` nodes link via `HAS_NUMBER` edges to a single `WinningNumber` node.
   - Therefore, for every standard weekly draw where the 1st, 2nd, and 3rd prize 6-digit numbers are distinct:
     $$\text{WinningNumberNodeCount} = \text{totalResults} - 11$$

---

## 3. Authoritative Provenance & Source-Identity Trace of the Post-Baseline Draws (`29/09/2026` – `13/10/2026`)

### 3.1 Single-Artifact Representation & Filename Contract
- Across the entire 114-draw V1 corpus, there is **exactly one canonical official PDF byte stream per draw** (`114` PDF files in `data/source-documents/lottery-results/`, `114` entries in `data/processed-cache/manifest.json`, and `114` graph files in `data/processed-cache/graphs/`). Two different legitimate PDF representations do **not** exist for any draw.
- The V1 ingestion contract (`SourceIngestionService` + `CacheManager`) keys every artifact by its cryptographic `sha256` (`source-documents/{sha256}.pdf` in Cloud Storage, `documents/{sha256}` in Firestore, and `data/processed-cache/graphs/{sha256}.json` locally), while recording two filename metadata fields in `manifest.json`:
  - `sourceResponseFilename`: the upstream `Content-Disposition` filename returned by the official portal (`result.keralalotteries.com/viewlotisresult.php?drawserial=...`, e.g., `SS-539.pdf`, `DL-71.pdf`, `KN-643.pdf`, `KR-770.pdf`, `BT-74.pdf`).
  - `fileName` (`canonicalFilename`): the local filename stored under `data/source-documents/lottery-results/`.
    - For the 100 baseline draws (`08/06/2026` – `28/09/2026`) and the first 3 catch-up draws (`SS-539th`, `DL-71st`, `KN-643rd`, ingested `2026-10-02T08:39:53Z`–`08:40:01Z`), `fileName` used the Gazette-style naming convention (`272-2351-29-09-2026.pdf`, `273-2356-30-09-2026.pdf`, `274-2361-01-10-2026.pdf`) while `sourceResponseFilename` recorded the portal response filename (`SS-539.pdf`, `DL-71.pdf`, `KN-643.pdf`) for the **same** file and SHA-256.
    - Starting with `KR-770th` (`03/10/2026`, commit `6ecbd76`) and continuing through `SM-75th`–`SS-541st` (`04/10/2026`–`13/10/2026`, commit `90203dc`), the pipeline stopped synthesizing `27x-xxxx-...` filenames when absent from the upstream response and preserved the official portal filename (`KR-770.pdf`, `SM-75.pdf`, ..., `SS-541.pdf`) in both `fileName` and `sourceResponseFilename`.

### 3.2 Complete Per-Draw Provenance Table (14 Post-Baseline Draws + Last Baseline Draw `BT-73rd`)
- **Source System:** Directorate of Kerala State Lotteries Official Result Portal (`result.keralalotteries.com` / `result.statelottery.kerala.gov.in`, upstream IP `103.251.43.52`).
- **TLS Verification:** Verified via `tls.checkServerIdentity("result.keralalotteries.com", cert)` with SNI `result.keralalotteries.com` (`networkPass: true` across all live portal fetches in [`docs/evidence/reconciliation-audit-raw.json`](./reconciliation-audit-raw.json)).

| Draw ID & Date | Parsed Lottery Identity | Serial & Official Source URL | `sourceResponseFilename` | Local `fileName` (`data/source-documents/lottery-results/`) | Exact Bytes | Full Cryptographic SHA-256 | `WinningResult` (`14` + Suffix) / `WinningNumber` Nodes | Retrieval / Ingestion Timestamps (`retrievedAt` / `ingestedAt`) | Cloud Storage Object, Generation & MD5 | Firestore Document ID, `status` & `updateTime` |
| :--- | :--- | :--- | :--- | :--- | ---: | :--- | :--- | :--- | :--- | :--- |
| **`BT-73rd`** (`28/09/2026`) *(100th Baseline)* | `BHAGYATHARA` | `75393` `http://result.keralalotteries.com/viewlotisresult.php?drawserial=75393` | `BT-73.pdf` | `271-2346-28-09-2026.pdf` | `87,173` | `cddb3d4d05c102b98f38050ac1ff297ad15bc442b12087c0505927f7bb1cf3dc` | **`378`** (`14+364`) / `367` | Ingested: `2026-09-28T12:00:35.361Z` | **PROD** `source-documents/cddb3d4d...pdf` gen `1790648803318162` (`K79/ahD9ASZvB9pCPgsUdA==`) | **PROD** `documents/cddb3d4d...` (`2026-09-29T02:26:44.118153Z`) |
| **`SS-539th`** (`29/09/2026`) | `STHREE-SAKTHI` | `75394` `http://result.keralalotteries.com/viewlotisresult.php?drawserial=75394` | `SS-539.pdf` | `272-2351-29-09-2026.pdf` | `87,255` | `351176188dbb5264f22715eef8cab489e584d67455125c36e8778edc6aff431e` | **`380`** (`14+366`) / `369` | Ingested: `2026-10-02T08:40:01.533Z` | Local only (`404` in DEV & PROD GCS) | Local only (`404` in DEV & PROD Firestore) |
| **`DL-71st`** (`30/09/2026`) | `DHANALEKSHMI` | `75395` `http://result.keralalotteries.com/viewlotisresult.php?drawserial=75395` | `DL-71.pdf` | `273-2356-30-09-2026.pdf` | `263,597` | `8670c8a0cdb9174d81c57a21b38e279c969088b4dc5020a16ef3f5a59e787174` | **`374`** (`14+360`) / `363` | Ingested: `2026-10-02T08:39:58.225Z` | Local only (`404` in DEV & PROD GCS) | Local only (`404` in DEV & PROD Firestore) |
| **`KN-643rd`** (`01/10/2026`) | `KARUNYA PLUS` | `75396` `http://result.keralalotteries.com/viewlotisresult.php?drawserial=75396` | `KN-643.pdf` | `274-2361-01-10-2026.pdf` | `87,200` | `37e35a7760e98eecc7062e10c9512070f8809d759e72963d5857374ea28a09fc` | **`380`** (`14+366`) / `369` | Ingested: `2026-10-02T08:39:53.563Z` | Local only (`404` in DEV & PROD GCS) | Local only (`404` in DEV & PROD Firestore) |
| **`KR-770th`** (`03/10/2026`) | `KARUNYA` | `75397` `https://result.statelottery.kerala.gov.in/viewlotisresult.php?drawserial=75397` | `KR-770.pdf` | `KR-770.pdf` | `263,525` | `0377f83e53d0ec6b823bb9973220238965bc4059ed5d449e975013eb9db4b4cb` | **`376`** (`14+362`) / `365` | Retrieved: `2026-10-04T13:23:39.693Z` Ingested: `2026-10-14T02:13:43.397Z` | **DEV** `source-documents/0377f83e...pdf` gen `1791943670237030` (`kOGVsWaNB87V1kSgnH43+w==`) | **DEV** `documents/0377f83e...` `VALID` (`2026-10-14T02:07:53.545903Z`) |
| **`SM-75th`** (`04/10/2026`) | `SAMRUDHI` | `75398` `https://result.keralalotteries.com/viewlotisresult.php?drawserial=75398` | `SM-75.pdf` | `SM-75.pdf` | `87,253` | `3a0ea2c300e39acaa4205374988c46d54b5050446fd0082071495715cecb68b8` | **`382`** (`14+368`) / `371` | Retrieved: `2026-10-14T03:59:50.696Z` Ingested: `2026-10-14T04:02:07.536Z` | **DEV** `source-documents/3a0ea2c3...pdf` gen `1791950394175611` (`BihiH68vHNyIcNmF93eSGA==`) | **DEV** `documents/3a0ea2c3...` `UPLOADED` (`2026-10-14T04:00:01.262693Z`) |
| **`BT-74th`** (`05/10/2026`) | `BHAGYATHARA` | `75399` `https://result.keralalotteries.com/viewlotisresult.php?drawserial=75399` | `BT-74.pdf` | `BT-74.pdf` | `87,202` | `e3cd85ae7393ec339532fa0d17bce0aeeaf3cb76532d83dbac261f16d56a2fd0` | **`378`** (`14+364`) / `367` | Retrieved: `2026-10-14T04:00:05.497Z` Ingested: `2026-10-14T04:02:06.969Z` | **DEV** `source-documents/e3cd85ae...pdf` gen `1791950414036340` (`AusZ8+yIYlLQJcdFaJ/pOw==`) | **DEV** `documents/e3cd85ae...` `UPLOADED` (`2026-10-14T04:00:20.056669Z`) |
| **`SS-540th`** (`06/10/2026`) | `STHREE-SAKTHI` | `75400` `https://result.keralalotteries.com/viewlotisresult.php?drawserial=75400` | `SS-540.pdf` | `SS-540.pdf` | `87,253` | `74dadb9c67dd3f7ee3f67ef8184155308535681f7c320a2733187c3dc9066c93` | **`380`** (`14+366`) / `369` | Retrieved: `2026-10-14T04:00:22.695Z` Ingested: `2026-10-14T04:02:06.339Z` | **DEV** `source-documents/74dadb9c...pdf` gen `1791950428334080` (`tCbkZuAb3Kh+3cTzDiNxjg==`) | **DEV** `documents/74dadb9c...` `UPLOADED` (`2026-10-14T04:00:31.396079Z`) |
| **`DL-72nd`** (`07/10/2026`) | `DHANALEKSHMI` | `75401` `https://result.keralalotteries.com/viewlotisresult.php?drawserial=75401` | `DL-72.pdf` | `DL-72.pdf` | `87,153` | `57b10c944bbbe2bd4374193e8c6886b18dc8d124d705d5518f1c62db2507fe19` | **`374`** (`14+360`) / `363` | Retrieved: `2026-10-14T04:00:31.877Z` Ingested: `2026-10-14T04:02:05.779Z` | **DEV** `source-documents/57b10c94...pdf` gen `1791950432819655` (`29u6pjF94hzfbFLVCmpRIw==`) | **DEV** `documents/57b10c94...` `UPLOADED` (`2026-10-14T04:00:33.586498Z`) |
| **`KN-644th`** (`08/10/2026`) | `KARUNYA PLUS` | `75402` `https://result.keralalotteries.com/viewlotisresult.php?drawserial=75402` | `KN-644.pdf` | `KN-644.pdf` | `87,214` | `6ba7fbb6b607ef47e1b517f378075f632ceffb1cf5e54c54b67a869d21dc3c28` | **`380`** (`14+366`) / `369` | Retrieved: `2026-10-14T04:00:33.822Z` Ingested: `2026-10-14T04:02:05.222Z` | **DEV** `source-documents/6ba7fbb6...pdf` gen `1791950434747995` (`u2qi5IWs3w/Rtzu2+uC02A==`) | **DEV** `documents/6ba7fbb6...` `UPLOADED` (`2026-10-14T04:00:35.564727Z`) |
| **`SK-72nd`** (`09/10/2026`) | `SUVARNA KERALAM` | `75403` `https://result.keralalotteries.com/viewlotisresult.php?drawserial=75403` | `SK-72.pdf` | `SK-72.pdf` | `87,206` | `3ee14f9f836bff7f6e7b67101f1fbd5c244d3409fbaa06208417cc2f3a533d8e` | **`376`** (`14+362`) / `365` | Retrieved: `2026-10-14T04:00:35.778Z` Ingested: `2026-10-14T04:02:04.675Z` | **DEV** `source-documents/3ee14f9f...pdf` gen `1791950436782927` (`LkWxuNF2f570yDSXA6S/Qg==`) | **DEV** `documents/3ee14f9f...` `UPLOADED` (`2026-10-14T04:00:37.519772Z`) |
| **`KR-771st`** (`10/10/2026`) | `KARUNYA` | `75404` `https://result.keralalotteries.com/viewlotisresult.php?drawserial=75404` | `KR-771.pdf` | `KR-771.pdf` | `87,164` | `8547c750a04f79272fa16dbadd6ac4eaca0b0795cc609259701f2cfccf1fb0e4` | **`376`** (`14+362`) / `365` | Retrieved: `2026-10-14T04:00:37.692Z` Ingested: `2026-10-14T04:02:04.116Z` | **DEV** `source-documents/8547c750...pdf` gen `1791950438664029` (`Vp9ZBiCQu6ZjJRid5RhqIw==`) | **DEV** `documents/8547c750...` `UPLOADED` (`2026-10-14T04:00:39.338091Z`) |
| **`SM-76th`** (`11/10/2026`) | `SAMRUDHI` | `75405` `https://result.keralalotteries.com/viewlotisresult.php?drawserial=75405` | `SM-76.pdf` | `SM-76.pdf` | `87,220` | `bda05e8318125fd83cf518f2daf89a4a3550a561912efdd5b6b52afd955bbe7b` | **`382`** (`14+368`) / `371` | Retrieved: `2026-10-14T04:00:39.517Z` Ingested: `2026-10-14T04:02:03.508Z` | **DEV** `source-documents/bda05e83...pdf` gen `1791950440462037` (`ROiqH94Yf8wm6WESVV1VkQ==`) | **DEV** `documents/bda05e83...` `UPLOADED` (`2026-10-14T04:00:41.206597Z`) |
| **`BT-75th`** (`12/10/2026`) | `BHAGYATHARA` | `75406` `https://result.keralalotteries.com/viewlotisresult.php?drawserial=75406` | `BT-75.pdf` | `BT-75.pdf` | `87,202` | `1b82c0acc76398fe72c759f2092b3fa653559c23b51de883ea99ed6c0620ccf4` | **`378`** (`14+364`) / `367` | Retrieved: `2026-10-14T04:00:41.473Z` Ingested: `2026-10-14T04:02:02.946Z` | **DEV** `source-documents/1b82c0ac...pdf` gen `1791950442662195` (`7L1D6EZnqE0NR9541yeMPg==`) | **DEV** `documents/1b82c0ac...` `UPLOADED` (`2026-10-14T04:00:44.048658Z`) |
| **`SS-541st`** (`13/10/2026`) | `STHREE-SAKTHI` | `75407` `https://result.keralalotteries.com/viewlotisresult.php?drawserial=75407` | `SS-541.pdf` | `SS-541.pdf` | `87,240` | `4ef34cc25df8fa54ad3c815ff26625b34d63ae2d17833232017dcb9afe16ae1d` | **`380`** (`14+366`) / `369` | Retrieved: `2026-10-14T04:00:44.400Z` Ingested: `2026-10-14T04:02:02.352Z` | **DEV** `source-documents/4ef34cc2...pdf` gen `1791950447558843` (`/y5Vw4bFk2FCru+h7E3egQ==`) | **DEV** `documents/4ef34cc2...` `UPLOADED` (`2026-10-14T04:00:49.192995Z`) |

---

## 4. Reconciliation of Conflicting Hashes, Byte Sizes & Result Counts Across Prior Reports

Three distinct sets of erroneous narrative values appeared in prior reports and conversational summaries. None of those conflicting values ever existed as actual PDF files on disk, on the official Kerala State Lotteries portal, in `manifest.json`, or in Cloud Storage/Firestore:

| Draw ID | **Authoritative Artifact (Disk, Portal, `manifest.json`, `graphs/*.json`, `reconciliation-audit-raw.json`, DEV Cloud)** | **Conflict Set 1: Pre-Session Narrative Report (`report_6519.md` lines 43–51)** | **Conflict Set 2: Initial Inspection Chat Table (Step 47)** | **Conflict Set 3: Previous Turn Chat Summary Table (Step 612)** |
| :--- | :--- | :--- | :--- | :--- |
| **`SS-539th`** (`29/09/2026`) | `351176188dbb5264f22715eef8cab489e584d67455125c36e8778edc6aff431e` (`87,255` B, `380` results) | Omitted from 10-draw table | Omitted from 10-draw table | Correct SHA-256 & `87,255` B, but falsely claimed a duplicate `SS-539.pdf` existed on disk |
| **`DL-71st`** (`30/09/2026`) | `8670c8a0cdb9174d81c57a21b38e279c969088b4dc5020a16ef3f5a59e787174` (`263,597` B, `374` results) | Omitted from 10-draw table | Omitted from 10-draw table | Correct SHA-256 & `263,597` B, but falsely claimed a duplicate `DL-71.pdf` existed on disk |
| **`KN-643rd`** (`01/10/2026`) | `37e35a7760e98eecc7062e10c9512070f8809d759e72963d5857374ea28a09fc` (`87,200` B, `380` results) | Omitted from 10-draw table | Omitted from 10-draw table | Correct SHA-256 & `87,200` B, but falsely claimed a duplicate `KN-643.pdf` existed on disk |
| **`KR-770th`** (`03/10/2026`) | `0377f83e53d0ec6b823bb9973220238965bc4059ed5d449e975013eb9db4b4cb` (`263,525` B, `376` results, gen `1791943670237030`) | Omitted from 10-draw table | Omitted from 10-draw table | Correct (`0377f83e...`, `263,525` B, `376` results) |
| **`SM-75th`** (`04/10/2026`) | `3a0ea2c300e39acaa4205374988c46d54b5050446fd0082071495715cecb68b8` (`87,253` B, `382` results, gen `1791950394175611`) | Correct SHA-256 & bytes, but `379` results (`-3` full-ticket undercount) | Correct SHA-256 & bytes, `382` results | Correct SHA-256 & bytes, `382` results |
| **`BT-74th`** (`05/10/2026`) | `e3cd85ae7393ec339532fa0d17bce0aeeaf3cb76532d83dbac261f16d56a2fd0` (`87,202` B, `378` results, gen `1791950414036340`) | `119a4e26...` (`87,193` B — copied from baseline `SK-63rd` `31/07/2026`), `375` results, fake gen `1791950394982637` | Unverified summary prefix `d63775d7…` (`94,300` B), `542` results | Ungrounded chat hash `eb33a101...` (`263,655` B), `378` results |
| **`SS-540th`** (`06/10/2026`) | `74dadb9c67dd3f7ee3f67ef8184155308535681f7c320a2733187c3dc9066c93` (`87,253` B, `380` results, gen `1791950428334080`) | `67c03063...` (`263,682` B — copied from baseline `KR-766th` `29/08/2026`), `377` results, fake gen `1791950395793842` | Unverified summary prefix `5269f3b8…` (`85,786` B), `545` results | Ungrounded chat hash `dc7cb518...` (`87,264` B), `380` results |
| **`DL-72nd`** (`07/10/2026`) | `57b10c944bbbe2bd4374193e8c6886b18dc8d124d705d5518f1c62db2507fe19` (`87,153` B, `374` results, gen `1791950432819655`) | Misdated `12/10/2026`, `f21d0853...` (`87,164` B), `375` results, fake gen `1791950400215302` | Unverified summary prefix `0b80726c…` (`89,333` B), `531` results | Ungrounded chat hash `78bb4a2c...` (`263,560` B), `374` results |
| **`KN-644th`** (`08/10/2026`) | `6ba7fbb6b607ef47e1b517f378075f632ceffb1cf5e54c54b67a869d21dc3c28` (`87,214` B, `380` results, gen `1791950434747995`) | Misdated `07/10/2026`, `a40e71b1...` (`87,214` B), `371` results, fake gen `1791950396601928` | Unverified summary prefix `58b5ac58…` (`94,693` B), `546` results | Ungrounded chat hash `c72d2f6a...` (`263,646` B), `380` results |
| **`SK-72nd`** (`09/10/2026`) | `3ee14f9f836bff7f6e7b67101f1fbd5c244d3409fbaa06208417cc2f3a533d8e` (`87,206` B, `376` results, gen `1791950436782927`) | `9b82c1d4...` (`87,206` B), `373` results, fake gen `1791950398482910` | Unverified summary prefix `b55be43c…` (`94,300` B), `539` results | Ungrounded chat hash `32c8c12a...` (`87,205` B), `376` results |
| **`KR-771st`** (`10/10/2026`) | `8547c750a04f79272fa16dbadd6ac4eaca0b0795cc609259701f2cfccf1fb0e4` (`87,164` B, `376` results, gen `1791950438664029`) | Misdated `08/10/2026`, `e81920c4...` (`263,512` B), `377` results, fake gen `1791950397510294` | Unverified summary prefix `2f1d73be…` (`91,069` B), `540` results | Ungrounded chat hash `fc4a652e...` (`263,522` B), `376` results |
| **`SM-76th`** (`11/10/2026`) | `bda05e8318125fd83cf518f2daf89a4a3550a561912efdd5b6b52afd955bbe7b` (`87,220` B, `382` results, gen `1791950440462037`) | `7f4c9a12...` (`87,220` B), `379` results, fake gen `1791950399301844` | Unverified summary prefix `3c7d823b…` (`89,333` B), `542` results | Ungrounded chat hash `2973bd77...` (`263,572` B), `382` results |
| **`BT-75th`** (`12/10/2026`) | `1b82c0acc76398fe72c759f2092b3fa653559c23b51de883ea99ed6c0620ccf4` (`87,202` B, `378` results, gen `1791950442662195`) | Misdated `10/10/2026`, `c5019f28...` (`87,202` B), `373` results, fake gen `1791950398910421` | Unverified summary prefix `f469e7db…` (`94,300` B), `542` results | Ungrounded chat hash `849d5a06...` (`263,618` B), `378` results |
| **`SS-541st`** (`13/10/2026`) | `4ef34cc25df8fa54ad3c815ff26625b34d63ae2d17833232017dcb9afe16ae1d` (`87,240` B, `380` results, gen `1791950447558843`) | `d0941a77...` (`87,240` B), `377` results, fake gen `1791950401124407` | Unverified summary prefix `8b29cb30…` (`85,786` B), `545` results | Ungrounded chat hash `19c5a97e...` (`87,210` B), `380` results |

---

## 5. Complete V1.0 Corpus Accounting (`114` Draws / `43,712` `WinningResult`s / `42,467` `WinningNumber` Nodes)

| Corpus Segment | Draw Count | `fullTicketCount` | `suffixCount` | `WinningResult` Count (`totalResults`) | `WinningNumber` Graph Nodes | Cloud Residency |
| :--- | ---: | ---: | ---: | ---: | ---: | :--- |
| Frozen PROD Baseline (`08/06/2026` – `28/09/2026`) | `100` | `1,462` | `36,954` | `38,416` | `37,325` | **PROD** (`100` GCS objects & `100` Firestore docs in `kerala-lottery-intelligence`) + Local corpus |
| Initial 3 Catch-Up Draws (`SS-539th`: `380`, `DL-71st`: `374`, `KN-643rd`: `380`) | `3` | `42` | `1,092` | `1,134` | `1,101` | **Local corpus only** (`404` in DEV & PROD Cloud Storage and Firestore) |
| Early October Catch-Up Draw (`KR-770th`, `03/10/2026`) | `1` | `14` | `362` | `376` | `365` | **DEV** (`kerala-lottery-intel-dev` GCS & Firestore) + Local corpus |
| 10 October 2026 Draws (`SM-75th` – `SS-541st`, `04/10/2026` – `13/10/2026`) | `10` | `140` | `3,646` | `3,786` | `3,676` | **DEV** (`kerala-lottery-intel-dev` GCS & Firestore) + Local corpus |
| **V1.0 Research Corpus Total** | **`114`** | **`1,658`** | **`42,054`** | **`43,712`** | **`42,467`** | **`114` Local = `100` PROD + `3` Local-Only + `11` DEV** |

Exact arithmetic:
- `fullTicketCount`: $1,462 + 42 + 14 + 140 = \mathbf{1,658}$
- `suffixCount`: $36,954 + 1,092 + 362 + 3,646 = \mathbf{42,054}$
- `WinningResult` total (`totalResults`): $38,416 + 1,134 + 376 + 3,786 = 1,658 + 42,054 = \mathbf{43,712}$
- `WinningNumber` graph nodes: $37,325 + 1,101 + 365 + 3,676 = \mathbf{42,467}$

---

## 6. Independent Cloud Inventory Enumeration & Reconciliation

### 6.1 Summary by Environment

| Environment / Store | Project / Path | Direct Read-Only Enumeration | Breakdown of Contents |
| :--- | :--- | :--- | :--- |
| **Local Corpus** | `data/source-documents/lottery-results/` `data/processed-cache/manifest.json` `data/processed-cache/graphs/` | **`114` PDFs** **`114` manifest entries** **`114` graph files** | `100` baseline draws (`08/06/2026`–`28/09/2026`) + `3` local-only catch-up draws (`SS-539th`, `DL-71st`, `KN-643rd`) + `11` DEV-backed catch-up draws (`KR-770th` + `SM-75th`–`SS-541st`). |
| **PROD Cloud** | `kerala-lottery-intelligence` Bucket: `kerala-lottery-intelligence.firebasestorage.app` Firestore: `databases/(default)/documents/documents` Scheduler: `prod-daily-lottery-ingestion` | **`100` GCS objects** **`100` Firestore docs** **Scheduler: `PAUSED`** | Exact 1:1 match with the `100` frozen baseline draws (`08/06/2026`–`28/09/2026`, latest object/doc update `2026-09-29T02:26:43.827Z` / `2026-09-29T02:26:44.118153Z`, scheduler `userUpdateTime: 2026-09-29T02:33:32.611005Z`). Zero post-28/09 draws in PROD. |
| **DEV Cloud** | `kerala-lottery-intel-dev` Bucket: `kerala-lottery-intel-dev.firebasestorage.app` Firestore: `databases/(default)/documents/documents` | **`13` GCS objects** **`13` Firestore docs** | **`11` V1 catch-up draws** (`KR-770th` + `SM-75th`–`SS-541st`, ingested `2026-10-14T02:07:50Z`–`04:00:49Z`) + **`2` pre-baseline Milestone 3A/3B DEV test items** (not in local `manifest.json`). Missing from DEV: the `100` baseline draws (residing in PROD) and the `3` local-only catch-up draws (`SS-539th`, `DL-71st`, `KN-643rd`). |

### 6.2 Complete 13-Item DEV Cloud Inventory (`kerala-lottery-intel-dev`)

1. **`11` V1 Corpus Catch-Up Draws (Present in DEV GCS, DEV Firestore, and Local `manifest.json`):**
   - `0377f83e53d0ec6b823bb9973220238965bc4059ed5d449e975013eb9db4b4cb` (`KR-770th`, `03/10/2026`, `263,525` B, GCS gen `1791943670237030`, Firestore status `VALID`)
   - `3a0ea2c300e39acaa4205374988c46d54b5050446fd0082071495715cecb68b8` (`SM-75th`, `04/10/2026`, `87,253` B, GCS gen `1791950394175611`, Firestore status `UPLOADED`)
   - `e3cd85ae7393ec339532fa0d17bce0aeeaf3cb76532d83dbac261f16d56a2fd0` (`BT-74th`, `05/10/2026`, `87,202` B, GCS gen `1791950414036340`, Firestore status `UPLOADED`)
   - `74dadb9c67dd3f7ee3f67ef8184155308535681f7c320a2733187c3dc9066c93` (`SS-540th`, `06/10/2026`, `87,253` B, GCS gen `1791950428334080`, Firestore status `UPLOADED`)
   - `57b10c944bbbe2bd4374193e8c6886b18dc8d124d705d5518f1c62db2507fe19` (`DL-72nd`, `07/10/2026`, `87,153` B, GCS gen `1791950432819655`, Firestore status `UPLOADED`)
   - `6ba7fbb6b607ef47e1b517f378075f632ceffb1cf5e54c54b67a869d21dc3c28` (`KN-644th`, `08/10/2026`, `87,214` B, GCS gen `1791950434747995`, Firestore status `UPLOADED`)
   - `3ee14f9f836bff7f6e7b67101f1fbd5c244d3409fbaa06208417cc2f3a533d8e` (`SK-72nd`, `09/10/2026`, `87,206` B, GCS gen `1791950436782927`, Firestore status `UPLOADED`)
   - `8547c750a04f79272fa16dbadd6ac4eaca0b0795cc609259701f2cfccf1fb0e4` (`KR-771st`, `10/10/2026`, `87,164` B, GCS gen `1791950438664029`, Firestore status `UPLOADED`)
   - `bda05e8318125fd83cf518f2daf89a4a3550a561912efdd5b6b52afd955bbe7b` (`SM-76th`, `11/10/2026`, `87,220` B, GCS gen `1791950440462037`, Firestore status `UPLOADED`)
   - `1b82c0acc76398fe72c759f2092b3fa653559c23b51de883ea99ed6c0620ccf4` (`BT-75th`, `12/10/2026`, `87,202` B, GCS gen `1791950442662195`, Firestore status `UPLOADED`)
   - `4ef34cc25df8fa54ad3c815ff26625b34d63ae2d17833232017dcb9afe16ae1d` (`SS-541st`, `13/10/2026`, `87,240` B, GCS gen `1791950447558843`, Firestore status `UPLOADED`)

2. **`2` Pre-Baseline Milestone 3A/3B DEV Test Artifacts (Present in DEV GCS & DEV Firestore only; NOT in `manifest.json` or PROD):**
   - `2b8ed894e0e6da419e81b54d760322c574cf88a61f8d892bd309ad9148fc3acf`: `originalFileName: "dev-synthetic-lottery-fixture.pdf"`, `331` bytes, GCS gen `1790160311444395` (`timeCreated: 2026-09-23T10:45:11.449Z`), Firestore title `"DEV Milestone 3A Synthetic Fixture Gazette"`, `sourceUrl: "https://kerala-lottery-intel-dev.test/fixtures/draw-synthetic.pdf"`, `status: "UPLOADED"`.
   - `9bc76b6017edb26d3c13d415cd96280f4a2f066d24c41ce7a82b39b44dee557c`: `originalFileName: "273-2113-18-02-2026.pdf"`, `87,147` bytes, GCS gen `1790250795722236` (`timeCreated: 2026-09-24T11:53:15.729Z`), Firestore title `"Result - view\" />"`, `sourceUrl: "https://statelottery.kerala.gov.in/images/pdf/273-2113-18-02-2026.pdf"`, `status: "UPLOADED"` (Milestone 3B single-draw test ingestion of a February 2026 draw prior to the `08/06/2026`–`28/09/2026` baseline window).

> **Note Correcting Earlier Line 106 Shorthand:** An earlier summary note in this file described the 13 DEV objects as `"BT-73 + KR-770 + 10 Oct draws + 1 test doc"`. Direct enumeration proves `BT-73rd` (`cddb3d4d...`) resides in **PROD** (as the 100th baseline draw), whereas **DEV** contains the `11` October catch-up draws (`KR-770th` + `SM-75th`–`SS-541st`) plus the `2` Milestone 3A/3B DEV test documents (`2b8ed894...` and `9bc76b60...`).

### 6.3 Why Prior Reports (`report_6519.md`) Claimed `114` DEV Cloud Objects/Documents
- `report_6519.md` (line 169) cited the HTTP response of `GET /api/ops/ingestion/storage-integrity`:
  `{"localManifestCount":114,"cloudStorageDocumentCount":114,"firestoreDocumentCount":114,"isFullyVerified":true}`
- Prior to the remediation in this branch, [`apps/web/app/api/ops/ingestion/storage-integrity/route.ts`](../../apps/web/app/api/ops/ingestion/storage-integrity/route.ts) did **not** enumerate Cloud Storage objects or Firestore documents independently. Instead, it loaded `data/processed-cache/manifest.json` (`114` entries) and set `cloudStorageDocumentCount = docs.length`, `firestoreDocumentCount = docs.length`, and hardcoded `inManifest = true`, `inCloudStore = true`, `inFirestore = true`.
- Meanwhile, the pre-audit cloud metadata snapshot (`audit-snapshot-2026-10-16/cloud-metadata.json`, captured `2026-10-16T12:11:25.665Z`) and direct REST enumeration both confirm that DEV Cloud Storage and DEV Firestore have always held **`13`** objects/documents, and PROD Cloud Storage and PROD Firestore have held **`100`** objects/documents.

---

## 7. Existing-Record Content & Metadata Integrity Verification

- **Cloud Storage Objects (`StorageService`, `FirebaseStorageService`, `InMemoryStorageService`, `SourceIngestionService`):**
  - When an object already exists at `source-documents/{sha256}.pdf` (either via `exists()` or HTTP `412` on `ifGenerationMatch=0`), the service retrieves the existing object's metadata (`size`, `contentType`, and custom metadata `sha256`, `drawId`, `sourceId`) and existing bytes, re-validates the PDF header, and recomputes the cryptographic SHA-256. Any discrepancy throws `StorageIntegrityError` (fail-closed) without overwriting the object or creating/updating Firestore records.
- **Firestore Source Documents & Result Subcollections (`SourceIngestionService`, `WinningResultRepository`, `PrizeTierRepository`, `verifyDrawArtifactReconciliation`):**
  - Existing `SourceDocument` records are checked for exact `id`, `sha256`, `fileSize`, `storagePath`, `mimeType`, `type`, `status`, `title`, and `provenance` consistency; mismatches throw `DocumentIntegrityError`.
  - Existing `WinningResult` and `PrizeTier` records are checked by ID and full field content (`drawId`, `prizeTierId`, `rank`, `canonicalNumber`, `series`, `isSuffix`, `documentSha256`) rather than relying only on matching record counts; any content or count discrepancy throws `DocumentIntegrityError` / `ReconciliationVerificationError` (`RESULT_CONTENT_MISMATCH` / `RESULT_COUNT_MISMATCH`).
- **Cached Manifest & Graph Records (`DailyIngestionEngine`):**
  - When `cacheManager.has(sha256)` is true, the engine verifies `record.sha256`, `record.fileSize === uint8.byteLength`, `cachedGraph.documentSha256 === sha256`, and graph-derived `totalResults` / `fullTicketCount` / `suffixCount` against the manifest before accepting a candidate as `ALREADY_KNOWN`, failing closed (`CONFLICT`) on any corruption.

---

## 8. Durable Audit Evidence & Historical Limitation Disclosure

### Durable Evidence Artifact Location
- Because `data/processed-cache/*` is excluded from Git tracking in `.gitignore`, the sanitized raw audit artifact is preserved at:
  - [`docs/evidence/reconciliation-audit-raw.json`](./reconciliation-audit-raw.json)
- `services/ingestion/scripts/reconciliation-audit-remediation.ts` writes to `docs/evidence/reconciliation-audit-raw.json` (durable tracked evidence) and `data/processed-cache/reconciliation-audit-raw.json` (local cache), and supports an optional `AUDIT_ARTIFACT_OUTPUT_PATH` environment variable instead of a hardcoded IDE path.

### Retained Historical Limitation Disclosure
- **Pre-Audit Historical Snapshot Limitation:** A full individual-item pre-audit PROD inventory (with per-object GCS generation numbers and per-document Firestore `updateTime` values) was not persisted to disk *prior* to the start of the initial audit session. In the retained `docs/evidence/reconciliation-audit-raw.json` artifact, `preAuditInventory` and `postAuditInventory` share the single-pass `2026-10-16T11:36:14.707Z` PROD timestamp; historical pre-session state is never fabricated or reconstructed.
- **Runtime Inventory Comparison:** `services/ingestion/scripts/reconciliation-audit-remediation.ts` now captures two separate runtime inventories (`distinctPreAuditInventory` before the verification pass and `distinctPostAuditInventory` after completion) and verifies `0` additions, `0` deletions, `0` generation changes, `0` size changes, `0` timestamp changes, and `PAUSED` scheduler state across all `100` PROD Cloud Storage objects and `100` PROD Firestore documents in `kerala-lottery-intelligence`.

---

## 9. Storage-Integrity Residency Semantics (`apps/web/lib/storage-integrity.ts`)

`evaluateStorageIntegrity` (`GET /api/ops/ingestion/storage-integrity`) computes `expectedEnvironmentScope` (`"PROD_BASELINE" | "DEV_CATCHUP" | "OUTSIDE_V1_MANIFEST"`) and `residencyCategory` dynamically from the `114`-draw manifest (`prodFreezeCutoffDate = "2026-09-28"`), local PDF SHA-256 checks, local graph checks, and independent Cloud Storage / Firestore enumerations (with zero hardcoded draw counts or flags):

- **`ENVIRONMENT_OWNED_PROD`**: `PROD_BASELINE` draw (`drawDate <= 28/09/2026`) verified in the queried PROD cloud (`100` draws when PROD is queried).
- **`PROD_BASELINE_OUTSIDE_DEV`**: `PROD_BASELINE` draw (`drawDate <= 28/09/2026`) when only DEV cloud is queried (`100` draws; `identityVerified: false` — PROD integrity is never inferred from local manifest counts).
- **`ENVIRONMENT_OWNED_DEV`**: `DEV_CATCHUP` draw (`drawDate > 28/09/2026`) verified in DEV Cloud Storage and DEV Firestore (`11` draws: `KR-770th` + `SM-75th`–`SS-541st`).
- **`LOCAL_ONLY_MISSING_DEV_RECORD`**: `DEV_CATCHUP` draw present in local PDFs, local graphs, and `manifest.json` but absent (`404`) from DEV Cloud Storage and DEV Firestore (`3` draws: `SS-539th`, `DL-71st`, `KN-643rd`; `identityVerified: false`).
- **`ADDITIONAL_CLOUD_OUTSIDE_MANIFEST`**: Cloud Storage object and Firestore document present in cloud (`inCloudStore && inFirestore`) but absent from the V1 `manifest.json` (`2` Milestone 3A/3B DEV test records: `2b8ed894...` and `9bc76b60...`; `identityVerified: false`).
- **`CLOUD_PARITY_MISMATCH`** / **`LOCAL_ARTIFACT_MISMATCH`**: Any Storage-vs-Firestore parity divergence or local PDF/graph/manifest corruption (`identityVerified: false`).
- **Fail-Closed `integrityStatus`**: Returns `"UNVERIFIED"` whenever cloud checks cannot run, and `"DISCREPANCY_DETECTED"` whenever `localOnlyMissingDevCount > 0`, `additionalCloudOutsideManifestCount > 0`, `prodBaselineOutsideDevCount > 0`, `cloudParityMismatchCount > 0`, or `localArtifactMismatchCount > 0`.

---

## 10. Complete Monorepo Test-Suite Scope (`npm test` -> `vitest run`)

- Root `package.json` defines `"test": "vitest run"` and `"test:rules": "npx -y firebase-tools emulators:exec --only firestore \"vitest run tests/firestore-rules.test.ts\""`. None of the 12 workspace `package.json` files define a workspace-level `"test"` script.
- Earlier remediation notes cited `31` passing tests (`20 + 5 + 6`) by summing targeted subset runs (`20` initial tests in `source-integrity-regression.test.ts`, `5` existing-record tests added in Blocker C, and `6` storage-integrity tests in `tests/ingestion-ops-api.test.ts`) rather than running root `npm test`.
- Executing the full monorepo suite (`CI=true npm test` -> `vitest run`) discovers and runs all **`41` test files** across `tests/**/*.test.ts` (`6` files), `packages/**/*.test.ts` (`24` files), and `services/**/*.test.ts` (`11` files), including `services/ingestion/src/source-integrity-regression.test.ts` (`25` passed) and `tests/ingestion-ops-api.test.ts` (`24` passed), totaling **`631` passed | `19` skipped (`650` total tests)** with exit code `0` (where the `19` skipped tests are the Firestore Emulator suite in `tests/firestore-rules.test.ts` guarded by `describe.skipIf(!isEmulatorActive)` when `FIRESTORE_EMULATOR_HOST` is unset).
