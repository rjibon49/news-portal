// src/app/api/r2/ads/slots/[id]/toggle/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/db/mysql";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { isAdmin } from "@/lib/auth/isAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ enabled: z.boolean() });

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const slotId = Number(id);
  if (!Number.isFinite(slotId) || slotId <= 0) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  const uid = Number((session as any)?.user?.id || 0);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(uid))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const raw = await req.json().catch(() => ({}));
  const p = Body.safeParse(raw);
  if (!p.success) {
    return NextResponse.json({ error: "Invalid payload", issues: p.error.flatten() }, { status: 422 });
  }

  await query(`UPDATE wp_ad_slot SET enabled=?, updated_at=NOW() WHERE id=? LIMIT 1`, [
    p.data.enabled ? 1 : 0,
    slotId,
  ]);
  return NextResponse.json({ ok: true });
}
