// src/app/api/r2/categories/[key]/route.ts

// -----------------------------------------------------------------------------
// Category API (by key = slug OR term_taxonomy_id)
// - GET    /api/r2/categories/:key
// - PATCH  /api/r2/categories/:key    (admin)
// - DELETE /api/r2/categories/:key    (admin)
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { isAdmin } from "@/lib/auth/isAdmin";
import { slugify } from "@/lib/slugify";
import {
  getCategoryByTTIdRepo,
  updateCategoryRepo,
  deleteCategoryRepo,
} from "@/db/repo/categories.repo";
import { query } from "@/db/mysql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ---------- schema ---------- */
const UpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z.string().optional(),
  description: z.string().optional(),
  parent: z.union([z.coerce.number().int().nonnegative(), z.null()]).optional(),
});

/* ---------- helpers ---------- */
function isNumericKey(k?: string) {
  return !!k && /^[0-9]+$/.test(k);
}

async function resolveTtidFromKey(key: string): Promise<number | null> {
  if (isNumericKey(key)) return Number(key);

  // slug → ttid
  const rows = await query<{ term_taxonomy_id: number }>(
    `SELECT tt.term_taxonomy_id
       FROM wp_terms t
       JOIN wp_term_taxonomy tt ON tt.term_id = t.term_id
      WHERE tt.taxonomy='category' AND t.slug = ?
      LIMIT 1`,
    [key]
  );
  return rows?.[0]?.term_taxonomy_id ?? null;
}

/* ---------- GET /categories/:key ---------- */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await ctx.params;
    const ttid = await resolveTtidFromKey(key);
    if (!ttid) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const dto = await getCategoryByTTIdRepo(ttid);
    if (!dto) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(dto, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to load" }, { status: 500 });
  }
}

/* ---------- PATCH /categories/:key ---------- */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ key: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const uid = Number((session as any)?.user?.id || 0);
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(uid))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { key } = await ctx.params;
    const ttid = await resolveTtidFromKey(key);
    if (!ttid) return NextResponse.json({ error: "Bad id/slug" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const data = UpdateSchema.parse(body);

    const nextSlug =
      typeof data.slug === "string" && data.slug !== ""
        ? slugify(data.slug, { keepUnicode: true, maxLength: 190 })
        : undefined;

    const dto = await updateCategoryRepo({
      term_taxonomy_id: ttid,
      name: data.name,
      slug: nextSlug,
      description: data.description,
      parent: data.parent ?? undefined,
    });

    return NextResponse.json(dto, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid payload", issues: err.flatten() },
        { status: 422 }
      );
    }
    const status = err?.status ?? 500;
    const msg = status === 409 ? "Slug already in use." : err?.message || "Update failed";
    return NextResponse.json({ error: msg }, { status });
  }
}

/* ---------- DELETE /categories/:key ---------- */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ key: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const uid = Number((session as any)?.user?.id || 0);
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(uid))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { key } = await ctx.params;
    const ttid = await resolveTtidFromKey(key);
    if (!ttid) return NextResponse.json({ error: "Bad id/slug" }, { status: 400 });

    await deleteCategoryRepo(ttid);
    return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json({ error: err?.message || "Delete failed" }, { status });
  }
}
