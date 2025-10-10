// src/app/api/r2/stream/route.ts
import { NextResponse } from "next/server";
import { query } from "@/db/mysql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/r2/stream?startSlug=<slug>&limit=10&offset=0
 * - publish পোস্টগুলোকে post_date desc অর্ডারে রিটার্ন করে
 * - startSlug দিলে ওই পোস্টের তারিখ ধরে "তার পরে যেগুলো" (older) রিটার্ন করে
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const startSlug = (url.searchParams.get("startSlug") || "").trim();
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 10), 1), 50);
    const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);

    // current post date বের করি (না দিলে এখনকার সময় ধরে)
    let startDate = null as string | null;
    if (startSlug) {
      const r = await query<{ post_date: string }>(
        `SELECT post_date FROM wp_posts WHERE post_type='post' AND post_status='publish' AND post_name=? LIMIT 1`,
        [startSlug]
      );
      startDate = r[0]?.post_date || null;
    }

    // older posts (startDate থাকলে <=, না থাকলে সব), newest->oldest
    const rows = await query<{ slug: string; id: number; title: string; date: string }>(
      `
      SELECT p.post_name AS slug, p.ID AS id, p.post_title AS title, p.post_date AS date
      FROM wp_posts p
      WHERE p.post_type='post'
        AND p.post_status='publish'
        ${startDate ? `AND p.post_date <= ?` : ``}
      ORDER BY p.post_date DESC, p.ID DESC
      LIMIT ?, ?
      `,
      startDate ? [startDate, offset, limit] : [offset, limit]
    );

    // null slug বাদ
    const items = rows.filter(r => !!r.slug).map(r => ({
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
