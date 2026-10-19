"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

export type Locale = "en" | "ml" | "ta";

export const LOCALE_OPTIONS: Array<{ code: Locale; label: string; nativeLabel: string }> = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "ml", label: "Malayalam", nativeLabel: "മലയാളം" },
  { code: "ta", label: "Tamil", nativeLabel: "தமிழ்" }
];

export const TRANSLATION_CATALOGUE: Record<Locale, Record<string, string>> = {
  en: {
    "brand.title": "Kerala Lottery Intelligence",
    "brand.subtitle": "Official Results Archive & Empirical Evidence Platform",
    "nav.overview": "Overview",
    "nav.draws": "Draws",
    "nav.lotteries": "Lotteries",
    "nav.results": "Results",
    "nav.schemes": "Schemes",
    "nav.statistics": "Statistics",
    "nav.experiments": "Experiments",
    "nav.findings": "Findings",
    "nav.geography": "Geography",
    "nav.sandbox": "Research Sandbox",
    "nav.candidateLab": "Candidate Lab",
    "nav.ingestion": "Ingestion",
    "nav.skip": "Skip to main content",
    "nav.menu": "Menu",
    "nav.close": "Close",
    "nav.language": "Language",
    "footer.subtitle": "Scientific Archival & Provenance Platform",
    "footer.disclaimerStrong": "Independent research platform. Not an official Kerala Government website.",
    "footer.disclaimerBody":
      "This platform is an independent scientific and archival study of historical Kerala State Lotteries draw bulletins, cryptographic SHA-256 document provenance, formal scheme rules, and statistical uniformity. It is not affiliated with, operated by, or endorsed by the Government of Kerala or the Directorate of State Lotteries.",
    "footer.surfaces": "Research Surfaces",
    "footer.labs": "Labs & Operations",
    "footer.corpusSummary":
      "Active Corpus: 119 Draws (45,600 results up to 18/10/2026, SM-77th) • Frozen V1.0 Baseline: 114 Draws (43,712 results up to 13/10/2026, SS-541st) • Original PROD Baseline: 100 Draws (38,416 results up to 28/09/2026)",
    "home.heroBadge": "Verified Official Gazette Archive • 3-Step Guided Evidence Journey",
    "home.heroTitle": "Kerala State Lottery Official Results & Evidence Guide",
    "home.heroSubtitle":
      "Verify official published Kerala State Lottery draw results, validate single or multiple candidate tickets against official scheme rules, and review transparent historical evidence.",
    "home.status.latestVerified": "Latest Verified Result",
    "home.status.todayScheduled": "Today's Scheduled Lottery",
    "home.status.lastChecked": "Official Sources Checked",
    "home.status.activeCorpus": "Active Research Corpus",
    "home.status.refreshState": "Research Refresh Status",
    "home.status.refreshComplete": "Synchronized & Complete",
    "home.status.refreshPending": "Refresh Pending",
    "home.step1.title": "Step 1 — Check Official Results",
    "home.step1.subtitle": "View the latest verified draw or upload an official result PDF if not yet published online.",
    "home.step2.title": "Step 2 — Enter Single or Multiple Candidates",
    "home.step2.subtitle": "Validate format, series, and exact 6-digit number (preserving leading zeroes such as 0259 or 000481).",
    "home.step3.title": "Step 3 — Evidence Dashboard & Personal Decision Guide",
    "home.step3.subtitle": "Review historical matches, digit frequencies, and your transparent personal decision checklist.",
    "home.howCalculated": "How was this calculated?",
    "home.advancedDetails": "Advanced Technical & Provenance Details",
    "decision.title": "Personal Decision Guide",
    "decision.meets": "Meets the selected validity criteria",
    "decision.review": "Review the evidence",
    "decision.doesNotMeet": "Does not meet the selected criteria",
    "decision.mandatoryNotice":
      "Historical results describe the past. They do not establish the probability of winning a future draw.",
    "common.activeCorpus": "Active Corpus",
    "common.frozenV1": "Frozen V1.0 Baseline",
    "common.historicalSnapshot": "Historical Snapshot"
  },
  ml: {
    "brand.title": "കേരള ലോട്ടറി ഇന്റലിജൻസ്",
    "brand.subtitle": "ഔദ്യോഗിക ഫല ശേഖരവും തെളിവ് അധിഷ്ഠിത വിശകലന പ്ലാറ്റ്‌ഫോമും",
    "nav.overview": "അവലോകനം",
    "nav.draws": "നറുക്കെടുപ്പുകൾ",
    "nav.lotteries": "ലോട്ടറികൾ",
    "nav.results": "ഫലങ്ങൾ",
    "nav.schemes": "സമ്മാന ഘടന",
    "nav.statistics": "സ്ഥിതിവിവരക്കണക്കുകൾ",
    "nav.experiments": "പരീക്ഷണങ്ങൾ",
    "nav.findings": "കണ്ടെത്തലുകൾ",
    "nav.geography": "ഭൂമിശാസ്ത്രം",
    "nav.sandbox": "റിസർച്ച് സാൻഡ്ബോക്സ്",
    "nav.candidateLab": "കാൻഡിഡേറ്റ് ലാബ്",
    "nav.ingestion": "ഇൻജെഷൻ",
    "nav.skip": "പ്രധാന ഉള്ളടക്കത്തിലേക്ക് പോകുക",
    "nav.menu": "മെനു",
    "nav.close": "അടയ്ക്കുക",
    "nav.language": "ഭാഷ",
    "footer.subtitle": "ശാസ്ത്രീയ ആർക്കൈവൽ & പ്രൊവനൻസ് പ്ലാറ്റ്‌ഫോം",
    "footer.disclaimerStrong": "സ്വതന്ത്ര ഗവേഷണ പ്ലാറ്റ്‌ഫോം. ഇത് കേരള സർക്കാരിന്റെ ഔദ്യോഗിക വെബ്‌സൈറ്റല്ല.",
    "footer.disclaimerBody":
      "ഈ പ്ലാറ്റ്‌ഫോം കേരള സംസ്ഥാന ലോട്ടറി നറുക്കെടുപ്പ് ഫലങ്ങളുടെയും SHA-256 രേഖാ പ്രൊവനൻസിന്റെയും സ്ഥിതിവിവരക്കണക്കുകളുടെയും സ്വതന്ത്ര ശാസ്ത്രീയ പഠനമാണ്. ഇതിന് കേരള സർക്കാരുമായോ സംസ്ഥാന ലോട്ടറി ഡയറക്ടറേറ്റുമായോ ഔദ്യോഗിക ബന്ധമില്ല.",
    "footer.surfaces": "ഗവേഷണ വിഭാഗങ്ങൾ",
    "footer.labs": "ലാബുകളും പ്രവർത്തനങ്ങളും",
    "footer.corpusSummary":
      "സജീവ കോർപ്പസ്: 119 നറുക്കെടുപ്പുകൾ (45,600 ഫലങ്ങൾ, 18/10/2026 വരെ, SM-77th) • V1.0 അടിസ്ഥാനം: 114 നറുക്കെടുപ്പുകൾ (43,712 ഫലങ്ങൾ) • പ്രാരംഭ PROD അടിസ്ഥാനം: 100 നറുക്കെടുപ്പുകൾ (38,416 ഫലങ്ങൾ)",
    "home.heroBadge": "സ്ഥിരീകരിച്ച ഔദ്യോഗിക ഗസറ്റ് ശേഖരം • 3-ഘട്ട മാർഗ്ഗനിർദ്ദേശം",
    "home.heroTitle": "കേരള സംസ്ഥാന ലോട്ടറി ഔദ്യോഗിക ഫലങ്ങളും തെളിവ് മാർഗ്ഗനിർദ്ദേശവും",
    "home.heroSubtitle":
      "ഔദ്യോഗികമായി പ്രസിദ്ധീകരിച്ച കേരള ലോട്ടറി ഫലങ്ങൾ പരിശോധിക്കുക, ഒറ്റ അല്ലെങ്കിൽ ഒന്നിലധികം ടിക്കറ്റ് നമ്പറുകൾ ഔദ്യോഗിക നിയമങ്ങൾക്കനുസരിച്ച് വിലയിരുത്തുക.",
    "home.status.latestVerified": "ഏറ്റവും പുതിയ സ്ഥിരീകരിച്ച ഫലം",
    "home.status.todayScheduled": "ഇന്നത്തെ നിശ്ചയിച്ച ലോട്ടറി",
    "home.status.lastChecked": "ഔദ്യോഗിക ഉറവിടം പരിശോധിച്ചത്",
    "home.status.activeCorpus": "സജീവ ഗവേഷണ കോർപ്പസ്",
    "home.status.refreshState": "ഗവേഷണ പുതുക്കൽ നില",
    "home.status.refreshComplete": "പൂർണ്ണമായി സമന്വയിപ്പിച്ചു",
    "home.status.refreshPending": "പുതുക്കൽ ബാക്കിയുണ്ട്",
    "home.step1.title": "ഘട്ടം 1 — ഔദ്യോഗിക ഫലങ്ങൾ പരിശോധിക്കുക",
    "home.step1.subtitle": "ഏറ്റവും പുതിയ സ്ഥിരീകരിച്ച നറുക്കെടുപ്പ് ഫലം കാണുക അല്ലെങ്കിൽ ഔദ്യോഗിക PDF അപ്‌ലോഡ് ചെയ്യുക.",
    "home.step2.title": "ഘട്ടം 2 — ഒറ്റ അല്ലെങ്കിൽ ഒന്നിലധികം ടിക്കറ്റ് നമ്പറുകൾ നൽകുക",
    "home.step2.subtitle": "സീരീസും കൃത്യമായ 6 അക്ക നമ്പറും പരിശോധിക്കുക (ആദ്യത്തെ പൂജ്യങ്ങൾ ഉൾപ്പെടെ, ഉദാ: 0259, 000481).",
    "home.step3.title": "ഘട്ടം 3 — തെളിവ് ഡാഷ്‌ബോർഡും വ്യക്തിഗത തീരുമാന സഹായിയും",
    "home.step3.subtitle": "മുൻകാല ഫലങ്ങളും അക്കങ്ങളുടെ ആവൃത്തിയും വ്യക്തിഗത പരിശോധനാ പട്ടികയും വിലയിരുത്തുക.",
    "home.howCalculated": "ഇത് എങ്ങനെയാണ് കണക്കാക്കിയത്?",
    "home.advancedDetails": "കൂടുതൽ സാങ്കേതിക വിവരങ്ങൾ (Advanced Details)",
    "decision.title": "വ്യക്തിഗത തീരുമാന സഹായി (Personal Decision Guide)",
    "decision.meets": "തിരഞ്ഞെടുത്ത സാധുതാ മാനദണ്ഡങ്ങൾ പാലിക്കുന്നു (Meets the selected validity criteria)",
    "decision.review": "തെളിവുകൾ പരിശോധിക്കുക (Review the evidence)",
    "decision.doesNotMeet": "തിരഞ്ഞെടുത്ത മാനദണ്ഡങ്ങൾ പാലിക്കുന്നില്ല (Does not meet the selected criteria)",
    "decision.mandatoryNotice":
      "മുൻകാല ഫലങ്ങൾ കഴിഞ്ഞുപോയ നറുക്കെടുപ്പുകളെ മാത്രമാണ് സൂചിപ്പിക്കുന്നത്. ഭാവിയിലെ നറുക്കെടുപ്പിൽ വിജയിക്കാനുള്ള സാധ്യതയെ അവ നിർണ്ണയിക്കുന്നില്ല. (Historical results describe the past. They do not establish the probability of winning a future draw.)",
    "common.activeCorpus": "സജീവ കോർപ്പസ്",
    "common.frozenV1": "സ്ഥിരീകരിച്ച V1.0 അടിസ്ഥാനം",
    "common.historicalSnapshot": "ചരിത്രപരമായ സ്നാപ്ഷോട്ട്"
  },
  ta: {
    "brand.title": "கேரள லாட்டரி இன்டெலிஜென்ஸ்",
    "brand.subtitle": "அதிகாரப்பூர்வ முடிவுகள் காப்பகம் & ஆதார பகுப்பாய்வு தளம்",
    "nav.overview": "மேலோட்டம்",
    "nav.draws": "குலுக்கல்கள்",
    "nav.lotteries": "லாட்டரிகள்",
    "nav.results": "முடிவுகள்",
    "nav.schemes": "பரிசுத் திட்டங்கள்",
    "nav.statistics": "புள்ளியியல்",
    "nav.experiments": "ஆய்வுகள்",
    "nav.findings": "கண்டுபிடிப்புகள்",
    "nav.geography": "புவியியல்",
    "nav.sandbox": "ஆராய்ச்சி சான்ட்பாக்ஸ்",
    "nav.candidateLab": "வேட்பாளர் ஆய்வகம்",
    "nav.ingestion": "தரவு உள்ளீடு",
    "nav.skip": "முக்கிய உள்ளடக்கத்திற்குச் செல்லவும்",
    "nav.menu": "பட்டியல்",
    "nav.close": "மூடு",
    "nav.language": "மொழி",
    "footer.subtitle": "அறிவியல் காப்பகம் மற்றும் ஆதார தளம்",
    "footer.disclaimerStrong": "சுயாதீன ஆராய்ச்சி தளம். இது கேரள அரசின் அதிகாரப்பூர்வ இணையதளம் அல்ல.",
    "footer.disclaimerBody":
      "இந்த தளம் கேரள மாநில லாட்டரி குலுக்கல் முடிவுகள், SHA-256 ஆவண ஆதாரங்கள், அதிகாரப்பூர்வ பரிசு விதிகள் மற்றும் புள்ளியியல் சமநிலை குறித்த சுயாதீன அறிவியல் ஆய்வாகும். இது கேரள அரசு அல்லது மாநில லாட்டரி இயக்குநரகத்துடன் இணைக்கப்பட்டதல்ல.",
    "footer.surfaces": "ஆராய்ச்சி பிரிவுகள்",
    "footer.labs": "ஆய்வகங்கள் & செயல்பாடுகள்",
    "footer.corpusSummary":
      "செயலில் உள்ள தொகுப்பு: 119 குலுக்கல்கள் (45,600 முடிவுகள், 18/10/2026 வரை, SM-77th) • V1.0 அடிப்படை: 114 குலுக்கல்கள் (43,712 முடிவுகள்) • ஆரம்ப PROD அடிப்படை: 100 குலுக்கல்கள் (38,416 முடிவுகள்)",
    "home.heroBadge": "சரிபார்க்கப்பட்ட அதிகாரப்பூர்வ அரசிதழ் காப்பகம் • 3-படி வழிகாட்டி",
    "home.heroTitle": "கேரள மாநில லாட்டரி அதிகாரப்பூர்வ முடிவுகள் & ஆதார வழிகாட்டி",
    "home.heroSubtitle":
      "அதிகாரப்பூர்வமாக வெளியிடப்பட்ட கேரள லாட்டரி முடிவுகளைச் சரிபார்க்கவும், ஒற்றை அல்லது பல டிக்கெட் எண்களை அதிகாரப்பூர்வ விதிகளின்படி ஆய்வு செய்யவும்.",
    "home.status.latestVerified": "சமீபத்திய சரிபார்க்கப்பட்ட முடிவு",
    "home.status.todayScheduled": "இன்றைய திட்டமிடப்பட்ட லாட்டரி",
    "home.status.lastChecked": "அதிகாரப்பூர்வ ஆதாரம் சரிபார்க்கப்பட்டது",
    "home.status.activeCorpus": "செயலில் உள்ள ஆராய்ச்சித் தொகுப்பு",
    "home.status.refreshState": "ஆராய்ச்சி புதுப்பிப்பு நிலை",
    "home.status.refreshComplete": "முழுமையாக ஒத்திசைக்கப்பட்டது",
    "home.status.refreshPending": "புதுப்பிப்பு நிலுவையில் உள்ளது",
    "home.step1.title": "படி 1 — அதிகாரப்பூர்வ முடிவுகளைச் சரிபார்க்கவும்",
    "home.step1.subtitle": "சமீபத்திய சரிபார்க்கப்பட்ட குலுக்கல் முடிவைக் காண்க அல்லது அதிகாரப்பூர்வ PDF-ஐ பதிவேற்றவும்.",
    "home.step2.title": "படி 2 — ஒற்றை அல்லது பல டிக்கெட் எண்களை உள்ளிடவும்",
    "home.step2.subtitle": "வரிசை மற்றும் சரியான 6-இலக்க எண்ணைச் சரிபார்க்கவும் (முன்னணி பூஜ்ஜியங்களைப் பாதுகாத்து, எ.கா: 0259, 000481).",
    "home.step3.title": "படி 3 — ஆதார டாஷ்போர்டு & தனிப்பட்ட முடிவு வழிகாட்டி",
    "home.step3.subtitle": "கடந்தகால பொருத்தங்கள், இலக்க அதிர்வெண்கள் மற்றும் தனிப்பட்ட சரிபார்ப்புப் பட்டியலை மதிப்பாய்வு செய்யவும்.",
    "home.howCalculated": "இது எவ்வாறு கணக்கிடப்பட்டது?",
    "home.advancedDetails": "மேம்பட்ட தொழில்நுட்ப விவரங்கள் (Advanced Details)",
    "decision.title": "தனிப்பட்ட முடிவு வழிகாட்டி (Personal Decision Guide)",
    "decision.meets": "தேர்ந்தெடுக்கப்பட்ட செல்லுபடியாகும் அளவுகோல்களை பூர்த்தி செய்கிறது (Meets the selected validity criteria)",
    "decision.review": "ஆதாரங்களை மதிப்பாய்வு செய்யவும் (Review the evidence)",
    "decision.doesNotMeet": "தேர்ந்தெடுக்கப்பட்ட அளவுகோல்களை பூர்த்தி செய்யவில்லை (Does not meet the selected criteria)",
    "decision.mandatoryNotice":
      "கடந்தகால முடிவுகள் கடந்த காலத்தை மட்டுமே விவரிக்கின்றன. எதிர்கால குலுக்கலில் வெற்றி பெறுவதற்கான நிகழ்தகவை அவை தீர்மானிப்பதில்லை. (Historical results describe the past. They do not establish the probability of winning a future draw.)",
    "common.activeCorpus": "செயலில் உள்ள தொகுப்பு",
    "common.frozenV1": "நிலையான V1.0 அடிப்படை",
    "common.historicalSnapshot": "வரலாற்று தொகுப்பு"
  }
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

/**
 * Protects canonical lottery tokens (ticket numbers with leading zeroes, draw IDs,
 * corpus/run/finding IDs, SHA-256 hashes, URLs, series+number pairs, and numeric percentages)
 * so that machine translation never alters them.
 */
export function maskCanonicalTokens(input: string): {
  maskedText: string;
  tokens: Array<{ placeholder: string; original: string }>;
} {
  const tokens: Array<{ placeholder: string; original: string }> = [];
  const canonicalPattern =
    /\b(?:https?:\/\/[^\s)]+|[a-f0-9]{32,64}|(?:corpus|mdset|fmat|run|val|find|eb|rep|sandbox|candlab|draw)_[A-Za-z0-9_-]+|[A-Z]{2,3}-\d{1,4}(?:st|nd|rd|th)?|[A-Z]{2}\s+\d{4,6}|\d{4,6}|\d+(?:\.\d+)?%)/g;

  const maskedText = input.replace(canonicalPattern, (match) => {
    const idx = tokens.length;
    const placeholder = `__KLI_TOK_${idx}__`;
    tokens.push({ placeholder, original: match });
    return placeholder;
  });

  return { maskedText, tokens };
}

export function restoreCanonicalTokens(
  translated: string,
  tokens: Array<{ placeholder: string; original: string }>
): string {
  let output = translated;
  for (const { placeholder, original } of tokens) {
    const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    output = output.replace(new RegExp(escaped, "g"), original);
  }
  return output;
}
