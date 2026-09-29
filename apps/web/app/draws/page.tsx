"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface DrawItem {
  id: string;
  lotteryCode: string;
  lotteryName: string;
  drawNumber: number;
  drawDate: string;
  totalResults: number;
  sourceDocumentSha256: string;
  prizeSchemeId: string;
  status: string;
}

function DrawsContent() {
  const searchParams = useSearchParams();
  const initialLottery = searchParams.get("lottery") || "";

  const [draws, setDraws] = useState<DrawItem[]>([]);
  const [lotteryFilter, setLotteryFilter] = useState(initialLottery);
  const [searchFilter, setSearchFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDraws() {
      setLoading(true);
      try {
        let url = `/api/v1/draws?page=${page}&limit=${limit}`;
        if (lotteryFilter) {
          url += `&lottery=${encodeURIComponent(lotteryFilter)}`;
        }
        if (searchFilter.trim()) {
          url += `&search=${encodeURIComponent(searchFilter.trim())}`;
        }

        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          setDraws(json.data || []);
          setTotal(json.pagination?.total || 0);
        }
      } catch (err) {
        console.error("Error fetching draws:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchDraws();
  }, [page, limit, lotteryFilter, searchFilter]);

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="container" style={{ padding: "2rem 1.5rem" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>
            Verified Lottery Draws
          </h1>
          <span className="badge badge-emerald">{total} Total Draws</span>
          <span className="badge badge-blue">Deterministic Registry</span>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", margin: 0 }}>
          Browse and filter all 100 historical official draws. Every draw links directly to its cryptographically verified gazetted PDF.
        </p>
      </div>

      {/* Filter Controls */}
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
            <option value="">All Lotteries (9)</option>
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

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1, minWidth: "200px" }}>
          <label style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Search:</label>
          <input
            type="text"
            className="search-input"
            placeholder="Draw # or Draw ID (e.g. 73 or kl-bt-73)..."
            value={searchFilter}
            onChange={(e) => {
              setSearchFilter(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {(lotteryFilter || searchFilter) && (
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              setLotteryFilter("");
              setSearchFilter("");
              setPage(1);
            }}
            style={{ fontSize: "0.85rem" }}
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Table Container */}
      <div className="table-container" style={{ marginBottom: "1.5rem" }}>
        <table className="research-table">
          <thead>
            <tr>
              <th>Draw ID</th>
              <th>Lottery</th>
              <th>Draw #</th>
              <th>Draw Date</th>
              <th>Results Count</th>
              <th>Prize Scheme ID</th>
              <th>Source SHA-256</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "3rem" }}>
                  Loading draws...
                </td>
              </tr>
            ) : draws.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "3rem" }}>
                  No draws found matching filters.
                </td>
              </tr>
            ) : (
              draws.map((d) => (
                <tr key={d.id}>
                  <td>
                    <Link href={`/draws/${d.id}`} className="mono" style={{ color: "var(--accent-cyan)", textDecoration: "none", fontWeight: 600 }}>
                      {d.id}
                    </Link>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{d.lotteryName}</span>{" "}
                    <span className="mono" style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>({d.lotteryCode})</span>
                  </td>
                  <td>
                    <span className="mono">#{d.drawNumber}</span>
                  </td>
                  <td>{d.drawDate}</td>
                  <td>
                    <span className="badge badge-emerald">
                      {d.totalResults} results
                    </span>
                  </td>
                  <td>
                    <Link href={`/schemes/${d.prizeSchemeId}`} className="mono" style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textDecoration: "none" }}>
                      {d.prizeSchemeId}
                    </Link>
                  </td>
                  <td>
                    <Link
                      href={`/sources/${d.sourceDocumentSha256}`}
                      className="mono"
                      style={{ fontSize: "0.75rem", color: "var(--accent-cyan)", textDecoration: "underline" }}
                      title={d.sourceDocumentSha256}
                    >
                      {d.sourceDocumentSha256.slice(0, 10)}...
                    </Link>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.35rem" }}>
                      <Link href={`/draws/${d.id}`} className="btn btn-outline" style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}>
                        Inspect
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
          Showing Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({total} total draws)
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

export default function DrawsPage() {
  return (
    <Suspense
      fallback={
        <div className="container" style={{ padding: "3rem 1rem", textAlign: "center", color: "var(--text-muted)" }}>
          Loading draw catalog...
        </div>
      }
    >
      <DrawsContent />
    </Suspense>
  );
}
