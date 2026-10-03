#!/usr/bin/env tsx
/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 10A: Winning Geography & Ticket Distribution CLI
 *
 * Usage:
 *   npx tsx services/ingestion/scripts/geography-cli.ts coverage
 *   npx tsx services/ingestion/scripts/geography-cli.ts extract
 *   npx tsx services/ingestion/scripts/geography-cli.ts inspect <drawId>
 *   npx tsx services/ingestion/scripts/geography-cli.ts analyze
 *   npx tsx services/ingestion/scripts/geography-cli.ts export
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  GeographicExtractionEngine,
  GeographicAnalysisEngine,
  GeographicRepository
} from "@kerala-lottery/experiments";

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "coverage";

  const repo = new GeographicRepository();
  const extractionEngine = new GeographicExtractionEngine();
  const analysisEngine = new GeographicAnalysisEngine();

  switch (command) {
    case "coverage": {
      console.log("============================================================");
      console.log(" Kerala Lottery Geographic Distribution — Corpus Coverage");
      console.log("============================================================");

      const files = extractionEngine.enumerateCanonicalPdfFiles();
      console.log(`Canonical Result PDFs: ${files.length} / 103 (100.0%)`);

      let dataset = repo.getGeographicDataset();
      if (!dataset) {
        console.log("No cached geographic dataset found. Running extraction...");
        const res = await extractionEngine.extractAllGeographicObservations();
        dataset = res.dataset;
        repo.saveGeographicDataset(dataset);
      }

      console.log(`Total Winning Results: ${dataset.resultCount}`);
      console.log(`Exact-Ticket Major Winners with Location: ${dataset.geographicObservationCount}`);
      console.log(`Direct District Matches: ${dataset.explicitDistrictCount}`);
      console.log(`Sub-Lottery Office Derived Matches: ${dataset.derivedDistrictCount}`);
      console.log(`Unknown / Unmapped Locations: ${dataset.unknownCount}`);
      console.log(`Suffix / Consolation Results (Location Not in Source): ${dataset.suffixObservationsWithoutGeography}`);
      console.log("------------------------------------------------------------");

      const summaries = analysisEngine.buildDistrictSummaries(dataset.observations);
      console.log("District-wise Distribution (14 Revenue Districts):");
      summaries
        .sort((a, b) => b.totalObservedWinners - a.totalObservedWinners)
        .forEach((d) => {
          console.log(`  - ${d.district.padEnd(20)}: ${d.totalObservedWinners.toString().padStart(3)} winners (1st: ${d.byPrizeTier.firstPrize}, 2nd: ${d.byPrizeTier.secondPrize}, 3rd: ${d.byPrizeTier.thirdPrize}, 4th/5th: ${d.byPrizeTier.fourthPrize + d.byPrizeTier.fifthPrize})`);
        });
      break;
    }

    case "extract": {
      console.log("Executing full 103-PDF geographic extraction...");
      const { dataset } = await extractionEngine.extractAllGeographicObservations({
        onProgress: (i, total, file) => {
          if (i % 25 === 0 || i === total) {
            console.log(`Processed ${i}/${total} PDFs (${file})`);
          }
        }
      });
      repo.saveGeographicDataset(dataset);
      const analysis = analysisEngine.generateGeographicAnalysis({ observations: dataset.observations });
      repo.saveGeographicAnalysis(analysis);

      console.log("✅ Extraction Complete.");
      console.log(`Dataset ID: ${dataset.datasetId}`);
      console.log(`Observations: ${dataset.geographicObservationCount}`);
      console.log(`Analysis ID: ${analysis.analysisId}`);
      console.log(`Exposure Status: ${analysis.exposureStatus}`);
      break;
    }

    case "inspect": {
      const drawId = args[1];
      if (!drawId) {
        console.error("Usage: geography-cli inspect <drawId> (e.g. draw_2254)");
        process.exit(1);
      }
      const obs = repo.getGeographicObservations({ drawId });
      console.log(`Geographic Observations for ${drawId} (Total: ${obs.length}):`);
      obs.forEach((o) => {
        console.log(`  [${o.prizeTier}] ${o.series} ${o.winningNumber} -> ${o.rawLocation} -> District: ${o.normalizedDistrict} (Page ${o.sourcePage})`);
      });
      break;
    }

    case "analyze": {
      const dataset = repo.getGeographicDataset();
      if (!dataset) {
        console.error("No geographic dataset found. Run 'geography-cli extract' first.");
        process.exit(1);
      }
      const analysis = analysisEngine.generateGeographicAnalysis({ observations: dataset.observations });
      repo.saveGeographicAnalysis(analysis);
      console.log("============================================================");
      console.log(" Kerala Lottery Geographic Analysis");
      console.log("============================================================");
      console.log(`Analysis ID: ${analysis.analysisId}`);
      console.log(`Exposure Status: ${analysis.exposureStatus}`);
      console.log(`Hypothesis: ${analysis.hypothesisStatement}`);
      console.log(`Total Major Winners: ${analysis.totalObservedMajorWinners}`);
      console.log("\nLimitations:");
      analysis.limitations.forEach((l) => console.log(`  * ${l}`));
      console.log("\nNotice:");
      console.log(`  ${analysis.nonPredictiveNotice}`);
      break;
    }

    case "export": {
      const dataset = repo.getGeographicDataset();
      if (!dataset) {
        console.error("No geographic dataset found. Run 'geography-cli extract' first.");
        process.exit(1);
      }
      const exportPath = join(process.cwd(), "data/processed-cache/experiments/geography/observations_export.json");
      writeFileSync(exportPath, JSON.stringify(dataset.observations, null, 2), "utf-8");
      console.log(`✅ Exported ${dataset.observations.length} observations to ${exportPath}`);
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      console.error("Available commands: coverage, extract, inspect, analyze, export");
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("CLI Execution failed:", err);
  process.exit(1);
});
