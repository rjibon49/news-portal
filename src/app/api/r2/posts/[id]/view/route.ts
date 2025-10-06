// src/app/api/r2/posts/[id]/view/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import {
  recordPostViewWithDedupRepo,   // <-- সঠিক নাম
  recordPostViewRepo,
  getPostViewStatsRepo,
} from "@/db/repo/post-views.repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pickHeader(req: Request, keys: string[]): string {
  for (const k of keys) {
    const v = req.headers.get(k);
    if (v && v.trim()) return v.trim();
  }
  return "";
}
function firstIp(s: string) {
  if (!s) return "";
  return (s.split(",")[0]?.trim() || "").replace(/^::ffff:/, "");
}
function fp(postId: number, deviceId: string, ip: string, ua: string) {
  return crypto.createHash("sha256").update(`${postId}|${deviceId}|${ip}|${ua}`,"utf8").digest("hex");
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const postId = Number(id);
    if (!Number.isFinite(postId) || postId <= 0) {
      return NextResponse.json({ error: "Bad id" }, { status: 400 });
    }

    const ip = firstIp(pickHeader(req, [
      "cf-connecting-ip",
      "x-forwarded-for",
      "x-real-ip",
      "remote-addr",
    ]));
    const ua = req.headers.get("user-agent") || "unknown";

    const jar = await cookies();
    let deviceId = jar.get("pv_did")?.value || crypto.randomUUID();

    const fingerprint = fp(postId, deviceId, ip, ua);

    // dedup-aware record; fallback if not available
    try {
      await recordPostViewWithDedupRepo(postId, fingerprint);
    } catch {
      await recordPostViewRepo(postId);
    }

    const res = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    res.cookies.set("pv_did", deviceId, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      secure: true,
      maxAge: 60 * 60 * 24 * 365 * 2,
    });
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 400 });
  }
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const postId = Number(id);
    if (!Number.isFinite(postId) || postId <= 0) {
      return NextResponse.json({ error: "Bad id" }, { status: 400 });
    }
    const stats = await getPostViewStatsRepo(postId);
    return NextResponse.json(stats, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 400 });
  }
}
