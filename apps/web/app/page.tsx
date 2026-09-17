export default function DashboardPage() {
  const layers = [
    {
      name: "1. SOURCE",
      desc: "Cloud Storage, SHA-256 verification, duplicate detection, and original gazette PDFs.",
      color: "var(--accent-cyan)",
      items: ["Kerala_Lottaries_rule.pdf", "lotteryAgentUserManual.pdf", "5 Results PDFs"]
    },
    {
      name: "2. DATA",
      desc: "Canonical string representations (leading zeros strictly intact, e.g. '0276') and draw links.",
      color: "var(--accent-blue)",
      items: ["Draw Records", "Winning Numbers", "Prize Structures", "Series"]
    },
    {
      name: "3. KNOWLEDGE",
      desc: "Entities, rules, temporal amendment tracking, and legal document citations.",
      color: "#8b5cf6",
      items: ["Acts & Rules", "Gazette Amendments", "Knowledge Graph"]
    },
    {
      name: "4. STATISTICS",
      desc: "Deterministic frequency, Shannon entropy, Chi-square tests, and digit distribution.",
      color: "var(--accent-emerald)",
      items: ["Frequency Engine", "Digit Distributions", "Runs Randomness Test"]
    },
    {
      name: "5. EXPERIMENT",
      desc: "Walk-forward backtesting with strict zero-temporal-leakage cutoff and random baselines.",
      color: "var(--accent-amber)",
      items: ["Backtest Engine", "Temporal Cutoffs", "Mulberry32 Determinism"]
    },
    {
      name: "6. AI GATEWAY",
      desc: "Server-side proxy, multi-provider routing (Gemini, Anthropic, OpenAI), and RAG citations.",
      color: "var(--accent-rose)",
      items: ["Model Registry", "Controlled Tools", "Quota Enforcement"]
    }
  ];

  return (
    <div className="container" style={{ padding: "3rem 1.5rem" }}>
      {/* Hero section */}
      <div style={{ marginBottom: "3rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
          <span className="badge badge-blue">Phase 0: Engineering Foundation</span>
          <span className="badge badge-emerald">GCP: kerala-lottery-intelligence</span>
        </div>
        <h1
          style={{
            fontSize: "2.5rem",
            fontWeight: 800,
            letterSpacing: "-0.025em",
            marginBottom: "1rem",
            background: "linear-gradient(135deg, #f8fafc 40%, #94a3b8)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent"
          }}
        >
          Kerala State Lottery Intelligence & Experiment Platform
        </h1>
        <p
          style={{
            fontSize: "1.125rem",
            color: "var(--text-secondary)",
            maxWidth: "800px",
            lineHeight: 1.6
          }}
        >
          A scientific research platform engineered for verifiable source provenance, deterministic
          statistical hypothesis testing, temporal leak prevention, and reproducible backtesting.
        </p>
      </div>

      {/* Core Principle Banner */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderLeft: "4px solid var(--accent-cyan)",
          padding: "1.5rem",
          borderRadius: "0.5rem",
          marginBottom: "3rem"
        }}
      >
        <h3
          style={{
            fontSize: "0.875rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--accent-cyan)",
            marginBottom: "0.75rem"
          }}
        >
          Core Foundational Principle
        </h3>
        <p
          className="mono"
          style={{
            fontSize: "0.95rem",
            color: "var(--text-primary)",
            lineHeight: 1.7
          }}
        >
          Every number has a source. Every result belongs to a draw. Every draw belongs to a lottery.
          Every rule belongs to a legal document and time period. Every experiment belongs to a dataset
          version. Every AI answer must be grounded in evidence.
        </p>
      </div>

      {/* 6-Layer Architecture Grid */}
      <h2
        style={{
          fontSize: "1.5rem",
          fontWeight: 700,
          marginBottom: "1.5rem"
        }}
      >
        Platform Architectural Layers
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "1.25rem",
          marginBottom: "3rem"
        }}
      >
        {layers.map((layer) => (
          <div
            key={layer.name}
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "0.75rem",
              padding: "1.5rem",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between"
            }}
          >
            <div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: "1.1rem",
                  color: layer.color,
                  marginBottom: "0.5rem"
                }}
              >
                {layer.name}
              </div>
              <p
                style={{
                  fontSize: "0.875rem",
                  color: "var(--text-secondary)",
                  lineHeight: 1.5,
                  marginBottom: "1.25rem"
                }}
              >
                {layer.desc}
              </p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
              {layer.items.map((item) => (
                <span
                  key={item}
                  className="mono"
                  style={{
                    fontSize: "0.75rem",
                    padding: "0.2rem 0.5rem",
                    borderRadius: "0.25rem",
                    background: "var(--bg-surface-elevated)",
                    color: "var(--text-muted)"
                  }}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Verified Number Preservation Invariant */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "0.75rem",
          padding: "1.75rem"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Canonical Lottery Number Rule</h3>
          <span className="badge badge-emerald">Verified Invariant</span>
        </div>
        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
          Lottery numbers are always stored and processed as canonical strings. Numbers with leading zeros
          (e.g., <code className="mono" style={{ color: "var(--accent-cyan)" }}>&quot;0276&quot;</code>) are strictly preserved and never coerced into integers.
        </p>
        <div
          className="mono"
          style={{
            background: "var(--bg-primary)",
            padding: "0.75rem 1rem",
            borderRadius: "0.375rem",
            fontSize: "0.85rem",
            color: "var(--text-secondary)",
            border: "1px solid var(--border-subtle)"
          }}
        >
          Example: <span style={{ color: "var(--accent-emerald)" }}>canonicalNumber: &quot;0276&quot;</span> | length: 4 | derivedNumericValue: 276
        </div>
      </div>
    </div>
  );
}
