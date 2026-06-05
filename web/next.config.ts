import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Pin this app as its own workspace root so Next does not climb up to the
  // CRM repo (which has its own lockfile + middleware) when building.
  // `turbopack.root` covers dev/turbopack; `outputFileTracingRoot` covers the
  // Vercel/webpack build path — without it Next infers the repo root (two
  // lockfiles) and tries to compile the CRM's middleware.ts.
  turbopack: { root: path.resolve(__dirname) },
  outputFileTracingRoot: path.resolve(__dirname),
  reactStrictMode: true,
  images: {
    // Placeholder media (Mixkit). Swap/extend with real asset hosts later.
    remotePatterns: [
      { protocol: "https", hostname: "assets.mixkit.co" },
    ],
  },
};

export default nextConfig;
