"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PwaInstallControl() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [installNotice, setInstallNotice] = useState<string | null>(null);
  const [promptDismissed, setPromptDismissed] = useState(false);

  useEffect(() => {
    // 1. Register Service Worker safely
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => {
          // Non-fatal in environments where Service Worker registration is restricted
        });
    }

    // 2. Detect standalone mode (installed PWA)
    const checkStandalone = () => {
      if (typeof window === "undefined") return false;
      const mediaStandalone =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(display-mode: standalone)").matches;
      const iosStandalone = Boolean(
        (window.navigator as Navigator & { standalone?: boolean }).standalone
      );
      return mediaStandalone || iosStandalone;
    };

    const currentlyStandalone = checkStandalone();
    setIsStandalone(currentlyStandalone);

    const mediaQuery =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(display-mode: standalone)")
        : null;
    const onDisplayModeChange = (event: MediaQueryListEvent) => {
      setIsStandalone(event.matches);
      if (event.matches) {
        setDeferredPrompt(null);
      }
    };
    mediaQuery?.addEventListener("change", onDisplayModeChange);

    // 3. Capture beforeinstallprompt & appinstalled only when active in browser mode
    const handleBeforeInstallPrompt = (event: Event) => {
      if (checkStandalone()) {
        return;
      }
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setPromptDismissed(false);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setPromptDismissed(false);
      setIsStandalone(true);
      setShowInstructions(false);
      setInstallNotice("App installed successfully.");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      mediaQuery?.removeEventListener("change", onDisplayModeChange);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (!showInstructions) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowInstructions(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showInstructions]);

  const handleInstallClick = async () => {
    setInstallNotice(null);
    if (deferredPrompt) {
      const activePrompt = deferredPrompt;
      try {
        await activePrompt.prompt();
        const choice = await activePrompt.userChoice;
        // Always clear deferredPrompt after userChoice resolves (a prompt event can only be used once)
        setDeferredPrompt(null);
        if (choice.outcome === "accepted") {
          setPromptDismissed(false);
          setInstallNotice("App installation accepted.");
        } else {
          setPromptDismissed(true);
          setInstallNotice(
            "Native install prompt was dismissed. You can still install manually from your browser menu below."
          );
          setShowInstructions(true);
        }
      } catch {
        setDeferredPrompt(null);
        setShowInstructions(true);
      }
      return;
    }
    setShowInstructions(true);
  };

  if (isStandalone) {
    return (
      <span
        className="pwa-installed-pill"
        title="Running as an installed standalone Progressive Web App"
        aria-label="Application installed in standalone mode"
      >
        <span className="pwa-installed-dot" aria-hidden="true" />
        <span>App Installed</span>
      </span>
    );
  }

  const hasNativePrompt = Boolean(deferredPrompt);

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        className="pwa-install-btn"
        aria-label={
          hasNativePrompt
            ? "Install Kerala Lottery Intelligence app now"
            : "How to install Kerala Lottery Intelligence app"
        }
        aria-haspopup={hasNativePrompt ? undefined : "dialog"}
        aria-expanded={hasNativePrompt ? undefined : showInstructions}
        title={
          hasNativePrompt
            ? "Prompt native browser installation for Kerala Lottery Intelligence"
            : "View step-by-step instructions to install on Android, iOS, or Desktop"
        }
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span>{hasNativePrompt ? "Install App" : promptDismissed ? "How to Install" : "Install App"}</span>
      </button>

      {showInstructions && (
        <div
          className="pwa-modal-backdrop"
          role="presentation"
          onClick={() => setShowInstructions(false)}
        >
          <div
            className="pwa-modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-install-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", marginBottom: "1rem" }}>
              <div>
                <span className="badge badge-valid" style={{ marginBottom: "0.4rem" }}>
                  Progressive Web App (PWA)
                </span>
                <h2 id="pwa-install-dialog-title" style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                  Install Kerala Lottery Intelligence
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowInstructions(false)}
                className="btn btn-secondary"
                style={{ padding: "0.4rem 0.75rem", minHeight: "44px" }}
                aria-label="Close installation instructions"
              >
                Close
              </button>
            </div>

            <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.55, marginBottom: "1rem" }}>
              Install this research platform on your home screen or desktop for full-screen standalone access. Live draw records and cloud integrity checks always verify over the network.
            </p>

            {installNotice && (
              <div className="badge badge-valid" style={{ marginBottom: "1rem", display: "block" }}>
                {installNotice}
              </div>
            )}

            <div style={{ display: "grid", gap: "0.75rem", marginBottom: "1.25rem" }}>
              <div className="pwa-instruction-step">
                <strong style={{ color: "var(--text-primary)", display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>
                  Android (Chrome / Edge / Brave)
                </strong>
                <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  Tap the browser menu (<strong>⋮</strong>) in the top-right corner and select <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                </span>
              </div>

              <div className="pwa-instruction-step">
                <strong style={{ color: "var(--text-primary)", display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>
                  Desktop (Chrome / Edge)
                </strong>
                <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  Click the <strong>Install Kerala Lottery Intelligence</strong> icon in the address bar, or open the browser menu (<strong>⋮</strong>) → <strong>Save and share</strong> → <strong>Install page as app</strong>.
                </span>
              </div>

              <div className="pwa-instruction-step">
                <strong style={{ color: "var(--text-primary)", display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>
                  iOS / iPadOS (Safari)
                </strong>
                <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  Tap the <strong>Share</strong> button in the toolbar and choose <strong>Add to Home Screen</strong>.
                </span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button
                type="button"
                className="btn"
                onClick={() => setShowInstructions(false)}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
