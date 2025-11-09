// src/app/(site)/[slug]/AdSlot.client.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { getUid, getSid } from "@/components/ads/identity";
import styles from "./post.module.css";

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
function isOn(v: any) { return v === "1" || v === "true" || v === "yes"; }

const qsDebug = typeof window !== "undefined"
  ? new URLSearchParams(window.location.search).get("ads_debug")
  : null;

const DEBUG = isOn(qsDebug) || (typeof window !== "undefined" && isOn(localStorage.getItem("ads_debug")));

function firstStr(obj: any, keys: string[]): string | null {
  if (!obj) return null;
  for (const k of keys) if (k in obj) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}
function firstNum(obj: any, keys: string[]): number | null {
  if (!obj) return null;
  for (const k of keys) if (k in obj) {
    const n = Number(obj[k]);
    if (!Number.isNaN(n)) return n;
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
  if (j.creative) return [{ creative: j.creative } ];
  return [];
}
async function postJsonToFirstOk(urls: string[], body: any) {
  for (const u of urls) {
    try {
      const r = await fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (r.ok) return true;
    } catch {}
  }
  return false;
}

/** ---- HTML helpers: make script creatives actually execute ---- */
function uniqId(slotKey: string) {
  return `ad_${slotKey}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
function retargetInsId(html: string, newId: string) {
  const m = html.match(/<ins\s+[^>]*id=["']([^"']+)["']/i);
  if (!m) return html;
  const oldId = m[1];
  let out = html.replace(/<ins\s+([^>]*?)id=["'][^"']+["']([^>]*)>/i, `<ins $1id="${newId}"$2>`);
  out = out.replace(new RegExp(`\\(\\s*["']${oldId}["']\\s*,`), `("${newId}",`);
  return out;
}
function injectHtmlAndRunScripts(container: HTMLElement, rawHtml: string, slotKey: string) {
  const safeHtml = retargetInsId(rawHtml, uniqId(slotKey));
  container.innerHTML = safeHtml;
  const scripts = Array.from(container.querySelectorAll("script"));
  for (const old of scripts) {
    const s = document.createElement("script");
    for (const { name, value } of Array.from(old.attributes)) s.setAttribute(name, value);
    if (old.textContent) s.text = old.textContent;
    old.parentNode?.replaceChild(s, old);
  }
}

/* ---------------- component ---------------- */
export default function AdSlot({ slotKey, className }: { slotKey: string; className?: string }) {
  const [creative, setCreative] = useState<ActivePlacement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [reason, setReason] = useState<string>("init");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const htmlRef = useRef<HTMLDivElement | null>(null);
  const impressedRef = useRef(false);

  // Load active placement
  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const r = await fetch(`/api/r2/ads/placements/active?slotKey=${encodeURIComponent(slotKey)}`, { cache: "no-store" });
        if (!r.ok) { setReason(`http ${r.status}`); setCreative(null); return; }
        const j = await r.json().catch(() => ({}));
        if (DEBUG) console.info("[AdSlot]", slotKey, "raw:", j);

        const rows = pickRows(j);
        if (!rows.length) { setReason("no-rows"); setCreative(null); return; }
        const raw = rows[0];
        const nested = raw.creative || raw.Creative || raw.asset || raw.media || raw.payload || {};

        const html   = firstStr(raw, ["html","creative_html","markup"]) ??
                       firstStr(nested, ["html","creative_html","markup"]);
        const image  = normalizeUrl(
          firstStr(raw, ["image_url","imageUrl","image","img_url","img","src","media_url","file_url","fileUrl","url","path"]) ??
          firstStr(nested, ["image_url","imageUrl","image","img_url","img","src","media_url","file_url","fileUrl","url","path"])
        );
        const click  = firstStr(raw, ["click_url","clickUrl","href","link","target_url","cta_url"]) ??
                       firstStr(nested, ["click_url","clickUrl","href","link","target_url","cta_url"]);
        const width  = firstNum(raw, ["width","w"])  ?? firstNum(nested, ["width","w"]);
        const height = firstNum(raw, ["height","h"]) ?? firstNum(nested, ["height","h"]);

        const placement_id = firstNum(raw, ["placement_id","pid","placementId","id"]) ?? 0;
        const creative_id  = firstNum(raw, ["creative_id","cid","creativeId"]) ??
                             firstNum(nested, ["creative_id","cid","creativeId"]) ?? 0;
        const slotNest = raw.slot || raw.Slot || {};
        const slot_id = firstNum(raw, ["slot_id","sid","slotId"]) ?? firstNum(slotNest, ["id","slot_id"]) ?? 0;
        const name = firstStr(raw, ["name","title","label"]) ?? firstStr(nested, ["name","title","label"]);

        const mapped: ActivePlacement = {
          placement_id, creative_id, slot_id,
          html: html || null,
          image_url: image || null,
          click_url: click || null,
          name: name || null,
          width: width || null,
          height: height || null,
        };

        if (!mapped.html && !mapped.image_url) { setReason("no-html-no-image"); setCreative(null); return; }
        if (on) { setCreative(mapped); setReason("ok"); }
      } catch (e: any) {
        setReason(e?.message || "fetch-error");
        setCreative(null);
      } finally {
        if (on) setLoaded(true);
      }
    })();
    return () => { on = false; };
  }, [slotKey]);

  // HTML creative হলে inject + scripts execute
  useEffect(() => {
    if (!creative?.html || !htmlRef.current) return;
    injectHtmlAndRunScripts(htmlRef.current, creative.html, slotKey);
  }, [creative?.html, slotKey]);

  // Impression: ≥50% দৃশ্যমান থাকলে 1s পর fire; uid/sid পাঠাও; ৫-মিন dedupe সার্ভারে
  useEffect(() => {
    if (!creative) return;
    const el = rootRef.current; if (!el) return;

    let fired = false;
    let timer: any = null;

    const send = async () => {
      if (fired) return;
      fired = true;
      impressedRef.current = true;

      const uid = getUid();
      const sid = getSid();
      const sw = window.screen?.width ?? 0;
      const sh = window.screen?.height ?? 0;
      const vw = window.innerWidth ?? 0;
      const vh = window.innerHeight ?? 0;

      await postJsonToFirstOk(
        ["/api/r2/ads/metrics/impression"],
        {
          slot_id: creative.slot_id,
          placement_id: creative.placement_id,
          creative_id: creative.creative_id,
          uid, sid,
          vw: { sw, sh, vw, vh },
          vis_ms: 1000
        }
      );
    };

    const io = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.5) {
            if (!timer && !impressedRef.current) timer = setTimeout(send, 1000);
          } else {
            if (timer) { clearTimeout(timer); timer = null; }
          }
        }
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] }
    );

    io.observe(el);
    return () => { io.disconnect(); if (timer) clearTimeout(timer); };
  }, [creative]);

  if (!loaded)
    return <div ref={rootRef} className={`${styles.adWrap} ${className || ""}`} aria-hidden />;

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
    await postJsonToFirstOk(["/api/r2/ads/metrics/click"], {
      slot_id: creative.slot_id,
      placement_id: creative.placement_id,
      creative_id: creative.creative_id,
    });
    window.open(creative.click_url, "_blank", "noopener,noreferrer");
  };

  return (
    <div ref={rootRef} className={`${styles.adWrap} ${className || ""}`}>
      <div className={styles.adLabel}>AD</div>

      {creative.html ? (
        <div ref={htmlRef} className={styles.adHtml} />
      ) : (
        <button className={styles.adButton} onClick={onClick} aria-label="Advertisement">
          <Image
            src={creative.image_url!}
            alt={creative.name || "Advertisement"}
            width={creative.width ?? 10}
            height={creative.height ?? 10}
            unoptimized
            className={styles.adImg}
            sizes={creative.width ? `${creative.width}px` : "100vw"}
            style={{
              width: creative.width ? `${creative.width}px` : "auto",
              height: "auto",
              maxWidth: "100%",
              display: "block",
              margin: "0 auto",
            }}
          />
        </button>
      )}

      {DEBUG && reason !== "ok" && <div className={styles.adDebug}>[{slotKey}] {reason}</div>}
    </div>
  );
}
