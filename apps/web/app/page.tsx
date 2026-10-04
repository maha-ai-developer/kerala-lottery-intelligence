"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface StatsSummary {
  researchDraws: number;
  researchWinningResults: number;
  researchFullTickets: number;
  researchSuffixes: number;
  geoObservations: number;
  districtsCount: number;
  prodDraws: number;
  prodWinningResults: number;
  totalSchemes: number;
  registeredExperiments: number;
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

export default function OverviewPage() {
  const [stats, setStats] = useState<StatsSummary>({
    researchDraws: 103,
    researchWinningResults: 39550,
    researchFullTickets: 1504,
    researchSuffixes: 38046,
    geoObservations: 380,
    districtsCount: 14,
    prodDraws: 100,
    prodWinningResults: 38416,
    totalSchemes: 16,
    registeredExperiments: 3
  });
  const [recentDraws, setRecentDraws] = useState<DrawItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    async function loadOverviewData() {
      try {
        const [statsRes, drawsRes] = await Promise.all([
          fetch("/api/v1/statistics"),
          fetch("/api/v1/draws?limit=10")
        ]);

        if (statsRes.ok) {
          const statsJson = await statsRes.json();
          const pop = statsJson.data?.population || {};
          setStats((prev) => ({
            ...prev,
            researchDraws: pop.totalDraws || 103,
            researchWinningResults: pop.totalResults || 39550,
            researchFullTickets: pop.fullTicketCount || 1504,
            researchSuffixes: pop.suffixCount || 38046
          }));
        }

        if (drawsRes.ok) {
          const drawsJson = await drawsRes.json();
          setRecentDraws(drawsJson.data || []);
        }
      } catch (err) {
        console.error("Failed to load overview data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadOverviewData();
  }, []);

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
        setSearchResults(json.data || []);
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="container" style={{ padding: "2rem 1.5rem" }}>
      {/* Scientific Notice Banner */}
      <div className="scientific-notice" style={{ marginBottom: "2rem" }}>
        <strong>SCIENTIFIC & DESCRIPTIVE RESEARCH PLATFORM ONLY — V1.0 CLOSED RELEASE</strong>
        <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.825rem", color: "var(--text-secondary)" }}>
          Every number and observation on this platform is cryptographically connected to its Government Gazette result PDF,
          prize scheme, rule context, and statistical provenance. Lottery draws are independent physical trials.
          Historical feature frequencies provide strictly zero predictive validity, winning score, or gambling recommendations.
        </p>
      </div>

      {/* Hero Header */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>
            Kerala State Lottery Intelligence Platform
          </h1>
          <span className="badge badge-emerald">V1.0 Closed Release</span>
          <span className="badge badge-blue">Research Platform</span>
          <span className="badge badge-yellow">PROD Boundary Isolated</span>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", margin: 0 }}>
          Deterministic knowledge graph, descriptive statistical engine, formal experiment baselines, geographic evidence,
          and interactive research sandbox covering 103 canonical draws and 39,550 winning results.
        </p>
      </div>

      {/* Core V1.0 Platform Architecture Status Grid */}
      <div className="grid-4" style={{ gap: "1rem", marginBottom: "2rem" }}>
        <div className="stat-card" style={{ borderLeft: "3px solid var(--accent-cyan)" }}>
          <div className="stat-label">Research Corpus (DEV)</div>
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
            All {stats.districtsCount} Kerala revenue districts represented (Exposure: UNAVAILABLE)
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: "3px solid var(--accent-purple)" }}>
          <div className="stat-label">Formal Baselines (9B/9C)</div>
          <div className="stat-value" style={{ color: "var(--accent-purple)" }}>
            {stats.registeredExperiments} Registered
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
            EXP-001 (Uniform), EXP-002 (Empirical), EXP-003 (Majority)
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: "3px solid #f59e0b" }}>
          <div className="stat-label">Production Isolation (PROD)</div>
          <div className="stat-value" style={{ color: "#f59e0b" }}>
            {stats.prodDraws} Draws
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
            {stats.prodWinningResults.toLocaleString()} results | Scheduler: <strong>PAUSED</strong>
          </div>
        </div>
      </div>

      {/* Research Sandbox Feature Callout Card */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(14, 165, 233, 0.12), rgba(15, 23, 42, 0.95))",
          border: "1px solid rgba(56, 189, 248, 0.35)",
          borderRadius: "0.75rem",
          padding: "1.5rem",
          marginBottom: "2rem"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
              <span className="badge badge-blue">New in V1.0</span>
              <span className="badge badge-emerald">Interactive Sandbox</span>
            </div>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
              Interactive Research Sandbox: Analyze Candidate & Historical Tickets
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginTop: "0.35rem", marginBottom: 0, maxWidth: "780px" }}>
              Enter any candidate lottery ticket (Lottery, Scheme, Series, Number) to run deterministic structural validation,
              extract mathematical features, compute empirical frequencies against the 103-draw research corpus, and inspect
              statistical baseline benchmarks without prediction scores or betting bias.
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
            href="/draws"
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
              Historical Draws &rarr;
            </div>
            <div style={{ fontSize: "0.825rem", color: "var(--text-secondary)" }}>
              Browse and inspect all historical draws, prize distributions, and verified PDF source documents.
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
              Empirical marginal digit distributions, chi-square uniformity tests, and Shannon entropy metrics.
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
              Findings & Evidence &rarr;
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
              Geography & Exposure &rarr;
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
        <form onSubmit={handleSearch} style={{ display: "flex", gap: "0.75rem" }}>
          <input
            type="text"
            className="search-input"
            placeholder="Search draws (e.g. BT-73, SM-74), ticket numbers (e.g. 025916, 0276), or SHA-256..."
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
                No records matched &quot;{searchQuery}&quot;. Try a draw code (BT-73), lottery name, or ticket number.
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
                      background: "rgba(255, 255, 255, 0.02)",
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

      {/* Anchor Case Study Card: BHAGYATHARA BT-73 */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.95))",
          border: "1px solid rgba(56, 189, 248, 0.3)",
          borderRadius: "0.75rem",
          padding: "1.5rem",
          marginBottom: "2rem"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
              <span className="badge badge-emerald">Real-World Anchor</span>
              <span className="badge badge-blue">Official Gov Result</span>
              <span className="mono" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>28/09/2026</span>
            </div>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
              BHAGYATHARA BT-73 — Complete Provenance Chain
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginTop: "0.25rem", marginBottom: 0 }}>
              The canonical benchmark draw used across all verifications. 100% verified against official gazetted PDF.
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Link href="/draws/kl-bt-73-2026-09-28" className="btn btn-primary" style={{ fontSize: "0.85rem" }}>
              Inspect BT-73 &rarr;
            </Link>
            <Link href="/sources/cddb3d4d05c102b98f38050ac1ff297ad15bc442b12087c0505927f7bb1cf3dc" className="btn btn-outline" style={{ fontSize: "0.85rem" }}>
              Source PDF
            </Link>
          </div>
        </div>

        <div className="grid-3" style={{ fontSize: "0.85rem" }}>
          <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "0.875rem", borderRadius: "0.5rem", border: "1px solid var(--border-subtle)" }}>
            <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>Source Document SHA-256</div>
            <div className="mono" style={{ color: "var(--accent-cyan)", fontSize: "0.75rem", wordBreak: "break-all", marginTop: "0.25rem" }}>
              cddb3d4d05c102b98f38050ac1ff297ad15bc442b12087c0505927f7bb1cf3dc
            </div>
          </div>
          <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "0.875rem", borderRadius: "0.5rem", border: "1px solid var(--border-subtle)" }}>
            <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>Prize Structure</div>
            <div style={{ marginTop: "0.25rem", fontWeight: 600 }}>
              8 Tiers + Consolation | 378 Winning Numbers
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.15rem" }}>
              14 Full Tickets (1st & Consolation) + 364 Suffixes
            </div>
          </div>
          <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "0.875rem", borderRadius: "0.5rem", border: "1px solid var(--border-subtle)" }}>
            <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>Prize Scheme ID</div>
            <div className="mono" style={{ color: "var(--accent-emerald)", fontSize: "0.8rem", marginTop: "0.25rem" }}>
              scheme_ver_bt_2025_11_sro1297
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
              Authority: <span className="badge badge-emerald" style={{ fontSize: "0.68rem" }}>OFFICIAL_SCHEME</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Draws Table */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div>
            <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>Recent Verified Draws</h2>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Showing most recent draws from verified corpus</div>
          </div>
          <Link href="/draws" className="btn btn-outline" style={{ fontSize: "0.85rem" }}>
            View All Draws &rarr;
          </Link>
        </div>

        <div className="table-container">
          <table className="research-table">
            <thead>
              <tr>
                <th>Draw ID</th>
                <th>Lottery</th>
                <th>Draw #</th>
                <th>Draw Date</th>
                <th>Winning Results</th>
                <th>Scheme ID</th>
                <th>Source SHA</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "2rem" }}>
                    Loading recent verified draws...
                  </td>
                </tr>
              ) : recentDraws.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "2rem" }}>
                    No draws found.
                  </td>
                </tr>
              ) : (
                recentDraws.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <Link href={`/draws/${d.id}`} className="mono" style={{ color: "var(--accent-cyan)", textDecoration: "none" }}>
                        {d.id}
                      </Link>
                    </td>
                    <td style={{ fontWeight: 600 }}>{d.lotteryName} ({d.lotteryCode})</td>
                    <td><span className="mono">#{d.drawNumber}</span></td>
                    <td>{d.drawDate}</td>
                    <td>
                      <span className="badge badge-emerald">
                        {d.totalResults} results
                      </span>
                    </td>
                    <td>
                      <span className="mono" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {d.prizeSchemeId}
                      </span>
                    </td>
                    <td>
                      <Link
                        href={`/sources/${d.sourceDocumentSha256}`}
                        className="mono"
                        style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textDecoration: "underline" }}
                        title={d.sourceDocumentSha256}
                      >
                        {d.sourceDocumentSha256.slice(0, 10)}...
                      </Link>
                    </td>
                    <td>
                      <Link href={`/draws/${d.id}`} className="btn btn-outline" style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}>
                        Inspect
                      </Link>
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
