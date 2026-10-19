"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface LotteryItem {
  id: string;
  code: string;
  name: string;
  drawCount: number;
  latestDrawDate: string;
  dayOfWeek?: string;
  status: string;
}

export default function LotteriesPage() {
  const [lotteries, setLotteries] = useState<LotteryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLotteries() {
      try {
        const res = await fetch("/api/v1/lotteries");
        if (res.ok) {
          const json = await res.json();
          setLotteries(json.data || []);
        }
      } catch (err) {
        console.error("Failed to load lotteries:", err);
      } finally {
        setLoading(false);
      }
    }

    loadLotteries();
  }, []);

  return (
    <div className="container" style={{ padding: "2rem 1.5rem" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>
            Lottery Families & Series
          </h1>
          <span className="badge badge-blue">9 Lottery Types</span>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", margin: 0 }}>
          Government of Kerala Directorate of State Lotteries active weekly and seasonal lottery series.
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "4rem" }}>Loading lottery families...</div>
      ) : (
        <div className="grid-3" style={{ gap: "1.5rem" }}>
          {lotteries.map((lottery) => (
            <div
              key={lottery.id}
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
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
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "1.1rem",
                      fontWeight: 700,
                      color: "var(--accent-cyan)",
                      background: "rgba(56, 189, 248, 0.1)",
                      padding: "0.2rem 0.6rem",
                      borderRadius: "0.375rem",
                      border: "1px solid rgba(56, 189, 248, 0.25)"
                    }}
                  >
                    {lottery.code}
                  </span>
                  <span className={lottery.status === "ACTIVE" ? "badge badge-emerald" : "badge badge-amber"}>
                    {lottery.status}
                  </span>
                </div>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 0.5rem 0", color: "var(--text-primary)" }}>
                  {lottery.name}
                </h3>
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>Verified Draws: </span>
                    <strong style={{ color: "var(--text-primary)" }}>{lottery.drawCount}</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>Latest Draw Date: </span>
                    <span className="mono">{lottery.latestDrawDate || "N/A"}</span>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "1rem" }}>
                <Link
                  href={`/draws?lottery=${encodeURIComponent(lottery.code)}`}
                  className="btn btn-outline"
                  style={{ width: "100%", textAlign: "center", fontSize: "0.85rem" }}
                >
                  View {lottery.name} Draws &rarr;
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
