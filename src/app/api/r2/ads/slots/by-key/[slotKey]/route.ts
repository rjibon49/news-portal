// src/app/api/r2/ads/slots/by-key/[slotKey]/route.ts
import { NextResponse } from "next/server";
import { query } from "@/db/mysql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ছোট util: 0/1 → boolean
const isOn = (v: any) => v === 1 || v === true;

type SlotRow = {
  id: number;
  slot_key: string;
  name: string;
  enabled: number;          // TINYINT(1)
  max_ads: number | null;
  created_at: string | Date;
  updated_at: string | Date;
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slotKey: string }> }
) {
  const { slotKey } = await ctx.params;

  // ✅ এখানে query<SlotRow>(...) — জেনেরিক টাইপ দিন
  const rows = await query<SlotRow>(
    `
    SELECT id, slot_key, name, enabled, max_ads, created_at, updated_at
      FROM wp_ad_slot
     WHERE slot_key = ?
     LIMIT 1
    `,
    [slotKey]
  );

  if (!rows[0]) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const s = rows[0];
  return NextResponse.json({
    slot: {
      id: s.id,
      slot_key: s.slot_key,
      name: s.name,
      enabled: isOn(s.enabled),
      max_ads: s.max_ads,
      created_at: s.created_at,
      updated_at: s.updated_at,
    },
  });
}
