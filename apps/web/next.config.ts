import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@rudd/db", "@rudd/shared"],
};

export default nextConfig;
