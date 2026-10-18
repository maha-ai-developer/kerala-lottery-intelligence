import Link from "next/link";
import { BrandLogo } from "./brand-logo";

export function Footer() {
  return (
    <footer className="site-footer" role="contentinfo">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand-col">
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <BrandLogo size={34} />
              <div>
                <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                  Kerala Lottery Intelligence
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--accent-emerald)", fontWeight: 600 }}>
                  Scientific Archival &amp; Provenance Platform
                </div>
              </div>
            </div>
            <p className="footer-disclaimer">
              <strong>Independent research platform. Not an official Kerala Government website.</strong>{" "}
              This platform is an independent scientific and archival study of historical Kerala State Lotteries draw bulletins, cryptographic SHA-256 document provenance, formal scheme rules, and statistical uniformity. It is not affiliated with, operated by, or endorsed by the Government of Kerala or the Directorate of State Lotteries.
            </p>
          </div>

          <nav className="footer-links-col" aria-label="Footer research navigation">
            <div className="footer-heading">Research Surfaces</div>
            <ul className="footer-link-list">
              <li><Link href="/draws">Draw Explorer</Link></li>
              <li><Link href="/results">Results Explorer</Link></li>
              <li><Link href="/schemes">Scheme Rules</Link></li>
              <li><Link href="/statistics">Statistical Suite</Link></li>
              <li><Link href="/experiments">Controlled Experiments</Link></li>
              <li><Link href="/findings">Empirical Findings</Link></li>
            </ul>
          </nav>

          <nav className="footer-links-col" aria-label="Footer interactive labs and operations">
            <div className="footer-heading">Labs &amp; Operations</div>
            <ul className="footer-link-list">
              <li><Link href="/research-sandbox">Research Sandbox</Link></li>
              <li><Link href="/candidate-lab">Candidate Lab</Link></li>
              <li><Link href="/geography">Geography Notes</Link></li>
              <li><Link href="/lotteries">Lottery Registry</Link></li>
              <li><Link href="/ingestion">Ingestion Console</Link></li>
            </ul>
          </nav>
        </div>

        <div className="footer-bottom">
          <div className="footer-provenance-note">
            <span>Active DEV Corpus: 118 Draws (45,218 results up to 17/10/2026) &bull; V1.0 Frozen Baseline: 114 Draws (43,712 results up to 13/10/2026) &bull; SHA-256 Provenance</span>
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
