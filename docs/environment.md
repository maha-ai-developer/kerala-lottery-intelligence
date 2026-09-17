# Environment Configuration & Secret Management

## Guidelines
- **Zero Secret Commits**: Never commit `.env`, `.env.local`, `service-account*.json`, or private keys to git.
- **Environment Parity**: Maintain consistency across `development`, `staging`, and `production`.
- **Public vs Secret**: Public Firebase web configuration (used by the browser to connect to Firebase) is exposed via `NEXT_PUBLIC_*`. Server secrets (such as LLM API keys) must only exist in Google Secret Manager or server-side environment variables.

---

## Environment Variable Reference

### Client-Side Variables (`NEXT_PUBLIC_*`)
Exposed to the browser runtime during build and request serving:

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_APP_ENV` | Current runtime environment | `development` / `production` |
| `NEXT_PUBLIC_APP_VERSION` | Semantic version string displayed in UI | `0.1.0` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Public Firebase Web API Key | `AIzaSyCpxJlxYaM2eVK2NG0pB0-7yLBITsLoBok` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Authentication domain | `kerala-lottery-intelligence.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | GCP / Firebase Project ID | `kerala-lottery-intelligence` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`| Default Cloud Storage bucket | `kerala-lottery-intelligence.firebasestorage.app`|
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | FCM messaging sender ID | `660682986882` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase Web App ID | `1:660682986882:web:32a1f0c4549be1f68e2b9b` |
| `NEXT_PUBLIC_USE_FIREBASE_EMULATORS` | Connect to local Firebase emulators | `false` |

### Server-Side Variables (Cloud Run / Secret Manager)
Accessible only by authenticated backend services:

| Variable | Description | Storage in Production |
| :--- | :--- | :--- |
| `GCP_PROJECT_ID` | Google Cloud Project ID (`kerala-lottery-intelligence`) | Cloud Run Env |
| `GCP_REGION` | Compute and storage region (`asia-south1`) | Cloud Run Env |
| `GCS_BUCKET_DOCUMENTS` | Bucket name for original PDF documents | Cloud Run Env |
| `BIGQUERY_DATASET_RAW` | Raw BigQuery dataset name | Cloud Run Env |
| `BIGQUERY_DATASET_CANONICAL`| Canonical BigQuery dataset name | Cloud Run Env |
| `BIGQUERY_DATASET_DERIVED`| Derived feature dataset name | Cloud Run Env |
| `BIGQUERY_DATASET_EXPERIMENTS` | Experiment backtest dataset name | Cloud Run Env |
| `GEMINI_API_KEY` | Google Gemini API key for AI Gateway | Secret Manager |
| `OPENAI_API_KEY` | OpenAI API key (optional secondary adapter) | Secret Manager |
| `ANTHROPIC_API_KEY` | Anthropic API key (optional secondary adapter) | Secret Manager |
