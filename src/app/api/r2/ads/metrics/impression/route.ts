// src/app/api/r2/ads/metrics/impression/route.ts
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { query } from "@/db/mysql";
import { trackImpressionRepo } from "@/db/repo/ads/ads.metrics.repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  slot_id: z.number().int().positive(),
  placement_id: z.number().int().positive().optional(),
  creative_id: z.number().int().nonnegative().optional(),
  uid: z.string().uuid().optional(),
  sid: z.string().uuid().optional(),
  vis_ms: z.number().int().optional(),
  vw: z.any().optional(),
}).passthrough();

function clientIp(req: Request) {
  const xff = req.headers.get("x-forwarded-for");
  return (xff?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "") as string;
}

// YYYY-MM-DD (Asia/Dhaka)
function ymdDhaka(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(d);
}

export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => ({}));
    const data = Body.parse(raw);

    const ua = req.headers.get("user-agent") || "";
    const ip = clientIp(req);

    // 1) লগ টেবিলে লিখি; UNIQUE index থাকলে ডুপ্লিকেট ইগনোর হবে
    const res: any = await query(
      `INSERT IGNORE INTO wp_ad_impression
         (placement_id, creative_id, user_agent, ts, uid, sid, ip)
       VALUES (?, ?, ?, NOW(), ?, ?, INET6_ATON(?))`,
      [data.placement_id ?? null, data.creative_id ?? null, ua, data.uid ?? null, data.sid ?? null, ip]
    );

    const dedup = res?.affectedRows === 0;

    // 2) ডেল্টা অ্যাগ্রিগেশন: শুধু নতুন ইন্সার্ট হলে দৈনিক টেবিল আপডেট করো
    if (!dedup) {
      await trackImpressionRepo(data.slot_id, data.creative_id ?? 0, ymdDhaka());
    }

    return NextResponse.json({ ok: true, dedup }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: "Invalid payload", issues: e.flatten() }, { status: 422 });
    }
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 400 });
  }
}
