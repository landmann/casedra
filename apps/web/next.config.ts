import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@casablanca/ui",
    "@casablanca/api",
    "@casablanca/types",
  ],
};

export default nextConfig;
