// src/app/api/r2/ads/placements/route.ts
// -----------------------------------------------------------------------------
// Ads: Placements collection API
// - GET   /api/r2/ads/placements  -> list placements
// - POST  /api/r2/ads/placements  -> create placement (admin only)
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getServerSession } from "next-auth";

import {
  listPlacementsRepo,
  createPlacementRepo,
} from "@/db/repo/ads/ads.placements.repo";

// ✅ আপনার টাইপের নাম এটা (স্ক্রিনশট অনুযায়ী):
import type { CreateAdPlacement } from "@/db/types/ads";

// ✅ আপনার গার্ড: isAdmin(userId)
import { isAdmin } from "@/lib/auth/isAdmin";
import { authOptions } from "@/lib/auth/options";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ----------------------------- small helpers ----------------------------- */
const toTiny = (v: number | boolean | undefined): 0 | 1 => (v ? 1 : 0);
// string | undefined -> string | null (DB টাইপের সাথে মিলানোর জন্য)
const toNullable = (s: string | undefined): string | null =>
  typeof s === "string" ? s : null;

/* ------------------------------- Zod schema ------------------------------ */
const CreateSchema = z.object({
  slot_id: z.number().int().positive(),
  creative_id: z.number().int().positive(),
  weight: z.number().int().min(0).max(100).default(1),
  is_active: z.union([z.boolean(), z.number().int().min(0).max(1)]).default(1),
  // অনুরোধে undefined আসতে পারে; DB-তে আমরা null হিসেবে সেভ করব
  active_from: z.string().optional(),
  active_to: z.string().optional(),
});

/* ---------------------------------- GET ---------------------------------- */
export async function GET() {
  try {
    const rows = await listPlacementsRepo();
    return NextResponse.json(
      { rows },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to load placements" },
      { status: 400 }
    );
  }
}

/* ---------------------------------- POST --------------------------------- */
export async function POST(req: Request) {
  try {
    // 🔐 admin guard using session + isAdmin()
    const session = await getServerSession(authOptions);
    const uid = Number((session as any)?.user?.id || 0);
    if (!uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdmin(uid))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const raw = await req.json().catch(() => ({}));
    const data = CreateSchema.parse(raw);

    // ✅ টাইপ CreateAdPlacement অনুযায়ী payload প্রস্তুত
    const payload: CreateAdPlacement = {
      slot_id: data.slot_id,
      creative_id: data.creative_id,
      weight: data.weight,
      is_active: toTiny(data.is_active),
      active_from: toNullable(data.active_from), // string | null
      active_to: toNullable(data.active_to),     // string | null
    };

    const row = await createPlacementRepo(payload);
    return NextResponse.json(row, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e: any) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid payload", issues: e.flatten() },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { error: e?.message || "Create failed" },
      { status: 400 }
    );
  }
}
