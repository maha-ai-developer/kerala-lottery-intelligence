"use client";

import { useState } from "react";
import Link from "next/link";
import {
  type CandidateLabTicketInput,
  type CandidateLabAnalysis,
  type CandidateTradeOffItem
} from "@kerala-lottery/experiments";

interface PresetScenario {
  label: string;
  description: string;
  candidates: CandidateLabTicketInput[];
}

const PRESET_SCENARIOS: PresetScenario[] = [
  {
    label: "3 Karunya Series (Prompt Example: BB, BC, BD)",
    description: "Evaluates 3 candidates across different series in Karunya Plus (KN)",
    candidates: [
      { id: "A", lotteryCode: "KN", series: "BB", ticketNumber: "814615", userLabel: "Candidate A (KN BB)" },
      { id: "B", lotteryCode: "KN", series: "BC", ticketNumber: "271904", userLabel: "Candidate B (KN BC)" },
      { id: "C", lotteryCode: "KN", series: "BD", ticketNumber: "563281", userLabel: "Candidate C (KN BD)" }
    ]
  },
  {
    label: "Historical Winner vs Novel Candidates",
    description: "Compares BT-73 1st prize winner (BB 814615) with 2 unobserved tickets",
    candidates: [
      { id: "A", lotteryCode: "BT", series: "BB", ticketNumber: "814615", userLabel: "BT-73 Winner (BB)" },
      { id: "B", lotteryCode: "BT", series: "WA", ticketNumber: "123456", userLabel: "Ascending Serial (WA)" },
      { id: "C", lotteryCode: "BT", series: "WB", ticketNumber: "654321", userLabel: "Descending Serial (WB)" }
    ]
  },
  {
    label: "Parity Balance vs Extreme Repetition",
    description: "Compares balanced parity vs repeated digits and palindromes in Sthree Sakthi (SS)",
    candidates: [
      { id: "A", lotteryCode: "SS", series: "SA", ticketNumber: "777777", userLabel: "Uniform Digits (SA)" },
      { id: "B", lotteryCode: "SS", series: "SB", ticketNumber: "456654", userLabel: "Palindromic Pattern (SB)" },
      { id: "C", lotteryCode: "SS", series: "SC", ticketNumber: "246135", userLabel: "Balanced Parity (SC)" }
    ]
  },
  {
    label: "Monsoon Bumper 3-Series Comparison",
    description: "Compares 3 distinct series in Monsoon Bumper (BR-110)",
    candidates: [
      { id: "A", lotteryCode: "MONSOON_BUMPER", series: "MA", ticketNumber: "512890", userLabel: "Bumper Series MA" },
      { id: "B", lotteryCode: "MONSOON_BUMPER", series: "MB", ticketNumber: "234125", userLabel: "Bumper Series MB" },
      { id: "C", lotteryCode: "MONSOON_BUMPER", series: "MC", ticketNumber: "876543", userLabel: "Bumper Series MC" }
    ]
  }
];

type SortCriterion =
  | "INPUT_ORDER"
  | "LABEL"
  | "TICKET_NUMBER"
  | "DIGIT_SUM"
  | "TERMINAL_DIGIT_FREQ"
  | "SUFFIX2_FREQ"
  | "EXACT_MATCHES";

export default function CandidateLabPage() {
  const [candidates, setCandidates] = useState<CandidateLabTicketInput[]>([
    { id: "A", lotteryCode: "KN", series: "BB", ticketNumber: "814615", userLabel: "Candidate A" },
    { id: "B", lotteryCode: "KN", series: "BC", ticketNumber: "271904", userLabel: "Candidate B" },
    { id: "C", lotteryCode: "KN", series: "BD", ticketNumber: "563281", userLabel: "Candidate C" }
  ]);

  const [temporalCutoffDate, setTemporalCutoffDate] = useState<string>("");
  const [backtestWindows, setBacktestWindows] = useState<number>(4);
  const [analysis, setAnalysis] = useState<CandidateLabAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortCriterion>("INPUT_ORDER");

  const defaultLetters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

  const handleCandidateChange = (
    index: number,
    field: keyof CandidateLabTicketInput,
    value: string
  ) => {
    setCandidates((prev) => {
      const next = [...prev];
      const target = { ...next[index]! };
      if (field === "series") {
        target.series = value.toUpperCase();
      } else if (field === "ticketNumber") {
        target.ticketNumber = value;
      } else {
        (target as any)[field] = value;
      }
      next[index] = target;
      return next;
    });
  };

  const handleAddCandidate = () => {
    if (candidates.length >= 10) return;
    const nextIdx = candidates.length;
    const nextId = defaultLetters[nextIdx] || `${nextIdx + 1}`;
    setCandidates((prev) => [
      ...prev,
      {
        id: nextId,
        lotteryCode: prev[0]?.lotteryCode || "KN",
        series: "PA",
        ticketNumber: "123456",
        userLabel: `Candidate ${nextId}`
      }
    ]);
  };

  const handleRemoveCandidate = (index: number) => {
    if (candidates.length <= 2) return;
    setCandidates((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleApplyPreset = (preset: PresetScenario) => {
    setCandidates(preset.candidates);
    setAnalysis(null);
    setError(null);
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const candidateSpecs = candidates.map(
        (c) => `${c.lotteryCode}:${c.series.trim().toUpperCase()}:${c.ticketNumber.trim()}`
      );

      const params = new URLSearchParams();
      params.set("candidates", candidateSpecs.join(","));
      if (temporalCutoffDate) params.set("cutoffDate", temporalCutoffDate);
      if (backtestWindows) params.set("windows", String(backtestWindows));

      const res = await fetch(`/api/v1/candidate-lab?${params.toString()}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message || "Failed to analyze candidate set.");
      }

      setAnalysis(json.data || json);
    } catch (err: any) {
      console.error("Candidate Lab error:", err);
      setError(err.message || "An unexpected error occurred during candidate evaluation.");
    } finally {
      setLoading(false);
    }
  };

  const getSortedComparisonMatrix = (matrix: CandidateTradeOffItem[]) => {
    const list = [...matrix];
    switch (sortBy) {
      case "LABEL":
        return list.sort((a, b) => a.label.localeCompare(b.label));
      case "TICKET_NUMBER":
        return list.sort((a, b) => a.ticketNumber.localeCompare(b.ticketNumber));
      case "DIGIT_SUM":
        return list.sort((a, b) => a.digitSum - b.digitSum);
      case "TERMINAL_DIGIT_FREQ":
        return list.sort((a, b) => b.terminalDigitFreqPercent - a.terminalDigitFreqPercent);
      case "SUFFIX2_FREQ":
        return list.sort((a, b) => b.suffix2FreqPercent - a.suffix2FreqPercent);
      case "EXACT_MATCHES":
        return list.sort((a, b) => b.exactHistoricalMatches - a.exactHistoricalMatches);
      case "INPUT_ORDER":
      default:
        return list; // Preserves user input order
    }
  };

  return (
    <div className="container" style={{ padding: "2rem 1.5rem" }}>
      {/* Non-Predictive Scientific Boundary Banner */}
      <div className="scientific-notice" style={{ marginBottom: "2rem" }}>
        <strong>SCIENTIFIC & DESCRIPTIVE MULTI-CANDIDATE COMPARISON LAB</strong>
        <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.825rem", color: "var(--text-secondary)" }}>
          The Candidate Lab allows users to evaluate multiple candidate tickets against verified historical distributions,
          series occurrences, and walk-forward chronological checkpoints. Lottery draws are independent stochastic trials.
          The platform exposes empirical evidence to answer <em>&quot;How do my candidate choices compare with historical evidence?&quot;</em>
          &nbsp;It strictly does NOT predict which ticket will win, compute AI scores, or provide betting advice.
        </p>
      </div>

      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>
            {"Multi-Candidate Comparison & Backtesting Lab"}
          </h1>
          <span className="badge badge-emerald">V1.0 Final Feature</span>
          <span className="badge badge-blue">Comparative Replay</span>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", margin: 0 }}>
          Enter multiple candidate tickets (2 to 10) to validate structural syntax, compare mathematical features side-by-side,
          evaluate historical series frequencies, and inspect walk-forward temporal stability across historical windows.
        </p>
      </div>

      {/* Presets */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "0.5rem" }}>
          RESEARCH PRESETS (RAPID TEST SCENARIOS):
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {PRESET_SCENARIOS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              className="btn btn-outline"
              style={{ fontSize: "0.8rem", padding: "0.4rem 0.75rem" }}
              onClick={() => handleApplyPreset(p)}
              title={p.description}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Candidate Entry Form */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-medium)",
          borderRadius: "0.75rem",
          padding: "1.5rem",
          marginBottom: "2rem"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 600, margin: 0 }}>
            Enter Candidate Tickets ({candidates.length} of 10 max)
          </h2>
          <button
            type="button"
            className="btn btn-outline"
            style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem" }}
            onClick={handleAddCandidate}
            disabled={candidates.length >= 10}
          >
            + Add Candidate
          </button>
        </div>

        <form onSubmit={handleAnalyze}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
            {candidates.map((c, idx) => (
              <div
                key={idx}
                style={{
                  background: "rgba(15, 23, 42, 0.4)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "0.5rem",
                  padding: "1rem",
                  display: "grid",
                  gridTemplateColumns: "auto 1fr 140px 180px auto",
                  gap: "0.75rem",
                  alignItems: "center"
                }}
              >
                {/* Candidate Badge */}
                <div
                  style={{
                    background: "var(--accent-primary)",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: "0.9rem",
                    width: "2rem",
                    height: "2rem",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  {c.id || defaultLetters[idx]}
                </div>

                {/* Lottery Family */}
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.2rem" }}>
                    Lottery
                  </label>
                  <select
                    className="search-input"
                    value={c.lotteryCode}
                    onChange={(e) => handleCandidateChange(idx, "lotteryCode", e.target.value)}
                    style={{ width: "100%", padding: "0.45rem 0.6rem", fontSize: "0.85rem" }}
                  >
                    <option value="KN">KN — Karunya Plus Weekly</option>
                    <option value="BT">BT — Bhagyathara Weekly</option>
                    <option value="DL">DL — Dhanalekshmi Weekly</option>
                    <option value="SS">SS — Sthree-Sakthi Weekly</option>
                    <option value="SK">SK — Suvarna Keralam Weekly</option>
                    <option value="KR">KR — Karunya Weekly</option>
                    <option value="SM">SM — Samrudhi Weekly</option>
                    <option value="MONSOON_BUMPER">MONSOON_BUMPER (BR-110)</option>
                    <option value="THIRUVONAM_BUMPER">THIRUVONAM_BUMPER (BR-111)</option>
                  </select>
                </div>

                {/* Series */}
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.2rem" }}>
                    Series (2-Letter)
                  </label>
                  <input
                    type="text"
                    className="search-input mono"
                    placeholder="e.g. BB"
                    value={c.series}
                    maxLength={4}
                    onChange={(e) => handleCandidateChange(idx, "series", e.target.value)}
                    style={{ width: "100%", padding: "0.45rem 0.6rem", fontSize: "0.85rem", letterSpacing: "0.1em" }}
                    required
                  />
                </div>

                {/* Ticket Number */}
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.2rem" }}>
                    Ticket Number (6 Digits)
                  </label>
                  <input
                    type="text"
                    className="search-input mono"
                    placeholder="e.g. 814615"
                    value={c.ticketNumber}
                    maxLength={6}
                    onChange={(e) => handleCandidateChange(idx, "ticketNumber", e.target.value)}
                    style={{ width: "100%", padding: "0.45rem 0.6rem", fontSize: "0.85rem", fontWeight: 600, letterSpacing: "0.1em" }}
                    required
                  />
                </div>

                {/* Remove button */}
                <div style={{ paddingTop: "1rem" }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => handleRemoveCandidate(idx)}
                    disabled={candidates.length <= 2}
                    title={candidates.length <= 2 ? "Minimum 2 candidates required" : "Remove candidate"}
                    style={{ padding: "0.35rem 0.6rem", color: "var(--text-muted)", fontSize: "0.8rem" }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Temporal Cutoff & Window Controls */}
          <div
            style={{
              background: "rgba(15, 23, 42, 0.4)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "0.5rem",
              padding: "1rem",
              marginBottom: "1.5rem",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1.5rem"
            }}
          >
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.3rem" }}>
                Temporal Cutoff Date (Optional Replay Boundary YYYY-MM-DD)
              </label>
              <input
                type="date"
                className="search-input mono"
                value={temporalCutoffDate}
                onChange={(e) => setTemporalCutoffDate(e.target.value)}
                style={{ width: "100%", padding: "0.45rem 0.65rem", fontSize: "0.85rem" }}
              />
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                Enforces zero data leakage: draws occurring after this date are strictly excluded.
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.3rem" }}>
                Backtest Horizon Windows
              </label>
              <select
                className="search-input"
                value={backtestWindows}
                onChange={(e) => setBacktestWindows(parseInt(e.target.value, 10))}
                style={{ width: "100%", padding: "0.45rem 0.65rem", fontSize: "0.85rem" }}
              >
                <option value={2}>2 Windows (50% / 100% Horizons)</option>
                <option value={3}>3 Windows (33% / 66% / 100% Horizons)</option>
                <option value={4}>4 Windows (25% / 50% / 75% / 100% Horizons)</option>
                <option value={5}>5 Windows (20% / 40% / 60% / 80% / 100% Horizons)</option>
              </select>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                Evaluates candidate feature stability across sequential chronological horizons.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || candidates.length < 2}
              style={{ padding: "0.75rem 2rem", fontSize: "0.95rem", fontWeight: 600 }}
            >
              {loading ? "Evaluating Candidates..." : "ANALYZE ALL CANDIDATES"}
            </button>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Evaluates {candidates.length} candidates side-by-side against the 103-draw research corpus.
            </span>
          </div>
        </form>
      </div>

      {/* Error Message */}
      {error && (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid var(--accent-danger)",
            borderRadius: "0.5rem",
            padding: "1rem",
            color: "var(--accent-danger)",
            marginBottom: "2rem"
          }}
        >
          <strong>Evaluation Error:</strong> {error}
        </div>
      )}

      {/* Analysis Output */}
      {analysis && (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {/* Analysis Header & Overview */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-medium)",
              borderRadius: "0.75rem",
              padding: "1.25rem 1.5rem"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <span className="badge badge-emerald" style={{ marginRight: "0.5rem" }}>
                  Analysis Complete
                </span>
                <span className="mono" style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                  ID: {analysis.analysisId}
                </span>
              </div>
              <div style={{ display: "flex", gap: "1rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                <span>Corpus: <strong>{analysis.provenance.corpusVersion}</strong></span>
                <span>Candidates: <strong>{analysis.candidateCount}</strong></span>
                <span>Duplicates: <strong>{analysis.duplicateCount}</strong></span>
                <span>SHA-256: <strong className="mono">{analysis.deterministicHash.slice(0, 10)}...</strong></span>
              </div>
            </div>
          </div>

          {/* Section 1: Validation & Duplicate Status */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-medium)",
              borderRadius: "0.75rem",
              padding: "1.5rem"
            }}
          >
            <h2 style={{ fontSize: "1.15rem", fontWeight: 600, marginBottom: "1rem" }}>
              1. Candidate Structural Validation &amp; Duplicate Detection
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${analysis.validationSummaries.length}, 1fr)`, gap: "1rem" }}>
              {analysis.validationSummaries.map((v) => (
                <div
                  key={v.candidateId}
                  style={{
                    background: v.validation.isValid ? "rgba(16, 185, 129, 0.05)" : "rgba(239, 68, 68, 0.05)",
                    border: `1px solid ${v.validation.isValid ? "var(--accent-success)" : "var(--accent-danger)"}`,
                    borderRadius: "0.5rem",
                    padding: "1rem"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>{v.label}</span>
                    <span className={`badge ${v.validation.isValid ? "badge-emerald" : "badge-red"}`}>
                      {v.validation.isValid ? "VALID ✓" : "INVALID ✗"}
                    </span>
                  </div>
                  <div className="mono" style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>
                    {v.input.lotteryCode} / {v.input.series} / {v.input.ticketNumber}
                  </div>
                  {v.isDuplicate && (
                    <div style={{ fontSize: "0.75rem", color: "var(--accent-warning)", marginTop: "0.25rem" }}>
                      ⚠️ Duplicate entry of {v.duplicateOf}
                    </div>
                  )}
                  {v.validation.errors.length > 0 && (
                    <div style={{ fontSize: "0.75rem", color: "var(--accent-danger)", marginTop: "0.25rem" }}>
                      {v.validation.errors.join("; ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Mathematical Feature Profile Comparison (Side-by-Side Table) */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-medium)",
              borderRadius: "0.75rem",
              padding: "1.5rem"
            }}
          >
            <h2 style={{ fontSize: "1.15rem", fontWeight: 600, marginBottom: "1rem" }}>
              2. Mathematical Feature Comparison (Side-by-Side)
            </h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border-medium)", textAlign: "left" }}>
                    <th style={{ padding: "0.6rem 0.75rem" }}>Feature Attribute</th>
                    {analysis.featureProfiles.map((f) => (
                      <th key={f.candidateId} style={{ padding: "0.6rem 0.75rem" }}>
                        {f.label} ({f.series} {f.canonicalNumber})
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td style={{ padding: "0.6rem 0.75rem", fontWeight: 600 }}>Digit Sum</td>
                    {analysis.featureProfiles.map((f) => (
                      <td key={f.candidateId} style={{ padding: "0.6rem 0.75rem" }}>
                        <strong>{f.profile?.digitSum ?? "N/A"}</strong>
                      </td>
                    ))}
                  </tr>
                  <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td style={{ padding: "0.6rem 0.75rem", fontWeight: 600 }}>Parity Balance</td>
                    {analysis.featureProfiles.map((f) => (
                      <td key={f.candidateId} style={{ padding: "0.6rem 0.75rem" }}>
                        {f.profile ? `${f.profile.evenDigitCount} Even / ${f.profile.oddDigitCount} Odd (${f.profile.parityBalance})` : "N/A"}
                      </td>
                    ))}
                  </tr>
                  <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td style={{ padding: "0.6rem 0.75rem", fontWeight: 600 }}>First / Last Digit</td>
                    {analysis.featureProfiles.map((f) => (
                      <td key={f.candidateId} style={{ padding: "0.6rem 0.75rem" }} className="mono">
                        {f.profile ? `First: '${f.profile.firstDigit}' | Last: '${f.profile.lastDigit}'` : "N/A"}
                      </td>
                    ))}
                  </tr>
                  <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td style={{ padding: "0.6rem 0.75rem", fontWeight: 600 }}>Unique Digits</td>
                    {analysis.featureProfiles.map((f) => (
                      <td key={f.candidateId} style={{ padding: "0.6rem 0.75rem" }}>
                        {f.profile ? `${f.profile.uniqueDigitCount} unique (${f.profile.hasRepeatedDigit ? `${f.profile.repeatedDigitCount} repeated` : "None repeated"})` : "N/A"}
                      </td>
                    ))}
                  </tr>
                  <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td style={{ padding: "0.6rem 0.75rem", fontWeight: 600 }}>2-Digit Suffix</td>
                    {analysis.featureProfiles.map((f) => (
                      <td key={f.candidateId} style={{ padding: "0.6rem 0.75rem" }} className="mono">
                        {f.profile?.suffix2 ?? "N/A"}
                      </td>
                    ))}
                  </tr>
                  <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td style={{ padding: "0.6rem 0.75rem", fontWeight: 600 }}>3-Digit Suffix</td>
                    {analysis.featureProfiles.map((f) => (
                      <td key={f.candidateId} style={{ padding: "0.6rem 0.75rem" }} className="mono">
                        {f.profile?.suffix3 ?? "N/A"}
                      </td>
                    ))}
                  </tr>
                  <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td style={{ padding: "0.6rem 0.75rem", fontWeight: 600 }}>4-Digit Suffix</td>
                    {analysis.featureProfiles.map((f) => (
                      <td key={f.candidateId} style={{ padding: "0.6rem 0.75rem" }} className="mono">
                        {f.profile?.suffix4 ?? "N/A"}
                      </td>
                    ))}
                  </tr>
                  <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td style={{ padding: "0.6rem 0.75rem", fontWeight: 600 }}>Sequence Structure</td>
                    {analysis.featureProfiles.map((f) => (
                      <td key={f.candidateId} style={{ padding: "0.6rem 0.75rem" }}>
                        {f.profile?.structural.isPalindrome && <span className="badge badge-blue" style={{ marginRight: "0.25rem" }}>Palindrome</span>}
                        {f.profile?.structural.isAscending && <span className="badge badge-emerald" style={{ marginRight: "0.25rem" }}>Ascending</span>}
                        {f.profile?.structural.isDescending && <span className="badge badge-purple" style={{ marginRight: "0.25rem" }}>Descending</span>}
                        {!f.profile?.structural.isPalindrome && !f.profile?.structural.isAscending && !f.profile?.structural.isDescending && (
                          <span style={{ color: "var(--text-muted)" }}>Standard Distribution</span>
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Series Comparison View */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-medium)",
              borderRadius: "0.75rem",
              padding: "1.5rem"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 600, margin: 0 }}>
                3. Series-Level Descriptive Comparison
              </h2>
              <span className="badge badge-amber">EXPOSURE_UNAVAILABLE</span>
            </div>

            {/* Mandatory Exposure Disclaimer */}
            <div
              style={{
                background: "rgba(245, 158, 11, 0.08)",
                border: "1px solid var(--accent-warning)",
                borderRadius: "0.5rem",
                padding: "0.75rem 1rem",
                fontSize: "0.825rem",
                color: "var(--text-secondary)",
                marginBottom: "1.25rem"
              }}
            >
              <strong>MANDATORY CRITICAL DENOMINATOR NOTICE:</strong> {analysis.seriesComparison.criticalExposureNotice}
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border-medium)", textAlign: "left" }}>
                    <th style={{ padding: "0.6rem 0.75rem" }}>Series Code</th>
                    <th style={{ padding: "0.6rem 0.75rem" }}>Candidates</th>
                    <th style={{ padding: "0.6rem 0.75rem" }}>Observed Winners in Corpus</th>
                    <th style={{ padding: "0.6rem 0.75rem" }}>Distinct Draws</th>
                    <th style={{ padding: "0.6rem 0.75rem" }}>Major Prizes (1st-3rd)</th>
                    <th style={{ padding: "0.6rem 0.75rem" }}>Empirical Frequency</th>
                    <th style={{ padding: "0.6rem 0.75rem" }}>Exposure Status</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.seriesComparison.seriesItems.map((s) => (
                    <tr key={s.series} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <td style={{ padding: "0.6rem 0.75rem", fontWeight: 700 }} className="mono">
                        {s.series}
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem" }}>
                        {s.associatedCandidateIds.map((id) => (
                          <span key={id} className="badge badge-blue" style={{ marginRight: "0.25rem" }}>
                            {id}
                          </span>
                        ))}
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem" }}>{s.observedCorpusCount}</td>
                      <td style={{ padding: "0.6rem 0.75rem" }}>{s.distinctDrawsCount}</td>
                      <td style={{ padding: "0.6rem 0.75rem" }}>{s.majorPrizeWinnerCount}</td>
                      <td style={{ padding: "0.6rem 0.75rem" }} className="mono">
                        {(s.empiricalFrequency * 100).toFixed(2)}%
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem" }}>
                        <span className="badge badge-amber">{s.exposureStatus}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: Historical Corpus Comparison */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-medium)",
              borderRadius: "0.75rem",
              padding: "1.5rem"
            }}
          >
            <h2 style={{ fontSize: "1.15rem", fontWeight: 600, marginBottom: "1rem" }}>
              4. Historical Corpus Comparison (103 Draws / 39,550 Winning Results)
            </h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border-medium)", textAlign: "left" }}>
                    <th style={{ padding: "0.6rem 0.75rem" }}>Candidate</th>
                    <th style={{ padding: "0.6rem 0.75rem" }}>Exact Historical Matches</th>
                    <th style={{ padding: "0.6rem 0.75rem" }}>Terminal Digit Freq (95% CI)</th>
                    <th style={{ padding: "0.6rem 0.75rem" }}>2-Digit Suffix Freq</th>
                    <th style={{ padding: "0.6rem 0.75rem" }}>3-Digit Suffix Freq</th>
                    <th style={{ padding: "0.6rem 0.75rem" }}>Digit Sum Percentile</th>
                    <th style={{ padding: "0.6rem 0.75rem" }}>Descriptive Status</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.historicalComparisons.map((h) => (
                    <tr key={h.candidateId} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <td style={{ padding: "0.6rem 0.75rem", fontWeight: 600 }}>
                        {h.label} ({h.series} {h.canonicalNumber})
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem" }}>
                        {h.exactMatch.observedInCorpus ? (
                          <span className="badge badge-emerald">
                            {h.exactMatch.matchCount} Match(es)
                          </span>
                        ) : (
                          <span className="badge badge-gray">Novel (0 Matches)</span>
                        )}
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem" }} className="mono">
                        {(h.terminalDigit.empiricalFrequency * 100).toFixed(2)}%&nbsp;
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          [{(h.terminalDigit.wilsonConfidenceInterval95[0] * 100).toFixed(1)}%-
                          {(h.terminalDigit.wilsonConfidenceInterval95[1] * 100).toFixed(1)}%]
                        </span>
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem" }} className="mono">
                        &apos;{h.suffix2.suffix}&apos;: {(h.suffix2.empiricalFrequency * 100).toFixed(3)}% ({h.suffix2.observedCount})
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem" }} className="mono">
                        &apos;{h.suffix3.suffix}&apos;: {(h.suffix3.empiricalFrequency * 100).toFixed(4)}% ({h.suffix3.observedCount})
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem" }}>
                        <strong>{h.digitSum.empiricalPercentile}th</strong> ({h.digitSum.rarityClassification})
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem" }}>
                        {h.empiricalClassifications.map((c) => (
                          <span key={c} className="badge badge-blue" style={{ marginRight: "0.25rem", fontSize: "0.7rem" }}>
                            {c}
                          </span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 5: Chronological Backtesting & Historical Replay */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-medium)",
              borderRadius: "0.75rem",
              padding: "1.5rem"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 600, margin: 0 }}>
                5. Chronological Walk-Forward Backtesting (Zero Data Leakage Replay)
              </h2>
              <span className="badge badge-emerald">
                {analysis.backtestResults.temporalLeakageAssertionPassed ? "Zero Leakage Verified ✓" : "Leakage Alert"}
              </span>
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "1rem" }}>
              Replays candidate features across sequential historical draw windows. Only historical data strictly occurring on or
              before each window cutoff date is used. Evaluates how candidate empirical metrics evolve over time.
            </p>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border-medium)", textAlign: "left" }}>
                    <th style={{ padding: "0.6rem 0.75rem" }}>Candidate</th>
                    {analysis.backtestResults.windows.map((w) => (
                      <th key={w.windowIndex} style={{ padding: "0.6rem 0.75rem" }}>
                        {w.windowName}
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 400 }}>
                          Cutoff: {w.cutoffDate} ({w.drawCount} draws)
                        </div>
                      </th>
                    ))}
                    <th style={{ padding: "0.6rem 0.75rem" }}>Temporal Stability</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.backtestResults.candidateResults.map((b) => (
                    <tr key={b.candidateId} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <td style={{ padding: "0.6rem 0.75rem", fontWeight: 600 }}>
                        {b.label} ({b.series} {b.canonicalNumber})
                      </td>
                      {b.windowMetrics.map((m) => (
                        <td key={m.windowIndex} style={{ padding: "0.6rem 0.75rem" }}>
                          <div className="mono">Term: {(m.terminalDigitFrequency * 100).toFixed(2)}%</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                            S2: {(m.suffix2Frequency * 100).toFixed(3)}% | Matches: {m.cumulativeExactMatches}
                          </div>
                        </td>
                      ))}
                      <td style={{ padding: "0.6rem 0.75rem" }}>
                        <span
                          className={`badge ${
                            b.stabilityClassification === "HISTORICALLY STABLE"
                              ? "badge-emerald"
                              : b.stabilityClassification === "NOVEL"
                              ? "badge-blue"
                              : "badge-amber"
                          }`}
                        >
                          {b.stabilityClassification}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 6: Stability & Trade-offs Matrix */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-medium)",
              borderRadius: "0.75rem",
              padding: "1.5rem"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <h2 style={{ fontSize: "1.15rem", fontWeight: 600, margin: 0 }}>
                  6. Comparative Stability &amp; Trade-offs Matrix
                </h2>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  {analysis.tradeOffAnalysis.nonPredictiveNotice}
                </div>
              </div>

              {/* Sorting Controls */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}>
                <span>Sort by:</span>
                <select
                  className="search-input"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortCriterion)}
                  style={{ padding: "0.35rem 0.6rem", fontSize: "0.8rem" }}
                >
                  <option value="INPUT_ORDER">User Input Order (Default)</option>
                  <option value="LABEL">Candidate Label</option>
                  <option value="TICKET_NUMBER">Ticket Number</option>
                  <option value="DIGIT_SUM">Digit Sum</option>
                  <option value="TERMINAL_DIGIT_FREQ">Terminal Digit Frequency</option>
                  <option value="SUFFIX2_FREQ">Suffix-2 Frequency</option>
                  <option value="EXACT_MATCHES">Exact Historical Matches</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: `repeat(${analysis.tradeOffAnalysis.comparisonMatrix.length}, 1fr)`, gap: "1rem" }}>
              {getSortedComparisonMatrix(analysis.tradeOffAnalysis.comparisonMatrix).map((t) => (
                <div
                  key={t.candidateId}
                  style={{
                    background: "rgba(15, 23, 42, 0.4)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "0.5rem",
                    padding: "1.25rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 700, fontSize: "1rem" }}>{t.label}</span>
                    <span className="badge badge-blue">{t.stability}</span>
                  </div>
                  <div className="mono" style={{ fontSize: "0.9rem", color: "var(--accent-primary)" }}>
                    {t.series} {t.ticketNumber}
                  </div>

                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    <div>• Digit Sum: <strong>{t.digitSum}</strong> ({t.digitSumPercentile}th percentile)</div>
                    <div>• Parity: <strong>{t.parityBalance}</strong></div>
                    <div>• Terminal Digit Freq: <strong>{t.terminalDigitFreqPercent.toFixed(2)}%</strong></div>
                    <div>• Suffix-2 Freq: <strong>{t.suffix2FreqPercent.toFixed(3)}%</strong></div>
                    <div>• Series Observed Winners: <strong>{t.seriesObservedCount}</strong></div>
                    <div>• Exact Historical Matches: <strong>{t.exactHistoricalMatches}</strong></div>
                  </div>

                  {/* Descriptive Characteristics */}
                  <div style={{ marginTop: "0.5rem" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--accent-success)", marginBottom: "0.25rem" }}>
                      DESCRIPTIVE CHARACTERISTICS:
                    </div>
                    <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                      {t.descriptiveCharacteristics.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Descriptive Considerations */}
                  {t.descriptiveConsiderations.length > 0 && (
                    <div style={{ marginTop: "0.25rem" }}>
                      <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--accent-warning)", marginBottom: "0.25rem" }}>
                        CONSIDERATIONS:
                      </div>
                      <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                        {t.descriptiveConsiderations.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section 7: Research Interpretation */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-medium)",
              borderRadius: "0.75rem",
              padding: "1.5rem"
            }}
          >
            <h2 style={{ fontSize: "1.15rem", fontWeight: 600, marginBottom: "0.75rem" }}>
              7. Research Interpretation &amp; Decision Synthesis
            </h2>
            <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "1.25rem" }}>
              {analysis.researchInterpretation.summary}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
              {analysis.researchInterpretation.candidateInterpretations.map((ci) => (
                <div
                  key={ci.candidateId}
                  style={{
                    background: "rgba(15, 23, 42, 0.4)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "0.5rem",
                    padding: "1rem"
                  }}
                >
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.4rem" }}>
                    <strong>{ci.label}:</strong>
                    {ci.classifications.map((cl) => (
                      <span key={cl} className="badge badge-purple" style={{ fontSize: "0.7rem" }}>
                        {cl}
                      </span>
                    ))}
                  </div>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    {ci.descriptiveText}
                  </p>
                </div>
              ))}
            </div>

            <div
              style={{
                background: "rgba(16, 185, 129, 0.08)",
                border: "1px solid var(--accent-success)",
                borderRadius: "0.5rem",
                padding: "1rem",
                fontSize: "0.85rem",
                color: "var(--text-secondary)"
              }}
            >
              <strong>DECISION AUTHORITY:</strong> {analysis.researchInterpretation.globalNotice} The user evaluates
              the trade-offs and retains sole decision authority.
            </div>
          </div>

          {/* Section 8: Scientific Limitations & Provenance */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-medium)",
              borderRadius: "0.75rem",
              padding: "1.5rem"
            }}
          >
            <h2 style={{ fontSize: "1.15rem", fontWeight: 600, marginBottom: "1rem" }}>
              8. Scientific Limitations &amp; Cryptographic Provenance
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", fontSize: "0.85rem" }}>
              <div>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.5rem" }}>Platform Limitations</h3>
                <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  <li>{analysis.limitations.nonPredictiveDisclaimer}</li>
                  <li>{analysis.limitations.seriesExposureDisclaimer}</li>
                  <li>{analysis.limitations.districtExposureDisclaimer}</li>
                  {analysis.limitations.statisticalCaveats.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.5rem" }}>Immutable Provenance Lineage</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", color: "var(--text-secondary)" }}>
                  <div>Corpus Version: <strong className="mono">{analysis.provenance.corpusVersion}</strong></div>
                  <div>Feature Version: <strong className="mono">{analysis.provenance.featureVersion}</strong></div>
                  <div>Dataset Version: <strong className="mono">{analysis.provenance.datasetVersion}</strong></div>
                  <div>Candidate Set Version: <strong className="mono">{analysis.provenance.candidateSetVersion}</strong></div>
                  <div>Experiment Version: <strong className="mono">{analysis.provenance.experimentVersion}</strong></div>
                  <div>Validation Version: <strong className="mono">{analysis.provenance.validationVersion}</strong></div>
                  <div>Audit SHA-256: <strong className="mono">{analysis.provenance.auditSha256}</strong></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Footer */}
      <div style={{ marginTop: "3rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link href="/research-sandbox" className="btn btn-outline" style={{ fontSize: "0.85rem" }}>
          ← Back to Research Sandbox
        </Link>
        <Link href="/" className="btn btn-outline" style={{ fontSize: "0.85rem" }}>
          Platform Overview →
        </Link>
      </div>
    </div>
  );
}
