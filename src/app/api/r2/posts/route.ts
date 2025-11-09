// src/app/api/r2/posts/route.ts
// -----------------------------------------------------------------------------
// Posts collection route
// - GET  : posts list (filter + paginate + sort)
// - POST : create a new post (+ wp_post_extra) and optionally queue TTS
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { isAdmin } from "@/lib/auth/isAdmin";
import { createPostRepo, listPostsRepo } from "@/db/repo/posts";
import { query } from "@/db/mysql";
import { slugify } from "@/lib/slugify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ----------------------------- helpers ----------------------------- */
function json(data: any, init?: ResponseInit) {
  const base = {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  } as ResponseInit;
  return NextResponse.json(data, { ...base, ...init, headers: { ...base.headers, ...(init?.headers || {}) } });
}

const toNum = (v: unknown): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const toStr = (v: unknown, d = ""): string => (v == null ? d : String(v));
const toOptStr = (v: unknown): string | undefined => {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
};
const isPosNum = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n) && n > 0;

/* ----------------------------- GET schema -------------------------- */
const ListQuery = z.object({
  q: z.string().optional(),
  status: z.enum(["all", "publish", "draft", "pending", "trash", "future"]).optional(),
  authorId: z.coerce.number().int().positive().optional(),
  categoryTtxId: z.coerce.number().int().positive().optional(),
  categorySlug: z.string().optional(),
  yearMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(), // YYYY-MM
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
  orderBy: z.enum(["date", "title"]).default("date"),
  order: z.enum(["asc", "desc"]).default("desc"),
  format: z.string().optional(),
  slug: z.string().optional(),
});

/* GET /api/r2/posts */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const rawParams = Object.fromEntries(url.searchParams);
    const q = ListQuery.parse(rawParams);

    const result = await listPostsRepo({
      q: q.q ?? "",
      status: (q.status ?? "all") as any,
      authorId: q.authorId,
      categoryTtxId: q.categoryTtxId,
      categorySlug: q.categorySlug || undefined,
      yearMonth: q.yearMonth,
      page: q.page,
      perPage: q.perPage,
      orderBy: q.orderBy,
      order: q.order,
      slug: q.slug,
    });

    return json(result);
  } catch (e: any) {
    if (e instanceof ZodError) {
      return json({ error: "Validation failed", issues: e.flatten(), message: "Invalid query parameters" }, { status: 422 });
    }
    return json({ error: e?.message || "Bad request", message: "Failed to fetch posts" }, { status: 400 });
  }
}

/* ----------------------------- POST schema ------------------------- */
const DatetimeLocalOrISO = z.union([
  z.string().datetime({ offset: true }),
  z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
]).refine((val) => {
  try { return !Number.isNaN(new Date(val).getTime()); } catch { return false; }
}, { message: "Invalid date format. Use ISO or datetime-local" });

const GalleryItemSchema = z.object({
  id: z.coerce.number().int().positive(),
  url: z.string().optional(),
});

const CreateSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  content: z.string().default(""),
  excerpt: z.string().default("").optional(),
  status: z.enum(["publish", "draft", "pending", "future"]).default("draft").optional(),
  slug: z.string().optional(),

  categoryTtxIds: z.array(z.coerce.number().int().positive()).default([]).optional(),

  // allow array or comma-separated string
  tagNames: z.union([
    z.array(z.string().min(1)),
    z.string().transform((s) => s.split(",").map((t) => t.trim()).filter(Boolean)),
  ]).default([]).optional(),

  featuredImageId: z.coerce.number().int().positive().optional(),
  authorId: z.coerce.number().int().positive().optional(),

  // EXTRA
  subtitle: z.string().default("").optional(),
  highlight: z.string().default("").optional(),
  format: z.enum(["standard", "gallery", "video"]).default("standard").optional(),
  gallery: z.array(z.union([z.coerce.number().int().positive(), GalleryItemSchema])).default([]).optional(),
  videoEmbed: z.string().default("").optional(),

  // Schedule
  scheduledAt: DatetimeLocalOrISO.optional(),

  // Optional TTS intent (used AFTER repo create; not part of repo input)
  audio: z.object({
    generate: z.boolean().optional(),
    lang: z.string().optional(),
    overwrite: z.boolean().optional(),
  }).partial().optional(),
}).refine((data) => !(data.format === "video" && !toStr(data.videoEmbed).trim()), {
  message: "Video embed code is required for video format",
  path: ["videoEmbed"],
});

/* POST /api/r2/posts */
export async function POST(req: Request) {
  try {
    // AuthN
    const session = await getServerSession(authOptions);
    const sessionUid = Number((session as any)?.user?.id || 0);
    if (!session || !sessionUid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse JSON
    let raw: any;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }
    if (!raw?.title || !String(raw.title).trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 422 });
    }

    // Prepare tolerantly for Zod
    const prepared = {
      ...raw,
      title: toStr(raw.title).trim(),
      content: toStr(raw.content, ""),
      excerpt: toStr(raw.excerpt, ""),
      categoryTtxIds: Array.isArray(raw.categoryTtxIds)
        ? raw.categoryTtxIds.map(toNum).filter(isPosNum)
        : [],
      tagNames: Array.isArray(raw.tagNames) || typeof raw.tagNames === "string" ? raw.tagNames : [],
      featuredImageId: toNum(raw.featuredImageId),
      authorId: toNum(raw.authorId),
      subtitle: toStr(raw.subtitle, ""),
      highlight: toStr(raw.highlight, ""),
      format: toStr(raw.format, "standard"),
      gallery: Array.isArray(raw.gallery) ? raw.gallery : [],
      videoEmbed: toStr(raw.videoEmbed, ""),
      scheduledAt: raw.scheduledAt,
      slug: toOptStr(raw.slug),
      audio: raw.audio && typeof raw.audio === "object" ? raw.audio : undefined,
    };

    let data: z.infer<typeof CreateSchema>;
    try {
      data = CreateSchema.parse(prepared);
    } catch (err) {
      if (err instanceof ZodError) {
        return NextResponse.json(
          { error: "Validation failed", issues: err.flatten(), message: "Invalid input data" },
          { status: 422 }
        );
      }
      return NextResponse.json({ error: "Invalid input" }, { status: 422 });
    }

    // DB connectivity warm-up
    try {
      await query("SELECT 1");
    } catch (dbErr) {
      console.error("[posts.create] DB check failed:", dbErr);
      return NextResponse.json(
        { error: "Database connection failed. Check DB env/instance." },
        { status: 500 }
      );
    }

    // AuthZ + role policy
    const admin = await isAdmin(sessionUid);
    const effectiveAuthorId = admin && data.authorId ? data.authorId : sessionUid;

    const meta = await query<{ meta_value: string }>(
      `SELECT meta_value
         FROM wp_usermeta
        WHERE user_id=? AND meta_key LIKE '%capabilities'
        LIMIT 1`,
      [sessionUid]
    ).catch(() => []);
    const caps = meta?.[0]?.meta_value?.toLowerCase() || "";
    const role =
      caps.includes("administrator") ? "administrator" :
      caps.includes("editor")        ? "editor" :
      caps.includes("author")        ? "author" :
      caps.includes("contributor")   ? "contributor" : "subscriber";

    let effectiveStatus = (data.status ?? "draft") as "publish" | "draft" | "pending" | "future";
    if (role === "contributor") effectiveStatus = "pending";
    else if (role === "subscriber") effectiveStatus = "draft";

    if (data.scheduledAt) {
      const when = new Date(data.scheduledAt);
      if (Number.isFinite(when.getTime()) && when.getTime() > Date.now()) {
        effectiveStatus = "future";
      }
    }

    // Server-side slug fallback
    const serverSlug =
      data.slug && data.slug.trim().length
        ? slugify(data.slug, { keepUnicode: false })
        : slugify(data.title, { keepUnicode: false });

    // Create in repo — NOTE: no `audio` property here (fixes your error)
    const created = await createPostRepo({
      authorId: effectiveAuthorId,
      title: data.title,
      content: data.content,
      excerpt: data.excerpt,
      status: effectiveStatus,
      slug: serverSlug,
      categoryTtxIds: data.categoryTtxIds,
      tagNames: Array.isArray(data.tagNames) ? data.tagNames : [],
      featuredImageId: data.featuredImageId,
      subtitle: data.subtitle,
      highlight: data.highlight,
      format: data.format,
      gallery: data.gallery,
      videoEmbed: data.videoEmbed,
      scheduledAt: data.scheduledAt,
    });

    // Optionally queue TTS AFTER create (non-fatal if it fails)
    try {
      const shouldQueue =
        !!data.audio?.generate &&
        (effectiveStatus === "publish" || effectiveStatus === "future") &&
        created &&
        typeof (created as any).id === "number";

      if (shouldQueue) {
        const origin = new URL(req.url).origin;
        await fetch(`${origin}/api/r2/tts/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            postId: (created as any).id,
            lang: data.audio?.lang,
            overwrite: data.audio?.overwrite ?? false,
          }),
        }).catch(() => {});
      }
    } catch (ttsErr) {
      console.warn("[posts.create] TTS queue failed (non-fatal):", ttsErr);
    }

    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    const msg = String(e?.message || "");
    console.error("[posts.create] error:", e);

    if (/Duplicate entry|ER_DUP_ENTRY/i.test(msg)) {
      return NextResponse.json({ error: "A post with this slug already exists" }, { status: 409 });
    }
    if (/Foreign key constraint|foreign key/i.test(msg)) {
      return NextResponse.json({ error: "Invalid author or category reference" }, { status: 400 });
    }
    return NextResponse.json({ error: "Create failed. Please try again." }, { status: 500 });
  }
}

/* ----------------------------- OPTIONS ----------------------------- */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
