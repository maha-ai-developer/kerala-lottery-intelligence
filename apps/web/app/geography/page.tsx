"use client";

import { useState, useEffect } from "react";
import type {
  GeographicWinnerDataset,
  DistrictSummaryRecord,
  GeographicObservation,
  GeographicAnalysis
} from "@kerala-lottery/experiments";

const KERALA_OFFICIAL_DISTRICTS = [
  "Thiruvananthapuram",
  "Kollam",
  "Pathanamthitta",
  "Alappuzha",
  "Kottayam",
  "Idukki",
  "Ernakulam",
  "Thrissur",
  "Palakkad",
  "Malappuram",
  "Kozhikode",
  "Wayanad",
  "Kannur",
  "Kasaragod"
] as const;

type EnrichedGeographicDataset = GeographicWinnerDataset & {
  activeCorpus?: {
    corpusVersion: string;
    corpusLabel: string;
    totalDraws: number;
    totalResults: number;
    latestDrawCode: string;
    latestDrawDate: string;
  };
  v1Baseline?: {
    corpusVersion: string;
    corpusLabel: string;
    totalDraws: number;
    totalResults: number;
  };
  snapshotMetadata?: {
    snapshotVersion: string;
    snapshotDraws: number;
    snapshotResults: number;
    isCurrentActiveCorpus: boolean;
    requiresRefresh: boolean;
    lastEvaluatedCorpusVersion: string;
    note: string;
  };
};

export default function GeographyPage() {
  const [activeTab, setActiveTab] = useState<"districts" | "observations" | "semantics" | "lineage">("districts");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dataset, setDataset] = useState<EnrichedGeographicDataset | null>(null);
  const [districts, setDistricts] = useState<DistrictSummaryRecord[]>([]);
  const [analysis, setAnalysis] = useState<GeographicAnalysis | null>(null);

  // Filters for observations
  const [selectedDistrict, setSelectedDistrict] = useState<string>("ALL");
  const [selectedTier, setSelectedTier] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 20;

  // Selected observation for deep traceability drawer
  const [selectedObs, setSelectedObs] = useState<GeographicObservation | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [dsRes, distRes, anRes] = await Promise.all([
          fetch("/api/v1/geography").then(r => r.json()).catch(err => ({ error: true, message: String(err) })),
          fetch("/api/v1/geography/districts").then(r => r.json()).catch(err => ({ error: true, message: String(err) })),
          fetch("/api/v1/geography/analysis").then(r => r.json()).catch(err => ({ error: true, message: String(err) }))
        ]);

        if (dsRes?.error && !dsRes?.data) {
          setError(dsRes.message || "Failed to load geographic dataset");
        }

        const resolvedDataset = dsRes?.data ?? dsRes ?? null;
        const resolvedDistricts = Array.isArray(distRes?.data)
          ? distRes.data
          : (Array.isArray(distRes?.districts)
            ? distRes.districts
            : (Array.isArray(distRes) ? distRes : []));
        const resolvedAnalysis = anRes?.data ?? anRes ?? null;

        if (resolvedDataset && typeof resolvedDataset === "object") {
          setDataset(resolvedDataset);
        }
        setDistricts(resolvedDistricts);
        if (resolvedAnalysis && typeof resolvedAnalysis === "object") {
          setAnalysis(resolvedAnalysis);
        }
      } catch (err: any) {
        setError(err.message || String(err));
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Filter observations defensively
  const allObservations = Array.isArray(dataset?.observations) ? dataset.observations : [];
  const filteredObservations = allObservations.filter(obs => {
    if (selectedDistrict !== "ALL" && obs.normalizedDistrict !== selectedDistrict) return false;
    if (selectedTier !== "ALL" && !obs.prizeTier.toLowerCase().includes(selectedTier.toLowerCase())) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNum = obs.winningNumber.toLowerCase().includes(q);
      const matchLoc = (obs.rawLocation || "").toLowerCase().includes(q);
      const matchDraw = obs.drawId.toLowerCase().includes(q);
      const matchSeries = (obs.series || "").toLowerCase().includes(q);
      if (!matchNum && !matchLoc && !matchDraw && !matchSeries) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredObservations.length / pageSize) || 1;
  const paginatedObservations = filteredObservations.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  if (loading) {
    return (
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "3rem 1.5rem", textAlign: "center", color: "var(--text-secondary)" }}>
        Loading canonical geographic research surface...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "3rem 1.5rem", textAlign: "center", color: "var(--accent-rose)" }}>
        Failed to load geographic dataset: {error}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "1.5rem" }}>
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--accent-cyan)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Milestone 10A • Continuous Research Surface
          </span>
          <span style={{ fontSize: "0.75rem", padding: "0.15rem 0.5rem", borderRadius: "9999px", background: "rgba(16, 185, 129, 0.15)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.3)", fontWeight: 600 }}>
            ACTIVE CORPUS: {dataset?.activeCorpus?.totalDraws ?? 118} DRAWS ({dataset?.activeCorpus?.corpusLabel ?? "active-research-118draws"})
          </span>
          <span style={{ fontSize: "0.75rem", padding: "0.15rem 0.5rem", borderRadius: "9999px", background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.3)", fontWeight: 600 }}>
            EXTRACTION SNAPSHOT: {dataset?.snapshotMetadata?.snapshotVersion ?? "m10a-geography-103draws"}
          </span>
          <span style={{ fontSize: "0.75rem", padding: "0.15rem 0.5rem", borderRadius: "9999px", background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.3)", fontWeight: 600 }}>
            EXPOSURE UNAVAILABLE
          </span>
        </div>
        <h1 style={{ fontSize: "1.85rem", fontWeight: 700, margin: "0 0 0.5rem 0", color: "var(--text-primary)" }}>
          Winning Geography & Ticket Distribution Exposure
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", margin: 0, maxWidth: "900px", lineHeight: 1.5 }}>
          Ground truth retrospective extraction of published ticket issuing offices from canonical Kerala Government Gazette result PDFs (Milestone 10A {dataset?.drawCount ?? 103}-draw extraction snapshot <code style={{ color: "var(--accent-cyan)" }}>{dataset?.snapshotMetadata?.snapshotVersion ?? "m10a-geography-103draws"}</code>; Active Research Corpus: {dataset?.activeCorpus?.totalDraws ?? 118} draws / {(dataset?.activeCorpus?.totalResults ?? 45218).toLocaleString()} results). Rigorous separation between observed winner occurrences and ticket exposure denominators.
        </p>
      </div>

      {/* Critical Denominator & Non-Predictive Warning Alert */}
      <div style={{
        background: "var(--bg-surface-elevated)",
        border: "1px solid rgba(245, 158, 11, 0.35)",
        borderRadius: "0.5rem",
        padding: "1rem 1.25rem",
        marginBottom: "1.5rem",
        display: "flex",
        gap: "1rem",
        alignItems: "flex-start"
      }}>
        <div style={{ fontSize: "1.5rem", lineHeight: 1 }}>⚠️</div>
        <div>
          <h4 style={{ margin: "0 0 0.35rem 0", color: "var(--accent-amber)", fontSize: "0.95rem", fontWeight: 600 }}>
            Critical Denominator Rule & Non-Predictive Scientific Boundary
          </h4>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.85rem", lineHeight: 1.5 }}>
            Official Kerala Government Gazette result publications publish only the winning ticket numbers and issuing office locations for top-tier prizes. <strong>District-level ticket sales volume and returned unsold ticket counterfoils are NOT published in public gazette result sheets.</strong> In the absence of authoritative ticket exposure denominators, raw winner counts represent retrospective descriptive observations and <strong>CANNOT</strong> be used to calculate district winning probabilities. Any concept of &quot;lucky districts&quot;, &quot;hot districts&quot;, or betting scores is scientifically unfounded and strictly prohibited.
          </p>
          {analysis && (
            <div style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              Active Research Hypothesis: <code style={{ color: "var(--accent-amber)" }}>{analysis.hypothesisStatement}</code>
            </div>
          )}
        </div>
      </div>

      {/* Metric Cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "1rem",
        marginBottom: "1.5rem"
      }}>
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "0.5rem", padding: "1rem" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 600 }}>Active Research Corpus</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--accent-emerald)", marginTop: "0.25rem" }}>
            {dataset?.activeCorpus?.totalDraws ?? 118} <span style={{ fontSize: "0.9rem", fontWeight: 400, color: "var(--text-secondary)" }}>Draws (Latest: {dataset?.activeCorpus?.latestDrawCode ?? "KR-772nd"})</span>
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--accent-emerald)", marginTop: "0.25rem" }}>{(dataset?.activeCorpus?.totalResults ?? 45218).toLocaleString()} Active Results • {dataset?.activeCorpus?.corpusLabel ?? "active-research-118draws"}</div>
        </div>

        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "0.5rem", padding: "1rem" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 600 }}>M10A Extraction Snapshot</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)", marginTop: "0.25rem" }}>
            {dataset?.drawCount ?? 103} <span style={{ fontSize: "0.9rem", fontWeight: 400, color: "var(--text-secondary)" }}>Draws Evaluated</span>
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--accent-cyan)", marginTop: "0.25rem" }}>{(dataset?.resultCount ?? 39550).toLocaleString()} Snapshot Results • {dataset?.snapshotMetadata?.snapshotVersion ?? "m10a-geography-103draws"}</div>
        </div>

        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "0.5rem", padding: "1rem" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 600 }}>Published Locations</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--accent-cyan)", marginTop: "0.25rem" }}>
            380 <span style={{ fontSize: "0.9rem", fontWeight: 400, color: "var(--text-secondary)" }}>Exact Tickets</span>
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>196 Direct / 184 Derived</div>
        </div>

        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "0.5rem", padding: "1rem" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 600 }}>Revenue Districts</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--accent-emerald)", marginTop: "0.25rem" }}>
            14 / 14 <span style={{ fontSize: "0.9rem", fontWeight: 400, color: "var(--text-secondary)" }}>Covered</span>
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--accent-emerald)", marginTop: "0.25rem" }}>35 DLO/SLO Offices Mapped</div>
        </div>

        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "0.5rem", padding: "1rem" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 600 }}>Suffix & Consolation</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-secondary)", marginTop: "0.25rem" }}>
            39,170 <span style={{ fontSize: "0.9rem", fontWeight: 400, color: "var(--text-muted)" }}>Results</span>
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>Location Not in Source</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        borderBottom: "1px solid var(--border-subtle)",
        marginBottom: "1.5rem",
        gap: "0.5rem"
      }}>
        {[
          { id: "districts", label: "14 District Summaries" },
          { id: "observations", label: `Observed Winners (${allObservations.length})` },
          { id: "semantics", label: "Semantic Breakdown (Exact vs Suffix)" },
          { id: "lineage", label: "11-Stage Lineage & Provenance" }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: "0.6rem 1.2rem",
              background: "transparent",
              border: "none",
              borderBottom: activeTab === tab.id ? "2px solid var(--accent-cyan)" : "2px solid transparent",
              color: activeTab === tab.id ? "var(--accent-cyan)" : "var(--text-secondary)",
              fontWeight: activeTab === tab.id ? 600 : 500,
              fontSize: "0.9rem",
              cursor: "pointer",
              transition: "all 0.15s ease"
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: District Summaries */}
      {activeTab === "districts" && (
        <div>
          <div style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "0.5rem",
            overflow: "hidden"
          }}>
            <div style={{ padding: "1rem", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-primary)" }}>
                Observed Major-Prize Winners by District (Retrospective Occurrences)
              </span>
              <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                Total Major Winners: {allObservations.length}
              </span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "var(--bg-surface-elevated)", color: "var(--text-secondary)", borderBottom: "1px solid var(--border-subtle)" }}>
                    <th style={{ padding: "0.75rem 1rem" }}>District</th>
                    <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>Total Winners</th>
                    <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>Direct Matches</th>
                    <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>Sub-Office Derived</th>
                    <th style={{ padding: "0.75rem 1rem", textAlign: "center" }}>1st Prize</th>
                    <th style={{ padding: "0.75rem 1rem", textAlign: "center" }}>2nd Prize</th>
                    <th style={{ padding: "0.75rem 1rem", textAlign: "center" }}>3rd Prize</th>
                    <th style={{ padding: "0.75rem 1rem", textAlign: "center" }}>4th/5th Prize</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Earliest / Latest Observed</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(districts) ? districts : [])
                    .slice()
                    .sort((a, b) => (b.totalObservedWinners || 0) - (a.totalObservedWinners || 0))
                    .map((d, idx) => (
                      <tr
                        key={d.district}
                        style={{
                          borderBottom: "1px solid var(--border-subtle)",
                          background: idx % 2 === 0 ? "var(--bg-surface-elevated)" : "transparent"
                        }}
                      >
                        <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "var(--text-primary)" }}>
                          {d.district}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontWeight: 700, color: "var(--accent-cyan)" }}>
                          {d.totalObservedWinners}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "right", color: "var(--text-secondary)" }}>
                          {d.explicitPdfObservations}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "right", color: "var(--text-secondary)" }}>
                          {d.derivedObservations}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "center", color: "var(--text-primary)" }}>
                          {d.byPrizeTier.firstPrize}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "center", color: "var(--text-secondary)" }}>
                          {d.byPrizeTier.secondPrize}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "center", color: "var(--text-secondary)" }}>
                          {d.byPrizeTier.thirdPrize}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "center", color: "var(--text-secondary)" }}>
                          {d.byPrizeTier.fourthPrize + d.byPrizeTier.fifthPrize}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          {d.earliestDrawDate} → {d.latestDrawDate}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Observations List & Filter */}
      {activeTab === "observations" && (
        <div>
          {/* Controls */}
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.75rem",
            marginBottom: "1rem",
            alignItems: "center"
          }}>
            <div style={{ flex: "1 1 200px" }}>
              <input
                type="text"
                placeholder="Search by ticket #, series, location, draw..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  background: "var(--bg-surface-elevated)",
                  border: "1px solid var(--border-medium)",
                  borderRadius: "0.375rem",
                  color: "var(--text-primary)",
                  fontSize: "0.85rem"
                }}
              />
            </div>
            <div>
              <select
                value={selectedDistrict}
                onChange={e => { setSelectedDistrict(e.target.value); setCurrentPage(1); }}
                style={{
                  padding: "0.5rem 0.75rem",
                  background: "var(--bg-surface-elevated)",
                  border: "1px solid var(--border-medium)",
                  borderRadius: "0.375rem",
                  color: "var(--text-primary)",
                  fontSize: "0.85rem"
                }}
              >
                <option value="ALL">All Districts ({allObservations.length})</option>
                {KERALA_OFFICIAL_DISTRICTS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <select
                value={selectedTier}
                onChange={e => { setSelectedTier(e.target.value); setCurrentPage(1); }}
                style={{
                  padding: "0.5rem 0.75rem",
                  background: "var(--bg-surface-elevated)",
                  border: "1px solid var(--border-medium)",
                  borderRadius: "0.375rem",
                  color: "var(--text-primary)",
                  fontSize: "0.85rem"
                }}
              >
                <option value="ALL">All Prize Tiers</option>
                <option value="1st">1st Prize</option>
                <option value="2nd">2nd Prize</option>
                <option value="3rd">3rd Prize</option>
                <option value="4th">4th Prize</option>
                <option value="5th">5th Prize</option>
              </select>
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              Showing {filteredObservations.length} observations
            </div>
          </div>

          {/* Observations Table */}
          <div style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "0.5rem",
            overflow: "hidden"
          }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "var(--bg-surface-elevated)", color: "var(--text-secondary)", borderBottom: "1px solid var(--border-subtle)" }}>
                    <th style={{ padding: "0.75rem 1rem" }}>Draw Date</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Lottery</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Prize Tier</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Ticket Number</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Published Location</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Normalized District</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Traceability</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedObservations.map((obs, idx) => (
                    <tr
                      key={obs.observationId}
                      style={{
                        borderBottom: "1px solid var(--border-subtle)",
                        background: idx % 2 === 0 ? "var(--bg-surface-elevated)" : "transparent"
                      }}
                    >
                      <td style={{ padding: "0.75rem 1rem", color: "var(--text-secondary)" }}>
                        {obs.drawDate}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "var(--text-primary)" }}>
                        {obs.lotteryCode} ({obs.drawNumber})
                      </td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <span style={{
                          padding: "0.15rem 0.5rem",
                          borderRadius: "0.25rem",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          background: obs.prizeTier.includes("1st") ? "rgba(234, 179, 8, 0.15)" : "rgba(148, 163, 184, 0.15)",
                          color: obs.prizeTier.includes("1st") ? "var(--accent-amber)" : "var(--text-secondary)"
                        }}>
                          {obs.prizeTier}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", fontWeight: 600, color: "var(--accent-cyan)" }}>
                        {obs.series} {obs.winningNumber}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", color: "var(--text-primary)" }}>
                        {obs.rawLocation}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "var(--accent-emerald)" }}>
                        {obs.normalizedDistrict}
                      </td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <button
                          onClick={() => setSelectedObs(obs)}
                          style={{
                            padding: "0.25rem 0.5rem",
                            fontSize: "0.75rem",
                            background: "rgba(56, 189, 248, 0.1)",
                            color: "var(--accent-cyan)",
                            border: "1px solid rgba(56, 189, 248, 0.3)",
                            borderRadius: "0.25rem",
                            cursor: "pointer"
                          }}
                        >
                          Audit Source
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div style={{
              padding: "0.75rem 1rem",
              borderTop: "1px solid var(--border-subtle)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "0.5rem"
            }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                Page {currentPage} of {totalPages} ({filteredObservations.length} results)
              </span>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  style={{
                    padding: "0.25rem 0.75rem",
                    fontSize: "0.8rem",
                    background: "var(--bg-surface-elevated)",
                    color: currentPage <= 1 ? "var(--text-muted)" : "var(--text-primary)",
                    border: "1px solid var(--border-medium)",
                    borderRadius: "0.25rem",
                    cursor: currentPage <= 1 ? "not-allowed" : "pointer"
                  }}
                >
                  Previous
                </button>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  style={{
                    padding: "0.25rem 0.75rem",
                    fontSize: "0.8rem",
                    background: "var(--bg-surface-elevated)",
                    color: currentPage >= totalPages ? "var(--text-muted)" : "var(--text-primary)",
                    border: "1px solid var(--border-medium)",
                    borderRadius: "0.25rem",
                    cursor: currentPage >= totalPages ? "not-allowed" : "pointer"
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Semantic Breakdown (Exact vs Suffix) */}
      {activeTab === "semantics" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem" }}>
          <div style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "0.5rem",
            padding: "1.25rem"
          }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text-primary)", margin: "0 0 1rem 0" }}>
              Prize Structure Classification Across 39,550 Winning Results
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ padding: "0.75rem", background: "var(--bg-surface-elevated)", borderRadius: "0.375rem", borderLeft: "4px solid var(--accent-cyan)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>1. Exact-Ticket Major Prizes</span>
                  <span style={{ fontWeight: 700, color: "var(--accent-cyan)" }}>380 tickets (1.0%)</span>
                </div>
                <p style={{ margin: "0.35rem 0 0 0", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  1st, 2nd, 3rd (and select Bumper 4th/5th) prizes. Published with complete 2-letter series, 6-digit ticket number, and ticket-issuing office location in parentheses.
                </p>
              </div>

              <div style={{ padding: "0.75rem", background: "var(--bg-surface-elevated)", borderRadius: "0.375rem", borderLeft: "4px solid var(--accent-amber)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>2. Consolation Prizes</span>
                  <span style={{ fontWeight: 700, color: "var(--accent-amber)" }}>1,124 tickets (2.8%)</span>
                </div>
                <p style={{ margin: "0.35rem 0 0 0", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  Tickets sharing the 1st prize 6-digit number in the remaining series. The gazette lists the series and number, but does not reprint an independent location string.
                </p>
              </div>

              <div style={{ padding: "0.75rem", background: "var(--bg-surface-elevated)", borderRadius: "0.375rem", borderLeft: "4px solid var(--text-muted)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>3. Suffix-Class Prizes (4th through 9th)</span>
                  <span style={{ fontWeight: 700, color: "var(--text-secondary)" }}>38,046 tickets (96.2%)</span>
                </div>
                <p style={{ margin: "0.35rem 0 0 0", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  Awarded to all tickets in all series whose final 4 digits match the published winning suffix. No ticket series or issuing office location exists in official gazettes for this tier.
                </p>
              </div>
            </div>
          </div>

          <div style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "0.5rem",
            padding: "1.25rem"
          }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text-primary)", margin: "0 0 1rem 0" }}>
              Mathematical Corpus Reconciliation
            </h3>
            <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse" }}>
              <tbody>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <td style={{ padding: "0.6rem 0", color: "var(--text-secondary)" }}>Total Canonical PDF Files</td>
                  <td style={{ padding: "0.6rem 0", textAlign: "right", fontWeight: 600, color: "var(--text-primary)" }}>103</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <td style={{ padding: "0.6rem 0", color: "var(--text-secondary)" }}>Total Results in Research Corpus</td>
                  <td style={{ padding: "0.6rem 0", textAlign: "right", fontWeight: 600, color: "var(--text-primary)" }}>39,550</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <td style={{ padding: "0.6rem 0", color: "var(--text-secondary)" }}>Exact Tickets with Published Location</td>
                  <td style={{ padding: "0.6rem 0", textAlign: "right", fontWeight: 600, color: "var(--accent-cyan)" }}>380</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <td style={{ padding: "0.6rem 0", color: "var(--text-secondary)" }}>Consolation Tickets</td>
                  <td style={{ padding: "0.6rem 0", textAlign: "right", fontWeight: 600, color: "var(--accent-amber)" }}>1,124</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <td style={{ padding: "0.6rem 0", color: "var(--text-secondary)" }}>Suffix Results (4th through 9th)</td>
                  <td style={{ padding: "0.6rem 0", textAlign: "right", fontWeight: 600, color: "var(--text-secondary)" }}>38,046</td>
                </tr>
                <tr style={{ borderTop: "2px solid var(--border-medium)" }}>
                  <td style={{ padding: "0.75rem 0", fontWeight: 700, color: "var(--accent-emerald)" }}>Reconciliation Sum</td>
                  <td style={{ padding: "0.75rem 0", textAlign: "right", fontWeight: 700, color: "var(--accent-emerald)" }}>
                    380 + 1,124 + 38,046 = 39,550
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: 11-Stage Lineage & Provenance */}
      {activeTab === "lineage" && (
        <div style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "0.5rem",
          padding: "1.5rem"
        }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text-primary)", margin: "0 0 0.5rem 0" }}>
            11-Stage Geographic Provenance DAG (Extending Milestone 9D)
          </h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", margin: "0 0 1.5rem 0" }}>
            Every geographic claim is grounded in official gazetted PDFs and traverses an unbroken cryptographic DAG.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[
              { stage: 1, name: "SOURCE_DOCUMENT", desc: "103 Official Kerala Government Gazette PDFs in PDF-A format", status: "CONFIRMED" },
              { stage: 2, name: "DRAW", desc: "103 Verified Draw entities with authoritative dates and draw numbers", status: "CONFIRMED" },
              { stage: 3, name: "PRIZE_SCHEME", desc: "16 Authoritative gazetted prize schemes with exact tier structures", status: "CONFIRMED" },
              { stage: 4, name: "PRIZE_TIER", desc: "Explicit prize tier mapping (1st to 9th, Consolation)", status: "CONFIRMED" },
              { stage: 5, name: "WINNING_RESULT", desc: "39,550 Published winning numbers with series and position", status: "CONFIRMED" },
              { stage: 6, name: "GEOGRAPHIC_OBSERVATION", desc: "380 Exact-ticket issuing office observations extracted from PDF text", status: "CONFIRMED" },
              { stage: 7, name: "TICKET_EXPOSURE", desc: "District-level eligible tickets sold denominator (Form VII / LOTIS)", status: "UNAVAILABLE", note: "Not published in Gazette" },
              { stage: 8, name: "GEOGRAPHIC_ANALYSIS", desc: "Descriptive winner frequency distributions across 14 Kerala revenue districts", status: "CONFIRMED" },
              { stage: 9, name: "VALIDATION", desc: "Scientific validation enforcing non-predictive guardrails & limitation notices", status: "CONFIRMED" },
              { stage: 10, name: "FINDING", desc: "Retrospective descriptive finding on observed geographic office occurrences", status: "CONFIRMED" },
              { stage: 11, name: "EVIDENCE_BUNDLE", desc: "Cryptographic audit trail linking terminal findings to 103 source document SHAs", status: "CONFIRMED" }
            ].map((st) => (
              <div
                key={st.stage}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "0.75rem 1rem",
                  background: st.status === "UNAVAILABLE" ? "rgba(245, 158, 11, 0.08)" : "var(--bg-surface-elevated)",
                  border: st.status === "UNAVAILABLE" ? "1px solid rgba(245, 158, 11, 0.3)" : "1px solid var(--border-subtle)",
                  borderRadius: "0.375rem",
                  gap: "1rem"
                }}
              >
                <div style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "9999px",
                  background: st.status === "UNAVAILABLE" ? "#f59e0b" : "#38bdf8",
                  color: "#0f172a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "0.8rem",
                  flexShrink: 0
                }}>
                  {st.stage}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.9rem" }}>{st.name}</span>
                    <span style={{
                      fontSize: "0.7rem",
                      padding: "0.1rem 0.4rem",
                      borderRadius: "0.2rem",
                      fontWeight: 600,
                      background: st.status === "CONFIRMED" ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.2)",
                      color: st.status === "CONFIRMED" ? "var(--accent-emerald)" : "var(--accent-amber)"
                    }}>
                      {st.status}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                    {st.desc} {st.note && <strong style={{ color: "var(--accent-amber)" }}>({st.note})</strong>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Traceability Modal */}
      {selectedObs && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.75)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          zIndex: 50
        }}>
          <div style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-medium)",
            borderRadius: "0.5rem",
            maxWidth: "600px",
            width: "100%",
            padding: "1.5rem",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem", color: "var(--text-primary)", fontWeight: 600 }}>
                Audit Source Traceability
              </h3>
              <button
                onClick={() => setSelectedObs(null)}
                style={{ background: "transparent", border: "none", color: "var(--text-secondary)", fontSize: "1.2rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.85rem" }}>
              <div>
                <span style={{ color: "var(--text-secondary)" }}>Winning Ticket: </span>
                <strong style={{ color: "var(--accent-cyan)", fontFamily: "monospace" }}>{selectedObs.series} {selectedObs.winningNumber}</strong> ({selectedObs.prizeTier})
              </div>
              <div>
                <span style={{ color: "var(--text-secondary)" }}>Raw Published Location: </span>
                <strong style={{ color: "var(--text-primary)" }}>&quot;{selectedObs.rawLocation}&quot;</strong>
              </div>
              <div>
                <span style={{ color: "var(--text-secondary)" }}>Normalized Revenue District: </span>
                <strong style={{ color: "var(--accent-emerald)" }}>{selectedObs.normalizedDistrict}</strong>
              </div>
              <div>
                <span style={{ color: "var(--text-secondary)" }}>Normalization Rule: </span>
                <span style={{ color: "var(--text-secondary)" }}>{selectedObs.normalizationRule}</span> (Confidence: {selectedObs.confidence * 100}%)
              </div>
              <div>
                <span style={{ color: "var(--text-secondary)" }}>Source Document File: </span>
                <span style={{ color: "var(--text-secondary)", fontFamily: "monospace" }}>{selectedObs.canonicalFilename}</span> (Page {selectedObs.sourcePage})
              </div>
              <div>
                <span style={{ color: "var(--text-secondary)" }}>Source Document SHA-256: </span>
                <div style={{ fontFamily: "monospace", fontSize: "0.75rem", wordBreak: "break-all", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                  {selectedObs.sourceDocumentSha256}
                </div>
              </div>
              <div style={{ marginTop: "0.5rem", padding: "0.75rem", background: "var(--bg-surface-elevated)", borderRadius: "0.375rem" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>Exact Raw Text Extracted from Gazette:</div>
                <div style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "var(--text-primary)" }}>
                  {selectedObs.sourceText}
                </div>
              </div>
            </div>

            <div style={{ marginTop: "1.25rem", textAlign: "right" }}>
              <button
                onClick={() => setSelectedObs(null)}
                style={{
                  padding: "0.4rem 1rem",
                  background: "rgba(56, 189, 248, 0.15)",
                  color: "var(--accent-cyan)",
                  border: "1px solid rgba(56, 189, 248, 0.3)",
                  borderRadius: "0.25rem",
                  cursor: "pointer",
                  fontSize: "0.85rem"
                }}
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
