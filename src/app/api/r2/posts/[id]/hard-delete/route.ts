// src/app/api/r2/posts/[id]/hard-delete/route.ts
// -----------------------------------------------------------------------------
// Optional: hard delete via POST (যদি UI আলাদা এন্ডপয়েন্ট চায়)
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { isAdmin } from "@/lib/auth/isAdmin";

// ✅ Updated to modular barrel import
import { hardDeletePostRepo } from "@/db/repo/posts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const postId = Number(id);
  if (!Number.isFinite(postId) || postId <= 0) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  const uid = Number((session as any)?.user?.id || 0);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(uid))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await hardDeletePostRepo(postId);
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
