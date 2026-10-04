import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  output: "standalone",

  outputFileTracingIncludes: {
    "/api/**/*": ["./data/**/*"]
  },

  transpilePackages: [
    "@kerala-lottery/domain",
    "@kerala-lottery/validation",
    "@kerala-lottery/statistics"
  ],

  serverExternalPackages: ["pdfjs-dist"],

  async rewrites() {
    return [
      {
        source: "/favicon.ico",
        destination: "/icon.svg"
      }
    ];
  },

  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0"
  }
};

export default nextConfig;
