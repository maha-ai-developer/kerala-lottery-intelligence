"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return (
    <div className="container" style={{ padding: "2rem 1.5rem", maxWidth: "720px" }}>
      <div className="panel" style={{ borderLeft: "4px solid var(--status-warning)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          <span className={`badge ${isOnline ? "badge-valid" : "badge-warning"}`}>
            {isOnline ? "Network Connection Detected" : "Offline Shell Active"}
          </span>
          <span className="mono" style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
            Cache Policy: Network-First Provenance Guard
          </span>
        </div>

        <h1 className="page-title" style={{ marginBottom: "0.75rem" }}>
          Live Research Corpus Requires Network Connectivity
        </h1>

        <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: 1.65, marginBottom: "1rem" }}>
          You are viewing the offline application shell for <strong>Kerala Lottery Intelligence</strong>. To uphold strict scientific and archival provenance, this Progressive Web App never substitutes stale cached draw results, unverified cloud-residency statuses, or offline API payloads as current live data.
        </p>

        <div
          style={{
            padding: "1rem 1.25rem",
            borderRadius: "8px",
            background: "var(--bg-surface-elevated)",
            border: "1px solid var(--border-subtle)",
            marginBottom: "1.5rem",
            fontSize: "0.875rem",
            color: "var(--text-secondary)",
            lineHeight: 1.6
          }}
        >
          <strong style={{ color: "var(--text-primary)", display: "block", marginBottom: "0.35rem" }}>
            Scientific Offline Safeguards:
          </strong>
          <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
            <li>Live research endpoints (<code>/api/v1/*</code>) and operational endpoints (<code>/api/ops/*</code>) are strictly network-only and never cached by the Service Worker.</li>
            <li>Historical SHA-256 document hashes, scheme validation rules, and cloud storage integrity checks require live server verification.</li>
            <li>Reconnect to the network to inspect the verified 114-draw V1 research corpus.</li>
          </ul>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
          <button
            type="button"
            className="btn"
            onClick={() => window.location.reload()}
          >
            Retry Live Connection
          </button>
          <Link href="/" className="btn btn-secondary">
            Return to Overview
          </Link>
          <Link href="/draws" className="btn btn-secondary">
            Open Draw Explorer
          </Link>
        </div>
      </div>
    </div>
  );
}
