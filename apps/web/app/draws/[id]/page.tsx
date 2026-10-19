"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

export default function DrawDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [draw, setDraw] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [resultsMeta, setResultsMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [tierFilter, setTierFilter] = useState("");
  const [numberFilter, setNumberFilter] = useState("");

  useEffect(() => {
    if (!id) return;
    fetch(`/api/v1/draws/${encodeURIComponent(id)}`)
      .then((res) => res.json())
      .then((data) => {
        setDraw(data.data);
      })
      .catch(console.error);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (tierFilter) q.set("prizeTier", tierFilter);
    if (numberFilter) q.set("ticketNumber", numberFilter.trim());

    fetch(`/api/v1/draws/${encodeURIComponent(id)}/results?${q.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        const items = data.data?.items || data.data || [];
        setResults(items);
        setResultsMeta(
          data.data && !Array.isArray(data.data)
            ? {
                page: data.data.page ?? page,
                pageSize: data.data.pageSize ?? 50,
                total: data.data.total ?? items.length,
                totalPages: data.data.totalPages ?? 1
              }
            : data.meta
        );
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id, page, tierFilter, numberFilter]);

  if (!draw && !loading) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <h2 className="text-lg font-bold text-slate-800">Draw Not Found</h2>
        <Link href="/draws" className="text-emerald-700 underline text-sm mt-2 inline-block">
          ← Return to Draws Archive
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/draws" className="hover:text-emerald-700 underline">
          Draws Archive
        </Link>
        <span>/</span>
        <span className="font-mono text-slate-700">{id}</span>
      </div>

      {draw && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-xs font-mono font-bold">
                  {draw.lotteryCode}
                </span>
                <h1 className="text-2xl font-bold text-slate-900">
                  {draw.lotteryName} — Draw {draw.drawNumber}
                </h1>
              </div>
              <p className="text-sm text-slate-500 mt-1 font-mono">
                Official Draw Date: {draw.drawDate} | ID: {draw.drawId || draw.id}
              </p>
            </div>
            <div className="text-xs font-mono text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>Scheme Version: {draw.schemeVersionId || draw.prizeSchemeId}</div>
              <div>
                First Prize:{" "}
                <span className="font-bold text-emerald-700">
                  {draw.firstPrizeNumber || "N/A"}
                </span>{" "}
                ({draw.firstPrizeLocation || "Location N/A"})
              </div>
              <div>
                Winning Records:{" "}
                <span className="font-semibold text-slate-800">
                  {draw.totalResultsCount}
                </span>{" "}
                ({draw.fullTicketCount} full tickets, {draw.suffixCount} suffixes)
              </div>
            </div>
          </div>

          {draw.sourceProvenance && (
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-xs font-mono text-slate-600 grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <span className="text-slate-400">Source Type:</span>{" "}
                <span className="font-semibold text-slate-800">
                  {draw.sourceProvenance.sourceType}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Parser Version:</span>{" "}
                <span className="font-semibold text-slate-800">
                  {draw.sourceProvenance.parserVersion}
                </span>
              </div>
              <div className="truncate" title={draw.sourceProvenance.documentSha256}>
                <span className="text-slate-400">Document SHA-256:</span>{" "}
                <span className="font-semibold text-slate-800">
                  {draw.sourceProvenance.documentSha256?.slice(0, 20)}...
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-end justify-between">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Prize Tier
            </label>
            <select
              value={tierFilter}
              onChange={(e) => {
                setTierFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Prize Tier"
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
            >
              <option value="">All Tiers</option>
              <option value="1st Prize">1st Prize</option>
              <option value="Consolation Prize">Consolation Prize</option>
              <option value="2nd Prize">2nd Prize</option>
              <option value="3rd Prize">3rd Prize</option>
              <option value="4th Prize">4th Prize</option>
              <option value="5th Prize">5th Prize</option>
              <option value="6th Prize">6th Prize</option>
              <option value="7th Prize">7th Prize</option>
              <option value="8th Prize">8th Prize</option>
              <option value="9th Prize">9th Prize</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Number / Suffix Search
            </label>
            <input
              type="text"
              placeholder="e.g. 4660 or SX 246140"
              value={numberFilter}
              onChange={(e) => {
                setNumberFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>
        </div>
        <div className="text-xs font-mono text-slate-500">
          Matching Results: {resultsMeta?.total ?? "..."}
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Prize Tier</th>
                <th className="py-3.5 px-4">Prize Amount (INR)</th>
                <th className="py-3.5 px-4">Record Type</th>
                <th className="py-3.5 px-4">Series</th>
                <th className="py-3.5 px-4">Winning Number / Suffix</th>
                <th className="py-3.5 px-4">Location / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Loading winning results...
                  </td>
                </tr>
              ) : results.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No winning numbers matched your filter.
                  </td>
                </tr>
              ) : (
                results.map((r: any, idx: number) => {
                  const tierLabel = r.prizeTierName || r.tier || "Prize";
                  const amountVal = Number(r.amount ?? r.prizeAmount ?? 0);
                  const isSuffixRecord =
                    typeof r.isSuffix === "boolean"
                      ? r.isSuffix
                      : r.numberType === "SUFFIX";
                  const winningNumberStr = String(
                    r.canonicalNumber ?? r.number ?? ""
                  );
                  return (
                    <tr key={r.id || idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {tierLabel}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        ₹{amountVal.toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-mono font-medium ${
                            !isSuffixRecord
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {isSuffixRecord ? "4-DIGIT SUFFIX" : "FULL TICKET"}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {r.series || "—"}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 tracking-wider">
                        {winningNumberStr}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">
                        {r.location || (r.rank === 1 ? draw?.firstPrizeLocation : "—") || "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {resultsMeta && (
          <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Page <span className="font-semibold text-slate-700">{resultsMeta.page}</span> of{" "}
              <span className="font-semibold text-slate-700">{resultsMeta.totalPages}</span>
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 border border-slate-300 rounded-md text-xs font-medium bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                disabled={page >= resultsMeta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 border border-slate-300 rounded-md text-xs font-medium bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
