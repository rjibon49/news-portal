// src/app/api/upload/local/route.ts
import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import sharp from "sharp";
import { slugify } from "@/lib/slugify";

export const runtime = "nodejs";            // ▶ sharp & fs: node runtime
export const dynamic = "force-dynamic";     // ▶ disable route caching
export const maxDuration = 60;              // ▶ allow more time for big images

/* ───────────── config ───────────── */
const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25MB hard cap
const RESIZE_TRIGGER = 2 * 1024 * 1024;  // >2MB ⇒ resize to MAX_WIDTH
const MAX_WIDTH = 1920;                  // cap width for large uploads

/* ──────────── mime detect ────────────
   - Browser may not send file.type; fallback to extension.
   - We support common image types (sharp can read these).
*/
function detectMime(filename: string, typeFromBrowser?: string): string {
  const t = (typeFromBrowser || "").toLowerCase();
  if (t) return t;
  const ext = (filename.split(".").pop() || "").toLowerCase();
  if (["jpg", "jpeg"].includes(ext)) return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "svg") return "image/svg+xml";
  if (ext === "heic" || ext === "heif") return "image/heic";
  if (ext === "avif") return "image/avif";
  return "application/octet-stream";
}

export async function POST(req: Request) {
  try {
    /* 1) read multipart/form-data */
    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided (field 'file')" }, { status: 400 });
    }

    /* 2) size guard */
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: "File too large (max 25MB)" }, { status: 413 });
    }

    /* 3) build paths like /public/uploads/YYYY/MM/ */
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, "0");

    const publicRoot = path.join(process.cwd(), "public");
    const targetDir = path.join(publicRoot, "uploads", yyyy, mm);
    await fs.mkdir(targetDir, { recursive: true });

    /* 4) sanitize filename → slug */
    const origName = (file.name || "upload").replace(/\.[^.]+$/, "");
    const safeBase = slugify(origName, { keepUnicode: true });

    const buf = Buffer.from(await file.arrayBuffer());
    const mime = detectMime(file.name, file.type);

    /* 5) only images allowed */
    if (!/^image\//.test(mime)) {
      return NextResponse.json({ error: "Unsupported type. Only image/* allowed." }, { status: 415 });
    }

    /* 6) sharp pipeline
       - .rotate(): fixes EXIF orientation for JPEG/others
       - animated input (GIF/animated WebP) preserved by passing animated: true
       - resize only if big, then convert to WebP for consistency/size
    */
    const animated = mime === "image/gif" || mime === "image/webp";
    let pipeline = sharp(buf, { failOnError: false, animated }).rotate();

    if (file.size > RESIZE_TRIGGER) {
      pipeline = pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
    }

    // WebP encode: balanced quality / CPU effort
    pipeline = pipeline.webp({
      quality: 82,
      effort: 4,
      alphaQuality: 80,
      // sharp auto-outputs animated WebP if input is animated & animated:true above
    });

    /* 7) write to disk under /public/uploads/YYYY/MM/ */
    const outExt = "webp";
    const fileName = `${safeBase}-${Date.now()}.${outExt}`;
    const absPath = path.join(targetDir, fileName);

    const outBuf = await pipeline.toBuffer();
    await fs.writeFile(absPath, outBuf);

    /* 8) respond with public URL (served by Next static) */
    const url = `/uploads/${yyyy}/${mm}/${fileName}`;
    return NextResponse.json(
      { url },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[upload/local] error:", err);
    }
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

/* NOTES
- This endpoint stores files under /public/uploads so they are served statically.
- If you move to object storage (S3/R2), mirror the response shape {url} for drop-in use.
- If you want to return width/height, use: const { width, height } = await sharp(outBuf).metadata()
  and include in JSON.
*/
