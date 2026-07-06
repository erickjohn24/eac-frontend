import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@tz/shared", "@tz/db"],
  serverExternalPackages: ["pg", "pdfkit"],
  devIndicators: false,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
