// src/app/api/r2/posts/[id]/trash/route.ts
// -----------------------------------------------------------------------------
// Move a post to Trash
// - POST /api/r2/posts/:id/trash
// Policy:
//   - Admin: যেকোনো পোস্ট ট্র্যাশে পাঠাতে পারবে
//   - Non-admin: শুধু নিজের পোস্ট ট্র্যাশে পাঠাতে পারবে
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { isAdmin } from "@/lib/auth/isAdmin";
import { query } from "@/db/mysql";
import { movePostToTrashRepo } from "@/db/repo/posts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// helper: author id
async function getPostAuthorId(postId: number): Promise<number | null> {
  const rows = await query<{ post_author: number }>(
    `SELECT post_author FROM wp_posts WHERE ID = ? LIMIT 1`,
    [postId]
  );
  return rows[0]?.post_author ?? null;
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const postId = Number(id);
    if (!Number.isFinite(postId) || postId <= 0) {
      return NextResponse.json({ error: "Bad id" }, { status: 400 });
    }

    // session
    const session = await getServerSession(authOptions);
    const uid = Number((session as any)?.user?.id || 0);
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // authZ
    const admin = await isAdmin(uid);
    if (!admin) {
      const authorId = await getPostAuthorId(postId);
      if (!authorId) return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (authorId !== uid) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // already trashed? repo handles idempotently, তবু কল করি
    await movePostToTrashRepo(postId);

    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to move to trash" },
      { status: 400 }
    );
  }
}
