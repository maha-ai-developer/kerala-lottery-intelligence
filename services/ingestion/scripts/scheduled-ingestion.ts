#!/usr/bin/env tsx
/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 8B — Scheduled Daily Operations CLI Runner
 *
 * Usage:
 *   npm run ingest:scheduled
 *   npm run ingest:scheduled -- --dry-run
 *   npm run ingest:scheduled -- --trigger MANUAL
 *   npm run ingest:scheduled -- --verbose
 *   npm run ingest:scheduled -- --since 2026-09-20
 *   npm run ingest:scheduled -- --force
 */

import {
  ScheduledIngestionOrchestrator,
  ScheduledRunTrigger,
  DEV_PROJECT_ID
} from "../src/operations";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const verbose = args.includes("--verbose");
  const force = args.includes("--force");
  const offline = args.includes("--offline") || args.includes("--local-only");

  let trigger: ScheduledRunTrigger = "SCHEDULED";
  const triggerIdx = args.indexOf("--trigger");
  if (triggerIdx !== -1 && args[triggerIdx + 1]) {
    const raw = args[triggerIdx + 1]!.toUpperCase();
    if (raw === "MANUAL" || raw === "TEST" || raw === "SCHEDULED") {
      trigger = raw;
    }
  }

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

  console.log("============================================================");
  console.log("KERALA STATE LOTTERY INTELLIGENCE PLATFORM");
  console.log("MILESTONE 8B: SCHEDULED DAILY OPERATIONS ORCHESTRATOR");
  console.log("============================================================");
  console.log(`Trigger:     ${trigger}`);
  console.log(`Mode:        ${dryRun ? "DRY RUN (NON-MUTATING)" : "NORMAL EXECUTION"}`);
  console.log(`Environment: DEV (${DEV_PROJECT_ID})`);
  console.log(`Lock Safety: ${force ? "FORCE BYPASS" : "ACTIVE SINGLE-FLIGHT LOCK"}`);
  console.log("============================================================\n");

  const orchestrator = new ScheduledIngestionOrchestrator();

  try {
    const result = await orchestrator.execute(trigger, {
      projectId: process.env.GCP_PROJECT_ID || DEV_PROJECT_ID,
      environment: "DEV",
      dryRun,
      verbose,
      since,
      limit,
      forceBypassLock: force,
      allowOffline: offline
    });

    console.log(`\nOperational Execution Completed:`);
    console.log(` - Run ID:          ${result.runId}`);
    console.log(` - Status:          ${result.status}`);
    console.log(` - Trigger:         ${result.trigger}`);
    console.log(` - Lock Acquired:   ${result.lockAcquired}`);
    console.log(` - Skipped Locked:  ${result.skippedLocked}`);

    if (result.engineResult) {
      console.log("\n" + result.engineResult.summaryText);
    }

    if (result.status === "FAILED") {
      console.error(`\n[FATAL] Execution failed with category: ${result.failureCategory}`);
      console.error(`Summary: ${result.failureMessage}`);
      process.exit(1);
    }

    if (result.status === "SKIPPED_LOCKED") {
      console.log("\n[NOTICE] Another execution holds the lock. Exiting cleanly (code 0).");
      process.exit(0);
    }

    process.exit(0);
  } catch (err: unknown) {
    console.error("\n[FATAL] Unexpected error in scheduled daily operations orchestrator:", err);
    process.exit(1);
  }
}

main();
