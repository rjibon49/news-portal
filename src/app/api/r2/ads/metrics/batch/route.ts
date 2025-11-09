// src/app/api/r2/ads/metrics/batch/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/db/mysql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  events: z.array(z.object({
    type: z.enum(["imp", "click"]),
    placement_id: z.number().int().positive(),
    creative_id: z.number().int().positive().optional(),
    ts: z.string().datetime().optional(),
    ua: z.string().max(255).optional(),
    slot_id: z.number().int().positive().optional(),   // ← allow slot_id if you have it handy
  })).min(1).max(200),
});

function ymdBD(d = new Date()) {
  // if you prefer UTC days, change the offset
  const bd = new Date(d.getTime() + 6 * 60 * 60 * 1000);
  return bd.toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  const raw = await req.json().catch(() => ({}));
  const p = Body.safeParse(raw);
  if (!p.success) {
    return NextResponse.json({ error: "Invalid payload", issues: p.error.flatten() }, { status: 422 });
  }

  const imp = p.data.events.filter(e => e.type === "imp");
  const clk = p.data.events.filter(e => e.type === "click");

  if (imp.length) {
    const values = imp.map(e => [
      e.placement_id, e.creative_id ?? null, e.ua ?? "", e.ts ? new Date(e.ts) : new Date(),
    ]);
    await query(`INSERT INTO wp_ad_impression (placement_id, creative_id, user_agent, ts) VALUES ?`, [values]);
  }

  if (clk.length) {
    const values = clk.map(e => [
      e.placement_id, e.creative_id ?? null, e.ua ?? "", e.ts ? new Date(e.ts) : new Date(),
    ]);
    await query(`INSERT INTO wp_ad_click (placement_id, creative_id, user_agent, ts) VALUES ?`, [values]);
  }

  // ---- Mirror into wp_ad_stats_daily (optional but recommended) ----
  if (imp.length || clk.length) {
    // resolve slot_id via placement_id when not provided
    const all = [...imp, ...clk];
    const byKey = new Map<string, { ymd: string; slot_id: number; creative_id: number; imp: number; clk: number }>();

    // fetch placement -> slot map for all involved placement_ids (one round trip)
    const pids = Array.from(new Set(all.map(e => e.placement_id)));
    const mapRows = await query<{ id: number; slot_id: number }>(
      `SELECT id, slot_id FROM wp_ad_placement WHERE id IN (${pids.map(() => "?").join(",")})`,
      pids
    );
    const pidToSlot = new Map(mapRows.map(r => [r.id, r.slot_id]));

    for (const e of all) {
      const dt = e.ts ? new Date(e.ts) : new Date();
      const y = ymdBD(dt);
      const slotId = e.slot_id ?? pidToSlot.get(e.placement_id) ?? 0;
      const cid = e.creative_id ?? 0;
      const k = `${y}|${slotId}|${cid}`;
      if (!byKey.has(k)) byKey.set(k, { ymd: y, slot_id: slotId, creative_id: cid, imp: 0, clk: 0 });
      const rec = byKey.get(k)!;
      if (e.type === "imp") rec.imp += 1;
      else rec.clk += 1;
    }

    for (const r of byKey.values()) {
      await query(
        `INSERT INTO wp_ad_stats_daily (ymd, slot_id, creative_id, impressions, clicks, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           impressions = impressions + VALUES(impressions),
           clicks      = clicks + VALUES(clicks),
           updated_at  = NOW()`,
        [r.ymd, r.slot_id, r.creative_id, r.imp, r.clk]
      );
    }
  }

  return NextResponse.json({ ok: true, imp: imp.length, click: clk.length });
}
