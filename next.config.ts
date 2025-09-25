import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // lets Next bundle native deps correctly on the server
    serverComponentsExternalPackages: ["mysql2", "sequelize"],
  },
  webpack: (config) => {
    // ignore drivers you don’t use when Webpack is in play
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
