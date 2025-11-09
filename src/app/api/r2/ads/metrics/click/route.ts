// src/app/api/r2/ads/metrics/click/route.ts
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { trackClickRepo } from "@/db/repo/ads/ads.metrics.repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  slot_id: z.number().int().positive(),          // <-- REQUIRED
  creative_id: z.number().int().positive(),      // <-- REQUIRED
  placement_id: z.number().int().positive().optional(), // optional passthrough
});

function ymdDhaka(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(d);
}

export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => ({}));
    const data = Body.parse(raw);

    // repo signature: (slotId, creativeId, ymd?)
    await trackClickRepo(data.slot_id, data.creative_id, ymdDhaka());

    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: "Invalid payload", issues: e.flatten() }, { status: 422 });
    }
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 400 });
  }
}
