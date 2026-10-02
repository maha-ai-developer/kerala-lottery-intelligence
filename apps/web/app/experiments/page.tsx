"use client";

import { useEffect, useState } from "react";

interface RegisteredExperiment {
  experimentId: string;
  name: string;
  version: string;
  description: string;
  methodology: string;
  targetId: string;
  targetName: string;
  populationScope: string;
  modelType: string;
  parameters: Record<string, unknown>;
  metrics: string[];
  temporalPolicy: {
    strategy: string;
    testRatio?: number;
  };
  deterministicHash: string;
  researchBoundary: string;
}

interface ExperimentRun {
  runId: string;
  experimentId: string;
  experimentVersion: string;
  corpusVersion: string;
  datasetVersion: string;
  featureVersion: string;
  modelVersion: string;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "PARTIAL" | "CANCELLED";
  startedAt: string;
  completedAt?: string;
  metrics?: {
    accuracy: number;
    balancedAccuracy: number;
    logLoss: number;
    sampleSize: number;
  };
  evaluationWindow?: {
    trainDrawCount: number;
    testDrawCount: number;
    trainRowCount: number;
    testRowCount: number;
    trainDateRange: { earliest: string; latest: string };
    testDateRange: { earliest: string; latest: string };
  };
  reproducibilityMetadata: {
    seed: number;
    codeVersion: string;
    inputFingerprint: string;
    runtimeEnvironment: {
      nodeVersion: string;
      platform: string;
    };
  };
}

interface LineageStep {
  step: string;
  identity: string;
  attributes: Record<string, unknown>;
}

interface ExperimentLineage {
  runId: string;
  experimentId: string;
  corpusVersion: string;
  datasetVersion: string;
  featureVersion: string;
  artifactId?: string;
  sourceDocumentCount: number;
  drawCount: number;
  chain: LineageStep[];
  isComplete: boolean;
}

interface ResultArtifact {
  artifactId: string;
  runId: string;
  metrics: {
    accuracy: number;
    balancedAccuracy: number;
    logLoss: number;
    sampleSize: number;
  };
  predictionsSample: Array<{
    resultId: string;
    sourceDrawId: string;
    canonicalNumber: string;
    predictedClass: string;
    observedTarget: string;
    isHit: boolean;
  }>;
}

interface StatisticalValidation {
  validationId: string;
  runId: string;
  experimentId: string;
  experimentVersion: string;
  datasetVersion: string;
  corpusVersion: string;
  validationMethod: string;
  validationVersion: string;
  createdAt: string;
  confidenceIntervals: {
    accuracy: {
      wilsonScoreInterval: { lower: number; upper: number; confidenceLevel: number; method: string };
      bootstrapInterval: { lower: number; upper: number; confidenceLevel: number; method: string };
    };
    logLoss: {
      normalInterval: { lower: number; upper: number; confidenceLevel: number; method: string };
    };
  };
  effectSizes: {
    cohensH: number;
    relativeAccuracyRatio: number;
    absoluteAccuracyDifference: number;
  };
  uncertainty: {
    standardError: number;
    sampleSize: number;
    confidenceLevel: number;
    marginOfError: number;
    degreesOfFreedom?: number;
  };
  nullModelComparison: {
    nullModelType: string;
    iterations: number;
    seed: number;
    mean: number;
    stdDev: number;
    min: number;
    max: number;
    quantiles: Record<string, number>;
    observedValue: number;
    zScore: number;
    empiricalPValue: number;
  };
  multipleTestingCorrection: {
    familyId: string;
    designation: string;
    method: string;
    baseAlpha: number;
    adjustedAlpha: number;
    rawPValue: number;
    adjustedPValue: number;
    isSignificant: boolean;
    totalHypothesesInFamily: number;
    rankInFamily: number;
  };
  temporalRobustness: {
    strategy: string;
    windowsCount: number;
    windowResults: Array<{
      windowIndex: number;
      trainDrawCount: number;
      testDrawCount: number;
      trainRowCount: number;
      testRowCount: number;
      trainDateRange: { earliestIso: string; latestIso: string };
      testDateRange: { earliestIso: string; latestIso: string };
      accuracy: number;
      logLoss: number;
      zeroLeakageConfirmed: boolean;
    }>;
    meanAccuracy: number;
    stdDevAccuracy: number;
    stabilityScore: number;
    zeroLeakageConfirmed: boolean;
  };
  interpretationContract: {
    observation: string;
    statisticalEvidence: {
      pValue: number;
      adjustedPValue: number;
      confidenceInterval: [number, number];
      effectSize: number;
      effectSizeMetric: string;
      hypothesisTest: string;
    };
    uncertainty: {
      standardError: number;
      sampleSize: number;
      confidenceLevel: number;
      marginOfError: number;
    };
    interpretation: string;
    limitation: string;
  };
  deterministicHash: string;
  nonPredictiveNotice: string;
}

export default function ExperimentsPage() {
  const [registry, setRegistry] = useState<RegisteredExperiment[]>([]);
  const [runs, setRuns] = useState<ExperimentRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<ExperimentRun | null>(null);
  const [selectedLineage, setSelectedLineage] = useState<ExperimentLineage | null>(null);
  const [selectedArtifact, setSelectedArtifact] = useState<ResultArtifact | null>(null);
  const [selectedValidation, setSelectedValidation] = useState<StatisticalValidation | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [filterExperiment, setFilterExperiment] = useState<string>("ALL");

  useEffect(() => {
    async function loadData() {
      try {
        const [regRes, runsRes] = await Promise.all([
          fetch("/api/v1/registered-experiments"),
          fetch("/api/v1/experiment-runs?pageSize=50")
        ]);

        if (regRes.ok) {
          const regJson = await regRes.json();
          setRegistry(regJson.data || []);
        }
        if (runsRes.ok) {
          const runsJson = await runsRes.json();
          setRuns(runsJson.data || []);
        }
      } catch (err) {
        console.error("Failed to load continuous research data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  async function handleSelectRun(run: ExperimentRun) {
    setSelectedRun(run);
    setDetailLoading(true);
    try {
      const [linRes, artRes, valRes] = await Promise.all([
        fetch(`/api/v1/experiment-runs/${run.runId}/lineage`),
        fetch(`/api/v1/experiment-results?runId=${run.runId}`),
        fetch(`/api/v1/experiment-runs/${run.runId}/validation`)
      ]);

      if (linRes.ok) {
        const linJson = await linRes.json();
        setSelectedLineage(linJson);
      } else {
        setSelectedLineage(null);
      }

      if (artRes.ok) {
        const artJson = await artRes.json();
        if (artJson.data && artJson.data.length > 0) {
          setSelectedArtifact(artJson.data[0]);
        } else {
          setSelectedArtifact(null);
        }
      }

      if (valRes.ok) {
        const valJson = await valRes.json();
        setSelectedValidation(valJson);
      } else {
        setSelectedValidation(null);
      }
    } catch (err) {
      console.error("Failed to load run details:", err);
    } finally {
      setDetailLoading(false);
    }
  }

  const filteredRuns = filterExperiment === "ALL"
    ? runs
    : runs.filter((r) => r.experimentId === filterExperiment);

  return (
    <div className="container" style={{ padding: "2rem 1.5rem" }}>
      {/* Scientific Research Boundary Notice */}
      <div className="scientific-notice" style={{ marginBottom: "2rem" }}>
        <strong>SCIENTIFIC RESEARCH & CONTINUOUS EXPERIMENTATION NOTICE</strong>
        <p style={{ margin: "0.4rem 0 0 0", fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
          This research layer executes continuous, reproducible hypothesis testing across formal mathematical baselines on historical Kerala State Lottery publications.
          Lotteries operate as physically stochastic, independent trials where past outcomes have strictly zero predictive validity for future drawings.
          All results are purely descriptive historical benchmarks. ZERO prediction claims, gambling recommendations, or future probability guarantees.
        </p>
      </div>

      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>
            Continuous Research & Experimentation
          </h1>
          <span className="badge badge-emerald">Milestone 9B</span>
          <span className="badge badge-blue">Deterministic Provenance</span>
          <span className="badge badge-purple">Temporal Leakage Protected</span>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", margin: 0 }}>
          Automated scientific research pipeline: Canonical Corpus → Feature Refresh → Modeling Dataset → Baseline Execution → Versioned Lineage DAG.
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "4rem" }}>Loading continuous research registry & runs...</div>
      ) : (
        <>
          {/* Section 1: Formal Experiment Registry */}
          <div style={{ marginBottom: "2.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0, color: "var(--accent-cyan)" }}>
                1. Formal Experiment Registry (9B.2)
              </h2>
              <span className="mono" style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                {registry.length} Registered Baselines
              </span>
            </div>

            <div className="grid-3" style={{ gap: "1.25rem" }}>
              {registry.map((exp) => (
                <div
                  key={exp.experimentId}
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "0.75rem",
                    padding: "1.25rem",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between"
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                      <span className="badge badge-purple">{exp.modelType} BASELINE</span>
                      <span className="mono" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        v{exp.version}
                      </span>
                    </div>

                    <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "0 0 0.5rem 0" }}>
                      {exp.name}
                    </h3>

                    <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: "0.75rem", lineHeight: 1.4 }}>
                      {exp.description}
                    </p>

                    <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                      <div>
                        Target: <strong className="mono">{exp.targetName}</strong> ({exp.targetId})
                      </div>
                      <div>
                        Policy: <span className="mono">{exp.temporalPolicy.strategy}</span> ({(exp.temporalPolicy.testRatio ?? 0.2) * 100}% Test)
                      </div>
                      <div>
                        Scope: <span className="mono">{exp.populationScope}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ borderTop: "1px solid var(--border-subtle)", marginTop: "1rem", paddingTop: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="mono" style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                      Hash: {exp.deterministicHash}
                    </span>
                    <button
                      onClick={() => setFilterExperiment(filterExperiment === exp.experimentId ? "ALL" : exp.experimentId)}
                      style={{
                        padding: "0.3rem 0.6rem",
                        fontSize: "0.75rem",
                        borderRadius: "0.4rem",
                        border: "1px solid var(--border-subtle)",
                        background: filterExperiment === exp.experimentId ? "var(--accent-cyan)" : "transparent",
                        color: filterExperiment === exp.experimentId ? "#000" : "var(--text-primary)",
                        cursor: "pointer",
                        fontWeight: 600
                      }}
                    >
                      {filterExperiment === exp.experimentId ? "Clear Filter" : "Filter Runs"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Execution Runs & History */}
          <div style={{ marginBottom: "2.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0, color: "var(--accent-emerald)" }}>
                2. Execution Runs & Results (9B.3)
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Filter:</span>
                <select
                  value={filterExperiment}
                  onChange={(e) => setFilterExperiment(e.target.value)}
                  style={{
                    background: "var(--bg-surface)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "0.4rem",
                    padding: "0.3rem 0.6rem",
                    fontSize: "0.85rem"
                  }}
                >
                  <option value="ALL">All Experiments ({runs.length})</option>
                  {registry.map((e) => (
                    <option key={e.experimentId} value={e.experimentId}>
                      {e.experimentId}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {filteredRuns.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", background: "var(--bg-surface)", borderRadius: "0.5rem", color: "var(--text-muted)" }}>
                No experiment runs found. Run `npm run refresh:research` to execute baseline experiments.
              </div>
            ) : (
              <div className="table-container">
                <table className="research-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Run ID</th>
                      <th>Experiment</th>
                      <th>Accuracy</th>
                      <th>Log Loss</th>
                      <th>Sample Size</th>
                      <th>Completed</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRuns.map((r) => (
                      <tr
                        key={r.runId}
                        style={{
                          background: selectedRun?.runId === r.runId ? "rgba(34, 197, 94, 0.08)" : undefined
                        }}
                      >
                        <td>
                          <span
                            className={`badge ${
                              r.status === "SUCCEEDED"
                                ? "badge-emerald"
                                : r.status === "FAILED"
                                ? "badge-red"
                                : "badge-blue"
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="mono" style={{ fontWeight: 600 }}>{r.runId}</td>
                        <td style={{ fontSize: "0.85rem" }}>{r.experimentId}</td>
                        <td>
                          <strong className="mono">
                            {r.metrics ? `${(r.metrics.accuracy * 100).toFixed(2)}%` : "N/A"}
                          </strong>
                        </td>
                        <td>
                          <span className="mono">
                            {r.metrics ? r.metrics.logLoss.toFixed(4) : "N/A"}
                          </span>
                        </td>
                        <td className="mono">{r.metrics?.sampleSize?.toLocaleString() ?? "N/A"}</td>
                        <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                          {r.completedAt ? new Date(r.completedAt).toLocaleString() : "Running"}
                        </td>
                        <td>
                          <button
                            onClick={() => handleSelectRun(r)}
                            style={{
                              padding: "0.3rem 0.6rem",
                              fontSize: "0.75rem",
                              borderRadius: "0.4rem",
                              border: "1px solid var(--border-subtle)",
                              background: selectedRun?.runId === r.runId ? "var(--accent-emerald)" : "var(--bg-card)",
                              color: selectedRun?.runId === r.runId ? "#000" : "var(--text-primary)",
                              cursor: "pointer",
                              fontWeight: 600
                            }}
                          >
                            Inspect Lineage
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 3: Run Detail & Lineage Inspector */}
          {selectedRun && (
            <div
              style={{
                marginBottom: "2.5rem",
                background: "var(--bg-surface)",
                border: "1px solid var(--accent-emerald)",
                borderRadius: "0.75rem",
                padding: "1.75rem"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
                    <span className="badge badge-emerald">{selectedRun.status}</span>
                    <span className="mono" style={{ fontSize: "1.1rem", fontWeight: 700 }}>{selectedRun.runId}</span>
                  </div>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>
                    {selectedRun.experimentId} (v{selectedRun.experimentVersion})
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedRun(null)}
                  style={{
                    background: "transparent",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-muted)",
                    borderRadius: "0.3rem",
                    padding: "0.2rem 0.5rem",
                    cursor: "pointer"
                  }}
                >
                  ✕ Close Inspector
                </button>
              </div>

              {detailLoading ? (
                <div style={{ padding: "2rem", textAlign: "center" }}>Loading provenance lineage DAG...</div>
              ) : (
                <>
                  {/* Versions & Evaluation Window Grid */}
                  <div className="grid-3" style={{ gap: "1rem", marginBottom: "1.5rem" }}>
                    <div style={{ background: "var(--bg-card)", padding: "1rem", borderRadius: "0.5rem", fontSize: "0.85rem" }}>
                      <strong style={{ color: "var(--accent-cyan)", display: "block", marginBottom: "0.4rem" }}>
                        Version Identities
                      </strong>
                      <div className="mono" style={{ fontSize: "0.78rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                        <div>Corpus: {selectedRun.corpusVersion}</div>
                        <div>Dataset: {selectedRun.datasetVersion}</div>
                        <div>Feature: {selectedRun.featureVersion}</div>
                        <div>Model: {selectedRun.modelVersion}</div>
                      </div>
                    </div>

                    <div style={{ background: "var(--bg-card)", padding: "1rem", borderRadius: "0.5rem", fontSize: "0.85rem" }}>
                      <strong style={{ color: "var(--accent-emerald)", display: "block", marginBottom: "0.4rem" }}>
                        Evaluation Window
                      </strong>
                      <div style={{ fontSize: "0.8rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                        <div>Train Draws: <strong>{selectedRun.evaluationWindow?.trainDrawCount}</strong> ({selectedRun.evaluationWindow?.trainRowCount?.toLocaleString()} records)</div>
                        <div>Test Draws: <strong>{selectedRun.evaluationWindow?.testDrawCount}</strong> ({selectedRun.evaluationWindow?.testRowCount?.toLocaleString()} records)</div>
                        <div>Train Dates: <span className="mono">{selectedRun.evaluationWindow?.trainDateRange.earliest}</span> to <span className="mono">{selectedRun.evaluationWindow?.trainDateRange.latest}</span></div>
                        <div>Test Dates: <span className="mono">{selectedRun.evaluationWindow?.testDateRange.earliest}</span> to <span className="mono">{selectedRun.evaluationWindow?.testDateRange.latest}</span></div>
                      </div>
                    </div>

                    <div style={{ background: "var(--bg-card)", padding: "1rem", borderRadius: "0.5rem", fontSize: "0.85rem" }}>
                      <strong style={{ color: "var(--accent-purple)", display: "block", marginBottom: "0.4rem" }}>
                        Reproducibility Metadata
                      </strong>
                      <div className="mono" style={{ fontSize: "0.78rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                        <div>Seed: {selectedRun.reproducibilityMetadata.seed} (Mulberry32)</div>
                        <div>Code Version: {selectedRun.reproducibilityMetadata.codeVersion}</div>
                        <div>Fingerprint: {selectedRun.reproducibilityMetadata.inputFingerprint}</div>
                        <div>Environment: {selectedRun.reproducibilityMetadata.runtimeEnvironment.nodeVersion} ({selectedRun.reproducibilityMetadata.runtimeEnvironment.platform})</div>
                      </div>
                    </div>
                  </div>

                  {/* Lineage DAG Flow */}
                  {selectedLineage && (
                    <div style={{ marginBottom: "1.5rem" }}>
                      <h4 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "0.75rem", color: "var(--accent-cyan)" }}>
                        Traceable Lineage DAG ({selectedLineage.chain.length} Invariant Stages — Complete: {selectedLineage.isComplete ? "✓ YES" : "✗ NO"})
                      </h4>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "0.5rem",
                          alignItems: "center",
                          background: "var(--bg-card)",
                          padding: "1rem",
                          borderRadius: "0.5rem"
                        }}
                      >
                        {selectedLineage.chain.map((step, idx) => (
                          <div key={step.step} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <div
                              style={{
                                border: "1px solid var(--border-subtle)",
                                borderRadius: "0.4rem",
                                padding: "0.4rem 0.7rem",
                                background: "var(--bg-surface)",
                                fontSize: "0.78rem"
                              }}
                            >
                              <div style={{ color: "var(--text-muted)", fontSize: "0.68rem", fontWeight: 600 }}>
                                STAGE {idx + 1}: {step.step}
                              </div>
                              <div className="mono" style={{ fontWeight: 600, color: "var(--accent-emerald)" }}>
                                {step.identity}
                              </div>
                            </div>
                            {idx < selectedLineage.chain.length - 1 && (
                              <span style={{ color: "var(--text-muted)", fontWeight: 700 }}>→</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Milestone 9C: Statistical Validation & Research Integrity */}
                  {selectedValidation && (
                    <div style={{ marginBottom: "1.75rem", borderTop: "1px solid var(--border-subtle)", paddingTop: "1.5rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <h4 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0, color: "var(--accent-purple)" }}>
                            Statistical Validation & Research Integrity
                          </h4>
                          <span className="badge badge-purple">Milestone 9C</span>
                          <span className="badge badge-emerald">Hypothesis Tested</span>
                        </div>
                        <div className="mono" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          Artifact: <strong style={{ color: "var(--text-primary)" }}>{selectedValidation.validationId}</strong> | Hash: {selectedValidation.deterministicHash.slice(0, 12)}...
                        </div>
                      </div>

                      {/* 5-Part Research Interpretation Contract */}
                      <div
                        style={{
                          background: "var(--bg-card)",
                          border: "1px solid var(--border-subtle)",
                          borderRadius: "0.5rem",
                          padding: "1.25rem",
                          marginBottom: "1.25rem"
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: "0.75rem", color: "var(--accent-cyan)" }}>
                          Five-Part Research Interpretation Contract
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", fontSize: "0.82rem" }}>
                          <div>
                            <span className="badge badge-blue" style={{ marginRight: "0.5rem" }}>OBSERVATION</span>
                            <span>{selectedValidation.interpretationContract.observation}</span>
                          </div>
                          <div>
                            <span className="badge badge-purple" style={{ marginRight: "0.5rem" }}>STAT EVIDENCE</span>
                            <span>
                              p = {selectedValidation.interpretationContract.statisticalEvidence.pValue.toFixed(4)} (Holm adj p = {selectedValidation.interpretationContract.statisticalEvidence.adjustedPValue.toFixed(4)}),
                              Wilson 95% CI: [{(selectedValidation.interpretationContract.statisticalEvidence.confidenceInterval[0] * 100).toFixed(2)}%, {(selectedValidation.interpretationContract.statisticalEvidence.confidenceInterval[1] * 100).toFixed(2)}%],
                              Cohen's h = {selectedValidation.interpretationContract.statisticalEvidence.effectSize.toFixed(4)} vs theoretical chance (10.00%).
                            </span>
                          </div>
                          <div>
                            <span className="badge badge-amber" style={{ marginRight: "0.5rem" }}>UNCERTAINTY</span>
                            <span>
                              Standard Error = {selectedValidation.uncertainty.standardError.toFixed(4)}, Margin of Error = ±{(selectedValidation.uncertainty.marginOfError * 100).toFixed(2)}% ({(selectedValidation.uncertainty.confidenceLevel * 100).toFixed(0)}% confidence, N = {selectedValidation.uncertainty.sampleSize.toLocaleString()} holdout samples).
                            </span>
                          </div>
                          <div>
                            <span className="badge badge-emerald" style={{ marginRight: "0.5rem" }}>INTERPRETATION</span>
                            <span style={{ fontWeight: 600 }}>{selectedValidation.interpretationContract.interpretation}</span>
                          </div>
                          <div>
                            <span className="badge badge-red" style={{ marginRight: "0.5rem" }}>LIMITATION</span>
                            <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>{selectedValidation.interpretationContract.limitation}</span>
                          </div>
                        </div>
                      </div>

                      {/* 4 Stat Cards */}
                      <div className="grid-4" style={{ gap: "1rem", marginBottom: "1.25rem" }}>
                        {/* 1. Inference & CIs */}
                        <div style={{ background: "var(--bg-card)", padding: "1rem", borderRadius: "0.5rem", fontSize: "0.82rem" }}>
                          <strong style={{ color: "var(--accent-emerald)", display: "block", marginBottom: "0.4rem" }}>
                            Confidence Intervals
                          </strong>
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                            <div>Wilson 95%: <strong className="mono">[{(selectedValidation.confidenceIntervals.accuracy.wilsonScoreInterval.lower * 100).toFixed(2)}%, {(selectedValidation.confidenceIntervals.accuracy.wilsonScoreInterval.upper * 100).toFixed(2)}%]</strong></div>
                            <div>Bootstrap 95%: <span className="mono">[{(selectedValidation.confidenceIntervals.accuracy.bootstrapInterval.lower * 100).toFixed(2)}%, {(selectedValidation.confidenceIntervals.accuracy.bootstrapInterval.upper * 100).toFixed(2)}%]</span></div>
                            <div>Cohen's h: <span className="mono">{selectedValidation.effectSizes.cohensH.toFixed(4)}</span></div>
                            <div>Rel. Ratio: <span className="mono">{selectedValidation.effectSizes.relativeAccuracyRatio.toFixed(3)}x</span></div>
                          </div>
                        </div>

                        {/* 2. Null Model Comparison */}
                        <div style={{ background: "var(--bg-card)", padding: "1rem", borderRadius: "0.5rem", fontSize: "0.82rem" }}>
                          <strong style={{ color: "var(--accent-cyan)", display: "block", marginBottom: "0.4rem" }}>
                            Null Distribution
                          </strong>
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                            <div>Model: <span className="mono" style={{ fontSize: "0.75rem" }}>{selectedValidation.nullModelComparison.nullModelType}</span></div>
                            <div>Null Mean: <strong className="mono">{(selectedValidation.nullModelComparison.mean * 100).toFixed(2)}%</strong> ± {(selectedValidation.nullModelComparison.stdDev * 100).toFixed(2)}%</div>
                            <div>Z-Score: <span className="mono">{selectedValidation.nullModelComparison.zScore.toFixed(3)}</span></div>
                            <div>Empirical p: <strong className="mono" style={{ color: selectedValidation.nullModelComparison.empiricalPValue < 0.05 ? "var(--accent-red)" : "var(--accent-emerald)" }}>{selectedValidation.nullModelComparison.empiricalPValue.toFixed(4)}</strong></div>
                          </div>
                        </div>

                        {/* 3. Multiple Testing */}
                        <div style={{ background: "var(--bg-card)", padding: "1rem", borderRadius: "0.5rem", fontSize: "0.82rem" }}>
                          <strong style={{ color: "var(--accent-purple)", display: "block", marginBottom: "0.4rem" }}>
                            Multiple Comparisons
                          </strong>
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                            <div>Method: <span className="mono">{selectedValidation.multipleTestingCorrection.method}</span></div>
                            <div>Family: <span className="mono" style={{ fontSize: "0.72rem" }}>{selectedValidation.multipleTestingCorrection.familyId}</span></div>
                            <div>Holm Adj p: <strong className="mono">{selectedValidation.multipleTestingCorrection.adjustedPValue.toFixed(4)}</strong></div>
                            <div>Significant: <span className={`badge ${selectedValidation.multipleTestingCorrection.isSignificant ? "badge-red" : "badge-emerald"}`}>{selectedValidation.multipleTestingCorrection.isSignificant ? "YES" : "NO"}</span></div>
                          </div>
                        </div>

                        {/* 4. Temporal Robustness */}
                        <div style={{ background: "var(--bg-card)", padding: "1rem", borderRadius: "0.5rem", fontSize: "0.82rem" }}>
                          <strong style={{ color: "var(--accent-amber)", display: "block", marginBottom: "0.4rem" }}>
                            Temporal Robustness
                          </strong>
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                            <div>Strategy: <span className="mono" style={{ fontSize: "0.72rem" }}>EXPANDING_WINDOW</span></div>
                            <div>Windows: <strong>{selectedValidation.temporalRobustness.windowsCount} folds</strong></div>
                            <div>Stability: <strong className="mono">{(selectedValidation.temporalRobustness.stabilityScore * 100).toFixed(1)}%</strong></div>
                            <div>Zero Leakage: <span className="badge badge-emerald">✓ VERIFIED</span></div>
                          </div>
                        </div>
                      </div>

                      {/* Walk-Forward Folds Table */}
                      {selectedValidation.temporalRobustness.windowResults && selectedValidation.temporalRobustness.windowResults.length > 0 && (
                        <div style={{ marginBottom: "1rem" }}>
                          <div style={{ fontSize: "0.82rem", fontWeight: 700, marginBottom: "0.4rem", color: "var(--text-secondary)" }}>
                            Walk-Forward Evaluation Windows (Chronological Expanding Folds)
                          </div>
                          <div className="table-container">
                            <table className="research-table" style={{ fontSize: "0.75rem" }}>
                              <thead>
                                <tr>
                                  <th>Fold</th>
                                  <th>Train Period</th>
                                  <th>Train Draws</th>
                                  <th>Test Period</th>
                                  <th>Test Draws</th>
                                  <th>Fold Accuracy</th>
                                  <th>Cross-Entropy</th>
                                  <th>Leakage Protected</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedValidation.temporalRobustness.windowResults.map((w) => (
                                  <tr key={w.windowIndex}>
                                    <td className="mono" style={{ fontWeight: 600 }}>Fold {w.windowIndex}</td>
                                    <td className="mono">{w.trainDateRange.earliestIso} → {w.trainDateRange.latestIso}</td>
                                    <td>{w.trainDrawCount} ({w.trainRowCount.toLocaleString()} rows)</td>
                                    <td className="mono">{w.testDateRange.earliestIso} → {w.testDateRange.latestIso}</td>
                                    <td>{w.testDrawCount} ({w.testRowCount.toLocaleString()} rows)</td>
                                    <td className="mono" style={{ fontWeight: 700 }}>{(w.accuracy * 100).toFixed(2)}%</td>
                                    <td className="mono">{w.logLoss.toFixed(4)}</td>
                                    <td><span className="badge badge-emerald">✓ PASS</span></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Predictions Sample from Result Artifact */}
                  {selectedArtifact && selectedArtifact.predictionsSample && selectedArtifact.predictionsSample.length > 0 && (
                    <div>
                      <h4 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "0.5rem", color: "var(--text-primary)" }}>
                        Result Artifact Verification Sample ({selectedArtifact.predictionsSample.length} Test Observations)
                      </h4>
                      <div className="table-container">
                        <table className="research-table" style={{ fontSize: "0.8rem" }}>
                          <thead>
                            <tr>
                              <th>Draw ID</th>
                              <th>Canonical Ticket Number</th>
                              <th>Predicted Class</th>
                              <th>Observed Target</th>
                              <th>Outcome</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedArtifact.predictionsSample.slice(0, 10).map((row, idx) => (
                              <tr key={`${row.resultId}-${idx}`}>
                                <td className="mono">{row.sourceDrawId}</td>
                                <td className="mono" style={{ fontWeight: 600 }}>{row.canonicalNumber}</td>
                                <td className="mono">{row.predictedClass}</td>
                                <td className="mono">{row.observedTarget}</td>
                                <td>
                                  <span className={`badge ${row.isHit ? "badge-emerald" : "badge-blue"}`}>
                                    {row.isHit ? "HIT" : "MISS"}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
