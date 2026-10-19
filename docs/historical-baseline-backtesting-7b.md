# Milestone 7B: Historical Baseline Models & Backtesting Methodology

> **SCIENTIFIC BENCHMARKING NOTICE & DISCLAIMER**  
> This historical backtesting framework evaluates deterministic baseline reference models over historical Kerala lottery records for descriptive research and scientific benchmarking only.  
> It contains **NO winning-number predictions, betting advice, gambling strategy, or future probability claims**.  
> Backtest metrics reflect observed historical patterns only. Past historical draw distributions do not predict future lottery outcomes.

---

## 1. Purpose & Scientific Scope

Milestone 7B establishes the first reproducible baseline modeling and historical backtesting layer on top of the Milestone 7A Modeling Dataset (`mdset_857801355c1fb31e`).

The sole purpose is scientific benchmarking:
```
Historical Gazette Data
       ↓
Explicitly Defined Baseline
       ↓
Strict Chronological Evaluation
       ↓
Deterministic Metrics
       ↓
Comparative Analysis
```

The system strictly distinguishes between:
1. **OBSERVATION**: Historical draw results and prize counts recorded in Official Government Gazettes.
2. **BASELINE**: Explicit, non-learning reference distributions (Uniform, Training Empirical, Training Majority).
3. **BACKTEST RESULT**: Deterministic empirical metrics evaluated strictly on out-of-sample chronological test sets.
4. **INTERPRETATION**: Factual, descriptive summaries of historical baseline behavior without predictive extrapolation.

---

## 2. Dataset Contract (7A Ground Truth)

All backtests operate on the canonical Milestone 7A modeling dataset:
- **Modeling Dataset ID**: `mdset_857801355c1fb31e`
- **Source Feature Matrix**: `mfmat_9c93e90052bfb2c0`
- **Total Rows**: 2,270 (84 `SIX_DIGIT_FULL_TICKET`, 2,186 `FOUR_DIGIT_SUFFIX`)
- **Features**: 40 selected features (zero target features)
- **Targets Evaluated**:
  1. `observed_last_digit`: 10 classes (`"0"` through `"9"`)
  2. `observed_first_digit`: 10 classes (`"0"` through `"9"`)
  3. `observed_parity`: 2 classes (`"EVEN"`, `"ODD"`)

---

## 3. Baseline Model Definitions

### A. Uniform Baseline (`UNIFORM`)
For a $K$-class discrete categorical target, assigns equal probability to all allowed classes:
$$P(y = c) = \frac{1}{K} \quad \forall c \in \mathcal{C}$$
- For `observed_last_digit` ($K = 10$): $P(y = c) = 0.1$
- For `observed_first_digit` ($K = 10$): $P(y = c) = 0.1$
- For `observed_parity` ($K = 2$): $P(y = c) = 0.5$
- **Tie-Breaking Rule**: Deterministically predicts the first class in natural lexicographical ascending order (`"0"` for digits, `"EVEN"` for parity).

### B. Empirical Frequency Baseline (`EMPIRICAL`)
Estimates class probabilities strictly from the **training partition** of each chronological evaluation window:
$$P(y = c \mid \text{train}) = \frac{\text{count}_{\text{train}}(c)}{N_{\text{train}}}$$
- Never calculates frequencies across the whole dataset before splitting.
- Predicts the class with highest training frequency ($\operatorname{argmax}$).
- **Tie-Breaking Rule**: When two or more classes tie for highest frequency, selects the lexicographically lowest class (`LEXICOGRAPHICAL_ASCENDING`).

### C. Majority Class Baseline (`MAJORITY`)
Selects the most frequent class in the training partition only:
$$c_{\text{majority}} = \operatorname{argmax}_{c \in \mathcal{C}} \text{count}_{\text{train}}(c)$$
- **Tie-Breaking Rule**: Deterministic `LEXICOGRAPHICAL_ASCENDING`.
- **Probability Representation**: Assigns probability $1.0$ to the majority class and $0.0$ to all other allowed classes:
  $$P(y = c) = \begin{cases} 1.0 & \text{if } c = c_{\text{majority}} \\ 0.0 & \text{otherwise} \end{cases}$$
- Probabilities sum strictly to $1.0$.

---

## 4. Evaluation Metrics & Numerical Policies

### Accuracy
$$\text{Accuracy} = \frac{\sum_{i=1}^N \mathbb{I}(y_i = \hat{y}_i)}{N}$$

### Balanced Accuracy
Mean recall across all classes observed in the actual test outcomes:
$$\text{Balanced Accuracy} = \frac{1}{|\mathcal{C}_{\text{observed}}|} \sum_{c \in \mathcal{C}_{\text{observed}}} \frac{\text{TP}_c}{\text{Support}_c}$$

### Multiclass Log Loss & Zero-Probability Policy (`CLIPPED_EPSILON_1E_15`)
$$\text{Log Loss} = -\frac{1}{N} \sum_{i=1}^N \ln(\hat{p}_{i, y_i})$$
To prevent undefined $\ln(0)$ while penalizing zero-probability predictions, predicted probabilities are clipped via policy `CLIPPED_EPSILON_1E_15` ($\epsilon = 10^{-15}$):
$$p_{\text{clipped}} = \max(\epsilon, \min(1 - \epsilon, p))$$
For an unpredicted observed class ($p = 0$), the penalty is $-\ln(10^{-15}) \approx 34.54$.

### Confusion Matrix
Contingency table mapping true observed class rows to predicted class columns:
$$M[actual][predicted] = \sum_{i=1}^N \mathbb{I}(y_i = actual \land \hat{y}_i = predicted)$$

---

## 5. Evaluation Methodologies

### Chronological Holdout Backtest
- **Temporal Order**: Sorted strictly by authoritative draw timestamp ($t_{\text{draw}}$).
- **Training Partition**: Draws 1 through 4 (1,516 rows).
  - KR-768 (2026-08-28)
  - SM-72 (2026-08-29)
  - BT-71 (2026-08-30)
  - SS-537 (2026-08-31)
- **Test Partition**: Draws 5 through 6 (754 rows).
  - DL-69 (2026-09-01)
  - KN-641 (2026-09-02)
- **Temporal Invariant**: $\max(t_{\text{train}}) \le \min(t_{\text{test}})$. Zero shuffling, zero future data in training.

### Walk-Forward Sequential Backtest
Evaluates 4 expanding chronological windows with 1-draw step size:
- **Window 1**: Train on Draws 1–2 (758 rows); Test on Draw 3 (378 rows).
- **Window 2**: Train on Draws 1–3 (1,136 rows); Test on Draw 4 (380 rows).
- **Window 3**: Train on Draws 1–4 (1,516 rows); Test on Draw 5 (374 rows).
- **Window 4**: Train on Draws 1–5 (1,890 rows); Test on Draw 6 (380 rows).
- Preserves per-window results and aggregate metrics without obscuring window-level variation.

---

## 6. Historical Backtest Results (Canonical Dev Baseline)

### Chronological Holdout Results (1,516 Train, 754 Test)

| Target | Model | Accuracy | Balanced Accuracy | Log Loss |
| :--- | :--- | :--- | :--- | :--- |
| `observed_last_digit` | `UNIFORM` | 0.0968 | 0.1000 | 2.3026 |
| `observed_last_digit` | `EMPIRICAL` | 0.1021 | 0.1000 | 2.3033 |
| `observed_last_digit` | `MAJORITY` | 0.1021 | 0.1000 | 31.0116 |
| `observed_first_digit` | `UNIFORM` | 0.1088 | 0.1000 | 2.3026 |
| `observed_first_digit` | `EMPIRICAL` | 0.1101 | 0.1000 | 2.3090 |
| `observed_first_digit` | `MAJORITY` | 0.1101 | 0.1000 | 30.7368 |
| `observed_parity` | `UNIFORM` | 0.4629 | 0.5000 | 0.6931 |
| `observed_parity` | `EMPIRICAL` | 0.5371 | 0.5000 | 0.6914 |
| `observed_parity` | `MAJORITY` | 0.5371 | 0.5000 | 15.9868 |

### Walk-Forward Aggregate Summary (4 Sequential Expanding Windows)

| Target | Model | Windows | Mean Accuracy | Mean Balanced Acc | Mean Log Loss |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `observed_last_digit` | `UNIFORM` | 4 | 0.1012 | 0.1000 | 2.3026 |
| `observed_last_digit` | `EMPIRICAL` | 4 | 0.0985 | 0.1000 | 2.3075 |
| `observed_last_digit` | `MAJORITY` | 4 | 0.0985 | 0.1000 | 31.1362 |
| `observed_first_digit` | `UNIFORM` | 4 | 0.1005 | 0.1000 | 2.3026 |
| `observed_first_digit` | `EMPIRICAL` | 4 | 0.1092 | 0.1000 | 2.3053 |
| `observed_first_digit` | `MAJORITY` | 4 | 0.1092 | 0.1000 | 30.7685 |
| `observed_parity` | `UNIFORM` | 4 | 0.4801 | 0.5000 | 0.6931 |
| `observed_parity` | `EMPIRICAL` | 4 | 0.5199 | 0.5000 | 0.6926 |
| `observed_parity` | `MAJORITY` | 4 | 0.5199 | 0.5000 | 16.5821 |

---

## 7. Leakage Controls & Invariants

The backtesting engine enforces all 9 leakage checks:
1. **Disjoint Draw & Result Partitions**: Zero draw ID or result ID overlap between train and test partitions.
2. **Test Labels Never Used in Fitting**: Evaluated via adversarial perturbation (mutating test labels does not alter model fitted state).
3. **Empirical Frequencies Training-Only**: Frequencies and counts calculated exclusively from training rows.
4. **Majority Class Training-Only**: Mode class selected strictly from training rows.
5. **Chronological Ordering Preserved**: $\max(t_{\text{train}}) \le \min(t_{\text{test}})$ in holdout and all walk-forward windows.
6. **No Future Row Influence**: Earliest window evaluation never influenced by subsequent draws.
7. **Target Columns Not in Features**: Target column strictly filtered out of feature sets.
8. **Source Identifiers Not Predictive**: Document SHA-256, draw IDs, and result IDs cannot serve as features.
9. **Deterministic Reproducibility**: Repeated runs produce bit-for-bit identical IDs, hashes, and metric values.

---

## 8. Limitations & Constraints

1. **Small Historical Corpus**: The current baseline corpus covers 6 consecutive official daily draws (2,270 records). Measured backtest performance is descriptive of this sample only and does not establish predictive capability.
2. **Descriptive Reference**: Baseline models are reference benchmarks against which future modeling experiments will be compared. They do not constitute an operational betting or advisory system.
