// src/app/api/r2/media/route.ts
// -----------------------------------------------------------------------------
// Media API
// - GET    -> list media with filters/pagination (public read; guard if needed)
// - POST   -> create attachment record (admin only)
// -----------------------------------------------------------------------------
// Notes:
// • listMediaRepo handles paging + type filtering (image/video/audio/other).
// • createAttachmentRepo expects a URL (absolute http(s) OR /uploads/... relative).
// -----------------------------------------------------------------------------

// src/app/api/r2/media/route.ts
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
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
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

const CreateSchema = z.object({
  url: z.string().refine( (v) => /^https?:\/\//i.test(v) || /^\/uploads\//.test(v), "URL must be http(s) or start with /uploads/" ),
  title: z.string().optional(),
  caption: z.string().optional(),
  description: z.string().optional(),
  mimeType: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const parsed = ListSchema.parse(Object.fromEntries(url.searchParams));
    
    const data = await listMediaRepo(parsed);

    // ✅ FIX: Ensure `data` is a valid object with a `rows` array before returning.
    if (!data || !Array.isArray(data.rows)) {
      console.error("listMediaRepo returned invalid data:", data);
      return NextResponse.json(
        { error: "Internal server error: Invalid data from repository." },
        { status: 500 }
      );
    }

    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e: any) {
    if (e instanceof ZodError) {
      return NextResponse.json( { error: "Invalid query", issues: e.flatten() }, { status: 422 } );
    }
    return NextResponse.json( { error: e?.message || "Failed to list media" }, { status: 400 } );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const uid = Number((session as any)?.user?.id || 0);
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(uid))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
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
    return NextResponse.json(dto, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e: any) {
    if (e instanceof ZodError) {
      return NextResponse.json( { error: "Invalid payload", issues: e.flatten() }, { status: 422 } );
    }
    return NextResponse.json( { error: e?.message || "Failed to create attachment" }, { status: 400 } );
  }
}