// src/next.config.ts  (root: next.config.ts)
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* ------------ Images ------------- */
  images: {
    // ✅ সহজ সমাধান: যেকোনো external src কাজ করবে (Image অপ্টিমাইজার অফ)
    //    ড্যাশবোর্ড অ্যাভাটার/লাইব্রেরির জন্য যথেষ্ট।
    unoptimized: true,

    // ⬇️ (ঐচ্ছিক) প্রডাকশনে অপ্টিমাইজার চালাতে চাইলে উপরের লাইনটি মুছে ফেলে
    // নিচের remotePatterns/domains আনকমেন্ট করে সঠিক ডোমেইন বসাও।
    // remotePatterns: [
    //   // তোমার সাইট/সিডিএন
    //   { protocol: "https", hostname: "cdn.yoursite.com" },
    //   { protocol: "https", hostname: "assets.yoursite.com" },
    //   // Gravatar ফলোব্যাক
    //   { protocol: "https", hostname: "www.gravatar.com" },
    //   { protocol: "https", hostname: "secure.gravatar.com" },
    //   { protocol: "https", hostname: "gravatar.com" },
    // ],
    // domains: ["localhost", "127.0.0.1"], // যদি domains ব্যবহার করো
  },

  /* --------- Experimental ---------- */
  experimental: {
    // App Router route handler-এ বড় ফাইল আপলোড (multipart/form-data)
    serverActions: {
      bodySizeLimit: "25mb",
    },
    // server-side bundle-এ native deps রাখা (mysql2, sharp ইত্যাদি)
    serverComponentsExternalPackages: ["mysql2", "sharp"],
  },

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
};

export default nextConfig;
