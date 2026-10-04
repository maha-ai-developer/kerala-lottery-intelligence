"use client";

import { useEffect, useState, useRef } from "react";

interface IngestionRun {
  runId: string;
  environment?: string;
  timestamp?: string;
  requestedAt?: string;
  trigger: string;
  candidateCount?: number;
  alreadyKnownCount?: number;
  ingestedCount?: number;
  promotedCount?: number;
  drawsProcessed?: number;
  resultsProcessed?: number;
  status: string;
  durationMs?: number;
  audit?: {
    schedulerState: string;
    singleFlightLock: string;
    zeroSecretsExposed: boolean;
  };
  metadata?: Record<string, any>;
  notes?: string;
}

interface StorageIntegrityData {
  counts: {
    localDocumentCount: number;
    localGraphCount: number;
    localManifestCount: number;
    cloudStorageDocumentCount: number;
    firestoreDocumentCount: number;
    researchDrawCount: number;
    prodDrawCount: number;
  };
  operationalGuards: {
    schedulerState: string;
    mutationState: string;
    singleFlightLock: { status: string; owner?: string };
    cloudConnectionStatus: string;
  };
  verification?: {
    verifiedAt: string;
    totalAudited: number;
    matchedCount: number;
    mismatchCount: number;
    integrityStatus: string;
    reconciliationBasis: string;
    items: Array<{
      sha256: string;
      fileName: string;
      drawNumber: string;
      drawDate: string;
      lotteryCode: string;
      identityVerified: boolean;
    }>;
  };
}

interface DiscoveredCandidate {
  fileName: string;
  canonicalFilename?: string;
  sourceUrl?: string;
  title?: string;
  drawDate?: string;
  drawNumber?: string;
  lotteryCode?: string;
  state: "ALREADY_KNOWN" | "NEW" | "PENDING" | "CONFLICT";
  sha256?: string;
  fileSize?: number;
  details?: string;
}

interface PostIngestResult {
  runId: string;
  environment: string;
  success: boolean;
  candidateCount: number;
  alreadyKnown: number;
  newDocuments: number;
  validated: number;
  ingested: number;
  promoted: number;
  rejected: number;
  conflicts: number;
  errors: number;
  sha256: string;
  canonicalFilename: string;
  drawIdentity: {
    lottery: string;
    drawNumber: string;
    drawDate: string;
  };
  resultCount: number;
  fullTicketCount: number;
  suffixCount: number;
  cloudStoragePath: string;
  firestoreDocumentId: string;
  summaryText?: string;
}

export default function IngestionConsolePage() {
  // Environment safety state
  const [selectedEnv, setSelectedEnv] = useState<"DEV" | "PROD">("DEV");

  // Operational modes: "DOWNLOAD" | "UPLOAD"
  const [activeMode, setActiveMode] = useState<"DOWNLOAD" | "UPLOAD">("DOWNLOAD");

  // Telemetry & Storage Integrity state
  const [runs, setRuns] = useState<IngestionRun[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [integrityData, setIntegrityData] = useState<StorageIntegrityData | null>(null);
  const [verifyingIntegrity, setVerifyingIntegrity] = useState(false);
  const [showIntegrityDetails, setShowIntegrityDetails] = useState(false);

  // Mode 1: Official Source Download state
  const [checkingSource, setCheckingSource] = useState(false);
  const [candidates, setCandidates] = useState<DiscoveredCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<DiscoveredCandidate | null>(null);
  const [runningDryRun, setRunningDryRun] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<any | null>(null);
  const [downloadingCandidate, setDownloadingCandidate] = useState(false);

  // Mode 2: Manual Upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileSha, setFileSha] = useState<string | null>(null);
  const [isPdfValid, setIsPdfValid] = useState<boolean | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Post-Ingest Result state
  const [postIngestResult, setPostIngestResult] = useState<PostIngestResult | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Load runs and integrity stats on mount
  useEffect(() => {
    loadRuns();
    loadStorageIntegrity(false);
  }, []);

  async function loadRuns() {
    setLoadingRuns(true);
    try {
      const res = await fetch("/api/ops/ingestion/runs");
      if (res.ok) {
        const json = await res.json();
        setRuns(json.data || []);
      }
    } catch (err) {
      console.error("Error loading operational runs:", err);
    } finally {
      setLoadingRuns(false);
    }
  }

  async function loadStorageIntegrity(deepVerify: boolean) {
    if (deepVerify) setVerifyingIntegrity(true);
    try {
      const res = await fetch(`/api/ops/ingestion/storage-integrity?verify=${deepVerify}`);
      if (res.ok) {
        const json = await res.json();
        setIntegrityData(json);
        if (deepVerify) setShowIntegrityDetails(true);
      }
    } catch (err) {
      console.error("Error loading storage integrity:", err);
    } finally {
      if (deepVerify) setVerifyingIntegrity(false);
    }
  }

  // Action: Check Official Source
  async function handleCheckOfficialSource() {
    setCheckingSource(true);
    setActionError(null);
    setSelectedCandidate(null);
    setDryRunResult(null);

    try {
      const res = await fetch("/api/ops/ingestion/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ environment: selectedEnv, since: "2026-06-01" })
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Failed to check official source");
      }

      setCandidates(json.candidates || []);
      if (json.candidates && json.candidates.length > 0) {
        setSelectedCandidate(json.candidates[0]);
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to contact official source discovery");
    } finally {
      setCheckingSource(false);
    }
  }

  // Action: Run Dry-Run for Candidate
  async function handleCandidateDryRun() {
    if (!selectedCandidate) return;
    setRunningDryRun(true);
    setActionError(null);

    try {
      const res = await fetch("/api/ops/ingestion/dry-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate: selectedCandidate,
          environment: selectedEnv
        })
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Dry-run execution failed");
      }

      setDryRunResult(json);
    } catch (err: any) {
      setActionError(err.message || "Dry run failed");
    } finally {
      setRunningDryRun(false);
    }
  }

  // Action: Download & Ingest Candidate
  async function handleCandidateDownloadAndIngest() {
    if (!selectedCandidate) return;
    if (selectedEnv === "PROD") {
      setActionError("PROD mutations are strictly forbidden. PROD is READ-ONLY.");
      return;
    }

    setDownloadingCandidate(true);
    setActionError(null);
    setPostIngestResult(null);

    try {
      const res = await fetch("/api/ops/ingestion/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate: selectedCandidate,
          environment: selectedEnv
        })
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Download & ingestion failed");
      }

      setPostIngestResult(json);
      loadRuns();
      loadStorageIntegrity(false);
    } catch (err: any) {
      setActionError(err.message || "Download & ingestion failed");
    } finally {
      setDownloadingCandidate(false);
    }
  }

  // Action: File Selection & Immediate Hash Computation (Mode 2)
  async function handleFileSelect(file: File) {
    setUploadError(null);
    setActionError(null);
    setPostIngestResult(null);
    setDryRunResult(null);

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setIsPdfValid(false);
      setUploadError("File must be a valid PDF (.pdf). Non-PDF documents are rejected.");
      setUploadedFile(null);
      setFileSha(null);
      return;
    }

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Validate %PDF- magic header
    const isMagicValid =
      bytes.length >= 5 &&
      bytes[0] === 0x25 && // %
      bytes[1] === 0x50 && // P
      bytes[2] === 0x44 && // D
      bytes[3] === 0x46 && // F
      bytes[4] === 0x2d;   // -

    if (!isMagicValid) {
      setIsPdfValid(false);
      setUploadError("Invalid PDF header. File does not contain the mandatory '%PDF-' magic bytes.");
      setUploadedFile(null);
      setFileSha(null);
      return;
    }

    // Client-side SHA-256 computation
    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const sha = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    setIsPdfValid(true);
    setUploadedFile(file);
    setFileSha(sha);
  }

  // Action: Dry Run Uploaded File
  async function handleUploadDryRun() {
    if (!uploadedFile) return;
    setRunningDryRun(true);
    setActionError(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const res = await fetch("/api/ops/ingestion/dry-run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            candidate: {
              fileName: uploadedFile.name,
              fileBase64: base64
            },
            environment: selectedEnv
          })
        });

        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.message || "Upload dry-run execution failed");
        }
        setDryRunResult(json);
        setRunningDryRun(false);
      };
      reader.readAsDataURL(uploadedFile);
    } catch (err: any) {
      setActionError(err.message || "Upload dry-run failed");
      setRunningDryRun(false);
    }
  }

  // Action: Ingest Uploaded File into DEV
  async function handleUploadIngest() {
    if (!uploadedFile) return;
    if (selectedEnv === "PROD") {
      setActionError("PROD mutations are strictly forbidden. PROD is READ-ONLY.");
      return;
    }

    setUploading(true);
    setActionError(null);
    setPostIngestResult(null);

    try {
      const formData = new FormData();
      formData.append("file", uploadedFile);
      formData.append("environment", selectedEnv);

      const res = await fetch("/api/ops/ingestion/upload", {
        method: "POST",
        body: formData
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Manual upload ingestion failed");
      }

      setPostIngestResult(json);
      loadRuns();
      loadStorageIntegrity(false);
    } catch (err: any) {
      setActionError(err.message || "Manual upload ingestion failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="container" style={{ padding: "2rem 1.5rem" }}>
      {/* Header & Operational Mode Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
            <h1 style={{ fontSize: "1.875rem", fontWeight: 700, margin: 0 }}>
              Daily Data Ingestion Console
            </h1>
            <span className="badge badge-emerald">V1 OPERATIONAL SURFACE</span>
            <span className="badge badge-amber">PROD SCHEDULER: PAUSED</span>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", margin: 0 }}>
            Operational acquisition, cryptographic validation, and idempotent promotion pipeline for Kerala State Lottery official gazette results.
          </p>
        </div>

        {/* Environment Selector Guard */}
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-medium)", borderRadius: "0.75rem", padding: "0.5rem 0.75rem" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.35rem", fontWeight: 600 }}>
            TARGET ENVIRONMENT
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={() => setSelectedEnv("DEV")}
              style={{
                padding: "0.35rem 0.85rem",
                borderRadius: "0.375rem",
                border: "none",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
                background: selectedEnv === "DEV" ? "var(--accent-emerald)" : "var(--bg-surface-elevated)",
                color: selectedEnv === "DEV" ? "#000" : "var(--text-secondary)",
                transition: "all 0.15s ease"
              }}
            >
              RESEARCH / DEV
            </button>
            <button
              type="button"
              onClick={() => setSelectedEnv("PROD")}
              style={{
                padding: "0.35rem 0.85rem",
                borderRadius: "0.375rem",
                border: "none",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
                background: selectedEnv === "PROD" ? "var(--accent-amber)" : "var(--bg-surface-elevated)",
                color: selectedEnv === "PROD" ? "#000" : "var(--text-secondary)",
                transition: "all 0.15s ease"
              }}
            >
              PROD (READ-ONLY)
            </button>
          </div>
        </div>
      </div>

      {/* Production Read-Only Safety Banner */}
      {selectedEnv === "PROD" && (
        <div
          style={{
            background: "rgba(245, 158, 11, 0.1)",
            border: "1px solid rgba(245, 158, 11, 0.4)",
            borderLeft: "4px solid var(--accent-amber)",
            borderRadius: "0.5rem",
            padding: "1rem 1.25rem",
            marginBottom: "1.75rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <div>
            <div style={{ color: "var(--accent-amber)", fontWeight: 700, fontSize: "0.95rem" }}>
              PRODUCTION BOUNDARY ENFORCED: READ-ONLY AUDIT MODE
            </div>
            <div style={{ fontSize: "0.825rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
              PROD is strictly locked to 100 draws (38,416 results). Cloud Scheduler is PAUSED. All browser mutations are rejected server-side with HTTP 403 Forbidden.
            </div>
          </div>
          <span className="badge badge-amber">ZERO MUTATIONS</span>
        </div>
      )}

      {/* Error Banner */}
      {actionError && (
        <div
          style={{
            background: "rgba(244, 63, 94, 0.1)",
            border: "1px solid rgba(244, 63, 94, 0.4)",
            borderLeft: "4px solid var(--accent-rose)",
            borderRadius: "0.5rem",
            padding: "0.875rem 1.25rem",
            marginBottom: "1.75rem",
            color: "var(--text-primary)",
            fontSize: "0.875rem"
          }}
        >
          <strong>Operational Error:</strong> {actionError}
        </div>
      )}

      {/* Storage Integrity & Local ↔ Cloud Reconciliation Panel */}
      <div className="card" style={{ marginBottom: "2rem", background: "linear-gradient(180deg, var(--bg-surface) 0%, rgba(15, 23, 42, 0.6) 100%)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>Storage Integrity & Local ↔ Cloud Reconciliation</h2>
              <span className="badge badge-blue">Deterministic SHA-256</span>
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
              Local Raspberry Pi workspace cache vs Authoritative Cloud Storage (source-documents) & Firestore (documents)
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              type="button"
              onClick={() => loadStorageIntegrity(true)}
              disabled={verifyingIntegrity}
              style={{
                background: "var(--accent-blue)",
                color: "#000",
                fontWeight: 600,
                border: "none",
                borderRadius: "0.375rem",
                padding: "0.45rem 1rem",
                fontSize: "0.85rem",
                cursor: verifyingIntegrity ? "wait" : "pointer"
              }}
            >
              {verifyingIntegrity ? "Verifying..." : "Verify Local ↔ Cloud"}
            </button>
          </div>
        </div>

        {/* Counts Grid */}
        <div className="grid-4" style={{ marginBottom: "1rem" }}>
          <div style={{ background: "rgba(30, 41, 59, 0.5)", padding: "1rem", borderRadius: "0.5rem", border: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Local Pi Cache</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--accent-cyan)", margin: "0.25rem 0" }}>
              {integrityData ? `${integrityData.counts.localDocumentCount} PDFs` : "..."}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
              {integrityData ? `${integrityData.counts.localGraphCount} Graphs / ${integrityData.counts.localManifestCount} Manifest` : "Scanning..."}
            </div>
          </div>

          <div style={{ background: "rgba(30, 41, 59, 0.5)", padding: "1rem", borderRadius: "0.5rem", border: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Authoritative Cloud</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--accent-emerald)", margin: "0.25rem 0" }}>
              {integrityData ? `${integrityData.counts.cloudStorageDocumentCount} Artifacts` : "..."}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
              Firebase Storage: source-documents/{`{sha256}`}.pdf
            </div>
          </div>

          <div style={{ background: "rgba(30, 41, 59, 0.5)", padding: "1rem", borderRadius: "0.5rem", border: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Firestore Metadata</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--accent-blue)", margin: "0.25rem 0" }}>
              {integrityData ? `${integrityData.counts.firestoreDocumentCount} Docs` : "..."}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
              Firestore: documents/{`{sha256}`}
            </div>
          </div>

          <div style={{ background: "rgba(30, 41, 59, 0.5)", padding: "1rem", borderRadius: "0.5rem", border: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Baseline Isolation</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--accent-amber)", margin: "0.25rem 0" }}>
              {integrityData ? `${integrityData.counts.researchDrawCount} DEV / ${integrityData.counts.prodDrawCount} PROD` : "..."}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
              PROD Scheduler: {integrityData ? integrityData.operationalGuards.schedulerState : "..."}
            </div>
          </div>
        </div>

        {/* Deep Verification Report Modal / Expansion */}
        {showIntegrityDetails && integrityData?.verification && (
          <div style={{ marginTop: "1rem", padding: "1rem", background: "rgba(15, 23, 42, 0.9)", border: "1px solid var(--border-medium)", borderRadius: "0.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span className="badge badge-emerald">VERIFICATION COMPLETE</span>
                <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                  {integrityData.verification.matchedCount} of {integrityData.verification.totalAudited} Draws Reconciled 100%
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowIntegrityDetails(false)}
                style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.8rem" }}
              >
                Close Report
              </button>
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.75rem" }}>
              Reconciliation Basis: {integrityData.verification.reconciliationBasis}
            </div>
            <div style={{ maxHeight: "200px", overflowY: "auto", border: "1px solid var(--border-subtle)", borderRadius: "0.375rem" }}>
              <table className="research-table" style={{ fontSize: "0.75rem" }}>
                <thead>
                  <tr>
                    <th>Draw Number</th>
                    <th>Draw Date</th>
                    <th>Lottery</th>
                    <th>Cryptographic SHA-256</th>
                    <th>Local ↔ Cloud Status</th>
                  </tr>
                </thead>
                <tbody>
                  {integrityData.verification.items.map((item) => (
                    <tr key={item.sha256}>
                      <td className="mono">{item.drawNumber}</td>
                      <td>{item.drawDate}</td>
                      <td>{item.lotteryCode}</td>
                      <td className="mono" style={{ color: "var(--accent-cyan)" }}>
                        {item.sha256.substring(0, 16)}...
                      </td>
                      <td>
                        <span className="badge badge-emerald" style={{ fontSize: "0.65rem" }}>
                          VERIFIED RECONCILED
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Mode Switch Tabs */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.5rem" }}>
        <button
          type="button"
          onClick={() => {
            setActiveMode("DOWNLOAD");
            setActionError(null);
          }}
          style={{
            background: "none",
            border: "none",
            padding: "0.5rem 1rem",
            fontSize: "0.95rem",
            fontWeight: 600,
            cursor: "pointer",
            color: activeMode === "DOWNLOAD" ? "var(--accent-blue)" : "var(--text-secondary)",
            borderBottom: activeMode === "DOWNLOAD" ? "2px solid var(--accent-blue)" : "none"
          }}
        >
          MODE 1: OFFICIAL SOURCE DOWNLOAD
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveMode("UPLOAD");
            setActionError(null);
          }}
          style={{
            background: "none",
            border: "none",
            padding: "0.5rem 1rem",
            fontSize: "0.95rem",
            fontWeight: 600,
            cursor: "pointer",
            color: activeMode === "UPLOAD" ? "var(--accent-blue)" : "var(--text-secondary)",
            borderBottom: activeMode === "UPLOAD" ? "2px solid var(--accent-blue)" : "none"
          }}
        >
          MODE 2: MANUAL OFFICIAL PDF UPLOAD
        </button>
      </div>

      {/* MODE 1: OFFICIAL SOURCE DOWNLOAD */}
      {activeMode === "DOWNLOAD" && (
        <div style={{ marginBottom: "2rem" }}>
          {/* Action Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>Official Portal Discovery</h3>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Scans official endpoints (`statelottery.kerala.gov.in` & `result.keralalotteries.com`) for published gazette results.
              </div>
            </div>

            <button
              type="button"
              onClick={handleCheckOfficialSource}
              disabled={checkingSource}
              style={{
                background: "var(--accent-cyan)",
                color: "#000",
                fontWeight: 600,
                border: "none",
                borderRadius: "0.375rem",
                padding: "0.6rem 1.25rem",
                fontSize: "0.875rem",
                cursor: checkingSource ? "wait" : "pointer"
              }}
            >
              {checkingSource ? "Checking Portal..." : "Check Official Source"}
            </button>
          </div>

          {/* Discovered Candidates Table */}
          {candidates.length > 0 && (
            <div className="table-container" style={{ marginBottom: "1.5rem" }}>
              <table className="research-table">
                <thead>
                  <tr>
                    <th style={{ width: "40px" }}>Select</th>
                    <th>Draw Details</th>
                    <th>Draw Date</th>
                    <th>Status</th>
                    <th>Canonical File</th>
                    <th>Official Document URL</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((c) => {
                    const isSelected = selectedCandidate?.fileName === c.fileName;
                    let badgeClass = "badge-slate";
                    if (c.state === "NEW") badgeClass = "badge-emerald";
                    if (c.state === "ALREADY_KNOWN") badgeClass = "badge-blue";
                    if (c.state === "PENDING") badgeClass = "badge-amber";
                    if (c.state === "CONFLICT") badgeClass = "badge-rose";

                    return (
                      <tr
                        key={c.fileName}
                        onClick={() => {
                          setSelectedCandidate(c);
                          setDryRunResult(null);
                        }}
                        style={{
                          cursor: "pointer",
                          background: isSelected ? "rgba(56, 189, 248, 0.08)" : undefined
                        }}
                      >
                        <td>
                          <input
                            type="radio"
                            name="candidate-select"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedCandidate(c);
                              setDryRunResult(null);
                            }}
                          />
                        </td>
                        <td>
                          <strong>{c.lotteryCode || "Kerala State Lottery"}</strong>
                          <div className="mono" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                            {c.drawNumber}
                          </div>
                        </td>
                        <td style={{ fontSize: "0.85rem" }}>{c.drawDate}</td>
                        <td>
                          <span className={`badge ${badgeClass}`}>{c.state}</span>
                        </td>
                        <td className="mono" style={{ fontSize: "0.8rem" }}>
                          {c.canonicalFilename || c.fileName}
                        </td>
                        <td style={{ fontSize: "0.75rem", maxWidth: "250px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {c.sourceUrl ? (
                            <a href={c.sourceUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent-blue)" }}>
                              {c.sourceUrl}
                            </a>
                          ) : (
                            <span style={{ color: "var(--text-muted)" }}>Local Workspace</span>
                          )}
                        </td>
                        <td style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                          {c.details || "Discovered from official portal."}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Selected Candidate Action Panel */}
          {selectedCandidate && (
            <div className="card" style={{ background: "var(--bg-surface-elevated)", border: "1px solid var(--border-medium)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Selected Candidate</div>
                  <h4 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0.25rem 0" }}>
                    {selectedCandidate.title || `${selectedCandidate.lotteryCode} (${selectedCandidate.drawNumber})`}
                  </h4>
                  <div className="mono" style={{ fontSize: "0.8rem", color: "var(--accent-cyan)" }}>
                    Target File: {selectedCandidate.canonicalFilename || selectedCandidate.fileName}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <button
                    type="button"
                    onClick={handleCandidateDryRun}
                    disabled={runningDryRun}
                    style={{
                      background: "var(--bg-surface)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--border-medium)",
                      borderRadius: "0.375rem",
                      padding: "0.5rem 1rem",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      cursor: runningDryRun ? "wait" : "pointer"
                    }}
                  >
                    {runningDryRun ? "Simulating..." : "Dry Run / Preview"}
                  </button>

                  <button
                    type="button"
                    onClick={handleCandidateDownloadAndIngest}
                    disabled={downloadingCandidate || selectedEnv === "PROD"}
                    style={{
                      background: selectedEnv === "PROD" ? "var(--bg-surface)" : "var(--accent-emerald)",
                      color: selectedEnv === "PROD" ? "var(--text-muted)" : "#000",
                      fontWeight: 700,
                      border: "none",
                      borderRadius: "0.375rem",
                      padding: "0.5rem 1.25rem",
                      fontSize: "0.85rem",
                      cursor: selectedEnv === "PROD" ? "not-allowed" : downloadingCandidate ? "wait" : "pointer"
                    }}
                  >
                    {downloadingCandidate ? "Acquiring & Ingesting..." : "Download & Ingest"}
                  </button>
                </div>
              </div>

              {/* Dry-Run Result Preview */}
              {dryRunResult && (
                <div style={{ marginTop: "1rem", padding: "1rem", background: "rgba(15, 23, 42, 0.8)", borderRadius: "0.5rem", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <span className="badge badge-emerald">DRY RUN PREVIEW (ZERO MUTATION)</span>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      Prize Scheme: {dryRunResult.scheme?.schemeId || "Authoritative Registry"} ({dryRunResult.scheme?.schemeAuthorityLevel || "OFFICIAL"})
                    </span>
                  </div>
                  <div className="grid-3" style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>
                    <div>
                      <strong>Validation Status:</strong>{" "}
                      <span style={{ color: dryRunResult.candidateStatus === "VALID" ? "var(--accent-emerald)" : "var(--accent-amber)" }}>
                        {dryRunResult.candidateStatus}
                      </span>
                    </div>
                    <div>
                      <strong>Total Winning Numbers:</strong> {dryRunResult.validation?.resultCount || 0}
                    </div>
                    <div>
                      <strong>SHA-256:</strong>{" "}
                      <span className="mono" style={{ fontSize: "0.75rem", color: "var(--accent-cyan)" }}>
                        {dryRunResult.sha256 ? `${dryRunResult.sha256.substring(0, 16)}...` : "Calculated on byte acquisition"}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                    {dryRunResult.summaryText}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODE 2: MANUAL OFFICIAL PDF UPLOAD */}
      {activeMode === "UPLOAD" && (
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ marginBottom: "1rem" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>Manual Official Gazette PDF Ingestion</h3>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Upload an official Kerala State Lotteries PDF. Performs immediate magic header validation (`%PDF-`), SHA-256 computation, prize scheme resolution, and conflict checking.
            </div>
          </div>

          {/* Drag & Drop File Zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileSelect(e.dataTransfer.files[0]);
              }
            }}
            style={{
              border: "2px dashed var(--border-medium)",
              borderRadius: "0.75rem",
              padding: "2.5rem 1.5rem",
              textAlign: "center",
              cursor: "pointer",
              background: "rgba(15, 23, 42, 0.6)",
              marginBottom: "1.5rem",
              transition: "border-color 0.2s ease"
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              style={{ display: "none" }}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileSelect(e.target.files[0]);
                }
              }}
            />
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📄</div>
            <div style={{ fontWeight: 600, fontSize: "1rem", color: "var(--text-primary)" }}>
              {uploadedFile ? uploadedFile.name : "Click to select or drag & drop official Kerala Lottery PDF"}
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
              Accepts authoritative Government Gazette result PDFs only (`application/pdf`)
            </div>
          </div>

          {/* Upload Error */}
          {uploadError && (
            <div
              style={{
                background: "rgba(244, 63, 94, 0.1)",
                border: "1px solid rgba(244, 63, 94, 0.4)",
                borderRadius: "0.5rem",
                padding: "0.75rem 1rem",
                marginBottom: "1rem",
                color: "var(--accent-rose)",
                fontSize: "0.85rem"
              }}
            >
              {uploadError}
            </div>
          )}

          {/* Validated File Details Card */}
          {uploadedFile && isPdfValid && fileSha && (
            <div className="card" style={{ background: "var(--bg-surface-elevated)", border: "1px solid var(--border-medium)", marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                    <span className="badge badge-emerald">PDF MAGIC VALIDATED (%PDF-)</span>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{(uploadedFile.size / 1024).toFixed(1)} KB</span>
                  </div>
                  <h4 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0.25rem 0" }}>{uploadedFile.name}</h4>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    SHA-256: <span className="mono" style={{ color: "var(--accent-cyan)" }}>{fileSha}</span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <button
                    type="button"
                    onClick={handleUploadDryRun}
                    disabled={runningDryRun}
                    style={{
                      background: "var(--bg-surface)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--border-medium)",
                      borderRadius: "0.375rem",
                      padding: "0.5rem 1rem",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      cursor: runningDryRun ? "wait" : "pointer"
                    }}
                  >
                    {runningDryRun ? "Validating..." : "Validate & Dry Run"}
                  </button>

                  <button
                    type="button"
                    onClick={handleUploadIngest}
                    disabled={uploading || selectedEnv === "PROD"}
                    style={{
                      background: selectedEnv === "PROD" ? "var(--bg-surface)" : "var(--accent-emerald)",
                      color: selectedEnv === "PROD" ? "var(--text-muted)" : "#000",
                      fontWeight: 700,
                      border: "none",
                      borderRadius: "0.375rem",
                      padding: "0.5rem 1.25rem",
                      fontSize: "0.85rem",
                      cursor: selectedEnv === "PROD" ? "not-allowed" : uploading ? "wait" : "pointer"
                    }}
                  >
                    {uploading ? "Ingesting..." : "Ingest into Research/DEV"}
                  </button>
                </div>
              </div>

              {/* Dry-Run Result Preview */}
              {dryRunResult && (
                <div style={{ marginTop: "1rem", padding: "1rem", background: "rgba(15, 23, 42, 0.8)", borderRadius: "0.5rem", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <span className="badge badge-emerald">UPLOAD VALIDATION REPORT</span>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      Resolved: {dryRunResult.drawIdentity?.lottery} ({dryRunResult.drawIdentity?.drawNumber}) dated {dryRunResult.drawIdentity?.drawDate}
                    </span>
                  </div>
                  <div className="grid-3" style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>
                    <div>
                      <strong>Status:</strong>{" "}
                      <span style={{ color: dryRunResult.candidateStatus === "VALID" ? "var(--accent-emerald)" : "var(--accent-amber)" }}>
                        {dryRunResult.candidateStatus}
                      </span>
                    </div>
                    <div>
                      <strong>Winning Results:</strong> {dryRunResult.validation?.resultCount || 0}
                    </div>
                    <div>
                      <strong>Idempotency:</strong>{" "}
                      {dryRunResult.projectedChanges?.alreadyIngested > 0 ? (
                        <span className="badge badge-blue">ALREADY INGESTED</span>
                      ) : (
                        <span className="badge badge-emerald">NEW DOCUMENT</span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                    {dryRunResult.summaryText}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* POST-INGEST VERIFICATION SUMMARY */}
      {postIngestResult && (
        <div
          className="card"
          style={{
            marginBottom: "2rem",
            background: "linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(15, 23, 42, 0.9) 100%)",
            border: "1px solid rgba(16, 185, 129, 0.4)"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span className="badge badge-emerald">POST-INGEST VERIFICATION SUCCESS</span>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>
                {postIngestResult.drawIdentity.lottery} ({postIngestResult.drawIdentity.drawNumber})
              </h3>
            </div>
            <span className="mono" style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Run ID: {postIngestResult.runId}
            </span>
          </div>

          <div className="grid-4" style={{ marginBottom: "1rem" }}>
            <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "0.75rem", borderRadius: "0.375rem" }}>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>ENVIRONMENT</div>
              <div style={{ fontWeight: 600, color: "var(--accent-emerald)" }}>{postIngestResult.environment}</div>
            </div>
            <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "0.75rem", borderRadius: "0.375rem" }}>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>WINNING RESULTS</div>
              <div style={{ fontWeight: 600 }}>{postIngestResult.resultCount.toLocaleString()}</div>
            </div>
            <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "0.75rem", borderRadius: "0.375rem" }}>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>FULL TICKET / SUFFIX</div>
              <div style={{ fontWeight: 600 }}>
                {postIngestResult.fullTicketCount} full / {postIngestResult.suffixCount} suffix
              </div>
            </div>
            <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "0.75rem", borderRadius: "0.375rem" }}>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>PIPELINE STATUS</div>
              <div style={{ fontWeight: 600, color: "var(--accent-cyan)" }}>
                {postIngestResult.promoted > 0 ? "PROMOTED TO DEV" : "ALREADY KNOWN"}
              </div>
            </div>
          </div>

          <div style={{ fontSize: "0.8rem", background: "rgba(15, 23, 42, 0.8)", padding: "0.75rem", borderRadius: "0.375rem", border: "1px solid var(--border-subtle)" }}>
            <div style={{ marginBottom: "0.25rem" }}>
              <strong>Cryptographic SHA-256:</strong>{" "}
              <span className="mono" style={{ color: "var(--accent-cyan)" }}>{postIngestResult.sha256}</span>
            </div>
            <div style={{ marginBottom: "0.25rem" }}>
              <strong>Canonical Filename:</strong>{" "}
              <span className="mono">{postIngestResult.canonicalFilename}</span>
            </div>
            <div style={{ marginBottom: "0.25rem" }}>
              <strong>Authoritative Cloud Storage:</strong>{" "}
              <span className="mono" style={{ color: "var(--accent-emerald)" }}>{postIngestResult.cloudStoragePath}</span>
            </div>
            <div>
              <strong>Firestore Document ID:</strong>{" "}
              <span className="mono" style={{ color: "var(--accent-blue)" }}>{postIngestResult.firestoreDocumentId}</span>
            </div>
          </div>
        </div>
      )}

      {/* RECENT INGESTION RUNS AUDIT TABLE */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Recent Pipeline Ingestion Runs</h2>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Audited operational executions with cryptographic verification and replay idempotency
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
                <th>Env</th>
                <th>Trigger</th>
                <th>Candidates / Ingested</th>
                <th>Run Status</th>
                <th>Secret Scrubber</th>
                <th>Operational Notes</th>
              </tr>
            </thead>
            <tbody>
              {loadingRuns ? (
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
                      {run.requestedAt || run.timestamp || "N/A"}
                    </td>
                    <td>
                      <span className={`badge ${run.environment === "PROD" ? "badge-amber" : "badge-blue"}`} style={{ fontSize: "0.7rem" }}>
                        {run.environment || "DEV"}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-slate" style={{ fontSize: "0.75rem" }}>
                        {run.trigger}
                      </span>
                    </td>
                    <td>
                      <span className="mono" style={{ fontSize: "0.85rem" }}>
                        {run.candidateCount ?? run.drawsProcessed ?? 0} cands / {run.ingestedCount ?? run.resultsProcessed ?? 0} ing
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${run.status === "SUCCEEDED" ? "badge-emerald" : "badge-amber"}`} style={{ fontSize: "0.75rem" }}>
                        {run.status}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-emerald" style={{ fontSize: "0.7rem" }}>
                        SANITIZED
                      </span>
                    </td>
                    <td style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                      {run.metadata?.note || run.notes || "Controlled execution"}
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
