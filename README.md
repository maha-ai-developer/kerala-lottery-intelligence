# Kerala State Lottery Intelligence & Experiment Platform

A scientific research platform engineered for verifiable source provenance, deterministic statistical analysis, temporal leak prevention, and reproducible backtesting.

> **Note**: This is an academic and empirical research platform, **not** a gambling or ticket selling application.

---

## Core Foundational Principles

1. **Every number has a source.**
2. **Every result belongs to a draw.**
3. **Every draw belongs to a lottery.**
4. **Every rule belongs to a legal document and time period.**
5. **Every experiment belongs to a dataset version.**
6. **Every AI answer must be grounded in evidence.**

---

## Platform Architecture Layers

The platform enforces strict unidirectional flow across six independent layers:

```
SOURCE  ──>  DATA  ──>  KNOWLEDGE  ──>  STATISTICS  ──>  EXPERIMENT  ──>  AI
```

| Layer | Responsibility | Storage / Compute |
| :--- | :--- | :--- |
| **1. SOURCE** | Original gazette PDFs, SHA-256 verification, duplicate check | Google Cloud Storage |
| **2. DATA** | Canonical draw models, prize hierarchies, string numbers (`"0276"`) | Cloud Firestore & BigQuery |
| **3. KNOWLEDGE** | Acts, rules, amendments, knowledge graph edges, timeline | Cloud Firestore |
| **4. STATISTICS** | Deterministic frequency, entropy, Chi-square, runs test | Packages & BigQuery |
| **5. EXPERIMENT** | Zero-leakage temporal backtesting, uniform random baselines | Packages & Cloud Run |
| **6. AI GATEWAY** | Server-side LLM router, controlled tools, RAG citations | Cloud Run & Secret Manager |

---

## The Critical Number Invariant

**Lottery numbers are strings.**
Canonical lottery numbers must **never** be coerced into integers.
Numbers with leading zeros (such as `"0276"`) must retain their exact string representation throughout every pipeline stage.

```typescript
// Canonical representation always wins:
canonicalNumber: "0276"  // Required
numericValue: 276         // Optional derived value only
```

---

## Monorepo Layout

```
kerala-lottery-intelligence/
├── apps/
│   └── web/                   # Next.js TypeScript web application (Firebase App Hosting)
├── packages/
│   ├── domain/                # Entities, types, and invariant definitions
│   ├── data/                  # Firestore & GCS data access contracts
│   ├── statistics/            # Deterministic statistical calculation engine
│   ├── experiments/           # Walk-forward backtesting & temporal leakage guards
│   ├── ai/                    # Multi-provider AI Gateway (Gemini, OpenAI, Anthropic)
│   ├── knowledge/             # Knowledge graph nodes and legal relations
│   ├── documents/             # Gazette classifications and extraction schemas
│   └── validation/            # Invariant validators (e.g., "0276" preservation)
├── services/
│   ├── ingestion/             # Deterministic PDF parsing pipeline
│   ├── analytics/             # BigQuery analytical ETL contracts
│   └── ai-gateway/            # Authenticated server-side AI proxy
├── docs/                      # Comprehensive platform documentation
├── data/                      # Structured source document repository
└── firebase.json              # Firebase App Hosting & Firestore configuration
```

---

## Getting Started

### Prerequisites
- Node.js `v20+` (tested on `v22.23.2`)
- npm `10+`
- Firebase CLI (`npx -y firebase-tools@latest`)

### Local Installation
```bash
# Clone the repository
git clone https://github.com/maha-ai-developer/kerala-lottery-intelligence.git
cd kerala-lottery-intelligence

# Install dependencies across all monorepo workspaces
npm install

# Run unit tests and core invariant validations
npm test

# Run Next.js development server
npm run dev
```

---

## Git Conventions & Branching

- **Branches**:
  - `main`: Production release branch.
  - `develop`: Integration branch.
  - `feature/<name>`: New capabilities.
  - `fix/<name>`: Bug fixes.
  - `experiment/<name>`: Research experiments.
- **Commits**: Conventional commit format (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`, `perf:`). Small, atomic commits only.
