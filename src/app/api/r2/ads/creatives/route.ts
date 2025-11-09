// -----------------------------------------------------------------------------
// Creatives: list + create
// GET  /api/r2/ads/creatives
// POST /api/r2/ads/creatives   (admin)
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";
import { createCreativeRepo, listCreativesRepo } from "@/db/repo/ads/ads.creatives.repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Base = z.object({
  name: z.string().min(1),
  type: z.enum(["html", "image"]),
  // keep numbers/booleans flexible from UI
  weight: z.coerce.number().int().min(0).default(1),
  target_blank: z.coerce.boolean().default(false),
  is_active: z.coerce.boolean().default(true),
  // don’t force URL validation (we allow relative /uploads/…)
  click_url: z.string().max(2048).optional().nullable(),
  // accept either ISO or empty
  active_from: z.string().optional().nullable(),
  active_to: z.string().optional().nullable(),
});

// require html for type=html, image_url for type=image
const Body = Base.and(
  z.union([
    z.object({ type: z.literal("html"), html: z.string().min(1), image_url: z.any().optional() }),
    z.object({ type: z.literal("image"), image_url: z.string().min(1), html: z.any().optional() }),
  ])
);

export async function GET() {
  const rows = await listCreativesRepo();
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => ({}));
    const data = Body.parse(raw);

    const saved = await createCreativeRepo({
      name: data.name,
      type: data.type,
      html: data.type === "html" ? data.html : null,
      image_url: data.type === "image" ? data.image_url : null,
      click_url: data.click_url ?? null,
      target_blank: data.target_blank ? 1 : 0,
      weight: data.weight,
      active_from: data.active_from ?? null,
      active_to: data.active_to ?? null,
      is_active: data.is_active ? 1 : 0,
    });

    return NextResponse.json({ row: saved });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Invalid payload" }, { status: 400 });
  }
}
