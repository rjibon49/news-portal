// src/app/api/r2/posts/route.ts
// -----------------------------------------------------------------------------
// Posts collection route
// - GET  : পোস্ট লিস্ট (filter + paginate + sort)
// - POST : নতুন পোস্ট তৈরি (EXTRA -> wp_post_extra সহ)
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { isAdmin } from "@/lib/auth/isAdmin";

// ✅ Repo (barrel import)
import { createPostRepo, listPostsRepo } from "@/db/repo/posts";

// ✅ DB util (WP role lookup এর জন্য)
import { query } from "@/db/mysql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// -----------------------------------------------------------------------------
// [Schema] GET query validation
// -----------------------------------------------------------------------------
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
  // NOTE: repo এখন format ফিল্টার নেয় না; রাখা হলো future use-এর জন্য
  format: z.string().optional(),
});

// -----------------------------------------------------------------------------
// GET /api/r2/posts
// -----------------------------------------------------------------------------
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
      // format: q.format, // enable in repo when needed
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    });
  } catch (e: any) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Validation failed",
          issues: e.flatten(),
          message: "Invalid query parameters",
        },
        { status: 422 }
      );
    }
    return NextResponse.json(
      {
        error: e?.message || "Bad request",
        message: "Failed to fetch posts",
      },
      { status: 400 }
    );
  }
}

// -----------------------------------------------------------------------------
// [Schema] POST body validation
// -----------------------------------------------------------------------------
const DatetimeLocalOrISO = z
  .union([
    z.string().datetime({ offset: true }),
    z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
    z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
  ])
  .refine((val) => {
    try {
      const d = new Date(val);
      return !isNaN(d.getTime());
    } catch {
      return false;
    }
  }, { message: "Invalid date format. Use ISO format or datetime-local" });

const GalleryItemSchema = z.object({
  id: z.coerce.number().int().positive(),
  url: z.string().optional(),
});

const CreateSchema = z
  .object({
    title: z.string().min(1).max(200).trim(),
    content: z.string().default(""),
    excerpt: z.string().optional().default(""),
    status: z.enum(["publish", "draft", "pending", "future"]).optional().default("draft"),
    slug: z.string().optional(),

    // NaN/""/null-safe parsing
    categoryTtxIds: z.array(z.coerce.number().int().positive()).optional().default([]),
    tagNames: z.array(z.string().min(1)).optional().default([]),
    featuredImageId: z.coerce.number().int().positive().optional(),

    // (ঐচ্ছিক) Admin হলে author override করা যাবে
    authorId: z.coerce.number().int().positive().optional(),

    // --- EXTRA
    subtitle: z.string().optional().default(""),
    highlight: z.string().optional().default(""),
    format: z.enum(["standard", "gallery", "video"]).optional().default("standard"),
    gallery: z
      .array(z.union([z.coerce.number().int().positive(), GalleryItemSchema]))
      .optional()
      .default([]),
    videoEmbed: z.string().optional().default(""),

    // --- Schedule
    scheduledAt: DatetimeLocalOrISO.optional(),
  })
  .refine(
    (data) => !(data.format === "video" && !data.videoEmbed?.trim()),
    { message: "Video embed code is required for video format", path: ["videoEmbed"] }
  );

// -----------------------------------------------------------------------------
// POST /api/r2/posts
// -----------------------------------------------------------------------------
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sessionUid = Number((session as any)?.user?.id || 0);
    if (!sessionUid) return NextResponse.json({ error: "Invalid user session" }, { status: 401 });

    let raw: any;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    if (!raw.title || !String(raw.title).trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 422 });
    }

    let data: z.infer<typeof CreateSchema>;
    try {
      data = CreateSchema.parse({
        ...raw,
        title: String(raw.title).trim(),
        content: raw.content ?? "",
        excerpt: raw.excerpt ?? "",
        categoryTtxIds: Array.isArray(raw.categoryTtxIds)
          ? raw.categoryTtxIds.map((id: any) => Number(id)).filter((n: number) => n > 0)
          : [],
        tagNames: Array.isArray(raw.tagNames)
          ? raw.tagNames.filter((tag: string) => tag && tag.trim())
          : [],
        featuredImageId: raw.featuredImageId ? Number(raw.featuredImageId) : undefined,
        authorId: raw.authorId ? Number(raw.authorId) : undefined,
        subtitle: raw.subtitle ?? "",
        highlight: raw.highlight ?? "",
        format: raw.format ?? "standard",
        gallery: Array.isArray(raw.gallery) ? raw.gallery : [],
        videoEmbed: raw.videoEmbed ?? "",
        scheduledAt: raw.scheduledAt,
      });
    } catch (zodError) {
      if (zodError instanceof ZodError) {
        return NextResponse.json(
          {
            error: "Validation failed",
            issues: zodError.flatten(),
            message: "Invalid input data",
          },
          { status: 422 }
        );
      }
      return NextResponse.json({ error: "Invalid input" }, { status: 422 });
    }

    // ─────────────────────────────────────────────────────────────
    // AuthZ + Role policy
    // ─────────────────────────────────────────────────────────────
    const admin = await isAdmin(sessionUid);

    // Admin হলে authorId override করতে পারে; নাহলে নিজেরটিই
    const effectiveAuthorId = admin && data.authorId ? data.authorId : sessionUid;

    // WP role resolve (session user অনুযায়ী — কে ক্লিক করল সেটাই ম্যাটার করে)
    const meta = await query<{ meta_value: string }>(
      `SELECT meta_value 
         FROM wp_usermeta 
        WHERE user_id=? AND meta_key LIKE '%capabilities' 
        LIMIT 1`,
      [sessionUid]
    );
    const caps = meta[0]?.meta_value?.toLowerCase() || "";
    const role =
      caps.includes("administrator") ? "administrator" :
      caps.includes("editor")        ? "editor" :
      caps.includes("author")        ? "author" :
      caps.includes("contributor")   ? "contributor" : "subscriber";

    // Status policy:
    // - administrator/editor/author  → UI থেকে যা এসেছে (publish/pending/draft/future)
    // - contributor                  → সবসময় 'pending'
    // - subscriber                   → সবসময় 'draft'
    let effectiveStatus = data.status;
    if (role === "contributor") effectiveStatus = "pending";
    else if (role === "subscriber") effectiveStatus = "draft";

    // (Schedule future হলে repo ভিতরে চাইলে 'future' ঠিক করে নিতে পারে)

    const created = await createPostRepo({
      authorId: effectiveAuthorId,
      title: data.title,
      content: data.content,
      excerpt: data.excerpt,
      status: effectiveStatus,
      slug: data.slug,
      categoryTtxIds: data.categoryTtxIds,
      tagNames: data.tagNames,
      featuredImageId: data.featuredImageId,
      subtitle: data.subtitle,
      highlight: data.highlight,
      format: data.format,
      gallery: data.gallery,
      videoEmbed: data.videoEmbed,
      scheduledAt: data.scheduledAt,
    });

    return NextResponse.json(created, {
      status: 201,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    });
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (msg.includes("Duplicate entry") || msg.includes("ER_DUP_ENTRY")) {
      return NextResponse.json(
        { error: "A post with this slug already exists" },
        { status: 409 }
      );
    }
    if (msg.includes("Foreign key constraint")) {
      return NextResponse.json(
        { error: "Invalid author or category reference" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: e?.message || "Create failed", message: "Failed to create post" },
      { status: 400 }
    );
  }
}

// -----------------------------------------------------------------------------
// OPTIONS (CORS preflight)
// -----------------------------------------------------------------------------
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
