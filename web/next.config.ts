import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Pin this app as its own workspace root so Next does not climb up to the
  // CRM repo (which has its own lockfile + middleware) when building.
  turbopack: { root: path.resolve(__dirname) },
  reactStrictMode: true,
  images: {
    // Placeholder media (Mixkit). Swap/extend with real asset hosts later.
    remotePatterns: [
      { protocol: "https", hostname: "assets.mixkit.co" },
    ],
  },
};

export default nextConfig;
