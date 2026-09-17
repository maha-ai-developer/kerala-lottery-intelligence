import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@kerala-lottery/domain",
    "@kerala-lottery/validation",
    "@kerala-lottery/statistics"
  ],
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0"
  }
};

export default nextConfig;
