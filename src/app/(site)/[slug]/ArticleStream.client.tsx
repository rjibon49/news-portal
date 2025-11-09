// src/app/(site)/[slug]/ArticleStream.client.tsx

"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./post.module.css";
import AdSlot from "./AdSlot.client";

/* ---------- types ---------- */
type Article = {
  id: number;
  slug: string;
  title: string;
  excerpt?: string | null;
  contentHtml?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
  imageUrl?: string | null;
  authorId?: number | null;
  authorName?: string | null;
  authorSlug?: string | null;
  authorAvatarUrl?: string | null;
  audioUrl?: string | null; // 🔊 NEW
  categories?: Array<{ id?: number; slug: string; name: string }>;
  tags?: Array<{ id?: number; slug: string; name: string }>;
};
type Props = { first: any; siteUrl: string; maxCount?: number };

/* ---------- helpers ---------- */
function slugify(s: string) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
function parseListCSV(csv?: string | null) {
  if (!csv) return [] as Array<{ slug: string; name: string }>;
  return csv.split(",").map(x => x.trim()).filter(Boolean).map(name => ({ slug: slugify(name), name }));
}
function normalizeRichText(raw: string): string {
  if (!raw) return "";
  const hasHtml = /<\s*(p|br|ul|ol|li|h[1-6]|blockquote|table|img|figure)\b/i.test(raw);
  if (hasHtml) return raw;
  const parts = raw.trim().split(/\n{2,}/);
  if (parts.length > 1) return parts.map(s => `<p>${s.replace(/\n/g, "<br/>")}</p>`).join("");
  return raw.replace(/\n/g, "<br/>");
}
function splitHtmlAfterParagraph(html: string, n: number): [string, string] {
  if (!html || n <= 0) return [html, ""];
  const re = /<\/\s*p\s*>/ig;
  let count = 0, idx = -1, m: RegExpExecArray | null;
  while ((m = re.exec(html))) { count++; if (count === n) { idx = m.index + m[0].length; break; } }
  if (idx === -1) return [html, ""];
  return [html.slice(0, idx), html.slice(idx)];
}
function pick<T>(o: any, keys: string[]): T | undefined {
  for (const k of keys) if (o?.[k] != null) return o[k];
  return undefined;
}
function normalize(p: any): Article {
  // try to map several common server shapes
  const img = pick<string>(p, ["imageUrl", "image_url", "image?.src", "image?.url"]) as any;
  const audio =
    pick<string>(p, ["audioUrl", "audio_url"]) ??
    pick<string>(p?.audio || {}, ["url", "src"]);
  return {
    id: p?.id, slug: p?.slug, title: p?.title,
    excerpt: p?.excerpt ?? null, contentHtml: p?.contentHtml ?? p?.content ?? null,
    publishedAt: p?.date ?? p?.publishedAt ?? null,
    updatedAt: p?.updatedAt ?? null,
    imageUrl: p?.image?.src ?? p?.image?.url ?? img ?? null,
    audioUrl: audio ?? null, // 🔊
    authorId: p?.author?.id ?? p?.authorId ?? null,
    authorName: p?.author?.name ?? p?.authorName ?? null,
    authorSlug: p?.author?.slug ?? p?.authorSlug ?? null,
    authorAvatarUrl: p?.author?.avatarUrl ?? p?.author?.avatar ?? null,
    categories: Array.isArray(p?.categories) ? p.categories : parseListCSV(p?.category),
    tags: Array.isArray(p?.tags) ? p.tags : parseListCSV(p?.tags),
  };
}

/* ---------- data ---------- */
async function fetchStream(slug: string, offset: number, limit: number): Promise<string[]> {
  const qs = new URLSearchParams({ startSlug: slug, offset: String(offset), limit: String(limit) });
  const r = await fetch(`/api/r2/stream?${qs.toString()}`, { cache: "no-store" });
  const j = await r.json();
  return (j.items || []).map((x: any) => x.slug).filter(Boolean);
}
async function fetchPost(slug: string): Promise<Article | null> {
  const r = await fetch(`/api/r2/post/${encodeURIComponent(slug)}`, { cache: "no-store" });
  if (!r.ok) return null;
  const j = await r.json().catch(() => ({}));
  return j?.post ? normalize(j.post) : null;
}
// 🔊 fetch audio (if not embedded in post payload)
async function fetchAudioUrl(slug: string): Promise<string | null> {
  try {
    const r = await fetch(`/api/r2/tts/of?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
    if (!r.ok) return null;
    const j = await r.json().catch(() => ({}));
    const url = j?.url ?? j?.audio?.url ?? j?.audioUrl ?? null;
    return typeof url === "string" && url ? url : null;
  } catch { return null; }
}

/* ---------- small child: lazy audio block ---------- */
function AudioBlock({ slug, initialUrl }: { slug: string; initialUrl?: string | null }) {
  const [url, setUrl] = useState<string | null>(initialUrl ?? null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (url) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      const u = await fetchAudioUrl(slug);
      if (mounted && u) setUrl(u);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [slug, url]);

  if (!url && !loading) return null;

  return (
    <div
      aria-label="Listen to this article"
      style={{
        margin: "10px 0 18px",
        padding: "12px",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        background: "#fafafa",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontWeight: 700 }}>Listen</span>
        {loading && <span style={{ fontSize: 12, color: "#6b7280" }}>(loading…)</span>}
      </div>
      {url ? (
        <audio controls preload="none" src={url} style={{ width: "100%" }}>
          Your browser does not support the audio element.
        </audio>
      ) : null}
    </div>
  );
}

/* ---------- component ---------- */
export default function ArticleStream({ first, siteUrl, maxCount = 3 }: Props) {
  const [items, setItems] = useState<Article[]>([normalize(first)]);
  const [queue, setQueue] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const refs = useRef<Record<number, HTMLElement | null>>({});
  const setNodeRef = useCallback((id: number) => (el: HTMLElement | null) => { refs.current[id] = el; }, []);
  const activeSlugRef = useRef<string>(items[0]?.slug || "");
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const batchSize = 2;

  const enqueueMore = useCallback(async () => {
    if (loading || done || items.length >= maxCount) return;
    setLoading(true);
    try {
      const slugs = await fetchStream(items[items.length - 1].slug, 0, batchSize);
      setQueue(prev => [...prev, ...slugs.filter(s => !items.some(i => i.slug === s) && !prev.includes(s))]);
      if (!slugs.length) setDone(true);
    } finally { setLoading(false); }
  }, [loading, done, items, maxCount]);

  useEffect(() => {
    if (!queue.length || loading || done) return;
    (async () => {
      setLoading(true);
      const nextSlug = queue[0];
      const post = await fetchPost(nextSlug);
      setQueue(prev => prev.slice(1));
      if (post && !items.some(i => i.slug === post.slug)) setItems(prev => [...prev, post]);
      else if (!post) setDone(true);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, loading, done]);

  useEffect(() => {
    const el = sentinelRef.current; if (!el) return;
    const io = new window.IntersectionObserver(
      ents => ents.forEach(e => e.isIntersecting && enqueueMore()),
      { rootMargin: "600px 0px" }
    );
    io.observe(el); return () => io.disconnect();
  }, [enqueueMore]);

  // URL auto-update on scroll
  useEffect(() => {
    const els = items.map(i => refs.current[i.id]).filter((n): n is HTMLElement => !!n);
    const onHit = (entries: IntersectionObserverEntry[]) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const slug = (entry.target as HTMLElement).dataset.slug || "";
        if (slug && activeSlugRef.current !== slug) {
          activeSlugRef.current = slug;
          const newUrl = `/${slug}`;
          if (window.location.pathname !== newUrl) window.history.replaceState(null, "", newUrl);
        }
      });
    };
    const io = new IntersectionObserver(onHit, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });
    els.forEach(el => io.observe(el)); return () => io.disconnect();
  }, [items]);

  return (
    <>
      {items.map((post, idx) => {
        const fullHtml = normalizeRichText(post.contentHtml || "");
        const [headHtml, tailHtml] = splitHtmlAfterParagraph(fullHtml, 2);

        return (
          <article
            data-article-id={post.id}
            data-slug={post.slug}
            ref={setNodeRef(post.id)}
            key={post.id}
            className={styles.article}
          >
            {/* beforeTitle ad */}
            <AdSlot slotKey="beforeTitle" />

            <h1 className={styles.title}>{post.title}</h1>

            <div className={styles.meta}>
              <div className={styles.metaLeft}>
                {post.authorName && (
                  <Link href={`/author/${post.authorSlug || ""}`} className={styles.author}>
                    {post.authorAvatarUrl && (
                      <Image className={styles.authorAvatar} src={post.authorAvatarUrl} alt={post.authorName || "Author"} width={28} height={28} unoptimized />
                    )}
                    <span className={styles.authorName}>{post.authorName}</span>
                  </Link>
                )}
                {post.publishedAt && (
                  <span className={styles.dateWrap}>
                    <time className={styles.date} dateTime={post.publishedAt}>
                      {new Date(post.publishedAt).toLocaleDateString()}
                    </time>
                  </span>
                )}
              </div>

              {!!post.categories?.length && (
                <div className={styles.cats}>
                  {post.categories.map(cat => (
                    <Link href={`/category/${cat.slug}`} key={cat.slug} className={styles.cat}>
                      {cat.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* beforeImage ad */}
            <AdSlot slotKey="beforeImage" />

            {/* Feature image */}
            {post.imageUrl && (
              <Image
                className={styles.featureImg}
                src={post.imageUrl}
                alt={post.title || "feature"}
                width={1600} height={900}
                sizes="(max-width: 900px) 98vw, 720px"
                priority={idx === 0}
                style={{ width: "100%", height: "auto" }}
                unoptimized
              />
            )}

            {/* 🔊 Audio block just under the feature image */}
            <AudioBlock slug={post.slug} initialUrl={post.audioUrl ?? null} />

            {/* afterImage ad */}
            <AdSlot slotKey="afterImage" />

            {/* Content + inline ad after 2nd paragraph */}
            <div className={styles.content} dangerouslySetInnerHTML={{ __html: headHtml }} />
            {tailHtml && <AdSlot slotKey="article_inline_1" />}
            {tailHtml && <div className={styles.content} dangerouslySetInnerHTML={{ __html: tailHtml }} />}

            {/* Bottom ad */}
            <AdSlot slotKey="afterBody" />

            {!!post.tags?.length && (
              <div className={styles.tags}>
                {post.tags.map(tag => (
                  <Link href={`/tag/${tag.slug}`} key={tag.slug} className={styles.tag}>#{tag.name}</Link>
                ))}
              </div>
            )}
            {/* Bottom ad */}
            <AdSlot slotKey="afterTags" />
          </article>
        );
      })}

      {!done && <div ref={sentinelRef} style={{ height: 1 }} />}
      {loading && <p className={styles.loadBadge}>Loading…</p>}
    </>
  );
}
