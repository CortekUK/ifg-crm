import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfium ships a WebAssembly binary the bundler cannot trace, so it has to be
  // resolved from node_modules at runtime instead of being bundled into the
  // brochure renderer's route.
  serverExternalPackages: ['@hyzyla/pdfium'],
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
