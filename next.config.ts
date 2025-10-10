// src/next.config.ts  (root: next.config.ts)

// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* ------------ Images ------------- */
  images: {
    // External images allowlist না লাগলে সহজ সমাধান:
    unoptimized: true,

    // চাইলে later: remotePatterns/domains ব্যবহার করতে পারো
    // remotePatterns: [
    //   { protocol: "https", hostname: "cdn.yoursite.com" },
    //   { protocol: "https", hostname: "assets.yoursite.com" },
    //   { protocol: "https", hostname: "www.gravatar.com" },
    //   { protocol: "https", hostname: "secure.gravatar.com" },
    //   { protocol: "https", hostname: "gravatar.com" },
    // ],
    // domains: ["localhost", "127.0.0.1"],
  },

  /* --------- Experimental ---------- */
  experimental: {
    // App Router route handler-এ বড় ফাইল আপলোড
    serverActions: { bodySizeLimit: "25mb" },
  },

  /* -------- Keep native deps in the server bundle (Next 15) -------- */
  // ⬇️ গুরুত্বপূর্ণ: আগের `experimental.serverComponentsExternalPackages`
  // এখন আর কাজ করে না। টপ-লেভেলে `serverExternalPackages` ব্যবহার করো।
  serverExternalPackages: ["mysql2", "sharp"],

  /* ------------- Webpack ------------ */
  webpack: (config) => {
    // অব্যবহৃত DB ড্রাইভারগুলো বাদ দাও (bundle ছোট হয়)
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "pg-hstore": false,
      pg: false,
      sqlite3: false,
      tedious: false,
    };
    return config;
  },

  // (ঐচ্ছিক) Docker/Serverless ডিপ্লয়ের জন্য
  // output: "standalone",

  // (ঐচ্ছিক) যদি “multiple lockfiles detected” ওয়ার্নিং দেখায়:
  // outputFileTracingRoot: process.cwd(),
};

export default nextConfig;

