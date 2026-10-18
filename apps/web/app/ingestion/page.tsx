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
    cloudStorageDocumentCount: number | null;
    firestoreDocumentCount: number | null;
    researchDrawCount: number;
    prodDrawCount: number;
  };
  operationalGuards: {
    schedulerState: string;
    mutationState: string;
    singleFlightLock: { status: string; owner?: string };
    cloudConnectionStatus: string;
    verificationError?: string;
  };
  verification?: {
    verifiedAt: string;
    totalAudited: number;
    matchedCount: number;
    mismatchCount: number;
    unverifiedCount?: number;
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
  drawDateIso?: string;
  drawNumber?: string;
  lotteryCode?: string;
  state: "ALREADY_KNOWN" | "NEW" | "PENDING" | "CONFLICT";
  sha256?: string;
  fileSize?: number;
  details?: string;
}

interface DiscoveryCheckResponse {
  runId: string;
  environment: string;
  checkedAt: string;
  officialSourceUrl?: string;
  portalNotice?: string;
  todayIst: {
    isoDate: string;
    displayDate: string;
    weekday: string;
    hourIst: number;
    minuteIst: number;
    timeIst: string;
  };
  todaySchedule: {
    scheduled?: boolean;
    isoDate?: string;
    displayDate?: string;
    weekday?: string;
    lotteryCode?: string | null;
    scheduledLotteryCode?: string | null;
    lotteryName?: string | null;
    scheduledLotteryName?: string | null;
    drawNumber?: string | null;
    isExpectedToday?: boolean;
    drawTimeIst?: string;
    expectedPdfPublicationTimeIst?: string;
    typicalPublicationTimeIst?: string;
    venue?: string;
    reason?: string;
    statusNote?: string;
  };
  discoveryStatus:
    | "TODAY_PUBLISHED"
    | "NO_NEW_RESULT"
    | "NOT_YET_PUBLISHED"
    | "NO_SCHEDULED_DRAW"
    | "SOURCE_UNAVAILABLE"
    | "SOURCE_PARSE_ERROR";
  statusExplanation?: string;
  discoveryMessage?: string;
  portalReachable: boolean;
  portalError: string | null;
  todayResult: DiscoveredCandidate | null;
  latestOfficialResult: DiscoveredCandidate | null;
  latestCorpusDraw: {
    sha256: string;
    drawNumber: string;
    drawDate: string;
    drawDateIso: string;
    lotteryCode: string;
    canonicalFilename: string;
  } | null;
  totalDiscovered?: number;
  totalCandidates?: number;
  alreadyKnownCount?: number;
  newOrPendingCount?: number;
  candidates: DiscoveredCandidate[];
}

interface PrizeTierSummaryItem {
  tier: string;
  label: string;
  amount: number;
  winnerCount: number;
  sampleNumbers: string[];
}

interface DryRunPreviewData {
  runId: string;
  environment: string;
  dryRun: boolean;
  storageMutated: boolean;
  firestoreMutated: boolean;
  candidateStatus: string;
  sha256?: string;
  fileSize?: number;
  sourceFilename: string;
  canonicalFilename?: string;
  drawIdentity: {
    lottery: string;
    drawNumber: string;
    drawDate: string;
  };
  scheme: {
    schemeId?: string;
    schemeAuthorityLevel?: string;
  };
  validation: {
    resultCount: number;
    fullTicketCount: number;
    suffixCount: number;
    leadingZeroCount: number;
    sampleLeadingZeroNumbers: string[];
    prizeTierSummary: PrizeTierSummaryItem[];
    conflictReason?: string;
    errorReason?: string;
  };
  projectedChanges: {
    wouldValidate: number;
    wouldIngest: number;
    wouldPromote: number;
    alreadyIngested: number;
    conflicts: number;
  };
  summaryText?: string;
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
  fileSize?: number;
  sourceFilename?: string;
  canonicalFilename: string;
  drawIdentity: {
    lottery: string;
    drawNumber: string;
    drawDate: string;
  };
  resultCount: number;
  fullTicketCount: number;
  suffixCount: number;
  leadingZeroCount?: number;
  sampleLeadingZeroNumbers?: string[];
  prizeTierSummary?: PrizeTierSummaryItem[];
  cloudStoragePath: string;
  firestoreDocumentId: string;
  summaryText?: string;
}

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export default function IngestionConsolePage() {
  // Environment safety state
  const [selectedEnv, setSelectedEnv] = useState<"DEV" | "PROD">("DEV");

  // Operational modes: "DOWNLOAD" (Mode 1: Automatic Discovery) | "UPLOAD" (Mode 2: Manual PDF Upload)
  const [activeMode, setActiveMode] = useState<"DOWNLOAD" | "UPLOAD">("DOWNLOAD");

  // Telemetry & Storage Integrity state
  const [runs, setRuns] = useState<IngestionRun[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [integrityData, setIntegrityData] = useState<StorageIntegrityData | null>(null);
  const [verifyingIntegrity, setVerifyingIntegrity] = useState(false);
  const [showIntegrityDetails, setShowIntegrityDetails] = useState(false);

  // Mode 1: Official Source Discovery state
  const [checkingSource, setCheckingSource] = useState(false);
  const [discoveryReport, setDiscoveryReport] = useState<DiscoveryCheckResponse | null>(null);
  const [candidates, setCandidates] = useState<DiscoveredCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<DiscoveredCandidate | null>(null);
  const [runningDryRun, setRunningDryRun] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<DryRunPreviewData | null>(null);
  const [confirmCandidateIngest, setConfirmCandidateIngest] = useState(false);
  const [downloadingCandidate, setDownloadingCandidate] = useState(false);

  // Mode 2: Manual Upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileSha, setFileSha] = useState<string | null>(null);
  const [isPdfValid, setIsPdfValid] = useState<boolean | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [expectedLotteryCode, setExpectedLotteryCode] = useState("");
  const [expectedDrawNumber, setExpectedDrawNumber] = useState("");
  const [expectedDrawDate, setExpectedDrawDate] = useState("");
  const [confirmUploadIngest, setConfirmUploadIngest] = useState(false);
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

  // Action: Check Latest Official Results (Mode 1)
  async function handleCheckOfficialSource() {
    setCheckingSource(true);
    setActionError(null);
    setSelectedCandidate(null);
    setDryRunResult(null);
    setConfirmCandidateIngest(false);

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

      setDiscoveryReport(json);
      setCandidates(json.candidates || []);
      if (json.todayResult) {
        setSelectedCandidate(json.todayResult);
      } else if (json.candidates && json.candidates.length > 0) {
        setSelectedCandidate(json.candidates[0]);
      }
      loadRuns();
    } catch (err: any) {
      setActionError(err.message || "Failed to contact official source discovery");
    } finally {
      setCheckingSource(false);
    }
  }

  // Action: Run Dry-Run / Preview for Selected Candidate (Mode 1)
  async function handleCandidateDryRun() {
    if (!selectedCandidate) return;
    setRunningDryRun(true);
    setActionError(null);
    setConfirmCandidateIngest(false);

    try {
      const res = await fetch("/api/ops/ingestion/dry-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate: selectedCandidate,
          environment: selectedEnv,
          dryRun: true
        })
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Dry-run execution failed");
      }

      setDryRunResult(json);
      loadRuns();
    } catch (err: any) {
      setActionError(err.message || "Dry run failed");
    } finally {
      setRunningDryRun(false);
    }
  }

  // Action: Confirm Download & Ingest Candidate (Mode 1)
  async function handleCandidateDownloadAndIngest() {
    if (!selectedCandidate) return;
    if (selectedEnv === "PROD") {
      setActionError("PROD mutations are strictly forbidden. PROD is READ-ONLY.");
      return;
    }
    if (!confirmCandidateIngest) {
      setActionError("Explicit operator confirmation is required before ingesting into DEV.");
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
          environment: selectedEnv,
          confirm: true
        })
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Download & ingestion failed");
      }

      setPostIngestResult(json);
      setConfirmCandidateIngest(false);
      loadRuns();
      loadStorageIntegrity(false);
    } catch (err: any) {
      setActionError(err.message || "Download & ingestion failed");
    } finally {
      setDownloadingCandidate(false);
    }
  }

  // Action: Clear / Cancel Manual Upload without saving
  function handleClearUpload() {
    setUploadedFile(null);
    setFileSha(null);
    setIsPdfValid(null);
    setUploadError(null);
    setActionError(null);
    setDryRunResult(null);
    setConfirmUploadIngest(false);
    setExpectedLotteryCode("");
    setExpectedDrawNumber("");
    setExpectedDrawDate("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  // Action: File Selection & Immediate Hash + PDF Structural Validation (Mode 2)
  async function handleFileSelect(file: File) {
    setUploadError(null);
    setActionError(null);
    setPostIngestResult(null);
    setDryRunResult(null);
    setConfirmUploadIngest(false);

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setIsPdfValid(false);
      setUploadError("File must be a valid PDF (.pdf). Non-PDF documents are rejected.");
      setUploadedFile(null);
      setFileSha(null);
      return;
    }

    if (file.size === 0) {
      setIsPdfValid(false);
      setUploadError("Uploaded PDF file is empty (0 bytes).");
      setUploadedFile(null);
      setFileSha(null);
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setIsPdfValid(false);
      setUploadError(
        `File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds the maximum allowed upload size of 10 MB.`
      );
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

    // Check trailing window for %%EOF marker to detect truncated PDFs early
    const tailLength = Math.min(bytes.length, 2048);
    const tailText = new TextDecoder("latin1").decode(bytes.subarray(bytes.length - tailLength));
    if (!tailText.includes("%%EOF")) {
      setIsPdfValid(false);
      setUploadError("Corrupted or truncated PDF: missing '%%EOF' end-of-file marker.");
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

  // Action: Dry Run Uploaded File (Preview before Confirm)
  async function handleUploadDryRun() {
    if (!uploadedFile) return;
    setRunningDryRun(true);
    setActionError(null);
    setConfirmUploadIngest(false);

    try {
      const formData = new FormData();
      formData.append("file", uploadedFile);
      formData.append("environment", selectedEnv);
      if (expectedLotteryCode.trim()) formData.append("lotteryCode", expectedLotteryCode.trim());
      if (expectedDrawNumber.trim()) formData.append("drawNumber", expectedDrawNumber.trim());
      if (expectedDrawDate.trim()) formData.append("drawDate", expectedDrawDate.trim());

      const res = await fetch("/api/ops/ingestion/dry-run", {
        method: "POST",
        body: formData
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Upload dry-run preview failed");
      }
      setDryRunResult(json);
      loadRuns();
    } catch (err: any) {
      setActionError(err.message || "Upload dry-run failed");
    } finally {
      setRunningDryRun(false);
    }
  }

  // Action: Confirm & Ingest Uploaded File into DEV
  async function handleUploadIngest() {
    if (!uploadedFile) return;
    if (selectedEnv === "PROD") {
      setActionError("PROD mutations are strictly forbidden. PROD is READ-ONLY.");
      return;
    }
    if (!confirmUploadIngest) {
      setActionError("Please check the operator confirmation box before ingesting into DEV.");
      return;
    }

    setUploading(true);
    setActionError(null);
    setPostIngestResult(null);

    try {
      const formData = new FormData();
      formData.append("file", uploadedFile);
      formData.append("environment", selectedEnv);
      formData.append("confirm", "true");
      if (expectedLotteryCode.trim()) formData.append("lotteryCode", expectedLotteryCode.trim());
      if (expectedDrawNumber.trim()) formData.append("drawNumber", expectedDrawNumber.trim());
      if (expectedDrawDate.trim()) formData.append("drawDate", expectedDrawDate.trim());

      const res = await fetch("/api/ops/ingestion/upload", {
        method: "POST",
        body: formData
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Manual upload ingestion failed");
      }

      setPostIngestResult(json);
      setConfirmUploadIngest(false);
      loadRuns();
      loadStorageIntegrity(false);
    } catch (err: any) {
      setActionError(err.message || "Manual upload ingestion failed");
    } finally {
      setUploading(false);
    }
  }

  function getDiscoveryBadgeClass(status: DiscoveryCheckResponse["discoveryStatus"]): string {
    switch (status) {
      case "TODAY_PUBLISHED":
        return "badge-emerald";
      case "NO_NEW_RESULT":
        return "badge-blue";
      case "NOT_YET_PUBLISHED":
        return "badge-amber";
      case "NO_SCHEDULED_DRAW":
        return "badge-slate";
      case "SOURCE_UNAVAILABLE":
      case "SOURCE_PARSE_ERROR":
        return "badge-rose";
      default:
        return "badge-slate";
    }
  }

  function renderValidationPreviewCard(
    preview: DryRunPreviewData,
    mode: "DOWNLOAD" | "UPLOAD",
    onDiscard: () => void,
    confirmed: boolean,
    onToggleConfirm: (val: boolean) => void,
    onConfirmIngest: () => void,
    ingesting: boolean
  ) {
    const isConflict = preview.candidateStatus === "CONFLICT" || (preview.projectedChanges?.conflicts ?? 0) > 0;
    const isAlreadyKnown =
      preview.candidateStatus === "ALREADY_KNOWN" || (preview.projectedChanges?.alreadyIngested ?? 0) > 0;

    return (
      <div
        style={{
          marginTop: "1.25rem",
          padding: "1.25rem",
          background: "var(--bg-surface)",
          borderRadius: "0.65rem",
          border: isConflict
            ? "1px solid rgba(244, 63, 94, 0.5)"
            : "1px solid var(--border-medium)"
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "0.75rem",
            marginBottom: "1rem"
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.35rem" }}>
              <span className="badge badge-emerald">DRY-RUN VALIDATION PREVIEW (ZERO MUTATION)</span>
              <span
                className={`badge ${
                  isConflict ? "badge-rose" : isAlreadyKnown ? "badge-blue" : "badge-emerald"
                }`}
              >
                {isConflict
                  ? "CONFLICT DETECTED"
                  : isAlreadyKnown
                    ? "ALREADY INGESTED (IDEMPOTENT)"
                    : "NEW VALIDATED DOCUMENT"}
              </span>
            </div>
            <h4 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>
              {preview.drawIdentity?.lottery || "Kerala State Lottery"} — Draw {preview.drawIdentity?.drawNumber || "N/A"} ({preview.drawIdentity?.drawDate || "N/A"})
            </h4>
          </div>

          <button
            type="button"
            onClick={onDiscard}
            style={{
              background: "var(--bg-surface-elevated)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "0.375rem",
              padding: "0.5rem 0.9rem",
              minHeight: "44px",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Cancel / Discard Preview
          </button>
        </div>

        {/* Metadata Grid */}
        <div className="grid-4" style={{ marginBottom: "1rem" }}>
          <div style={{ background: "var(--bg-surface-elevated)", padding: "0.75rem", borderRadius: "0.375rem" }}>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Prize Scheme</div>
            <div style={{ fontWeight: 600, fontSize: "0.85rem", marginTop: "0.2rem" }}>
              {preview.scheme?.schemeId || "OFFICIAL"} ({preview.scheme?.schemeAuthorityLevel || "VERIFIED"})
            </div>
          </div>

          <div style={{ background: "var(--bg-surface-elevated)", padding: "0.75rem", borderRadius: "0.375rem" }}>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Extracted Results</div>
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--accent-emerald)", marginTop: "0.2rem" }}>
              {(preview.validation?.resultCount ?? 0).toLocaleString()} total
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
              {preview.validation?.fullTicketCount ?? 0} full / {preview.validation?.suffixCount ?? 0} suffix
            </div>
          </div>

          <div style={{ background: "var(--bg-surface-elevated)", padding: "0.75rem", borderRadius: "0.375rem" }}>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Leading-Zero Strings</div>
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--accent-cyan)", marginTop: "0.2rem" }}>
              {preview.validation?.leadingZeroCount ?? 0} preserved
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
              Exact string representation
            </div>
          </div>

          <div style={{ background: "var(--bg-surface-elevated)", padding: "0.75rem", borderRadius: "0.375rem" }}>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Canonical Filename</div>
            <div className="mono" style={{ fontWeight: 600, fontSize: "0.8rem", marginTop: "0.2rem", wordBreak: "break-all" }}>
              {preview.canonicalFilename || preview.sourceFilename}
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
              {preview.fileSize ? `${(preview.fileSize / 1024).toFixed(1)} KB` : "Verified PDF"}
            </div>
          </div>
        </div>

        {/* Cryptographic Digest & Leading Zero Samples */}
        <div
          style={{
            background: "var(--bg-surface-elevated)",
            padding: "0.75rem 1rem",
            borderRadius: "0.375rem",
            border: "1px solid var(--border-subtle)",
            fontSize: "0.8rem",
            marginBottom: "1rem"
          }}
        >
          <div style={{ marginBottom: "0.35rem", wordBreak: "break-all" }}>
            <strong>SHA-256 Digest:</strong>{" "}
            <span className="mono" style={{ color: "var(--accent-cyan)" }}>
              {preview.sha256 || "Pending byte stream"}
            </span>
          </div>
          {preview.validation?.sampleLeadingZeroNumbers && preview.validation.sampleLeadingZeroNumbers.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.35rem" }}>
              <strong>Leading-Zero Ticket/Suffix Samples:</strong>
              {preview.validation.sampleLeadingZeroNumbers.map((num) => (
                <span
                  key={num}
                  className="mono badge badge-slate"
                  style={{ fontSize: "0.75rem", padding: "0.15rem 0.45rem" }}
                >
                  &quot;{num}&quot;
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Prize Tier Breakdown Table */}
        {preview.validation?.prizeTierSummary && preview.validation.prizeTierSummary.length > 0 && (
          <div style={{ marginBottom: "1rem" }}>
            <div style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.4rem", color: "var(--text-secondary)" }}>
              Extracted Prize Tier Breakdown
            </div>
            <div className="table-container" style={{ maxHeight: "220px", overflowY: "auto" }}>
              <table className="research-table" style={{ fontSize: "0.78rem" }}>
                <thead>
                  <tr>
                    <th>Prize Tier</th>
                    <th>Prize Amount (INR)</th>
                    <th>Winning Entries</th>
                    <th>Sample Numbers</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.validation.prizeTierSummary.map((tier) => (
                    <tr key={tier.tier}>
                      <td>
                        <strong>{tier.label}</strong>
                      </td>
                      <td className="mono">₹{tier.amount.toLocaleString()}</td>
                      <td className="mono">{tier.winnerCount}</td>
                      <td className="mono" style={{ fontSize: "0.74rem", color: "var(--accent-cyan)" }}>
                        {tier.sampleNumbers.join(", ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Conflict Warning if detected */}
        {isConflict && (
          <div
            style={{
              background: "rgba(244, 63, 94, 0.12)",
              border: "1px solid rgba(244, 63, 94, 0.4)",
              borderRadius: "0.5rem",
              padding: "0.75rem 1rem",
              marginBottom: "1rem",
              color: "var(--accent-rose)",
              fontSize: "0.85rem"
            }}
          >
            <strong>Ingestion Conflict Detected:</strong>{" "}
            {preview.validation?.conflictReason ||
              preview.summaryText ||
              "Document draw identity conflicts with an existing record or caller-supplied metadata. Silent overwrites are forbidden."}
          </div>
        )}

        {/* Operator Confirmation & Commit Controls */}
        {!isConflict && (
          <div
            style={{
              marginTop: "1rem",
              paddingTop: "1rem",
              borderTop: "1px solid var(--border-subtle)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "1rem"
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                fontSize: "0.85rem",
                cursor: selectedEnv === "PROD" ? "not-allowed" : "pointer",
                color: "var(--text-primary)"
              }}
            >
              <input
                type="checkbox"
                checked={confirmed}
                disabled={selectedEnv === "PROD"}
                onChange={(e) => onToggleConfirm(e.target.checked)}
                style={{ width: "18px", height: "18px", cursor: "pointer" }}
              />
              <span>
                I have reviewed the extracted draw identity, prize tiers, and SHA-256 hash and confirm{" "}
                <strong>DEV</strong> ingestion.
              </span>
            </label>

            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={onConfirmIngest}
                disabled={!confirmed || ingesting || selectedEnv === "PROD"}
                style={{
                  background:
                    !confirmed || selectedEnv === "PROD"
                      ? "var(--bg-surface-elevated)"
                      : "var(--accent-emerald)",
                  color: !confirmed || selectedEnv === "PROD" ? "var(--text-muted)" : "#000",
                  fontWeight: 700,
                  border: "none",
                  borderRadius: "0.375rem",
                  padding: "0.65rem 1.35rem",
                  minHeight: "48px",
                  fontSize: "0.875rem",
                  cursor:
                    !confirmed || selectedEnv === "PROD"
                      ? "not-allowed"
                      : ingesting
                        ? "wait"
                        : "pointer"
                }}
              >
                {ingesting
                  ? "Ingesting into DEV..."
                  : mode === "DOWNLOAD"
                    ? "Confirm & Ingest Official Result into DEV"
                    : "Confirm & Ingest PDF into DEV"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: "2rem 1.5rem" }}>
      {/* Header & Operational Mode Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "2rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
            <h1 style={{ fontSize: "1.875rem", fontWeight: 700, margin: 0 }}>
              Official Lottery Result Ingestion Console
            </h1>
            <span className="badge badge-emerald">V1 OPERATIONAL SURFACE</span>
            <span className="badge badge-amber">PROD SCHEDULER: PAUSED</span>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", margin: 0 }}>
            Automatic official portal discovery (`Asia/Kolkata` IST), manual official PDF upload, cryptographic SHA-256 verification, and idempotent DEV promotion.
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
                padding: "0.45rem 0.9rem",
                minHeight: "44px",
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
                padding: "0.45rem 0.9rem",
                minHeight: "44px",
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
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.75rem"
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
          <strong>Operational Alert:</strong> {actionError}
        </div>
      )}

      {/* Storage Integrity & Local ↔ Cloud Reconciliation Panel (Expandable Advanced Details) */}
      <details
        style={{
          marginBottom: "1.5rem",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "0.65rem",
          padding: "0.85rem 1.15rem"
        }}
      >
        <summary
          style={{
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.9rem",
            color: "var(--text-secondary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.5rem"
          }}
        >
          <span>Advanced operational details — Storage Integrity &amp; Local ↔ Cloud Reconciliation</span>
          <span className="badge badge-blue">
            {integrityData ? `${integrityData.counts.localDocumentCount} PDFs / ${integrityData.counts.researchDrawCount} DEV Draws` : "Deterministic SHA-256"}
          </span>
        </summary>
        <div style={{ marginTop: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.25rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
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
                padding: "0.5rem 1rem",
                minHeight: "44px",
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
          <div style={{ background: "var(--bg-surface-elevated)", padding: "1rem", borderRadius: "0.5rem", border: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Local Pi Cache</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--accent-cyan)", margin: "0.25rem 0" }}>
              {integrityData ? `${integrityData.counts.localDocumentCount} PDFs` : "..."}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
              {integrityData ? `${integrityData.counts.localGraphCount} Graphs / ${integrityData.counts.localManifestCount} Manifest` : "Scanning..."}
            </div>
          </div>

          <div style={{ background: "var(--bg-surface-elevated)", padding: "1rem", borderRadius: "0.5rem", border: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Authoritative Cloud</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: integrityData && integrityData.counts.cloudStorageDocumentCount !== null ? "var(--accent-emerald)" : "var(--accent-amber)", margin: "0.25rem 0" }}>
              {integrityData
                ? integrityData.counts.cloudStorageDocumentCount !== null
                  ? `${integrityData.counts.cloudStorageDocumentCount} Artifacts`
                  : "UNVERIFIED"
                : "..."}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
              Firebase Storage: source-documents/{`{sha256}`}.pdf
            </div>
          </div>

          <div style={{ background: "var(--bg-surface-elevated)", padding: "1rem", borderRadius: "0.5rem", border: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Firestore Metadata</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: integrityData && integrityData.counts.firestoreDocumentCount !== null ? "var(--accent-blue)" : "var(--accent-amber)", margin: "0.25rem 0" }}>
              {integrityData
                ? integrityData.counts.firestoreDocumentCount !== null
                  ? `${integrityData.counts.firestoreDocumentCount} Docs`
                  : "UNVERIFIED"
                : "..."}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
              Firestore: documents/{`{sha256}`}
            </div>
          </div>

          <div style={{ background: "var(--bg-surface-elevated)", padding: "1rem", borderRadius: "0.5rem", border: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Baseline Isolation</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--accent-amber)", margin: "0.25rem 0" }}>
              {integrityData ? `${integrityData.counts.researchDrawCount} DEV / ${integrityData.counts.prodDrawCount} PROD` : "..."}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
              PROD Scheduler: {integrityData ? integrityData.operationalGuards.schedulerState : "..."}
            </div>
          </div>
        </div>

        {/* Truthful Cloud Verification Disclosure */}
        {integrityData && (integrityData.counts.cloudStorageDocumentCount === null || integrityData.operationalGuards.cloudConnectionStatus === "UNVERIFIED_OFFLINE") && (
          <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", background: "var(--bg-surface-elevated)", border: "1px solid var(--border-subtle)", borderRadius: "0.375rem", padding: "0.6rem 0.85rem", marginBottom: "0.75rem" }}>
            <strong>Cloud Residency Status ({integrityData.operationalGuards.cloudConnectionStatus}):</strong> Live Cloud Storage and Firestore bucket enumeration requires runtime cloud credentials. When live cloud inspection is not configured in the active web runtime, counts report <span className="mono">UNVERIFIED</span> rather than assuming cloud residency from local cache files.
          </div>
        )}

        {/* Deep Verification Report Modal / Expansion */}
        {showIntegrityDetails && integrityData?.verification && (
          <div style={{ marginTop: "1rem", padding: "1rem", background: "var(--bg-surface-elevated)", border: "1px solid var(--border-medium)", borderRadius: "0.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span className={`badge ${integrityData.verification.integrityStatus === "VERIFIED" ? "badge-emerald" : "badge-amber"}`}>
                  {integrityData.verification.integrityStatus}
                </span>
                <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                  {integrityData.verification.matchedCount} of {integrityData.verification.totalAudited} Draws Reconciled
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
                        <span className={`badge ${item.identityVerified ? "badge-emerald" : "badge-amber"}`} style={{ fontSize: "0.65rem" }}>
                          {item.identityVerified ? "VERIFIED RECONCILED" : integrityData.verification?.integrityStatus || "UNVERIFIED"}
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
      </details>

      {/* Mode Switch Tabs */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.5rem", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.5rem" }}>
        <button
          type="button"
          onClick={() => {
            setActiveMode("DOWNLOAD");
            setActionError(null);
            setDryRunResult(null);
          }}
          style={{
            background: "none",
            border: "none",
            padding: "0.6rem 1rem",
            minHeight: "48px",
            fontSize: "0.95rem",
            fontWeight: 600,
            cursor: "pointer",
            color: activeMode === "DOWNLOAD" ? "var(--accent-blue)" : "var(--text-secondary)",
            borderBottom: activeMode === "DOWNLOAD" ? "2px solid var(--accent-blue)" : "none"
          }}
        >
          MODE 1: AUTOMATIC DISCOVERY (CHECK LATEST OFFICIAL RESULTS)
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveMode("UPLOAD");
            setActionError(null);
            setDryRunResult(null);
          }}
          style={{
            background: "none",
            border: "none",
            padding: "0.6rem 1rem",
            minHeight: "48px",
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

      {/* MODE 1: AUTOMATIC DISCOVERY & TODAY'S OFFICIAL RESULT CHECK */}
      {activeMode === "DOWNLOAD" && (
        <div style={{ marginBottom: "2rem" }}>
          {/* Action Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", marginBottom: "1.25rem" }}>
            <div>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>
                Automatic Current-Date (`Asia/Kolkata`) & Latest Result Discovery
              </h3>
              <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                Checks official Kerala State Lottery publication endpoints (`statelottery.kerala.gov.in` & `result.keralalotteries.com`) for today&apos;s scheduled draw and any newly published gazette PDFs.
              </div>
            </div>

            <button
              type="button"
              onClick={handleCheckOfficialSource}
              disabled={checkingSource}
              style={{
                background: "var(--accent-cyan)",
                color: "#000",
                fontWeight: 700,
                border: "none",
                borderRadius: "0.5rem",
                padding: "0.75rem 1.35rem",
                minHeight: "48px",
                fontSize: "0.9rem",
                cursor: checkingSource ? "wait" : "pointer"
              }}
            >
              {checkingSource ? "Checking Official Portal..." : "Check Latest Official Results"}
            </button>
          </div>

          {/* Current-Date IST Status & Schedule Summary */}
          {discoveryReport && (
            <div className="card" style={{ marginBottom: "1.5rem", background: "var(--bg-surface-elevated)", border: "1px solid var(--border-medium)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1rem" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.35rem" }}>
                    <span className={`badge ${getDiscoveryBadgeClass(discoveryReport.discoveryStatus)}`}>
                      {discoveryReport.discoveryStatus}
                    </span>
                    <span className="mono" style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      IST Date: {discoveryReport.todayIst.displayDate} ({discoveryReport.todayIst.weekday}, {discoveryReport.todayIst.timeIst})
                    </span>
                    <a
                      href={discoveryReport.officialSourceUrl || "https://statelottery.kerala.gov.in/English/index.php/lottery-result-view"}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: "0.78rem", color: "var(--accent-blue)", fontWeight: 600 }}
                    >
                      Official Directorate Portal ↗
                    </a>
                  </div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-primary)" }}>
                    {discoveryReport.statusExplanation || discoveryReport.discoveryMessage}
                  </div>
                </div>

                {(discoveryReport.discoveryStatus === "SOURCE_UNAVAILABLE" ||
                  discoveryReport.discoveryStatus === "SOURCE_PARSE_ERROR") && (
                  <button
                    type="button"
                    onClick={() => setActiveMode("UPLOAD")}
                    style={{
                      background: "var(--accent-amber)",
                      color: "#000",
                      border: "none",
                      borderRadius: "0.375rem",
                      padding: "0.5rem 0.9rem",
                      minHeight: "44px",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                  >
                    Switch to Manual PDF Upload →
                  </button>
                )}
              </div>

              <div className="grid-3">
                <div style={{ background: "var(--bg-surface)", padding: "0.85rem", borderRadius: "0.5rem", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                    Today&apos;s Scheduled Draw ({discoveryReport.todayIst.displayDate})
                  </div>
                  <div style={{ fontSize: "1rem", fontWeight: 700, marginTop: "0.25rem", color: "var(--accent-cyan)" }}>
                    {discoveryReport.todaySchedule.lotteryName || discoveryReport.todaySchedule.scheduledLotteryName
                      ? `${discoveryReport.todaySchedule.lotteryName || discoveryReport.todaySchedule.scheduledLotteryName} (${discoveryReport.todaySchedule.drawNumber || discoveryReport.todaySchedule.lotteryCode || discoveryReport.todaySchedule.scheduledLotteryCode || "Scheduled"})`
                      : "No Weekly Draw Scheduled"}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                    {discoveryReport.todayResult
                      ? `Published: ${discoveryReport.todayResult.drawNumber} (${discoveryReport.todayResult.state})`
                      : discoveryReport.todaySchedule.reason ||
                        discoveryReport.todaySchedule.statusNote ||
                        (discoveryReport.todaySchedule.venue
                          ? `Draw at ${discoveryReport.todaySchedule.drawTimeIst || "15:00 IST"} • ${discoveryReport.todaySchedule.venue}`
                          : "Official schedule checked")}
                  </div>
                </div>

                <div style={{ background: "var(--bg-surface)", padding: "0.85rem", borderRadius: "0.5rem", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                    Latest Official Portal Result
                  </div>
                  <div style={{ fontSize: "1rem", fontWeight: 700, marginTop: "0.25rem", color: "var(--accent-emerald)" }}>
                    {discoveryReport.latestOfficialResult
                      ? `${discoveryReport.latestOfficialResult.lotteryCode} (${discoveryReport.latestOfficialResult.drawNumber})`
                      : "None Discovered"}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                    {discoveryReport.latestOfficialResult
                      ? `Draw Date: ${discoveryReport.latestOfficialResult.drawDate} • Status: ${discoveryReport.latestOfficialResult.state}`
                      : "Portal returned 0 candidates"}
                  </div>
                </div>

                <div style={{ background: "var(--bg-surface)", padding: "0.85rem", borderRadius: "0.5rem", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                    Latest Corpus Draw in Repository
                  </div>
                  <div style={{ fontSize: "1rem", fontWeight: 700, marginTop: "0.25rem", color: "var(--accent-blue)" }}>
                    {discoveryReport.latestCorpusDraw
                      ? `${discoveryReport.latestCorpusDraw.lotteryCode} (${discoveryReport.latestCorpusDraw.drawNumber})`
                      : "N/A"}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                    {discoveryReport.latestCorpusDraw
                      ? `Draw Date: ${discoveryReport.latestCorpusDraw.drawDate} • File: ${discoveryReport.latestCorpusDraw.canonicalFilename}`
                      : "No corpus draws found"}
                  </div>
                </div>
              </div>
            </div>
          )}

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
                          setConfirmCandidateIngest(false);
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
                              setConfirmCandidateIngest(false);
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                    Selected Official Candidate
                  </div>
                  <h4 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0.25rem 0" }}>
                    {selectedCandidate.title || `${selectedCandidate.lotteryCode} (${selectedCandidate.drawNumber})`}
                  </h4>
                  <div className="mono" style={{ fontSize: "0.8rem", color: "var(--accent-cyan)" }}>
                    Target File: {selectedCandidate.canonicalFilename || selectedCandidate.fileName}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={handleCandidateDryRun}
                    disabled={runningDryRun}
                    style={{
                      background: "var(--accent-blue)",
                      color: "#000",
                      border: "none",
                      borderRadius: "0.375rem",
                      padding: "0.6rem 1.15rem",
                      minHeight: "48px",
                      fontWeight: 700,
                      fontSize: "0.85rem",
                      cursor: runningDryRun ? "wait" : "pointer"
                    }}
                  >
                    {runningDryRun ? "Validating Candidate..." : "Step 1: Preview & Validate Candidate"}
                  </button>
                </div>
              </div>

              {/* Dry-Run Result Preview + Explicit Confirmation */}
              {dryRunResult &&
                renderValidationPreviewCard(
                  dryRunResult,
                  "DOWNLOAD",
                  () => {
                    setDryRunResult(null);
                    setConfirmCandidateIngest(false);
                  },
                  confirmCandidateIngest,
                  setConfirmCandidateIngest,
                  handleCandidateDownloadAndIngest,
                  downloadingCandidate
                )}
            </div>
          )}
        </div>
      )}

      {/* MODE 2: MANUAL OFFICIAL PDF UPLOAD */}
      {activeMode === "UPLOAD" && (
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ marginBottom: "1rem" }}>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>Manual Official Gazette PDF Upload</h3>
            <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
              Upload an official Kerala State Lotteries result PDF (max 10 MB). Performs immediate `%PDF-` magic header & `%%EOF` structure checks, SHA-256 hashing, full ticket/suffix extraction, leading-zero verification, and preview before DEV ingestion.
            </div>
          </div>

          {/* Optional Expected Metadata Verification Inputs */}
          <div
            className="card"
            style={{
              background: "var(--bg-surface-elevated)",
              border: "1px solid var(--border-subtle)",
              marginBottom: "1.25rem",
              padding: "1rem"
            }}
          >
            <div style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.6rem", color: "var(--text-secondary)" }}>
              Optional Expected Draw Metadata (Leave blank to auto-detect from PDF; specify to verify against PDF contents)
            </div>
            <div className="grid-3">
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                  Expected Lottery Code (e.g., WIN-WIN, KARUNYA)
                </label>
                <input
                  type="text"
                  value={expectedLotteryCode}
                  onChange={(e) => setExpectedLotteryCode(e.target.value)}
                  placeholder="Auto-extract from PDF"
                  style={{
                    width: "100%",
                    padding: "0.55rem 0.75rem",
                    minHeight: "44px",
                    borderRadius: "0.375rem",
                    border: "1px solid var(--border-medium)",
                    background: "var(--bg-surface)",
                    color: "var(--text-primary)",
                    fontSize: "0.85rem"
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                  Expected Draw Number (e.g., W-820th, KN-643rd)
                </label>
                <input
                  type="text"
                  value={expectedDrawNumber}
                  onChange={(e) => setExpectedDrawNumber(e.target.value)}
                  placeholder="Auto-extract from PDF"
                  style={{
                    width: "100%",
                    padding: "0.55rem 0.75rem",
                    minHeight: "44px",
                    borderRadius: "0.375rem",
                    border: "1px solid var(--border-medium)",
                    background: "var(--bg-surface)",
                    color: "var(--text-primary)",
                    fontSize: "0.85rem"
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                  Expected Draw Date (DD/MM/YYYY)
                </label>
                <input
                  type="text"
                  value={expectedDrawDate}
                  onChange={(e) => setExpectedDrawDate(e.target.value)}
                  placeholder="DD/MM/YYYY (Auto-extract)"
                  style={{
                    width: "100%",
                    padding: "0.55rem 0.75rem",
                    minHeight: "44px",
                    borderRadius: "0.375rem",
                    border: "1px solid var(--border-medium)",
                    background: "var(--bg-surface)",
                    color: "var(--text-primary)",
                    fontSize: "0.85rem"
                  }}
                />
              </div>
            </div>
          </div>

          {/* Drag & Drop / Mobile File Picker Zone */}
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
              padding: "2.25rem 1.5rem",
              textAlign: "center",
              cursor: "pointer",
              background: "var(--bg-surface-elevated)",
              marginBottom: "1.25rem",
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
              {uploadedFile ? uploadedFile.name : "Tap to select or drag & drop official Kerala Lottery PDF"}
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
              Accepts authoritative Government Gazette result PDFs only (`application/pdf`, max 10 MB)
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
              <strong>Upload Validation Rejected:</strong> {uploadError}
            </div>
          )}

          {/* Validated File Details Card */}
          {uploadedFile && isPdfValid && fileSha && (
            <div className="card" style={{ background: "var(--bg-surface-elevated)", border: "1px solid var(--border-medium)", marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.25rem" }}>
                    <span className="badge badge-emerald">PDF STRUCTURE VALIDATED (%PDF- / %%EOF)</span>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{(uploadedFile.size / 1024).toFixed(1)} KB</span>
                  </div>
                  <h4 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0.25rem 0", wordBreak: "break-all" }}>
                    {uploadedFile.name}
                  </h4>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", wordBreak: "break-all" }}>
                    SHA-256: <span className="mono" style={{ color: "var(--accent-cyan)" }}>{fileSha}</span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={handleClearUpload}
                    style={{
                      background: "var(--bg-surface)",
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "0.375rem",
                      padding: "0.55rem 1rem",
                      minHeight: "48px",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      cursor: "pointer"
                    }}
                  >
                    Cancel / Clear File
                  </button>

                  <button
                    type="button"
                    onClick={handleUploadDryRun}
                    disabled={runningDryRun}
                    style={{
                      background: "var(--accent-blue)",
                      color: "#000",
                      border: "none",
                      borderRadius: "0.375rem",
                      padding: "0.55rem 1.2rem",
                      minHeight: "48px",
                      fontWeight: 700,
                      fontSize: "0.85rem",
                      cursor: runningDryRun ? "wait" : "pointer"
                    }}
                  >
                    {runningDryRun ? "Parsing & Validating PDF..." : "Step 1: Preview & Validate PDF"}
                  </button>
                </div>
              </div>

              {/* Dry-Run Result Preview + Explicit Confirmation */}
              {dryRunResult &&
                renderValidationPreviewCard(
                  dryRunResult,
                  "UPLOAD",
                  handleClearUpload,
                  confirmUploadIngest,
                  setConfirmUploadIngest,
                  handleUploadIngest,
                  uploading
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
            background: "var(--bg-surface)",
            border: "1px solid rgba(16, 185, 129, 0.4)"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <span className="badge badge-emerald">POST-INGEST VERIFICATION SUCCESS</span>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>
                {postIngestResult.drawIdentity.lottery} ({postIngestResult.drawIdentity.drawNumber}) — {postIngestResult.drawIdentity.drawDate}
              </h3>
            </div>
            <span className="mono" style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Run ID: {postIngestResult.runId}
            </span>
          </div>

          <div className="grid-4" style={{ marginBottom: "1rem" }}>
            <div style={{ background: "var(--bg-surface-elevated)", padding: "0.75rem", borderRadius: "0.375rem" }}>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>ENVIRONMENT</div>
              <div style={{ fontWeight: 600, color: "var(--accent-emerald)" }}>{postIngestResult.environment}</div>
            </div>
            <div style={{ background: "var(--bg-surface-elevated)", padding: "0.75rem", borderRadius: "0.375rem" }}>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>WINNING RESULTS</div>
              <div style={{ fontWeight: 600 }}>{postIngestResult.resultCount.toLocaleString()}</div>
            </div>
            <div style={{ background: "var(--bg-surface-elevated)", padding: "0.75rem", borderRadius: "0.375rem" }}>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>FULL TICKET / SUFFIX</div>
              <div style={{ fontWeight: 600 }}>
                {postIngestResult.fullTicketCount} full / {postIngestResult.suffixCount} suffix
              </div>
            </div>
            <div style={{ background: "var(--bg-surface-elevated)", padding: "0.75rem", borderRadius: "0.375rem" }}>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>PIPELINE STATUS</div>
              <div style={{ fontWeight: 600, color: "var(--accent-cyan)" }}>
                {postIngestResult.promoted > 0 ? "PROMOTED TO DEV" : "ALREADY KNOWN (IDEMPOTENT)"}
              </div>
            </div>
          </div>

          <div style={{ fontSize: "0.8rem", background: "var(--bg-surface-elevated)", padding: "0.75rem", borderRadius: "0.375rem", border: "1px solid var(--border-subtle)" }}>
            <div style={{ marginBottom: "0.25rem", wordBreak: "break-all" }}>
              <strong>Cryptographic SHA-256:</strong>{" "}
              <span className="mono" style={{ color: "var(--accent-cyan)" }}>{postIngestResult.sha256}</span>
            </div>
            <div style={{ marginBottom: "0.25rem" }}>
              <strong>Canonical Filename:</strong>{" "}
              <span className="mono">{postIngestResult.canonicalFilename}</span>
            </div>
            <div style={{ marginBottom: "0.25rem", wordBreak: "break-all" }}>
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

      {/* RECENT INGESTION RUNS AUDIT TABLE (Expandable Advanced Details) */}
      <details
        style={{
          marginTop: "1.5rem",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "0.65rem",
          padding: "0.85rem 1.15rem"
        }}
      >
        <summary
          style={{
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.9rem",
            color: "var(--text-secondary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.5rem"
          }}
        >
          <span>Advanced operational details — Recent Pipeline Ingestion Runs Audit Trail</span>
          <span className="badge badge-emerald">Audit Trail Preserved ({runs.length} runs)</span>
        </summary>
        <div style={{ marginTop: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Recent Pipeline Ingestion Runs</h2>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Audited operational executions (discovery checks, dry-run previews, uploads, and downloads) with secret scrubbing
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
      </details>
    </div>
  );
}
