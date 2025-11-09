// -----------------------------------------------------------------------------
// FILE: src/app/api/r2/post/[slug]/route.ts
// Single post (by slug) + extras + author slug/avatar + AUDIO (from wp_post_extra)
// - Exact match on wp_posts.post_name; fallback by title→slug
// - Includes featured image url, extras from wp_post_extra
// - Adds author { id, name, slug, avatarUrl } with robust fallbacks
// - Adds audio: { status, url, lang, chars, duration_sec, updatedAt }
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { query } from "@/db/mysql";
import { createHash } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ---------- utils ---------- */
function md5(s: string) {
  return createHash("md5").update(s).digest("hex");
}

/** Pull a plausible URL out of a meta value (raw string / JSON-ish / serialized). */
function extractUrlFromMeta(v: string | null | undefined): string | undefined {
  if (!v) return undefined;
  const trimmed = String(v).trim();

  // JSON shapes
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const j = JSON.parse(trimmed);
      if (typeof j === "string" && /^https?:\/\//i.test(j)) return j;
      if (j && typeof j === "object") {
        if (typeof (j as any).full === "string") return (j as any).full;
        if (typeof (j as any).url === "string") return (j as any).url;
        if (typeof (j as any)["96"] === "string") return (j as any)["96"];
        for (const val of Object.values(j as any)) {
          if (typeof val === "string" && /^https?:\/\//i.test(val)) return val;
        }
      }
    } catch {
      /* ignore and fall through */
    }
  }

  // First http(s) occurrence in a string
  const m = trimmed.match(/https?:\/\/[^\s'"]+/i);
  if (m) return m[0];

  // Site-relative path
  if (trimmed.startsWith("/")) return trimmed;

  return undefined;
}

/* ---------- DB Row ---------- */
type Row = {
  ID: number;
  post_title: string;
  post_name: string | null;
  post_date: string;
  post_modified: string;
  post_status: string;
  post_author: number;
  post_excerpt: string | null;
  post_content: string | null;

  author_name: string | null;
  author_slug: string | null;
  author_email: string | null;        // ← used for gravatar fallback
  author_avatar_meta: string | null;  // ← raw value from usermeta

  thumbnail_id: string | null;
  categories: string | null;
  tags: string | null;

  extra_subtitle: string | null;
  extra_highlight: string | null;
  extra_format: "standard" | "gallery" | "video" | null;
  extra_gallery_json: string | null;
  extra_video_embed: string | null;

  // AUDIO (from wp_post_extra)
  audio_status: "none" | "queued" | "ready" | "error" | null;
  audio_url: string | null;
  audio_lang: string | null;
  audio_chars: number | null;
  audio_duration_sec: number | null;
  audio_updated_at: string | null;
};

/* ---------- Queries ---------- */
function baseSelect(where: string, param: any) {
  return query<Row>(
    `
    SELECT
      p.ID,
      p.post_title,
      p.post_name,
      p.post_date,
      p.post_modified,
      p.post_status,
      p.post_author,
      p.post_excerpt,
      p.post_content,

      /* author basics */
      u.display_name AS author_name,
      u.user_nicename AS author_slug,
      u.user_email AS author_email,

      /* author avatar from usermeta (prefer explicit keys) */
      (
        SELECT um.meta_value
          FROM wp_usermeta um
         WHERE um.user_id = p.post_author
           AND um.meta_key IN ('avatar_url','profile_image','avatar','wp_user_avatar','simple_local_avatar')
         ORDER BY FIELD(um.meta_key,'avatar_url','profile_image','avatar','wp_user_avatar','simple_local_avatar')
         LIMIT 1
      ) AS author_avatar_meta,

      /* featured image id */
      (SELECT pm.meta_value
         FROM wp_postmeta pm
        WHERE pm.post_id = p.ID AND pm.meta_key = '_thumbnail_id'
        LIMIT 1) AS thumbnail_id,

      /* extras */
      ex.subtitle     AS extra_subtitle,
      ex.highlight    AS extra_highlight,
      ex.format       AS extra_format,
      ex.gallery_json AS extra_gallery_json,
      ex.video_embed  AS extra_video_embed,

      /* AUDIO fields */
      ex.audio_status        AS audio_status,
      ex.audio_url           AS audio_url,
      ex.audio_lang          AS audio_lang,
      ex.audio_chars         AS audio_chars,
      ex.audio_duration_sec  AS audio_duration_sec,
      ex.audio_updated_at    AS audio_updated_at,

      /* category names */
      GROUP_CONCAT(DISTINCT CASE WHEN tt.taxonomy='category' THEN t.name END ORDER BY t.name SEPARATOR ', ') AS categories,
      /* tag names */
      GROUP_CONCAT(DISTINCT CASE WHEN tt.taxonomy='post_tag' THEN t.name END ORDER BY t.name SEPARATOR ', ') AS tags

    FROM wp_posts p
    LEFT JOIN wp_users u ON u.ID = p.post_author
    LEFT JOIN wp_term_relationships tr ON tr.object_id = p.ID
    LEFT JOIN wp_term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
    LEFT JOIN wp_terms t ON t.term_id = tt.term_id
    LEFT JOIN wp_post_extra ex ON ex.post_id = p.ID
    WHERE p.post_type = 'post'
      AND p.post_status = 'publish'
      AND ${where}
    GROUP BY p.ID
    LIMIT 1
    `,
    [param]
  );
}

async function fetchPostByPostName(slug: string) {
  return baseSelect(`p.post_name = ?`, slug);
}

async function fetchPostByTitleSlug(slug: string) {
  // fallback: lower(title with spaces -> dashes)
  return baseSelect(`LOWER(REPLACE(p.post_title, ' ', '-')) = ?`, slug.toLowerCase());
}

/* ---------- Handler ---------- */
export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug: raw } = await context.params;
    const slug = decodeURIComponent(raw || "").trim();
    if (!slug) {
      return NextResponse.json({ error: "Missing slug" }, { status: 400 });
    }

    // 1) Try by post_name
    let rows = await fetchPostByPostName(slug);

    // 2) Fallback by title->slug
    if (rows.length === 0) {
      rows = await fetchPostByTitleSlug(slug);
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const row = rows[0];

    /* ----- Featured image URL ----- */
    let imageUrl: string | undefined;
    if (row.thumbnail_id) {
      try {
        const att = await query<{ guid: string }>(
          `SELECT guid FROM wp_posts WHERE ID = ? AND post_type = 'attachment' LIMIT 1`,
          [Number(row.thumbnail_id)]
        );
        imageUrl = att[0]?.guid;
      } catch {
        /* ignore */
      }
    }

    /* ----- Parse gallery JSON (if present) ----- */
    let gallery: Array<number | { id: number; url?: string }> | null = null;
    if (row.extra_gallery_json) {
      try {
        const g = JSON.parse(row.extra_gallery_json);
        gallery = Array.isArray(g) ? g : null;
      } catch {
        gallery = null;
      }
    }

    /* ----- Author slug + avatar resolve ----- */
    const authorSlug =
      (row.author_slug || "").trim() ||
      (row.author_name ? row.author_name.toLowerCase().replace(/\s+/g, "-") : "") ||
      undefined;

    let avatarUrl =
      extractUrlFromMeta(row.author_avatar_meta) || undefined;

    // Gravatar fallback (only if we don't already have an explicit avatar)
    if (!avatarUrl && row.author_email) {
      const hash = md5(row.author_email.trim().toLowerCase());
      avatarUrl = `https://www.gravatar.com/avatar/${hash}?s=128&d=identicon`;
    }

    /* ----- Audio payload (from wp_post_extra) ----- */
    const audio =
      row.audio_status || row.audio_url || row.audio_lang || row.audio_duration_sec != null
        ? {
            status: (row.audio_status as Row["audio_status"]) ?? null,
            url: row.audio_url ?? null,
            lang: row.audio_lang ?? null,
            chars: row.audio_chars ?? null,
            duration_sec: row.audio_duration_sec ?? null,
            updatedAt: row.audio_updated_at ?? null,
          }
        : null;

    const post = {
      id: row.ID,
      slug: row.post_name || slug,
      title: row.post_title || "",
      excerpt: row.post_excerpt || "",
      contentHtml: row.post_content || "",
      date: row.post_date,
      updatedAt: row.post_modified,
      category: row.categories || null,

      author: row.author_name
        ? {
            id: row.post_author,
            name: row.author_name,
            slug: authorSlug,
            avatarUrl: avatarUrl || null,
          }
        : null,

      image: imageUrl ? { src: imageUrl, alt: row.post_title } : null,
      tags: row.tags || null,
      status: row.post_status,

      // extras
      subtitle: row.extra_subtitle || null,
      highlight: row.extra_highlight || null,
      format: (row.extra_format as "standard" | "gallery" | "video" | null) ?? "standard",
      gallery,
      videoEmbed: row.extra_video_embed || null,

      // NEW: audio block
      audio,
    };

    return NextResponse.json(
      { post },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
