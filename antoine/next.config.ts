import path from "node:path";

import type { NextConfig } from "next";

// Antoine lives inside the TaxMonWeb repository; pin its build root so the
// parent app's files (proxy, lockfile) are never picked up.
const appRoot = path.resolve(".");

const nextConfig: NextConfig = {
  turbopack: { root: appRoot },
  outputFileTracingRoot: appRoot,
  devIndicators: false,
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
};

export default nextConfig;
