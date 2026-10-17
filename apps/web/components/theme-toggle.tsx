"use client";

import { useEffect, useState } from "react";

export type ThemeMode = "dark" | "light";

export const THEME_STORAGE_KEY = "kli-theme";

function applyThemeToDocument(theme: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;

  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute("content", theme === "light" ? "#065f46" : "#064e3b");
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === "light" || stored === "dark") {
        setTheme(stored);
        applyThemeToDocument(stored);
      } else {
        const attr = document.documentElement.getAttribute("data-theme");
        if (attr === "light" || attr === "dark") {
          setTheme(attr);
          applyThemeToDocument(attr);
        } else {
          const prefersLight =
            typeof window.matchMedia === "function" &&
            window.matchMedia("(prefers-color-scheme: light)").matches;
          const resolved: ThemeMode = prefersLight ? "light" : "dark";
          setTheme(resolved);
          applyThemeToDocument(resolved);
        }
      }
    } catch {
      // Fallback if localStorage is restricted
    }

    if (typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    const handleSystemChange = (event: MediaQueryListEvent) => {
      try {
        const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
        if (stored !== "light" && stored !== "dark") {
          const next: ThemeMode = event.matches ? "light" : "dark";
          setTheme(next);
          applyThemeToDocument(next);
        }
      } catch {
        // Ignore storage read failure
      }
    };

    mediaQuery.addEventListener("change", handleSystemChange);
    return () => mediaQuery.removeEventListener("change", handleSystemChange);
  }, []);

  const toggleTheme = () => {
    const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    applyThemeToDocument(nextTheme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Ignore storage write failure
    }
  };

  const nextLabel = theme === "dark" ? "Light" : "Dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="theme-toggle-btn"
      aria-label={mounted ? `Switch to ${nextLabel.toLowerCase()} theme (current: ${theme})` : "Toggle color theme"}
      aria-pressed={mounted ? theme === "light" : undefined}
      title={mounted ? `Switch to ${nextLabel} mode` : "Switch color theme"}
    >
      {mounted && theme === "light" ? (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      )}
      <span className="theme-toggle-label">
        {mounted ? (theme === "dark" ? "Light" : "Dark") : "Theme"}
      </span>
    </button>
  );
}
