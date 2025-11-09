// Slots collection API
// GET  /api/r2/ads/slots     -> list all slots
// POST /api/r2/ads/slots     -> create a slot (admin only)

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { listSlotsRepo, createSlotRepo } from "@/db/repo/ads/ads.slots.repo";
// 🔧 Correct import: types live in db/types/ads
import type { CreateAdSlot, TinyBool } from "@/db/types/ads";

// If you already use a guard helper, keep it.
// Otherwise this dummy always allows; swap with your real guard.
async function requireAdmin() {
  return { ok: true, res: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── POST: create a slot (admin only) ─────────────────────────────────────────
const CreateSchema = z.object({
  slot_key: z.string().min(1).max(100),
  name: z.string().max(200).optional().default(""),
  enabled: z.boolean().or(z.number().int().min(0).max(1)).optional().default(true),
  max_ads: z.number().int().positive().nullable().optional(),
});

function ok(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** boolean/number -> 0|1 */
const toTiny = (v: boolean | number): TinyBool => (v === true || v === 1 ? 1 : 0);

// ── GET: list all slots ───────────────────────────────────────────────────────
export async function GET() {
  const rows = await listSlotsRepo();
  return ok({ rows });
}



export async function POST(req: Request) {
  try {
    // ✅ empty body-safe parse
    const raw = await req.text();
    if (!raw) return bad("Empty JSON body", 422);
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return bad("Invalid JSON", 422);
    }

    const data = CreateSchema.parse(json);

    // যদি enabled number(0/1) আসে → boolean
    const enabledBool = typeof data.enabled === "number" ? data.enabled === 1 : !!data.enabled;

    const row = await createSlotRepo({
      slot_key: data.slot_key,
      name: data.name ?? "",
      enabled: enabledBool ? 1 : 0,           // আপনার repo যদি TinyBool/0|1 আশা করে
      max_ads: data.max_ads ?? null,
    });

    return ok(row, 201);
  } catch (e: any) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: "Invalid payload", issues: e.flatten() }, { status: 422 });
    }
    return bad(e?.message || "Create failed", 400);
  }
}
