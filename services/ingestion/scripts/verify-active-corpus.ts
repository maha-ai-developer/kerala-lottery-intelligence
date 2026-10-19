#!/usr/bin/env tsx
/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Active Research Corpus & Artifact Parity Verifier
 *
 * Verifies:
 *   AC-01: Active Manifest & Preserved V1.0 Baseline Separation
 *   AC-02: Hydrated Knowledge Graphs & Exact Result Count Parity
 *   AC-03: Compact Winning-Results Index & Web Mirror Parity
 *   AC-04: Active Corpus Research Artifacts (Runs, Validations, Findings, Evidence, Reports)
 *   AC-05: Research Service, Sandbox, & Candidate Lab Active Corpus Resolution
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  ResearchSandboxEngine,
  CandidateLabEngine,
  defaultExperimentRepository,
  getRegisteredExperiments,
  loadCanonicalResearchCorpus
} from "@kerala-lottery/experiments";
import { researchService } from "@kerala-lottery/data";

interface GateResult {
  gate: string;
  name: string;
  status: "PASS" | "FAIL";
  details: string[];
}

const results: GateResult[] = [];

function recordGate(gate: string, name: string, status: "PASS" | "FAIL", details: string[]) {
  results.push({ gate, name, status, details });
  const icon = status === "PASS" ? "✅" : "❌";
  console.log(`${icon} [${gate}] ${name}: ${status}`);
  for (const d of details) {
    console.log(`    • ${d}`);
  }
}

async function verifyActiveCorpus() {
  console.log("================================================================================");
  console.log("  Kerala Lottery Intelligence — Active Research Corpus Verifier                 ");
  console.log("================================================================================\n");

  const cwd = process.cwd();
  const manifestPath = join(cwd, "data/processed-cache/manifest.json");
  const webManifestPath = join(cwd, "apps/web/data/processed-cache/manifest.json");
  const indexPath = join(cwd, "data/processed-cache/winning-results-index.json");
  const webIndexPath = join(cwd, "apps/web/data/processed-cache/winning-results-index.json");

  let expectedDraws = 0;
  let expectedResults = 0;
  let expectedFull = 0;
  let expectedSuffix = 0;
  let activeCorpusLabel = "";

  // --------------------------------------------------------------------------
  // Gate AC-01: Active Manifest & Preserved V1.0 Baseline Separation
  // --------------------------------------------------------------------------
  try {
    const details: string[] = [];
    if (!existsSync(manifestPath)) throw new Error("data/processed-cache/manifest.json not found");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    const docs = Object.values<any>(manifest.documents || {}).filter((d) => d.status === "VALID");

    expectedDraws = docs.length;
    if (expectedDraws < 119) {
      throw new Error(`Expected at least 119 valid draws in active corpus, found ${expectedDraws}`);
    }

    expectedResults = docs.reduce((s, d) => s + (d.totalResults || 0), 0);
    expectedFull = docs.reduce((s, d) => s + (d.fullTicketCount || 0), 0);
    expectedSuffix = docs.reduce((s, d) => s + (d.suffixCount || 0), 0);
    activeCorpusLabel = `active-research-${expectedDraws}draws`;

    if (
      !manifest.v1Baseline ||
      manifest.v1Baseline.version !== "v1.0-research-114draws" ||
      manifest.v1Baseline.draws !== 114 ||
      manifest.v1Baseline.totalResults !== 43712
    ) {
      throw new Error(`Preserved V1.0 baseline metadata invalid: ${JSON.stringify(manifest.v1Baseline)}`);
    }
    details.push(`Preserved V1.0 baseline metadata verified: v1.0-research-114draws (114 draws / 43,712 results).`);

    const acFull = manifest.activeCorpus?.fullTicketResults ?? manifest.activeCorpus?.fullTicketCount;
    const acSuffix = manifest.activeCorpus?.suffixResults ?? manifest.activeCorpus?.suffixCount;
    if (
      !manifest.activeCorpus ||
      manifest.activeCorpus.version !== activeCorpusLabel ||
      manifest.activeCorpus.draws !== expectedDraws ||
      manifest.activeCorpus.totalResults !== expectedResults ||
      acFull !== expectedFull ||
      acSuffix !== expectedSuffix
    ) {
      throw new Error(`Active corpus metadata mismatch: ${JSON.stringify(manifest.activeCorpus)}`);
    }
    details.push(
      `Active corpus metadata verified: ${activeCorpusLabel} (${expectedDraws} draws / ${expectedResults.toLocaleString()} results: ${expectedFull.toLocaleString()} full + ${expectedSuffix.toLocaleString()} suffix, latest ${manifest.activeCorpus.latestDrawNumber} on ${manifest.activeCorpus.latestDrawDate}).`
    );

    recordGate("Gate AC-01", "Active Manifest & V1.0 Baseline Separation", "PASS", details);
  } catch (err: any) {
    recordGate("Gate AC-01", "Active Manifest & V1.0 Baseline Separation", "FAIL", [err.message]);
  }

  // --------------------------------------------------------------------------
  // Gate AC-02: Hydrated Knowledge Graphs & Exact Result Count Parity
  // --------------------------------------------------------------------------
  try {
    const details: string[] = [];
    const graphsDir = join(cwd, "data/processed-cache/graphs");
    const graphFiles = readdirSync(graphsDir).filter((f) => f.endsWith(".json"));
    if (graphFiles.length !== expectedDraws) {
      throw new Error(`Expected ${expectedDraws} hydrated graph files, found ${graphFiles.length}`);
    }

    let graphResults = 0;
    let graphFull = 0;
    let graphSuffix = 0;
    for (const file of graphFiles) {
      const g = JSON.parse(readFileSync(join(graphsDir, file), "utf-8"));
      for (const n of g.nodes || []) {
        if (n.type === "WinningResult") {
          graphResults++;
          if (n.properties?.isSuffix) graphSuffix++;
          else graphFull++;
        }
      }
    }

    if (graphResults !== expectedResults || graphFull !== expectedFull || graphSuffix !== expectedSuffix) {
      throw new Error(
        `Hydrated graph counts (${graphResults} = ${graphFull} full + ${graphSuffix} suffix) do not match manifest (${expectedResults} = ${expectedFull} full + ${expectedSuffix} suffix)`
      );
    }
    details.push(`Verified ${graphFiles.length} hydrated knowledge graphs with ${graphResults.toLocaleString()} WinningResult nodes (${graphFull.toLocaleString()} full + ${graphSuffix.toLocaleString()} suffix).`);
    recordGate("Gate AC-02", "Hydrated Knowledge Graphs & Count Parity", "PASS", details);
  } catch (err: any) {
    recordGate("Gate AC-02", "Hydrated Knowledge Graphs & Count Parity", "FAIL", [err.message]);
  }

  // --------------------------------------------------------------------------
  // Gate AC-03: Compact Winning-Results Index & Web Mirror Parity
  // --------------------------------------------------------------------------
  try {
    const details: string[] = [];
    if (!existsSync(indexPath)) throw new Error("winning-results-index.json missing");
    if (!existsSync(webManifestPath)) throw new Error("apps/web/data/processed-cache/manifest.json missing");
    if (!existsSync(webIndexPath)) throw new Error("apps/web/data/processed-cache/winning-results-index.json missing");

    const tuples = JSON.parse(readFileSync(indexPath, "utf-8")) as any[];
    if (tuples.length !== expectedResults) {
      throw new Error(`winning-results-index.json has ${tuples.length} tuples, expected ${expectedResults}`);
    }

    const rootManifestRaw = readFileSync(manifestPath, "utf-8");
    const webManifestRaw = readFileSync(webManifestPath, "utf-8");
    if (rootManifestRaw !== webManifestRaw) {
      throw new Error("apps/web/data/processed-cache/manifest.json is out of sync with data/processed-cache/manifest.json");
    }

    const rootIndexRaw = readFileSync(indexPath, "utf-8");
    const webIndexRaw = readFileSync(webIndexPath, "utf-8");
    if (rootIndexRaw !== webIndexRaw) {
      throw new Error("apps/web/data/processed-cache/winning-results-index.json is out of sync with data/processed-cache/winning-results-index.json");
    }

    details.push(`winning-results-index.json verified (${tuples.length.toLocaleString()} tuples).`);
    details.push(`apps/web/data/processed-cache mirror verified byte-identical to root processed-cache.`);
    recordGate("Gate AC-03", "Compact Index & Web Mirror Parity", "PASS", details);
  } catch (err: any) {
    recordGate("Gate AC-03", "Compact Index & Web Mirror Parity", "FAIL", [err.message]);
  }

  // --------------------------------------------------------------------------
  // Gate AC-04: Active Corpus Research Artifacts
  // --------------------------------------------------------------------------
  try {
    const details: string[] = [];
    const corpus = loadCanonicalResearchCorpus();
    if (corpus.draws.length !== expectedDraws || corpus.combinedEntities.winningResults.length !== expectedResults) {
      throw new Error(`Canonical research corpus mismatch: ${corpus.draws.length} draws / ${corpus.combinedEntities.winningResults.length} results`);
    }

    const statusPath = join(cwd, "data/processed-cache/experiments/active-corpus-status.json");
    const webStatusPath = join(cwd, "apps/web/data/processed-cache/experiments/active-corpus-status.json");
    if (!existsSync(statusPath) || !existsSync(webStatusPath)) {
      throw new Error("active-corpus-status.json missing from experiments cache or web mirror");
    }
    const statusJson = JSON.parse(readFileSync(statusPath, "utf-8"));
    if (
      statusJson.activeCorpusVersion !== corpus.id ||
      statusJson.totalDraws !== expectedDraws ||
      statusJson.totalResults !== expectedResults
    ) {
      throw new Error(`active-corpus-status.json out of sync with canonical corpus ${corpus.id}: ${JSON.stringify(statusJson)}`);
    }

    const exps = getRegisteredExperiments();
    for (const exp of exps) {
      const runs = defaultExperimentRepository.listRuns({
        experimentId: exp.experimentId,
        corpusVersion: corpus.id,
        status: "SUCCEEDED"
      });
      if (runs.length === 0) {
        throw new Error(`Missing SUCCEEDED run for ${exp.experimentId} on active corpus ${corpus.id}`);
      }
      const run = runs[0]!;
      const val = defaultExperimentRepository.getValidationByRunId(run.runId);
      if (!val) {
        throw new Error(`Missing validation artifact for run ${run.runId} (${exp.experimentId})`);
      }
      const findings = defaultExperimentRepository
        .listFindings({ experimentId: exp.experimentId })
        .filter((f) => f.corpusVersion === corpus.id && f.runId === run.runId);
      if (findings.length === 0) {
        throw new Error(`Missing research finding for run ${run.runId} (${exp.experimentId}) on corpus ${corpus.id}`);
      }
      const bundle = defaultExperimentRepository.getEvidenceBundleByFindingId(findings[0]!.findingId);
      if (!bundle || bundle.drawCount !== expectedDraws || !bundle.isIntegrityVerified) {
        throw new Error(`Invalid or missing evidence bundle for finding ${findings[0]!.findingId}`);
      }
    }

    details.push(`Active canonical corpus ID: ${corpus.id} (${activeCorpusLabel}).`);
    details.push(`All ${exps.length} registered experiments have verified runs, validations, findings, and evidence bundles for ${corpus.id}.`);
    recordGate("Gate AC-04", "Active Corpus Research Artifacts", "PASS", details);
  } catch (err: any) {
    recordGate("Gate AC-04", "Active Corpus Research Artifacts", "FAIL", [err.message]);
  }

  // --------------------------------------------------------------------------
  // Gate AC-05: Research Service, Sandbox, & Candidate Lab Resolution
  // --------------------------------------------------------------------------
  try {
    const details: string[] = [];
    const stats = await researchService.getStatistics();
    if (stats.population.totalDraws !== expectedDraws || stats.population.totalResults !== expectedResults) {
      throw new Error(
        `researchService.getStatistics returned ${stats.population.totalDraws} draws / ${stats.population.totalResults} results, expected ${expectedDraws} / ${expectedResults}`
      );
    }

    const sandboxEngine = new ResearchSandboxEngine({ baseDir: cwd });
    const ticketRes = sandboxEngine.analyzeTicket({
      lotteryCode: "BT",
      series: "BB",
      ticketNumber: "814615"
    });
    if (
      ticketRes.historicalComparison?.sampleSizeDraws !== expectedDraws ||
      ticketRes.historicalComparison?.sampleSizeResults !== expectedResults
    ) {
      throw new Error(
        `ResearchSandboxEngine sample size (${ticketRes.historicalComparison?.sampleSizeDraws} draws / ${ticketRes.historicalComparison?.sampleSizeResults} results) does not match active corpus`
      );
    }

    const labEngine = new CandidateLabEngine({ sandboxEngine });
    const labRes = labEngine.analyzeCandidateSet({
      candidates: [
        { id: "A", lotteryCode: "BT", series: "BB", ticketNumber: "814615" },
        { id: "B", lotteryCode: "KN", series: "BC", ticketNumber: "271904" }
      ]
    });
    if (!labRes.provenance.corpusVersion.includes(`${expectedDraws}`)) {
      throw new Error(`CandidateLabEngine corpusVersion '${labRes.provenance.corpusVersion}' does not reflect ${expectedDraws} draws`);
    }

    details.push(`researchService, ResearchSandboxEngine, and CandidateLabEngine all resolve to ${expectedDraws} draws / ${expectedResults.toLocaleString()} results.`);
    recordGate("Gate AC-05", "Service, Sandbox, & Candidate Lab Resolution", "PASS", details);
  } catch (err: any) {
    recordGate("Gate AC-05", "Service, Sandbox, & Candidate Lab Resolution", "FAIL", [err.message]);
  }

  // --------------------------------------------------------------------------
  // Gate AC-06: Source PDF Cryptographic Parity & PROD Storage/Firestore Alignment
  // --------------------------------------------------------------------------
  try {
    const details: string[] = [];
    const { computeSha256 } = await import("@kerala-lottery/documents");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    const docs = Object.entries<any>(manifest.documents || {}).filter(([, d]) => d.status === "VALID");

    for (const [sha, doc] of docs) {
      const pdfPath = join(cwd, "data/source-documents/lottery-results", doc.fileName);
      if (!existsSync(pdfPath)) {
        throw new Error(`Missing local source PDF: ${pdfPath}`);
      }
      const computed = computeSha256(new Uint8Array(readFileSync(pdfPath)));
      if (computed !== sha) {
        throw new Error(`SHA-256 mismatch for ${doc.fileName}: expected ${sha}, computed ${computed}`);
      }
    }
    details.push(`All ${docs.length} source PDFs verified byte-identical to manifest SHA-256 identities.`);

    const prodPostPath = join(cwd, "docs/evidence/prod-post-migration-inventory.json");
    if (!existsSync(prodPostPath)) {
      throw new Error("docs/evidence/prod-post-migration-inventory.json missing");
    }
    const prodInv = JSON.parse(readFileSync(prodPostPath, "utf-8"));
    const storageShas = new Set<string>((prodInv.storageObjects || []).map((o: any) => o.sha256));
    const firestoreShas = new Set<string>((prodInv.firestoreDocuments || []).map((d: any) => d.id));

    if (storageShas.size !== expectedDraws || firestoreShas.size !== expectedDraws) {
      throw new Error(
        `PROD inventory count mismatch: Storage=${storageShas.size}, Firestore=${firestoreShas.size}, expected=${expectedDraws}`
      );
    }
    for (const [sha, doc] of docs) {
      if (!storageShas.has(sha)) {
        throw new Error(`Active corpus draw ${doc.drawNumber} (${sha}) missing from PROD Storage inventory`);
      }
      if (!firestoreShas.has(sha)) {
        throw new Error(`Active corpus draw ${doc.drawNumber} (${sha}) missing from PROD Firestore inventory`);
      }
    }
    details.push(
      `PROD Cloud Storage (${storageShas.size} objects) and Firestore (${firestoreShas.size} documents) verified in 100% parity with active corpus (${expectedDraws} draws).`
    );
    recordGate("Gate AC-06", "Source PDF Cryptographic & PROD Cloud Inventory Parity", "PASS", details);
  } catch (err: any) {
    recordGate("Gate AC-06", "Source PDF Cryptographic & PROD Cloud Inventory Parity", "FAIL", [err.message]);
  }

  console.log("\n================================================================================");
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  console.log(`Active Corpus Verification: ${passed}/${results.length} gates passed.`);
  console.log("================================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

verifyActiveCorpus();
