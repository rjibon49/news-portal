// -----------------------------------------------------------------------------
// Creatives: read/update/delete
// GET    /api/r2/ads/creatives/:id
// PATCH  /api/r2/ads/creatives/:id  (admin)
// DELETE /api/r2/ads/creatives/:id  (admin)
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";
import { updateCreativeRepo, deleteCreativeRepo } from "@/db/repo/ads/ads.creatives.repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["html", "image"]).optional(),
  html: z.string().optional().nullable(),
  image_url: z.string().optional().nullable(),
  click_url: z.string().max(2048).optional().nullable(),
  target_blank: z.coerce.boolean().optional(),
  weight: z.coerce.number().int().min(0).optional(),
  is_active: z.coerce.boolean().optional(),
  active_from: z.string().optional().nullable(),
  active_to: z.string().optional().nullable(),
});

export async function PATCH(_req: Request, ctx: { params: { id: string } }) {
  try {
    const raw = await _req.json().catch(() => ({}));
    const data = Body.parse(raw);

    const updated = await updateCreativeRepo(Number(ctx.params.id), {
      ...data,
      target_blank: data.target_blank ? 1 : 0,
      is_active: data.is_active ? 1 : 0,
    } as any);

    return NextResponse.json({ row: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Invalid payload" }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  await deleteCreativeRepo(Number(ctx.params.id));
  return NextResponse.json({ ok: true });
}
