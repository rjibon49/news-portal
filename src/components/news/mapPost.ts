import type { NewsItem } from "./types";

function safeParse<T>(s?: string | null): T | null {
  if (!s) return null;
  try { return JSON.parse(s) as T; } catch { return null; }
}

/** Map your /api/r2/posts rows to NewsItem[] */
export function mapPostsToNews(items: any[]): NewsItem[] {
  return (items ?? []).map((r) => ({
    id: r.ID ?? r.id,
    slug: r.slug ?? r.post_name ?? "",
    title: r.post_title ?? r.title ?? "",
    excerpt: r.post_excerpt ?? r.excerpt ?? "",
    imageUrl: r.thumbnail_url ?? r.image?.src ?? r.thumbnail?.src ?? r.imageUrl ?? undefined,
    categoryName: r.category ?? r.categories ?? undefined,
    publishedAt: r.post_date ?? r.date ?? undefined,
    /* format flags */
    isVideo: (r.extra_format ?? r.format) === "video",
    isGallery: (r.extra_format ?? r.format) === "gallery",

    /* extras */
    subtitle: r.extra_subtitle ?? r.subtitle ?? null,
    highlight: r.extra_highlight ?? r.highlight ?? null,
    format: r.extra_format ?? r.format ?? null,
    gallery: safeParse<Array<number | { id: number; url?: string }>>(r.extra_gallery_json) ?? null,
    videoEmbed: r.extra_video_embed ?? r.video_embed ?? null,
  }));
}

/** Map single /api/r2/post/[slug] to NewsItem */
export function mapPostToNews(r: any): NewsItem {
  return {
    id: r.id ?? r.ID,
    slug: r.slug ?? r.post_name ?? "",
    title: r.title ?? r.post_title ?? "",
    excerpt: r.excerpt ?? r.post_excerpt ?? "",
    imageUrl: r.image?.src ?? r.thumbnail_url ?? undefined,
    categoryName: r.category ?? undefined,
    publishedAt: r.date ?? r.post_date ?? undefined,
    isVideo: (r.format) === "video",
    isGallery: (r.format) === "gallery",

    subtitle: r.subtitle ?? null,
    highlight: r.highlight ?? null,
    format: r.format ?? null,
    gallery: Array.isArray(r.gallery) ? r.gallery : safeParse(r.gallery) ?? null,
    videoEmbed: r.videoEmbed ?? r.video_embed ?? null,
  };
}
