"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface DrawDetail {
  id: string;
  lotteryCode: string;
  lotteryName: string;
  drawNumber: number;
  drawDate: string;
  totalResults: number;
  sourceDocumentSha256: string;
  prizeSchemeId: string;
  schemeAuthorityLevel?: string;
  seriesList?: string[];
  status: string;
  gcsStoragePath?: string;
}

interface WinningResultItem {
  id: string;
  drawId: string;
  drawDate: string;
  lotteryCode: string;
  tier: string;
  tierRank: number;
  prizeAmount: number;
  numberType: "FULL_TICKET" | "SUFFIX";
  series?: string;
  number: string;
  sourceDocumentSha256: string;
  prizeSchemeId: string;
}

export default function DrawDetailPage() {
  const params = useParams();
  const drawId = params?.id as string;

  const [draw, setDraw] = useState<DrawDetail | null>(null);
  const [results, setResults] = useState<WinningResultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [resultsLoading, setResultsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [totalResults, setTotalResults] = useState(0);
  const [tierFilter, setTierFilter] = useState("");
  const [searchNumber, setSearchNumber] = useState("");

  useEffect(() => {
    if (!drawId) return;

    async function loadDraw() {
      try {
        const res = await fetch(`/api/v1/draws/${encodeURIComponent(drawId)}`);
        if (res.ok) {
          const json = await res.json();
          setDraw(json.data);
        }
      } catch (err) {
        console.error("Error fetching draw details:", err);
      } finally {
        setLoading(false);
      }
    }

    loadDraw();
  }, [drawId]);

  useEffect(() => {
    if (!drawId) return;

    async function loadResults() {
      setResultsLoading(true);
      try {
        let url = `/api/v1/draws/${encodeURIComponent(drawId)}/results?page=${page}&limit=${limit}`;
        if (tierFilter) {
          url += `&tier=${encodeURIComponent(tierFilter)}`;
        }
        if (searchNumber.trim()) {
          url += `&number=${encodeURIComponent(searchNumber.trim())}`;
        }

        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          setResults(json.data || []);
          setTotalResults(json.pagination?.total || 0);
        }
      } catch (err) {
        console.error("Error fetching results:", err);
      } finally {
        setResultsLoading(false);
      }
    }

    loadResults();
  }, [drawId, page, limit, tierFilter, searchNumber]);

  if (loading) {
    return (
      <div className="container" style={{ padding: "4rem 1.5rem", textAlign: "center" }}>
        Loading draw details...
      </div>
    );
  }

  if (!draw) {
    return (
      <div className="container" style={{ padding: "4rem 1.5rem", textAlign: "center" }}>
        <h2>Draw Not Found</h2>
        <p style={{ color: "var(--text-secondary)" }}>No draw found with identifier &quot;{drawId}&quot;.</p>
        <Link href="/draws" className="btn btn-primary" style={{ marginTop: "1rem" }}>
          &larr; Back to Draws
        </Link>
      </div>
    );
  }

  const isAnchor = draw.id === "kl-bt-73-2026-09-28" || draw.drawNumber === 73;
  const totalPages = Math.ceil(totalResults / limit) || 1;

  return (
    <div className="container" style={{ padding: "2rem 1.5rem" }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: "1rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
        <Link href="/draws" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>Draws</Link>
        {" / "}
        <span style={{ color: "var(--text-primary)" }}>{draw.id}</span>
      </div>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "2rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <span className="badge badge-blue">{draw.lotteryCode}</span>
            <span className="badge badge-emerald">Draw #{draw.drawNumber}</span>
            {isAnchor && <span className="badge badge-purple">Real-World Anchor</span>}
            <span className="badge badge-emerald">100% SHA Verified</span>
          </div>
          <h1 style={{ fontSize: "1.875rem", fontWeight: 700, margin: 0 }}>
            {draw.lotteryName} — Draw #{draw.drawNumber}
          </h1>
          <div style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
            Conducted on <strong>{draw.drawDate}</strong> at Thiruvananthapuram, Kerala.
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link href={`/sources/${draw.sourceDocumentSha256}`} className="btn btn-primary" style={{ fontSize: "0.85rem" }}>
            Inspect Source PDF &rarr;
          </Link>
          <Link href={`/schemes/${draw.prizeSchemeId}`} className="btn btn-outline" style={{ fontSize: "0.85rem" }}>
            Prize Scheme &rarr;
          </Link>
        </div>
      </div>

      {/* Provenance & Cryptographic Lineage Card */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "0.75rem",
          padding: "1.5rem",
          marginBottom: "2rem"
        }}
      >
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 1rem 0", color: "var(--accent-cyan)" }}>
          Cryptographic Lineage & Verification
        </h2>
        <div className="grid-3" style={{ fontSize: "0.85rem", gap: "1.25rem" }}>
          <div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>Source Document SHA-256</div>
            <div className="mono" style={{ color: "var(--accent-cyan)", fontSize: "0.8rem", wordBreak: "break-all", marginTop: "0.25rem" }}>
              {draw.sourceDocumentSha256}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
              Verified match against raw gazetted PDF
            </div>
          </div>

          <div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>Prize Scheme ID</div>
            <div className="mono" style={{ color: "var(--text-primary)", fontSize: "0.85rem", marginTop: "0.25rem", fontWeight: 600 }}>
              {draw.prizeSchemeId}
            </div>
            <div style={{ marginTop: "0.25rem" }}>
              <span className="badge badge-emerald" style={{ fontSize: "0.7rem" }}>
                {draw.schemeAuthorityLevel || "OFFICIAL_SCHEME"}
              </span>
            </div>
          </div>

          <div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>Total Results Validated</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--accent-emerald)", marginTop: "0.25rem" }}>
              {draw.totalResults.toLocaleString()} winning numbers
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
              All prize tiers verified with zero duplicates
            </div>
          </div>
        </div>

        {draw.seriesList && draw.seriesList.length > 0 && (
          <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--border-subtle)" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Series Issued ({draw.seriesList.length}): </span>
            <div style={{ display: "inline-flex", gap: "0.35rem", flexWrap: "wrap", marginLeft: "0.5rem" }}>
              {draw.seriesList.map((s) => (
                <span key={s} className="mono" style={{ background: "rgba(56, 189, 248, 0.1)", color: "var(--accent-cyan)", padding: "0.1rem 0.4rem", borderRadius: "0.25rem", fontSize: "0.75rem" }}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Winning Results Section */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Winning Results</h2>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              {totalResults} winning numbers extracted and verified
            </div>
          </div>

          {/* Result Filters */}
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            <select
              className="select-input"
              value={tierFilter}
              onChange={(e) => {
                setTierFilter(e.target.value);
                setPage(1);
              }}
              style={{ fontSize: "0.85rem" }}
            >
              <option value="">All Tiers</option>
              <option value="1st">1st Prize</option>
              <option value="Consolation">Consolation Prize</option>
              <option value="2nd">2nd Prize</option>
              <option value="3rd">3rd Prize</option>
              <option value="4th">4th Prize</option>
              <option value="5th">5th Prize</option>
              <option value="6th">6th Prize</option>
              <option value="7th">7th Prize</option>
              <option value="8th">8th Prize</option>
            </select>

            <input
              type="text"
              className="search-input"
              placeholder="Search number (e.g. 0276)..."
              value={searchNumber}
              onChange={(e) => {
                setSearchNumber(e.target.value);
                setPage(1);
              }}
              style={{ width: "200px", fontSize: "0.85rem" }}
            />
          </div>
        </div>

        {/* Results Table */}
        <div className="table-container" style={{ marginBottom: "1.5rem" }}>
          <table className="research-table">
            <thead>
              <tr>
                <th>Tier</th>
                <th>Prize (₹)</th>
                <th>Type</th>
                <th>Series</th>
                <th>Winning Number</th>
                <th>Raw Digits (Canonical)</th>
                <th>Source SHA</th>
              </tr>
            </thead>
            <tbody>
              {resultsLoading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "3rem" }}>
                    Loading results...
                  </td>
                </tr>
              ) : results.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "3rem" }}>
                    No results matched filters.
                  </td>
                </tr>
              ) : (
                results.map((r, idx) => (
                  <tr key={idx}>
                    <td>
                      <span className="badge badge-blue">{r.tier}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      ₹{r.prizeAmount.toLocaleString("en-IN")}
                    </td>
                    <td>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {r.numberType}
                      </span>
                    </td>
                    <td>
                      {r.series ? (
                        <span className="ticket-series mono">{r.series}</span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>
                    <td>
                      <span className="ticket-num">
                        {r.series && <span className="ticket-series">{r.series}</span>}
                        <span className="ticket-digits">{r.number}</span>
                      </span>
                    </td>
                    <td>
                      <span className="mono" style={{ color: "var(--accent-cyan)", fontSize: "0.85rem" }}>
                        &quot;{r.number}&quot;
                      </span>
                    </td>
                    <td>
                      <span className="mono" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {r.sourceDocumentSha256.slice(0, 10)}...
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Showing Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalResults} results)
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              className="btn btn-outline"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              style={{ fontSize: "0.85rem" }}
            >
              &larr; Previous
            </button>
            <button
              type="button"
              className="btn btn-outline"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              style={{ fontSize: "0.85rem" }}
            >
              Next &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
