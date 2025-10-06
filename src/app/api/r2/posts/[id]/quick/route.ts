// src/app/api/r2/posts/quick/route.ts
// -----------------------------------------------------------------------------
// Quick Edit endpoint (list view থেকে)
// - PATCH /api/r2/posts/quick
// Body: { id, title?, slug?, status?, categoryTtxIds?, tagTtxIds? }
// Policy:
//   - Admin: সব করতে পারবে
//   - Non-admin: নিজের পোস্ট হলে OK, তবে status শুধু 'draft' করা যাবে
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { isAdmin } from "@/lib/auth/isAdmin";
import { query } from "@/db/mysql";

// ✅ Updated to modular barrel import
import { quickEditPostRepo } from "@/db/repo/posts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// পোস্টের author বের করা (authZ এর জন্য)
async function getPostAuthorId(postId: number): Promise<number | null> {
  const rows = await query<{ post_author: number }>(
    `SELECT post_author FROM wp_posts WHERE ID = ? LIMIT 1`,
    [postId]
  );
  return rows[0]?.post_author ?? null;
}

// ✅ body ভ্যালিডেশন
const Schema = z.object({
  id: z.coerce.number().int().positive(),
  title: z.string().max(200).optional(),
  slug: z.string().max(190).optional(),
  status: z.enum(["publish", "draft", "pending"]).optional(),
  categoryTtxIds: z.array(z.coerce.number().int().positive()).optional(),
  tagTtxIds: z.array(z.coerce.number().int().positive()).optional(),
});

export async function PATCH(req: Request) {
  try {
    // 🔐 session
    const session = await getServerSession(authOptions);
    const uid = Number((session as any)?.user?.id || 0);
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 📨 payload
    const body = await req.json().catch(() => ({}));
    const data = Schema.parse(body);

    // 🔐 authZ
    const admin = await isAdmin(uid);
    if (!admin) {
      const authorId = await getPostAuthorId(data.id);
      if (!authorId) return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (authorId !== uid) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      // non-admin status কেবল draft করা যাবে
      if (data.status && data.status !== "draft") {
        return NextResponse.json({ error: "Only admin can change status" }, { status: 403 });
      }
    }

    // 🗃️ repo call
    await quickEditPostRepo({
      id: data.id,
      title: data.title,
      slug: data.slug,
      status: data.status,
      categoryTtxIds: data.categoryTtxIds,
      tagTtxIds: data.tagTtxIds,
    });

    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid payload", issues: e.flatten() },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { error: e?.message || "Quick edit failed" },
      { status: 400 }
    );
  }
}
