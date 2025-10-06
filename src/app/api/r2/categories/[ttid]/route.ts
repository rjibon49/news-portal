// src/app/api/r2/categories/[ttid]/route.ts
// -----------------------------------------------------------------------------
// Single Category API (taxonomy = 'category')
// - GET    /:ttid  → fetch one category DTO
// - PATCH  /:ttid  → update (admin only)
// - DELETE /:ttid  → delete (admin only)
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // ▶ avoid caching admin-ish endpoints

/* ─────────────── schema ───────────────
   - parent: term_taxonomy_id (>=0), null → root clear
   - coerce number so "12" from forms is okay
*/
const UpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z.string().optional(),
  description: z.string().optional(),
  parent: z.union([z.coerce.number().int().nonnegative(), z.null()]).optional(),
});

/* ─────────────── utils ─────────────── */
function parseId(id?: string) {
  const n = Number(id || 0);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/* ─────────────── GET /categories/:ttid ───────────────
   Public read (add guard if you want). Next.js 15: await params.
------------------------------------------------------ */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ ttid: string }> }
) {
  try {
    const { ttid } = await ctx.params;
    const id = parseId(ttid);
    if (!id) return NextResponse.json({ error: "Bad id" }, { status: 400 });

    const dto = await getCategoryByTTIdRepo(id);
    if (!dto) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(dto, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to load" },
      { status: 500 }
    );
  }
}

/* ─────────────── PATCH /categories/:ttid ───────────────
   Admin only: update name/slug/description/parent
-------------------------------------------------------- */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ ttid: string }> }
) {
  try {
    // 🔐 session + admin
    const session = await getServerSession(authOptions);
    const uid = Number((session as any)?.user?.id || 0);
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(uid))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { ttid } = await ctx.params;
    const id = parseId(ttid);
    if (!id) return NextResponse.json({ error: "Bad id" }, { status: 400 });

    // 📨 validate
    const body = await req.json().catch(() => ({}));
    const data = UpdateSchema.parse(body);

    // 🧭 normalize slug (WP-friendly 190 chars; keepUnicode to match UI)
    const nextSlug =
      typeof data.slug === "string" && data.slug !== ""
        ? slugify(data.slug, { keepUnicode: true, maxLength: 190 })
        : undefined;

    // 🗃️ repo update
    const dto = await updateCategoryRepo({
      term_taxonomy_id: id,
      name: data.name,
      slug: nextSlug,
      description: data.description,
      parent: data.parent ?? undefined, // undefined → leave as-is; null → clear to root
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
    const message = status === 409 ? "Slug already in use." : err?.message || "Update failed";
    return NextResponse.json({ error: message }, { status });
  }
}

/* ─────────────── DELETE /categories/:ttid ───────────────
   Admin only: re-parents children to root, removes rels, deletes taxonomy,
   and deletes term if unused (handled in repo).
--------------------------------------------------------- */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ ttid: string }> }
) {
  try {
    // 🔐 session + admin
    const session = await getServerSession(authOptions);
    const uid = Number((session as any)?.user?.id || 0);
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(uid))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { ttid } = await ctx.params;
    const id = parseId(ttid);
    if (!id) return NextResponse.json({ error: "Bad id" }, { status: 400 });

    await deleteCategoryRepo(id);

    return new NextResponse(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json({ error: err?.message || "Delete failed" }, { status });
  }
}

/* NOTES
- `parent` expects a term_taxonomy_id (same table’s PK), not term_id.
- Keep response shapes aligned with your Category list/create routes.
- If later you need to block deletion for non-empty categories,
  add a pre-check on relationships before calling repo.
*/
