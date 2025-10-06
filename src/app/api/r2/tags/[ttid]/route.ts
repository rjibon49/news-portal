// src/app/api/r2/tags/[ttid]/route.ts
// -----------------------------------------------------------------------------
// Single Tag API (taxonomy = 'post_tag')
// - GET    /:ttid     → fetch a single tag DTO
// - PATCH  /:ttid     → update tag (admin only)
// - DELETE /:ttid     → delete tag (admin only)
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { isAdmin } from "@/lib/auth/isAdmin";
import { slugify } from "@/lib/slugify";
import { getTagByTTIdRepo, updateTagRepo, deleteTagRepo } from "@/db/repo/tags.repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // ▶ avoid caching for admin-ish endpoints

/* ─────────────── Schemas ─────────────── */
const UpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z.string().optional(),
  description: z.string().optional(),
});

/* ─────────────── utils ─────────────── */
function parseId(id: string | undefined) {
  const n = Number(id || 0);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/* ─────────────── GET /api/r2/tags/:ttid ───────────────
   - Public read (no auth). Add guard if you want to restrict.
------------------------------------------------------- */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ ttid: string }> } // ⬅ Next.js 15: params must be awaited
) {
  try {
    const { ttid } = await ctx.params;
    const id = parseId(ttid);
    if (!id) {
      return NextResponse.json({ error: "Bad id" }, { status: 400 });
    }

    const dto = await getTagByTTIdRepo(id);
    if (!dto) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(dto, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to load" },
      { status: 500 }
    );
  }
}

/* ─────────────── PATCH /api/r2/tags/:ttid ───────────────
   - Admin only
   - Allows updating name/slug/description
--------------------------------------------------------- */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ ttid: string }> }
) {
  try {
    // 🔐 AuthN/Z
    const session = await getServerSession(authOptions);
    const uid = Number((session as any)?.user?.id || 0);
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(uid))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { ttid } = await ctx.params;
    const id = parseId(ttid);
    if (!id) return NextResponse.json({ error: "Bad id" }, { status: 400 });

    // 📨 Validate body
    const body = await req.json().catch(() => ({}));
    const data = UpdateSchema.parse(body);

    // 🧭 Normalize slug (keepUnicode, WP-like 190 char cap)
    const nextSlug =
      typeof data.slug === "string" && data.slug !== ""
        ? slugify(data.slug, { keepUnicode: true, maxLength: 190 })
        : undefined;

    // 🗃️ Repo update
    const dto = await updateTagRepo({
      term_taxonomy_id: id,
      name: data.name,
      slug: nextSlug,
      description: data.description,
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

/* ─────────────── DELETE /api/r2/tags/:ttid ───────────────
   - Admin only
--------------------------------------------------------- */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ ttid: string }> }
) {
  try {
    // 🔐 AuthN/Z
    const session = await getServerSession(authOptions);
    const uid = Number((session as any)?.user?.id || 0);
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(uid))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { ttid } = await ctx.params;
    const id = parseId(ttid);
    if (!id) return NextResponse.json({ error: "Bad id" }, { status: 400 });

    // 🗃️ Repo delete
    await deleteTagRepo(id);
    return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json(
      { error: err?.message || "Delete failed" },
      { status }
    );
  }
}

/* NOTES
- Keep response shape consistent with the rest of Tag APIs.
- If you add auditing, hook here after repo calls.
- Repo functions already enforce uniqueness and existence.
*/
