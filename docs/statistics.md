# Statistics Engine Specification

## Overview
Package: `@kerala-lottery/statistics`

The statistics engine provides mathematically rigorous, deterministic functions to analyze historical draw data. Its purpose is empirical hypothesis testing (e.g. testing for non-uniformity, serial correlation, or anomalies) rather than gambling predictions.

---

## Implemented Statistical Routines

### 1. Frequency & Rolling Frequency
- **Absolute Count**: Total occurrences of a number or suffix across a time window.
- **Relative Frequency**: $f_i = \frac{n_i}{N}$.
- **Rolling Window**: Frequencies computed over sliding windows of size $W \in \{10, 30, 50, 100\}$ draws.

### 2. Digit Distribution
- Position-wise digit count for each index $j \in \{0, \dots, L-1\}$ in string numbers.
- Identifies whether specific digit positions skew away from expected uniform frequency (10% per digit $0-9$).

### 3. Shannon Entropy
Measures distributional disorder / information content:
$$H(X) = - \sum_{i} P(x_i) \log_2 P(x_i)$$
- Uniform distribution over $K$ outcomes produces maximum entropy $\log_2(K)$.
- Reductions in entropy signal distributional bias or clustering.

### 4. Pearson's Chi-Square Goodness-of-Fit Test
Tests the null hypothesis that winning numbers follow a discrete uniform distribution:
$$\chi^2 = \sum_{i=1}^{k} \frac{(O_i - E_i)^2}{E_i}$$
- $O_i$: Observed count of outcome $i$.
- $E_i$: Expected count under uniform randomness ($\frac{N}{k}$).
- Degrees of freedom: $df = k - 1$.

### 5. Wald-Wolfowitz Runs Test
Tests whether sequential draws exhibit independence / serial randomness:
- Number of runs $R$ of values above versus below the median.
- Computes standardized $Z$-score:
$$Z = \frac{R - \mu_R}{\sigma_R}$$
- Significant deviations from $Z \approx 0$ indicate trend, clustering, or excessive alternation.

### 6. Monte Carlo & Permutation Tests
- Compares empirical distributions against $B = 10,000$ synthetic uniform draw simulations.
- Produces non-parametric empirical $p$-values.
