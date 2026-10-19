import { NextRequest, NextResponse } from "next/server";
import { GoogleAuth } from "google-auth-library";
import { maskCanonicalTokens, restoreCanonicalTokens } from "../../../../lib/i18n-shared";

export const dynamic = "force-dynamic";

const ALLOWED_TARGETS = new Set(["en", "ml", "ta"]);
const MAX_INPUT_CHARS = 2000;
const REQUEST_TIMEOUT_MS = 4500;
const MAX_CACHE_ENTRIES = 500;

const translationCache = new Map<string, { translatedText: string; provider: string }>();

function setCachedTranslation(key: string, value: { translatedText: string; provider: string }) {
  if (translationCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = translationCache.keys().next().value;
    if (firstKey) translationCache.delete(firstKey);
  }
  translationCache.set(key, value);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body.text !== "string" || typeof body.targetLanguage !== "string") {
      return NextResponse.json(
        {
          error: "INVALID_REQUEST",
          message: "Both 'text' (string) and 'targetLanguage' ('en' | 'ml' | 'ta') are required."
        },
        { status: 400 }
      );
    }

    const text = body.text.trim();
    const targetLanguage = body.targetLanguage.trim().toLowerCase();

    if (!ALLOWED_TARGETS.has(targetLanguage)) {
      return NextResponse.json(
        {
          error: "UNSUPPORTED_LANGUAGE",
          message: `Unsupported targetLanguage '${targetLanguage}'. Supported languages: en, ml, ta.`
        },
        { status: 400 }
      );
    }

    if (text.length === 0) {
      return NextResponse.json({
        translatedText: "",
        targetLanguage,
        provider: "noop",
        preservedTokenCount: 0
      });
    }

    if (text.length > MAX_INPUT_CHARS) {
      return NextResponse.json(
        {
          error: "PAYLOAD_TOO_LARGE",
          message: `Input text exceeds maximum allowed length of ${MAX_INPUT_CHARS} characters.`
        },
        { status: 400 }
      );
    }

    if (targetLanguage === "en") {
      return NextResponse.json({
        translatedText: text,
        targetLanguage: "en",
        provider: "identity",
        preservedTokenCount: 0
      });
    }

    const cacheKey = `${targetLanguage}:${text}`;
    const cached = translationCache.get(cacheKey);
    if (cached) {
      return NextResponse.json({
        translatedText: cached.translatedText,
        targetLanguage,
        provider: "cache",
        upstreamProvider: cached.provider
      });
    }

    const { maskedText, tokens } = maskCanonicalTokens(text);

    // Server-side Google Cloud Translation v2 Basic API via Application Default Credentials
    let translatedMasked: string | null = null;
    let provider = "fallback_english";

    try {
      const auth = new GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/cloud-platform"]
      });
      const client = await auth.getClient();
      const projectId =
        process.env.GOOGLE_CLOUD_PROJECT ||
        process.env.GCLOUD_PROJECT ||
        (await auth.getProjectId().catch(() => null)) ||
        "kerala-lottery-intelligence";
      const tokenRes = await client.getAccessToken();
      const accessToken = typeof tokenRes === "string" ? tokenRes : tokenRes?.token;

      if (accessToken) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
          const resp = await fetch(
            "https://translation.googleapis.com/language/translate/v2",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
                "x-goog-user-project": projectId
              },
              body: JSON.stringify({
                q: maskedText,
                source: "en",
                target: targetLanguage,
                format: "text"
              }),
              signal: controller.signal
            }
          );

          if (resp.ok) {
            const payload: any = await resp.json();
            const candidate = payload?.data?.translations?.[0]?.translatedText;
            if (typeof candidate === "string" && candidate.trim().length > 0) {
              translatedMasked = candidate;
              provider = "google_cloud_translation";
            }
          }
        } finally {
          clearTimeout(timer);
        }
      }
    } catch {
      // Graceful fallback to English without leaking credentials or stack traces
      translatedMasked = null;
    }

    const finalTranslated = translatedMasked
      ? restoreCanonicalTokens(translatedMasked, tokens)
      : text;

    if (provider === "google_cloud_translation") {
      setCachedTranslation(cacheKey, { translatedText: finalTranslated, provider });
    }

    return NextResponse.json({
      translatedText: finalTranslated,
      targetLanguage,
      provider,
      preservedTokenCount: tokens.length,
      zeroCredentialsExposed: true
    });
  } catch {
    return NextResponse.json(
      {
        error: "TRANSLATION_ERROR",
        message: "Unable to process translation request."
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    service: "kerala-lottery-intelligence-translation-service",
    supportedLanguages: [
      { code: "en", label: "English", default: true },
      { code: "ml", label: "മലയാളം (Malayalam)", default: false },
      { code: "ta", label: "தமிழ் (Tamil)", default: false }
    ],
    maxInputChars: MAX_INPUT_CHARS,
    timeoutMs: REQUEST_TIMEOUT_MS,
    authMode: "ADC_SERVER_SIDE_ONLY",
    zeroCredentialsExposed: true
  });
}
