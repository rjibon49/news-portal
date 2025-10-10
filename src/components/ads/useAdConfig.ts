// src/components/ads/useAdConfig.ts
"use client";

import { useEffect, useState } from "react";

export type ArticleAdConfig = {
  beforeTitle?: boolean;
  beforeImage?: boolean;
  afterImage?: boolean;
  beforeBody?: boolean;
  afterBody?: boolean;
  afterTags?: boolean;
};

const DEFAULTS: ArticleAdConfig = {
  beforeTitle: false,
  beforeImage: false,
  afterImage: false,
  beforeBody: false,
  afterBody: false,
  afterTags: false,
};

/**
 * অ্যাড কনফিগ ফেচ করার হুক (ঐচ্ছিক URL; না দিলে শুধু defaults/prop-merge)
 */
export function useAdConfig(
  url?: string,
  override?: Partial<ArticleAdConfig>
) {
  const [cfg, setCfg] = useState<ArticleAdConfig>({
    ...DEFAULTS,
    ...(override || {}),
  });

  useEffect(() => {
    let cancelled = false;
    if (!url) return;

    (async () => {
      try {
        const r = await fetch(url, { cache: "no-store" });
        const j = await r.json().catch(() => ({}));
        if (!cancelled && r.ok) {
          setCfg((prev) => ({ ...prev, ...(j?.config || {}) }));
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  return cfg;
}
