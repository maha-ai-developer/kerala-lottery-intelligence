"use client";

import { useAuth } from "../lib/auth-context";

export function HeaderAuthStatus() {
  const { user, userProfile, loading, signOut } = useAuth();

  if (loading) {
    return (
      <span className="mono" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
        Checking auth...
      </span>
    );
  }

  if (!user) {
    return (
      <span className="badge badge-amber" style={{ fontSize: "0.75rem" }}>
        Unauthenticated
      </span>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
      <span className="badge badge-blue" style={{ fontSize: "0.75rem" }}>
        {userProfile?.role || "VIEWER"}
      </span>
      <button
        type="button"
        onClick={() => signOut()}
        style={{
          background: "transparent",
          border: "none",
          color: "var(--text-muted)",
          cursor: "pointer",
          fontSize: "0.75rem",
          textDecoration: "underline"
        }}
      >
        Sign Out
      </button>
    </div>
  );
}
