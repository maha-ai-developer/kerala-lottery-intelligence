# Architecture Specification

## Overview

The **Kerala State Lottery Intelligence & Experiment Platform** is designed from the ground up as a scientific instrument for legal verification, deterministic data extraction, rigorous statistical analysis, and reproducible backtesting.

It separates concerns into six strict layers:

```
SOURCE  ──>  DATA  ──>  KNOWLEDGE  ──>  STATISTICS  ──>  EXPERIMENT  ──>  AI
```

---

## The Six Layers

### 1. SOURCE Layer
- **Components**: `data/source-documents/`, Google Cloud Storage (`gs://kerala-lottery-intelligence-documents-*`), `packages/documents`.
- **Purpose**: Storage and immutability of raw official PDF gazette publications, acts, amendments, rules, and user manuals.
- **Invariants**:
  - Every document has a verified SHA-256 hash.
  - Documents are deduplicated by hash before processing.
  - Raw PDFs are stored in Cloud Storage, never directly inside database documents.

### 2. DATA Layer
- **Components**: `packages/domain`, `packages/validation`, `packages/data`, Cloud Firestore.
- **Purpose**: Structured canonical entities for lotteries, schemes, draws, series, prize structures, prize results, and winning numbers.
- **Invariants**:
  - **Canonical Number Rule**: Lottery numbers are strings. `"0276"` must remain `"0276"`.
  - Every winning number references its draw, prize rank, and source document page.

### 3. KNOWLEDGE Layer
- **Components**: `packages/knowledge`, Firestore collection `knowledgeGraph`.
- **Purpose**: Entity-relationship representation linking Acts, Rules, Amendments, Lotteries, and Source Evidence.
- **Invariants**:
  - Historical amendments never overwrite past rules.
  - Every rule retains `effectiveFrom` and optional `effectiveTo` timestamps.

### 4. STATISTICS Layer
- **Components**: `packages/statistics`, BigQuery.
- **Purpose**: Deterministic mathematical calculations including frequency, digit distribution, Shannon entropy, Chi-square tests, and Wald-Wolfowitz runs tests.
- **Invariants**:
  - Pure deterministic functions where applicable.
  - Test coverage for mathematical edge cases.

### 5. EXPERIMENT Layer
- **Components**: `packages/experiments`.
- **Purpose**: Walk-forward temporal backtesting, feature generation, and hypothesis evaluation.
- **Invariants**:
  - **Temporal Leakage Protection**: Prediction cutoff (`predictionCutoff`) is strictly enforced. No training feature may observe data on or after the cutoff date.
  - **Random Baselines**: Every predictive model must be evaluated alongside a uniform random baseline.

### 6. AI GATEWAY Layer
- **Components**: `packages/ai`, `services/ai-gateway`.
- **Purpose**: Server-side proxy routing user queries to LLM providers (Gemini, Anthropic, OpenAI) with tool execution and RAG source citations.
- **Invariants**:
  - Provider secrets are strictly server-side and never exposed to client browsers.
  - AI answers must cite source documents and draw evidence.
  - AI responses never claim guaranteed winnings or future prediction certainty.
