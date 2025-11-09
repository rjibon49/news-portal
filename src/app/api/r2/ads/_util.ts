// src/app/api/r2/ads/utils.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { isAdmin } from "@/lib/auth/isAdmin";

// Standard API error response
export function bad(message = "Bad request", status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// Standard API success response
export function ok(data: any, init: number | ResponseInit = 200) {
  const status = typeof init === "number" ? init : (init as ResponseInit).status ?? 200;
  const initObj = typeof init === "number" ? { status } : init;
  return NextResponse.json(data, { ...initObj, headers: { "Cache-Control": "no-store" } });
}

// Auth guard
export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const uid = Number((session as any)?.user?.id || 0);
  if (!uid)
    return { ok: false, res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const admin = await isAdmin(uid);
  if (!admin)
    return { ok: false, res: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { ok: true as const, res: null };
}

// Boolean-ish check (0/1/true/false)
export const isOn = (v: unknown) => v === 1 || v === true || v === "1";

// Normalize any boolean-ish to 0/1
export const toTiny = (v: unknown): 0 | 1 => v === 1 || v === true || v === "1" ? 1 : 0;

// Normalize string/undefined to null or string
export const nullIfEmpty = (s?: string | null) => (s && s.trim() !== "" ? s : null);
// Normalize string/undefined to string|null
export const toNullable = (s?: string | null) => (typeof s === "string" ? s : null);

