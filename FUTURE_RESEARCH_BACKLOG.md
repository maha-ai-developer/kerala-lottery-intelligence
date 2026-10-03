# Future Research Backlog

**Status:** PROSPECTIVE INQUIRIES & FUTURE EXPLORATIONS ONLY  
**Release Boundary:** Post-V1.0  
**Project Status:** CLOSED / V1.0 COMPLETE  
**Notice:** None of the items listed below represent unfinished work, bugs, or missing requirements of Project V1.0. All items in this backlog are subject to formal peer review, external data availability, and institutional ethics evaluation before any prospective work commences. Under no circumstances should these items be construed as subsequent milestones (e.g., 10B, 10C, 11A).

---

## 1. District Ticket-Exposure Acquisition & Auditing

### Context
In Milestone 10A, the platform established that public Kerala Government Gazette result sheets publish only winning ticket serials and issuing office locations for major prizes—omitting district-level ticket sales counts and returned unsold counterfoils. As a result, calculating true exposure-adjusted probabilities remains mathematically impossible under the public gazette corpus alone.

### Prospective Exploration
- **Authoritative Administrative Requests:** Inquire with the Directorate of Kerala State Lotteries or open-records bodies regarding the public availability of historical district-wise print run allocations, agent distribution logs, and returned unsold counterfoil audits.
- **Exposure Data Reconciliation Framework:** Design data ingestion schemas to securely ingest and validate official sales exposure tables without compromising the integrity of the primary gazette result corpus.

---

## 2. Exposure-Adjusted Geographic Statistical Tests

### Context
Currently, the platform reports raw descriptive counts (380 major prize location observations across 14 revenue districts) and strictly labels all geographic queries with `EXPOSURE_UNAVAILABLE`.

### Prospective Exploration
- **Multinomial Goodness-of-Fit with Exposure Weights:** Once authoritative sales denominators ($S_d$) become available, implement formal multinomial chi-square and likelihood ratio tests comparing observed winning distributions ($W_d$) to expected sales shares ($S_d / S_{\text{total}}$).
- **Spatial Autocorrelation Analysis:** If geographic coordinates of sub-lottery offices and retail agency clusters are acquired, evaluate spatial clustering metrics (e.g., Moran's I) against null models conditioned on local sales volume.

---

## 3. Advanced Statistical & Bayesian Baseline Formulations

### Context
The V1.0 scientific validation layer (Milestone 9C) incorporates three rigorous retrospective baselines: EXP-001 (Uniform Chance), EXP-002 (Empirical Marginal Frequency), and EXP-003 (Majority Class Prior), evaluated with Wilson score confidence intervals, percentile bootstrap resampling, and Holm-Bonferroni FWER control.

### Prospective Exploration
- **Hierarchical Dirichlet-Multinomial Models:** Model multi-digit suffix distributions under hierarchical Bayesian priors to estimate shrinkage across lottery schemes with varying sample sizes.
- **Markov Transition Matrix Invariance:** Test higher-order Markov chain models against pseudo-random physical draw independence to verify absence of mechanical sequential dependencies across consecutive weekly draws.

---

## 4. Multi-Modal Gazette Ingestion & Source Enrichment

### Context
Milestone 8A/8C operationalized deterministic PDF extraction with SHA-256 verification and rule-based table parsing across all 103 canonical draws.

### Prospective Exploration
- **Historical Archive Digits (Pre-2024):** If the Directorate publishes older historical gazette archives (e.g., 2010–2023), develop extended optical character recognition (OCR) and layout analysis pipelines with provenance grounding.
- **Cross-Source Consistency Audits:** Compare gazette text against official Kerala Lottery mobile app data feeds or verified press releases to detect discrepancies or printing errata.

---

## 5. Machine Learning & Neural Sequence Explorations

### Context
Milestone 7A/7B/7C established canonical machine learning feature extraction and chronological validation splits (31,700 train / 7,850 test records) with strictly enforced non-predictive baseline comparisons.

### Prospective Exploration
- **Recurrent Neural Network (RNN / LSTM) Entropy Auditing:** Train sequence models on draw history not to predict future numbers, but as an empirical entropy probe to test whether any non-random statistical regularities exceed theoretical noise thresholds.
- **Generative Adversarial Anomaly Detection:** Train autoencoders on ticket feature distributions to detect anomalous draws or potential data transcription errors in historical tables.

---

## 6. External Socio-Economic Correlates & Public Policy Research

### Context
The platform's mandate is descriptive lottery data science and knowledge graph provenance.

### Prospective Exploration
- **Socio-Economic Correlation Studies:** Correlate official district ticket purchase trends (if acquired) with district-level census data, banking penetration, and employment indicators to support public health and economic policy research.
- **Responsible Gaming Decision Support:** Provide research-backed informational modules and educational visualizers demonstrating the mathematical reality of negative expected value in commercial lotteries.

---

**END OF BACKLOG — NO FURTHER MILESTONES DEFINED**
