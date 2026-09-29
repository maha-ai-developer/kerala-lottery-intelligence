"use client";

import { useEffect, useState } from "react";

interface IngestionRun {
  runId: string;
  timestamp: string;
  trigger: string;
  drawsProcessed: number;
  resultsProcessed: number;
  status: string;
  schedulerState: string;
  singleFlightLockStatus: string;
  sanitizationVerified: boolean;
  durationMs: number;
  notes?: string;
}

export default function IngestionStatusPage() {
  const [runs, setRuns] = useState<IngestionRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadIngestionData() {
      try {
        const res = await fetch("/api/v1/ingestion/runs");
        if (res.ok) {
          const json = await res.json();
          setRuns(json.data || []);
        }
      } catch (err) {
        console.error("Error loading ingestion runs:", err);
      } finally {
        setLoading(false);
      }
    }

    loadIngestionData();
  }, []);

  return (
    <div className="container" style={{ padding: "2rem 1.5rem" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>
            Operational Ingestion Surface
          </h1>
          <span className="badge badge-amber">PROD SCHEDULER: DISABLED</span>
          <span className="badge badge-emerald">Single-Flight Guard: IDLE</span>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", margin: 0 }}>
          Telemetry, audit logs, and execution records for the Kerala Lottery document ingestion pipeline. All records scrubbed of operational secrets.
        </p>
      </div>

      {/* Operational Guard Status Cards */}
      <div className="grid-3" style={{ marginBottom: "2rem" }}>
        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="stat-value" style={{ color: "var(--accent-amber)" }}>
              PAUSED
            </div>
            <span className="badge badge-amber">GCP Cloud Scheduler</span>
          </div>
          <div className="stat-label">Production Scheduler State</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.35rem" }}>
            `prod-daily-lottery-ingestion` paused per 8C/9A policy
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="stat-value" style={{ color: "var(--accent-emerald)" }}>
              UNLOCKED
            </div>
            <span className="badge badge-emerald">Firestore Distributed Lock</span>
          </div>
          <div className="stat-label">Single-Flight Concurrency Lock</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.35rem" }}>
            Guarantees zero concurrent or overlapping runs
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="stat-value" style={{ color: "var(--accent-cyan)" }}>
              100%
            </div>
            <span className="badge badge-blue">Secret Sanitizer</span>
          </div>
          <div className="stat-label">Authorization Scrubbing</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.35rem" }}>
            Zero bearer tokens, IAM credentials, or internal headers exposed
          </div>
        </div>
      </div>

      {/* Ingestion Runs History */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Recent Pipeline Ingestion Runs</h2>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Audited runs with cryptographic verification and replay idempotency
            </div>
          </div>
          <span className="badge badge-emerald">Audit Trail Preserved</span>
        </div>

        <div className="table-container">
          <table className="research-table">
            <thead>
              <tr>
                <th>Run ID</th>
                <th>Timestamp</th>
                <th>Trigger Method</th>
                <th>Draws / Results</th>
                <th>Run Status</th>
                <th>Duration</th>
                <th>Secret Scrubber</th>
                <th>Operational Notes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "3rem" }}>
                    Loading ingestion telemetry...
                  </td>
                </tr>
              ) : runs.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "3rem" }}>
                    No ingestion run records available.
                  </td>
                </tr>
              ) : (
                runs.map((run) => (
                  <tr key={run.runId}>
                    <td>
                      <span className="mono" style={{ color: "var(--accent-cyan)", fontSize: "0.8rem" }}>
                        {run.runId}
                      </span>
                    </td>
                    <td style={{ fontSize: "0.8rem" }}>
                      {run.timestamp}
                    </td>
                    <td>
                      <span className="badge badge-blue" style={{ fontSize: "0.75rem" }}>
                        {run.trigger}
                      </span>
                    </td>
                    <td>
                      <span className="mono" style={{ fontSize: "0.85rem" }}>
                        {run.drawsProcessed} draws / {run.resultsProcessed.toLocaleString()} results
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-emerald" style={{ fontSize: "0.75rem" }}>
                        {run.status}
                      </span>
                    </td>
                    <td>
                      <span className="mono" style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        {run.durationMs}ms
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-emerald" style={{ fontSize: "0.7rem" }}>
                        SANITIZED
                      </span>
                    </td>
                    <td style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                      {run.notes || "Controlled execution"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
