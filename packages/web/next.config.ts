import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.CODENAMES_E2E === "true" ? ".next-e2e" : "dist",
  output: "export",
};

export default nextConfig;
