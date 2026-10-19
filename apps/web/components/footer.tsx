"use client";

import Link from "next/link";
import { BrandLogo } from "./brand-logo";
import { useI18n } from "../lib/i18n";

export function Footer() {
  const { t } = useI18n();

  return (
    <footer className="site-footer" role="contentinfo">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand-col">
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <BrandLogo size={34} />
              <div>
                <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                  {t("brand.title", "Kerala Lottery Intelligence")}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--accent-emerald)", fontWeight: 600 }}>
                  {t("footer.subtitle", "Scientific Archival & Provenance Platform")}
                </div>
              </div>
            </div>
            <p className="footer-disclaimer">
              <strong>{t("footer.disclaimerStrong", "Independent research platform. Not an official Kerala Government website.")}</strong>{" "}
              {t(
                "footer.disclaimerBody",
                "This platform is an independent scientific and archival study of historical Kerala State Lotteries draw bulletins, cryptographic SHA-256 document provenance, formal scheme rules, and statistical uniformity. It is not affiliated with, operated by, or endorsed by the Government of Kerala or the Directorate of State Lotteries."
              )}
            </p>
          </div>

          <nav className="footer-links-col" aria-label="Footer research navigation">
            <div className="footer-heading">{t("footer.surfaces", "Research Surfaces")}</div>
            <ul className="footer-link-list">
              <li><Link href="/draws">{t("nav.draws", "Draw Explorer")}</Link></li>
              <li><Link href="/results">{t("nav.results", "Results Explorer")}</Link></li>
              <li><Link href="/schemes">{t("nav.schemes", "Scheme Rules")}</Link></li>
              <li><Link href="/statistics">{t("nav.statistics", "Statistical Suite")}</Link></li>
              <li><Link href="/experiments">{t("nav.experiments", "Controlled Experiments")}</Link></li>
              <li><Link href="/findings">{t("nav.findings", "Empirical Findings")}</Link></li>
            </ul>
          </nav>

          <nav className="footer-links-col" aria-label="Footer interactive labs and operations">
            <div className="footer-heading">{t("footer.labs", "Labs & Operations")}</div>
            <ul className="footer-link-list">
              <li><Link href="/research-sandbox">{t("nav.sandbox", "Research Sandbox")}</Link></li>
              <li><Link href="/candidate-lab">{t("nav.candidateLab", "Candidate Lab")}</Link></li>
              <li><Link href="/geography">{t("nav.geography", "Geography Notes")}</Link></li>
              <li><Link href="/lotteries">{t("nav.lotteries", "Lottery Registry")}</Link></li>
              <li><Link href="/ingestion">{t("nav.ingestion", "Ingestion Console")}</Link></li>
            </ul>
          </nav>
        </div>

        <div className="footer-bottom">
          <div className="footer-provenance-note">
            <span>
              {t(
                "footer.corpusSummary",
                "Active Corpus: 119 Draws (45,600 results up to 18/10/2026, SM-77th) • Frozen V1.0 Baseline: 114 Draws (43,712 results up to 13/10/2026, SS-541st) • Original PROD Baseline: 100 Draws (38,416 results up to 28/09/2026)"
              )}
            </span>
          </div>
          <div className="footer-attribution">
            Developed by{" "}
            <a
              href="mailto:maha.ai.developer@gmail.com"
              className="footer-mailto-link"
            >
              maha.ai.developer@gmail.com
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
