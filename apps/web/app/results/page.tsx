"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function ResultsSearchPage() {
  const [results, setResults] = useState<any[]>([]);
  const [draws, setDraws] = useState<any[]>([]);
  const [selectedDrawId, setSelectedDrawId] = useState<string>("");
  const [selectedDrawMeta, setSelectedDrawMeta] = useState<any>(null);
  const [corpusMeta, setCorpusMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<any>(null);

  const [tier, setTier] = useState("");
  const [searchNumber, setSearchNumber] = useState("");

  useEffect(() => {
    async function loadDraws() {
      try {
        const res = await fetch("/api/v1/draws?page=1&pageSize=120");
        const json = await res.json();
        const items = json.data?.items || json.data || [];
        setDraws(items);
        if (json.meta) setCorpusMeta(json.meta);
        if (items.length > 0 && !selectedDrawId) {
          const latest = items[0];
          setSelectedDrawId(latest.drawId || latest.id);
          setSelectedDrawMeta(latest);
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadDraws();
  }, []);

  useEffect(() => {
    if (!selectedDrawId) return;
    setLoading(true);
    const matchedDraw = draws.find((d) => (d.drawId || d.id) === selectedDrawId);
    if (matchedDraw) setSelectedDrawMeta(matchedDraw);

    const params = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (tier) params.set("prizeTier", tier);
    if (searchNumber) params.set("ticketNumber", searchNumber.trim());

    fetch(`/api/v1/draws/${encodeURIComponent(selectedDrawId)}/results?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        const items = data.data?.items || data.data || [];
        setResults(items);
        setMeta(
          data.data
            ? {
                page: data.data.page ?? page,
                pageSize: data.data.pageSize ?? 50,
                total: data.data.total ?? items.length,
                totalPages: data.data.totalPages ?? 1
              }
            : data.meta
        );
        if (data.meta) setCorpusMeta(data.meta);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedDrawId, page, tier, searchNumber, draws]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Winning Results Explorer</h1>
          <p className="text-sm text-slate-500 mt-1">
            Inspect verified winning tickets and 4-digit suffixes across all official draws through{" "}
            <span className="font-semibold text-slate-700">
              {draws[0]?.drawDate || corpusMeta?.evaluationCutoffDate || "2026-10-18"}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <span className="bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-md border border-emerald-200 font-semibold">
            45,600 Total Results ({draws.length || 119} Draws)
          </span>
          <span className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-md border border-slate-200">
            Corpus: {corpusMeta?.corpusVersion || "corpus_2dd9b930c32ea047"}
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Official Draw ({draws.length || 119} Verified Draws)
          </label>
          <select
            value={selectedDrawId}
            onChange={(e) => {
              setSelectedDrawId(e.target.value);
              setPage(1);
            }}
            aria-label="Official Draw Selector"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white font-mono"
          >
            {draws.map((d) => {
              const id = d.drawId || d.id;
              return (
                <option key={id} value={id}>
                  {d.drawDate} — {d.drawNumber} ({d.lotteryName}) [{d.totalResultsCount} records]
                </option>
              );
            })}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Prize Tier Filter
          </label>
          <select
            value={tier}
            onChange={(e) => {
              setTier(e.target.value);
              setPage(1);
            }}
            aria-label="Prize Tier Filter"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
          >
            <option value="">All Prize Tiers</option>
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
            Search Ticket Number or 4-Digit Suffix
          </label>
          <input
            type="text"
            placeholder="e.g. 4660 or SX 246140 (preserves leading zeroes)"
            value={searchNumber}
            onChange={(e) => {
              setSearchNumber(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>
      </div>

      {/* Selected Draw Provenance Strip */}
      {selectedDrawMeta && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-xs font-bold font-mono">
                {selectedDrawMeta.lotteryCode}
              </span>
              <span className="font-bold text-slate-900">
                {selectedDrawMeta.lotteryName} — {selectedDrawMeta.drawNumber}
              </span>
              <span className="text-xs text-slate-500 font-mono">
                Draw Date: {selectedDrawMeta.drawDate}
              </span>
            </div>
            <p className="text-xs text-slate-600 font-mono">
              1st Prize Winner:{" "}
              <span className="font-bold text-emerald-700">
                {selectedDrawMeta.firstPrizeNumber || "N/A"}
              </span>{" "}
              ({selectedDrawMeta.firstPrizeLocation || "Location N/A"}) • Total Records:{" "}
              <span className="font-semibold">{selectedDrawMeta.totalResultsCount}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/draws/${selectedDrawMeta.drawId || selectedDrawMeta.id}`}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors"
            >
              Open Full Draw & Provenance Details →
            </Link>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Draw</th>
                <th className="py-3.5 px-4">Prize Tier</th>
                <th className="py-3.5 px-4">Prize Amount (INR)</th>
                <th className="py-3.5 px-4">Record Type</th>
                <th className="py-3.5 px-4">Series</th>
                <th className="py-3.5 px-4">Winning Number / Suffix</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Loading official winning results...
                  </td>
                </tr>
              ) : results.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No winning results matched your filter criteria in this draw.
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
                      <td className="py-3 px-4 font-mono text-xs text-slate-600">
                        <Link
                          href={`/draws/${r.drawId || selectedDrawId}`}
                          className="text-emerald-700 hover:underline font-semibold"
                        >
                          {r.drawNumber || selectedDrawMeta?.drawNumber}
                        </Link>
                        <div className="text-[11px] text-slate-400">
                          {r.drawDate || selectedDrawMeta?.drawDate}
                        </div>
                      </td>
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
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {meta && (
          <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Page <span className="font-semibold text-slate-700">{meta.page}</span> of{" "}
              <span className="font-semibold text-slate-700">{meta.totalPages}</span>{" "}
              ({meta.total} records in selected draw)
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
                disabled={page >= meta.totalPages}
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
