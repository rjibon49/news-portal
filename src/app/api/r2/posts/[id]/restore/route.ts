// src/app/api/r2/posts/[id]/restore/route.ts
// -----------------------------------------------------------------------------
// Restore a post from Trash
// - POST /api/r2/posts/:id/restore → admin-only, পূর্বের status-এ ফিরিয়ে দেয়
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { isAdmin } from "@/lib/auth/isAdmin";

// ✅ Updated to modular barrel import
import { restorePostFromTrashRepo } from "@/db/repo/posts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ Next.js 15: await params
    const { id } = await ctx.params;
    const postId = Number(id);
    if (!Number.isFinite(postId) || postId <= 0) {
      return NextResponse.json({ error: "Bad id" }, { status: 400 });
    }

    // 🔐 admin guard
    const session = await getServerSession(authOptions);
    const uid = Number((session as any)?.user?.id || 0);
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(uid))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // ♻️ restore (repo আগে trash-এ থাকা status থেকে ফিরিয়ে দেয়)
    await restorePostFromTrashRepo(postId);

    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to restore" },
      { status: e?.status ?? 400 }
    );
  }
}
