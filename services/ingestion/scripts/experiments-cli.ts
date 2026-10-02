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
  defaultExperimentRepository,
  loadCanonicalResearchCorpus,
  buildResearchModelingDataset,
  validateExperimentRun,
  type StatisticalValidationArtifact
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

    case "validate": {
      const runId = args[1];
      if (!runId) {
        console.error("Error: Missing run ID. Usage: validate <runId>");
        process.exit(1);
      }
      const run = defaultExperimentRepository.getRun(runId);
      if (!run) {
        console.error(`Error: Run '${runId}' not found.`);
        process.exit(1);
      }
      const artifact = defaultExperimentRepository.getArtifactByRunId(run.runId);
      if (!artifact) {
        console.error(`Error: Result artifact for run '${run.runId}' not found.`);
        process.exit(1);
      }

      console.log(`\nLoading canonical corpus and building modeling dataset...`);
      const corpus = loadCanonicalResearchCorpus();
      const { dataset } = buildResearchModelingDataset(corpus);

      console.log(`Validating experiment run: ${run.runId} (${run.experimentId})...`);
      const validation = validateExperimentRun(run, artifact, dataset, {
        familyId: "EXP_FAMILY_CANONICAL_BASELINES",
        totalHypothesesInFamily: 3
      });

      defaultExperimentRepository.saveValidation(validation);
      console.log(`Saved validation artifact: ${validation.validationId}`);
      console.log(`\nStatistical Validation Summary:`);
      console.log(`  Observed Accuracy:       ${(validation.nullModelComparison.observedValue * 100).toFixed(2)}%`);
      console.log(`  Wilson 95% CI:           [${(validation.confidenceIntervals.accuracy.wilsonScoreInterval.lower * 100).toFixed(2)}%, ${(validation.confidenceIntervals.accuracy.wilsonScoreInterval.upper * 100).toFixed(2)}%]`);
      console.log(`  Bootstrap 95% CI:        [${(validation.confidenceIntervals.accuracy.bootstrapInterval.lower * 100).toFixed(2)}%, ${(validation.confidenceIntervals.accuracy.bootstrapInterval.upper * 100).toFixed(2)}%]`);
      console.log(`  Null Model Mean:         ${(validation.nullModelComparison.mean * 100).toFixed(2)}%`);
      console.log(`  Null Z-Score:            ${validation.nullModelComparison.zScore.toFixed(3)}`);
      console.log(`  Empirical P-Value:       ${validation.nullModelComparison.empiricalPValue.toFixed(4)}`);
      console.log(`  Multiple-Testing Adj:    Holm p = ${validation.multipleTestingCorrection.adjustedPValue.toFixed(4)} (Sig: ${validation.multipleTestingCorrection.isSignificant})`);
      console.log(`  Temporal Stability:      ${(validation.temporalRobustness.stabilityScore * 100).toFixed(1)}% across ${validation.temporalRobustness.windowResults.length} windows`);
      console.log(`  Deterministic Hash:      ${validation.deterministicHash}`);
      break;
    }

    case "validate-all": {
      console.log(`\nLoading canonical research corpus...`);
      const corpus = loadCanonicalResearchCorpus();
      const { dataset } = buildResearchModelingDataset(corpus);
      const experiments = getRegisteredExperiments();

      console.log(`Validating all registered experiments against canonical corpus (103 draws)...`);
      const validations: StatisticalValidationArtifact[] = [];

      for (const exp of experiments) {
        const runs = defaultExperimentRepository.listRuns({
          experimentId: exp.experimentId,
          status: "SUCCEEDED"
        });
        if (runs.length === 0) {
          console.warn(`Warning: No completed runs found for ${exp.experimentId}. Run 'run-all' first.`);
          continue;
        }
        const latestRun = runs[0]!;
        const artifact = defaultExperimentRepository.getArtifactByRunId(latestRun.runId);
        if (!artifact) {
          console.warn(`Warning: Artifact for run '${latestRun.runId}' missing.`);
          continue;
        }

        const val = validateExperimentRun(latestRun, artifact, dataset, {
          familyId: "EXP_FAMILY_CANONICAL_BASELINES",
          totalHypothesesInFamily: experiments.length
        });
        defaultExperimentRepository.saveValidation(val);
        validations.push(val);
      }

      console.log(`\nValidation Complete. Results across ${validations.length} baseline experiments:\n`);
      for (const v of validations) {
        console.log(`• [${v.experimentId}] Run: ${v.runId}`);
        console.log(`  Observed Acc:    ${(v.nullModelComparison.observedValue * 100).toFixed(2)}%`);
        console.log(`  Wilson 95% CI:   [${(v.confidenceIntervals.accuracy.wilsonScoreInterval.lower * 100).toFixed(2)}%, ${(v.confidenceIntervals.accuracy.wilsonScoreInterval.upper * 100).toFixed(2)}%]`);
        console.log(`  Null Dist Mean:  ${(v.nullModelComparison.mean * 100).toFixed(2)}%`);
        console.log(`  Empirical P:     ${v.nullModelComparison.empiricalPValue.toFixed(4)} (Z = ${v.nullModelComparison.zScore.toFixed(2)})`);
        console.log(`  Holm Adjusted P: ${v.multipleTestingCorrection.adjustedPValue.toFixed(4)} (Significant: ${v.multipleTestingCorrection.isSignificant})`);
        console.log(`  Walk-Forward:    ${v.temporalRobustness.windowResults.length} folds, Stability: ${(v.temporalRobustness.stabilityScore * 100).toFixed(1)}%`);
        console.log(`  Interpretation:  ${v.interpretationContract.interpretation.slice(0, 100)}...`);
        console.log(`  Artifact:        ${v.validationId} (${v.deterministicHash.slice(0, 16)}...)\n`);
      }
      break;
    }

    case "inspect-validation": {
      const idOrRunId = args[1];
      if (!idOrRunId) {
        console.error("Error: Missing validation or run ID. Usage: inspect-validation <validationId | runId>");
        process.exit(1);
      }
      let validation = defaultExperimentRepository.getValidation(idOrRunId);
      if (!validation) {
        validation = defaultExperimentRepository.getValidationByRunId(idOrRunId);
      }
      if (!validation) {
        console.error(`Error: Validation not found for ID '${idOrRunId}'.`);
        process.exit(1);
      }

      console.log(`\n============================================================`);
      console.log(` Validation Artifact: ${validation.validationId}`);
      console.log(`============================================================`);
      console.log(`Experiment:           ${validation.experimentId} (v${validation.experimentVersion})`);
      console.log(`Run ID:               ${validation.runId}`);
      console.log(`Corpus Version:       ${validation.corpusVersion}`);
      console.log(`Dataset Version:      ${validation.datasetVersion}`);
      console.log(`Method:               ${validation.validationMethod} (v${validation.validationVersion})`);
      console.log(`Deterministic Hash:   ${validation.deterministicHash}`);
      console.log(`Created At:           ${validation.createdAt}`);

      console.log(`\n1. Statistical Inference:`);
      console.log(`  Observed Accuracy:  ${(validation.nullModelComparison.observedValue * 100).toFixed(2)}%`);
      console.log(`  Standard Error:     ${validation.uncertainty.standardError.toFixed(4)}`);
      console.log(`  Margin of Error:    ${validation.uncertainty.marginOfError.toFixed(4)}`);
      console.log(`  Wilson 95% CI:      [${(validation.confidenceIntervals.accuracy.wilsonScoreInterval.lower * 100).toFixed(2)}%, ${(validation.confidenceIntervals.accuracy.wilsonScoreInterval.upper * 100).toFixed(2)}%]`);
      console.log(`  Bootstrap 95% CI:   [${(validation.confidenceIntervals.accuracy.bootstrapInterval.lower * 100).toFixed(2)}%, ${(validation.confidenceIntervals.accuracy.bootstrapInterval.upper * 100).toFixed(2)}%]`);
      console.log(`  Cohen's h vs Chance:${validation.effectSizes.cohensH.toFixed(4)}`);

      console.log(`\n2. Null Model Comparison:`);
      console.log(`  Null Model:         ${validation.nullModelComparison.nullModelType}`);
      console.log(`  Iterations:         ${validation.nullModelComparison.iterations}`);
      console.log(`  Null Mean / Std:    ${(validation.nullModelComparison.mean * 100).toFixed(2)}% ± ${(validation.nullModelComparison.stdDev * 100).toFixed(2)}%`);
      console.log(`  Z-Score:            ${validation.nullModelComparison.zScore.toFixed(3)}`);
      console.log(`  Empirical P-Value:  ${validation.nullModelComparison.empiricalPValue.toFixed(4)}`);

      console.log(`\n3. Multiple Testing Adjustment:`);
      console.log(`  Family ID:          ${validation.multipleTestingCorrection.familyId}`);
      console.log(`  Designation:        ${validation.multipleTestingCorrection.designation}`);
      console.log(`  Method:             ${validation.multipleTestingCorrection.method}`);
      console.log(`  Raw Alpha / Corr:   ${validation.multipleTestingCorrection.baseAlpha.toFixed(4)} -> ${validation.multipleTestingCorrection.adjustedAlpha.toFixed(4)}`);
      console.log(`  Raw P / Adj P:      ${validation.multipleTestingCorrection.rawPValue.toFixed(4)} -> ${validation.multipleTestingCorrection.adjustedPValue.toFixed(4)}`);
      console.log(`  Significant:        ${validation.multipleTestingCorrection.isSignificant}`);

      console.log(`\n4. Temporal Robustness:`);
      console.log(`  Windows Evaluated:  ${validation.temporalRobustness.windowResults.length}`);
      console.log(`  Leakage Free:       ${validation.temporalRobustness.zeroLeakageConfirmed}`);
      console.log(`  Stability Score:    ${(validation.temporalRobustness.stabilityScore * 100).toFixed(1)}%`);
      for (const w of validation.temporalRobustness.windowResults) {
        console.log(`    Fold ${w.windowIndex}: Train ${w.trainDrawCount} draws (${w.trainDateRange.earliestIso}..${w.trainDateRange.latestIso}), Test ${w.testDrawCount} draws -> Acc ${(w.accuracy * 100).toFixed(2)}%`);
      }

      console.log(`\n5. Research Interpretation Contract:`);
      console.log(`  [OBSERVATION]       ${validation.interpretationContract.observation}`);
      console.log(`  [STAT EVIDENCE]     ${JSON.stringify(validation.interpretationContract.statisticalEvidence)}`);
      console.log(`  [UNCERTAINTY]       ${JSON.stringify(validation.interpretationContract.uncertainty)}`);
      console.log(`  [INTERPRETATION]    ${validation.interpretationContract.interpretation}`);
      console.log(`  [LIMITATION]        ${validation.interpretationContract.limitation}`);
      break;
    }

    default: {
      console.log("Usage: experiments-cli [list | run <id> | run-all | refresh | inspect <runId> | validate <runId> | validate-all | inspect-validation <id>]");
      break;
    }
  }
}

main().catch((err) => {
  console.error("Execution failed:", err);
  process.exit(1);
});
