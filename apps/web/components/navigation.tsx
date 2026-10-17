"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "./brand-logo";
import { HeaderAuthStatus } from "./header-auth-status";
import { ThemeToggle } from "./theme-toggle";
import { PwaInstallControl } from "./pwa-install";

const NAV_LINKS = [
  { href: "/", label: "Overview" },
  { href: "/draws", label: "Draws" },
  { href: "/lotteries", label: "Lotteries" },
  { href: "/results", label: "Results" },
  { href: "/schemes", label: "Schemes" },
  { href: "/statistics", label: "Statistics" },
  { href: "/experiments", label: "Experiments" },
  { href: "/findings", label: "Findings" },
  { href: "/geography", label: "Geography" },
  { href: "/research-sandbox", label: "Research Sandbox" },
  { href: "/candidate-lab", label: "Candidate Lab" },
  { href: "/ingestion", label: "Ingestion" }
];

export function Navigation() {
  const pathname = usePathname() || "/";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
        Skip to main content
      </a>

      <div className="container">
        <div className="header-top-row">
          <Link href="/" className="brand-identity-link" aria-label="Kerala Lottery Intelligence Home">
            <BrandLogo size={38} />
            <div className="brand-text-group">
              <span className="brand-title">Kerala Lottery Intelligence</span>
              <span className="brand-subtitle">
                Independent Research Platform &bull; V1 Corpus
              </span>
            </div>
          </Link>

          <div className="header-actions">
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
                {mobileMenuOpen ? "Close" : "Menu"}
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
                {link.label}
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
                  <span>{link.label}</span>
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
              Independent research platform. Not an official Kerala Government website.
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
}
