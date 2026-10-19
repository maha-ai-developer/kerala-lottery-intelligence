"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface TierDetail {
  tierName: string;
  rank: number;
  prizeAmount: number;
  type: "FULL_TICKET" | "SUFFIX";
  digits: number;
  numberOfPrizes: number;
}

interface SchemeDetail {
  id: string;
  lotteryCode: string;
  lotteryName: string;
  authorityLevel: "OFFICIAL_SCHEME" | "OBSERVED_SCHEME_ARCHETYPE";
  effectiveDateStart: string;
  effectiveDateEnd?: string;
  tiersCount: number;
  totalPrizeFund?: number;
  tiers: TierDetail[];
}

export default function SchemeDetailPage() {
  const params = useParams();
  const schemeId = params?.id as string;

  const [scheme, setScheme] = useState<SchemeDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!schemeId) return;

    async function loadScheme() {
      try {
        const res = await fetch(`/api/v1/schemes/${encodeURIComponent(schemeId)}`);
        if (res.ok) {
          const json = await res.json();
          setScheme(json.data);
        }
      } catch (err) {
        console.error("Error loading scheme:", err);
      } finally {
        setLoading(false);
      }
    }

    loadScheme();
  }, [schemeId]);

  if (loading) {
    return (
      <div className="container" style={{ padding: "4rem 1.5rem", textAlign: "center" }}>
        Loading scheme details...
      </div>
    );
  }

  if (!scheme) {
    return (
      <div className="container" style={{ padding: "4rem 1.5rem", textAlign: "center" }}>
        <h2>Scheme Not Found</h2>
        <p style={{ color: "var(--text-secondary)" }}>No scheme found with ID &quot;{schemeId}&quot;.</p>
        <Link href="/schemes" className="btn btn-primary" style={{ marginTop: "1rem" }}>
          &larr; Back to Schemes
        </Link>
      </div>
    );
  }

  const isArchetype = scheme.authorityLevel === "OBSERVED_SCHEME_ARCHETYPE";

  return (
    <div className="container" style={{ padding: "2rem 1.5rem" }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: "1rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
        <Link href="/schemes" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>Prize Schemes</Link>
        {" / "}
        <span style={{ color: "var(--text-primary)" }}>{scheme.id}</span>
      </div>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "2rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <span className="badge badge-blue">{scheme.lotteryCode}</span>
            <span className={isArchetype ? "badge badge-amber" : "badge badge-emerald"}>
              {scheme.authorityLevel}
            </span>
          </div>
          <h1 style={{ fontSize: "1.875rem", fontWeight: 700, margin: 0 }}>
            {scheme.lotteryName} Prize Scheme
          </h1>
          <div style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
            ID: <span className="mono">{scheme.id}</span> | Effective: <span className="mono">{scheme.effectiveDateStart}</span> to <span className="mono">{scheme.effectiveDateEnd || "Present"}</span>
          </div>
        </div>

        <Link href={`/draws?lottery=${encodeURIComponent(scheme.lotteryCode)}`} className="btn btn-outline" style={{ fontSize: "0.85rem" }}>
          View Associated Draws &rarr;
        </Link>
      </div>

      {isArchetype && (
        <div style={{ marginBottom: "2rem", padding: "1rem 1.25rem", background: "rgba(245, 158, 11, 0.1)", borderRadius: "0.5rem", border: "1px solid rgba(245, 158, 11, 0.3)", color: "#fbbf24", fontSize: "0.875rem" }}>
          <strong>NOTE: OBSERVED SCHEME ARCHETYPE</strong>
          <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.825rem", color: "#fde68a" }}>
            This prize structure was verified and inferred from gazetted lottery results. It serves as an observed archetype pending inclusion in the official Kerala State Gazette rule corpus.
          </p>
        </div>
      )}

      {/* Tiers Breakdown */}
      <div style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "1rem" }}>
          Prize Tiers & Payout Hierarchy ({scheme.tiers?.length || 0} tiers)
        </h2>

        <div className="table-container">
          <table className="research-table">
            <thead>
              <tr>
                <th>Tier</th>
                <th>Prize Amount (₹)</th>
                <th>Winning Format</th>
                <th>Match Length</th>
                <th>Est. Count of Winners</th>
              </tr>
            </thead>
            <tbody>
              {(!scheme.tiers || scheme.tiers.length === 0) ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "2rem" }}>
                    No tier data recorded.
                  </td>
                </tr>
              ) : (
                scheme.tiers.map((t, idx) => (
                  <tr key={idx}>
                    <td>
                      <span className="badge badge-blue">{t.tierName}</span>
                    </td>
                    <td style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                      ₹{t.prizeAmount.toLocaleString("en-IN")}
                    </td>
                    <td>
                      <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                        {t.type === "FULL_TICKET" ? "Full Ticket (Series + Number)" : "Suffix (Last N Digits)"}
                      </span>
                    </td>
                    <td>
                      <span className="mono">{t.digits} digits</span>
                    </td>
                    <td>
                      <span className="mono" style={{ color: "var(--accent-emerald)" }}>
                        {t.numberOfPrizes || "—"}
                      </span>
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
