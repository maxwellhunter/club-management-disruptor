import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@club/shared"],
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
