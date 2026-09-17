# Cost Control & Resource Management

## Overview
The platform operates on a cost-aware architecture designed to avoid unbounded compute, runaway BigQuery analytical queries, or uncontrolled LLM token consumption.

---

## 1. Firebase App Hosting / Cloud Run Limits
- Configured in [apphosting.yaml](file:///home/pi/kerela-lottery-project/kerala-lottery-intelligence/apphosting.yaml):
  - `minInstances: 0`: Scales to zero when idle, eliminating idle container compute costs.
  - `maxInstances: 20`: Hard ceiling preventing DDoS or traffic spikes from incurring massive Cloud Run bills.
  - `memoryMiB: 512`, `cpu: 1`: Lean container footprint.
  - `concurrency: 80`: High connection multiplexing per container.

---

## 2. BigQuery Cost Controls
- **Partitioning & Clustering**: All analytical tables are partitioned by `drawDate` and clustered by `lotteryId` and `canonicalNumber`.
- **Query Byte Caps**: Analytical queries executed by researchers enforce maximum bytes billed limits (`maximum_bytes_billed = 1_000_000_000` = 1 GB cap).
- **Prohibited Patterns**: `SELECT *` queries on historical tables without date partitioning filters are rejected.

---

## 3. AI Token & Invocation Quotas
- **Per-User Budgets**: Researchers and Analysts are assigned daily token ceilings (e.g. 100,000 tokens/day).
- **Short-Context Prompting**: RAG vector retrieval injects only relevant chunk citations into context rather than entire PDF text dumps.
- **Model Tiering**: Routine classifications and sanity checks use lightweight models (e.g. Gemini 2.5 Flash) rather than expensive reasoning models.
