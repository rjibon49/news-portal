// src/app/api/r2/posts/popular/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getPopularPostsRepo } from "@/db/repo/post-views.repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// --- query validation
const Query = z.object({
  range: z.enum(["1d", "7d", "30d", "all"]).default("7d"),
  limit: z
    .string()
    .optional()
    .transform((v) => {
      const n = Number(v ?? 10);
      if (!Number.isFinite(n)) return 10;
      return Math.min(Math.max(n, 1), 50); // 1..50
    }),
  // optional future hooks:
  // status: z.enum(["publish", "draft", "pending", "future", "all"]).default("publish"),
  // categorySlug: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = Query.parse({
      range: url.searchParams.get("range") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      // status: url.searchParams.get("status") ?? undefined,
      // categorySlug: url.searchParams.get("categorySlug") ?? undefined,
    });

    const rows = await getPopularPostsRepo({
      range: q.range,
      limit: q.limit as number,
      // (optional) pass-through when you extend the repo later:
      // status: q.status,
      // categorySlug: q.categorySlug,
    });

    return NextResponse.json(
      { range: q.range, rows },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    // zod errors → 422 to help client UIs
    if (e?.issues) {
      return NextResponse.json({ error: "Invalid query", issues: e.issues }, { status: 422 });
    }
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 400 });
  }
}

// Optional: CORS preflight (handy if you hit this from other origins)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
