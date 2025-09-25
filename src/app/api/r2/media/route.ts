// src/app/api/r2/media/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { isAdmin } from "@/lib/auth/isAdmin";
import { createAttachmentRepo, listMediaRepo } from "@/db/repo/media.repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ListSchema = z.object({
  q: z.string().optional(),
  type: z.enum(["all", "image", "video", "audio", "other"]).optional().default("all"),
  page: z.coerce.number().int().positive().optional().default(1),
  perPage: z.coerce.number().int().positive().max(100).optional().default(40),
  order: z.enum(["asc", "desc"]).optional().default("desc"),
});

const CreateSchema = z.object({
  url: z.string().url().or(z.string().regex(/^\/uploads\//)), // allow site-relative
  title: z.string().optional(),
  caption: z.string().optional(),
  description: z.string().optional(),
  mimeType: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const parsed = ListSchema.parse({
      q: url.searchParams.get("q") ?? undefined,
      type: url.searchParams.get("type") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      perPage: url.searchParams.get("perPage") ?? undefined,
      order: url.searchParams.get("order") ?? undefined,
    });

    const data = await listMediaRepo(parsed);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to list media" }, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const uid = Number((session as any)?.user?.id || 0);
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(uid))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const parsed = CreateSchema.parse(body);

    const dto = await createAttachmentRepo({
      authorId: uid,
      url: parsed.url,
      title: parsed.title,
      caption: parsed.caption,
      description: parsed.description,
      mimeType: parsed.mimeType,
    });
    return NextResponse.json(dto, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create attachment" }, { status: 400 });
  }
}
