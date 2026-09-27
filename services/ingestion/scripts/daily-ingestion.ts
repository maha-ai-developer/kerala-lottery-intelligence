#!/usr/bin/env tsx
/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 7A.5 — Production-Safe Daily Ingestion Runner
 *
 * Preferred execution:
 *   npm run ingest:daily
 *
 * Runs the incremental ingestion engine:
 * 1. Discovers candidate PDFs in data/source-documents/lottery-results
 * 2. Checks SHA-256 against cache and manifest
 * 3. Ingests and parses only new valid documents
 * 4. Runs cross-document validation
 * 5. Builds expanded multi-draw corpus
 * 6. Refreshes derived downstream layers (5A-7A)
 * 7. Prints standardized machine-readable summary
 * 8. Exits with 0 on success or 1 on integrity error
 */

import { DailyIngestionEngine } from "../src/daily-ingestion-engine";

async function main() {
  const engine = new DailyIngestionEngine();
  try {
    const result = await engine.execute();
    console.log(result.summaryText);

    if (!result.success) {
      console.error("\n[ERROR] Daily Ingestion failed integrity or cross-document validation!");
      if (result.validationReport.errors.length > 0) {
        console.error("Errors detected:");
        for (const err of result.validationReport.errors) {
          console.error(` - [${err.type}] ${err.message}`);
        }
      }
      process.exit(1);
    }

    process.exit(0);
  } catch (err: unknown) {
    console.error("FATAL: Unhandled error in daily ingestion workflow:", err);
    process.exit(1);
  }
}

main();
