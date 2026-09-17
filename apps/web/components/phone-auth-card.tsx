"use client";

import { useState, useEffect, useRef } from "react";
import { RecaptchaVerifier, ConfirmationResult } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useAuth } from "../lib/auth-context";

export function PhoneAuthCard() {
  const { sendOtp, verifyOtp, error: contextError, clearError } = useAuth();

  const [step, setStep] = useState<"PHONE" | "OTP">("PHONE");
  const [countryCode, setCountryCode] = useState<string>("+91");
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [otpCode, setOtpCode] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    // Clear errors when stepping between views
    clearError();
    setErrorMessage(null);
  }, [step, clearError]);

  const mapFirebaseError = (err: unknown): string => {
    if (!(err instanceof Error)) return "An unexpected error occurred during authentication.";
    const code = (err as { code?: string }).code || "";

    switch (code) {
      case "auth/invalid-phone-number":
        return "Invalid phone number. Enter a valid mobile number with country code (e.g., +91 98765 43210).";
      case "auth/missing-phone-number":
        return "Please enter your phone number.";
      case "auth/quota-exceeded":
        return "SMS quota exceeded for this Firebase project. Please configure fictional test numbers in Firebase Console > Authentication.";
      case "auth/invalid-verification-code":
        return "Incorrect 6-digit verification code. Please check your SMS and re-enter.";
      case "auth/code-expired":
        return "Verification code has expired. Please request a new code.";
      case "auth/captcha-check-failed":
        return "reCAPTCHA verification failed. Please refresh the page and try again.";
      case "auth/too-many-requests":
        return "Too many requests. Please wait a few moments before trying again.";
      case "auth/network-request-failed":
        return "Network connection issue. Check your connection or verify that localhost is an Authorized Domain in Firebase Console.";
      default:
        return err.message || "Authentication failed. Please try again.";
    }
  };

  const getFullPhoneNumber = (): string => {
    const cleaned = phoneNumber.replace(/[\s-]/g, "");
    if (cleaned.startsWith("+")) {
      return cleaned;
    }
    return `${countryCode}${cleaned}`;
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    clearError();

    const fullNumber = getFullPhoneNumber();
    if (phoneNumber.trim().length < 6) {
      setErrorMessage("Please enter a valid phone number.");
      return;
    }

    setSubmitting(true);
    try {
      if (typeof window !== "undefined") {
        // Clear previous verifier if any
        if (recaptchaVerifierRef.current) {
          try {
            recaptchaVerifierRef.current.clear();
          } catch {
            // ignore cleanup errors
          }
        }

        // Initialize RecaptchaVerifier
        const verifier = new RecaptchaVerifier(auth, "recaptcha-container", {
          size: "invisible",
          callback: () => {
            // reCAPTCHA solved
          },
          "expired-callback": () => {
            setErrorMessage("reCAPTCHA expired. Please try submitting again.");
          }
        });
        recaptchaVerifierRef.current = verifier;

        const result = await sendOtp(fullNumber, verifier);
        setConfirmationResult(result);
        setStep("OTP");
      }
    } catch (err: unknown) {
      setErrorMessage(mapFirebaseError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    clearError();

    if (!confirmationResult) {
      setErrorMessage("Missing confirmation session. Please request a new OTP code.");
      setStep("PHONE");
      return;
    }

    if (otpCode.trim().length !== 6) {
      setErrorMessage("Please enter the complete 6-digit verification code.");
      return;
    }

    setSubmitting(true);
    try {
      await verifyOtp(confirmationResult, otpCode.trim());
      // Authentication success will automatically transition through AuthProvider observer
    } catch (err: unknown) {
      setErrorMessage(mapFirebaseError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setOtpCode("");
    setErrorMessage(null);
    await handleSendCode({ preventDefault: () => {} } as React.FormEvent);
  };

  const activeError = errorMessage || contextError;

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "0.75rem",
        padding: "2rem",
        maxWidth: "480px",
        width: "100%",
        margin: "0 auto",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.4)"
      }}
    >
      <div style={{ marginBottom: "1.5rem", textAlign: "center" }}>
        <h2 style={{ fontSize: "1.35rem", fontWeight: 700, marginBottom: "0.5rem" }}>
          {step === "PHONE" ? "Sign In with Mobile OTP" : "Verify Verification Code"}
        </h2>
        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
          {step === "PHONE"
            ? "Authenticate via official Firebase SMS phone verification."
            : `Enter the 6-digit verification code sent to ${getFullPhoneNumber()}`}
        </p>
      </div>

      {activeError && (
        <div
          role="alert"
          style={{
            background: "rgba(244, 63, 94, 0.12)",
            border: "1px solid rgba(244, 63, 94, 0.3)",
            borderRadius: "0.5rem",
            padding: "0.75rem 1rem",
            marginBottom: "1.25rem",
            fontSize: "0.85rem",
            color: "#fb7185",
            lineHeight: 1.4
          }}
        >
          {activeError}
        </div>
      )}

      {step === "PHONE" ? (
        <form onSubmit={handleSendCode} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div>
            <label
              htmlFor="phone-number"
              style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: "var(--text-secondary)",
                marginBottom: "0.5rem"
              }}
            >
              Mobile Phone Number
            </label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                aria-label="Country calling code"
                style={{
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "0.375rem",
                  color: "var(--text-primary)",
                  padding: "0.65rem 0.75rem",
                  fontSize: "0.95rem",
                  fontFamily: "inherit"
                }}
              >
                <option value="+91">+91 (IN)</option>
                <option value="+1">+1 (US/CA)</option>
                <option value="+44">+44 (UK)</option>
                <option value="+971">+971 (AE)</option>
                <option value="+65">+65 (SG)</option>
              </select>
              <input
                id="phone-number"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="98765 43210"
                autoComplete="tel"
                required
                style={{
                  flex: 1,
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "0.375rem",
                  color: "var(--text-primary)",
                  padding: "0.65rem 0.75rem",
                  fontSize: "0.95rem",
                  fontFamily: "inherit"
                }}
              />
            </div>
          </div>

          {/* Invisible reCAPTCHA container required by Firebase Phone Auth */}
          <div id="recaptcha-container" />

          <button
            type="submit"
            disabled={submitting}
            style={{
              background: "linear-gradient(135deg, #06b6d4, #3b82f6)",
              color: "#ffffff",
              fontWeight: 600,
              fontSize: "0.95rem",
              padding: "0.75rem 1rem",
              borderRadius: "0.375rem",
              border: "none",
              cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.7 : 1,
              transition: "opacity 0.2s"
            }}
          >
            {submitting ? "Sending SMS OTP..." : "Send Verification Code"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div>
            <label
              htmlFor="otp-input"
              style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: "var(--text-secondary)",
                marginBottom: "0.5rem"
              }}
            >
              6-Digit Verification Code
            </label>
            <input
              id="otp-input"
              type="text"
              pattern="[0-9]*"
              inputMode="numeric"
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              autoFocus
              required
              className="mono"
              style={{
                width: "100%",
                textAlign: "center",
                letterSpacing: "0.5em",
                fontSize: "1.4rem",
                background: "var(--bg-primary)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "0.375rem",
                color: "var(--accent-cyan)",
                padding: "0.75rem 1rem"
              }}
            />
          </div>

          <button
            type="submit"
            disabled={submitting || otpCode.length !== 6}
            style={{
              background: "linear-gradient(135deg, #10b981, #059669)",
              color: "#ffffff",
              fontWeight: 600,
              fontSize: "0.95rem",
              padding: "0.75rem 1rem",
              borderRadius: "0.375rem",
              border: "none",
              cursor: submitting || otpCode.length !== 6 ? "not-allowed" : "pointer",
              opacity: submitting || otpCode.length !== 6 ? 0.6 : 1,
              transition: "opacity 0.2s"
            }}
          >
            {submitting ? "Verifying OTP..." : "Verify & Sign In"}
          </button>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.85rem",
              marginTop: "0.5rem"
            }}
          >
            <button
              type="button"
              onClick={() => setStep("PHONE")}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-secondary)",
                cursor: "pointer",
                textDecoration: "underline"
              }}
            >
              Change Phone Number
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleResend}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--accent-cyan)",
                cursor: submitting ? "not-allowed" : "pointer",
                textDecoration: "underline"
              }}
            >
              Resend Code
            </button>
          </div>
        </form>
      )}

      <div
        style={{
          marginTop: "1.75rem",
          paddingTop: "1.25rem",
          borderTop: "1px solid var(--border-subtle)",
          fontSize: "0.75rem",
          color: "var(--text-muted)",
          lineHeight: 1.5,
          textAlign: "center"
        }}
      >
        <span style={{ fontWeight: 600 }}>Security Note:</span> Authentication is managed directly by Firebase.
        No custom OTPs are generated or stored in Firestore.
      </div>
    </div>
  );
}
