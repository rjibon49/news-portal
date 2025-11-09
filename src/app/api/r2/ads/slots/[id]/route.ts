// -----------------------------------------------------------------------------
// Slots: item API
// GET    /api/r2/ads/slots/:id   -> read a slot
// PATCH  /api/r2/ads/slots/:id   -> update a slot (admin)
// DELETE /api/r2/ads/slots/:id   -> delete a slot (admin)
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import {
  getSlotByIdRepo,
  updateSlotRepo,
  deleteSlotRepo,
} from "@/db/repo/ads/ads.slots.repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  slot_key: z.string().min(1).max(100).optional(),
  name: z.string().max(200).optional(),
  enabled: z.boolean().or(z.number().int().min(0).max(1)).optional(),
  max_ads: z.number().int().positive().nullable().optional(),
});

function ok(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function parseId(id: string | undefined) {
  const n = Number(id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const nid = parseId(id);
  if (!nid) return bad("Bad id", 400);
  const row = await getSlotByIdRepo(nid);
  return row ? ok(row) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const nid = parseId(id);
    if (!nid) return bad("Bad id", 400);

    // ✅ empty body-safe
    const raw = await req.text();
    if (!raw) return bad("Empty JSON body", 422);
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return bad("Invalid JSON", 422);
    }

    const data = PatchSchema.parse(json);

    const enabled =
      typeof data.enabled === "number" ? (data.enabled === 1 ? 1 : 0) :
      typeof data.enabled === "boolean" ? (data.enabled ? 1 : 0) :
      undefined;

    const row = await updateSlotRepo(nid, {
      slot_key: data.slot_key,
      name: data.name,
      enabled,
      max_ads: data.max_ads === undefined ? undefined : (data.max_ads ?? null),
    });

    return ok(row);
  } catch (e: any) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: "Invalid payload", issues: e.flatten() }, { status: 422 });
    }
    return bad(e?.message || "Update failed", 400);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const nid = parseId(id);
  if (!nid) return bad("Bad id", 400);
  await deleteSlotRepo(nid);
  return new NextResponse(null, { status: 204 });
}
