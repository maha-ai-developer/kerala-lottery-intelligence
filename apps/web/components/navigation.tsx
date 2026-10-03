"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Overview" },
  { href: "/lotteries", label: "Lotteries" },
  { href: "/draws", label: "Draws" },
  { href: "/results", label: "Results" },
  { href: "/schemes", label: "Prize Schemes" },
  { href: "/statistics", label: "Statistics" },
  { href: "/experiments", label: "Experiments" },
  { href: "/findings", label: "Findings & Evidence" },
  { href: "/geography", label: "Geography & Exposure" },
  { href: "/research-sandbox", label: "Research Sandbox" },
  { href: "/ingestion", label: "Ingestion" }
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.25rem",
        overflowX: "auto",
        padding: "0.25rem 0"
      }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              padding: "0.4rem 0.75rem",
              borderRadius: "0.375rem",
              fontSize: "0.85rem",
              fontWeight: isActive ? 600 : 500,
              color: isActive ? "var(--accent-cyan)" : "var(--text-secondary)",
              background: isActive ? "rgba(56, 189, 248, 0.1)" : "transparent",
              border: isActive
                ? "1px solid rgba(56, 189, 248, 0.25)"
                : "1px solid transparent",
              transition: "all 0.15s ease",
              textDecoration: "none",
              whiteSpace: "nowrap"
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
