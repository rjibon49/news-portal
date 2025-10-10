// src/components/reader/InfiniteArticleReader.tsx
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import ShareIcons from "@/components/ui/SocialIcon/ShareIcons";
import AdSlot from "@/components/ads/AdSlot";
import { useAdConfig, type ArticleAdConfig } from "@/components/ads/useAdConfig";

/* ---------- Types ---------- */
type Author = {
  id?: number;
  name?: string;
  slug?: string;
  avatarUrl?: string | null;
};

type Post = {
  id: number;
  slug: string;
  title: string;
  contentHtml: string;
  date: string;
  author?: Author | null;
  image?: { src?: string; alt?: string } | null;

  category?: string | null;
  tags?: string | null;
};

type StreamItem = { slug: string; id: number; title: string; date: string };

/* ---------- Utils ---------- */
const toSlug = (s: string) =>
  s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");

function csvToList(csv?: string | null) {
  return (csv || "").split(",").map((s) => s.trim()).filter(Boolean);
}

function formatBD12h(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-BD", {
      timeZone: "Asia/Dhaka",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

/* ---------- API ---------- */
async function fetchPost(slug: string): Promise<Post | null> {
  const r = await fetch(`/api/r2/post/${encodeURIComponent(slug)}`, { cache: "no-store" });
  if (!r.ok) return null;
  const j = await r.json();
  return j?.post as Post;
}

async function fetchStream(startSlug: string, offset: number, limit: number): Promise<string[]> {
  const qs = new URLSearchParams({ startSlug, offset: String(offset), limit: String(limit) });
  const r = await fetch(`/api/r2/stream?${qs.toString()}`, { cache: "no-store" });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error || "Stream failed");
  return (j.items as StreamItem[]).map((x) => x.slug);
}

/* ---------- Component ---------- */
export default function InfiniteArticleReader({
  initialPost,
  batchSize = 2,
  prefetchNext = true,
  changeUrl = true,
  urlPrefix = "",
  itemThreshold = 0.6,
  sentinelRootMargin = "400px 0px",
  maxArticles = Infinity,
  getNextSlugs = fetchStream,

  // 🧩 Ads:
  adConfig,         // prop দিয়ে override করতে পারো
  adConfigUrl,      // অথবা API থেকে টানবে (e.g. /api/r2/ads/article)
}: {
  initialPost: Post;
  batchSize?: number;
  prefetchNext?: boolean;
  changeUrl?: boolean;
  urlPrefix?: string;
  itemThreshold?: number;
  sentinelRootMargin?: string;
  maxArticles?: number;
  getNextSlugs?: (startSlug: string, offset: number, limit: number) => Promise<string[]>;

  adConfig?: Partial<ArticleAdConfig>;
  adConfigUrl?: string;
}) {
  // ---- ads config (prop + API merge)
  const ads = useAdConfig(adConfigUrl, adConfig);

  // ---- state & refs
  const [articles, setArticles] = useState<Post[]>([initialPost]);
  const [queue, setQueue] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [noMore, setNoMore] = useState(false);

  const offsetRef = useRef(1);
  const loadingRef = useRef(false);
  const doneRef = useRef(false);
  const seenSlugs = useRef<Set<string>>(new Set([initialPost.slug]));

  type El = HTMLDivElement;
  const itemRefs = useRef<Array<El | null>>([]);
  const setItemRef = useCallback((idx: number) => (el: El | null) => {
    itemRefs.current[idx] = el;
  }, []);

  // ---- enqueue next batch
  const enqueueNextBatch = useCallback(async () => {
    if (doneRef.current || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const slugs = (await getNextSlugs(initialPost.slug, offsetRef.current, batchSize)).filter(
        (s) => !seenSlugs.current.has(s)
      );
      offsetRef.current += batchSize;

      if (slugs.length === 0) {
        doneRef.current = true;
        setNoMore(true);
        return;
      }

      setQueue((prev) => {
        const merged = [...prev, ...slugs.filter((s) => !prev.includes(s))];
        merged.forEach((s) => seenSlugs.current.add(s));
        return merged;
      });

      if (prefetchNext) void Promise.all(slugs.map((s) => fetchPost(s)));
    } catch {
      /* ignore */
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [batchSize, getNextSlugs, initialPost.slug, prefetchNext]);

  useEffect(() => { void enqueueNextBatch(); }, [enqueueNextBatch]);

  // ---- sentinel
  useEffect(() => {
    const sentinel = document.getElementById("article-sentinel");
    if (!sentinel) return;

    const io = new IntersectionObserver(async (entries) => {
      if (doneRef.current || articles.length >= maxArticles) return;

      for (const e of entries) {
        if (!e.isIntersecting) continue;

        if (queue.length === 0) {
          await enqueueNextBatch();
          continue;
        }

        if (!loadingRef.current && articles.length < maxArticles) {
          loadingRef.current = true;
          setLoading(true);
          try {
            const nextSlug = queue[0];
            const post = await fetchPost(nextSlug);
            setQueue((prev) => prev.slice(1));
            if (post && !seenSlugs.current.has(post.slug)) {
              setArticles((prev) => [...prev, post]);
              seenSlugs.current.add(post.slug);
            }
          } finally {
            loadingRef.current = false;
            setLoading(false);
          }
        }
      }
    }, { rootMargin: sentinelRootMargin });

    io.observe(sentinel);
    return () => io.disconnect();
  }, [queue, articles.length, enqueueNextBatch, maxArticles, sentinelRootMargin]);

  // ---- URL update
  useEffect(() => {
    if (!changeUrl) return;
    const observers: IntersectionObserver[] = [];
    itemRefs.current = itemRefs.current.slice(0, articles.length);

    articles.forEach((_, idx) => {
      const target = itemRefs.current[idx];
      if (!target) return;

      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((en) => {
            if (en.isIntersecting && en.intersectionRatio > itemThreshold) {
              const slug = articles[idx]?.slug;
              if (!slug) return;
              const href = `${urlPrefix}/${encodeURIComponent(slug)}`.replace(/\/\//g, "/");
              window.history.replaceState({}, "", href);
            }
          });
        },
        { threshold: [itemThreshold] }
      );

      io.observe(target);
      observers.push(io);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, [articles, changeUrl, urlPrefix, itemThreshold]);

  return (
    <div style={{ display: "grid", gap: 32 }}>
      {articles.map((p, i) => {
        const catList = csvToList(p.category);
        const tags = csvToList(p.tags);
        const absUrl =
          typeof window !== "undefined"
            ? `${window.location.origin}${urlPrefix ? `/${urlPrefix.replace(/^\//, "")}` : ""}/${encodeURIComponent(p.slug)}`
            : `/${encodeURIComponent(p.slug)}`;

        return (
          <article
            key={p.id}
            ref={setItemRef(i)}
            style={{ scrollMarginTop: "80px", paddingBottom: 16, borderBottom: "1px solid var(--border,#333)" }}
          >
            {/* 🟨 Ad: before title */}
            <AdSlot id={`before-title-${i}`} enabled={ads.beforeTitle} />

            {/* ---------- Title ---------- */}
            <h1 style={{ margin: "0 0 8px" }}>{p.title}</h1>

            {/* ---------- Meta + Share ---------- */}
            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                {/* author avatar + name */}
                {p.author?.avatarUrl ? (
                  <Image
                    src={p.author.avatarUrl}
                    alt={p.author?.name || "Author"}
                    width={28}
                    height={28}
                    unoptimized
                    style={{ borderRadius: "50%", objectFit: "cover" }}
                  />
                ) : (
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "#2a2f3a",
                      display: "inline-block",
                    }}
                    aria-hidden
                  />
                )}

                {p.author?.slug ? (
                  <Link href={`/author/${encodeURIComponent(p.author.slug)}`} style={{ fontWeight: 600 }}>
                    {p.author?.name || "Author"}
                  </Link>
                ) : (
                  <span style={{ fontWeight: 600 }}>{p.author?.name || "Author"}</span>
                )}

                {/* categories */}
                {!!catList.length && (
                  <span style={{ display: "flex", gap: 6, flexWrap: "wrap", marginLeft: 6 }}>
                    {catList.map((c) => (
                      <Link
                        key={c}
                        href={`/category/${toSlug(c)}`}
                        style={{
                          fontSize: 12,
                          padding: "2px 6px",
                          borderRadius: 6,
                          background: "var(--chip-bg,#18202b)",
                          border: "1px solid var(--border,#2f3b4a)",
                        }}
                      >
                        {c}
                      </Link>
                    ))}
                  </span>
                )}

                {/* BD 12h time */}
                <time dateTime={p.date} className="dim" style={{ fontSize: 12 }}>
                  {formatBD12h(p.date)}
                </time>
              </div>

              <ShareIcons title={p.title} absUrl={absUrl} />
            </div>

            {/* 🟨 Ad: before image */}
            <AdSlot id={`before-image-${i}`} enabled={ads.beforeImage} />

            {/* ---------- Featured image ---------- */}
            {p.image?.src && (
              <>
                <figure style={{ margin: "12px 0" }}>
                  <Image
                    src={p.image.src}
                    alt={p.image.alt || p.title}
                    width={900}
                    height={506}
                    unoptimized
                    style={{ width: "100%", height: "auto", borderRadius: 12 }}
                  />
                </figure>

                {/* 🟨 Ad: after image */}
                <AdSlot id={`after-image-${i}`} enabled={ads.afterImage} />
              </>
            )}

            {/* 🟨 Ad: before body */}
            <AdSlot id={`before-body-${i}`} enabled={ads.beforeBody} />

            {/* ---------- Body ---------- */}
            <div className="post-body" dangerouslySetInnerHTML={{ __html: p.contentHtml || "" }} />

            {/* 🟨 Ad: after body */}
            <AdSlot id={`after-body-${i}`} enabled={ads.afterBody} />

            {/* ---------- Tags ---------- */}
            {!!tags.length && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                {tags.map((t) => (
                  <Link
                    key={t}
                    href={`/tags/${toSlug(t)}`}
                    style={{
                      fontSize: 12,
                      padding: "2px 8px",
                      borderRadius: 999,
                      border: "1px solid var(--border,#2f3b4a)",
                      background: "var(--chip-bg,#151a22)",
                    }}
                  >
                    #{t}
                  </Link>
                ))}
              </div>
            )}

            {/* 🟨 Ad: after tags */}
            <AdSlot id={`after-tags-${i}`} enabled={ads.afterTags} />
          </article>
        );
      })}

      {/* sentinel */}
      {articles.length < maxArticles && !noMore && <div id="article-sentinel" style={{ height: 1 }} />}

      {loading && <div className="dim" style={{ padding: 8 }}>Loading…</div>}
      {noMore && <div className="dim" style={{ padding: 8 }}>No more articles.</div>}
    </div>
  );
}
