"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function DrawsListPage() {
  const [draws, setDraws] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [corpusMeta, setCorpusMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [lotteryCode, setLotteryCode] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (lotteryCode) params.set("lotteryCode", lotteryCode);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    fetch(`/api/v1/draws?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        const payload = json.data;
        const items = Array.isArray(payload) ? payload : payload?.items || [];
        setDraws(items);
        setMeta(
          payload && !Array.isArray(payload)
            ? {
                page: payload.page ?? page,
                pageSize: payload.pageSize ?? 20,
                total: payload.total ?? items.length,
                totalPages: payload.totalPages ?? 1
              }
            : json.meta
        );
        if (json.meta) setCorpusMeta(json.meta);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [lotteryCode, dateFrom, dateTo, page]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Draws Archive</h1>
          <p className="text-sm text-slate-500 mt-1">
            Browse and filter all {meta?.total || 119} verified official draws in the active research corpus (through{" "}
            <span className="font-semibold text-slate-700">
              {corpusMeta?.evaluationCutoffDate || "2026-10-18"}
            </span>
            )
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-slate-500 bg-slate-100 px-3 py-1.5 rounded-md">
          <span>Total Matched Draws: {meta?.total ?? "..."}</span>
          {corpusMeta?.corpusVersion && (
            <span className="border-l border-slate-300 pl-2 text-emerald-700 font-semibold">
              {corpusMeta.corpusVersion}
            </span>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Lottery Scheme
          </label>
          <select
            value={lotteryCode}
            onChange={(e) => {
              setLotteryCode(e.target.value);
              setPage(1);
            }}
            aria-label="Lottery Scheme Filter"
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
          >
            <option value="">All Schemes (Active Corpus)</option>
            <option value="SM">SM (Samrudhi)</option>
            <option value="BT">BT (Bhagyathara)</option>
            <option value="SS">SS (Sthree Sakthi)</option>
            <option value="DL">DL (Dhanalakshmi)</option>
            <option value="KN">KN (Karunya Plus)</option>
            <option value="SK">SK (Suvarna Keralam)</option>
            <option value="KR">KR (Karunya)</option>
            <option value="BR">BR (Bumper)</option>
            <option value="WW">WW (Win-Win — Historical)</option>
            <option value="FF">FF (Fifty-Fifty — Historical)</option>
            <option value="NR">NR (Nirmal — Historical)</option>
            <option value="AK">AK (Akshaya — Historical)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Date From
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Date To
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>
        {(lotteryCode || dateFrom || dateTo) && (
          <button
            onClick={() => {
              setLotteryCode("");
              setDateFrom("");
              setDateTo("");
              setPage(1);
            }}
            className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 underline"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Draw Date</th>
                <th className="py-3.5 px-4">Code</th>
                <th className="py-3.5 px-4">Draw Number</th>
                <th className="py-3.5 px-4">Lottery Name</th>
                <th className="py-3.5 px-4">1st Prize Winner</th>
                <th className="py-3.5 px-4">Records</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Loading official draw records...
                  </td>
                </tr>
              ) : draws.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No draws matched your filter criteria.
                  </td>
                </tr>
              ) : (
                draws.map((d: any) => {
                  const drawId = d.drawId || d.id;
                  return (
                    <tr key={drawId} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-700">{d.drawDate}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-mono font-bold">
                          {d.lotteryCode}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-900">
                        {d.drawNumber}
                      </td>
                      <td className="py-3 px-4 text-slate-700">{d.lotteryName}</td>
                      <td className="py-3 px-4 font-mono text-xs text-emerald-700 font-semibold">
                        {d.firstPrizeNumber || "—"}
                        {d.firstPrizeLocation ? (
                          <span className="text-slate-400 font-normal ml-1">
                            ({d.firstPrizeLocation})
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600">
                        {d.totalResultsCount ?? "—"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/draws/${drawId}`}
                          className="text-emerald-700 hover:text-emerald-800 font-medium text-xs bg-emerald-50 px-2.5 py-1.5 rounded-md border border-emerald-200"
                        >
                          Inspect Draw →
                        </Link>
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
              <span className="font-semibold text-slate-700">{meta.totalPages}</span>
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
