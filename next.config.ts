import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep these out of the server bundle. Both ship platform-specific native or
  // WebAssembly files that the bundler cannot trace, so bundling them makes the
  // brochure renderer fail at runtime with "Could not load the sharp module
  // using the linux-x64 runtime" — which is exactly how it failed on Vercel
  // while working locally.
  serverExternalPackages: ['sharp', '@hyzyla/pdfium'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
      },
    ],
  },
};

export default nextConfig;
