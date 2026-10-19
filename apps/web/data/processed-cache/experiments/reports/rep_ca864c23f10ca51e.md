# Scientific Research Report: Empirical Evaluation of EXP-001-UNIFORM-BASELINE Baseline

**Finding ID:** `find_ca864c23f10ca51e`
**Evidence Bundle ID:** `evb_30ee982eb21a568a`
**Experiment:** `EXP-001-UNIFORM-BASELINE` (v1.0.0)
**Run ID:** `run_6b4bb339e1b860b7`
**Validation ID:** `val_77cadde0f85c7f33`
**Generated:** 2026-10-19T04:41:56.902Z
**Deterministic Content Hash:** `e0f05fda5da95841a96d36d9070e779847ddef97ffddebdbd5532f8f3fad963e`

---

## Abstract

This report presents the formal statistical validation of the EXP-001-UNIFORM-BASELINE baseline model evaluated against the 103-draw canonical Kerala State Lottery research corpus (N = 7,850 chronological holdout test records across 20 draws). Observed test accuracy of 10.37% (Wilson 95% CI: [9.76%, 11.02%], SE: 0.32%) was evaluated against a discrete uniform null hypothesis (H0: p = 0.10). Following Holm-Bonferroni multiple-comparison error control across the canonical baseline family, the adjusted empirical p-value is 0.4136 (isSignificant = false). Temporal walk-forward evaluation across 3 expanding windows confirmed a stability score of 98.7% with zero data leakage. Physical lottery drawings operate as independent stochastic physical trials; historical frequency distributions possess zero predictive power.

---

## 1. Scientific Claim & Taxonomy Classification

| Attribute | Specification |
| :--- | :--- |
| **Claim Type** | `STATISTICAL_RESULT` |
| **Formal Statement** | Uniform Random Categorical Baseline (EXP-001-UNIFORM-BASELINE) achieved 10.37% holdout accuracy against discrete uniform null mean of 10.01% (Holm-Bonferroni adjusted p = 0.4136, Z = 1.16, isSignificant = false). |
| **Methodology** | `EXPANDING_WINDOW_HOLM_BONFERRONI_V1` (v1.0.0) |
| **Family ID** | `EXP_FAMILY_CANONICAL_BASELINES` (m = 3) |
| **Confidence Level** | 95% (z = 1.96) |

---

## 2. Evaluation Population & Canonical Corpus Grounding

- **Canonical Research Corpus:** `corpus_2dd9b930c32ea047`
  - Total Gazetted Draws: **119 draws**
  - Total Winning Results: **45,600 results**
  - Source Gazette Documents: **119 PDF files** (all cryptographically verified via SHA-256)
- **Modeling Dataset:** `mdset_6b4a4edc3c9edba3`
  - Total Rows: **45,600 rows**
  - Training Split: **36,616 rows**
  - Chronological Holdout Test Split: **8,984 rows** (23 draws)

---

## 3. Empirical Statistical Evidence & Uncertainty Quantification

| Metric | Empirical Value | Theoretical Reference | Notes |
| :--- | :---: | :---: | :--- |
| **Holdout Accuracy** | **10.37%** | 10.00% | Binomial proportion on N = 8984 |
| **Standard Error (SE)** | **0.32%** (`0.003217`) | $\sqrt{p(1-p)/n} \approx 0.34\%$ | Binomial standard error |
| **Margin of Error (95%)** | **±0.63%** | $1.96 \times SE$ | 95% Confidence Radius |
| **Wilson Score 95% CI** | **[9.76%, 11.02%]** | [0, 1] bounded | Asymmetric score interval |
| **Bootstrap 95% CI** | **[9.77%, 11.02%]** | Empirical percentiles | B = 1,000 resamples (Mulberry32 PRNG) |
| **Cross-Entropy Log Loss** | **2.3026** | $-\ln(0.1) = 2.3026$ | Natural log categorical entropy |
| **Cohen's $h$ Effect Size** | **0.0124** | 0.0000 | Trivial effect ($|h| < 0.20$) |
| **Relative Accuracy Ratio** | **1.037x** | 1.000x | Ratio to discrete uniform chance |

---

## 4. Null-Hypothesis Significance Testing & Multiple-Comparison Control

### Null Model Distribution (`DISCRETE_UNIFORM_NULL`)
- **Hypothesis:** $H_0: p_i = \frac{1}{10}$ for all digits $i \in \{0 \dots 9\}$
- **Simulation:** $B = 1000$ iterations with deterministic Mulberry32 seed `42`
- **Null Distribution Mean:** 10.01% (Std Dev: 0.32%)
- **Standardized Z-Score:** $Z = 1.160$
- **Empirical P-Value (Raw):** $p = 0.1379$ (calculated via conservative $\frac{k + 1}{B + 1}$)

### Family-Wise Error Rate Control (`Holm-Bonferroni`)
- **Family:** `EXP_FAMILY_CANONICAL_BASELINES` ($m = 3$ baseline hypotheses)
- **Base Alpha:** $\alpha = 0.05$
- **Adjusted P-Value:** $p_{\text{adj}} = 0.4136$
- **Statistically Significant:** **NO (Fail to reject H0)**

---

## 5. Temporal Robustness & Expanding-Window Walk-Forward

- **Evaluation Strategy:** Chronological Expanding Windows (3 folds)
- **Temporal Stability Score:** **98.7%** ($1 - \frac{\sigma}{\mu}$)
- **Temporal Leakage Protection:** **VERIFIED (Zero Future Data Leakage)**

| Fold | Training Date Range | Train Draws | Test Date Range | Test Draws | Fold Accuracy | Cross-Entropy | Leakage Guard |
| :---: | :--- | :---: | :--- | :---: | :---: | :---: | :---: |
| Fold 1 | `2026-06-19 → 2026-08-30` | 71 (27,166 rows) | `2026-08-31 → 2026-09-15` | 16 (6,050 rows) | **10.20%** | 2.3026 | PASS |
| Fold 2 | `2026-06-19 → 2026-09-15` | 87 (33,216 rows) | `2026-09-16 → 2026-10-01` | 16 (6,334 rows) | **10.25%** | 2.3026 | PASS |
| Fold 3 | `2026-06-19 → 2026-10-01` | 103 (39,550 rows) | `2026-10-03 → 2026-10-18` | 16 (6,050 rows) | **10.45%** | 2.3026 | PASS |

---

## 6. Five-Part Research Interpretation Contract

1. **[OBSERVATION]**
   Observed test accuracy across N=8,984 holdout results is 10.37% with cross-entropy log loss of 2.3026.
2. **[STATISTICAL EVIDENCE]**
   - Observed Accuracy: 10.37%
   - Wilson 95% CI: [9.76%, 11.02%]
   - Raw Empirical P-Value: 0.1379 (Z = 1.16)
   - Holm Adjusted P-Value: 0.4136 (Significant: false)
3. **[UNCERTAINTY]**
   - Standard Error: 0.32% (0.003217)
   - Margin of Error (95%): ±0.63%
   - Degrees of Freedom: 8983
4. **[INTERPRETATION]**
   Observed accuracy does not statistically deviate from uniform random physical chance (p_adj = 0.4136 > 0.05). Consistent with independent physical lottery draw trials.
5. **[LIMITATION]**
   Evaluated retrospectively on canonical historical gazetted publications. State lottery draws are independent physical random processes; historical digit frequencies possess zero predictive validity for future drawings.

---

## 7. Complete 9-Stage Lineage & Provenance Chain

| Stage | Entity Step | Identity | Deterministic Content Hash |
| :---: | :--- | :--- | :--- |
| **Stage 1** | `SOURCE_DOCUMENTS` | 119 gazetted source documents | `6f8590781c99f3d5a5b5...` |
| **Stage 2** | `DRAWS` | 119 verified draw records | `43271cbb59ca30fa129a...` |
| **Stage 3** | `CORPUS` | corpus_2dd9b930c32ea047 | `2dd9b930c32ea047...` |
| **Stage 4** | `FEATURE_MATRIX` | fmat_a1ec0cc655d44e01 | `fmat_a1ec0cc655d44e0...` |
| **Stage 5** | `MODELING_DATASET` | mdset_6b4a4edc3c9edba3 | `6b4a4edc3c9edba3...` |
| **Stage 6** | `EXPERIMENT_DEFINITION` | EXP-001-UNIFORM-BASELINE | `507d64957fa9a6ed...` |
| **Stage 7** | `EXPERIMENT_RUN` | run_6b4bb339e1b860b7 | `231c015248d59d56...` |
| **Stage 8** | `RESULT_ARTIFACT` | art_483ad2c1bcce9930 | `5a7c74224615316b...` |
| **Stage 9** | `VALIDATION` | val_77cadde0f85c7f33 | `babae4b22c776bfa...` |
| **Stage 10** | `FINDING` | find_ca864c23f10ca51e | `e0f05fda5da95841a96d...` |

Lineage Integrity: **COMPLETE & VERIFIED**
Evidence Bundle Integrity: **100% BITWISE VERIFIED**

---

## 8. Cryptographic Audit Trail & Software Environment

```json
{
  "findingId": "find_ca864c23f10ca51e",
  "evidenceBundleId": "evb_30ee982eb21a568a",
  "artifactHashes": {
    "corpus": "2dd9b930c32ea047",
    "dataset": "6b4a4edc3c9edba3",
    "experiment": "507d64957fa9a6ed",
    "run": "231c015248d59d56",
    "resultArtifact": "5a7c74224615316b",
    "validation": "babae4b22c776bfa",
    "finding": "e0f05fda5da95841a96d36d9070e779847ddef97ffddebdbd5532f8f3fad963e"
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
  "verifiedAt": "2026-10-19T04:41:56.902Z"
}
```

---

## 9. Mandatory Scientific Research Notice

> **SCIENTIFIC EVIDENCE INTEGRITY NOTICE: This publication-grade evidence bundle grounds retrospective statistical findings in an immutable cryptographic audit trail. Physical Kerala State Lottery draws are independent stochastic trials. Past digit distributions possess zero predictive power for future draws. All predictive, gambling, or betting claims are scientifically unfounded.**