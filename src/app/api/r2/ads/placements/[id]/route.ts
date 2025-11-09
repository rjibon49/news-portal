// -----------------------------------------------------------------------------
// Placements: read/update/delete
// GET    /api/r2/ads/placements/:id
// PATCH  /api/r2/ads/placements/:id  (admin)
// DELETE /api/r2/ads/placements/:id  (admin)
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import {
  getPlacementByIdRepo,
  updatePlacementRepo,
  deletePlacementRepo,
} from "@/db/repo/ads/ads.placements.repo";
import type { TinyBool } from "@/db/types/ads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ok = (d: any, s = 200) =>
  new NextResponse(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }});
const bad = (m = "Bad request", s = 400) => NextResponse.json({ error: m }, { status: s });

const toTiny = (v: boolean | number): TinyBool => (v === true || v === 1 ? 1 : 0);
const parseId = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };
const nullIfEmpty = (s?: string | null) => (s && s.trim() !== "" ? s : null);
async function requireAdmin(){ return { ok: true, res: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }; }

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const nid = parseId(id);
  if (!nid) return bad("Bad id", 400);
  const row = await getPlacementByIdRepo(nid);
  return row ? ok(row) : bad("Not found", 404);
}

const PatchSchema = z.object({
  slot_id: z.number().int().positive().optional(),
  creative_id: z.number().int().positive().optional(),
  weight: z.number().int().min(0).max(11).optional(),
  is_active: z.union([z.boolean(), z.number().int().min(0).max(1)]).optional(),
  active_from: z.string().datetime().optional(),
  active_to: z.string().datetime().nullable().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.res;

  try {
    const { id } = await ctx.params;
    const nid = parseId(id);
    if (!nid) return bad("Bad id", 400);

    const raw = await req.json().catch(() => ({}));
    const data = PatchSchema.parse(raw);

    const payload = {
      slot_id: data.slot_id,
      creative_id: data.creative_id,
      weight: data.weight,
      is_active: data.is_active === undefined ? undefined : toTiny(data.is_active),
      active_from: data.active_from ?? undefined,
      active_to: data.active_to === undefined ? undefined : nullIfEmpty(data.active_to),
    };

    const row = await updatePlacementRepo(nid, payload);
    return ok(row);
  } catch (e: any) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: "Invalid payload", issues: e.flatten() }, { status: 422 });
    }
    return bad(e?.message || "Update failed", 400);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.res;

  const { id } = await ctx.params;
  const nid = parseId(id);
  if (!nid) return bad("Bad id", 400);

  await deletePlacementRepo(nid);
  return new NextResponse(null, { status: 204 });
}
