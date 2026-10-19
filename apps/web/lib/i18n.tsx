"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  type Locale,
  LOCALE_OPTIONS,
  TRANSLATION_CATALOGUE,
  maskCanonicalTokens,
  restoreCanonicalTokens
} from "./i18n-shared";

export {
  type Locale,
  LOCALE_OPTIONS,
  TRANSLATION_CATALOGUE,
  maskCanonicalTokens,
  restoreCanonicalTokens
};

interface I18nContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: string, fallback?: string) => string;
  translateDynamic: (text: string) => Promise<string>;
}

const I18nContext = createContext<I18nContextValue>({
  locale: "en",
  setLocale: () => {},
  t: (key, fallback) => fallback || TRANSLATION_CATALOGUE.en[key] || key,
  translateDynamic: async (text) => text
});

const clientDynamicCache = new Map<string, string>();

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("kli-locale") as Locale | null;
      if (saved === "en" || saved === "ml" || saved === "ta") {
        setLocaleState(saved);
        document.documentElement.lang = saved;
      } else {
        document.documentElement.lang = "en";
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem("kli-locale", next);
      document.documentElement.lang = next;
    } catch {
      // Ignore storage errors
    }
  }, []);

  const t = useCallback(
    (key: string, fallback?: string): string => {
      return (
        TRANSLATION_CATALOGUE[locale]?.[key] ??
        TRANSLATION_CATALOGUE.en[key] ??
        fallback ??
        key
      );
    },
    [locale]
  );

  const translateDynamic = useCallback(
    async (text: string): Promise<string> => {
      if (!text || locale === "en") return text;
      const cacheKey = `${locale}:${text}`;
      const cached = clientDynamicCache.get(cacheKey);
      if (cached) return cached;

      try {
        const res = await fetch("/api/v1/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, targetLanguage: locale })
        });
        if (!res.ok) return text;
        const data = await res.json();
        const translated = typeof data?.translatedText === "string" ? data.translatedText : text;
        clientDynamicCache.set(cacheKey, translated);
        return translated;
      } catch {
        return text;
      }
    },
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, translateDynamic }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
