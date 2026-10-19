# Scientific Research Report: Empirical Evaluation of EXP-001-UNIFORM-BASELINE Baseline

**Finding ID:** `find_a69dea06d4682dc8`  
**Evidence Bundle ID:** `evb_71da56152437c13e`  
**Experiment:** `EXP-001-UNIFORM-BASELINE` (v1.0.0)  
**Run ID:** `run_b90590ace81433d9`  
**Validation ID:** `val_4978c3735c00205a`  
**Generated:** 2026-10-14T04:10:13.430Z  
**Deterministic Content Hash:** `fdfe44ab7c14af754ecabfd17dbaa7f9284105106b30790a7e24b207e3c3510f`  

---

## Abstract

This report presents the formal statistical validation of the EXP-001-UNIFORM-BASELINE baseline model evaluated against the 103-draw canonical Kerala State Lottery research corpus (N = 7,850 chronological holdout test records across 20 draws). Observed test accuracy of 10.26% (Wilson 95% CI: [9.63%, 10.92%], SE: 0.33%) was evaluated against a discrete uniform null hypothesis (H0: p = 0.10). Following Holm-Bonferroni multiple-comparison error control across the canonical baseline family, the adjusted empirical p-value is 0.6324 (isSignificant = false). Temporal walk-forward evaluation across 3 expanding windows confirmed a stability score of 98.7% with zero data leakage. Physical lottery drawings operate as independent stochastic physical trials; historical frequency distributions possess zero predictive power.

---

## 1. Scientific Claim & Taxonomy Classification

| Attribute | Specification |
| :--- | :--- |
| **Claim Type** | `STATISTICAL_RESULT` |
| **Formal Statement** | Uniform Random Categorical Baseline (EXP-001-UNIFORM-BASELINE) achieved 10.26% holdout accuracy against discrete uniform null mean of 10.00% (Holm-Bonferroni adjusted p = 0.6324, Z = 0.78, isSignificant = false). |
| **Methodology** | `EXPANDING_WINDOW_HOLM_BONFERRONI_V1` (v1.0.0) |
| **Family ID** | `EXP_FAMILY_CANONICAL_BASELINES` (m = 3) |
| **Confidence Level** | 95% (z = 1.96) |

---

## 2. Evaluation Population & Canonical Corpus Grounding

- **Canonical Research Corpus:** `corpus_981356dd505db164`
  - Total Gazetted Draws: **114 draws**
  - Total Winning Results: **43,712 results**
  - Source Gazette Documents: **114 PDF files** (all cryptographically verified via SHA-256)
- **Modeling Dataset:** `mdset_e51f5aa9258cae41`
  - Total Rows: **43,712 rows**
  - Training Split: **35,104 rows**
  - Chronological Holdout Test Split: **8,608 rows** (22 draws)

---

## 3. Empirical Statistical Evidence & Uncertainty Quantification

| Metric | Empirical Value | Theoretical Reference | Notes |
| :--- | :---: | :---: | :--- |
| **Holdout Accuracy** | **10.26%** | 10.00% | Binomial proportion on N = 8608 |
| **Standard Error (SE)** | **0.33%** (`0.003270`) | $\sqrt{p(1-p)/n} \approx 0.34\%$ | Binomial standard error |
| **Margin of Error (95%)** | **±0.64%** | $1.96 \times SE$ | 95% Confidence Radius |
| **Wilson Score 95% CI** | **[9.63%, 10.92%]** | [0, 1] bounded | Asymmetric score interval |
| **Bootstrap 95% CI** | **[9.62%, 10.95%]** | Empirical percentiles | B = 1,000 resamples (Mulberry32 PRNG) |
| **Cross-Entropy Log Loss** | **2.3026** | $-\ln(0.1) = 2.3026$ | Natural log categorical entropy |
| **Cohen's $h$ Effect Size** | **0.0085** | 0.0000 | Trivial effect ($|h| < 0.20$) |
| **Relative Accuracy Ratio** | **1.026x** | 1.000x | Ratio to discrete uniform chance |

---

## 4. Null-Hypothesis Significance Testing & Multiple-Comparison Control

### Null Model Distribution (`DISCRETE_UNIFORM_NULL`)
- **Hypothesis:** $H_0: p_i = \frac{1}{10}$ for all digits $i \in \{0 \dots 9\}$
- **Simulation:** $B = 1000$ iterations with deterministic Mulberry32 seed `42`
- **Null Distribution Mean:** 10.00% (Std Dev: 0.33%)
- **Standardized Z-Score:** $Z = 0.776$
- **Empirical P-Value (Raw):** $p = 0.2108$ (calculated via conservative $\frac{k + 1}{B + 1}$)

### Family-Wise Error Rate Control (`Holm-Bonferroni`)
- **Family:** `EXP_FAMILY_CANONICAL_BASELINES` ($m = 3$ baseline hypotheses)
- **Base Alpha:** $\alpha = 0.05$
- **Adjusted P-Value:** $p_{\text{adj}} = 0.6324$
- **Statistically Significant:** **NO (Fail to reject H0)**

---

## 5. Temporal Robustness & Expanding-Window Walk-Forward

- **Evaluation Strategy:** Chronological Expanding Windows (3 folds)
- **Temporal Stability Score:** **98.7%** ($1 - \frac{\sigma}{\mu}$)
- **Temporal Leakage Protection:** **VERIFIED (Zero Future Data Leakage)**

| Fold | Training Date Range | Train Draws | Test Date Range | Test Draws | Fold Accuracy | Cross-Entropy | Leakage Guard |
| :---: | :--- | :---: | :--- | :---: | :---: | :---: | :---: |
| Fold 1 | `2026-06-19 → 2026-08-27` | 68 (26,032 rows) | `2026-08-28 → 2026-09-11` | 15 (5,668 rows) | **10.39%** | 2.3026 | PASS |
| Fold 2 | `2026-06-19 → 2026-09-11` | 83 (31,700 rows) | `2026-09-12 → 2026-09-26` | 15 (5,956 rows) | **10.24%** | 2.3026 | PASS |
| Fold 3 | `2026-06-19 → 2026-09-26` | 98 (37,656 rows) | `2026-09-27 → 2026-10-13` | 16 (6,056 rows) | **10.12%** | 2.3026 | PASS |

---

## 6. Five-Part Research Interpretation Contract

1. **[OBSERVATION]**  
   Observed test accuracy across N=8,608 holdout results is 10.26% with cross-entropy log loss of 2.3026.
2. **[STATISTICAL EVIDENCE]**  
   - Observed Accuracy: 10.26%
   - Wilson 95% CI: [9.63%, 10.92%]
   - Raw Empirical P-Value: 0.2108 (Z = 0.78)
   - Holm Adjusted P-Value: 0.6324 (Significant: false)
3. **[UNCERTAINTY]**  
   - Standard Error: 0.33% (0.003270)
   - Margin of Error (95%): ±0.64%
   - Degrees of Freedom: 8607
4. **[INTERPRETATION]**  
   Observed accuracy does not statistically deviate from uniform random physical chance (p_adj = 0.6324 > 0.05). Consistent with independent physical lottery draw trials.
5. **[LIMITATION]**  
   Evaluated retrospectively on canonical historical gazetted publications. State lottery draws are independent physical random processes; historical digit frequencies possess zero predictive validity for future drawings.

---

## 7. Complete 9-Stage Lineage & Provenance Chain

| Stage | Entity Step | Identity | Deterministic Content Hash |
| :---: | :--- | :--- | :--- |
| **Stage 1** | `SOURCE_DOCUMENTS` | 114 gazetted source documents | `6966d13d036a436b9f5d...` |
| **Stage 2** | `DRAWS` | 114 verified draw records | `a781bb7118a568b3affc...` |
| **Stage 3** | `CORPUS` | corpus_981356dd505db164 | `981356dd505db164...` |
| **Stage 4** | `FEATURE_MATRIX` | fmat_429ff4d253092f92 | `fmat_429ff4d253092f9...` |
| **Stage 5** | `MODELING_DATASET` | mdset_e51f5aa9258cae41 | `e51f5aa9258cae41...` |
| **Stage 6** | `EXPERIMENT_DEFINITION` | EXP-001-UNIFORM-BASELINE | `507d64957fa9a6ed...` |
| **Stage 7** | `EXPERIMENT_RUN` | run_b90590ace81433d9 | `4eacda017713e2f5...` |
| **Stage 8** | `RESULT_ARTIFACT` | art_4e080c674315f1a0 | `04a868b580fd50dc...` |
| **Stage 9** | `VALIDATION` | val_4978c3735c00205a | `719d31cfab486bd2...` |
| **Stage 10** | `FINDING` | find_a69dea06d4682dc8 | `fdfe44ab7c14af754eca...` |

Lineage Integrity: **COMPLETE & VERIFIED**  
Evidence Bundle Integrity: **100% BITWISE VERIFIED**  

---

## 8. Cryptographic Audit Trail & Software Environment

```json
{
  "findingId": "find_a69dea06d4682dc8",
  "evidenceBundleId": "evb_71da56152437c13e",
  "artifactHashes": {
    "corpus": "981356dd505db164",
    "dataset": "e51f5aa9258cae41",
    "experiment": "507d64957fa9a6ed",
    "run": "4eacda017713e2f5",
    "resultArtifact": "04a868b580fd50dc",
    "validation": "719d31cfab486bd2",
    "finding": "fdfe44ab7c14af754ecabfd17dbaa7f9284105106b30790a7e24b207e3c3510f"
  },
  "softwareEnvironment": {
    "engine": "kerala-lottery-experiments-engine",
    "version": "1.0.0",
    "nodeVersion": "v22.23.2",
    "platform": "linux",
    "arch": "arm64",
    "dependencies": {
      "@kerala-lottery/experiments": "0.1.0",
      "@kerala-lottery/statistics": "0.1.0",
      "@kerala-lottery/domain": "0.1.0"
    }
  },
  "verifiedAt": "2026-10-14T04:10:13.430Z"
}
```

---

## 9. Mandatory Scientific Research Notice

> **SCIENTIFIC EVIDENCE INTEGRITY NOTICE: This publication-grade evidence bundle grounds retrospective statistical findings in an immutable cryptographic audit trail. Physical Kerala State Lottery draws are independent stochastic trials. Past digit distributions possess zero predictive power for future draws. All predictive, gambling, or betting claims are scientifically unfounded.**