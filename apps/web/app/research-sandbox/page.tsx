"use client";

import { useState } from "react";
import Link from "next/link";
import {
  type CandidateTicketInput,
  type ResearchSandboxAnalysis
} from "@kerala-lottery/experiments";

const PRESET_TICKETS: Array<{
  label: string;
  description: string;
  input: CandidateTicketInput;
}> = [
  {
    label: "Historical Anchor (BT-73 1st Prize)",
    description: "Official 1st Prize winner from canonical anchor draw Bhagyathara BT-73",
    input: {
      lotteryCode: "BT",
      series: "BB",
      ticketNumber: "814615",
      drawId: "draw_bt73",
      drawDate: "28/09/2026",
      isHistoricalReplay: true
    }
  },
  {
    label: "Leading-Zero Ticket (KN Karunya Plus)",
    description: "Valid 6-digit candidate with preserved leading zeros",
    input: {
      lotteryCode: "KN",
      series: "PA",
      ticketNumber: "004582"
    }
  },
  {
    label: "Ascending Adjacent Digits",
    description: "Candidate ticket exhibiting strictly ascending sequence (123456)",
    input: {
      lotteryCode: "DL",
      series: "DA",
      ticketNumber: "123456"
    }
  },
  {
    label: "Palindromic Pattern",
    description: "Symmetric numeric pattern reading identically forwards and backwards",
    input: {
      lotteryCode: "SS",
      series: "SA",
      ticketNumber: "456654"
    }
  },
  {
    label: "Monsoon Bumper (BR-110 Valid Series)",
    description: "5-series bumper lottery with known series MA-ME",
    input: {
      lotteryCode: "MONSOON_BUMPER",
      series: "MB",
      ticketNumber: "512890"
    }
  },
  {
    label: "Invalid Series Test Case",
    description: "Demonstrates strict validation failure when series code is invalid",
    input: {
      lotteryCode: "KN",
      series: "XYZ",
      ticketNumber: "998877"
    }
  }
];

export default function ResearchSandboxPage() {
  const [formData, setFormData] = useState<CandidateTicketInput>({
    lotteryCode: "KN",
    series: "PA",
    ticketNumber: "123456",
    schemeVersionId: "",
    drawId: "",
    temporalCutoffDate: "",
    userProvidedContext: "",
    isHistoricalReplay: false
  });

  const [analysis, setAnalysis] = useState<ResearchSandboxAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (field: keyof CandidateTicketInput, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleApplyPreset = (preset: CandidateTicketInput) => {
    setFormData({
      lotteryCode: preset.lotteryCode,
      series: preset.series,
      ticketNumber: preset.ticketNumber,
      schemeVersionId: preset.schemeVersionId || "",
      drawId: preset.drawId || "",
      temporalCutoffDate: preset.temporalCutoffDate || "",
      userProvidedContext: preset.userProvidedContext || "",
      isHistoricalReplay: preset.isHistoricalReplay || false
    });
    setAnalysis(null);
    setError(null);
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("lottery", formData.lotteryCode);
      params.set("series", formData.series.trim().toUpperCase());
      params.set("number", formData.ticketNumber.trim());

      if (formData.schemeVersionId) params.set("scheme", formData.schemeVersionId);
      if (formData.drawId) params.set("drawId", formData.drawId);
      if (formData.temporalCutoffDate) params.set("cutoffDate", formData.temporalCutoffDate);
      if (formData.userProvidedContext) params.set("context", formData.userProvidedContext);

      const res = await fetch(`/api/v1/research-sandbox?${params.toString()}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message || "Failed to analyze candidate ticket.");
      }

      setAnalysis(json.data || json);
    } catch (err: any) {
      console.error("Sandbox analysis error:", err);
      setError(err.message || "An unexpected error occurred during sandbox evaluation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ padding: "2rem 1.5rem" }}>
      {/* Non-Predictive Scientific Notice */}
      <div className="scientific-notice" style={{ marginBottom: "2rem" }}>
        <strong>SCIENTIFIC & RETROSPECTIVE RESEARCH SANDBOX ONLY</strong>
        <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.825rem", color: "var(--text-secondary)" }}>
          This sandbox provides empirical structural validation, feature extraction, and retrospective comparison against
          the verified 103-draw research corpus. Lottery draws are independent stochastic physical trials.
          Historical feature frequencies provide zero predictive utility, winning probability, or betting recommendations.
        </p>
      </div>

      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>
            Kerala Lottery Research Sandbox
          </h1>
          <span className="badge badge-emerald">V1.0 Scientific Platform</span>
          <span className="badge badge-blue">Directive 11</span>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", margin: 0, marginBottom: "0.75rem" }}>
          Enter a candidate ticket or historical draw input to evaluate its structural validity against official prize
          schemes, extract mathematical features, and inspect its empirical position in the historical research corpus.
        </p>
        <div>
          <Link
            href="/candidate-lab"
            className="btn btn-outline"
            style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem", borderColor: "var(--accent-primary)", color: "var(--accent-primary)" }}
          >
            Switch to Multi-Candidate Comparison &amp; Backtesting Lab →
          </Link>
        </div>
      </div>

      {/* Preset Quick Selectors */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "0.5rem" }}>
          RESEARCH PRESETS (TEST CASES):
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {PRESET_TICKETS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              className="btn btn-outline"
              style={{ fontSize: "0.8rem", padding: "0.4rem 0.75rem" }}
              onClick={() => handleApplyPreset(p.input)}
              title={p.description}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sandbox Input Form */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-medium)",
          borderRadius: "0.75rem",
          padding: "1.5rem",
          marginBottom: "2rem"
        }}
      >
        <form onSubmit={handleAnalyze}>
          <div className="grid-3" style={{ gap: "1.25rem", marginBottom: "1.25rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                Lottery Code / Scheme Family *
              </label>
              <select
                className="search-input"
                value={formData.lotteryCode}
                onChange={(e) => handleInputChange("lotteryCode", e.target.value)}
                style={{ width: "100%", padding: "0.6rem 0.75rem" }}
              >
                <option value="BT">BT — Bhagyathara Weekly</option>
                <option value="DL">DL — Dhanalekshmi Weekly</option>
                <option value="KN">KN — Karunya Plus Weekly</option>
                <option value="SS">SS — Sthree-Sakthi Weekly</option>
                <option value="SK">SK — Suvarna Keralam Weekly</option>
                <option value="KR">KR — Karunya Weekly</option>
                <option value="SM">SM — Samrudhi Weekly</option>
                <option value="MONSOON_BUMPER">MONSOON_BUMPER — Monsoon Bumper (BR-110)</option>
                <option value="THIRUVONAM_BUMPER">THIRUVONAM_BUMPER — Thiruvonam Bumper (BR-111)</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                Series Code *
              </label>
              <input
                type="text"
                className="search-input mono"
                placeholder="e.g. PA, WA, MB"
                value={formData.series}
                maxLength={4}
                onChange={(e) => handleInputChange("series", e.target.value.toUpperCase())}
                style={{ width: "100%", padding: "0.6rem 0.75rem", letterSpacing: "0.1em" }}
                required
              />
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                Weekly: 2-letter uppercase (12 series). Bumper: specific series set (e.g. MA-ME).
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                Ticket Number (6 Digits) *
              </label>
              <input
                type="text"
                className="search-input mono"
                placeholder="e.g. 025916, 123456"
                value={formData.ticketNumber}
                maxLength={6}
                onChange={(e) => handleInputChange("ticketNumber", e.target.value)}
                style={{ width: "100%", padding: "0.6rem 0.75rem", letterSpacing: "0.1em", fontWeight: 600 }}
                required
              />
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                Leading zeros are strictly preserved as immutable canonical strings.
              </div>
            </div>
          </div>

          {/* Optional Replay and Context Settings */}
          <div
            style={{
              background: "rgba(15, 23, 42, 0.4)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "0.5rem",
              padding: "1rem",
              marginBottom: "1.25rem"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                OPTIONAL HISTORICAL REPLAY & TEMPORAL CUTOFF CONTROLS
              </span>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={formData.isHistoricalReplay}
                  onChange={(e) => handleInputChange("isHistoricalReplay", e.target.checked)}
                />
                Replay Mode (Historical Target)
              </label>
            </div>

            <div className="grid-3" style={{ gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                  Historical Draw ID
                </label>
                <input
                  type="text"
                  className="search-input mono"
                  placeholder="e.g. draw_bt73, 73"
                  value={formData.drawId || ""}
                  onChange={(e) => handleInputChange("drawId", e.target.value)}
                  style={{ fontSize: "0.85rem", padding: "0.45rem 0.65rem" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                  Temporal Cutoff Date (YYYY-MM-DD)
                </label>
                <input
                  type="text"
                  className="search-input mono"
                  placeholder="e.g. 2026-09-28"
                  value={formData.temporalCutoffDate || ""}
                  onChange={(e) => handleInputChange("temporalCutoffDate", e.target.value)}
                  style={{ fontSize: "0.85rem", padding: "0.45rem 0.65rem" }}
                />
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                  Corpus strictly excludes draws on or after this cutoff (zero leakage).
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                  Context / Notes (User Provided)
                </label>
                <input
                  type="text"
                  className="search-input"
                  placeholder="e.g. Purchased in Ernakulam"
                  value={formData.userProvidedContext || ""}
                  onChange={(e) => handleInputChange("userProvidedContext", e.target.value)}
                  style={{ fontSize: "0.85rem", padding: "0.45rem 0.65rem" }}
                />
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", alignItems: "center" }}>
            {error && (
              <span style={{ color: "#f87171", fontSize: "0.85rem", fontWeight: 500 }}>
                {error}
              </span>
            )}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ padding: "0.6rem 1.5rem", fontSize: "0.95rem", fontWeight: 600 }}
            >
              {loading ? "Analyzing Candidate Ticket..." : "ANALYZE INPUT"}
            </button>
          </div>
        </form>
      </div>

      {/* Analysis Results */}
      {analysis && (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {/* SECTION A: INPUT & FINGERPRINT */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-medium)",
              borderRadius: "0.75rem",
              padding: "1.5rem"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span className="badge badge-blue">SECTION A</span>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Input & Deterministic Fingerprint</h2>
              </div>
              <span className="mono" style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Analysis ID: <strong style={{ color: "var(--accent-cyan)" }}>{analysis.analysisId}</strong>
              </span>
            </div>

            <div className="grid-4" style={{ gap: "1rem" }}>
              <div className="stat-card">
                <div className="stat-label">Lottery Scheme</div>
                <div style={{ fontWeight: 600, fontSize: "1.1rem", marginTop: "0.25rem" }}>
                  {analysis.input.lotteryCode}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  {analysis.validation.resolvedLottery?.name || "Kerala State Lottery"}
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-label">Series Code</div>
                <div className="mono" style={{ fontWeight: 700, fontSize: "1.25rem", color: "var(--accent-cyan)", marginTop: "0.25rem" }}>
                  {analysis.input.series}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  {analysis.validation.seriesValidation?.explanation || "Series"}
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-label">Ticket Number (Canonical)</div>
                <div className="mono" style={{ fontWeight: 700, fontSize: "1.25rem", color: "var(--accent-emerald)", marginTop: "0.25rem" }}>
                  {analysis.input.ticketNumber}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Length: {analysis.input.ticketNumber.length} digits (leading zeros preserved)
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-label">Temporal Cutoff</div>
                <div className="mono" style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginTop: "0.35rem" }}>
                  {analysis.historicalComparison?.temporalCutoffApplied
                    ? analysis.historicalComparison.cutoffDate
                    : "None (Full 103 Draws)"}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  {analysis.historicalComparison?.temporalCutoffApplied ? "Zero Future Leakage" : "Full Corpus Evaluation"}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION B: STRUCTURAL VALIDATION */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: analysis.validation.isValid
                ? "1px solid rgba(16, 185, 129, 0.4)"
                : "1px solid rgba(239, 68, 68, 0.5)",
              borderRadius: "0.75rem",
              padding: "1.5rem"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span className="badge badge-purple">SECTION B</span>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Structural & Prize Scheme Validation</h2>
              </div>
              <span className={`badge ${analysis.validation.isValid ? "badge-emerald" : "badge-red"}`} style={{ fontSize: "0.85rem", padding: "0.3rem 0.6rem" }}>
                {analysis.validation.isValid ? "STRUCTURALLY VALID" : "INVALID INPUT"}
              </span>
            </div>

            {analysis.validation.errors.length > 0 && (
              <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "0.5rem", padding: "1rem", marginBottom: "1rem" }}>
                <strong style={{ color: "#f87171", fontSize: "0.9rem" }}>Validation Failure Reasons:</strong>
                <ul style={{ margin: "0.5rem 0 0 1.25rem", padding: 0, color: "#fca5a5", fontSize: "0.85rem" }}>
                  {analysis.validation.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.validation.warnings.length > 0 && (
              <div style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: "0.5rem", padding: "0.75rem 1rem", marginBottom: "1rem" }}>
                <span style={{ color: "#fbbf24", fontSize: "0.85rem" }}>
                  {analysis.validation.warnings.join(" ")}
                </span>
              </div>
            )}

            <div className="table-container">
              <table className="research-table">
                <thead>
                  <tr>
                    <th>Check ID</th>
                    <th>Validation Item</th>
                    <th>Status</th>
                    <th>Evidence / Rule Specification</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.validation.checks.map((chk, i) => (
                    <tr key={i}>
                      <td className="mono" style={{ fontSize: "0.8rem" }}>{chk.checkId}</td>
                      <td style={{ fontWeight: 600 }}>{chk.checkName}</td>
                      <td>
                        <span className={`badge ${chk.status === "PASS" ? "badge-emerald" : chk.status === "FAIL" ? "badge-red" : "badge-yellow"}`}>
                          {chk.status}
                        </span>
                      </td>
                      <td style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{chk.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Only render feature profile, historical comparison, etc., if validation passed */}
          {analysis.featureProfile && analysis.historicalComparison && (
            <>
              {/* SECTION C: MATHEMATICAL FEATURE PROFILE */}
              <div
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-medium)",
                  borderRadius: "0.75rem",
                  padding: "1.5rem"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
                  <span className="badge badge-blue">SECTION C</span>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Mathematical Feature Profile</h2>
                </div>

                <div className="grid-4" style={{ gap: "1rem", marginBottom: "1.5rem" }}>
                  <div className="stat-card">
                    <div className="stat-label">Terminal Digit (Last)</div>
                    <div className="mono" style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--accent-cyan)" }}>
                      {analysis.featureProfile.lastDigit}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      Target of 9B baselines
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-label">Initial Digit (First)</div>
                    <div className="mono" style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--accent-cyan)" }}>
                      {analysis.featureProfile.firstDigit}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      Positional lead digit
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-label">Digit Sum</div>
                    <div className="mono" style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--accent-purple)" }}>
                      {analysis.featureProfile.digitSum}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      Theoretical Mean = 27.0 (Range: 0-54)
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-label">Parity Balance</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--accent-emerald)" }}>
                      {analysis.featureProfile.parityBalance}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {analysis.featureProfile.evenDigitCount} Even / {analysis.featureProfile.oddDigitCount} Odd
                    </div>
                  </div>
                </div>

                {/* Structural patterns */}
                <div
                  style={{
                    background: "rgba(15, 23, 42, 0.5)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "0.5rem",
                    padding: "1rem",
                    marginBottom: "1rem"
                  }}
                >
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "0.75rem" }}>
                    ALGORITHMIC STRUCTURAL PATTERNS:
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                    <div className="badge" style={{ background: analysis.featureProfile.structural.isPalindrome ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.05)" }}>
                      Palindrome: {analysis.featureProfile.structural.isPalindrome ? "YES" : "NO"}
                    </div>
                    <div className="badge" style={{ background: analysis.featureProfile.structural.allDigitsSame ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.05)" }}>
                      All Digits Identical: {analysis.featureProfile.structural.allDigitsSame ? "YES" : "NO"}
                    </div>
                    <div className="badge" style={{ background: analysis.featureProfile.structural.isAscending ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.05)" }}>
                      Strictly Ascending: {analysis.featureProfile.structural.isAscending ? "YES" : "NO"}
                    </div>
                    <div className="badge" style={{ background: analysis.featureProfile.structural.isDescending ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.05)" }}>
                      Strictly Descending: {analysis.featureProfile.structural.isDescending ? "YES" : "NO"}
                    </div>
                    <div className="badge" style={{ background: analysis.featureProfile.structural.isAlternating ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.05)" }}>
                      Alternating Pattern: {analysis.featureProfile.structural.isAlternating ? "YES" : "NO"}
                    </div>
                    <div className="badge">
                      Unique Digits: {analysis.featureProfile.uniqueDigitCount} / 6
                    </div>
                    <div className="badge">
                      Repeated Adjacent Pairs: {analysis.featureProfile.structural.repeatedAdjacentPairCount}
                    </div>
                  </div>
                </div>

                {/* Suffix Features */}
                <div className="grid-3" style={{ gap: "1rem" }}>
                  <div style={{ background: "rgba(255, 255, 255, 0.02)", padding: "0.75rem 1rem", borderRadius: "0.5rem", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>SUFFIX-2 (Terminal Pair)</div>
                    <div className="mono" style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--accent-cyan)", marginTop: "0.25rem" }}>
                      &quot;{analysis.featureProfile.suffix2}&quot;
                    </div>
                  </div>
                  <div style={{ background: "rgba(255, 255, 255, 0.02)", padding: "0.75rem 1rem", borderRadius: "0.5rem", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>SUFFIX-3 (Terminal Triplet)</div>
                    <div className="mono" style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--accent-cyan)", marginTop: "0.25rem" }}>
                      &quot;{analysis.featureProfile.suffix3}&quot;
                    </div>
                  </div>
                  <div style={{ background: "rgba(255, 255, 255, 0.02)", padding: "0.75rem 1rem", borderRadius: "0.5rem", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>SUFFIX-4 (4th-9th Prize Class)</div>
                    <div className="mono" style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--accent-cyan)", marginTop: "0.25rem" }}>
                      &quot;{analysis.featureProfile.suffix4}&quot;
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION D: RETROSPECTIVE HISTORICAL COMPARISON */}
              <div
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-medium)",
                  borderRadius: "0.75rem",
                  padding: "1.5rem"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span className="badge badge-emerald">SECTION D</span>
                    <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Retrospective Historical Comparison</h2>
                  </div>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    Evaluated against {analysis.historicalComparison.sampleSizeResults.toLocaleString()} results across {analysis.historicalComparison.sampleSizeDraws} draws ({analysis.historicalComparison.corpusVersion})
                  </span>
                </div>

                {/* Exact Ticket Match Card */}
                <div
                  style={{
                    background: analysis.historicalComparison.exactTicketMatch.observedInCorpus
                      ? "rgba(16, 185, 129, 0.1)"
                      : "rgba(30, 41, 59, 0.5)",
                    border: analysis.historicalComparison.exactTicketMatch.observedInCorpus
                      ? "1px solid rgba(16, 185, 129, 0.4)"
                      : "1px solid var(--border-subtle)",
                    borderRadius: "0.5rem",
                    padding: "1.25rem",
                    marginBottom: "1.5rem"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                    <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>
                      EXACT TICKET HISTORICAL OCCURRENCE:
                    </div>
                    <span className={`badge ${analysis.historicalComparison.exactTicketMatch.observedInCorpus ? "badge-emerald" : "badge-blue"}`}>
                      {analysis.historicalComparison.exactTicketMatch.observedInCorpus ? "OBSERVED IN CORPUS" : "NOT OBSERVED IN CORPUS"}
                    </span>
                  </div>

                  {analysis.historicalComparison.exactTicketMatch.observedInCorpus ? (
                    <div>
                      <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: "0 0 0.75rem 0" }}>
                        Ticket <strong>{analysis.input.series} {analysis.input.ticketNumber}</strong> was drawn as a major prize winner in {analysis.historicalComparison.exactTicketMatch.matchCount} historical draw(s):
                      </p>
                      <div className="table-container">
                        <table className="research-table" style={{ fontSize: "0.8rem" }}>
                          <thead>
                            <tr>
                              <th>Draw ID</th>
                              <th>Lottery</th>
                              <th>Draw Date</th>
                              <th>Prize Tier</th>
                              <th>Published District</th>
                              <th>Source Document SHA-256</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analysis.historicalComparison.exactTicketMatch.matches.map((m, idx) => (
                              <tr key={idx}>
                                <td className="mono">
                                  <Link href={`/draws/${m.drawId}`} style={{ color: "var(--accent-cyan)" }}>
                                    {m.drawId}
                                  </Link>
                                </td>
                                <td>{m.lotteryName}</td>
                                <td>{m.drawDate}</td>
                                <td><span className="badge badge-emerald">{m.prizeTierName}</span></td>
                                <td>{m.publishedDistrict || "Location not published in summary"}</td>
                                <td className="mono" style={{ fontSize: "0.75rem" }}>
                                  <Link href={`/sources/${m.sourceDocumentSha256}`} style={{ color: "var(--text-secondary)" }}>
                                    {m.sourceDocumentSha256.slice(0, 12)}...
                                  </Link>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: 0 }}>
                      The ticket <strong>{analysis.input.series} {analysis.input.ticketNumber}</strong> has not appeared as an exact-ticket major winner in the verified {analysis.historicalComparison.sampleSizeDraws} historical draws. In a combinatoric space of 1,000,000 numbers per series, lack of prior occurrence is the expected mathematical norm.
                    </p>
                  )}
                </div>

                {/* Marginal Comparison Cards */}
                <div className="grid-3" style={{ gap: "1rem", marginBottom: "1.5rem" }}>
                  <div style={{ background: "rgba(15, 23, 42, 0.4)", padding: "1rem", borderRadius: "0.5rem", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                      Last Digit Empirical Frequency
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginTop: "0.25rem" }}>
                      <span className="mono" style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--accent-cyan)" }}>
                        {(analysis.historicalComparison.lastDigitComparison.empiricalFrequency * 100).toFixed(2)}%
                      </span>
                      <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        vs 10.0% expected
                      </span>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.35rem" }}>
                      Count: {analysis.historicalComparison.lastDigitComparison.observedCount.toLocaleString()} / {analysis.historicalComparison.sampleSizeResults.toLocaleString()}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                      95% CI: [{(analysis.historicalComparison.lastDigitComparison.wilsonConfidenceInterval95[0] * 100).toFixed(2)}%, {(analysis.historicalComparison.lastDigitComparison.wilsonConfidenceInterval95[1] * 100).toFixed(2)}%]
                    </div>
                  </div>

                  <div style={{ background: "rgba(15, 23, 42, 0.4)", padding: "1rem", borderRadius: "0.5rem", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                      First Digit Empirical Frequency
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginTop: "0.25rem" }}>
                      <span className="mono" style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--accent-cyan)" }}>
                        {(analysis.historicalComparison.firstDigitComparison.empiricalFrequency * 100).toFixed(2)}%
                      </span>
                      <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        vs 10.0% expected
                      </span>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.35rem" }}>
                      Full Tickets: {analysis.historicalComparison.firstDigitComparison.observedCount.toLocaleString()} / {analysis.historicalComparison.fullTicketSampleSize.toLocaleString()}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                      95% CI: [{(analysis.historicalComparison.firstDigitComparison.wilsonConfidenceInterval95[0] * 100).toFixed(2)}%, {(analysis.historicalComparison.firstDigitComparison.wilsonConfidenceInterval95[1] * 100).toFixed(2)}%]
                    </div>
                  </div>

                  <div style={{ background: "rgba(15, 23, 42, 0.4)", padding: "1rem", borderRadius: "0.5rem", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                      Digit Sum Empirical Percentile
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginTop: "0.25rem" }}>
                      <span className="mono" style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--accent-purple)" }}>
                        {analysis.historicalComparison.digitSumComparison.empiricalPercentile}th
                      </span>
                      <span className="badge badge-emerald" style={{ fontSize: "0.7rem" }}>
                        {analysis.historicalComparison.digitSumComparison.rarityClassification}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.35rem" }}>
                      Input Sum: {analysis.historicalComparison.digitSumComparison.inputSum} (Mean: 27.0)
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                      Theoretical Range: 0 to 54
                    </div>
                  </div>
                </div>

                {/* Suffix Occurrences Table */}
                <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                  TERMINAL SUFFIX HISTORICAL OCCURRENCE RATES:
                </div>
                <div className="table-container">
                  <table className="research-table" style={{ fontSize: "0.85rem" }}>
                    <thead>
                      <tr>
                        <th>Suffix Type</th>
                        <th>Digits</th>
                        <th>Corpus Count</th>
                        <th>Sample Size</th>
                        <th>Empirical Rate</th>
                        <th>Theoretical Independent Expectation</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>Suffix-2</strong> (Terminal Pair)</td>
                        <td className="mono">&quot;{analysis.historicalComparison.suffixComparisons.suffix2.suffix}&quot;</td>
                        <td>{analysis.historicalComparison.suffixComparisons.suffix2.observedCount}</td>
                        <td>{analysis.historicalComparison.suffixComparisons.suffix2.sampleSize.toLocaleString()}</td>
                        <td className="mono">{(analysis.historicalComparison.suffixComparisons.suffix2.empiricalFrequency * 100).toFixed(3)}%</td>
                        <td className="mono" style={{ color: "var(--text-muted)" }}>1.000% (1/100)</td>
                      </tr>
                      <tr>
                        <td><strong>Suffix-3</strong> (Terminal Triplet)</td>
                        <td className="mono">&quot;{analysis.historicalComparison.suffixComparisons.suffix3.suffix}&quot;</td>
                        <td>{analysis.historicalComparison.suffixComparisons.suffix3.observedCount}</td>
                        <td>{analysis.historicalComparison.suffixComparisons.suffix3.sampleSize.toLocaleString()}</td>
                        <td className="mono">{(analysis.historicalComparison.suffixComparisons.suffix3.empiricalFrequency * 100).toFixed(4)}%</td>
                        <td className="mono" style={{ color: "var(--text-muted)" }}>0.100% (1/1,000)</td>
                      </tr>
                      <tr>
                        <td><strong>Suffix-4</strong> (4th-9th Prize Suffix Class)</td>
                        <td className="mono">&quot;{analysis.historicalComparison.suffixComparisons.suffix4.suffix}&quot;</td>
                        <td>{analysis.historicalComparison.suffixComparisons.suffix4.observedCount}</td>
                        <td>{analysis.historicalComparison.suffixComparisons.suffix4.sampleSize.toLocaleString()}</td>
                        <td className="mono">{(analysis.historicalComparison.suffixComparisons.suffix4.empiricalFrequency * 100).toFixed(5)}%</td>
                        <td className="mono" style={{ color: "var(--text-muted)" }}>0.010% (1/10,000)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECTION E: STATISTICAL BASELINES CONTEXT */}
              <div
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-medium)",
                  borderRadius: "0.75rem",
                  padding: "1.5rem"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
                  <span className="badge badge-purple">SECTION E</span>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Statistical Baseline Context (EXP-001/002/003)</h2>
                </div>

                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: "0 0 1rem 0" }}>
                  How this ticket&apos;s feature profile relates to the formal baselines established in Milestone 9B:
                </p>

                <div className="grid-3" style={{ gap: "1rem", marginBottom: "1.5rem" }}>
                  {analysis.statisticalContext?.baselineExperiments.map((exp) => (
                    <div
                      key={exp.experimentId}
                      style={{
                        background: "rgba(15, 23, 42, 0.4)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "0.5rem",
                        padding: "1rem"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                        <span className="mono" style={{ fontSize: "0.75rem", color: "var(--accent-cyan)" }}>
                          {exp.experimentId}
                        </span>
                        <span className="badge badge-blue" style={{ fontSize: "0.7rem" }}>
                          {exp.modelType}
                        </span>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                        {exp.name}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
                        {exp.relationToInput}
                      </div>
                      <div className="badge badge-emerald" style={{ fontSize: "0.75rem" }}>
                        {exp.benchmarkMetric}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Uniformity Metrics */}
                <div style={{ background: "rgba(255, 255, 255, 0.02)", padding: "1rem", borderRadius: "0.5rem", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Chi-Square Uniformity Test:</span>{" "}
                      <span className="mono" style={{ color: "var(--accent-emerald)" }}>
                        chi2 = {analysis.statisticalContext?.distributionContext.lastDigitChiSquareUniformity.chiSquare} (df = 9)
                      </span>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                        {analysis.statisticalContext?.distributionContext.lastDigitChiSquareUniformity.pText}
                      </div>
                    </div>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Empirical Entropy:</span>{" "}
                      <span className="mono" style={{ color: "var(--accent-cyan)" }}>
                        {analysis.statisticalContext?.distributionContext.entropy.lastDigitEntropy} bits
                      </span>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "0.5rem" }}>
                        (Max = 3.3219)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION F: GEOGRAPHIC CONTEXT */}
              <div
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-medium)",
                  borderRadius: "0.75rem",
                  padding: "1.5rem"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
                  <span className="badge badge-blue">SECTION F</span>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Geographic Context & Provenance</h2>
                </div>

                {/* Mandatory Exposure Limitation Box */}
                <div
                  style={{
                    background: "rgba(245, 158, 11, 0.1)",
                    border: "1px solid rgba(245, 158, 11, 0.3)",
                    borderRadius: "0.5rem",
                    padding: "1rem",
                    marginBottom: "1.25rem"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                    <span className="badge badge-yellow">MANDATORY METHODOLOGICAL NOTICE</span>
                    <strong style={{ color: "#fbbf24", fontSize: "0.85rem" }}>TICKET EXPOSURE DENOMINATOR UNAVAILABLE</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                    {analysis.geographicContext?.criticalExposureLimitation}
                  </p>
                </div>

                {analysis.geographicContext?.observations && analysis.geographicContext.observations.length > 0 ? (
                  <div>
                    <div style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                      Published Winner Geographic Observations ({analysis.geographicContext.observations.length}):
                    </div>
                    <div className="table-container">
                      <table className="research-table" style={{ fontSize: "0.85rem" }}>
                        <thead>
                          <tr>
                            <th>Draw</th>
                            <th>Tier</th>
                            <th>Published Location</th>
                            <th>Normalized District</th>
                            <th>Source PDF SHA-256</th>
                            <th>Page</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analysis.geographicContext.observations.map((g, idx) => (
                            <tr key={idx}>
                              <td className="mono">{g.drawNumber}</td>
                              <td><span className="badge badge-emerald">{g.prizeTier}</span></td>
                              <td>{g.rawLocation}</td>
                              <td style={{ fontWeight: 600 }}>{g.normalizedDistrict}</td>
                              <td className="mono" style={{ fontSize: "0.75rem" }}>
                                <Link href={`/sources/${g.sourceDocumentSha256}`} style={{ color: "var(--accent-cyan)" }}>
                                  {g.sourceDocumentSha256.slice(0, 12)}...
                                </Link>
                              </td>
                              <td>Page {g.sourcePage}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: 0 }}>
                    {analysis.geographicContext?.userProvidedContext
                      ? `User provided context: "${analysis.geographicContext.userProvidedContext}". No official published winner observation in research corpus.`
                      : "No official geographic winner observation exists for this ticket in the 380 published major-prize observations in the corpus. Geographic observations are only recorded for verified 1st, 2nd, and 3rd prize published results."}
                  </p>
                )}
              </div>
            </>
          )}

          {/* SECTION G: RESEARCH INTERPRETATION */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-medium)",
              borderRadius: "0.75rem",
              padding: "1.5rem"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
              <span className="badge badge-emerald">SECTION G</span>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Scientific Research Interpretation</h2>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
              {analysis.researchInterpretation.classifications.map((cls, idx) => (
                <span key={idx} className="badge badge-blue" style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem" }}>
                  {cls}
                </span>
              ))}
            </div>

            <p style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-primary)", margin: "0 0 0.5rem 0" }}>
              {analysis.researchInterpretation.summary}
            </p>
            <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>
              {analysis.researchInterpretation.explanation}
            </p>
          </div>

          {/* SECTION H: METHODOLOGICAL LIMITATIONS */}
          <div
            style={{
              background: "rgba(15, 23, 42, 0.6)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "0.75rem",
              padding: "1.5rem"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
              <span className="badge badge-yellow">SECTION H</span>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Methodological Boundaries & Limitations</h2>
            </div>

            <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div>
                <strong>Non-Predictive Principle:</strong> {analysis.limitations.nonPredictiveDisclaimer}
              </div>
              <div>
                <strong>Denominator Limitation:</strong> {analysis.limitations.exposureLimitation}
              </div>
              <div>
                <strong>Statistical Caveats:</strong>
                <ul style={{ margin: "0.25rem 0 0 1.25rem", padding: 0 }}>
                  {analysis.limitations.statisticalCaveats.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div style={{ marginTop: "1.25rem", borderTop: "1px solid var(--border-subtle)", paddingTop: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
              <span>Corpus: {analysis.provenance.corpusVersion} | Feature: {analysis.provenance.featureVersion} | Dataset: {analysis.provenance.datasetVersion}</span>
              <span className="mono">Audit SHA: {analysis.provenance.auditSha256.slice(0, 16)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
