# PDF Ingestion & Verification Pipeline

## Overview
Official Kerala State Lottery PDFs are the source of truth for all draw outcomes and legal regulations. The ingestion pipeline extracts structured data deterministically and enforces strict provenance tracking.

---

## The Ingestion Pipeline

```
PDF Document
  ↓
Cloud Storage Upload (gs://...)
  ↓
SHA-256 Checksum Calculation
  ↓
Duplicate Detection (Reject or Link Existing)
  ↓
Text Extraction & Page Segmentation
  ↓
Document Classification (Result vs Rule vs Manual)
  ↓
Deterministic RegEx & Layout Parser
  ↓
Structured Extraction (Draw, Prizes, Winning Numbers)
  ↓
Invariant Validation (Number length, intact leading zeros, prize counts)
  ↓
Human Review Gate (For flagged or low-confidence draws)
  ↓
Approval & Firestore Commit
  ↓
BigQuery Analytics Export
```

---

## Deterministic Parser Priority
- **Primary Parser**: Deterministic string and layout parser. Employs regex patterns matching Kerala State Lottery Gazette formatting (header tags, prize tier keywords, series prefixes).
- **Secondary AI Assistance**: LLMs are only invoked for ambiguous layouts, low-quality scanned text, or non-standard amendment formats. LLMs are **never** the sole unverified parser.
- **Validation Gates**:
  1. Draw series must match known series (or flag for review).
  2. Number length must strictly match prize level definition (e.g. 4 digits for suffix, 6 digits for full tickets).
  3. No leading zeros lost (`"0276"` cannot parse as `"276"`).
  4. Total prizes must reconcile with the published prize structure.

---

## "View Source" Provenance UI
Every number in the application links to its source evidence:
- Displays `documentId`, `pageNumber`, and `sourceText`.
- Clicking "View Source" opens the original gazette PDF and navigates directly to the target page with bounding box highlight.
