import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  serverExternalPackages: ["@libsql/client"],
  experimental: { serverActions: { bodySizeLimit: "1mb" } },
  devIndicators: false,
};

export default nextConfig;
