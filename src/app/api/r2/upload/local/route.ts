// src/app/api/upload/local/route.ts
import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import sharp from "sharp";
import { slugify } from "@/lib/slugify";

export const runtime = "nodejs";

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB max
const RESIZE_TRIGGER = 2 * 1024 * 1024; // >2MB => resize
const MAX_WIDTH = 1920;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided (field 'file')" }, { status: 400 });
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 413 });
    }

    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, "0");

    const publicRoot = path.join(process.cwd(), "public");
    const targetDir = path.join(publicRoot, "uploads", yyyy, mm);
    await fs.mkdir(targetDir, { recursive: true });

    const origName = (file.name || "upload").replace(/\.[^.]+$/, "");
    const safeBase = slugify(origName);
    const buf = Buffer.from(await file.arrayBuffer());
    const ctype = file.type.toLowerCase();

    // Decide output extension and pipeline
    let outExt = "webp";
    let pipeline = sharp(buf);

    // Resize if large
    if (file.size > RESIZE_TRIGGER) {
      pipeline = pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
    }

    // Convert jpg/jpeg/png -> webp; keep webp as webp; others: just save same buffer if image/*
    if (/(jpe?g|png)/.test(ctype)) {
      pipeline = pipeline.webp({ quality: 82 });
      outExt = "webp";
    } else if (/webp/.test(ctype)) {
      pipeline = pipeline.webp({ quality: 82 }); // normalize
      outExt = "webp";
    } else if (/^image\//.test(ctype)) {
      // fallback: still convert to webp to keep it simple
      pipeline = pipeline.webp({ quality: 82 });
      outExt = "webp";
    } else {
      return NextResponse.json({ error: "Unsupported file type. Images only." }, { status: 415 });
    }

    const fileName = `${safeBase}-${Date.now()}.${outExt}`;
    const absPath = path.join(targetDir, fileName);
    const outBuf = await pipeline.toBuffer();
    await fs.writeFile(absPath, outBuf);

    const url = `/uploads/${yyyy}/${mm}/${fileName}`;
    return NextResponse.json({ url });
  } catch (err: any) {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
