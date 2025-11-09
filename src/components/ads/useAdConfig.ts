// src/components/ads/useAdConfig.ts
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";

/** একটি স্লট অন/অফ বা অতিরিক্ত সেটিংসহ */
export type SlotToggle =
  | boolean
  | {
      enabled: boolean;
      /** কেবল inline হলে– কত নম্বর প্যারাগ্রাফের পরে দেখাবে */
      afterParagraph?: number;
      /** চাইলে ভবিষ্যতে max/ad frequency ইত্যাদি রাখা যাবে */
      maxPerArticle?: number;
    };

export type InlineRule = { slotKey: string; afterParagraph: number };

export type ArticleAdConfig = {
  /** যেকোনো স্লট নাম → টগ্‌ল/সেটিং */
  slots: Record<string, SlotToggle>;
  /** paragraph-wise inline রুলের লিস্ট */
  inline: InlineRule[];
};

const LEGACY_KEYS = [
  "beforeTitle",
  "beforeImage",
  "afterImage",
  "beforeBody",
  "afterBody",
  "afterTags",
] as const;

const DEFAULTS: ArticleAdConfig = {
  slots: Object.fromEntries(LEGACY_KEYS.map((k) => [k, false])),
  inline: [],
};

/** বুলিয়ান কাস্ট করার ছোট ফাংশন */
function toBool(v: any) {
  return v === true || v === 1 || v === "1" || v === "true";
}

/** সার্ভার/ওভাররাইড পেলোড থেকে নিরাপদ কনফিগ বানাও */
function normalizeConfig(input: any): ArticleAdConfig {
  const base: ArticleAdConfig = JSON.parse(JSON.stringify(DEFAULTS));

  const src = input?.config ?? input ?? {};

  // 1) ব্যাকওয়ার্ড: beforeTitle..afterTags যদি boolean আসে
  for (const k of LEGACY_KEYS) {
    if (typeof src[k] === "boolean") base.slots[k] = src[k];
  }

  // 2) জেনেরিক slots মেপ
  if (src.slots && typeof src.slots === "object") {
    for (const [key, val] of Object.entries(src.slots)) {
      if (typeof val === "boolean") {
        base.slots[key] = val;
      } else if (val && typeof val === "object") {
        const enabled = toBool((val as any).enabled);
        const ap = Number((val as any).afterParagraph);
        const slotObj: SlotToggle = {
          enabled,
          ...(Number.isFinite(ap) && ap > 0 ? { afterParagraph: ap } : {}),
          ...(Number.isFinite((val as any).maxPerArticle)
            ? { maxPerArticle: Number((val as any).maxPerArticle) }
            : {}),
        };
        base.slots[key] = slotObj;

        // afterParagraph থাকলে inline রুল অটো-তে যোগ
        if ((slotObj as any).afterParagraph) {
          base.inline.push({
            slotKey: key,
            afterParagraph: (slotObj as any).afterParagraph,
          });
        }
      }
    }
  }

  // 3) explicit inline list
  if (Array.isArray(src.inline)) {
    for (const r of src.inline) {
      const ap = Number(r?.afterParagraph);
      const sk = String(r?.slotKey || "");
      if (sk && Number.isFinite(ap) && ap > 0) {
        base.inline.push({ slotKey: sk, afterParagraph: ap });
        // inline রুল থাকলে slot-এও enabled=true ধরে নেওয়া যায়
        if (!base.slots[sk]) base.slots[sk] = { enabled: true, afterParagraph: ap };
      }
    }
  }

  // ডুপ্লিকেট inline রুল কেটে দিয়ে sort করা
  const seen = new Set<string>();
  base.inline = base.inline
    .filter((r) => {
      const key = `${r.slotKey}#${r.afterParagraph}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.afterParagraph - b.afterParagraph);

  return base;
}

/** deep merge: left <- right */
function mergeConfig(a: ArticleAdConfig, b?: Partial<ArticleAdConfig>): ArticleAdConfig {
  if (!b) return a;
  const out: ArticleAdConfig = { slots: { ...a.slots }, inline: [...a.inline] };

  if (b.slots) {
    for (const [k, v] of Object.entries(b.slots)) {
      out.slots[k] = v as SlotToggle;
    }
  }
  if (Array.isArray(b.inline)) {
    out.inline = [...out.inline, ...b.inline];
  }
  return normalizeConfig(out); // merge শেষে sanitize
}

/**
 * অ্যাড কনফিগ ফেচ করার হুক (URL optional).
 * - পুরনো ৬টা কী 그대로 কাজ করবে
 * - নতুন যেকোনো slotKey/inline rule সাপোর্ট করবে
 */
export function useAdConfig(url?: string, override?: Partial<ArticleAdConfig>) {
  const [config, setConfig] = useState<ArticleAdConfig>(
    mergeConfig(DEFAULTS, override)
  );
  const [loading, setLoading] = useState(!!url);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!url) return;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const r = await fetch(url, { cache: "no-store" });
        const j = await r.json().catch(() => ({}));
        if (!cancelled && r.ok) {
          const next = mergeConfig(normalizeConfig(j), override);
          setConfig(next);
        } else if (!cancelled && !r.ok) {
          setError(`HTTP ${r.status}`);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load ad config");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]); // override সাধারণত স্থির—প্রয়োজনে deps-এ দাও

  /** কোনো স্লট অন কিনা */
  const isEnabled = useCallback(
    (slotKey: string) => {
      const v = config.slots[slotKey];
      return typeof v === "boolean" ? v : !!v?.enabled;
    },
    [config.slots]
  );

  /** paragraph-wise রুলগুলো sort করা */
  const inlineRules = useMemo(() => config.inline, [config.inline]);

  return { config, isEnabled, inlineRules, loading, error };
}
