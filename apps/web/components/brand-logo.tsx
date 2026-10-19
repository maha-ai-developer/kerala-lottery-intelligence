import { useId } from "react";

interface BrandLogoProps {
  size?: number;
  className?: string;
}

/**
 * Original Kerala-inspired scientific mark for Kerala Lottery Intelligence.
 * Combines stylized Kerala coconut palm frond arcs and Arabian Sea / backwater waves
 * with cryptographic SHA-256 knowledge-graph nodes.
 * Not an official Kerala Government emblem.
 */
export function BrandLogo({ size = 36, className }: BrandLogoProps) {
  const uid = useId().replace(/:/g, "");
  const bgId = `kli-bg-${uid}`;
  const goldId = `kli-gold-${uid}`;
  const palmId = `kli-palm-${uid}`;
  const waveId = `kli-wave-${uid}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 128 128"
      width={size}
      height={size}
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
      style={{ flexShrink: 0, display: "block" }}
    >
      <defs>
        <linearGradient id={bgId} x1="12" y1="8" x2="116" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#064e3b" />
          <stop offset="55%" stopColor="#0f766e" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id={goldId} x1="28" y1="24" x2="100" y2="96" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <linearGradient id={palmId} x1="30" y1="28" x2="94" y2="86" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
        <linearGradient id={waveId} x1="20" y1="92" x2="108" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#2dd4bf" />
        </linearGradient>
      </defs>

      <rect x="6" y="6" width="116" height="116" rx="28" fill={`url(#${bgId})`} stroke={`url(#${goldId})`} strokeWidth="4" />
      <rect x="13" y="13" width="102" height="102" rx="22" stroke="#34d399" strokeOpacity="0.24" strokeWidth="1.4" />

      <path d="M64 88 C62 66 52 46 32 36 C46 35 58 43 64 58" stroke={`url(#${palmId})`} strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M64 88 C61 68 46 56 26 52 C40 49 54 55 62 68" stroke={`url(#${palmId})`} strokeWidth="3.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.88" />
      <path d="M64 88 C66 66 76 46 96 36 C82 35 70 43 64 58" stroke={`url(#${palmId})`} strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M64 88 C67 68 82 56 102 52 C88 49 74 55 66 68" stroke={`url(#${palmId})`} strokeWidth="3.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.88" />
      <path d="M64 90 L64 26" stroke={`url(#${goldId})`} strokeWidth="4" strokeLinecap="round" />

      <path d="M36 42 L64 26 L92 42 L64 62 Z" stroke="#fde68a" strokeOpacity="0.58" strokeWidth="1.8" strokeDasharray="3 2.5" />
      <path d="M36 42 L92 42" stroke="#38bdf8" strokeOpacity="0.48" strokeWidth="1.5" />

      <path d="M24 94 C38 87 50 101 64 94 C78 87 90 101 104 94" stroke={`url(#${waveId})`} strokeWidth="4.2" strokeLinecap="round" />
      <path d="M30 104 C42 98 53 109 64 104 C75 98 86 109 98 104" stroke="#38bdf8" strokeOpacity="0.68" strokeWidth="3" strokeLinecap="round" />

      <circle cx="64" cy="26" r="6.2" fill={`url(#${goldId})`} stroke="#064e3b" strokeWidth="2.2" />
      <circle cx="36" cy="42" r="5.2" fill="#34d399" stroke="#064e3b" strokeWidth="2.2" />
      <circle cx="92" cy="42" r="5.2" fill="#38bdf8" stroke="#064e3b" strokeWidth="2.2" />
      <circle cx="64" cy="62" r="5.6" fill={`url(#${goldId})`} stroke="#064e3b" strokeWidth="2.2" />
    </svg>
  );
}
