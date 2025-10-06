// src/app/api/categories/route.ts
// -----------------------------------------------------------------------------
// Categories API
// - GET  -> list all categories (public read; guard if needed)
// - POST -> create category (admin only)
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { isAdmin } from "@/lib/auth/isAdmin";
import { slugify } from "@/lib/slugify";
import { createCategoryRepo, listCategoriesRepo } from "@/db/repo/categories.repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // ▶ avoid caching this route

/* ─────────────── [Schema] create payload ───────────────
   - parent: term_taxonomy_id (or 0/null for root)
   - coerce number so "12" works from forms
*/
const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().optional(),
  description: z.string().optional().default(""),
  parent: z
    .union([z.coerce.number().int().nonnegative(), z.null()])
    .optional()
    .default(null),
});

/* ─────────────────────────── GET /categories ───────────────────────────
   Public listing (add auth if you want). Returns full CategoryDTO[].
----------------------------------------------------------------------- */
export async function GET() {
  try {
    const rows = await listCategoriesRepo();
    return NextResponse.json(rows, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to load categories" },
      { status: 500 }
    );
  }
}

/* ─────────────────────────── POST /categories ──────────────────────────
   Admin-only: create category; slug auto-derives from name if not provided.
----------------------------------------------------------------------- */
export async function POST(req: Request) {
  try {
    // 🔐 AuthN
    const session = await getServerSession(authOptions);
    const uid = Number((session as any)?.user?.id || 0);
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 🔐 AuthZ
    if (!(await isAdmin(uid))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 📨 Validate body
    const body = await req.json().catch(() => ({}));
    const parsed = CreateSchema.parse(body);

    // 🧭 Slug (WP-friendly): prefer provided; else from name
    const { name, description } = parsed;
    const parent = parsed.parent === 0 ? 0 : parsed.parent; // keep 0 as root
    const slug = slugify(parsed.slug || name, { keepUnicode: true, maxLength: 190 });

    // 🗃️ Repo create (validates parent ttid exists when >0)
    const dto = await createCategoryRepo({
      name,
      slug,
      description,
      parent: parent ?? null,
    });

    return NextResponse.json(dto, {
      status: 201,
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
      status === 409
        ? "A category with this slug already exists."
        : err?.message || "Failed to create category";
    return NextResponse.json({ error: message }, { status });
  }
}

/* NOTES
- parent expects a term_taxonomy_id (not term_id). Repo already checks existence.
- Keep response shapes aligned with Category management UI.
- If later you add PUT/PATCH for updates, mirror the slug rules & validations here.
*/
