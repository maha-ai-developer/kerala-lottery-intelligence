# Scientific Research Report: Empirical Evaluation of EXP-002-EMPIRICAL-BASELINE Baseline

**Finding ID:** `find_9bcf9e7a7f78a3c1`  
**Evidence Bundle ID:** `evb_d10b013e991fdc12`  
**Experiment:** `EXP-002-EMPIRICAL-BASELINE` (v1.0.0)  
**Run ID:** `run_98cec5487d4f4450`  
**Validation ID:** `val_dc5068d1eefb66ec`  
**Generated:** 2026-10-18T10:15:48.987Z  
**Deterministic Content Hash:** `aff3a6772ded571dcbee8d1382b3563ec1f2dffac7afb612a757db0f3a13e2f6`  

---

## Abstract

This report presents the formal statistical validation of the EXP-002-EMPIRICAL-BASELINE baseline model evaluated against the 103-draw canonical Kerala State Lottery research corpus (N = 7,850 chronological holdout test records across 20 draws). Observed test accuracy of 10.57% (Wilson 95% CI: [9.95%, 11.22%], SE: 0.32%) was evaluated against a discrete uniform null hypothesis (H0: p = 0.10). Following Holm-Bonferroni multiple-comparison error control across the canonical baseline family, the adjusted empirical p-value is 0.1409 (isSignificant = false). Temporal walk-forward evaluation across 3 expanding windows confirmed a stability score of 98.2% with zero data leakage. Physical lottery drawings operate as independent stochastic physical trials; historical frequency distributions possess zero predictive power.

---

## 1. Scientific Claim & Taxonomy Classification

| Attribute | Specification |
| :--- | :--- |
| **Claim Type** | `STATISTICAL_RESULT` |
| **Formal Statement** | Empirical Marginal Frequency Baseline (EXP-002-EMPIRICAL-BASELINE) achieved 10.57% holdout accuracy against discrete uniform null mean of 10.01% (Holm-Bonferroni adjusted p = 0.1409, Z = 1.78, isSignificant = false). |
| **Methodology** | `EXPANDING_WINDOW_HOLM_BONFERRONI_V1` (v1.0.0) |
| **Family ID** | `EXP_FAMILY_CANONICAL_BASELINES` (m = 3) |
| **Confidence Level** | 95% (z = 1.96) |

---

## 2. Evaluation Population & Canonical Corpus Grounding

- **Canonical Research Corpus:** `corpus_055e805237802b5e`
  - Total Gazetted Draws: **118 draws**
  - Total Winning Results: **45,218 results**
  - Source Gazette Documents: **118 PDF files** (all cryptographically verified via SHA-256)
- **Modeling Dataset:** `mdset_eca289076fe0c947`
  - Total Rows: **45,218 rows**
  - Training Split: **36,236 rows**
  - Chronological Holdout Test Split: **8,982 rows** (23 draws)

---

## 3. Empirical Statistical Evidence & Uncertainty Quantification

| Metric | Empirical Value | Theoretical Reference | Notes |
| :--- | :---: | :---: | :--- |
| **Holdout Accuracy** | **10.57%** | 10.00% | Binomial proportion on N = 8982 |
| **Standard Error (SE)** | **0.32%** (`0.003243`) | $\sqrt{p(1-p)/n} \approx 0.34\%$ | Binomial standard error |
| **Margin of Error (95%)** | **±0.64%** | $1.96 \times SE$ | 95% Confidence Radius |
| **Wilson Score 95% CI** | **[9.95%, 11.22%]** | [0, 1] bounded | Asymmetric score interval |
| **Bootstrap 95% CI** | **[10.01%, 11.24%]** | Empirical percentiles | B = 1,000 resamples (Mulberry32 PRNG) |
| **Cross-Entropy Log Loss** | **2.3028** | $-\ln(0.1) = 2.3026$ | Natural log categorical entropy |
| **Cohen's $h$ Effect Size** | **0.0186** | 0.0000 | Trivial effect ($|h| < 0.20$) |
| **Relative Accuracy Ratio** | **1.057x** | 1.000x | Ratio to discrete uniform chance |

---

## 4. Null-Hypothesis Significance Testing & Multiple-Comparison Control

### Null Model Distribution (`DISCRETE_UNIFORM_NULL`)
- **Hypothesis:** $H_0: p_i = \frac{1}{10}$ for all digits $i \in \{0 \dots 9\}$
- **Simulation:** $B = 1000$ iterations with deterministic Mulberry32 seed `42`
- **Null Distribution Mean:** 10.01% (Std Dev: 0.31%)
- **Standardized Z-Score:** $Z = 1.782$
- **Empirical P-Value (Raw):** $p = 0.0470$ (calculated via conservative $\frac{k + 1}{B + 1}$)

### Family-Wise Error Rate Control (`Holm-Bonferroni`)
- **Family:** `EXP_FAMILY_CANONICAL_BASELINES` ($m = 3$ baseline hypotheses)
- **Base Alpha:** $\alpha = 0.05$
- **Adjusted P-Value:** $p_{\text{adj}} = 0.1409$
- **Statistically Significant:** **NO (Fail to reject H0)**

---

## 5. Temporal Robustness & Expanding-Window Walk-Forward

- **Evaluation Strategy:** Chronological Expanding Windows (3 folds)
- **Temporal Stability Score:** **98.2%** ($1 - \frac{\sigma}{\mu}$)
- **Temporal Leakage Protection:** **VERIFIED (Zero Future Data Leakage)**

| Fold | Training Date Range | Train Draws | Test Date Range | Test Draws | Fold Accuracy | Cross-Entropy | Leakage Guard |
| :---: | :--- | :---: | :--- | :---: | :---: | :---: | :---: |
| Fold 1 | `2026-06-19 → 2026-08-29` | 70 (26,784 rows) | `2026-08-30 → 2026-09-14` | 16 (6,052 rows) | **10.00%** | 2.3026 | PASS |
| Fold 2 | `2026-06-19 → 2026-09-14` | 86 (32,836 rows) | `2026-09-15 → 2026-09-30` | 16 (6,334 rows) | **10.36%** | 2.3026 | PASS |
| Fold 3 | `2026-06-19 → 2026-09-30` | 102 (39,170 rows) | `2026-10-01 → 2026-10-17` | 16 (6,048 rows) | **10.27%** | 2.3026 | PASS |

---

## 6. Five-Part Research Interpretation Contract

1. **[OBSERVATION]**  
   Observed test accuracy across N=8,982 holdout results is 10.57% with cross-entropy log loss of 2.3028.
2. **[STATISTICAL EVIDENCE]**  
   - Observed Accuracy: 10.57%
   - Wilson 95% CI: [9.95%, 11.22%]
   - Raw Empirical P-Value: 0.0470 (Z = 1.78)
   - Holm Adjusted P-Value: 0.1409 (Significant: false)
3. **[UNCERTAINTY]**  
   - Standard Error: 0.32% (0.003243)
   - Margin of Error (95%): ±0.64%
   - Degrees of Freedom: 8981
4. **[INTERPRETATION]**  
   Observed accuracy does not statistically deviate from uniform random physical chance (p_adj = 0.1409 > 0.05). Consistent with independent physical lottery draw trials.
5. **[LIMITATION]**  
   Evaluated retrospectively on canonical historical gazetted publications. State lottery draws are independent physical random processes; historical digit frequencies possess zero predictive validity for future drawings.

---

## 7. Complete 9-Stage Lineage & Provenance Chain

| Stage | Entity Step | Identity | Deterministic Content Hash |
| :---: | :--- | :--- | :--- |
| **Stage 1** | `SOURCE_DOCUMENTS` | 118 gazetted source documents | `4e629dc75b106a797eee...` |
| **Stage 2** | `DRAWS` | 118 verified draw records | `d3f9b09606a632cfcda9...` |
| **Stage 3** | `CORPUS` | corpus_055e805237802b5e | `055e805237802b5e...` |
| **Stage 4** | `FEATURE_MATRIX` | fmat_4c5437d04467bfa6 | `fmat_4c5437d04467bfa...` |
| **Stage 5** | `MODELING_DATASET` | mdset_eca289076fe0c947 | `eca289076fe0c947...` |
| **Stage 6** | `EXPERIMENT_DEFINITION` | EXP-002-EMPIRICAL-BASELINE | `b010537cd8f6ceb5...` |
| **Stage 7** | `EXPERIMENT_RUN` | run_98cec5487d4f4450 | `50995e5c6f535489...` |
| **Stage 8** | `RESULT_ARTIFACT` | art_03606e6c75d6db5d | `4d58aa40452930c3...` |
| **Stage 9** | `VALIDATION` | val_dc5068d1eefb66ec | `3723bb9f7d51fd8c...` |
| **Stage 10** | `FINDING` | find_9bcf9e7a7f78a3c1 | `aff3a6772ded571dcbee...` |

Lineage Integrity: **COMPLETE & VERIFIED**  
Evidence Bundle Integrity: **100% BITWISE VERIFIED**  

---

## 8. Cryptographic Audit Trail & Software Environment

```json
{
  "findingId": "find_9bcf9e7a7f78a3c1",
  "evidenceBundleId": "evb_d10b013e991fdc12",
  "artifactHashes": {
    "corpus": "055e805237802b5e",
    "dataset": "eca289076fe0c947",
    "experiment": "b010537cd8f6ceb5",
    "run": "50995e5c6f535489",
    "resultArtifact": "4d58aa40452930c3",
    "validation": "3723bb9f7d51fd8c",
    "finding": "aff3a6772ded571dcbee8d1382b3563ec1f2dffac7afb612a757db0f3a13e2f6"
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
  "verifiedAt": "2026-10-18T10:15:48.987Z"
}
```

---

## 9. Mandatory Scientific Research Notice

> **SCIENTIFIC EVIDENCE INTEGRITY NOTICE: This publication-grade evidence bundle grounds retrospective statistical findings in an immutable cryptographic audit trail. Physical Kerala State Lottery draws are independent stochastic trials. Past digit distributions possess zero predictive power for future draws. All predictive, gambling, or betting claims are scientifically unfounded.**