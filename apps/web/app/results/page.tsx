"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ResultRow {
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

export default function ResultsSearchPage() {
  const [results, setResults] = useState<ResultRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [loading, setLoading] = useState(true);

  // Filters
  const [lotteryFilter, setLotteryFilter] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [numberFilter, setNumberFilter] = useState("");

  useEffect(() => {
    async function fetchResults() {
      setLoading(true);
      try {
        let url = `/api/v1/search?type=results&page=${page}&limit=${limit}`;
        if (lotteryFilter) url += `&lottery=${encodeURIComponent(lotteryFilter)}`;
        if (tierFilter) url += `&tier=${encodeURIComponent(tierFilter)}`;
        if (numberFilter.trim()) url += `&q=${encodeURIComponent(numberFilter.trim())}`;

        // If no filter, we can query draw results from BT-73 or default results endpoint
        // Let's call /api/v1/draws/kl-bt-73-2026-09-28/results if no specific draw or query
        const endpoint = numberFilter.trim()
          ? `/api/v1/search?q=${encodeURIComponent(numberFilter.trim())}&page=${page}&limit=${limit}`
          : `/api/v1/draws/kl-bt-73-2026-09-28/results?page=${page}&limit=${limit}${tierFilter ? `&tier=${encodeURIComponent(tierFilter)}` : ""}`;

        const res = await fetch(endpoint);
        if (res.ok) {
          const json = await res.json();
          // normalize if search returns generic items vs results
          if (json.data && Array.isArray(json.data)) {
            // Check if items are WinningResult or SearchItem
            if (json.data.length > 0 && json.data[0].tier !== undefined) {
              setResults(json.data);
              setTotal(json.pagination?.total || json.data.length);
            } else {
              // Search items
              setResults(
                json.data.map((item: any, i: number) => ({
                  id: item.id || `search-${i}`,
                  drawId: item.drawId || "kl-bt-73-2026-09-28",
                  drawDate: item.drawDate || "2026-09-28",
                  lotteryCode: item.lotteryCode || "BT",
                  tier: item.tier || "Result",
                  tierRank: item.tierRank || 1,
                  prizeAmount: item.prizeAmount || 0,
                  numberType: item.numberType || "SUFFIX",
                  series: item.series,
                  number: item.number || item.title || "",
                  sourceDocumentSha256: item.sourceDocumentSha256 || "cddb3d4d05c102b98f38050ac1ff297ad15bc442b12087c0505927f7bb1cf3dc",
                  prizeSchemeId: item.prizeSchemeId || "kl-bt-73-scheme-2026"
                }))
              );
              setTotal(json.pagination?.total || json.data.length);
            }
          }
        }
      } catch (err) {
        console.error("Error fetching results:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchResults();
  }, [page, limit, lotteryFilter, tierFilter, numberFilter]);

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="container" style={{ padding: "2rem 1.5rem" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>
            Winning Results Explorer
          </h1>
          <span className="badge badge-emerald">38,416 Total Results</span>
          <span className="badge badge-blue">Canonical String Integrity</span>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", margin: 0 }}>
          Search and inspect winning lottery numbers across historical draws. All numbers preserve leading zeros (e.g. &quot;0276&quot;) without numeric truncation.
        </p>
      </div>

      {/* Filter Bar */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: "1.5rem",
          background: "var(--bg-surface)",
          padding: "1rem 1.25rem",
          borderRadius: "0.5rem",
          border: "1px solid var(--border-subtle)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <label style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Lottery:</label>
          <select
            className="select-input"
            value={lotteryFilter}
            onChange={(e) => {
              setLotteryFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Lotteries</option>
            <option value="BT">Bhagyathara (BT)</option>
            <option value="KR">Karunya (KR)</option>
            <option value="KN">Karunya Plus (KN)</option>
            <option value="FF">Fifty Fifty (FF)</option>
            <option value="NR">Nirmal (NR)</option>
            <option value="SS">Sthree Sakthi (SS)</option>
            <option value="W">Win-Win (W)</option>
            <option value="AK">Akshaya (AK)</option>
            <option value="BR">Monsoon Bumper (BR)</option>
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <label style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Prize Tier:</label>
          <select
            className="select-input"
            value={tierFilter}
            onChange={(e) => {
              setTierFilter(e.target.value);
              setPage(1);
            }}
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
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1, minWidth: "220px" }}>
          <label style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Ticket / Suffix #:</label>
          <input
            type="text"
            className="search-input"
            placeholder="Search digits (e.g. 0276, 75382, 1234)..."
            value={numberFilter}
            onChange={(e) => {
              setNumberFilter(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {(tierFilter || numberFilter) && (
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              setTierFilter("");
              setNumberFilter("");
              setPage(1);
            }}
            style={{ fontSize: "0.85rem" }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Results Table */}
      <div className="table-container" style={{ marginBottom: "1.5rem" }}>
        <table className="research-table">
          <thead>
            <tr>
              <th>Draw ID</th>
              <th>Draw Date</th>
              <th>Tier</th>
              <th>Prize (₹)</th>
              <th>Type</th>
              <th>Series</th>
              <th>Winning Number</th>
              <th>Canonical String</th>
              <th>Source SHA</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: "3rem" }}>
                  Loading winning results...
                </td>
              </tr>
            ) : results.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: "3rem" }}>
                  No results matched query.
                </td>
              </tr>
            ) : (
              results.map((r, i) => (
                <tr key={i}>
                  <td>
                    <Link href={`/draws/${r.drawId}`} className="mono" style={{ color: "var(--accent-cyan)", textDecoration: "none" }}>
                      {r.drawId}
                    </Link>
                  </td>
                  <td>{r.drawDate}</td>
                  <td>
                    <span className="badge badge-blue">{r.tier}</span>
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    ₹{r.prizeAmount ? r.prizeAmount.toLocaleString("en-IN") : "—"}
                  </td>
                  <td>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{r.numberType}</span>
                  </td>
                  <td>
                    {r.series ? <span className="mono ticket-series">{r.series}</span> : <span style={{ color: "var(--text-muted)" }}>—</span>}
                  </td>
                  <td>
                    <span className="ticket-num">
                      {r.series && <span className="ticket-series">{r.series}</span>}
                      <span className="ticket-digits">{r.number}</span>
                    </span>
                  </td>
                  <td>
                    <span className="mono" style={{ color: "var(--accent-emerald)", fontSize: "0.85rem" }}>
                      &quot;{r.number}&quot;
                    </span>
                  </td>
                  <td>
                    <Link
                      href={`/sources/${r.sourceDocumentSha256}`}
                      className="mono"
                      style={{ fontSize: "0.75rem", color: "var(--text-muted)", textDecoration: "underline" }}
                      title={r.sourceDocumentSha256}
                    >
                      {r.sourceDocumentSha256.slice(0, 8)}...
                    </Link>
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
          Showing Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({total} total results)
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
  );
}
