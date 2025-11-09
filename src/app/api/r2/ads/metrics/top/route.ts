// src/app/api/r2/ads/metrics/top/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/db/mysql";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { isAdmin } from "@/lib/auth/isAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Q = z.object({
  kind: z.enum(["slot", "creative"]),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  limit: z.string().optional(),
  slotId: z.string().optional(),
  creativeId: z.string().optional(),
});

function toInt(v: string | undefined, fallback = 10) {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function GET(req: Request) {
  try {
    // (same auth model as summary)
    const session = await getServerSession(authOptions);
    const uid = Number((session as any)?.user?.id || 0);
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(uid))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const url = new URL(req.url);
    const { kind, from, to, limit, slotId, creativeId } = Q.parse(Object.fromEntries(url.searchParams));
    const rowLimit = toInt(limit, 10);

    const conds: string[] = ["d.ymd BETWEEN ? AND ?"];
    const args: any[] = [from, to];

    if (slotId) { conds.push("d.slot_id = ?"); args.push(Number(slotId)); }
    if (creativeId) { conds.push("d.creative_id = ?"); args.push(Number(creativeId)); }

    const WHERE = conds.join(" AND ");

    let rows: any[] = [];
    if (kind === "slot") {
      rows = await query<any>(
        `
        SELECT s.id, s.name, s.slot_key,
               SUM(d.impressions) AS impressions,
               SUM(d.clicks)      AS clicks
          FROM wp_ad_stats_daily d
          JOIN wp_ad_slot s ON s.id = d.slot_id
         WHERE ${WHERE}
         GROUP BY s.id, s.name, s.slot_key
         ORDER BY impressions DESC, clicks DESC
         LIMIT ?
        `,
        [...args, rowLimit]
      );
    } else {
      rows = await query<any>(
        `
        SELECT c.id, c.name,
               SUM(d.impressions) AS impressions,
               SUM(d.clicks)      AS clicks
          FROM wp_ad_stats_daily d
          JOIN wp_ad_creative c ON c.id = d.creative_id
         WHERE ${WHERE}
         GROUP BY c.id, c.name
         ORDER BY impressions DESC, clicks DESC
         LIMIT ?
        `,
        [...args, rowLimit]
      );
    }

    const data = rows.map((r) => ({
      id: Number(r.id),
      name: r.name,
      slot_key: r.slot_key,
      impressions: Number(r.impressions) || 0,
      clicks: Number(r.clicks) || 0,
    }));

    return NextResponse.json({ rows: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 400 });
  }
}
