// src/app/api/r2/ads/metrics/summary/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/db/mysql";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { isAdmin } from "@/lib/auth/isAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Q = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slotId: z.string().optional(),
  creativeId: z.string().optional(),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const uid = Number((session as any)?.user?.id || 0);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(uid))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const p = Q.safeParse(Object.fromEntries(url.searchParams));
  if (!p.success) {
    return NextResponse.json({ error: "Invalid query", issues: p.error.flatten() }, { status: 422 });
  }

  const { from, to, slotId, creativeId } = p.data;

  const conds: string[] = ["ymd BETWEEN ? AND ?"];
  const args: any[] = [from, to];

  if (slotId) { conds.push("slot_id = ?"); args.push(Number(slotId)); }
  if (creativeId) { conds.push("creative_id = ?"); args.push(Number(creativeId)); }

  const where = conds.join(" AND ");

  const rows = await query<any>(
    `
    SELECT ymd,
           SUM(impressions) AS impressions,
           SUM(clicks)      AS clicks
      FROM wp_ad_stats_daily
     WHERE ${where}
     GROUP BY ymd
     ORDER BY ymd ASC
    `,
    args
  );

  const data = rows.map((r: any) => ({
    ymd: r.ymd,
    impressions: Number(r.impressions || 0),
    clicks: Number(r.clicks || 0),
  }));

  return NextResponse.json({ rows: data }, { headers: { "Cache-Control": "no-store" } });
}
