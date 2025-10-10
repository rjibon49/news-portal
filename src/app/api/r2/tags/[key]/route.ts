// src/app/api/r2/tags/[key]/route.ts

// -----------------------------------------------------------------------------
// Single Tag API (taxonomy = 'post_tag')  — unified key resolver
// GET     /api/r2/tags/:key        → key = numeric ttid OR slug
// PATCH   /api/r2/tags/:key        → update (admin)
// DELETE  /api/r2/tags/:key        → delete (admin)
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { isAdmin } from "@/lib/auth/isAdmin";
import { slugify } from "@/lib/slugify";

import { query } from "@/db/mysql";
import {
  getTagByTTIdRepo,
  updateTagRepo,
  deleteTagRepo,
} from "@/db/repo/tags.repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ------------------------- helpers ------------------------- */
const UpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z.string().optional(),
  description: z.string().optional(),
});

function isNumeric(s: string) {
  return /^\d+$/.test(s);
}

/** Resolve incoming key (numeric ttid or slug) -> term_taxonomy_id */
async function resolveTTIDByKey(key: string): Promise<number | null> {
  if (isNumeric(key)) return Number(key);

  // slug -> ttid
  const rows = await query<{ term_taxonomy_id: number }>(
    `SELECT tt.term_taxonomy_id
       FROM wp_terms t
       JOIN wp_term_taxonomy tt ON tt.term_id = t.term_id
      WHERE t.slug = ? AND tt.taxonomy = 'post_tag'
      LIMIT 1`,
    [key]
  );
  return rows[0]?.term_taxonomy_id ?? null;
}

/* --------------------------- GET --------------------------- */
/** Public read (no auth) */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await ctx.params;
    const k = decodeURIComponent(key || "").trim();
    if (!k) return NextResponse.json({ error: "Missing key" }, { status: 400 });

    const ttid = await resolveTTIDByKey(k);
    if (!ttid) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const dto = await getTagByTTIdRepo(ttid);
    if (!dto) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(dto, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to load" },
      { status: 500 }
    );
  }
}

/* -------------------------- PATCH -------------------------- */
/** Admin only: update name/slug/description */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ key: string }> }
) {
  try {
    // authN/Z
    const session = await getServerSession(authOptions);
    const uid = Number((session as any)?.user?.id || 0);
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(uid)))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { key } = await ctx.params;
    const k = decodeURIComponent(key || "").trim();
    const ttid = await resolveTTIDByKey(k);
    if (!ttid) return NextResponse.json({ error: "Bad key" }, { status: 400 });

    const payload = await req.json().catch(() => ({}));
    const data = UpdateSchema.parse(payload);

    const nextSlug =
      typeof data.slug === "string" && data.slug !== ""
        ? slugify(data.slug, { keepUnicode: true, maxLength: 190 })
        : undefined;

    const dto = await updateTagRepo({
      term_taxonomy_id: ttid,
      name: data.name,
      slug: nextSlug,
      description: data.description,
    });

    return NextResponse.json(dto, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err: any) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid payload", issues: err.flatten() },
        { status: 422 }
      );
    }
    const status = err?.status ?? 500;
    const message =
      status === 409 ? "Slug already in use." : err?.message || "Update failed";
    return NextResponse.json({ error: message }, { status });
  }
}

/* ------------------------- DELETE -------------------------- */
/** Admin only: delete tag (detaches relationships, etc) */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ key: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const uid = Number((session as any)?.user?.id || 0);
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(uid)))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { key } = await ctx.params;
    const k = decodeURIComponent(key || "").trim();
    const ttid = await resolveTTIDByKey(k);
    if (!ttid) return NextResponse.json({ error: "Bad key" }, { status: 400 });

    await deleteTagRepo(ttid);
    return new NextResponse(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json(
      { error: err?.message || "Delete failed" },
      { status }
    );
  }
}

/* ------------------------- OPTIONS ------------------------- */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
