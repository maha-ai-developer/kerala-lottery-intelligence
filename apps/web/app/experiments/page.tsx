"use client";

import { useEffect, useState } from "react";

interface ModelItem {
  id: string;
  name: string;
  version: string;
  type: string;
  description: string;
  theoreticalAccuracy: number;
  expectedLoss: number;
}

interface ExperimentItem {
  id: string;
  name: string;
  methodology: string;
  trainWindow: string;
  testWindow: string;
  totalDrawsEvaluated: number;
  modelsEvaluated: Array<{
    modelId: string;
    logLoss: number;
    accuracy: number;
    brierScore: number;
  }>;
  temporalLeakageGuard: string;
}

interface BacktestItem {
  id: string;
  name: string;
  evaluationMethod: string;
  windowSizeDraws: number;
  stepSizeDraws: number;
  totalFolds: number;
  meanLogLoss: number;
  meanAccuracy: number;
  baselineComparison: string;
}

export default function ExperimentsPage() {
  const [models, setModels] = useState<ModelItem[]>([]);
  const [experiments, setExperiments] = useState<ExperimentItem[]>([]);
  const [backtests, setBacktests] = useState<BacktestItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [modelsRes, expRes, backRes] = await Promise.all([
          fetch("/api/v1/models"),
          fetch("/api/v1/experiments"),
          fetch("/api/v1/backtests")
        ]);

        if (modelsRes.ok) {
          const json = await modelsRes.json();
          setModels(json.data || []);
        }
        if (expRes.ok) {
          const json = await expRes.json();
          setExperiments(json.data || []);
        }
        if (backRes.ok) {
          const json = await backRes.json();
          setBacktests(json.data || []);
        }
      } catch (err) {
        console.error("Error loading experiments:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  return (
    <div className="container" style={{ padding: "2rem 1.5rem" }}>
      {/* Scientific Refutation Notice */}
      <div className="scientific-notice" style={{ marginBottom: "2rem" }}>
        <strong>SCIENTIFIC BENCHMARKING & MYTH REFUTATION</strong>
        <p style={{ margin: "0.4rem 0 0 0", fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
          The models and backtest results presented on this screen are designed for empirical hypothesis testing and benchmarking.
          Their primary scientific contribution is proving that statistical, empirical, and pattern-based models perform strictly equivalent to or worse than a purely uniform random baseline (10.0% expected digit accuracy).
          Strict temporal separation guarantees zero data leakage from future draws into model evaluations.
        </p>
      </div>

      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>
            Experiments & Backtests
          </h1>
          <span className="badge badge-emerald">Temporal Cutoff Enforced</span>
          <span className="badge badge-blue">Non-Predictive Surface</span>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", margin: 0 }}>
          Chronological holdout validation and walk-forward evaluations over verified historical data.
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "4rem" }}>Loading scientific benchmarks...</div>
      ) : (
        <>
          {/* Section 1: Benchmark Models */}
          <div style={{ marginBottom: "2.5rem" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "1rem", color: "var(--accent-cyan)" }}>
              1. Statistical Benchmark Models
            </h2>
            <div className="grid-3" style={{ gap: "1.25rem" }}>
              {models.map((m) => (
                <div
                  key={m.id}
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "0.75rem",
                    padding: "1.5rem",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between"
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                      <span className="mono" style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        {m.version}
                      </span>
                      <span className="badge badge-blue">{m.type}</span>
                    </div>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 0.5rem 0" }}>
                      {m.name}
                    </h3>
                    <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1rem", lineHeight: 1.4 }}>
                      {m.description}
                    </p>
                  </div>

                  <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "0.75rem", fontSize: "0.8rem", display: "flex", justifyContent: "space-between" }}>
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>Theoretical Acc: </span>
                      <strong className="mono">{(m.theoreticalAccuracy * 100).toFixed(1)}%</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>Exp. Loss: </span>
                      <strong className="mono">{m.expectedLoss.toFixed(3)}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Chronological Holdout Experiments */}
          <div style={{ marginBottom: "2.5rem" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "1rem", color: "var(--accent-emerald)" }}>
              2. Chronological Holdout Evaluation
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {experiments.map((exp) => (
                <div
                  key={exp.id}
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "0.75rem",
                    padding: "1.5rem"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                        <span className="badge badge-emerald">{exp.methodology}</span>
                        <span className="mono" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{exp.id}</span>
                      </div>
                      <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>
                        {exp.name}
                      </h3>
                    </div>
                    <div style={{ textAlign: "right", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                      <div>Train: <span className="mono">{exp.trainWindow}</span></div>
                      <div>Holdout: <span className="mono">{exp.testWindow}</span></div>
                    </div>
                  </div>

                  {/* Results comparison table */}
                  <div className="table-container">
                    <table className="research-table">
                      <thead>
                        <tr>
                          <th>Evaluated Model</th>
                          <th>Top-1 Accuracy</th>
                          <th>Log Loss (NLL)</th>
                          <th>Brier Score</th>
                          <th>Performance vs Null Hypothesis</th>
                        </tr>
                      </thead>
                      <tbody>
                        {exp.modelsEvaluated.map((m) => (
                          <tr key={m.modelId}>
                            <td className="mono" style={{ fontWeight: 600 }}>{m.modelId}</td>
                            <td>
                              <span className="mono">{(m.accuracy * 100).toFixed(2)}%</span>
                            </td>
                            <td>
                              <span className="mono">{m.logLoss.toFixed(4)}</span>
                            </td>
                            <td>
                              <span className="mono">{m.brierScore.toFixed(4)}</span>
                            </td>
                            <td>
                              <span className="badge badge-blue">
                                {m.accuracy <= 0.105 ? "Matches Random Baseline" : "Slight Variance"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ marginTop: "1rem", fontSize: "0.8rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span className="badge badge-emerald" style={{ fontSize: "0.68rem" }}>ENFORCED</span>
                    <span>{exp.temporalLeakageGuard}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Walk-Forward Backtests */}
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "1rem", color: "var(--accent-purple)" }}>
              3. Walk-Forward Temporal Backtesting
            </h2>
            <div className="grid-2" style={{ gap: "1.25rem" }}>
              {backtests.map((bt) => (
                <div
                  key={bt.id}
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "0.75rem",
                    padding: "1.5rem"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                    <span className="badge badge-purple">{bt.evaluationMethod}</span>
                    <span className="mono" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {bt.totalFolds} Folds
                    </span>
                  </div>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 0.75rem 0" }}>
                    {bt.name}
                  </h3>

                  <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "1rem" }}>
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>Window Size: </span>
                      <strong>{bt.windowSizeDraws} draws</strong> (step: {bt.stepSizeDraws})
                    </div>
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>Mean Accuracy across Folds: </span>
                      <strong className="mono">{(bt.meanAccuracy * 100).toFixed(2)}%</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>Mean Log Loss: </span>
                      <strong className="mono">{bt.meanLogLoss.toFixed(4)}</strong>
                    </div>
                  </div>

                  <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "0.75rem", fontSize: "0.8rem", color: "var(--accent-cyan)" }}>
                    {bt.baselineComparison}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
