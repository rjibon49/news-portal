// src/lib/upload/local.ts
import path from "node:path";
import fs from "node:fs/promises";
import sharp from "sharp";
import { slugify } from "@/lib/slugify";

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const RESIZE_TRIGGER = 2 * 1024 * 1024; // >2MB => resize
const MAX_WIDTH = 1920;

export type SavedImage = {
  url: string;          // /uploads/2025/09/xxx.webp
  relPath: string;      // 2025/09/xxx.webp
  absPath: string;      // <project>/public/uploads/...
  bytes: number;
  width?: number;
  height?: number;
  mime: string;         // image/webp
  filename: string;     // xxx.webp
  titleBase: string;    // xxx
};

export async function saveLocalImage(file: File): Promise<SavedImage> {
  if (file.size > MAX_SIZE_BYTES) throw new Error("File too large (max 10MB)");

  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");

  const publicRoot = path.join(process.cwd(), "public");
  const targetDir = path.join(publicRoot, "uploads", yyyy, mm);
  await fs.mkdir(targetDir, { recursive: true });

  const base = slugify((file.name || "upload").replace(/\.[^.]+$/, ""));
  const buf = Buffer.from(await file.arrayBuffer());
  const ctype = file.type.toLowerCase();

  let pipeline = sharp(buf);
  if (file.size > RESIZE_TRIGGER) pipeline = pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });

  // Always normalize to webp (keeps things simple)
  const out = pipeline.webp({ quality: 82 });
  const meta = await out.metadata();

  const filename = `${base}-${Date.now()}.webp`;
  const absPath = path.join(targetDir, filename);
  const outBuf = await out.toBuffer();
  await fs.writeFile(absPath, outBuf);

  const relPath = `${yyyy}/${mm}/${filename}`;
  const url = `/uploads/${relPath}`;

  return {
    url,
    relPath,
    absPath,
    bytes: outBuf.length,
    width: meta.width,
    height: meta.height,
    mime: "image/webp",
    filename,
    titleBase: base,
  };
}
