// src/app/api/r2/me/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { query } from "@/db/mysql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseRole(capStr: string): string {
  // WP capabilities serialized PHP array string; quick-and-safe detection
  const s = capStr.toLowerCase();
  if (s.includes("administrator")) return "administrator";
  if (s.includes("editor")) return "editor";
  if (s.includes("author")) return "author";
  if (s.includes("contributor")) return "contributor";
  return "subscriber";
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const uid = Number((session as any)?.user?.id || 0);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // meta_key prefix টি ভিন্ন হতে পারে, তাই LIKE '%capabilities'
  const rows = await query<{ meta_value: string }>(
    `SELECT meta_value 
       FROM wp_usermeta 
      WHERE user_id = ? AND meta_key LIKE '%capabilities' 
      LIMIT 1`,
    [uid]
  );

  const role = rows[0]?.meta_value ? parseRole(rows[0].meta_value) : "subscriber";
  const canPublishNow = role === "administrator" || role === "editor" || role === "author";

  return NextResponse.json(
    { id: uid, role, canPublishNow },
    { headers: { "Cache-Control": "no-store" } }
  );
}
