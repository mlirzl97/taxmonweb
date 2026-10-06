import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  agentRules: false,
  devIndicators: false,
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
