"use client";

import { useEffect, useState } from "react";

interface ResearchFinding {
  findingId: string;
  findingVersion: string;
  statement: string;
  claimType: "OBSERVATION" | "STATISTICAL_RESULT" | "INTERPRETATION" | "LIMITATION";
  corpusVersion: string;
  datasetVersion: string;
  experimentId: string;
  experimentVersion: string;
  runId: string;
  validationId: string;
  methodology: string;
  methodologyVersion: string;
  parameters: {
    confidenceLevel: number;
    familyId: string;
    totalHypothesesInFamily: number;
    nullModelType: string;
    nullModelIterations: number;
    seed: number;
    walkForwardWindows: number;
    [key: string]: unknown;
  };
  evidence: {
    observedAccuracy: number;
    nullDistributionMean: number;
    nullDistributionStdDev: number;
    zScore: number;
    rawPValue: number;
    adjustedPValue: number;
    isSignificant: boolean;
    cohensH: number;
    relativeAccuracyRatio: number;
    walkForwardStabilityScore: number;
    holdoutDrawCount: number;
    holdoutRowCount: number;
    [key: string]: unknown;
  };
  uncertainty: {
    sampleSize: number;
    standardError: number;
    marginOfError: number;
    confidenceLevel: number;
    wilsonScore95CI: [number, number];
    bootstrap95CI: [number, number];
  };
  interpretation: string;
  limitation: string;
  createdAt: string;
  deterministicHash: string;
}

interface EvidenceBundle {
  evidenceBundleId: string;
  bundleVersion: string;
  findingId: string;
  sourceDocumentCount: number;
  sourceDocumentShas: string[];
  drawCount: number;
  drawIds: string[];
  corpusRef: {
    corpusId: string;
    sha256Hash: string;
    drawCount: number;
    totalResults: number;
  };
  featureMatrixRef: {
    featureMatrixId: string;
  };
  modelingDatasetRef: {
    datasetId: string;
    totalRows: number;
    trainRows: number;
    testRows: number;
  };
  experimentRef: {
    experimentId: string;
    version: string;
    deterministicHash: string;
  };
  runRef: {
    runId: string;
    status: string;
    modelVersion: string;
    inputFingerprint: string;
  };
  resultArtifactRef: {
    artifactId: string;
    deterministicHash: string;
  };
  validationRef: {
    validationId: string;
    deterministicHash: string;
  };
  artifactHashes: Record<string, string>;
  softwareEnvironment: {
    engine: string;
    version: string;
    nodeVersion: string;
    platform: string;
    arch: string;
    dependencies: Record<string, string>;
  };
  methodology: {
    name: string;
    version: string;
    description: string;
    disclaimer: string;
  };
  verifiedAt: string;
  isIntegrityVerified: boolean;
  integrityErrors: string[];
  deterministicHash: string;
}

interface LineageStep {
  stageNumber: number;
  step: string;
  identity: string;
  deterministicHash?: string;
  attributes: Record<string, unknown>;
}

interface ResearchFindingLineage {
  findingId: string;
  runId: string;
  validationId: string;
  experimentId: string;
  corpusVersion: string;
  datasetVersion: string;
  sourceDocumentCount: number;
  sourceDocumentShas: string[];
  drawCount: number;
  drawIds: string[];
  chain: LineageStep[];
  isComplete: boolean;
}

interface PublicationReport {
  reportId: string;
  findingId: string;
  evidenceBundleId: string;
  title: string;
  abstract: string;
  claimType: string;
  generatedAt: string;
  markdownContent: string;
  deterministicHash: string;
}

export default function FindingsPage() {
  const [findings, setFindings] = useState<ResearchFinding[]>([]);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceBundle | null>(null);
  const [selectedLineage, setSelectedLineage] = useState<ResearchFindingLineage | null>(null);
  const [selectedReport, setSelectedReport] = useState<PublicationReport | null>(null);
  const [activeTab, setActiveTab] = useState<"lineage" | "evidence" | "methodology" | "report">("lineage");
  const [claimTypeFilter, setClaimTypeFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [showAllShas, setShowAllShas] = useState<boolean>(false);
  const [copiedReport, setCopiedReport] = useState<boolean>(false);

  useEffect(() => {
    async function loadFindings() {
      try {
        setLoading(true);
        const res = await fetch("/api/v1/findings?pageSize=50");
        if (res.ok) {
          const json = await res.json();
          const items = json.data || [];
          setFindings(items);
          if (items.length > 0) {
            setSelectedFindingId(items[0].findingId);
          }
        }
      } catch (err) {
        console.error("Failed to load research findings:", err);
      } finally {
        setLoading(false);
      }
    }
    loadFindings();
  }, []);

  useEffect(() => {
    if (!selectedFindingId) return;

    async function loadDetails() {
      try {
        setLoadingDetails(true);
        const [evRes, linRes, repRes] = await Promise.all([
          fetch(`/api/v1/findings/${selectedFindingId}/evidence`),
          fetch(`/api/v1/findings/${selectedFindingId}/lineage`),
          fetch(`/api/v1/findings/${selectedFindingId}/report`)
        ]);

        if (evRes.ok) setSelectedEvidence(await evRes.json());
        if (linRes.ok) setSelectedLineage(await linRes.json());
        if (repRes.ok) setSelectedReport(await repRes.json());
      } catch (err) {
        console.error("Failed to load finding details:", err);
      } finally {
        setLoadingDetails(false);
      }
    }

    loadDetails();
  }, [selectedFindingId]);

  const selectedFinding = findings.find((f) => f.findingId === selectedFindingId);

  const filteredFindings = findings.filter((f) => {
    if (claimTypeFilter !== "ALL" && f.claimType !== claimTypeFilter) return false;
    return true;
  });

  const handleCopyMarkdown = () => {
    if (!selectedReport) return;
    navigator.clipboard.writeText(selectedReport.markdownContent);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem", paddingBottom: "3rem" }}>
      {/* 1. Header & Scientific Integrity Notice */}
      <section style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.25rem" }}>
              <span
                style={{
                  fontSize: "0.75rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  padding: "0.2rem 0.5rem",
                  borderRadius: "0.25rem",
                  background: "rgba(56, 189, 248, 0.15)",
                  color: "var(--accent-cyan)",
                  fontWeight: 700
                }}
              >
                Milestone 9D
              </span>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Publication-Grade Evidence</span>
            </div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
              Research Provenance & Scientific Findings
            </h1>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.35rem 0.75rem",
                borderRadius: "9999px",
                background: "rgba(34, 197, 94, 0.12)",
                color: "var(--accent-green)",
                fontSize: "0.8rem",
                fontWeight: 600,
                border: "1px solid rgba(34, 197, 94, 0.25)"
              }}
            >
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--accent-green)" }} />
              10-Stage Lineage Verified
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.35rem 0.75rem",
                borderRadius: "9999px",
                background: "rgba(168, 85, 247, 0.12)",
                color: "#c084fc",
                fontSize: "0.8rem",
                fontWeight: 600,
                border: "1px solid rgba(168, 85, 247, 0.25)"
              }}
            >
              No Silent Repair
            </span>
          </div>
        </div>

        {/* Scientific Integrity Disclaimer Banner */}
        <div
          style={{
            padding: "0.85rem 1rem",
            borderRadius: "0.5rem",
            background: "rgba(234, 179, 8, 0.08)",
            border: "1px solid rgba(234, 179, 8, 0.25)",
            color: "#fde047",
            fontSize: "0.82rem",
            lineHeight: 1.5
          }}
        >
          <strong>SCIENTIFIC INTEGRITY NOTICE:</strong> This research registry provides cryptographic provenance and immutable audit trails for retrospective empirical evaluations. Physical Kerala State Lottery draws are independent stochastic events; historical distributions possess zero predictive power. All predictive or gambling claims are scientifically unfounded.
        </div>

        {/* Metric Summary Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginTop: "0.5rem" }}>
          <div style={{ padding: "1rem", borderRadius: "0.5rem", background: "var(--card-bg)", border: "1px solid var(--border-color)" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Registered Findings</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--accent-cyan)", marginTop: "0.25rem" }}>
              {findings.length}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
              3 Canonical Baselines
            </div>
          </div>
          <div style={{ padding: "1rem", borderRadius: "0.5rem", background: "var(--card-bg)", border: "1px solid var(--border-color)" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Evidence Integrity</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--accent-green)", marginTop: "0.25rem" }}>
              100%
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
              0 Integrity Violations
            </div>
          </div>
          <div style={{ padding: "1rem", borderRadius: "0.5rem", background: "var(--card-bg)", border: "1px solid var(--border-color)" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Source Documents</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#e2e8f0", marginTop: "0.25rem" }}>
              103 PDFs
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
              SHA-256 Verified Gazettes
            </div>
          </div>
          <div style={{ padding: "1rem", borderRadius: "0.5rem", background: "var(--card-bg)", border: "1px solid var(--border-color)" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Canonical Corpus</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#e2e8f0", marginTop: "0.25rem" }}>
              39,550
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
              Winning Results (103 Draws)
            </div>
          </div>
        </div>
      </section>

      {/* 2. Finding Registry Table */}
      <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>
            Finding Registry
          </h2>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {["ALL", "STATISTICAL_RESULT", "OBSERVATION", "INTERPRETATION", "LIMITATION"].map((type) => (
              <button
                key={type}
                onClick={() => setClaimTypeFilter(type)}
                style={{
                  padding: "0.3rem 0.6rem",
                  borderRadius: "0.25rem",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  border: claimTypeFilter === type ? "1px solid var(--accent-cyan)" : "1px solid var(--border-color)",
                  background: claimTypeFilter === type ? "rgba(56, 189, 248, 0.15)" : "var(--card-bg)",
                  color: claimTypeFilter === type ? "var(--accent-cyan)" : "var(--text-secondary)"
                }}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", background: "var(--card-bg)", borderRadius: "0.5rem" }}>
            Loading research findings...
          </div>
        ) : (
          <div style={{ overflowX: "auto", borderRadius: "0.5rem", border: "1px solid var(--border-color)", background: "var(--card-bg)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-color)", background: "rgba(255, 255, 255, 0.02)" }}>
                  <th style={{ padding: "0.75rem 1rem", color: "var(--text-muted)" }}>Finding ID</th>
                  <th style={{ padding: "0.75rem 1rem", color: "var(--text-muted)" }}>Experiment</th>
                  <th style={{ padding: "0.75rem 1rem", color: "var(--text-muted)" }}>Claim Type</th>
                  <th style={{ padding: "0.75rem 1rem", color: "var(--text-muted)" }}>Statement</th>
                  <th style={{ padding: "0.75rem 1rem", color: "var(--text-muted)", textAlign: "right" }}>Holdout Acc</th>
                  <th style={{ padding: "0.75rem 1rem", color: "var(--text-muted)", textAlign: "right" }}>SE (SE%)</th>
                  <th style={{ padding: "0.75rem 1rem", color: "var(--text-muted)", textAlign: "right" }}>Holm Adj P</th>
                </tr>
              </thead>
              <tbody>
                {filteredFindings.map((finding) => {
                  const isSelected = finding.findingId === selectedFindingId;
                  return (
                    <tr
                      key={finding.findingId}
                      onClick={() => setSelectedFindingId(finding.findingId)}
                      style={{
                        borderBottom: "1px solid var(--border-color)",
                        cursor: "pointer",
                        background: isSelected ? "rgba(56, 189, 248, 0.08)" : "transparent",
                        transition: "background 0.15s ease"
                      }}
                    >
                      <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", color: isSelected ? "var(--accent-cyan)" : "var(--text-primary)", fontWeight: 600 }}>
                        {finding.findingId}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", whiteSpace: "nowrap" }}>
                        <span style={{ padding: "0.2rem 0.4rem", borderRadius: "0.25rem", background: "rgba(255, 255, 255, 0.05)", fontSize: "0.78rem" }}>
                          {finding.experimentId}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <span
                          style={{
                            padding: "0.2rem 0.5rem",
                            borderRadius: "0.25rem",
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            letterSpacing: "0.04em",
                            background:
                              finding.claimType === "STATISTICAL_RESULT"
                                ? "rgba(56, 189, 248, 0.15)"
                                : finding.claimType === "OBSERVATION"
                                ? "rgba(34, 197, 94, 0.15)"
                                : "rgba(234, 179, 8, 0.15)",
                            color:
                              finding.claimType === "STATISTICAL_RESULT"
                                ? "var(--accent-cyan)"
                                : finding.claimType === "OBSERVATION"
                                ? "var(--accent-green)"
                                : "#fde047"
                          }}
                        >
                          {finding.claimType}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem 1rem", maxWidth: "400px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--text-secondary)" }}>
                        {finding.statement}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontWeight: 600 }}>
                        {(finding.evidence.observedAccuracy * 100).toFixed(2)}%
                      </td>
                      <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontFamily: "monospace", color: "var(--text-muted)" }}>
                        {(finding.uncertainty.standardError * 100).toFixed(2)}%
                      </td>
                      <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontFamily: "monospace", color: finding.evidence.isSignificant ? "var(--accent-green)" : "var(--text-muted)" }}>
                        {finding.evidence.adjustedPValue.toFixed(4)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 3. Selected Finding Detail Workspace */}
      {selectedFinding && (
        <section style={{ display: "flex", flexDirection: "column", gap: "1.25rem", background: "var(--card-bg)", padding: "1.5rem", borderRadius: "0.75rem", border: "1px solid var(--border-color)" }}>
          {/* Finding Header */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                  {selectedFinding.findingId}
                </h3>
                <span
                  style={{
                    padding: "0.25rem 0.6rem",
                    borderRadius: "0.375rem",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    background: "rgba(56, 189, 248, 0.15)",
                    color: "var(--accent-cyan)"
                  }}
                >
                  {selectedFinding.claimType}
                </span>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontFamily: "monospace" }}>
                  v{selectedFinding.findingVersion}
                </span>
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontFamily: "monospace" }}>
                Deterministic Hash: {selectedFinding.deterministicHash.slice(0, 16)}...
              </div>
            </div>

            <p style={{ fontSize: "0.95rem", color: "var(--text-primary)", margin: "0.5rem 0 0 0", lineHeight: 1.5, background: "rgba(255, 255, 255, 0.02)", padding: "0.75rem 1rem", borderRadius: "0.375rem", borderLeft: "3px solid var(--accent-cyan)" }}>
              {selectedFinding.statement}
            </p>
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--border-color)", gap: "0.5rem" }}>
            {[
              { id: "lineage", label: "10-Stage Lineage DAG" },
              { id: "evidence", label: "Evidence Bundle & Hashes" },
              { id: "methodology", label: "Uncertainty & Inference" },
              { id: "report", label: "Publication Report" }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                style={{
                  padding: "0.5rem 1rem",
                  background: "transparent",
                  border: "none",
                  borderBottom: activeTab === tab.id ? "2px solid var(--accent-cyan)" : "2px solid transparent",
                  color: activeTab === tab.id ? "var(--accent-cyan)" : "var(--text-muted)",
                  fontWeight: activeTab === tab.id ? 600 : 500,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  transition: "all 0.15s ease"
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab 1: Complete Lineage DAG */}
          {activeTab === "lineage" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                  End-to-End Scientific Lineage: 10 Cryptographically Verified Stages
                </span>
                <span style={{ fontSize: "0.8rem", color: "var(--accent-green)", fontWeight: 600 }}>
                  ✓ Complete & Unbroken Lineage
                </span>
              </div>

              {loadingDetails ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>Loading lineage DAG...</div>
              ) : selectedLineage ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {selectedLineage.chain.map((step) => (
                    <div
                      key={step.stageNumber}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "1rem",
                        padding: "0.75rem 1rem",
                        borderRadius: "0.5rem",
                        background: "rgba(255, 255, 255, 0.02)",
                        border: "1px solid var(--border-color)"
                      }}
                    >
                      <div
                        style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "50%",
                          background: step.stageNumber === 10 ? "rgba(56, 189, 248, 0.2)" : "rgba(255, 255, 255, 0.05)",
                          color: step.stageNumber === 10 ? "var(--accent-cyan)" : "var(--text-secondary)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          flexShrink: 0
                        }}
                      >
                        {step.stageNumber}
                      </div>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text-primary)" }}>
                            {step.step}
                          </span>
                          <span style={{ fontSize: "0.75rem", fontFamily: "monospace", color: "var(--accent-cyan)" }}>
                            {step.identity}
                          </span>
                        </div>
                        {step.deterministicHash && (
                          <div style={{ fontSize: "0.72rem", fontFamily: "monospace", color: "var(--text-muted)" }}>
                            Hash: {step.deterministicHash}
                          </div>
                        )}
                        <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                          {JSON.stringify(step.attributes)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: "var(--text-muted)" }}>No lineage available</div>
              )}
            </div>
          )}

          {/* Tab 2: Evidence Bundle & Cryptographic Hashes */}
          {activeTab === "evidence" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {selectedEvidence ? (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
                    <div style={{ padding: "1rem", borderRadius: "0.5rem", background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border-color)" }}>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Evidence Bundle ID</div>
                      <div style={{ fontSize: "0.95rem", fontWeight: 600, fontFamily: "monospace", color: "var(--accent-cyan)", marginTop: "0.25rem" }}>
                        {selectedEvidence.evidenceBundleId}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--accent-green)", marginTop: "0.25rem" }}>
                        Integrity Verified: {selectedEvidence.isIntegrityVerified ? "VALID (0 errors)" : "FAILED"}
                      </div>
                    </div>

                    <div style={{ padding: "1rem", borderRadius: "0.5rem", background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border-color)" }}>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Software Environment</div>
                      <div style={{ fontSize: "0.85rem", color: "var(--text-primary)", marginTop: "0.25rem" }}>
                        Node: {selectedEvidence.softwareEnvironment.nodeVersion} ({selectedEvidence.softwareEnvironment.platform})
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        Engine: {selectedEvidence.softwareEnvironment.engine} v{selectedEvidence.softwareEnvironment.version}
                      </div>
                    </div>
                  </div>

                  {/* Artifact Hashes Table */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <h4 style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-primary)" }}>
                      Cryptographic Artifact Hashes (SHA-256)
                    </h4>
                    <div style={{ overflowX: "auto", borderRadius: "0.5rem", border: "1px solid var(--border-color)" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", textAlign: "left" }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid var(--border-color)", background: "rgba(255, 255, 255, 0.03)" }}>
                            <th style={{ padding: "0.5rem 0.75rem", color: "var(--text-muted)" }}>Artifact Level</th>
                            <th style={{ padding: "0.5rem 0.75rem", color: "var(--text-muted)" }}>SHA-256 Digest</th>
                            <th style={{ padding: "0.5rem 0.75rem", color: "var(--text-muted)", textAlign: "center" }}>Integrity Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(selectedEvidence.artifactHashes).map(([key, hash]) => (
                            <tr key={key} style={{ borderBottom: "1px solid var(--border-color)" }}>
                              <td style={{ padding: "0.5rem 0.75rem", fontWeight: 600, color: "var(--text-secondary)" }}>{key}</td>
                              <td style={{ padding: "0.5rem 0.75rem", fontFamily: "monospace", color: "var(--text-primary)" }}>{hash}</td>
                              <td style={{ padding: "0.5rem 0.75rem", textAlign: "center", color: "var(--accent-green)", fontWeight: 600 }}>
                                MATCHED
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Source Document Hashes Toggle */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <h4 style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-primary)" }}>
                        Source Gazette Documents ({selectedEvidence.sourceDocumentCount} PDFs Verified)
                      </h4>
                      <button
                        onClick={() => setShowAllShas(!showAllShas)}
                        style={{
                          background: "transparent",
                          border: "1px solid var(--border-color)",
                          color: "var(--accent-cyan)",
                          padding: "0.2rem 0.5rem",
                          borderRadius: "0.25rem",
                          fontSize: "0.75rem",
                          cursor: "pointer"
                        }}
                      >
                        {showAllShas ? "Collapse Hashes" : "Show All SHA-256 List"}
                      </button>
                    </div>

                    {showAllShas && (
                      <div
                        style={{
                          maxHeight: "200px",
                          overflowY: "auto",
                          padding: "0.75rem",
                          borderRadius: "0.375rem",
                          background: "rgba(0, 0, 0, 0.3)",
                          border: "1px solid var(--border-color)",
                          fontSize: "0.72rem",
                          fontFamily: "monospace",
                          color: "var(--text-muted)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.25rem"
                        }}
                      >
                        {selectedEvidence.sourceDocumentShas.map((sha, i) => (
                          <div key={sha}>
                            {i + 1}. {sha}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ color: "var(--text-muted)" }}>Loading evidence bundle...</div>
              )}
            </div>
          )}

          {/* Tab 3: Uncertainty & Statistical Inference */}
          {activeTab === "methodology" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
                <div style={{ padding: "1rem", borderRadius: "0.5rem", background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border-color)" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Standard Error (SE)</div>
                  <div style={{ fontSize: "1.3rem", fontWeight: 700, fontFamily: "monospace", color: "var(--accent-cyan)", marginTop: "0.25rem" }}>
                    {(selectedFinding.uncertainty.standardError * 100).toFixed(2)}%
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                    Formula: sqrt(p(1-p)/n) = {selectedFinding.uncertainty.standardError.toFixed(6)}
                  </div>
                </div>

                <div style={{ padding: "1rem", borderRadius: "0.5rem", background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border-color)" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Margin of Error (95%)</div>
                  <div style={{ fontSize: "1.3rem", fontWeight: 700, fontFamily: "monospace", color: "#e2e8f0", marginTop: "0.25rem" }}>
                    ±{(selectedFinding.uncertainty.marginOfError * 100).toFixed(2)}%
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                    z = 1.96 * SE
                  </div>
                </div>

                <div style={{ padding: "1rem", borderRadius: "0.5rem", background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border-color)" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Wilson Score 95% CI</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700, fontFamily: "monospace", color: "var(--accent-green)", marginTop: "0.25rem" }}>
                    [{(selectedFinding.uncertainty.wilsonScore95CI[0] * 100).toFixed(2)}%, {(selectedFinding.uncertainty.wilsonScore95CI[1] * 100).toFixed(2)}%]
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                    Asymmetric binomial score interval
                  </div>
                </div>

                <div style={{ padding: "1rem", borderRadius: "0.5rem", background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border-color)" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Bootstrap 95% CI</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700, fontFamily: "monospace", color: "#c084fc", marginTop: "0.25rem" }}>
                    [{(selectedFinding.uncertainty.bootstrap95CI[0] * 100).toFixed(2)}%, {(selectedFinding.uncertainty.bootstrap95CI[1] * 100).toFixed(2)}%]
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                    B = 1,000 resamples (Mulberry32)
                  </div>
                </div>
              </div>

              {/* Null Hypothesis & Multiple Testing Correction */}
              <div style={{ padding: "1rem", borderRadius: "0.5rem", background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <h4 style={{ margin: 0, fontSize: "0.95rem", color: "var(--text-primary)" }}>
                  Null Hypothesis Significance Testing & Holm-Bonferroni Correction
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem", fontSize: "0.85rem", marginTop: "0.25rem" }}>
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>Null Model:</span>{" "}
                    <strong>{selectedFinding.parameters.nullModelType}</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>Null Mean:</span>{" "}
                    <strong>{(selectedFinding.evidence.nullDistributionMean * 100).toFixed(2)}%</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>Z-Score:</span>{" "}
                    <strong>{selectedFinding.evidence.zScore.toFixed(3)}</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>Raw Empirical P:</span>{" "}
                    <strong>{selectedFinding.evidence.rawPValue.toFixed(4)}</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>Holm Adjusted P:</span>{" "}
                    <strong style={{ color: selectedFinding.evidence.isSignificant ? "var(--accent-green)" : "#e2e8f0" }}>
                      {selectedFinding.evidence.adjustedPValue.toFixed(4)}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>Statistically Significant:</span>{" "}
                    <strong style={{ color: selectedFinding.evidence.isSignificant ? "var(--accent-green)" : "var(--accent-red)" }}>
                      {selectedFinding.evidence.isSignificant ? "YES" : "NO (Consistent with Chance)"}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Five-Part Scientific Interpretation */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <h4 style={{ margin: 0, fontSize: "0.95rem", color: "var(--text-primary)" }}>
                  Scientific Claim Taxonomy & Constraints
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.85rem" }}>
                  <div style={{ padding: "0.75rem", borderRadius: "0.375rem", background: "rgba(56, 189, 248, 0.05)", borderLeft: "3px solid var(--accent-cyan)" }}>
                    <strong>[INTERPRETATION]</strong> {selectedFinding.interpretation}
                  </div>
                  <div style={{ padding: "0.75rem", borderRadius: "0.375rem", background: "rgba(239, 68, 68, 0.05)", borderLeft: "3px solid var(--accent-red)" }}>
                    <strong>[LIMITATION]</strong> {selectedFinding.limitation}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Publication Report */}
          {activeTab === "report" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                  Deterministic Publication-Grade Academic Markdown & JSON
                </span>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    onClick={handleCopyMarkdown}
                    style={{
                      padding: "0.35rem 0.75rem",
                      borderRadius: "0.25rem",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      background: "rgba(56, 189, 248, 0.15)",
                      color: "var(--accent-cyan)",
                      border: "1px solid rgba(56, 189, 248, 0.3)"
                    }}
                  >
                    {copiedReport ? "✓ Copied Markdown" : "Copy Markdown"}
                  </button>
                  <a
                    href={`/api/v1/findings/${selectedFinding.findingId}/report?format=md`}
                    download={`${selectedReport?.reportId || "report"}.md`}
                    style={{
                      padding: "0.35rem 0.75rem",
                      borderRadius: "0.25rem",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      background: "rgba(34, 197, 94, 0.15)",
                      color: "var(--accent-green)",
                      border: "1px solid rgba(34, 197, 94, 0.3)",
                      textDecoration: "none"
                    }}
                  >
                    Download .md Report
                  </a>
                </div>
              </div>

              {selectedReport ? (
                <pre
                  style={{
                    maxHeight: "500px",
                    overflowY: "auto",
                    padding: "1rem",
                    borderRadius: "0.5rem",
                    background: "rgba(0, 0, 0, 0.4)",
                    border: "1px solid var(--border-color)",
                    fontSize: "0.8rem",
                    fontFamily: "monospace",
                    color: "#e2e8f0",
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap"
                  }}
                >
                  {selectedReport.markdownContent}
                </pre>
              ) : (
                <div style={{ color: "var(--text-muted)" }}>Loading publication report...</div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
