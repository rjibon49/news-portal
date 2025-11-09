// src/app/api/r2/stream/route.ts
import { NextResponse } from "next/server";
import { query } from "@/db/mysql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/r2/stream?startSlug=<slug>&limit=10&offset=0
 * Returns related posts from the *same category*, excluding the current.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const startSlug = (url.searchParams.get("startSlug") || "").trim();
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 10), 1), 50);
    const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);

    // Find all category IDs for the current post
    let categoryIds: number[] = [];
    if (startSlug) {
      const catRows = await query<{ term_id: number }>(
        `
        SELECT tt.term_id
        FROM wp_terms t
        JOIN wp_term_taxonomy tt ON tt.term_id = t.term_id AND tt.taxonomy='category'
        JOIN wp_term_relationships tr ON tr.term_taxonomy_id = tt.term_taxonomy_id
        JOIN wp_posts p ON p.ID = tr.object_id
        WHERE p.post_name = ? AND p.post_type='post' AND p.post_status='publish'
        `,
        [startSlug]
      );
      categoryIds = catRows.map(r => r.term_id);
    }

    let rows: { slug: string; id: number; title: string; date: string }[] = [];

    if (categoryIds.length > 0) {
      // Related articles: same category, published, not self
      rows = await query(
        `
        SELECT DISTINCT p.post_name AS slug, p.ID AS id, p.post_title AS title, p.post_date AS date
        FROM wp_posts p
        JOIN wp_term_relationships tr ON tr.object_id = p.ID
        JOIN wp_term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
        WHERE p.post_type='post'
          AND p.post_status='publish'
          AND p.post_name != ?
          AND tt.taxonomy = 'category'
          AND tt.term_id IN (${categoryIds.map(() => "?").join(",")})
        ORDER BY p.post_date DESC, p.ID DESC
        LIMIT ?, ?
        `,
        [startSlug, ...categoryIds, offset, limit]
      );
    } else {
      // Fallback for no category: just fetch latest published, excluding self
      rows = await query(
        `
        SELECT p.post_name AS slug, p.ID AS id, p.post_title AS title, p.post_date AS date
        FROM wp_posts p
        WHERE p.post_type='post'
          AND p.post_status='publish'
          AND p.post_name != ?
        ORDER BY p.post_date DESC, p.ID DESC
        LIMIT ?, ?
        `,
        [startSlug, offset, limit]
      );
    }

    const items = rows
      .filter(r => !!r.slug && !!r.id)
      .map(r => ({
        slug: r.slug,
        id: r.id,
        title: r.title,
        date: r.date,
      }));

    return NextResponse.json({ items, offset, limit });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 400 });
  }
}
