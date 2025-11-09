// src/components/ads/AdSlot.tsx

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import styles from "./adslot.module.css";

/* ---------------- types ---------------- */
type ActivePlacement = {
  placement_id: number;
  creative_id: number;
  slot_id: number;
  html?: string | null;
  image_url?: string | null;
  click_url?: string | null;
  name?: string | null;
  width?: number | null;
  height?: number | null;
};

/* ---------------- utils ---------------- */
const qsDebug =
  typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("ads_debug")
    : null;

function isOn(v: any) {
  return v === "1" || v === "true" || v === "yes" || v === 1 || v === true;
}
const DEBUG =
  isOn(qsDebug) ||
  (typeof window !== "undefined" && isOn(localStorage.getItem("ads_debug")));

function firstStr(obj: any, keys: string[]): string | null {
  if (!obj) return null;
  for (const k of keys) {
    if (k in obj) {
      const v = obj[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return null;
}
function firstNum(obj: any, keys: string[]): number | null {
  if (!obj) return null;
  for (const k of keys) {
    if (k in obj) {
      const v = obj[k];
      const n = Number(v);
      if (!Number.isNaN(n)) return n;
    }
  }
  return null;
}
function normalizeUrl(u?: string | null): string | null {
  if (!u) return null;
  if (/^(https?:)?\/\//i.test(u) || /^data:image\//i.test(u)) return u;
  if (u.startsWith("/")) return u;
  return `/${u.replace(/^\/+/, "")}`;
}
function pickRows(j: any): any[] {
  if (!j) return [];
  if (Array.isArray(j)) return j;
  if (Array.isArray(j.rows)) return j.rows;
  if (Array.isArray(j.items)) return j.items;
  if (Array.isArray(j.data)) return j.data;
  if (Array.isArray(j.placements)) return j.placements;
  if (Array.isArray(j.result?.rows)) return j.result.rows;
  if (j.row) return [j.row];
  if (j.placement) return [j.placement];
  if (j.active || j.activePlacement) return [j.active || j.activePlacement];
  return [];
}

async function postJson(url: string, body: any) {
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/** Re-execute any <script> tags inside container. */
function runScripts(container: HTMLElement) {
  const scripts = Array.from(container.querySelectorAll("script"));
  for (const old of scripts) {
    const s = document.createElement("script");
    // copy attributes (src, async, defer, type, data-*, etc.)
    for (const { name, value } of Array.from(old.attributes)) {
      s.setAttribute(name, value);
    }
    // inline script content
    if (old.textContent) s.text = old.textContent;
    // replace in DOM so it actually executes
    old.replaceWith(s);
  }
}

/* ---------------- component ---------------- */
export default function AdSlot({
  slotKey,
  className,
}: {
  slotKey: string;
  className?: string;
}) {
  const [creative, setCreative] = useState<ActivePlacement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [reason, setReason] = useState<string>("init");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const htmlRef = useRef<HTMLDivElement | null>(null);
  const impressedRef = useRef(false);

  // Load active placement for this slot
  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const r = await fetch(
          `/api/r2/ads/placements/active?slotKey=${encodeURIComponent(
            slotKey
          )}`,
          { cache: "no-store" }
        );
        if (!r.ok) {
          setReason(`http ${r.status}`);
          setCreative(null);
          return;
        }
        const j = await r.json().catch(() => ({}));
        if (DEBUG) console.info("[AdSlot]", slotKey, "raw:", j);

        const rows = pickRows(j);
        if (!rows.length) {
          setReason("no-rows");
          setCreative(null);
          return;
        }
        const raw = rows[0];
        const nested =
          raw.creative || raw.Creative || raw.asset || raw.media || {};

        const html =
          firstStr(raw, ["html", "creative_html", "markup"]) ??
          firstStr(nested, ["html", "creative_html", "markup"]);

        const image_url = normalizeUrl(
          firstStr(raw, [
            "image_url",
            "imageUrl",
            "image",
            "img_url",
            "img",
            "src",
            "media_url",
            "file_url",
            "fileUrl",
            "url",
            "path",
          ]) ??
            firstStr(nested, [
              "image_url",
              "imageUrl",
              "image",
              "img_url",
              "img",
              "src",
              "media_url",
              "file_url",
              "fileUrl",
              "url",
              "path",
            ])
        );

        const click_url =
          firstStr(raw, ["click_url", "clickUrl", "href", "link", "target_url", "cta_url"]) ??
          firstStr(nested, ["click_url", "clickUrl", "href", "link", "target_url", "cta_url"]);

        const width = firstNum(raw, ["width", "w"]) ?? firstNum(nested, ["width", "w"]);
        const height = firstNum(raw, ["height", "h"]) ?? firstNum(nested, ["height", "h"]);

        const placement_id =
          firstNum(raw, ["placement_id", "pid", "placementId", "id"]) ?? 0;
        const creative_id =
          firstNum(raw, ["creative_id", "cid", "creativeId"]) ??
          firstNum(nested, ["creative_id", "cid", "creativeId"]) ??
          0;
        const slot_id =
          firstNum(raw, ["slot_id", "sid"]) ??
          firstNum(nested, ["slot_id", "sid"]) ??
          firstNum(raw.slot || {}, ["id"]) ??
          0;

        const name =
          firstStr(raw, ["name", "title", "label"]) ??
          firstStr(nested, ["name", "title", "label"]);

        const mapped: ActivePlacement = {
          placement_id: placement_id || 0,
          creative_id: creative_id || 0,
          slot_id: slot_id || 0,
          html: html || null,
          image_url: image_url || null,
          click_url: click_url || null,
          name: name || null,
          width: width || null,
          height: height || null,
        };

        if (!mapped.html && !mapped.image_url) {
          setReason("no-html-no-image");
          setCreative(null);
          return;
        }

        if (on) {
          setCreative(mapped);
          setReason("ok");
        }
      } catch (e: any) {
        setReason(e?.message || "fetch-error");
        setCreative(null);
      } finally {
        if (on) setLoaded(true);
      }
    })();
    return () => {
      on = false;
    };
  }, [slotKey]);

  /** Re-execute scripts when HTML creative is mounted/changed */
  useEffect(() => {
    if (!creative?.html || !htmlRef.current) return;
    const t = setTimeout(() => runScripts(htmlRef.current!), 0);
    return () => clearTimeout(t);
  }, [creative?.html]);

  /** Fire 1x impression when visible */
  useEffect(() => {
    if (!creative || impressedRef.current) return;
    const el = rootRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (ents) => {
        ents.forEach(async (e) => {
          if (e.isIntersecting && !impressedRef.current) {
            impressedRef.current = true;
            await postJson("/api/r2/ads/metrics/impression", {
              placement_id: creative.placement_id,
              creative_id: creative.creative_id || undefined,
            });
          }
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [creative]);

  if (!loaded)
    return (
      <div ref={rootRef} className={`${styles.adWrap} ${className || ""}`} aria-hidden />
    );

  if (!creative) {
    if (DEBUG) {
      return (
        <div ref={rootRef} className={`${styles.adWrap} ${className || ""}`}>
          <div className={styles.adDebug}>[{slotKey}] {reason}</div>
        </div>
      );
    }
    return null;
  }

  const onClick = async () => {
    if (!creative.click_url) return;
    await postJson("/api/r2/ads/metrics/click", {
      placement_id: creative.placement_id,
      creative_id: creative.creative_id || undefined,
    });
    window.open(creative.click_url, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      ref={rootRef}
      className={`${styles.adWrap} ${className || ""}`}
      data-slot-key={slotKey}
      data-placement-id={creative.placement_id}
    >
      <div className={styles.adLabel}>Ad</div>

      {creative.html ? (
        <div
          ref={htmlRef}
          className={styles.adHtml}
          // scripts will be re-executed by runScripts()
          dangerouslySetInnerHTML={{ __html: creative.html }}
        />
      ) : (
        <button
          className={styles.adButton}
          onClick={onClick}
          aria-label="Advertisement"
        >
          <Image
            src={creative.image_url!}
            alt={creative.name || "Advertisement"}
            width={creative.width || 1200}
            height={creative.height || 628}
            sizes="(max-width: 900px) 98vw, 720px"
            className={styles.adImg}
            unoptimized
          />
        </button>
      )}

      {DEBUG && reason !== "ok" && (
        <div className={styles.adDebug}>
          [{slotKey}] {reason}
        </div>
      )}
    </div>
  );
}
