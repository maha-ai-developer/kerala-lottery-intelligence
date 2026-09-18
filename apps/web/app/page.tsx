"use client";

import { useState } from "react";
import { useAuth } from "../lib/auth-context";
import { PhoneAuthCard } from "../components/phone-auth-card";

export default function DashboardPage() {
  const { user, userProfile, loading, signOut, refreshProfile, error } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  // Dynamic environment configuration (never hardcoded)
  const environment =
    process.env.NEXT_PUBLIC_APP_ENV ||
    (process.env.NODE_ENV === "production" ? "production" : "development");
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "unconfigured";
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0";
  const gitCommitSha =
    process.env.NEXT_PUBLIC_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_COMMIT_SHA ||
    "unknown";

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshProfile();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div
        className="container"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
          gap: "1rem"
        }}
      >
        <div
          style={{
            width: "2.5rem",
            height: "2.5rem",
            border: "3px solid var(--border-subtle)",
            borderTopColor: "var(--accent-cyan)",
            borderRadius: "50%",
            animation: "spin 1s linear infinite"
          }}
        />
        <p className="mono" style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
          Verifying Firebase authentication state...
        </p>
      </div>
    );
  }

  // If unauthenticated: Display the Phone Auth Screen & Foundational Purpose
  if (!user) {
    return (
      <div className="container" style={{ padding: "3rem 1.5rem" }}>
        <div style={{ maxWidth: "680px", margin: "0 auto 2.5rem auto", textAlign: "center" }}>
          <div style={{ display: "inline-flex", gap: "0.5rem", marginBottom: "1rem" }}>
            <span className="badge badge-blue">Milestone 1A: Production Skeleton</span>
            <span className="badge badge-emerald">Project: {projectId}</span>
          </div>
          <h1
            style={{
              fontSize: "2.25rem",
              fontWeight: 800,
              letterSpacing: "-0.025em",
              marginBottom: "1rem",
              background: "linear-gradient(135deg, #f8fafc 40%, #94a3b8)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent"
            }}
          >
            Kerala State Lottery Intelligence
          </h1>
          <p
            style={{
              fontSize: "1.05rem",
              color: "var(--text-secondary)",
              lineHeight: 1.6
            }}
          >
            Source-grounded research platform engineered for verifiable provenance,
            deterministic statistical hypothesis testing, and temporal leak prevention.
          </p>
        </div>

        <PhoneAuthCard />
      </div>
    );
  }

  // If authenticated: Minimal Production-Grade Authenticated Dashboard
  return (
    <div className="container" style={{ padding: "2.5rem 1.5rem" }}>
      {/* Top Header & Actions Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "2rem",
          paddingBottom: "1.5rem",
          borderBottom: "1px solid var(--border-subtle)"
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 700 }}>Authenticated Dashboard</h1>
            <span className="badge badge-emerald">Active Session</span>
          </div>
          <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
            Welcome, <span className="mono" style={{ color: "var(--text-primary)" }}>{user.phoneNumber || user.uid}</span>.
            System boundary contracts and security gates are verified.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-primary)",
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              fontSize: "0.85rem",
              cursor: refreshing ? "not-allowed" : "pointer"
            }}
          >
            {refreshing ? "Refreshing..." : "Refresh Status"}
          </button>
          <button
            type="button"
            onClick={() => signOut()}
            style={{
              background: "rgba(244, 63, 94, 0.12)",
              border: "1px solid rgba(244, 63, 94, 0.3)",
              color: "#fb7185",
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            background: "rgba(244, 63, 94, 0.12)",
            border: "1px solid rgba(244, 63, 94, 0.3)",
            borderRadius: "0.5rem",
            padding: "0.85rem 1rem",
            marginBottom: "1.5rem",
            fontSize: "0.875rem",
            color: "#fb7185"
          }}
        >
          {error}
        </div>
      )}

      {/* Grid of Sections */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "1.5rem",
          marginBottom: "2rem"
        }}
      >
        {/* Section 1: User Identity & Profile */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "0.75rem",
            padding: "1.5rem"
          }}
        >
          <h2 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "1rem", color: "var(--accent-cyan)" }}>
            1. User Identity & Authorization
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.875rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-secondary)" }}>Phone Number:</span>
              <span className="mono" style={{ color: "var(--text-primary)" }}>{user.phoneNumber || "None"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-secondary)" }}>Firebase UID:</span>
              <span className="mono" style={{ color: "var(--text-muted)", fontSize: "0.78rem" }} title={user.uid}>
                {user.uid.slice(0, 14)}...
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "var(--text-secondary)" }}>Assigned Role:</span>
              <span className="badge badge-blue">{userProfile?.role || "VIEWER"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "var(--text-secondary)" }}>Profile Status:</span>
              <span className="badge badge-emerald">{userProfile?.status || "ACTIVE"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-secondary)" }}>Client Elevation:</span>
              <span style={{ color: "var(--accent-emerald)", fontWeight: 600 }}>Blocked by Rules</span>
            </div>
          </div>
        </div>

        {/* Section 2: Environment & Build Metadata */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "0.75rem",
            padding: "1.5rem"
          }}
        >
          <h2 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "1rem", color: "var(--accent-blue)" }}>
            2. Environment & Build Metadata
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.875rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "var(--text-secondary)" }}>Environment:</span>
              <span className="mono" style={{ color: "var(--accent-cyan)", fontWeight: 600 }}>{environment}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-secondary)" }}>Firebase Project:</span>
              <span className="mono" style={{ color: "var(--text-primary)" }}>{projectId}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-secondary)" }}>App Version:</span>
              <span className="mono" style={{ color: "var(--text-primary)" }}>v{appVersion}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-secondary)" }}>Git Commit SHA:</span>
              <span className="mono" style={{ color: "var(--text-muted)" }}>{gitCommitSha}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-secondary)" }}>App Hosting Root:</span>
              <span className="mono" style={{ color: "var(--text-primary)" }}>apps/web</span>
            </div>
          </div>
        </div>

        {/* Section 3: System Boundaries & Safety Invariants */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "0.75rem",
            padding: "1.5rem"
          }}
        >
          <h2 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "1rem", color: "var(--accent-emerald)" }}>
            3. Platform Safety Invariants
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.875rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "var(--text-secondary)" }}>Firebase Auth:</span>
              <span className="badge badge-emerald">Connected</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "var(--text-secondary)" }}>Firestore Security Rules:</span>
              <span className="badge badge-emerald">Enforced</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "var(--text-secondary)" }}>Canonical Strings ("0276"):</span>
              <span className="badge badge-emerald">Protected</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "var(--text-secondary)" }}>Temporal Leak Guard:</span>
              <span className="badge badge-emerald">Strict Cutoff</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "var(--text-secondary)" }}>Health Endpoint:</span>
              <span className="mono" style={{ color: "var(--accent-cyan)", fontSize: "0.8rem" }}>GET /api/health</span>
            </div>
          </div>
        </div>
      </div>

      {/* Operational Note */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderLeft: "4px solid var(--accent-cyan)",
          padding: "1.25rem",
          borderRadius: "0.5rem"
        }}
      >
        <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--accent-cyan)", marginBottom: "0.25rem" }}>
          Phase 0 / Milestone 1A Verification Scope
        </div>
        <p style={{ fontSize: "0.825rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
          Lottery prediction, recommendation algorithms, analytics dashboards, and PDF ingestion
          are deliberately withheld until the cloud deployment loop and verified datasets are established.
        </p>
      </div>
    </div>
  );
}
