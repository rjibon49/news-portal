// src/app/api/r2/media/[id]/route.ts
// -----------------------------------------------------------------------------
// Media: single attachment
// - GET    /:id    → fetch one attachment
// - PATCH  /:id    → update title/caption/description (admin)
// - DELETE /:id    → delete DB row + local file (admin)
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { isAdmin } from "@/lib/auth/isAdmin";
import { query } from "@/db/mysql";
import { deleteAttachmentRepo, updateAttachmentRepo } from "@/db/repo/media.repo";
import { publicPathFromUrl } from "@/lib/media/url";
import fs from "node:fs/promises";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // ▶ avoid caching at the route level

/* ─────────────── utils ─────────────── */
function parseId(id?: string) {
  const n = Number(id || 0);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/* ─────────────── schema ─────────────── */
const UpdSchema = z.object({
  title: z.string().optional(),
  caption: z.string().optional(),
  description: z.string().optional(),
});

/* ───────────────── GET /media/:id ─────────────────
   Public read (add auth if needed)
--------------------------------------------------- */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> } // ⬅ Next.js 15: await params
) {
  try {
    const { id } = await ctx.params;
    const mediaId = parseId(id);
    if (!mediaId) {
      return NextResponse.json({ error: "Bad id" }, { status: 400 });
    }

    const rows = await query<{
      ID: number;
      guid: string;
      post_title: string;
      post_excerpt: string;
      post_content: string;
      post_mime_type: string;
      post_date: string;
      post_author: number;
    }>(
      `SELECT ID, guid, post_title, post_excerpt, post_content, post_mime_type, post_date, post_author
         FROM wp_posts
        WHERE ID = ? AND post_type='attachment'
        LIMIT 1`,
      [mediaId]
    );

    if (!rows[0]) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(rows[0], {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}

/* ───────────────── PATCH /media/:id ─────────────────
   Admin only: update title/caption/description
----------------------------------------------------- */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    // 🔐 session + admin
    const session = await getServerSession(authOptions);
    const uid = Number((session as any)?.user?.id || 0);
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(uid))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await ctx.params;
    const mediaId = parseId(id);
    if (!mediaId) return NextResponse.json({ error: "Bad id" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const parsed = UpdSchema.parse(body);

    const dto = await updateAttachmentRepo({ id: mediaId, ...parsed });

    return NextResponse.json(dto, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e: any) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: "Invalid payload", issues: e.flatten() }, { status: 422 });
    }
    return NextResponse.json({ error: e?.message || "Update failed" }, { status: e?.status ?? 400 });
  }
}

/* ───────────────── DELETE /media/:id ─────────────────
   Admin only: remove local file (if under /public) + DB attachment row
------------------------------------------------------ */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    // 🔐 session + admin
    const session = await getServerSession(authOptions);
    const uid = Number((session as any)?.user?.id || 0);
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(uid))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await ctx.params;
    const mediaId = parseId(id);
    if (!mediaId) return NextResponse.json({ error: "Bad id" }, { status: 400 });

    // 🗂️ lookup file path from guid (if present)
    const row = await query<{ guid: string }>(
      `SELECT guid FROM wp_posts WHERE ID = ? AND post_type='attachment' LIMIT 1`,
      [mediaId]
    );

    const guid = row[0]?.guid as string | undefined;
    if (guid) {
      const abs = publicPathFromUrl(process.cwd(), guid);
      if (abs) {
        try {
          await fs.unlink(abs); // ignore if already gone
        } catch {
          /* noop */
        }
      }
    }

    // 🗃️ DB delete (repo throws 404 if missing)
    await deleteAttachmentRepo(mediaId);

    return new NextResponse(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Delete failed" },
      { status: e?.status ?? 400 }
    );
  }
}

/* NOTES
- If you later want to also delete any generated thumbnails/variants,
  map those from postmeta (_wp_attachment_metadata) before unlinking.
- Keep response shapes consistent with list/create endpoints.
*/
