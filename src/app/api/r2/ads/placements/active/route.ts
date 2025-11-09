// src/app/api/r2/ads/placements/active/route.ts
import { NextResponse } from "next/server";
import { query } from "@/db/mysql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/r2/ads/placements/active?slotKey=beforeImage */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const slotKey = (url.searchParams.get("slotKey") || "").trim();
    if (!slotKey) {
      return NextResponse.json({ error: "slotKey required" }, { status: 400 });
    }

    // Active placements + creative joined; both sides must be active
    const rows = await query<any>(
      `
      SELECT
        p.id          AS placement_id,
        p.slot_id     AS slot_id,
        p.creative_id AS creative_id,
        COALESCE(p.weight, 1) AS weight,

        s.slot_key    AS slot_key,

        c.name        AS name,
        c.type        AS type,
        c.html        AS html,
        c.image_url   AS image_url,
        c.click_url   AS click_url,
        c.target_blank AS target_blank,
        c.active_from AS c_active_from,
        c.active_to   AS c_active_to,
        c.is_active   AS c_is_active

      FROM wp_ad_placement p
      JOIN wp_ad_slot s      ON s.id = p.slot_id
      JOIN wp_ad_creative c  ON c.id = p.creative_id
      WHERE s.slot_key = ?
        AND s.enabled = 1
        AND p.is_active = 1
        AND (p.active_from IS NULL OR p.active_from <= NOW())
        AND (p.active_to   IS NULL OR p.active_to   >= NOW())
        AND c.is_active = 1
        AND (c.active_from IS NULL OR c.active_from <= NOW())
        AND (c.active_to   IS NULL OR c.active_to   >= NOW())
      `,
      [slotKey]
    );

    if (!rows.length) {
      // keep shape stable so client can show debug if needed
      return NextResponse.json({ row: null, reason: "no-active" }, { headers: { "Cache-Control": "no-store" } });
    }

    // weighted random pick
    const total = rows.reduce((s, r) => s + (Number(r.weight) || 1), 0);
    let t = Math.random() * total;
    let chosen = rows[0];
    for (const r of rows) {
      t -= (Number(r.weight) || 1);
      if (t <= 0) { chosen = r; break; }
    }

    // Stable, frontend-friendly shape (top-level + nested creative duped)
    const payload = {
      placement_id: chosen.placement_id,
      slot_id: chosen.slot_id,
      creative_id: chosen.creative_id,
      slot_key: chosen.slot_key,

      // direct fields (AdSlot already normalizes these)
      type: chosen.type,
      html: chosen.html,
      image_url: chosen.image_url,
      click_url: chosen.click_url,
      target_blank: chosen.target_blank,
      name: chosen.name,

      // optional nested object for other UIs
      creative: {
        id: chosen.creative_id,
        type: chosen.type,
        html: chosen.html,
        image_url: chosen.image_url,
        click_url: chosen.click_url,
        target_blank: chosen.target_blank,
        name: chosen.name,
      }
    };

    return NextResponse.json({ row: payload }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
