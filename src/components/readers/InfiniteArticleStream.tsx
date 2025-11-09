// src/components/reader/InfiniteArticleStream.tsx

"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./InfiniteArticleStream.module.css";

// -------- Types --------
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

// -------- Helpers --------
function toSlug(s: string) {
  return s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");
}
function getAbsoluteUrl(slug: string) {
  // for SSR (server), must use absolute URL, for browser, can use relative
  if (typeof window === "undefined") {
    const base = process.env.NEXT_PUBLIC_SITE_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    return `${base}/api/r2/post/${encodeURIComponent(slug)}`;
  }
  return `/api/r2/post/${encodeURIComponent(slug)}`;
}
async function fetchPost(slug: string): Promise<Post | null> {
  const url = getAbsoluteUrl(slug);
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) return null;
  const j = await r.json();
  return j?.post as Post;
}
async function fetchStream(startSlug: string, offset: number, limit: number): Promise<string[]> {
  const qs = new URLSearchParams({ startSlug, offset: String(offset), limit: String(limit) });
  const r = await fetch(`/api/r2/stream?${qs.toString()}`, { cache: "no-store" });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error || "Stream failed");
  return (j.items as StreamItem[]).map((x) => x.slug).filter(Boolean);
}

// -------- Component --------
export default function InfiniteArticleStream({
  initialPost,
  batchSize = 2,
  maxArticles = 12,
  changeUrl = true,
  urlPrefix = "",
}: {
  initialPost: Post;
  batchSize?: number;
  maxArticles?: number;
  changeUrl?: boolean;
  urlPrefix?: string;
}) {
  const [articles, setArticles] = useState<Post[]>([initialPost]);
  const [queue, setQueue] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [noMore, setNoMore] = useState(false);

  const offsetRef = useRef(1);
  const loadingRef = useRef(false);
  const doneRef = useRef(false);
  const seenSlugs = useRef<Set<string>>(new Set([initialPost.slug]));
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const setItemRef = useCallback((idx: number) => (el: HTMLDivElement | null) => {
    itemRefs.current[idx] = el;
  }, []);

  // Load next slugs
  const enqueueNextBatch = useCallback(async () => {
    if (doneRef.current || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const slugs = (await fetchStream(initialPost.slug, offsetRef.current, batchSize)).filter(
        (s) => s && !seenSlugs.current.has(s)
      );
      offsetRef.current += batchSize;
      if (!slugs.length) {
        doneRef.current = true;
        setNoMore(true);
        return;
      }
      setQueue((prev) => {
        const merged = [...prev, ...slugs.filter((s) => !prev.includes(s))];
        merged.forEach((s) => seenSlugs.current.add(s));
        return merged;
      });
    } catch {
      /* ignore */
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [batchSize, initialPost.slug]);

  useEffect(() => { void enqueueNextBatch(); }, [enqueueNextBatch]);

  // Infinite scroll sentinel
  useEffect(() => {
    if (doneRef.current || articles.length >= maxArticles) return;
    const sentinel = document.getElementById("article-sentinel");
    if (!sentinel) return;
    const io = new window.IntersectionObserver(async (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        if (!queue.length && !noMore) {
          await enqueueNextBatch();
          continue;
        }
        if (queue.length && articles.length < maxArticles) {
          setLoading(true);
          const nextSlug = queue[0];
          const post = await fetchPost(nextSlug);
          setQueue((prev) => prev.slice(1));
          if (post && !seenSlugs.current.has(post.slug)) {
            setArticles((prev) => [...prev, post]);
            seenSlugs.current.add(post.slug);
          }
          setLoading(false);
        }
      }
    }, { rootMargin: "400px 0px" });
    io.observe(sentinel);
    return () => io.disconnect();
  }, [queue, articles.length, enqueueNextBatch, maxArticles, noMore]);

  // Change URL on visible article
  useEffect(() => {
    if (!changeUrl) return;
    const observers: IntersectionObserver[] = [];
    itemRefs.current = itemRefs.current.slice(0, articles.length);
    articles.forEach((_, idx) => {
      const target = itemRefs.current[idx];
      if (!target) return;
      const io = new window.IntersectionObserver(
        (entries) => {
          entries.forEach((en) => {
            if (en.isIntersecting && en.intersectionRatio > 0.6) {
              const slug = articles[idx]?.slug;
              if (!slug) return;
              const href = `${urlPrefix}/${encodeURIComponent(slug)}`.replace(/\/\//g, "/");
              window.history.replaceState({}, "", href);
            }
          });
        },
        { threshold: [0.6] }
      );
      io.observe(target);
      observers.push(io);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, [articles, changeUrl, urlPrefix]);

  // --- Render: Responsive, all links!
  return (
    <div className={styles["articleStream"]}>
      {articles.map((p, i) => (
        <article key={p.id} ref={setItemRef(i)} className={styles["articleCard"]}>
          {/* Title */}
          <h1 className={styles["articleTitle"]}>{p.title}</h1>
          <div className={styles["metaRow"]}>
            {p.author?.avatarUrl && (
              <img src={p.author.avatarUrl} alt={p.author.name || "Author"} className={styles["avatar"]} />
            )}
            {p.author?.slug ? (
              <Link href={`/author/${encodeURIComponent(p.author.slug)}`} className={styles["author"]}>
                {p.author?.name}
              </Link>
            ) : (
              <span className={styles["author"]}>{p.author?.name}</span>
            )}
            <span className={styles["date"]}>{new Date(p.date).toLocaleString("en-BD", { timeZone: "Asia/Dhaka" })}</span>
          </div>
          {/* Category links */}
          {p.category && (
            <div className={styles["catRow"]}>
              {String(p.category)
                .split(",")
                .map((cat) => (
                  <Link className={styles["cat"]} key={cat.trim()} href={`/category/${toSlug(cat)}`}>
                    {cat.trim()}
                  </Link>
                ))}
            </div>
          )}
          {p.image?.src && (
            <img src={p.image.src} alt={p.image.alt || p.title} className={styles["featured"]} />
          )}
          <div className={styles["body"]} dangerouslySetInnerHTML={{ __html: p.contentHtml || "" }} />
          {/* Tag links */}
          {p.tags && (
            <div className={styles["tagRow"]}>
              {String(p.tags)
                .split(",")
                .map(tag => (
                  <Link className={styles["tag"]} href={`/tags/${toSlug(tag)}`} key={tag.trim()}>
                    {tag.trim() && `#${tag.trim()}`}
                  </Link>
                ))}
            </div>
          )}
        </article>
      ))}
      {articles.length < maxArticles && !noMore && <div id="article-sentinel" className={styles["sentinel"]} />}
      {loading && <div className={styles["loading"]}>Loading…</div>}
      {noMore && <div className={styles["noMore"]}>No more articles.</div>}
    </div>
  );
}
