import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProviders } from "../components/app-providers";
import { Navigation } from "../components/navigation";
import { Footer } from "../components/footer";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#065f46" },
    { media: "(prefers-color-scheme: dark)", color: "#064e3b" }
  ]
};

export const metadata: Metadata = {
  title: "Kerala Lottery Intelligence — Independent Scientific Research Platform",
  applicationName: "Kerala Lottery Intelligence",
  description:
    "Independent scientific and archival research surface for Kerala State Lotteries draw verification, SHA-256 rule provenance, statistical uniformity testing, and temporal experiment backtesting.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "KL Intelligence"
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" }
    ],
    shortcut: ["/favicon.ico"],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }
    ]
  }
};

const THEME_INIT_SCRIPT = `(function() {
  try {
    var stored = window.localStorage.getItem('kli-theme');
    var theme = (stored === 'light' || stored === 'dark')
      ? stored
      : (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();`;

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <AppProviders>
          <div className="app-shell">
            <Navigation />
            <main id="main-content" className="main-content-area">
              {children}
            </main>
            <Footer />
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
