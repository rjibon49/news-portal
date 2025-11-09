// src/app/api/r2/ads/pick/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/db/mysql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// small helpers
const isOn = (v: any) => (v === 1 || v === true ? 1 : 0);

/** weighted random */
function weightedPick<T extends { weight: number }>(items: T[]): T | null {
  const total = items.reduce((sum, it) => sum + Math.max(0, it.weight || 0), 0);
  if (!total) return items[0] ?? null;
  let r = Math.random() * total;
  for (const it of items) {
    r -= Math.max(0, it.weight || 0);
    if (r <= 0) return it;
  }
  return items[0] ?? null;
}

const Q = z.object({
  slotKey: z.string().min(1),
});

/**
 * GET /api/r2/ads/pick?slotKey=HERO_BEFORE_TITLE
 * - slot enabled হতে হবে
 * - active প্লেসমেন্ট + creative থেকে weighted pick
 * - clicks/impressions আলাদা রুটে (আপনার কাছে ইতিমধ্যেই আছে)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const p = Q.safeParse(Object.fromEntries(url.searchParams));
  if (!p.success) {
    return NextResponse.json({ error: "Invalid query", issues: p.error.flatten() }, { status: 422 });
  }
  const { slotKey } = p.data;

  // slot must be enabled
  const slotRows = await query<{ id: number; slot_key: string; enabled: number }>(
    `SELECT id, slot_key, enabled
       FROM wp_ad_slot
      WHERE slot_key = ?
      LIMIT 1`,
    [slotKey]
  );
  const slot = slotRows[0];
  if (!slot || !isOn(slot.enabled)) {
    return NextResponse.json({ error: "Slot not found or disabled" }, { status: 404 });
  }

  // active placements joined with creatives
  const rows = await query<{
    placement_id: number;
    weight: number;
    // creative
    creative_id: number;
    name: string;
    type: "html" | "image";
    html: string | null;
    image_url: string | null;
    click_url: string | null;
    target_blank: number;
  }>(
    `
    SELECT
      p.id AS placement_id,
      p.weight,
      c.id AS creative_id, c.name, c.type, c.html, c.image_url, c.click_url, c.target_blank
    FROM wp_ad_placement p
    JOIN wp_ad_creative c ON c.id = p.creative_id
    WHERE p.slot_id = ?
      AND p.is_active = 1
      AND (p.active_from IS NULL OR p.active_from <= NOW())
      AND (p.active_to   IS NULL OR p.active_to   >= NOW())
      AND c.is_active = 1
      AND (c.active_from IS NULL OR c.active_from <= NOW())
      AND (c.active_to   IS NULL OR c.active_to   >= NOW())
  `,
    [slot.id]
  );

  if (!rows.length) {
    return NextResponse.json({ error: "No active creatives" }, { status: 404 });
  }

  const picked = weightedPick(rows);
  if (!picked) {
    return NextResponse.json({ error: "Pick failed" }, { status: 500 });
  }

  return NextResponse.json({
    slot: { id: slot.id, key: slot.slot_key },
    placement: { id: picked.placement_id, weight: picked.weight },
    creative: {
      id: picked.creative_id,
      name: picked.name,
      type: picked.type,
      html: picked.html,
      image_url: picked.image_url,
      click_url: picked.click_url,
      target_blank: isOn(picked.target_blank) === 1,
    },
  });
}
