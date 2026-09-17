# Google Cloud Platform Configuration

## Overview
The platform leverages Google Cloud Platform services provisioned under project:
- **GCP Project ID**: `kerala-lottery-intelligence`
- **Default Region**: `asia-south1`

---

## 1. Google Cloud Storage (PDF & Source Evidence)

### Buckets
- Development: `kerala-lottery-intelligence-documents-dev`
- Production: `kerala-lottery-intelligence.firebasestorage.app` (or dedicated GCS bucket `kerala-lottery-intelligence-source-documents`)

### Folder Hierarchy
```
source-documents/
├── lottery-results/      # Official PDF draw results
├── legal/                # Acts, Parent regulations
├── amendments/           # Gazette amendments (S.R.O.)
├── manuals/              # Agent/Officer user manuals
└── forms/                # Statutory prize claim forms
```

### Invariants
- Direct access to PDFs is mediated via authenticated pre-signed URLs.
- Every uploaded PDF is hashed using SHA-256 before ingestion.

---

## 2. BigQuery Analytics Engine

Historical statistical computations, feature matrices, and large aggregations run on BigQuery rather than Firestore transactional databases.

### Datasets
1. `kerala_lottery_raw`: Raw document extraction logs and text segments.
2. `kerala_lottery_canonical`: Normalized draws, prize tiers, and winning numbers.
3. `kerala_lottery_derived`: Feature tables (digit distributions, rolling frequencies, recency indices).
4. `kerala_lottery_experiments`: Experiment configurations, backtest runs, and candidate predictions.

---

## 3. Secret Manager

API keys and credentials for third-party AI services are stored securely in Google Cloud Secret Manager:

- `gemini-api-key`: Google Gemini API key
- `openai-api-key`: OpenAI API key (optional secondary adapter)
- `anthropic-api-key`: Anthropic API key (optional secondary adapter)

Cloud Run services access these secrets via Application Default Credentials (ADC) or mounted environment variables.

---

## 4. Observability & Monitoring

- **Cloud Logging**: All structured audit logs, parser execution outputs, and backend errors are streamed to Cloud Logging.
- **Cloud Monitoring**: Alert policies for Cloud Run 5xx error spikes, Firestore quota limits, and AI provider rate limits.
