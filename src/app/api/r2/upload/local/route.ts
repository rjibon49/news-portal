// src/app/api/upload/local/route.ts
import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import sharp from "sharp";
import { slugify } from "@/lib/slugify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// if your uploads are large, allow more time for Sharp
export const maxDuration = 60;

const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25MB (matches next.config.js headroom)
const RESIZE_TRIGGER = 2 * 1024 * 1024;  // >2MB => resize
const MAX_WIDTH = 1920;

// very small helper: fall back to extension when file.type is empty
function detectMime(filename: string, typeFromBrowser?: string): string {
  const t = (typeFromBrowser || "").toLowerCase();
  if (t) return t;
  const ext = (filename.split(".").pop() || "").toLowerCase();
  if (["jpg", "jpeg"].includes(ext)) return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "application/octet-stream";
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided (field 'file')" }, { status: 400 });
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: "File too large (max 25MB)" }, { status: 413 });
    }

    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, "0");

    const publicRoot = path.join(process.cwd(), "public");
    const targetDir = path.join(publicRoot, "uploads", yyyy, mm);
    await fs.mkdir(targetDir, { recursive: true });

    const origName = (file.name || "upload").replace(/\.[^.]+$/, "");
    const safeBase = slugify(origName, { keepUnicode: true });

    const buf = Buffer.from(await file.arrayBuffer());
    const mime = detectMime(file.name, file.type);

    // Only images supported here
    if (!/^image\//.test(mime)) {
      return NextResponse.json({ error: "Unsupported type. Only image/* allowed." }, { status: 415 });
    }

    // Build sharp pipeline
    let pipeline = sharp(buf, { failOnError: false });

    // Resize if big
    if (file.size > RESIZE_TRIGGER) {
      pipeline = pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
    }

    // Convert (jpeg/png/gif/anything image/*) -> webp for consistency & size
    pipeline = pipeline.webp({ quality: 82 });

    const outExt = "webp";
    const fileName = `${safeBase}-${Date.now()}.${outExt}`;
    const absPath = path.join(targetDir, fileName);

    const outBuf = await pipeline.toBuffer();
    await fs.writeFile(absPath, outBuf);

    const url = `/uploads/${yyyy}/${mm}/${fileName}`;
    return NextResponse.json({ url });
  } catch (err: any) {
    // surface the real cause in dev
    if (process.env.NODE_ENV !== "production") {
      console.error("[upload/local] error:", err);
    }
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
