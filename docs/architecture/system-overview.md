# System Overview: Kerala State Lottery Intelligence & Experiment Platform

## High-Level Topology

```
┌────────────────────────────────────────────────────────────────────────┐
│                              Next.js Web UI                            │
│           (Apps/Web - Responsive, Tailwind-Free Vanilla CSS)           │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                   Firebase Auth (Phone SMS OTP)
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Firebase App Hosting                            │
│                       (Google Cloud Run Pods)                          │
└──────────┬───────────────────────┬──────────────────────┬──────────────┘
           │                       │                      │
           ▼                       ▼                      ▼
┌─────────────────────┐ ┌────────────────────┐ ┌─────────────────────────┐
│   Cloud Firestore   │ │    Cloud Storage   │ │      AI Gateway         │
│ (Canonical Records, │ │   (Source Gazette  │ │  (Gemini, OpenAI, Anth) │
│  Audit Logs, Rules) │ │    PDF Documents)  │ │   Secret Manager Auth   │
└──────────┬──────────┘ └────────────────────┘ └─────────────────────────┘
           │
           ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          Google BigQuery                               │
│              (Analytical Tables, Backtests, Features)                  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Provenance Enforcement
Whenever a user views a winning number, clicking **"View Source"** queries:
1. `winningNumbers` record -> retrieves `sourceDocumentId`, `sourcePage`, and `sourceText`.
2. `documents` collection -> fetches signed GCS storage URL.
3. The UI opens the PDF viewer directly at `sourcePage` and highlights the line matching `sourceText`.
