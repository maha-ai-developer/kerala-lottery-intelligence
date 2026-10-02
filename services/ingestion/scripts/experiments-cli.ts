#!/usr/bin/env tsx
/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 9B: Experiment CLI & Continuous Research Runner
 *
 * Commands:
 * - list: List all registered experiments
 * - run <id>: Run a single experiment by ID
 * - run-all: Run all registered experiments
 * - refresh: Execute end-to-end continuous research refresh pipeline
 * - inspect <runId>: Inspect a specific experiment run and its lineage DAG
 *
 * Invariant: Non-predictive scientific research only.
 */

import {
  getRegisteredExperiments,
  getRegisteredExperimentById,
  refreshResearchPipeline,
  runSingleExperiment,
  inspectExperimentRun,
  defaultExperimentRepository
} from "@kerala-lottery/experiments";

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "list";

  console.log("============================================================");
  console.log(" Kerala Lottery Intelligence — Milestone 9B Continuous Research");
  console.log("============================================================");

  switch (command) {
    case "list": {
      const experiments = getRegisteredExperiments();
      console.log(`\nRegistered Experiments (${experiments.length}):\n`);
      for (const exp of experiments) {
        console.log(`• [${exp.experimentId}] v${exp.version}`);
        console.log(`  Name:        ${exp.name}`);
        console.log(`  Model Type:  ${exp.modelType}`);
        console.log(`  Target:      ${exp.targetName} (${exp.targetId})`);
        console.log(`  Policy:      ${exp.temporalPolicy.strategy} (testRatio: ${exp.temporalPolicy.testRatio ?? "default"})`);
        console.log(`  Description: ${exp.description}`);
        console.log(`  Hash:        ${exp.deterministicHash}\n`);
      }
      break;
    }

    case "run": {
      const experimentId = args[1];
      if (!experimentId) {
        console.error("Error: Missing experiment ID. Usage: run <experiment-id>");
        process.exit(1);
      }
      const exp = getRegisteredExperimentById(experimentId);
      if (!exp) {
        console.error(`Error: Unknown experiment ID '${experimentId}'. Use 'list' to see registered experiments.`);
        process.exit(1);
      }
      console.log(`\nExecuting Experiment: ${exp.experimentId} (${exp.name})...`);
      const result = await runSingleExperiment(experimentId, { force: true });
      console.log(`Status:  ${result.status}`);
      console.log(`Corpus:  ${result.corpusVersion}`);
      console.log(`Dataset: ${result.datasetVersion}`);
      if (result.executedRuns.length > 0) {
        const run = result.executedRuns[0]!;
        console.log(`\nRun Details:`);
        console.log(`  Run ID:    ${run.runId}`);
        console.log(`  Status:    ${run.status}`);
        console.log(`  Accuracy:  ${(run.metrics?.accuracy ? run.metrics.accuracy * 100 : 0).toFixed(2)}%`);
        console.log(`  Log Loss:  ${run.metrics?.logLoss?.toFixed(4)}`);
        console.log(`  Samples:   ${run.metrics?.sampleSize}`);
      }
      break;
    }

    case "run-all": {
      console.log("\nExecuting all registered experiments (forced)...");
      const result = await refreshResearchPipeline({ force: true });
      console.log(`Status:        ${result.status}`);
      console.log(`Corpus:        ${result.corpusVersion}`);
      console.log(`Dataset:       ${result.datasetVersion}`);
      console.log(`Executed Runs: ${result.executedRuns.length}`);
      console.log(`Skipped Runs:  ${result.skippedRuns.length}`);
      console.log(`Failed Runs:   ${result.failedRuns.length}\n`);

      for (const run of result.executedRuns) {
        console.log(`• [${run.experimentId}] ${run.runId}: Accuracy: ${(run.metrics?.accuracy ? run.metrics.accuracy * 100 : 0).toFixed(2)}%, LogLoss: ${run.metrics?.logLoss?.toFixed(4)}`);
      }
      break;
    }

    case "refresh": {
      console.log("\nTriggering continuous research refresh pipeline (idempotent)...");
      const result = await refreshResearchPipeline();
      console.log(`Status:        ${result.status}`);
      console.log(`Corpus:        ${result.corpusVersion}`);
      console.log(`Dataset:       ${result.datasetVersion}`);
      console.log(`Executed Runs: ${result.executedRuns.length}`);
      console.log(`Skipped Runs:  ${result.skippedRuns.length}`);
      console.log(`Failed Runs:   ${result.failedRuns.length}`);
      console.log(`Message:       ${result.message}\n`);
      break;
    }

    case "inspect": {
      const runId = args[1];
      if (!runId) {
        console.error("Error: Missing run ID. Usage: inspect <run-id>");
        process.exit(1);
      }
      const { run, artifact, lineage } = inspectExperimentRun(runId, defaultExperimentRepository);
      if (!run) {
        console.error(`Error: Run '${runId}' not found.`);
        process.exit(1);
      }

      console.log(`\nRun Metadata:`);
      console.log(`  Run ID:             ${run.runId}`);
      console.log(`  Experiment ID:      ${run.experimentId} (v${run.experimentVersion})`);
      console.log(`  Status:             ${run.status}`);
      console.log(`  Started:            ${run.startedAt}`);
      console.log(`  Completed:          ${run.completedAt}`);
      console.log(`  Corpus Version:     ${run.corpusVersion}`);
      console.log(`  Dataset Version:    ${run.datasetVersion}`);
      console.log(`  Feature Version:    ${run.featureVersion}`);
      console.log(`  Model Version:      ${run.modelVersion}`);
      console.log(`  Seed:               ${run.reproducibilityMetadata.seed}`);
      console.log(`  Input Fingerprint:  ${run.reproducibilityMetadata.inputFingerprint}`);

      if (run.metrics) {
        console.log(`\nMetrics:`);
        console.log(`  Accuracy:           ${(run.metrics.accuracy * 100).toFixed(2)}%`);
        console.log(`  Balanced Accuracy:  ${(run.metrics.balancedAccuracy * 100).toFixed(2)}%`);
        console.log(`  Log Loss:           ${run.metrics.logLoss.toFixed(4)}`);
        console.log(`  Sample Size:        ${run.metrics.sampleSize}`);
      }

      if (artifact) {
        console.log(`\nArtifact:`);
        console.log(`  Artifact ID:        ${artifact.artifactId}`);
        console.log(`  Sample Rows:        ${artifact.predictionsSample.length}`);
        console.log(`  Hash:               ${artifact.deterministicHash}`);
      }

      if (lineage) {
        console.log(`\nLineage DAG (${lineage.chain.length} stages, complete: ${lineage.isComplete}):`);
        for (const step of lineage.chain) {
          console.log(`  ${step.step.padEnd(22)} -> ${step.identity}`);
        }
      }
      break;
    }

    default: {
      console.log("Usage: experiments-cli [list | run <id> | run-all | refresh | inspect <runId>]");
      break;
    }
  }
}

main().catch((err) => {
  console.error("Execution failed:", err);
  process.exit(1);
});
