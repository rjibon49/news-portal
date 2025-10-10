// src/app/api/r2/search/route.ts
// Search API: posts + (optional) author match by slug/name/username/email

import { NextResponse } from "next/server";
import { query } from "@/db/mysql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UserRow = {
  ID: number;
  user_login: string;
  user_nicename: string;
  display_name: string;
  user_email: string | null;
  avatar_meta?: string | null;
};

type PostRow = {
  ID: number;
  post_title: string;
  post_name: string | null;
  post_date: string;
  post_excerpt: string | null;
  post_content: string | null;
  post_status: string;
  author_name: string | null;
  thumbnail_id: string | null;
};

function likeQ(q: string) {
  return `%${q.replace(/[%_]/g, "\\$&")}%`;
}

function absOrSame(url?: string | null) {
  if (!url) return null;
  const s = String(url).trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/")) return s; // site-relative (Next/Image OK)
  return s;
}

export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const qRaw = (sp.get("q") || "").trim();
    const page = Math.max(1, Number(sp.get("page") || 1));
    const perPage = Math.min(50, Math.max(1, Number(sp.get("perPage") || 12)));

    if (!qRaw) {
      return NextResponse.json(
        { authors: null, posts: { rows: [], total: 0, page, perPage } },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const qLike = likeQ(qRaw.toLowerCase());

    // -------- Author (single best match) ----------
    const users = await query<UserRow>(
      `
      SELECT u.ID, u.user_login, u.user_nicename, u.display_name, u.user_email,
             (SELECT meta_value FROM wp_usermeta
               WHERE user_id=u.ID AND meta_key IN ('avatar_url','profile_image','avatar','wp_user_avatar','simple_local_avatar')
               ORDER BY FIELD(meta_key,'avatar_url','profile_image','avatar','wp_user_avatar','simple_local_avatar')
               LIMIT 1) as avatar_meta
      FROM wp_users u
      WHERE LOWER(u.user_nicename) = ?
         OR LOWER(u.display_name) = ?
         OR LOWER(u.user_login) = ?
         OR LOWER(u.user_email) = ?
         OR LOWER(u.display_name) LIKE ?
      LIMIT 1
      `,
      [qRaw.toLowerCase(), qRaw.toLowerCase(), qRaw.toLowerCase(), qRaw.toLowerCase(), qLike]
    );

    const author = users[0]
      ? {
          id: users[0].ID,
          username: users[0].user_login,
          slug: users[0].user_nicename,
          name: users[0].display_name,
          email: users[0].user_email,
          avatarUrl: absOrSame(users[0].avatar_meta),
        }
      : null;

    // -------- Posts (title/excerpt/content match) ----------
    const offset = (page - 1) * perPage;

    const totalRows = await query<{ c: number }>(
      `
      SELECT COUNT(*) as c
      FROM wp_posts p
      WHERE p.post_type='post' AND p.post_status='publish'
        AND (
          LOWER(p.post_title) LIKE ? OR
          LOWER(p.post_excerpt) LIKE ? OR
          LOWER(p.post_content) LIKE ?
        )
      `,
      [qLike, qLike, qLike]
    );
    const total = totalRows[0]?.c || 0;

    const rows = await query<PostRow>(
      `
      SELECT p.ID, p.post_title, p.post_name, p.post_date,
             p.post_excerpt, p.post_content, p.post_status,
             u.display_name AS author_name,
             (SELECT pm.meta_value FROM wp_postmeta pm
               WHERE pm.post_id=p.ID AND pm.meta_key='_thumbnail_id' LIMIT 1) AS thumbnail_id
      FROM wp_posts p
      LEFT JOIN wp_users u ON u.ID=p.post_author
      WHERE p.post_type='post' AND p.post_status='publish'
        AND (
          LOWER(p.post_title) LIKE ? OR
          LOWER(p.post_excerpt) LIKE ? OR
          LOWER(p.post_content) LIKE ?
        )
      ORDER BY p.post_date DESC
      LIMIT ? OFFSET ?
      `,
      [qLike, qLike, qLike, perPage, offset]
    );

    // Resolve featured image URLs (best-effort)
    const postIdsWithThumb = rows
      .map(r => Number(r.thumbnail_id))
      .filter(n => Number.isFinite(n) && n > 0);
    let attMap = new Map<number, string>();
    if (postIdsWithThumb.length) {
      const placeholders = postIdsWithThumb.map(() => "?").join(",");
      const atts = await query<{ ID: number; guid: string }>(
        `SELECT ID, guid FROM wp_posts WHERE ID IN (${placeholders})`,
        postIdsWithThumb
      );
      attMap = new Map(atts.map(a => [a.ID, a.guid]));
    }

    const posts = rows.map(r => ({
      id: r.ID,
      title: r.post_title,
      slug: r.post_name || String(r.ID),
      date: r.post_date,
      excerpt: r.post_excerpt || "",
      authorName: r.author_name || "",
      imageUrl: attMap.get(Number(r.thumbnail_id)) || null,
    }));

    return NextResponse.json(
      { author, posts: { rows: posts, total, page, perPage } },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Search failed" },
      { status: 400 }
    );
  }
}
