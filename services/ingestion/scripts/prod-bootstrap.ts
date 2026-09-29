#!/usr/bin/env tsx
/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 8C — Production Controlled Bootstrap CLI Runner
 *
 * Promotes authoritative historical corpus (100 draws, 38,416 validated results)
 * into production Cloud Storage and Firestore with strict fail-closed safety assertions.
 *
 * Usage:
 *   npx tsx services/ingestion/scripts/prod-bootstrap.ts [--dry-run] [--verbose]
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { executeProdBootstrap } from "../src/operations/prod-bootstrap";
import { PROD_PROJECT_ID, PROD_STORAGE_BUCKET } from "../src/operations/environment-guard";

const SCIENTIFIC_BENCHMARKING_NOTICE =
  "SCIENTIFIC BENCHMARKING NOTICE: This daily lottery ingestion framework discovers, acquires, ingests, and promotes historical Kerala lottery records for descriptive research only. It contains NO winning-number predictions, betting advice, gambling strategy, or future probability claims. Historical model evaluation measures observed patterns in historical data only.";

function getGcpAccessToken(): string | undefined {
  if (process.env.GOOGLE_OAUTH_ACCESS_TOKEN) {
    return process.env.GOOGLE_OAUTH_ACCESS_TOKEN;
  }
  try {
    const configPath = join(process.env.HOME || "", ".config/configstore/firebase-tools.json");
    if (existsSync(configPath)) {
      const config = JSON.parse(readFileSync(configPath, "utf8"));
      return config.tokens?.access_token;
    }
  } catch {
    // Ignore
  }
  return undefined;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const verbose = args.includes("--verbose");

  console.log("============================================================");
  console.log("KERALA STATE LOTTERY INTELLIGENCE PLATFORM");
  console.log("MILESTONE 8C: PRODUCTION CONTROLLED BOOTSTRAP");
  console.log("============================================================");
  console.log("Notice:       " + SCIENTIFIC_BENCHMARKING_NOTICE);
  console.log("Target PROD:  " + PROD_PROJECT_ID);
  console.log("Storage:      gs://" + PROD_STORAGE_BUCKET);
  console.log("Mode:         " + (dryRun ? "DRY-RUN (PREVIEW)" : "LIVE MUTATION"));
  console.log("============================================================\n");

  const accessToken = getGcpAccessToken();

  try {
    const result = await executeProdBootstrap({
      projectId: PROD_PROJECT_ID,
      environment: "PROD",
      dryRun,
      verbose,
      getAccessToken: accessToken ? () => accessToken : undefined
    });

    console.log("============================================================");
    console.log("PROD BOOTSTRAP EXECUTION COMPLETED");
    console.log("============================================================");
    console.log(`Run ID:                ${result.runId}`);
    console.log(`Status:                ${result.auditRecord.status}`);
    console.log(`Total Candidates:      ${result.totalCandidates}`);
    console.log(`Uploaded to Storage:   ${result.uploadedStorageCount}`);
    console.log(`Already in Storage:    ${result.alreadyInStorageCount}`);
    console.log(`Created in Firestore:  ${result.createdFirestoreCount}`);
    console.log(`Already in Firestore:  ${result.alreadyInFirestoreCount}`);
    console.log(`Validated Draws:       ${result.validatedDrawsCount}`);
    console.log(`Total Winning Results: ${result.totalWinningResults}`);
    console.log(`Corpus ID:             ${result.corpusId}`);
    console.log(`Dataset ID:            ${result.datasetId}`);
    console.log(`Target Draw BT-73:     ${result.targetDrawVerified.lottery} ${result.targetDrawVerified.drawNumber} (${result.targetDrawVerified.drawDate})`);
    console.log(`Target BT-73 SHA:      ${result.targetDrawVerified.sha256}`);
    console.log("============================================================\n");
  } catch (err: unknown) {
    console.error("FATAL ERROR in PROD Bootstrap:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
