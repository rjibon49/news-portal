// src/app/api/r2/media/[id]/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { isAdmin } from "@/lib/auth/isAdmin";
import { query } from "@/db/mysql";
import { deleteAttachmentRepo, updateAttachmentRepo } from "@/db/repo/media.repo";
import { publicPathFromUrl } from "@/lib/media/url";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UpdSchema = z.object({
  title: z.string().optional(),
  caption: z.string().optional(),
  description: z.string().optional(),
});

function parseId(params: { id?: string }) {
  const id = Number(params?.id || 0);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseId(params);
    if (!id) return NextResponse.json({ error: "Bad id" }, { status: 400 });

    const rows = await query<any>(
      `SELECT ID, guid, post_title, post_excerpt, post_content, post_mime_type, post_date, post_author
         FROM wp_posts WHERE ID = ? AND post_type='attachment' LIMIT 1`,
      [id]
    );
    if (!rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const uid = Number((session as any)?.user?.id || 0);
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(uid))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const id = parseId(params);
    if (!id) return NextResponse.json({ error: "Bad id" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const parsed = UpdSchema.parse(body);

    const dto = await updateAttachmentRepo({ id, ...parsed });
    return NextResponse.json(dto);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Update failed" }, { status: 400 });
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const uid = Number((session as any)?.user?.id || 0);
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(uid))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const id = parseId(params);
    if (!id) return NextResponse.json({ error: "Bad id" }, { status: 400 });

    // find file path to delete
    const row = await query<{ guid: string }>(
      `SELECT guid FROM wp_posts WHERE ID = ? AND post_type='attachment' LIMIT 1`,
      [id]
    );
    const guid = row[0]?.guid as string | undefined;
    if (guid) {
      const abs = publicPathFromUrl(process.cwd(), guid);
      if (abs) {
        try { await fs.unlink(abs); } catch { /* ignore missing file */ }
      }
    }

    await deleteAttachmentRepo(id);
    return new NextResponse(null, { status: 204 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Delete failed" }, { status: 400 });
  }
}
