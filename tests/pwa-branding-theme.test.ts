import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const WEB_ROOT = path.resolve(__dirname, "../apps/web");
const PUBLIC_DIR = path.join(WEB_ROOT, "public");
const APP_DIR = path.join(WEB_ROOT, "app");
const COMPONENTS_DIR = path.join(WEB_ROOT, "components");

function readPngDimensions(filePath: string): { width: number; height: number } {
  const buf = fs.readFileSync(filePath);
  // Verify PNG signature: 89 50 4E 47 0D 0A 1A 0A
  expect(buf[0]).toBe(0x89);
  expect(buf[1]).toBe(0x50);
  expect(buf[2]).toBe(0x4e);
  expect(buf[3]).toBe(0x47);
  expect(buf[4]).toBe(0x0d);
  expect(buf[5]).toBe(0x0a);
  expect(buf[6]).toBe(0x1a);
  expect(buf[7]).toBe(0x0a);

  // IHDR chunk width (bytes 16..19) & height (bytes 20..23)
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

describe("Kerala Lottery Intelligence — Responsive Web, PWA, Branding & Theme Invariants", () => {
  describe("1. Web App Manifest & Icons", () => {
    it("provides valid, identical manifest.webmanifest and manifest.json with required PWA metadata", () => {
      const webmanifestPath = path.join(PUBLIC_DIR, "manifest.webmanifest");
      const jsonManifestPath = path.join(PUBLIC_DIR, "manifest.json");

      expect(fs.existsSync(webmanifestPath)).toBe(true);
      expect(fs.existsSync(jsonManifestPath)).toBe(true);

      const webmanifest = JSON.parse(fs.readFileSync(webmanifestPath, "utf-8"));
      const jsonManifest = JSON.parse(fs.readFileSync(jsonManifestPath, "utf-8"));

      expect(webmanifest).toEqual(jsonManifest);
      expect(webmanifest.name).toBe("Kerala Lottery Intelligence");
      expect(webmanifest.short_name).toBe("KL Intelligence");
      expect(webmanifest.display).toBe("standalone");
      expect(webmanifest.start_url).toBe("/");
      expect(webmanifest.scope).toBe("/");
      expect(webmanifest.theme_color).toBe("#064e3b");
      expect(webmanifest.background_color).toBe("#0b1120");
      expect(Array.isArray(webmanifest.icons)).toBe(true);
      expect(webmanifest.icons.length).toBeGreaterThanOrEqual(4);
    });

    it("verifies all referenced PNG, SVG, and ICO icon assets exist with exact binary dimensions", () => {
      const icon192 = path.join(PUBLIC_DIR, "icons/icon-192x192.png");
      const icon512 = path.join(PUBLIC_DIR, "icons/icon-512x512.png");
      const iconMaskable512 = path.join(PUBLIC_DIR, "icons/icon-maskable-512x512.png");
      const appleTouchIcon = path.join(PUBLIC_DIR, "icons/apple-touch-icon.png");
      const faviconIco = path.join(PUBLIC_DIR, "favicon.ico");
      const publicSvg = path.join(PUBLIC_DIR, "icon.svg");
      const appSvg = path.join(APP_DIR, "icon.svg");

      expect(fs.existsSync(icon192)).toBe(true);
      expect(fs.existsSync(icon512)).toBe(true);
      expect(fs.existsSync(iconMaskable512)).toBe(true);
      expect(fs.existsSync(appleTouchIcon)).toBe(true);
      expect(fs.existsSync(faviconIco)).toBe(true);
      expect(fs.existsSync(publicSvg)).toBe(true);
      expect(fs.existsSync(appSvg)).toBe(true);

      expect(readPngDimensions(icon192)).toEqual({ width: 192, height: 192 });
      expect(readPngDimensions(icon512)).toEqual({ width: 512, height: 512 });
      expect(readPngDimensions(iconMaskable512)).toEqual({ width: 512, height: 512 });
      expect(readPngDimensions(appleTouchIcon)).toEqual({ width: 180, height: 180 });

      const icoBuf = fs.readFileSync(faviconIco);
      // ICO header: 00 00 01 00
      expect(icoBuf[0]).toBe(0x00);
      expect(icoBuf[1]).toBe(0x00);
      expect(icoBuf[2]).toBe(0x01);
      expect(icoBuf[3]).toBe(0x00);

      const svgContent = fs.readFileSync(publicSvg, "utf-8");
      expect(svgContent).toContain("<svg");
      expect(svgContent).toContain('viewBox="0 0 128 128"');
    });
  });

  describe("2. Service Worker & Offline Fallback Safety", () => {
    it("enforces strict network-only exclusions for /api/* and authenticated requests in sw.js", () => {
      const swPath = path.join(PUBLIC_DIR, "sw.js");
      expect(fs.existsSync(swPath)).toBe(true);

      const swContent = fs.readFileSync(swPath, "utf-8");
      expect(swContent).toContain('CACHE_VERSION = "kli-shell-v1.0.0"');
      expect(swContent).toContain('OFFLINE_URL = "/offline"');
      // Never cache non-GET requests
      expect(swContent).toContain('request.method !== "GET"');
      // Never cache /api/* routes
      expect(swContent).toContain('url.pathname.startsWith("/api/")');
      // Never cache requests with Authorization headers
      expect(swContent).toContain('request.headers.has("authorization")');
      // Never cache Next.js RSC flight payloads as HTML navigations
      expect(swContent).toContain('request.headers.get("RSC") === "1"');
      expect(swContent).toContain('url.searchParams.has("_rsc")');
      // Provides offline fallback for navigations
      expect(swContent).toContain('request.mode === "navigate"');
      expect(swContent).toContain("cache.match(OFFLINE_URL)");
    });

    it("provides an explicit /offline route explaining that live draw/cloud records are never fabricated", () => {
      const offlinePagePath = path.join(APP_DIR, "offline/page.tsx");
      expect(fs.existsSync(offlinePagePath)).toBe(true);

      const offlineContent = fs.readFileSync(offlinePagePath, "utf-8");
      expect(offlineContent).toContain("Offline Shell Active");
      expect(offlineContent).toContain("Live Research Corpus Requires Network Connectivity");
      expect(offlineContent).toContain("never substitutes stale cached draw results");
      expect(offlineContent).toContain("Retry Live Connection");
    });

    it("configures Next.js headers for manifest.webmanifest and sw.js", () => {
      const nextConfigPath = path.join(WEB_ROOT, "next.config.ts");
      const nextConfigContent = fs.readFileSync(nextConfigPath, "utf-8");
      expect(nextConfigContent).toContain("/manifest.webmanifest");
      expect(nextConfigContent).toContain("application/manifest+json; charset=utf-8");
      expect(nextConfigContent).toContain("/sw.js");
      expect(nextConfigContent).toContain("Service-Worker-Allowed");
    });
  });

  describe("3. Original Branding & Developer Attribution Footer", () => {
    it("renders the site-wide footer with exact developer attribution, mailto link, and non-official disclaimer", () => {
      const footerPath = path.join(COMPONENTS_DIR, "footer.tsx");
      expect(fs.existsSync(footerPath)).toBe(true);

      const footerContent = fs.readFileSync(footerPath, "utf-8");
      expect(footerContent).toContain("Developed by");
      expect(footerContent).toContain('href="mailto:maha.ai.developer@gmail.com"');
      expect(footerContent).toContain("maha.ai.developer@gmail.com");
      expect(footerContent).toContain("Independent research platform. Not an official Kerala Government website.");
    });

    it("provides an original Kerala-inspired scientific SVG brand logo without official government emblems", () => {
      const logoPath = path.join(COMPONENTS_DIR, "brand-logo.tsx");
      expect(fs.existsSync(logoPath)).toBe(true);

      const logoContent = fs.readFileSync(logoPath, "utf-8");
      expect(logoContent).toContain("<svg");
      expect(logoContent).toContain('viewBox="0 0 128 128"');
      expect(logoContent).toContain("Original Kerala-inspired scientific mark");
    });
  });

  describe("4. Global Light / Dark Theme Toggle & Persistence", () => {
    it("persists user theme choice under 'kli-theme', respects prefers-color-scheme, and prevents FOUC in layout.tsx", () => {
      const layoutPath = path.join(APP_DIR, "layout.tsx");
      const togglePath = path.join(COMPONENTS_DIR, "theme-toggle.tsx");
      const cssPath = path.join(APP_DIR, "globals.css");

      expect(fs.existsSync(layoutPath)).toBe(true);
      expect(fs.existsSync(togglePath)).toBe(true);
      expect(fs.existsSync(cssPath)).toBe(true);

      const layoutContent = fs.readFileSync(layoutPath, "utf-8");
      expect(layoutContent).toContain("window.localStorage.getItem('kli-theme')");
      expect(layoutContent).toContain("prefers-color-scheme: light");
      expect(layoutContent).toContain("document.documentElement.setAttribute('data-theme', theme)");
      expect(layoutContent).toContain('manifest: "/manifest.webmanifest"');
      expect(layoutContent).toContain("<Footer />");

      const toggleContent = fs.readFileSync(togglePath, "utf-8");
      expect(toggleContent).toContain('THEME_STORAGE_KEY = "kli-theme"');
      expect(toggleContent).toContain('root.setAttribute("data-theme", theme)');
      expect(toggleContent).toContain("window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme)");
      expect(toggleContent).toContain("aria-label=");
      expect(toggleContent).toContain("aria-pressed=");

      const cssContent = fs.readFileSync(cssPath, "utf-8");
      expect(cssContent).toContain(':root,\n[data-theme="dark"]');
      expect(cssContent).toContain('[data-theme="light"]');
      expect(cssContent).toContain("--bg-primary:");
      expect(cssContent).toContain("--text-primary:");
      expect(cssContent).toContain("--accent-emerald:");
      expect(cssContent).toContain("--accent-gold:");
    });
  });

  describe("5. Responsive Navigation & PWA Install Control", () => {
    it("implements accessible desktop and mobile navigation with Escape handling, route auto-close, theme toggle, and PWA install control", () => {
      const navPath = path.join(COMPONENTS_DIR, "navigation.tsx");
      const pwaInstallPath = path.join(COMPONENTS_DIR, "pwa-install.tsx");

      expect(fs.existsSync(navPath)).toBe(true);
      expect(fs.existsSync(pwaInstallPath)).toBe(true);

      const navContent = fs.readFileSync(navPath, "utf-8");
      expect(navContent).toContain("aria-expanded={mobileMenuOpen}");
      expect(navContent).toContain('aria-controls="primary-navigation-drawer"');
      expect(navContent).toContain('event.key === "Escape"');
      expect(navContent).toContain("<ThemeToggle />");
      expect(navContent).toContain("<PwaInstallControl />");
      expect(navContent).toContain("<BrandLogo");

      const pwaContent = fs.readFileSync(pwaInstallPath, "utf-8");
      expect(pwaContent).toContain('navigator.serviceWorker');
      expect(pwaContent).toContain('.register("/sw.js"');
      expect(pwaContent).toContain("beforeinstallprompt");
      expect(pwaContent).toContain("(display-mode: standalone)");
      expect(pwaContent).toContain('role="dialog"');
      expect(pwaContent).toContain("Android (Chrome / Edge / Brave)");
      expect(pwaContent).toContain("iOS / iPadOS (Safari)");
    });
  });

  describe("6. Responsive Breakpoints, Touch Targets & Theme Surface Compliance", () => {
    it("enforces >=44px touch targets and responsive breakpoints in globals.css", () => {
      const cssPath = path.join(APP_DIR, "globals.css");
      const cssContent = fs.readFileSync(cssPath, "utf-8");

      expect(cssContent).toContain("min-height: 44px");
      expect(cssContent).toContain("overflow-x: hidden");
      expect(cssContent).toContain("@media (max-width: 1024px)");
      expect(cssContent).toContain("@media (max-width: 768px)");
      expect(cssContent).toContain("@media (max-width: 480px)");
    });

    it("ensures primary research and operations routes use semantic theme variables rather than hardcoded dark hex surfaces", () => {
      const routeFiles = [
        "page.tsx",
        "geography/page.tsx",
        "candidate-lab/page.tsx",
        "research-sandbox/page.tsx",
        "findings/page.tsx",
        "ingestion/page.tsx",
        "offline/page.tsx"
      ];

      for (const relPath of routeFiles) {
        const fullPath = path.join(APP_DIR, relPath);
        expect(fs.existsSync(fullPath)).toBe(true);
        const content = fs.readFileSync(fullPath, "utf-8");
        expect(content).not.toMatch(/background:\s*["']#(?:0f172a|111827|1e293b)["']/i);
        expect(content).not.toMatch(/color:\s*["']#(?:f8fafc|e2e8f0)["']/i);
      }
    });
  });
});
