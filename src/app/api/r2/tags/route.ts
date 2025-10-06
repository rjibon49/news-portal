// src/app/api/r2/tags/route.ts
// -----------------------------------------------------------------------------
// Tags API (WordPress-style 'post_tag')
// - GET (no query)         -> full list for the Tag management table (TagDTO[])
// - GET ?q=foo&limit=20    -> name/slug suggestions for autocomplete ({items})
// - GET ?top=1&limit=20    -> most used tags for “Choose from most used” ({items})
// - POST                   -> create/upsert tag (admin only)
// -----------------------------------------------------------------------------
// NOTE: Different shapes by design:
//   • List page needs full TagDTO[]
//   • Autocomplete widgets expect { items: [...] }
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { query } from "@/db/mysql";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { isAdmin } from "@/lib/auth/isAdmin";
import { slugify } from "@/lib/slugify";
import { createTagRepo, listTagsRepo, type TagDTO } from "@/db/repo/tags.repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// --------------------------- Zod Schemas ------------------------------------

// ✅ Create payload (admin only)
const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().optional(),            // optional; will be generated from name
  description: z.string().optional().default(""),
});

// ✅ GET query modes
// - q     => suggestions by name/slug
// - top   => most used (boolean-ish; coerce)
// - limit => max rows
const Q = z.object({
  q: z.string().optional(),
  top: z.coerce.boolean().optional().default(false),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

// ------------------------------- GET ----------------------------------------
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = Q.parse(Object.fromEntries(url.searchParams));

    // ── Mode A: suggestions (by partial name/slug match, prefix boosted)
    if (q.q && !q.top) {
      const like = `%${q.q}%`;
      const prefix = `${q.q}%`;

      const rows = await query<{ name: string; slug: string }>(
        `
        SELECT t.name, t.slug
          FROM wp_terms t
          JOIN wp_term_taxonomy tt ON tt.term_id = t.term_id
         WHERE tt.taxonomy='post_tag'
           AND (t.name LIKE ? OR t.slug LIKE ?)
         ORDER BY
           (t.name LIKE ?) DESC,   -- prefix boost on name
           (t.slug LIKE ?) DESC,   -- prefix boost on slug
           t.name ASC
         LIMIT ?
        `,
        [like, like, prefix, prefix, q.limit]
      );

      return NextResponse.json(
        { items: rows },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // ── Mode B: most used (top) — LIVE count (published posts only)
    if (q.top) {
      const rows = await query<{ name: string; slug: string; count: number }>(
        `
        SELECT
          t.name,
          t.slug,
          (
            SELECT COUNT(*)
            FROM wp_term_relationships tr
            JOIN wp_posts p ON p.ID = tr.object_id
            WHERE tr.term_taxonomy_id = tt.term_taxonomy_id
              AND p.post_type = 'post'
              AND p.post_status = 'publish'
          ) AS count
        FROM wp_term_taxonomy tt
        JOIN wp_terms t ON t.term_id = tt.term_id
        WHERE tt.taxonomy='post_tag'
          AND (
            SELECT COUNT(*)
            FROM wp_term_relationships tr2
            JOIN wp_posts p2 ON p2.ID = tr2.object_id
            WHERE tr2.term_taxonomy_id = tt.term_taxonomy_id
              AND p2.post_type = 'post'
              AND p2.post_status = 'publish'
          ) > 0
        ORDER BY count DESC, t.name ASC
        LIMIT ?
        `,
        [q.limit]
      );

      return NextResponse.json(
        { items: rows },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // ── Mode C: full list (Tag management table)
    const list: TagDTO[] = await listTagsRepo();
    return NextResponse.json(list, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: "Invalid query", issues: e.flatten() }, { status: 422 });
    }
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 400 });
  }
}

// ------------------------------- POST ---------------------------------------
// Create / Upsert a tag (admin-only)
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

    // ✅ Validate
    const body = await req.json().catch(() => ({}));
    const parsed = CreateSchema.parse(body);

    // 🧭 Slug: prefer provided slug, otherwise derive from name
    const { name, description } = parsed;
    const slug = slugify(parsed.slug || name, { keepUnicode: true, maxLength: 190 });

    // 🗃️ Upsert via repo (reuses slug term; ensures taxonomy)
    const dto = await createTagRepo({ name, slug, description });

    return NextResponse.json(dto, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err: any) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Invalid payload", issues: err.flatten() }, { status: 422 });
    }
    // NOTE: createTagRepo currently idempotent; 409 unlikely.
    const status = err?.status ?? 500;
    const message = status === 409 ? "A tag with this slug already exists." : "Failed to create tag";
    return NextResponse.json({ error: message }, { status });
  }
}

/* NOTES
- Suggestions now search both name and slug, with prefix matches boosted.
- GET responses are no-store to avoid admin data caching.
- If you later add auth guard to GET, just reuse the admin check from POST.
- Keep response shapes consistent with UI: {items} for widgets, TagDTO[] for table.
*/
