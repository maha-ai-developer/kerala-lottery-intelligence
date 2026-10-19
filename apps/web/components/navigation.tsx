"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "./brand-logo";
import { HeaderAuthStatus } from "./header-auth-status";
import { ThemeToggle } from "./theme-toggle";
import { PwaInstallControl } from "./pwa-install";
import { LOCALE_OPTIONS, useI18n, type Locale } from "../lib/i18n";

const NAV_LINKS = [
  { href: "/", key: "nav.overview", fallback: "Overview" },
  { href: "/draws", key: "nav.draws", fallback: "Draws" },
  { href: "/lotteries", key: "nav.lotteries", fallback: "Lotteries" },
  { href: "/results", key: "nav.results", fallback: "Results" },
  { href: "/schemes", key: "nav.schemes", fallback: "Schemes" },
  { href: "/statistics", key: "nav.statistics", fallback: "Statistics" },
  { href: "/experiments", key: "nav.experiments", fallback: "Experiments" },
  { href: "/findings", key: "nav.findings", fallback: "Findings" },
  { href: "/geography", key: "nav.geography", fallback: "Geography" },
  { href: "/research-sandbox", key: "nav.sandbox", fallback: "Research Sandbox" },
  { href: "/candidate-lab", key: "nav.candidateLab", fallback: "Candidate Lab" },
  { href: "/ingestion", key: "nav.ingestion", fallback: "Ingestion" }
];

export function Navigation() {
  const pathname = usePathname() || "/";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { locale, setLocale, t } = useI18n();

  // Close mobile drawer when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Close mobile drawer on Escape key
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  const isRouteActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="nav-header">
      <a href="#main-content" className="skip-link">
        {t("nav.skip", "Skip to main content")}
      </a>

      <div className="container">
        <div className="header-top-row">
          <Link href="/" className="brand-identity-link" aria-label="Kerala Lottery Intelligence Home">
            <BrandLogo size={38} />
            <div className="brand-text-group">
              <span className="brand-title">{t("brand.title", "Kerala Lottery Intelligence")}</span>
              <span className="brand-subtitle">
                {t("brand.subtitle", "Official Results Archive & Empirical Evidence Platform")}
              </span>
            </div>
          </Link>

          <div className="header-actions">
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem"
              }}
            >
              <label
                htmlFor="site-language-selector"
                style={{
                  fontSize: "0.72rem",
                  color: "var(--text-muted)",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                {t("nav.language", "Language")}:
              </label>
              <select
                id="site-language-selector"
                data-testid="language-selector"
                aria-label="Select site language"
                value={locale}
                onChange={(e) => setLocale(e.target.value as Locale)}
                style={{
                  background: "var(--bg-surface)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "6px",
                  padding: "0.3rem 0.55rem",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                {LOCALE_OPTIONS.map((opt) => (
                  <option key={opt.code} value={opt.code}>
                    {opt.nativeLabel}
                  </option>
                ))}
              </select>
            </div>

            <PwaInstallControl />
            <ThemeToggle />
            <div className="header-auth-desktop">
              <HeaderAuthStatus />
            </div>
            <button
              type="button"
              className="mobile-menu-toggle"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-controls="primary-navigation-drawer"
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            >
              {mobileMenuOpen ? (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              )}
              <span className="mobile-menu-toggle-label">
                {mobileMenuOpen ? t("nav.close", "Close") : t("nav.menu", "Menu")}
              </span>
            </button>
          </div>
        </div>

        {/* Desktop Primary Navigation Bar */}
        <nav className="desktop-nav" aria-label="Primary research navigation">
          {NAV_LINKS.map((link) => {
            const active = isRouteActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`nav-link${active ? " active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {t(link.key, link.fallback)}
              </Link>
            );
          })}
        </nav>

        {/* Collapsible Mobile / Tablet Navigation Drawer */}
        <nav
          id="primary-navigation-drawer"
          className={`mobile-nav-drawer${mobileMenuOpen ? " open" : ""}`}
          aria-label="Mobile navigation menu"
          hidden={!mobileMenuOpen}
        >
          <div className="mobile-nav-grid">
            {NAV_LINKS.map((link) => {
              const active = isRouteActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`mobile-nav-link${active ? " active" : ""}`}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span>{t(link.key, link.fallback)}</span>
                  {active && (
                    <span className="mobile-nav-active-dot" aria-hidden="true" />
                  )}
                </Link>
              );
            })}
          </div>

          <div className="mobile-nav-footer">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Session Status:
              </span>
              <HeaderAuthStatus />
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
              {t("footer.disclaimerStrong", "Independent research platform. Not an official Kerala Government website.")}
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
}
