"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface SchemeItem {
  id: string;
  lotteryCode: string;
  lotteryName: string;
  authorityLevel: "OFFICIAL_SCHEME" | "OBSERVED_SCHEME_ARCHETYPE";
  effectiveDateStart: string;
  effectiveDateEnd?: string;
  tiersCount: number;
  totalPrizeFund?: number;
  description?: string;
}

export default function SchemesRegistryPage() {
  const [schemes, setSchemes] = useState<SchemeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAuthority, setFilterAuthority] = useState("");

  useEffect(() => {
    async function loadSchemes() {
      try {
        const res = await fetch("/api/v1/schemes");
        if (res.ok) {
          const json = await res.json();
          setSchemes(json.data || []);
        }
      } catch (err) {
        console.error("Error loading schemes:", err);
      } finally {
        setLoading(false);
      }
    }

    loadSchemes();
  }, []);

  const filtered = filterAuthority
    ? schemes.filter((s) => s.authorityLevel === filterAuthority)
    : schemes;

  return (
    <div className="container" style={{ padding: "2rem 1.5rem" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>
            Prize Schemes & Rule Registry
          </h1>
          <span className="badge badge-emerald">{schemes.length} Schemes</span>
          <span className="badge badge-blue">Authority Categorized</span>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", margin: 0 }}>
          Deterministic prize structures regulating lottery draws. Distinctly classifies gazetted official rules from observed historical archetypes.
        </p>
      </div>

      {/* Authority Level Filter */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          alignItems: "center",
          marginBottom: "1.5rem",
          background: "var(--bg-surface)",
          padding: "1rem 1.25rem",
          borderRadius: "0.5rem",
          border: "1px solid var(--border-subtle)"
        }}
      >
        <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Filter by Authority:</span>
        <button
          type="button"
          className={!filterAuthority ? "btn btn-primary" : "btn btn-outline"}
          onClick={() => setFilterAuthority("")}
          style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem" }}
        >
          All ({schemes.length})
        </button>
        <button
          type="button"
          className={filterAuthority === "OFFICIAL_SCHEME" ? "btn btn-primary" : "btn btn-outline"}
          onClick={() => setFilterAuthority("OFFICIAL_SCHEME")}
          style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem" }}
        >
          Official Schemes ({schemes.filter(s => s.authorityLevel === "OFFICIAL_SCHEME").length})
        </button>
        <button
          type="button"
          className={filterAuthority === "OBSERVED_SCHEME_ARCHETYPE" ? "btn btn-primary" : "btn btn-outline"}
          onClick={() => setFilterAuthority("OBSERVED_SCHEME_ARCHETYPE")}
          style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem" }}
        >
          Observed Archetypes ({schemes.filter(s => s.authorityLevel === "OBSERVED_SCHEME_ARCHETYPE").length})
        </button>
      </div>

      {/* Schemes Grid */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "4rem" }}>Loading prize schemes...</div>
      ) : (
        <div className="grid-2" style={{ gap: "1.5rem" }}>
          {filtered.map((scheme) => {
            const isArchetype = scheme.authorityLevel === "OBSERVED_SCHEME_ARCHETYPE";
            return (
              <div
                key={scheme.id}
                style={{
                  background: "var(--bg-surface)",
                  border: isArchetype ? "1px solid rgba(245, 158, 11, 0.4)" : "1px solid var(--border-subtle)",
                  borderRadius: "0.75rem",
                  padding: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "1rem"
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                    <span className="mono" style={{ fontSize: "0.85rem", color: "var(--accent-cyan)", fontWeight: 600 }}>
                      {scheme.id}
                    </span>
                    <span className={isArchetype ? "badge badge-amber" : "badge badge-emerald"}>
                      {scheme.authorityLevel}
                    </span>
                  </div>

                  <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 0.5rem 0" }}>
                    {scheme.lotteryName} ({scheme.lotteryCode})
                  </h3>

                  <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>Prize Tiers: </span>
                      <strong>{scheme.tiersCount} tiers</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>Effective Window: </span>
                      <span className="mono">{scheme.effectiveDateStart}</span> to <span className="mono">{scheme.effectiveDateEnd || "Active"}</span>
                    </div>
                    {scheme.totalPrizeFund && (
                      <div>
                        <span style={{ color: "var(--text-muted)" }}>Estimated Fund: </span>
                        <strong>₹{scheme.totalPrizeFund.toLocaleString("en-IN")}</strong>
                      </div>
                    )}
                  </div>

                  {isArchetype && (
                    <div style={{ marginTop: "0.75rem", padding: "0.5rem 0.75rem", background: "rgba(245, 158, 11, 0.1)", borderRadius: "0.375rem", border: "1px solid rgba(245, 158, 11, 0.2)", fontSize: "0.78rem", color: "#fbbf24" }}>
                      * Bumper/Seasonal observed archetype inferred from gazetted results; official gazette rule text pending formal registration.
                    </div>
                  )}
                </div>

                <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Link href={`/schemes/${scheme.id}`} className="btn btn-outline" style={{ fontSize: "0.8rem", width: "100%", textAlign: "center" }}>
                    Inspect Prize Tier Distribution &rarr;
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
