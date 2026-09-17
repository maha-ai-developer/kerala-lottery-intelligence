# Experiment Engine & Backtesting Specification

## Mandatory Scientific Constraint: Zero Temporal Leakage

Every predictive experiment must define an immutable:
```typescript
predictionCutoff: string; // ISO 8601 Timestamp
```

### Strict Non-Leakage Invariants
- **No Future Draws**: No draw occurring on or after `predictionCutoff` may be part of the training dataset.
- **No Future Aggregates**: Rolling statistics, historical frequencies, and feature matrices must be computed using exclusively past draws strictly prior to `predictionCutoff`.
- **Validation**: Any experiment violating temporal boundaries throws a fatal `TemporalLeakageException`.

---

## Walk-Forward Backtesting

Random train/test splits (e.g. standard cross-validation) are **prohibited** for time-series lottery predictions due to temporal lookahead bias. Instead, the platform enforces expanding-window walk-forward backtesting:

```
[ Draw 1 ... Draw 50 ] ──> Predict Draw 51 ──> Evaluate against ground truth
[ Draw 1 ... Draw 51 ] ──> Predict Draw 52 ──> Evaluate against ground truth
[ Draw 1 ... Draw 52 ] ──> Predict Draw 53 ──> Evaluate against ground truth
...
[ Draw 1 ... Draw N-1] ──> Predict Draw N  ──> Aggregate overall accuracy
```

---

## Benchmark Strategy Requirement

Every experiment run must evaluate against a **Uniform Random Baseline**:
- Pseudo-random number generation driven by deterministic seeds (`Mulberry32`).
- Candidate models (frequency, recency, Markov transitions, etc.) are only considered informative if their performance statistically exceeds the random baseline over a statistically significant number of draws.

---

## Experiment Reproducibility

Each experiment execution records:
- `datasetVersion`: e.g. `V001`
- `featureVersion`: e.g. `F_V1.2`
- `modelVersion`: e.g. `M_LOGISTIC_V2`
- `parameters`: JSON map of hyperparameters
- `randomSeed`: integer seed
- `codeVersion`: Git commit SHA
- `createdAt`: execution timestamp

Executing the same experiment configuration with the same seed on the same dataset version is guaranteed to reproduce identical results.
