// src/app/api/r2/media/import/route.ts
import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { isAdmin } from "@/lib/auth/isAdmin";
import { query, execute } from "@/db/mysql";
import { createAttachmentRepo } from "@/db/repo/media.repo";
import { z, ZodError } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  dryRun: z.boolean().optional().default(false),
  subdir: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || !v.startsWith("/"), { message: "subdir must be relative" }),
  authorId: z.coerce.number().int().positive().optional(),
});

function mimeFromExt(ext: string): string {
  const e = ext.toLowerCase();
  if (e === ".jpg" || e === ".jpeg") return "image/jpeg";
  if (e === ".png") return "image/png";
  if (e === ".webp") return "image/webp";
  if (e === ".gif") return "image/gif";
  if (e === ".svg") return "image/svg+xml";
  if (e === ".mp4") return "video/mp4";
  if (e === ".mov") return "video/quicktime";
  if (e === ".mp3") return "audio/mpeg";
  if (e === ".wav") return "audio/wav";
  return "application/octet-stream";
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  try {
    const ents = await fs.readdir(dir, { withFileTypes: true });
    for (const ent of ents) {
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) out.push(...(await walk(abs)));
      else if (ent.isFile()) out.push(abs);
    }
  } catch (e) {
    // ignore; empty folder
  }
  return out;
}

function toMySqlDateTime(dt: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = dt.getFullYear();
  const m = pad(dt.getMonth() + 1);
  const d = pad(dt.getDate());
  const hh = pad(dt.getHours());
  const mm = pad(dt.getMinutes());
  const ss = pad(dt.getSeconds());
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

async function alreadyIndexed(relPath: string, guid: string): Promise<boolean> {
  const byGuidRows = await query<{ ID: number }>(
    `SELECT ID FROM wp_posts WHERE post_type='attachment' AND guid = ? LIMIT 1`,
    [guid]
  );
  if (byGuidRows.length > 0) return true;

  const byMetaRows = await query<{ post_id: number }>(
    `SELECT post_id FROM wp_postmeta WHERE meta_key='_wp_attached_file' AND meta_value = ? LIMIT 1`,
    [relPath]
  );
  return byMetaRows.length > 0;
}

async function setPostDatesFromMtime(postId: number, mtime: Date) {
  // Keep local timestamps consistent with listing filter
  const local = toMySqlDateTime(mtime);
  const gmt = toMySqlDateTime(new Date(mtime.getTime() - mtime.getTimezoneOffset() * 60000));
  await execute(
    `UPDATE wp_posts SET post_date=?, post_date_gmt=?, post_modified=?, post_modified_gmt=? WHERE ID=? AND post_type='attachment'`,
    [local, gmt, local, gmt, postId]
  );
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const uid = Number(session?.user?.id ?? 0);
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(uid))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const bodyRaw = (await req.json().catch(() => ({}))) as unknown;
    const { dryRun, subdir, authorId } = Body.parse(bodyRaw ?? {});
    const owner = authorId || uid;

    const publicRoot = path.join(process.cwd(), "public");
    const uploadsRoot = path.join(publicRoot, "uploads");
    const scanRoot = subdir ? path.join(uploadsRoot, subdir) : uploadsRoot;

    const relCheck = path.relative(uploadsRoot, scanRoot);
    if (relCheck.startsWith("..")) {
      return NextResponse.json({ error: "subdir must be under /uploads" }, { status: 400 });
    }

    const files = await walk(scanRoot);
    if (files.length === 0) {
      return NextResponse.json(
        { error: "Nothing to scan (missing directory or no files found?)" },
        { status: 400 }
      );
    }

    const exts = new Set([
      ".jpg",
      ".jpeg",
      ".png",
      ".webp",
      ".gif",
      ".svg",
      ".mp4",
      ".mov",
      ".mp3",
      ".wav",
    ]);
    const candidates = files.filter((f) => exts.has(path.extname(f).toLowerCase()));

    const inserted: Array<{ id: number; url: string }> = [];
    const skipped: string[] = [];
    const errors: Array<{ file: string; error: string }> = [];

    for (const abs of candidates) {
      try {
        const relUnderPublic = path.relative(publicRoot, abs).replace(/\\/g, "/");
        if (!relUnderPublic.startsWith("uploads/")) {
          skipped.push(abs);
          continue;
        }

        const rel = relUnderPublic;
        const url = `/${rel}`;

        if (await alreadyIndexed(rel, url)) {
          skipped.push(url);
          continue;
        }

        const stat = await fs.stat(abs);
        const title = path.basename(abs, path.extname(abs));
        const mime = mimeFromExt(path.extname(abs));

        if (!dryRun) {
          const dto = await createAttachmentRepo({
            authorId: owner,
            url,
            title,
            description: "",
            caption: "",
            mimeType: mime,
          });
          await setPostDatesFromMtime(dto.ID, stat.mtime);
          inserted.push({ id: dto.ID, url });
        } else {
          skipped.push(`DRYRUN: ${url}`);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push({ file: abs, error: msg });
      }
    }

    return NextResponse.json({
      ok: true,
      scanned: candidates.length,
      inserted: inserted.length,
      skipped: skipped.length,
      errors,
      details: { inserted, skipped },
    });
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: "Invalid payload", issues: e.flatten() }, { status: 422 });
    }
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg || "Import failed" }, { status: 500 });
  }
}
