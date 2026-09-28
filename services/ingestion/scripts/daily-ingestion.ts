#!/usr/bin/env tsx
/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 8A — Production-Safe Automated Daily Ingestion CLI Runner
 *
 * Preferred execution:
 *   npm run ingest:daily
 *   npm run ingest:daily -- --dry-run
 *   npm run ingest:daily -- --limit 5
 *   npm run ingest:daily -- --since 2026-09-01
 *   npm run ingest:daily -- --verbose
 *
 * Runs the daily real-world ingestion engine:
 * 1. Discovers candidate official result documents (official portal & local corpus)
 * 2. Checks SHA-256 against cache, manifest, and storage
 * 3. Enforces idempotency (identifies already-known documents without duplication)
 * 4. Detects conflicts (flags new SHA with already-existing draw identity)
 * 5. Resolves and validates against authoritative versioned prize schemes
 * 6. Ingests and parses only genuinely new valid documents
 * 7. Runs cross-document validation
 * 8. Builds expanded multi-draw corpus and refreshes downstream canonical layers
 * 9. Supports safe dry-run mode (--dry-run) without persistent mutations
 * 10. Prints standardized machine-readable summary and exits with appropriate code
 */

import { DailyIngestionEngine } from "../src/daily-ingestion-engine";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const verbose = args.includes("--verbose");
  const offline = args.includes("--offline") || args.includes("--local-only");

  let limit: number | undefined;
  const limitIdx = args.indexOf("--limit");
  if (limitIdx !== -1 && args[limitIdx + 1]) {
    limit = parseInt(args[limitIdx + 1]!, 10);
  }

  let since: string | undefined;
  const sinceIdx = args.indexOf("--since");
  if (sinceIdx !== -1 && args[sinceIdx + 1]) {
    since = args[sinceIdx + 1];
  }

  const engine = new DailyIngestionEngine({
    dryRun,
    verbose,
    limit,
    since,
    enableRemoteDiscovery: !offline
  });

  try {
    const result = await engine.execute();
    console.log(result.summaryText);

    if (!result.success) {
      console.error("\n[ERROR] Daily Ingestion failed integrity or cross-document validation!");
      if (result.validationReport && result.validationReport.errors.length > 0) {
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
