// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Allow larger multipart/form-data for App Router route handlers (uploads)
    serverActions: {
      bodySizeLimit: "25mb",
    },
    // bundle native deps used on the server
    serverComponentsExternalPackages: ["mysql2", "sharp"],
  },
  webpack: (config) => {
    // ignore DB drivers you don't use
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "pg-hstore": false,
      pg: false,
      sqlite3: false,
      tedious: false,
    };
    return config;
  },
};

export default nextConfig;
