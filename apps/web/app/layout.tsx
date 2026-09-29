import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "../components/app-providers";
import { HeaderAuthStatus } from "../components/header-auth-status";
import { Navigation } from "../components/navigation";

export const metadata: Metadata = {
  title: "Kerala State Lottery Intelligence — Production Research Platform",
  description:
    "Production read-only research surface for lottery verification, rule provenance, statistical hypothesis testing, and temporal experiment backtesting.",
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
        <AppProviders>
          <header
            style={{
              borderBottom: "1px solid var(--border-subtle)",
              background: "rgba(15, 23, 42, 0.9)",
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
                flexDirection: "column",
                gap: "0.5rem",
                padding: "0.75rem 1.5rem"
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div
                    style={{
                      width: "2.25rem",
                      height: "2.25rem",
                      borderRadius: "0.5rem",
                      background: "linear-gradient(135deg, #0ea5e9, #3b82f6)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: "bold",
                      color: "#fff",
                      fontSize: "0.95rem"
                    }}
                  >
                    KL
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.95rem", letterSpacing: "-0.01em", color: "var(--text-primary)" }}>
                      Kerala Lottery Intelligence
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                      Verified Research & Provenance Surface (9A)
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <span className="badge badge-emerald" style={{ fontSize: "0.72rem" }}>
                    PROD READ-ONLY
                  </span>
                  <HeaderAuthStatus />
                  <span className="mono" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    v{process.env.NEXT_PUBLIC_APP_VERSION || "0.9.0"}
                  </span>
                </div>
              </div>

              {/* Navigation Menu */}
              <div
                style={{
                  borderTop: "1px solid rgba(255, 255, 255, 0.05)",
                  paddingTop: "0.35rem"
                }}
              >
                <Navigation />
              </div>
            </div>
          </header>
          <main>{children}</main>
        </AppProviders>
      </body>
    </html>
  );
}
