// src/app/api/r2/posts/months/route.ts
// -----------------------------------------------------------------------------
// Month buckets for posts list filter (YYYY-MM + label + total)
// - GET /api/r2/posts/months
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
// ✅ Updated import: use modular barrel (not posts.repo)
import { getMonthBucketsRepo } from "@/db/repo/posts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // তালিকা ডাইনামিক থাকে

export async function GET() {
  try {
    const buckets = await getMonthBucketsRepo();
    return NextResponse.json(buckets, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to load months" },
      { status: 400 }
    );
  }
}
