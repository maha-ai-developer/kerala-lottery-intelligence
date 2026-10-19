"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "../lib/i18n";

interface StatsSummary {
  researchDraws: number;
  researchWinningResults: number;
  researchFullTickets: number;
  researchSuffixes: number;
  geoObservations: number;
  districtsCount: number;
  prodDraws: number;
  prodWinningResults: number;
  frozenV1Draws: number;
  frozenV1Results: number;
  totalSchemes: number;
  registeredExperiments: number;
  corpusVersion: string;
  corpusId: string;
  latestDrawDate: string;
}

interface DrawItem {
  id: string;
  lotteryCode: string;
  lotteryName: string;
  drawNumber: number | string;
  drawDate: string;
  totalResults: number;
  sourceDocumentSha256: string;
  prizeSchemeId: string;
  status: string;
}

interface DiscoveryCheckResult {
  success: boolean;
  checkedAt: string;
  officialSourceUrl?: string;
  discoveryStatus:
    | "TODAY_PUBLISHED"
    | "NO_NEW_RESULT"
    | "NOT_YET_PUBLISHED"
    | "NO_SCHEDULED_DRAW"
    | "SOURCE_UNAVAILABLE"
    | "SOURCE_PARSE_ERROR";
  statusExplanation: string;
  todayIst: {
    isoDate: string;
    displayDate: string;
    weekday: string;
    timeIst: string;
  };
  todaySchedule: {
    scheduled: boolean;
    lotteryCode: string | null;
    lotteryName: string | null;
    drawNumber?: string | null;
    drawTimeIst?: string;
    expectedPdfPublicationTimeIst?: string;
    venue?: string | null;
    reason?: string;
  };
  latestOfficialResult: {
    fileName: string;
    sourceUrl?: string;
    title?: string;
    drawDate?: string;
    drawNumber?: string;
    lotteryCode?: string;
    state: "ALREADY_KNOWN" | "NEW" | "PENDING" | "CONFLICT";
    sha256?: string;
  } | null;
  latestCorpusDraw: {
    drawNumber: string;
    lotteryName: string;
    lotteryCode: string;
    drawDate: string;
    isoDate: string;
    sha256: string;
    canonicalFilename: string;
  } | null;
}

interface CandidateRow {
  id: string;
  lotteryCode: string;
  series: string;
  ticketNumber: string;
  label: string;
}

type ShortlistStatus = "KEEP" | "REVIEW_AGAIN" | "REMOVED";

const LOTTERY_SCHEMES = [
  { code: "BT", name: "Bhagyathara (BT)", sampleSeries: "BA" },
  { code: "KN", name: "Karunya Plus (KN)", sampleSeries: "BB" },
  { code: "KR", name: "Karunya (KR)", sampleSeries: "KA" },
  { code: "SM", name: "Samrudhi (SM)", sampleSeries: "MA" },
  { code: "SS", name: "Sthree Sakthi (SS)", sampleSeries: "SA" },
  { code: "DL", name: "Dhanalekshmi (DL)", sampleSeries: "DA" },
  { code: "SW", name: "Suvarna Keralam (SW)", sampleSeries: "WA" }
];

export default function OverviewPage() {
  const { t } = useI18n();
  const [stats, setStats] = useState<StatsSummary>({
    researchDraws: 119,
    researchWinningResults: 45600,
    researchFullTickets: 1728,
    researchSuffixes: 43872,
    geoObservations: 380,
    districtsCount: 14,
    prodDraws: 119,
    prodWinningResults: 45600,
    frozenV1Draws: 114,
    frozenV1Results: 43712,
    totalSchemes: 16,
    registeredExperiments: 3,
    corpusVersion: "active-research-119draws",
    corpusId: "corpus_2dd9b930c32ea047",
    latestDrawDate: "18/10/2026"
  });
  const [recentDraws, setRecentDraws] = useState<DrawItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [searching, setSearching] = useState(false);

  // Step 1: Official Results & Automatic Site-Open Catch-Up Check state
  const [checkingOfficial, setCheckingOfficial] = useState(false);
  const [officialCheck, setOfficialCheck] = useState<DiscoveryCheckResult | null>(null);
  const [catchUpReport, setCatchUpReport] = useState<any | null>(null);
  const [officialCheckError, setOfficialCheckError] = useState<string | null>(null);

  // Step 2: Candidate Entry state
  const [workflowMode, setWorkflowMode] = useState<"SINGLE" | "MULTI">("SINGLE");
  const [singleLottery, setSingleLottery] = useState("BT");
  const [singleSeries, setSingleSeries] = useState("BA");
  const [singleNumber, setSingleNumber] = useState("025916");

  const [multiLottery, setMultiLottery] = useState("KN");
  const [multiCandidates, setMultiCandidates] = useState<CandidateRow[]>([
    { id: "cand-1", lotteryCode: "KN", series: "BB", ticketNumber: "814615", label: "Option A" },
    { id: "cand-2", lotteryCode: "KN", series: "BC", ticketNumber: "004582", label: "Option B" },
    { id: "cand-3", lotteryCode: "KN", series: "BD", ticketNumber: "385012", label: "Option C" }
  ]);
  const [formValidationError, setFormValidationError] = useState<string | null>(null);

  // Step 3: Evidence & Personal Decision state
  const [analyzing, setAnalyzing] = useState(false);
  const [singleEvidence, setSingleEvidence] = useState<any | null>(null);
  const [multiEvidence, setMultiEvidence] = useState<any | null>(null);
  const [shortlistDecisions, setShortlistDecisions] = useState<Record<string, ShortlistStatus>>({});

  const runSiteOpenCatchUpCheck = async (forceRefresh = false) => {
    setCheckingOfficial(true);
    setOfficialCheckError(null);
    try {
      const catchUpRes = await fetch("/api/ops/ingestion/catch-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment: "DEV",
          mode: "DISCOVER",
          source: "site-open",
          forceRefresh
        })
      });
      const catchUpJson = await catchUpRes.json();
      if (catchUpRes.ok && catchUpJson.success) {
        setCatchUpReport(catchUpJson);
        if (catchUpJson.portalNotice) {
          setOfficialCheckError(catchUpJson.portalNotice);
        }
      } else {
        setOfficialCheckError(
          catchUpJson.message || "Unable to complete official catch-up check right now."
        );
      }
    } catch (err: any) {
      setOfficialCheckError(
        err.message || "Network error while checking official results. Preserving verified research corpus."
      );
    } finally {
      setCheckingOfficial(false);
    }
  };

  useEffect(() => {
    async function loadOverviewData() {
      try {
        const [statsRes, drawsRes] = await Promise.all([
          fetch("/api/v1/statistics"),
          fetch("/api/v1/draws?limit=10")
        ]);

        if (statsRes.ok) {
          const statsJson = await statsRes.json();
          const payload = statsJson.data || statsJson;
          const pop = payload.population || payload.corpusSummary || {};
          const active = payload.activeCorpus || {};
          setStats((prev) => ({
            ...prev,
            researchDraws: pop.totalDraws || active.draws || 119,
            researchWinningResults: pop.totalResults || active.totalResults || 45600,
            researchFullTickets: pop.fullTicketCount || 1728,
            researchSuffixes: pop.suffixCount || 43872,
            corpusVersion: payload.corpusVersion || active.version || "active-research-119draws",
            corpusId: payload.corpusId || active.corpusId || "corpus_2dd9b930c32ea047",
            latestDrawDate: payload.dateRange?.latest || active.latestDrawDate || "18/10/2026"
          }));
        }

        if (drawsRes.ok) {
          const drawsJson = await drawsRes.json();
          const rawDraws = drawsJson.data || drawsJson.items || [];
          setRecentDraws(
            rawDraws.map((d: any) => ({
              ...d,
              id: d.id || d.drawId,
              lotteryName: d.lotteryName || d.lotteryCode,
              totalResults: d.totalResults ?? 382,
              sourceDocumentSha256: d.sourceDocumentSha256 || "",
              prizeSchemeId: d.prizeSchemeId || d.schemeVersionId || ""
            }))
          );
        }
      } catch (err) {
        console.error("Failed to load overview data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadOverviewData();
    // Automatic non-mutating catch-up discovery on site open (last verified ingested draw -> current IST date)
    runSiteOpenCatchUpCheck(false);
  }, []);

  const handleCheckOfficialResults = async () => {
    setCheckingOfficial(true);
    setOfficialCheckError(null);
    try {
      const [checkRes, catchUpRes] = await Promise.all([
        fetch("/api/ops/ingestion/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ environment: "DEV", since: "2026-06-01" })
        }),
        fetch("/api/ops/ingestion/catch-up", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            environment: "DEV",
            mode: "DISCOVER",
            source: "site-open",
            forceRefresh: true
          })
        })
      ]);

      const checkJson = await checkRes.json();
      const catchUpJson = await catchUpRes.json();

      if (catchUpRes.ok && catchUpJson.success) {
        setCatchUpReport(catchUpJson);
      }
      if (checkRes.ok && checkJson.success) {
        setOfficialCheck(checkJson);
      } else if (!catchUpRes.ok || !catchUpJson.success) {
        setOfficialCheckError(
          checkJson.message || catchUpJson.message || "Unable to complete official source check right now."
        );
      }
    } catch (err: any) {
      setOfficialCheckError(err.message || "Network error while checking official results.");
    } finally {
      setCheckingOfficial(false);
    }
  };

  const validateSeriesAndNumber = (series: string, num: string): string | null => {
    const cleanSeries = series.trim().toUpperCase();
    const cleanNum = num.trim();
    if (!/^[A-Z]{1,2}$/.test(cleanSeries)) {
      return `Series "${series}" must be 1 or 2 letters (for example BA or BB).`;
    }
    if (!/^\d{6}$/.test(cleanNum)) {
      return `Ticket number "${num}" must be exactly 6 digits (keep leading zeros such as 004582).`;
    }
    return null;
  };

  const handleRunAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormValidationError(null);

    if (workflowMode === "SINGLE") {
      const err = validateSeriesAndNumber(singleSeries, singleNumber);
      if (err) {
        setFormValidationError(err);
        return;
      }

      setAnalyzing(true);
      setMultiEvidence(null);
      try {
        const params = new URLSearchParams({
          lottery: singleLottery.trim().toUpperCase(),
          series: singleSeries.trim().toUpperCase(),
          number: singleNumber.trim()
        });
        const res = await fetch(`/api/v1/research-sandbox?${params.toString()}`);
        const json = await res.json();
        const payload = json.data || json;
        if (!res.ok || payload.error) {
          setFormValidationError(payload.message || json.message || "Analysis request failed.");
        } else {
          setSingleEvidence(payload);
          const key = `${singleLottery}:${singleSeries.trim().toUpperCase()}:${singleNumber.trim()}`;
          setShortlistDecisions((prev) => ({ ...prev, [key]: prev[key] || "KEEP" }));
        }
      } catch (err: any) {
        setFormValidationError(err.message || "Network error while running analysis.");
      } finally {
        setAnalyzing(false);
      }
    } else {
      if (multiCandidates.length < 2 || multiCandidates.length > 10) {
        setFormValidationError("Please enter between 2 and 10 candidate numbers to compare.");
        return;
      }
      for (const row of multiCandidates) {
        const err = validateSeriesAndNumber(row.series, row.ticketNumber);
        if (err) {
          setFormValidationError(`${row.label}: ${err}`);
          return;
        }
      }

      setAnalyzing(true);
      setSingleEvidence(null);
      try {
        const serialized = multiCandidates
          .map(
            (c) =>
              `${multiLottery.trim().toUpperCase()}:${c.series.trim().toUpperCase()}:${c.ticketNumber.trim()}:${encodeURIComponent(c.label.trim() || "Candidate")}`
          )
          .join(",");
        const res = await fetch(`/api/v1/candidate-lab?candidates=${serialized}`);
        const json = await res.json();
        const payload = json.data || json;
        if (!res.ok || payload.error) {
          setFormValidationError(payload.message || json.message || "Candidate comparison failed.");
        } else {
          setMultiEvidence(payload);
          const nextDecisions: Record<string, ShortlistStatus> = { ...shortlistDecisions };
          for (const item of payload.validations || payload.validationSummaries || []) {
            if (!nextDecisions[item.candidateId]) {
              nextDecisions[item.candidateId] = "KEEP";
            }
          }
          setShortlistDecisions(nextDecisions);
        }
      } catch (err: any) {
        setFormValidationError(err.message || "Network error while comparing candidates.");
      } finally {
        setAnalyzing(false);
      }
    }
  };

  const handleAddCandidateRow = () => {
    if (multiCandidates.length >= 10) return;
    const nextIdx = multiCandidates.length + 1;
    const labelChar = String.fromCharCode(64 + nextIdx);
    setMultiCandidates((prev) => [
      ...prev,
      {
        id: `cand-${Date.now()}-${nextIdx}`,
        lotteryCode: multiLottery,
        series: "BA",
        ticketNumber: "000000".slice(0, 6 - String(nextIdx).length) + String(nextIdx),
        label: `Option ${labelChar}`
      }
    ]);
  };

  const handleRemoveCandidateRow = (id: string) => {
    if (multiCandidates.length <= 2) return;
    setMultiCandidates((prev) => prev.filter((c) => c.id !== id));
  };

  const handleUpdateCandidateRow = (id: string, field: "series" | "ticketNumber" | "label", value: string) => {
    setMultiCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const handleDecisionChange = (candidateKey: string, status: ShortlistStatus) => {
    setShortlistDecisions((prev) => ({
      ...prev,
      [candidateKey]: status
    }));
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    setSearching(true);
    try {
      const res = await fetch(`/api/v1/search?q=${encodeURIComponent(searchQuery.trim())}`);
      if (res.ok) {
        const json = await res.json();
        setSearchResults(json.data || json.results || []);
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setSearching(false);
    }
  };

  const latestCorpusDraw = recentDraws.length > 0 ? recentDraws[0] : null;
  const refreshPendingCount = catchUpReport?.counts?.newEligible ?? 0;

  return (
    <div className="container" style={{ padding: "1.75rem 1.25rem" }}>
      {/* Scientific Notice Banner */}
      <div className="scientific-notice" style={{ marginBottom: "1.5rem" }}>
        <strong>SCIENTIFIC & DESCRIPTIVE RESEARCH PLATFORM — VERIFIED OFFICIAL ARCHIVE</strong>
        <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.825rem", color: "var(--text-secondary)" }}>
          Every number and observation on this platform is cryptographically connected to its Government Gazette result PDF,
          prize scheme, rule context, and statistical provenance. {t("decision.mandatoryNotice")}
        </p>
      </div>

      {/* Hero Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
          <h1 style={{ fontSize: "1.65rem", fontWeight: 700, margin: 0 }}>
            {t("home.heroTitle")}
          </h1>
          <span className="badge badge-emerald">Active Corpus: {stats.researchDraws} Draws</span>
          <span className="badge badge-blue">{t("home.heroBadge")}</span>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", margin: 0, maxWidth: "860px" }}>
          {t("home.heroSubtitle")}{" "}
          Currently synchronized with <strong>{stats.researchDraws}</strong> verified draws and{" "}
          <strong>{stats.researchWinningResults.toLocaleString()}</strong> winning results (Frozen V1.0 Baseline preserved at{" "}
          <strong>{stats.frozenV1Draws}</strong> draws / <strong>{stats.frozenV1Results.toLocaleString()}</strong> results).
        </p>
      </div>

      {/* =====================================================================
          MAIN DASHBOARD STATUS BAR (5 KEY QUESTIONS)
         ===================================================================== */}
      <section
        aria-label="Main Dashboard Status Summary"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "0.85rem",
          marginBottom: "1.75rem"
        }}
      >
        {/* 1. Latest Verified Result */}
        <div className="stat-card" style={{ borderLeft: "3px solid var(--accent-emerald)" }}>
          <div className="stat-label">{t("home.status.latestVerified")}</div>
          <div className="stat-value" style={{ fontSize: "1.1rem", color: "var(--accent-emerald)" }}>
            {latestCorpusDraw
              ? `${latestCorpusDraw.lotteryName} (${latestCorpusDraw.drawNumber})`
              : "SAMRUDHI (SM-77th)"}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
            Date: <strong>{latestCorpusDraw?.drawDate || "18/10/2026"}</strong> &bull;{" "}
            <Link
              href={latestCorpusDraw ? `/draws/${latestCorpusDraw.id}` : "/draws/draw_SM-77th"}
              style={{ color: "var(--accent-cyan)", textDecoration: "underline" }}
            >
              Inspect Draw
            </Link>
          </div>
        </div>

        {/* 2. Today's Scheduled Lottery & Publication State */}
        <div className="stat-card" style={{ borderLeft: "3px solid var(--accent-blue)" }}>
          <div className="stat-label">{t("home.status.todayScheduled")}</div>
          <div className="stat-value" style={{ fontSize: "1.05rem", color: "var(--accent-blue)" }}>
            {catchUpReport?.todaySchedule?.lotteryName
              ? `${catchUpReport.todaySchedule.lotteryName} (${catchUpReport.todaySchedule.drawNumber || catchUpReport.todaySchedule.lotteryCode})`
              : officialCheck?.todaySchedule?.lotteryName
                ? `${officialCheck.todaySchedule.lotteryName} (${officialCheck.todaySchedule.drawNumber || officialCheck.todaySchedule.lotteryCode})`
                : "Daily Schedule (3:00 PM IST)"}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
            State:{" "}
            <strong>
              {catchUpReport?.todayStatus?.state ||
                officialCheck?.discoveryStatus ||
                (checkingOfficial ? "Checking..." : "Scheduled (15:00–16:30 IST)")}
            </strong>
          </div>
        </div>

        {/* 3. When Official Sources Were Last Checked */}
        <div className="stat-card" style={{ borderLeft: "3px solid var(--accent-cyan)" }}>
          <div className="stat-label">{t("home.status.lastChecked")}</div>
          <div className="stat-value mono" style={{ fontSize: "0.95rem", color: "var(--accent-cyan)" }}>
            {catchUpReport?.checkedAtIst ||
              officialCheck?.checkedAt ||
              (checkingOfficial ? "Checking LOTIS..." : "Auto-checked on session open")}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
            Bounded read-only check ({catchUpReport?.cacheMeta?.cached ? "5m cache" : "live LOTIS"})
          </div>
        </div>

        {/* 4. Which Corpus Version Is Used for Current Research */}
        <div className="stat-card" style={{ borderLeft: "3px solid var(--accent-purple)" }}>
          <div className="stat-label">{t("home.status.activeCorpus")}</div>
          <div className="stat-value" style={{ fontSize: "1.05rem", color: "var(--accent-purple)" }}>
            {stats.researchDraws} Draws ({stats.researchWinningResults.toLocaleString()} Results)
          </div>
          <div className="mono" style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
            {stats.corpusVersion} ({stats.corpusId})
          </div>
        </div>

        {/* 5. Is Research Refresh Complete or Pending */}
        <div className="stat-card" style={{ borderLeft: "3px solid var(--accent-emerald)" }}>
          <div className="stat-label">{t("home.status.refreshState")}</div>
          <div
            className="stat-value"
            style={{
              fontSize: "1.05rem",
              color: refreshPendingCount > 0 ? "var(--accent-amber)" : "var(--accent-emerald)"
            }}
          >
            {refreshPendingCount > 0 ? t("home.status.refreshPending") : t("home.status.refreshComplete")}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
            {refreshPendingCount > 0
              ? `${refreshPendingCount} new official draw(s) ready for authorized ingestion`
              : "Stats, findings, experiments & sandbox synchronized"}
          </div>
        </div>
      </section>

      {/* =====================================================================
          GUIDED 3-STEP USER WORKFLOW
         ===================================================================== */}
      <section
        aria-label="Guided 3-Step User Workflow"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
          marginBottom: "2.25rem"
        }}
      >
        {/* -----------------------------------------------------------------
            STEP 1 — Check Latest Official Results
            STEP 2 — Enter Candidate Number(s)
            STEP 3 — Understand the Evidence & Decide Personally
            How was this calculated? | personal decision shortlist | Keep in my comparison
           ----------------------------------------------------------------- */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-medium)",
            borderRadius: "0.75rem",
            padding: "1.35rem"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
                <span className="badge badge-blue">STEP 1 OF 3</span>
                <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                  Verify Official Publication & Corpus Status
                </span>
              </div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                {t("home.step1.title")}
              </h2>
              <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", margin: "0.25rem 0 0 0" }}>
                Check the latest officially published Kerala State Lotteries result and today&apos;s scheduled draw status, or upload a result PDF directly.
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCheckOfficialResults}
                disabled={checkingOfficial}
              >
                {checkingOfficial ? "Checking Official Portal..." : "Check Latest Official Results"}
              </button>
              <Link href="/ingestion" className="btn btn-outline">
                Upload Result PDF &rarr;
              </Link>
            </div>
          </div>

          {officialCheckError && (
            <div
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.35)",
                borderRadius: "0.5rem",
                padding: "0.85rem 1rem",
                marginBottom: "1rem",
                fontSize: "0.85rem"
              }}
            >
              <strong>Official Check Notice:</strong> {officialCheckError}{" "}
              You can still browse the verified corpus below or{" "}
              <Link href="/ingestion" style={{ color: "var(--accent-cyan)", textDecoration: "underline" }}>
                upload an official result PDF manually
              </Link>
              .
            </div>
          )}

          <div className="grid-2" style={{ gap: "1rem" }}>
            {/* Card A: Latest Verified Published Result */}
            <div
              style={{
                background: "var(--bg-surface-elevated)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "0.6rem",
                padding: "1rem"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
                  Latest Verified Published Result
                </span>
                <span className="badge badge-emerald">VERIFIED</span>
              </div>

              {officialCheck?.latestOfficialResult ? (
                <div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                    {officialCheck.latestOfficialResult.lotteryCode || "Official Draw"} ({officialCheck.latestOfficialResult.drawNumber})
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                    Draw Date: <strong>{officialCheck.latestOfficialResult.drawDate}</strong> &bull; Status:{" "}
                    <strong>
                      {officialCheck.latestOfficialResult.state === "ALREADY_KNOWN"
                        ? "In Verified Active Corpus"
                        : "Available on Official Portal"}
                    </strong>
                  </div>
                  <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
                    {officialCheck.latestOfficialResult.sha256 && (
                      <Link
                        href={`/sources/${officialCheck.latestOfficialResult.sha256}`}
                        className="btn btn-outline"
                        style={{ fontSize: "0.78rem", padding: "0.3rem 0.65rem" }}
                      >
                        Verified Source PDF &rarr;
                      </Link>
                    )}
                    {officialCheck.latestOfficialResult.sourceUrl && (
                      <a
                        href={officialCheck.latestOfficialResult.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-outline"
                        style={{ fontSize: "0.78rem", padding: "0.3rem 0.65rem" }}
                      >
                        Official Result PDF &nearr;
                      </a>
                    )}
                    {officialCheck.latestOfficialResult.state === "NEW" && (
                      <Link
                        href="/ingestion"
                        className="btn btn-primary"
                        style={{ fontSize: "0.78rem", padding: "0.3rem 0.65rem" }}
                      >
                        Preview & Ingest on Console &rarr;
                      </Link>
                    )}
                  </div>
                </div>
              ) : latestCorpusDraw ? (
                <div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                    {latestCorpusDraw.lotteryName} ({latestCorpusDraw.lotteryCode}-{latestCorpusDraw.drawNumber})
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                    Draw Date: <strong>{latestCorpusDraw.drawDate}</strong> &bull; Winning Numbers:{" "}
                    <strong>{latestCorpusDraw.totalResults}</strong>
                  </div>
                  <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
                    <Link
                      href={`/draws/${latestCorpusDraw.id}`}
                      className="btn btn-outline"
                      style={{ fontSize: "0.78rem", padding: "0.3rem 0.65rem" }}
                    >
                      View Draw Results &rarr;
                    </Link>
                    <Link
                      href={`/sources/${latestCorpusDraw.sourceDocumentSha256}`}
                      className="btn btn-outline"
                      style={{ fontSize: "0.78rem", padding: "0.3rem 0.65rem" }}
                    >
                      Verified Source PDF
                    </Link>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                  Loading latest verified draw from research corpus...
                </div>
              )}
            </div>

            {/* Card B: Today's Scheduled Draw */}
            <div
              style={{
                background: "var(--bg-surface-elevated)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "0.6rem",
                padding: "1rem"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
                  Today&apos;s Scheduled Draw (Asia/Kolkata)
                </span>
                {officialCheck ? (
                  <span
                    className={`badge ${
                      officialCheck.discoveryStatus === "TODAY_PUBLISHED" ||
                      officialCheck.discoveryStatus === "NO_NEW_RESULT"
                        ? "badge-emerald"
                        : officialCheck.discoveryStatus === "NOT_YET_PUBLISHED"
                          ? "badge-blue"
                          : "badge-yellow"
                    }`}
                  >
                    {officialCheck.discoveryStatus}
                  </span>
                ) : catchUpReport?.todayStatus ? (
                  <span
                    className={`badge ${
                      catchUpReport.todayStatus.state === "PUBLISHED_ALREADY_INGESTED" ||
                      catchUpReport.todayStatus.state === "PUBLISHED_INGESTED_THIS_RUN"
                        ? "badge-emerald"
                        : catchUpReport.todayStatus.state === "NOT_PUBLISHED_YET"
                          ? "badge-blue"
                          : "badge-yellow"
                    }`}
                  >
                    {catchUpReport.todayStatus.state}
                  </span>
                ) : (
                  <span className="badge badge-blue">3:00 PM IST Publication</span>
                )}
              </div>

              {officialCheck ? (
                <div>
                  <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)" }}>
                    {officialCheck.todaySchedule.lotteryName
                      ? `${officialCheck.todaySchedule.lotteryName}${
                          officialCheck.todaySchedule.drawNumber
                            ? ` (${officialCheck.todaySchedule.drawNumber})`
                            : officialCheck.todaySchedule.lotteryCode
                              ? ` (${officialCheck.todaySchedule.lotteryCode})`
                              : ""
                        }`
                      : "No Weekly Draw Scheduled"}
                  </div>
                  <div style={{ fontSize: "0.825rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                    Date: <strong>{officialCheck.todayIst.displayDate} ({officialCheck.todayIst.weekday})</strong> &bull; Typical Publication:{" "}
                    <strong>{officialCheck.todaySchedule.expectedPdfPublicationTimeIst || "16:30 IST"}</strong>
                    {officialCheck.todaySchedule.venue ? ` • Venue: ${officialCheck.todaySchedule.venue}` : ""}
                  </div>
                  <div style={{ fontSize: "0.825rem", color: "var(--text-secondary)", marginTop: "0.45rem" }}>
                    {officialCheck.statusExplanation}
                  </div>
                </div>
              ) : catchUpReport?.todaySchedule ? (
                <div>
                  <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)" }}>
                    {catchUpReport.todaySchedule.lotteryName
                      ? `${catchUpReport.todaySchedule.lotteryName}${
                          catchUpReport.todaySchedule.drawNumber
                            ? ` (${catchUpReport.todaySchedule.drawNumber})`
                            : catchUpReport.todaySchedule.lotteryCode
                              ? ` (${catchUpReport.todaySchedule.lotteryCode})`
                              : ""
                        }`
                      : "No Weekly Draw Scheduled"}
                  </div>
                  <div style={{ fontSize: "0.825rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                    Date: <strong>{catchUpReport.currentIst?.displayDate} ({catchUpReport.currentIst?.weekday})</strong> &bull; Typical Publication:{" "}
                    <strong>{catchUpReport.todaySchedule.expectedPdfPublicationTimeIst || "16:30 IST"}</strong>
                    {catchUpReport.todaySchedule.venue ? ` • Venue: ${catchUpReport.todaySchedule.venue}` : ""}
                  </div>
                  <div style={{ fontSize: "0.825rem", color: "var(--text-secondary)", marginTop: "0.45rem" }}>
                    {catchUpReport.todayStatus?.summary}
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                    Checking live publication status from the official Kerala State Lotteries portal (LOTIS) for today&apos;s draw...
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
                    Typical daily publication window: <strong>3:00 PM – 4:30 PM IST</strong>. If you already have today&apos;s official Gazette PDF, you can upload it directly on the{" "}
                    <Link href="/ingestion" style={{ color: "var(--accent-cyan)", textDecoration: "underline" }}>
                      Ingestion Console
                    </Link>
                    .
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Automatic Site-Open Catch-Up Discovery Summary */}
          {catchUpReport && (
            <div
              style={{
                marginTop: "1rem",
                background: "var(--bg-surface-elevated)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "0.6rem",
                padding: "0.9rem 1rem"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.45rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
                    Automatic Site-Open Catch-Up Check
                  </span>
                  <span className="badge badge-emerald">LAST INGESTED → TODAY (IST)</span>
                  {catchUpReport.cacheMeta && (
                    <span className="badge badge-blue">
                      {catchUpReport.cacheMeta.cached ? "CACHED (5m TTL)" : "LIVE CHECK"}
                    </span>
                  )}
                  <span className="badge badge-slate">READ-ONLY DISCOVERY (0 WRITES)</span>
                </div>
                <span className="mono" style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                  Checked: {catchUpReport.checkedAtIst}
                </span>
              </div>

              <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: "0.45rem" }}>
                <strong>Catch-Up Range:</strong>{" "}
                <span className="mono">{catchUpReport.catchUpRange?.formula}</span> &bull;{" "}
                <strong>Last Verified Ingested:</strong>{" "}
                <span className="mono">{catchUpReport.plainLanguageSummary?.lastIngestedResult}</span> &bull;{" "}
                <strong>New Candidates Ready for Ingestion:</strong>{" "}
                <strong>{catchUpReport.counts?.newEligible ?? 0}</strong>
              </div>

              {Array.isArray(catchUpReport.candidates) && catchUpReport.candidates.length > 0 && (
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.4rem" }}>
                  {catchUpReport.candidates.map((cand: any) => (
                    <span
                      key={`${cand.drawNumber}_${cand.isoDate}`}
                      className="mono"
                      style={{
                        fontSize: "0.74rem",
                        padding: "0.25rem 0.55rem",
                        borderRadius: "0.35rem",
                        background: "var(--bg-surface)",
                        border: "1px solid var(--border-subtle)"
                      }}
                    >
                      <strong>{cand.drawNumber}</strong> ({cand.drawDate}):{" "}
                      <span
                        style={{
                          color:
                            cand.candidateStatus === "READY_TO_INGEST"
                              ? "var(--accent-emerald)"
                              : cand.candidateStatus === "ALREADY_INGESTED_VERIFIED"
                                ? "var(--accent-blue)"
                                : "var(--accent-amber)"
                        }}
                      >
                        {cand.candidateStatus || cand.classification}
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* -----------------------------------------------------------------
            STEP 2: ENTER CANDIDATE NUMBER(S)
           ----------------------------------------------------------------- */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-medium)",
            borderRadius: "0.75rem",
            padding: "1.35rem"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
                <span className="badge badge-emerald">STEP 2 OF 3</span>
                <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                  Single Ticket or Multi-Candidate Comparison
                </span>
              </div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                {t("home.step2.title")}
              </h2>
              <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", margin: "0.25rem 0 0 0" }}>
                Select a lottery scheme and enter a single ticket or compare 2 to 10 candidate numbers side by side. Leading zeros (such as <code className="mono">004582</code>) are preserved automatically.
              </p>
            </div>

            {/* Mode Switcher */}
            <div
              role="group"
              aria-label="Analysis mode"
              style={{
                display: "inline-flex",
                background: "var(--bg-surface-elevated)",
                border: "1px solid var(--border-medium)",
                borderRadius: "0.5rem",
                padding: "0.2rem"
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setWorkflowMode("SINGLE");
                  setFormValidationError(null);
                }}
                style={{
                  padding: "0.45rem 0.85rem",
                  borderRadius: "0.375rem",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.825rem",
                  fontWeight: 600,
                  background: workflowMode === "SINGLE" ? "var(--accent-primary)" : "transparent",
                  color: workflowMode === "SINGLE" ? "#ffffff" : "var(--text-secondary)"
                }}
              >
                Single Candidate
              </button>
              <button
                type="button"
                onClick={() => {
                  setWorkflowMode("MULTI");
                  setFormValidationError(null);
                }}
                style={{
                  padding: "0.45rem 0.85rem",
                  borderRadius: "0.375rem",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.825rem",
                  fontWeight: 600,
                  background: workflowMode === "MULTI" ? "var(--accent-primary)" : "transparent",
                  color: workflowMode === "MULTI" ? "#ffffff" : "var(--text-secondary)"
                }}
              >
                Compare Multiple (2–10)
              </button>
            </div>
          </div>

          <form onSubmit={handleRunAnalysis}>
            {workflowMode === "SINGLE" ? (
              <div className="grid-3" style={{ gap: "1rem", alignItems: "end" }}>
                <div>
                  <label
                    htmlFor="single-lottery-select"
                    style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.35rem" }}
                  >
                    Lottery Scheme
                  </label>
                  <select
                    id="single-lottery-select"
                    className="search-input"
                    style={{ width: "100%" }}
                    value={singleLottery}
                    onChange={(e) => {
                      const code = e.target.value;
                      setSingleLottery(code);
                      const found = LOTTERY_SCHEMES.find((s) => s.code === code);
                      if (found) setSingleSeries(found.sampleSeries);
                    }}
                  >
                    {LOTTERY_SCHEMES.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="single-series-input"
                    style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.35rem" }}
                  >
                    Series Code (2 Letters)
                  </label>
                  <input
                    id="single-series-input"
                    type="text"
                    className="search-input mono"
                    style={{ width: "100%", textTransform: "uppercase" }}
                    maxLength={2}
                    placeholder="BA"
                    value={singleSeries}
                    onChange={(e) => setSingleSeries(e.target.value.toUpperCase())}
                  />
                </div>

                <div>
                  <label
                    htmlFor="single-number-input"
                    style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.35rem" }}
                  >
                    6-Digit Ticket Number
                  </label>
                  <input
                    id="single-number-input"
                    type="text"
                    inputMode="numeric"
                    className="search-input mono"
                    style={{ width: "100%" }}
                    maxLength={6}
                    placeholder="004582"
                    value={singleNumber}
                    onChange={(e) => setSingleNumber(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
                  />
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem", marginBottom: "0.85rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap" }}>
                    <label
                      htmlFor="multi-lottery-select"
                      style={{ fontSize: "0.825rem", fontWeight: 600, color: "var(--text-secondary)" }}
                    >
                      Lottery Scheme for Comparison:
                    </label>
                    <select
                      id="multi-lottery-select"
                      className="search-input"
                      style={{ width: "auto", minWidth: "210px" }}
                      value={multiLottery}
                      onChange={(e) => setMultiLottery(e.target.value)}
                    >
                      {LOTTERY_SCHEMES.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={handleAddCandidateRow}
                    disabled={multiCandidates.length >= 10}
                    style={{ fontSize: "0.8rem" }}
                  >
                    + Add Candidate ({multiCandidates.length}/10)
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                  {multiCandidates.map((row, idx) => (
                    <div
                      key={row.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                        gap: "0.65rem",
                        alignItems: "center",
                        background: "var(--bg-surface-elevated)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "0.5rem",
                        padding: "0.75rem"
                      }}
                    >
                      <div>
                        <label style={{ display: "block", fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "0.2rem" }}>
                          Candidate Label #{idx + 1}
                        </label>
                        <input
                          type="text"
                          className="search-input"
                          style={{ width: "100%", padding: "0.4rem 0.6rem", fontSize: "0.85rem" }}
                          value={row.label}
                          onChange={(e) => handleUpdateCandidateRow(row.id, "label", e.target.value)}
                        />
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "0.2rem" }}>
                          Series (2 Letters)
                        </label>
                        <input
                          type="text"
                          className="search-input mono"
                          style={{ width: "100%", padding: "0.4rem 0.6rem", fontSize: "0.85rem", textTransform: "uppercase" }}
                          maxLength={2}
                          value={row.series}
                          onChange={(e) => handleUpdateCandidateRow(row.id, "series", e.target.value.toUpperCase())}
                        />
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "0.2rem" }}>
                          6-Digit Number
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="search-input mono"
                          style={{ width: "100%", padding: "0.4rem 0.6rem", fontSize: "0.85rem" }}
                          maxLength={6}
                          value={row.ticketNumber}
                          onChange={(e) =>
                            handleUpdateCandidateRow(
                              row.id,
                              "ticketNumber",
                              e.target.value.replace(/[^\d]/g, "").slice(0, 6)
                            )
                          }
                        />
                      </div>

                      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "flex-end", height: "100%" }}>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => handleRemoveCandidateRow(row.id)}
                          disabled={multiCandidates.length <= 2}
                          style={{ fontSize: "0.75rem", padding: "0.35rem 0.65rem" }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {formValidationError && (
              <div
                role="alert"
                style={{
                  marginTop: "0.85rem",
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.35)",
                  borderRadius: "0.5rem",
                  padding: "0.75rem 1rem",
                  fontSize: "0.85rem",
                  color: "var(--text-primary)"
                }}
              >
                <strong>Input Validation Error:</strong> {formValidationError}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem", marginTop: "1rem" }}>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                <button type="submit" className="btn btn-primary" disabled={analyzing}>
                  {analyzing
                    ? "Computing Historical Evidence..."
                    : workflowMode === "SINGLE"
                      ? "Check Historical Evidence (Step 3)"
                      : `Compare ${multiCandidates.length} Candidates (Step 3)`}
                </button>
                {workflowMode === "SINGLE" && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ fontSize: "0.8rem" }}
                    onClick={() => {
                      setSingleLottery("BT");
                      setSingleSeries("BA");
                      setSingleNumber("004582");
                    }}
                  >
                    Try Leading-Zero Example (004582)
                  </button>
                )}
              </div>

              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", fontSize: "0.825rem" }}>
                <Link href="/research-sandbox" style={{ color: "var(--accent-cyan)", textDecoration: "underline" }}>
                  Full Interactive Research Sandbox &rarr;
                </Link>
                <Link href="/candidate-lab" style={{ color: "var(--accent-cyan)", textDecoration: "underline" }}>
                  Full Candidate Comparison Lab &rarr;
                </Link>
              </div>
            </div>
          </form>
        </div>

        {/* -----------------------------------------------------------------
            STEP 3: UNDERSTAND THE EVIDENCE & DECIDE PERSONALLY
           ----------------------------------------------------------------- */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-medium)",
            borderRadius: "0.75rem",
            padding: "1.35rem"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
                <span className="badge badge-purple">STEP 3 OF 3</span>
                <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                  Plain-Language Historical Evidence &amp; Personal Decision Workspace
                </span>
              </div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                {t("home.step3.title")}
              </h2>
              <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", margin: "0.25rem 0 0 0" }}>
                {t("notice.nonPredictive")}
              </p>
            </div>
          </div>

          {!singleEvidence && !multiEvidence ? (
            <div
              style={{
                background: "var(--bg-surface-elevated)",
                border: "1px dashed var(--border-medium)",
                borderRadius: "0.6rem",
                padding: "1.25rem",
                fontSize: "0.9rem",
                color: "var(--text-secondary)"
              }}
            >
              Submit a single ticket or multiple candidates in <strong>Step 2</strong> above to view:
              <ul style={{ margin: "0.5rem 0 0 1.25rem", padding: 0 }}>
                <li>Rule &amp; series validation against official Kerala State Lottery scheme rules</li>
                <li>Exact historical prize matches across {stats.researchDraws} verified draws ({stats.researchWinningResults.toLocaleString()} winning records)</li>
                <li>Terminal digit frequency vs expected uniform 10%, digit sum percentile, and odd/even balance</li>
                <li>2-digit, 3-digit, and 4-digit suffix appearances in the verified corpus</li>
                <li>Transparent Personal Decision Guide (Keep in comparison, Review again, or Remove)</li>
              </ul>
            </div>
          ) : singleEvidence ? (
            /* SINGLE CANDIDATE EVIDENCE VIEW */
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Plain-Language Summary & Validity Criteria Banner */}
              {(() => {
                const isValid = Boolean(singleEvidence.validation?.isValid);
                const hasWarnings = (singleEvidence.validation?.warnings?.length || 0) > 0;
                const statusLabel = !isValid
                  ? "Does not meet the selected criteria"
                  : hasWarnings
                    ? "Review the evidence"
                    : "Meets the selected validity criteria";
                const statusBadgeClass = !isValid
                  ? "badge-red"
                  : hasWarnings
                    ? "badge-yellow"
                    : "badge-emerald";

                return (
                  <div
                    style={{
                      background: "var(--bg-surface-elevated)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "0.6rem",
                      padding: "1rem"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.5rem" }}>
                      <div style={{ fontSize: "1.1rem", fontWeight: 700 }} className="mono">
                        Candidate: {singleEvidence.input?.lotteryCode}-{singleEvidence.input?.series}-{singleEvidence.input?.ticketNumber}
                      </div>
                      <span className={`badge ${statusBadgeClass}`}>
                        {statusLabel}
                      </span>
                    </div>
                    <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem", color: "var(--text-primary)" }}>
                      {singleEvidence.researchInterpretation?.summary}
                    </p>
                    <p style={{ margin: 0, fontSize: "0.825rem", color: "var(--text-secondary)" }}>
                      {singleEvidence.researchInterpretation?.explanation}
                    </p>
                    {!isValid && singleEvidence.validation?.errors?.length > 0 && (
                      <div style={{ marginTop: "0.65rem", padding: "0.6rem 0.85rem", background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.35)", borderRadius: "0.45rem", fontSize: "0.82rem", color: "#fca5a5" }}>
                        <strong>Validation Issues:</strong> {singleEvidence.validation.errors.join(" ")}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* 4 Key Evidence Cards (rendered when historicalComparison & featureProfile are present) */}
              {singleEvidence.historicalComparison && singleEvidence.featureProfile && (
                <div className="grid-4" style={{ gap: "0.85rem" }}>
                  <div className="stat-card">
                    <div className="stat-label">Exact Full-Ticket Match</div>
                    <div className="stat-value" style={{ fontSize: "1.25rem" }}>
                      {singleEvidence.historicalComparison.exactTicketMatch?.observedInCorpus
                        ? `${singleEvidence.historicalComparison.exactTicketMatch.matchCount} Match(es)`
                        : "0 Matches"}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                      Checked across {(singleEvidence.historicalComparison.fullTicketSampleSize ?? 0).toLocaleString()} full winning tickets
                    </div>
                    {(singleEvidence.historicalComparison.exactTicketMatch?.matches?.length || 0) > 0 && (
                      <div style={{ marginTop: "0.4rem", display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                        {singleEvidence.historicalComparison.exactTicketMatch.matches.map((m: any, i: number) => (
                          <Link
                            key={i}
                            href={`/draws/${m.drawId}`}
                            className="badge badge-emerald"
                            style={{ textDecoration: "underline" }}
                          >
                            {m.drawId} ({m.prizeTierName})
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="stat-card">
                    <div className="stat-label">Terminal Digit ({singleEvidence.featureProfile.lastDigit})</div>
                    <div className="stat-value" style={{ fontSize: "1.25rem" }}>
                      {((singleEvidence.historicalComparison.lastDigitComparison?.empiricalFrequency ?? 0.1) * 100).toFixed(2)}%
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                      Expected uniform baseline: <strong>10.00%</strong> ({(singleEvidence.historicalComparison.lastDigitComparison?.observedCount ?? 0).toLocaleString()} observed)
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-label">Digit Sum &amp; Balance</div>
                    <div className="stat-value" style={{ fontSize: "1.25rem" }}>
                      Sum {singleEvidence.featureProfile.digitSum} ({singleEvidence.featureProfile.parityBalance})
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                      Percentile: <strong>{Number(singleEvidence.historicalComparison.digitSumComparison?.empiricalPercentile ?? 50).toFixed(1)}%</strong> within 0–54 ({singleEvidence.featureProfile.uniqueDigitCount} unique digits)
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-label">Suffix Appearances (2 / 3 / 4-Digit)</div>
                    <div className="stat-value mono" style={{ fontSize: "1.1rem" }}>
                      -{singleEvidence.featureProfile.suffix2}: {singleEvidence.historicalComparison.suffixComparisons?.suffix2?.observedCount ?? 0} | -{singleEvidence.featureProfile.suffix4}: {singleEvidence.historicalComparison.suffixComparisons?.suffix4?.observedCount ?? 0}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                      3-digit (-{singleEvidence.featureProfile.suffix3}): {singleEvidence.historicalComparison.suffixComparisons?.suffix3?.observedCount ?? 0} appearances in {singleEvidence.historicalComparison.sampleSizeDraws} draws
                    </div>
                  </div>
                </div>
              )}

              {/* Personal Decision Guide for Single Candidate */}
              {(() => {
                const candidateKey = `${singleEvidence.input?.lotteryCode}:${singleEvidence.input?.series}:${singleEvidence.input?.ticketNumber}`;
                const status = shortlistDecisions[candidateKey] || (singleEvidence.validation?.isValid ? "KEEP" : "REVIEW_AGAIN");
                const guideStatusLabel = !singleEvidence.validation?.isValid
                  ? "Does not meet the selected criteria"
                  : status === "KEEP"
                    ? "Meets the selected validity criteria"
                    : status === "REVIEW_AGAIN"
                      ? "Review the evidence"
                      : "Removed from personal shortlist";
                return (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "0.75rem",
                      background: "var(--bg-surface-elevated)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "0.6rem",
                      padding: "0.95rem 1.1rem"
                    }}
                  >
                    <div style={{ maxWidth: "680px" }}>
                      <div style={{ fontSize: "0.88rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                        <span>Personal Decision Guide for <span className="mono">{candidateKey}</span>:</span>
                        <span className={`badge ${status === "KEEP" && singleEvidence.validation?.isValid ? "badge-emerald" : status === "REVIEW_AGAIN" ? "badge-yellow" : "badge-blue"}`}>
                          {guideStatusLabel}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                        {t("notice.nonPredictive")}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className={status === "KEEP" ? "btn btn-primary" : "btn btn-outline"}
                        style={{ fontSize: "0.78rem", padding: "0.35rem 0.7rem" }}
                        onClick={() => handleDecisionChange(candidateKey, "KEEP")}
                      >
                        Keep in my comparison
                      </button>
                      <button
                        type="button"
                        className={status === "REVIEW_AGAIN" ? "btn btn-primary" : "btn btn-outline"}
                        style={{ fontSize: "0.78rem", padding: "0.35rem 0.7rem" }}
                        onClick={() => handleDecisionChange(candidateKey, "REVIEW_AGAIN")}
                      >
                        Review again
                      </button>
                      <button
                        type="button"
                        className={status === "REMOVED" ? "btn btn-primary" : "btn btn-outline"}
                        style={{ fontSize: "0.78rem", padding: "0.35rem 0.7rem" }}
                        onClick={() => handleDecisionChange(candidateKey, "REMOVED")}
                      >
                        Remove from comparison
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Expandable Advanced Technical & Provenance Details */}
              <details
                style={{
                  background: "var(--bg-surface-elevated)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "0.6rem",
                  padding: "0.85rem 1rem"
                }}
              >
                <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.875rem", color: "var(--accent-cyan)" }}>
                  {t("label.advancedDetails")} (Dataset scope, confidence intervals &amp; audit hash)
                </summary>
                <div style={{ marginTop: "0.75rem", fontSize: "0.825rem", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {singleEvidence.historicalComparison && (
                    <>
                      <div>
                        <strong>Corpus Scope:</strong> Evaluated against {singleEvidence.historicalComparison.sampleSizeDraws} verified draws and{" "}
                        {(singleEvidence.historicalComparison.sampleSizeResults ?? 0).toLocaleString()} winning entries ({singleEvidence.historicalComparison.corpusVersion}).
                      </div>
                      {singleEvidence.historicalComparison.lastDigitComparison?.wilsonConfidenceInterval95 && (
                        <div>
                          <strong>Terminal Digit 95% Wilson Confidence Interval:</strong> [
                          {(singleEvidence.historicalComparison.lastDigitComparison.wilsonConfidenceInterval95[0] * 100).toFixed(2)}%,{" "}
                          {(singleEvidence.historicalComparison.lastDigitComparison.wilsonConfidenceInterval95[1] * 100).toFixed(2)}%]
                        </div>
                      )}
                    </>
                  )}
                  <div>
                    <strong>Exposure Limitation:</strong> {singleEvidence.limitations?.exposureLimitation}
                  </div>
                  <div>
                    <strong>Deterministic Audit Hash:</strong>{" "}
                    <code className="mono">{singleEvidence.provenance?.auditSha256 || singleEvidence.deterministicHash}</code>
                  </div>
                </div>
              </details>
            </div>
          ) : (
            /* MULTI-CANDIDATE EVIDENCE VIEW */
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div
                style={{
                  background: "var(--bg-surface-elevated)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "0.6rem",
                  padding: "1rem"
                }}
              >
                <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "0.35rem" }}>
                  Side-by-Side Comparison Summary ({multiEvidence.candidateCount} Candidates)
                </div>
                <p style={{ margin: "0 0 0.35rem 0", fontSize: "0.875rem", color: "var(--text-primary)" }}>
                  {multiEvidence.researchInterpretation?.summary}
                </p>
                <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  {multiEvidence.seriesComparison?.criticalExposureNotice || t("notice.nonPredictive")}
                </p>
              </div>

              {/* Comparison Table (scrollable on mobile, full width on desktop) */}
              <div className="table-container">
                <table className="research-table">
                  <thead>
                    <tr>
                      <th>Candidate &amp; Status</th>
                      <th>Ticket</th>
                      <th>Exact Matches</th>
                      <th>Terminal Digit Freq</th>
                      <th>Digit Sum (Pct)</th>
                      <th>Parity &amp; Unique</th>
                      <th>4-Digit / 2-Digit Suffix</th>
                      <th>Personal Decision Guide</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(multiEvidence.tradeOffAnalysis?.comparisonMatrix || []).map((row: any) => {
                      const hist = (multiEvidence.historicalComparisons || []).find(
                        (h: any) => h.candidateId === row.candidateId
                      );
                      const feat = (multiEvidence.featureProfiles || []).find(
                        (f: any) => f.candidateId === row.candidateId
                      );
                      const valSummary = (multiEvidence.validationSummaries || []).find(
                        (v: any) => v.candidateId === row.candidateId
                      );
                      const isValid = valSummary ? Boolean(valSummary.validation?.isValid) : true;
                      const isDup = Boolean(valSummary?.isDuplicate);
                      const decision = shortlistDecisions[row.candidateId] || (isValid && !isDup ? "KEEP" : "REVIEW_AGAIN");
                      const criteriaLabel = !isValid
                        ? "Does not meet criteria"
                        : isDup || decision === "REVIEW_AGAIN"
                          ? "Review the evidence"
                          : decision === "KEEP"
                            ? "Meets validity criteria"
                            : "Removed from shortlist";

                      return (
                        <tr
                          key={row.candidateId}
                          style={{
                            opacity: decision === "REMOVED" ? 0.55 : 1
                          }}
                        >
                          <td style={{ fontWeight: 700 }}>
                            {row.label}
                            <div style={{ marginTop: "0.2rem" }}>
                              <span
                                className={`badge ${
                                  !isValid
                                    ? "badge-red"
                                    : decision === "KEEP" && !isDup
                                      ? "badge-emerald"
                                      : decision === "REVIEW_AGAIN" || isDup
                                        ? "badge-yellow"
                                        : "badge-blue"
                                }`}
                              >
                                {criteriaLabel}
                              </span>
                            </div>
                          </td>
                          <td className="mono" style={{ fontWeight: 600 }}>
                            {row.series}-{row.ticketNumber}
                          </td>
                          <td>
                            {row.exactHistoricalMatches > 0 ? (
                              <div>
                                <span className="badge badge-emerald">{row.exactHistoricalMatches} match(es)</span>
                                {hist?.exactMatch?.matches?.map((m: any, idx: number) => (
                                  <div key={idx} style={{ marginTop: "0.2rem" }}>
                                    <Link
                                      href={`/draws/${m.drawId}`}
                                      style={{ fontSize: "0.75rem", color: "var(--accent-cyan)", textDecoration: "underline" }}
                                    >
                                      {m.drawId}
                                    </Link>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span style={{ fontSize: "0.825rem", color: "var(--text-secondary)" }}>0 in corpus</span>
                            )}
                          </td>
                          <td>
                            <strong>{Number(row.terminalDigitFreqPercent ?? 10).toFixed(2)}%</strong>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>vs 10.0% uniform</div>
                          </td>
                          <td>
                            <strong>{row.digitSum}</strong> ({Number(row.digitSumPercentile ?? 50).toFixed(1)}%)
                          </td>
                          <td>
                            <span className="mono">{row.parityBalance}</span>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                              {feat?.profile?.uniqueDigitCount ?? "-"} unique digits
                            </div>
                          </td>
                          <td className="mono" style={{ fontSize: "0.8rem" }}>
                            -{feat?.profile?.suffix4 || "----"}: {hist?.suffix4?.observedCount ?? 0} | -{feat?.profile?.suffix2 || "--"}: {hist?.suffix2?.observedCount ?? 0}
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                              <button
                                type="button"
                                className={decision === "KEEP" ? "btn btn-primary" : "btn btn-outline"}
                                style={{ fontSize: "0.72rem", padding: "0.25rem 0.5rem" }}
                                onClick={() => handleDecisionChange(row.candidateId, "KEEP")}
                              >
                                Keep in my comparison
                              </button>
                              <button
                                type="button"
                                className={decision === "REVIEW_AGAIN" ? "btn btn-primary" : "btn btn-outline"}
                                style={{ fontSize: "0.72rem", padding: "0.25rem 0.5rem" }}
                                onClick={() => handleDecisionChange(row.candidateId, "REVIEW_AGAIN")}
                              >
                                Review again
                              </button>
                              <button
                                type="button"
                                className={decision === "REMOVED" ? "btn btn-primary" : "btn btn-outline"}
                                style={{ fontSize: "0.72rem", padding: "0.25rem 0.5rem" }}
                                onClick={() => handleDecisionChange(row.candidateId, "REMOVED")}
                              >
                                Remove from comparison
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <details
                style={{
                  background: "var(--bg-surface-elevated)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "0.6rem",
                  padding: "0.85rem 1rem"
                }}
              >
                <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.875rem", color: "var(--accent-cyan)" }}>
                  {t("label.advancedDetails")} (Methodology, corpus scope &amp; comparison hash)
                </summary>
                <div style={{ marginTop: "0.75rem", fontSize: "0.825rem", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <div>{multiEvidence.tradeOffAnalysis?.nonPredictiveNotice}</div>
                  <div>{multiEvidence.researchInterpretation?.globalNotice}</div>
                  <div>
                    <strong>Corpus Version:</strong>{" "}
                    <code className="mono">{multiEvidence.provenance?.corpusVersion || stats.corpusVersion}</code>
                  </div>
                  <div>
                    <strong>Deterministic Comparison Hash:</strong>{" "}
                    <code className="mono">{multiEvidence.provenance?.auditSha256 || multiEvidence.deterministicHash}</code>
                  </div>
                </div>
              </details>
            </div>
          )}
        </div>
      </section>

      {/* Core Platform Corpus & Baseline Summary Grid */}
      <div className="grid-4" style={{ gap: "1rem", marginBottom: "2rem" }}>
        <div className="stat-card" style={{ borderLeft: "3px solid var(--accent-cyan)" }}>
          <div className="stat-label">Active Research Corpus</div>
          <div className="stat-value" style={{ color: "var(--accent-cyan)" }}>
            {stats.researchDraws} Draws
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
            {stats.researchWinningResults.toLocaleString()} results ({stats.researchFullTickets.toLocaleString()} full, {stats.researchSuffixes.toLocaleString()} suffix)
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: "3px solid var(--accent-emerald)" }}>
          <div className="stat-label">Geographic Observations</div>
          <div className="stat-value" style={{ color: "var(--accent-emerald)" }}>
            {stats.geoObservations} Observed
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
            All {stats.districtsCount} Kerala revenue districts represented (Curated 103-draw snapshot)
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: "3px solid var(--accent-purple)" }}>
          <div className="stat-label">Active Research Baselines</div>
          <div className="stat-value" style={{ color: "var(--accent-purple)" }}>
            {stats.registeredExperiments} Registered
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
            EXP-001 (Uniform), EXP-002 (Empirical), EXP-003 (Majority)
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: "3px solid var(--accent-amber)" }}>
          <div className="stat-label">Frozen V1.0 Baseline</div>
          <div className="stat-value" style={{ color: "var(--accent-amber)" }}>
            {stats.frozenV1Draws} Draws
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
            {stats.frozenV1Results.toLocaleString()} results | Cutoff: <strong>13/10/2026</strong>
          </div>
        </div>
      </div>

      {/* Interactive Research Sandbox & Candidate Comparison Lab Callout Card */}
      <div
        style={{
          background: "var(--bg-surface-elevated)",
          border: "1px solid rgba(56, 189, 248, 0.35)",
          borderRadius: "0.75rem",
          padding: "1.5rem",
          marginBottom: "2rem"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
              <span className="badge badge-blue">Deep-Dive Tools</span>
              <span className="badge badge-emerald">Deterministic Analysis</span>
            </div>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
              Interactive Research Sandbox &amp; Candidate Comparison Lab
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginTop: "0.35rem", marginBottom: 0, maxWidth: "780px" }}>
              Open the dedicated Interactive Research Sandbox or the Candidate Comparison Lab for full confidence-interval breakdowns,
              prize-scheme rule traces, and multi-ticket matrix exports.
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
            <Link
              href="/research-sandbox"
              className="btn btn-primary"
              style={{ padding: "0.6rem 1.25rem", fontSize: "0.95rem", fontWeight: 600 }}
            >
              Launch Research Sandbox &rarr;
            </Link>
            <Link
              href="/candidate-lab"
              className="btn btn-outline"
              style={{ padding: "0.6rem 1.25rem", fontSize: "0.95rem", fontWeight: 600, borderColor: "var(--accent-primary)", color: "var(--accent-primary)" }}
            >
              Candidate Comparison Lab &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Surface Navigation Cards Grid */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: "0.75rem", textTransform: "uppercase" }}>
          Explore Research Surfaces:
        </div>
        <div className="grid-3" style={{ gap: "1rem" }}>
          <Link
            href="/results"
            style={{
              display: "block",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-medium)",
              borderRadius: "0.5rem",
              padding: "1.25rem",
              textDecoration: "none",
              color: "inherit"
            }}
          >
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--accent-cyan)", marginBottom: "0.25rem" }}>
              Official Results &amp; Draws &rarr;
            </div>
            <div style={{ fontSize: "0.825rem", color: "var(--text-secondary)" }}>
              Browse all {stats.researchDraws} verified official draws, winning tickets, and official source PDFs.
            </div>
          </Link>

          <Link
            href="/statistics"
            style={{
              display: "block",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-medium)",
              borderRadius: "0.5rem",
              padding: "1.25rem",
              textDecoration: "none",
              color: "inherit"
            }}
          >
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--accent-emerald)", marginBottom: "0.25rem" }}>
              Descriptive Statistics &rarr;
            </div>
            <div style={{ fontSize: "0.825rem", color: "var(--text-secondary)" }}>
              Empirical marginal digit distributions, chi-square uniformity tests, and Shannon entropy metrics across {stats.researchWinningResults.toLocaleString()} results.
            </div>
          </Link>

          <Link
            href="/experiments"
            style={{
              display: "block",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-medium)",
              borderRadius: "0.5rem",
              padding: "1.25rem",
              textDecoration: "none",
              color: "inherit"
            }}
          >
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--accent-purple)", marginBottom: "0.25rem" }}>
              Formal Experiments &rarr;
            </div>
            <div style={{ fontSize: "0.825rem", color: "var(--text-secondary)" }}>
              Deterministic model runs under strict chronological holdout splits and zero temporal leakage.
            </div>
          </Link>

          <Link
            href="/findings"
            style={{
              display: "block",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-medium)",
              borderRadius: "0.5rem",
              padding: "1.25rem",
              textDecoration: "none",
              color: "inherit"
            }}
          >
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--accent-cyan)", marginBottom: "0.25rem" }}>
              Findings &amp; Evidence &rarr;
            </div>
            <div style={{ fontSize: "0.825rem", color: "var(--text-secondary)" }}>
              Peer-reviewable evidence bundles and publication reports tracing claims to verified sources.
            </div>
          </Link>

          <Link
            href="/geography"
            style={{
              display: "block",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-medium)",
              borderRadius: "0.5rem",
              padding: "1.25rem",
              textDecoration: "none",
              color: "inherit"
            }}
          >
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--accent-emerald)", marginBottom: "0.25rem" }}>
              Geography &amp; Exposure &rarr;
            </div>
            <div style={{ fontSize: "0.825rem", color: "var(--text-secondary)" }}>
              Audit of 380 published major-prize observations across 14 revenue districts and exposure limitation analysis.
            </div>
          </Link>

          <Link
            href="/schemes"
            style={{
              display: "block",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-medium)",
              borderRadius: "0.5rem",
              padding: "1.25rem",
              textDecoration: "none",
              color: "inherit"
            }}
          >
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--accent-purple)", marginBottom: "0.25rem" }}>
              Prize Schemes Registry &rarr;
            </div>
            <div style={{ fontSize: "0.825rem", color: "var(--text-secondary)" }}>
              Authoritative Government Gazette / S.R.O. rules, tier rules, prize semantics, and series scopes.
            </div>
          </Link>
        </div>
      </div>

      {/* Search Bar */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-medium)",
          borderRadius: "0.75rem",
          padding: "1.25rem",
          marginBottom: "2rem"
        }}
      >
        <form onSubmit={handleSearch} style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          <input
            type="text"
            className="search-input"
            placeholder="Search draws (e.g. SM-77, KR-772, BT-73), ticket numbers (e.g. 025916, 0276), or SHA-256..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={searching}>
            {searching ? "Searching..." : "Search"}
          </button>
          {searchResults && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setSearchQuery("");
                setSearchResults(null);
              }}
            >
              Clear
            </button>
          )}
        </form>

        {/* Search Results Display */}
        {searchResults && (
          <div style={{ marginTop: "1rem", borderTop: "1px solid var(--border-subtle)", paddingTop: "1rem" }}>
            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
              Found {searchResults.length} matching entities:
            </div>
            {searchResults.length === 0 ? (
              <div style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                No records matched &quot;{searchQuery}&quot;. Try a draw code (SM-77, BT-73), lottery name, or ticket number.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {searchResults.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.75rem 1rem",
                      background: "var(--bg-surface-elevated)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "0.5rem"
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span className="badge badge-blue">{item.type}</span>
                        <span style={{ fontWeight: 600 }}>{item.title}</span>
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                        {item.description}
                      </div>
                    </div>
                    <Link href={item.url} className="btn btn-outline" style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem" }}>
                      View &rarr;
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recent Draws Table */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div>
            <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>Recent Verified Official Draws</h2>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Showing the latest official draws from the active {stats.researchDraws}-draw verified corpus
            </div>
          </div>
          <Link href="/results" className="btn btn-outline" style={{ fontSize: "0.85rem" }}>
            View All Results &rarr;
          </Link>
        </div>

        <div className="table-container">
          <table className="research-table">
            <thead>
              <tr>
                <th>Lottery</th>
                <th>Draw #</th>
                <th>Draw Date</th>
                <th>Winning Results</th>
                <th>Official Source PDF</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "2rem" }}>
                    Loading recent verified draws...
                  </td>
                </tr>
              ) : recentDraws.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "2rem" }}>
                    No draws found.
                  </td>
                </tr>
              ) : (
                recentDraws.map((d) => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 600 }}>{d.lotteryName} ({d.lotteryCode})</td>
                    <td><span className="mono">#{d.drawNumber}</span></td>
                    <td>{d.drawDate}</td>
                    <td>
                      <span className="badge badge-emerald">
                        {d.totalResults} results
                      </span>
                    </td>
                    <td>
                      <Link
                        href={`/sources/${d.sourceDocumentSha256}`}
                        className="mono"
                        style={{ fontSize: "0.78rem", color: "var(--accent-cyan)", textDecoration: "underline" }}
                        title={d.sourceDocumentSha256}
                      >
                        Verified PDF ({d.sourceDocumentSha256.slice(0, 8)}...)
                      </Link>
                    </td>
                    <td>
                      <Link href={`/draws/${d.id}`} className="btn btn-outline" style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}>
                        View Draw &rarr;
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expandable Advanced Technical & Provenance Details (Benchmark Anchor & Corpus Versions) */}
      <details
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-medium)",
          borderRadius: "0.75rem",
          padding: "1.15rem 1.35rem",
          marginBottom: "2rem"
        }}
      >
        <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: "0.95rem", color: "var(--accent-cyan)" }}>
          {t("label.advancedDetails")} — Corpus Versions, Provenance &amp; Canonical Benchmark (BT-73)
        </summary>
        <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="grid-3" style={{ fontSize: "0.85rem" }}>
            <div style={{ background: "var(--bg-surface-elevated)", padding: "0.875rem", borderRadius: "0.5rem", border: "1px solid var(--border-subtle)" }}>
              <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>Active Corpus Version</div>
              <div className="mono" style={{ color: "var(--accent-cyan)", fontSize: "0.85rem", marginTop: "0.25rem" }}>
                {stats.corpusVersion}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.15rem" }}>
                {stats.researchDraws} draws | {stats.researchWinningResults.toLocaleString()} results (through {stats.latestDrawDate})
              </div>
            </div>
            <div style={{ background: "var(--bg-surface-elevated)", padding: "0.875rem", borderRadius: "0.5rem", border: "1px solid var(--border-subtle)" }}>
              <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>Frozen V1.0 Baseline</div>
              <div className="mono" style={{ color: "var(--accent-amber)", fontSize: "0.85rem", marginTop: "0.25rem" }}>
                corpus_333b70f1d5e19ec6
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.15rem" }}>
                {stats.frozenV1Draws} draws | {stats.frozenV1Results.toLocaleString()} results (cutoff 13/10/2026)
              </div>
            </div>
            <div style={{ background: "var(--bg-surface-elevated)", padding: "0.875rem", borderRadius: "0.5rem", border: "1px solid var(--border-subtle)" }}>
              <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>Anchor Case Study: BHAGYATHARA BT-73</div>
              <div className="mono" style={{ color: "var(--accent-emerald)", fontSize: "0.8rem", marginTop: "0.25rem" }}>
                scheme_ver_bt_2025_11_sro1297
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem", display: "flex", gap: "0.5rem" }}>
                <Link href="/draws/kl-bt-73-2026-09-28" style={{ color: "var(--accent-cyan)", textDecoration: "underline" }}>
                  Inspect BT-73
                </Link>
                <span>|</span>
                <Link href="/sources/cddb3d4d05c102b98f38050ac1ff297ad15bc442b12087c0505927f7bb1cf3dc" style={{ color: "var(--accent-cyan)", textDecoration: "underline" }}>
                  Source PDF (cddb3d4d...)
                </Link>
              </div>
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}
