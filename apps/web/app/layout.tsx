import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kerala State Lottery Intelligence & Experiment Platform",
  description:
    "Scientific research platform for lottery verification, rule provenance, statistical hypothesis testing, and temporal experiment backtesting.",
  icons: {
    icon: "/favicon.ico"
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header
          style={{
            borderBottom: "1px solid var(--border-subtle)",
            background: "rgba(17, 24, 39, 0.8)",
            backdropFilter: "blur(12px)",
            position: "sticky",
            top: 0,
            zIndex: 50
          }}
        >
          <div
            className="container"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              height: "4rem"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div
                style={{
                  width: "2rem",
                  height: "2rem",
                  borderRadius: "0.5rem",
                  background: "linear-gradient(135deg, #06b6d4, #3b82f6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "bold",
                  color: "#fff"
                }}
              >
                KL
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", letterSpacing: "-0.01em" }}>
                  Kerala State Lottery Intelligence
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Research & Provenance Platform
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
              <span className="badge badge-emerald">
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    backgroundColor: "var(--accent-emerald)"
                  }}
                />
                Live System
              </span>
              <span className="mono" style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                v{process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0"}
              </span>
            </div>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
