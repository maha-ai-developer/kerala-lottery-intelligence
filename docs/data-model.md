# Data Model & Provenance Specification

## Core Principle
Every number has a source. Every result belongs to a draw. Every draw belongs to a lottery. Every rule belongs to a legal document and time period. Every experiment belongs to a dataset version.

---

## 1. Critical Number Rule

**Lottery numbers are strings.**
They must **never** be coerced into integers.

- Example: `"0276"` must remain `"0276"`.
- Coercing `"0276"` into `276` destroys the leading zero and corrupts suffix matching, digit position analysis, and cryptographic provenance.

```typescript
interface WinningNumber {
  id: string;
  drawId: string;
  prizeResultId: string;
  series?: string;                    // e.g. "DB"
  canonicalNumber: string;             // Always string: "0276"
  numberLength: number;                // e.g. 4
  isSuffix: boolean;                   // true for last-4-digit prizes
  suffixLength?: number;
  resultType: "PRIMARY" | "CONSOLATION" | "SUFFIX" | "OTHER";
  sourceDocumentId: string;            // Link to source PDF
  sourcePage: number;                  // Exact page in PDF
  sourceText: string;                  // Raw unparsed line from PDF
  confidence: number;                  // 1.0 for verified
  validationStatus: "VALID" | "FLAGGED" | "PENDING_REVIEW";
  derivedNumericValue?: number;        // Optional helper only: 276
}
```

---

## 2. Document & Provenance Collections

### `documents`
- `id`: string (UUID)
- `type`: `"LOTTERY_RESULT" | "ACT" | "RULE" | "AMENDMENT" | "MANUAL" | "FORM"`
- `title`: string
- `storagePath`: string (`gs://kerala-lottery-intelligence-documents/source-documents/...`)
- `sha256`: string (lowercase hex)
- `mimeType`: string (`application/pdf`)
- `fileSize`: number
- `sourceOrganization`: string (`"Directorate of Kerala State Lotteries"`)
- `publishedAt`: string (ISO 8601)
- `retrievedAt`: string (ISO 8601)
- `parserVersion`: string (`"v1.0.0-deterministic"`)
- `status`: `"UPLOADED" | "SEGMENTED" | "PARSED" | "APPROVED"`
- `createdAt`: string (ISO 8601)

### `source_evidence`
- `id`: string
- `documentId`: string
- `pageNumber`: number
- `sourceText`: string
- `boundingBox`: `{ x, y, width, height }` (optional)
- `parserVersion`: string
- `confidence`: number

---

## 3. Draws & Prize Hierarchy

### `draws`
- `id`: string (e.g. `draw-dl-69`)
- `lotteryId`: string
- `drawNumber`: string (e.g. `"DL-69"`, `"W-780"`)
- `drawDate`: string (`YYYY-MM-DD`)
- `drawTime`: string
- `location`: string (`"Gorky Bhavan, Near Gandhari Amman Kovil, Thiruvananthapuram"`)
- `sourceDocumentId`: string
- `sourcePage`: number
- `status`: `"VERIFIED" | "APPROVED"`

### `prizeResults`
- `id`: string
- `drawId`: string
- `rank`: number (1 for 1st Prize, 2 for 2nd Prize, etc.)
- `amount`: number (in INR)
- `resultType`: `"PRIMARY" | "CONSOLATION" | "SUFFIX" | "OTHER"`
- `description`: string
- `sourceDocumentId`: string
- `sourcePage`: number
- `sourceText`: string

---

## 4. Dataset Versions

### `datasetVersions`
- `id`: string (`"V001"`, `"V002"`, ...)
- `name`: string
- `description`: string
- `documentCount`: number
- `drawCount`: number
- `recordCount`: number
- `sourceSnapshot`:
  - `documentIds`: string[]
  - `gitCommitSha`: string
  - `datasetChecksum`: string
- `status`: `"LOCKED"`
- `createdAt`: string
