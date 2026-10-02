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

export default function ExperimentsPage() {
  const [registry, setRegistry] = useState<RegisteredExperiment[]>([]);
  const [runs, setRuns] = useState<ExperimentRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<ExperimentRun | null>(null);
  const [selectedLineage, setSelectedLineage] = useState<ExperimentLineage | null>(null);
  const [selectedArtifact, setSelectedArtifact] = useState<ResultArtifact | null>(null);
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
      const [linRes, artRes] = await Promise.all([
        fetch(`/api/v1/experiment-runs/${run.runId}/lineage`),
        fetch(`/api/v1/experiment-results?runId=${run.runId}`)
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
