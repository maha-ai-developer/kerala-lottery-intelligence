# Environment Configuration & Secret Management

## Guidelines
- **Zero Secret Commits**: Never commit `.env`, `.env.local`, `service-account*.json`, or private keys to git.
- **Environment Parity**: Maintain consistency across `development` and `production`.
- **Project Identification & Access Control**: Web API keys identify the Firebase project, while Firestore/Storage authorization is enforced by Security Rules and privileged server access is controlled by IAM/service credentials. Server secrets (such as LLM API keys) must only exist in Google Secret Manager or server-side environment variables.

---

## Environment Variable Reference

### Client-Side Variables (`NEXT_PUBLIC_*`)
Exposed to the browser runtime during build and request serving:

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_APP_ENV` | Current runtime environment | `development` / `production` |
| `NEXT_PUBLIC_APP_VERSION` | Semantic version string displayed in UI | `0.1.0` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Public Firebase Web API Key | `<PROJECT_WEB_API_KEY>` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Authentication domain | `<project-id>.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | GCP / Firebase Project ID | `kerala-lottery-intel-dev` / `kerala-lottery-intelligence` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`| Default Cloud Storage bucket | `<project-id>.firebasestorage.app` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | FCM messaging sender ID | `608186999779` (DEV) / `660682986882` (PROD) |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase Web App ID | `<PROJECT_WEB_APP_ID>` |
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
