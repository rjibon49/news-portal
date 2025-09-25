// src/app/api/r2/user/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserById, getUserByLoginOrEmail } from "@/db/repo/users.repo";

export const runtime = "nodejs";

const QSchema = z.object({
  id: z.string().optional(),
  identifier: z.string().optional()
}).refine(v => v.id || v.identifier, { message: "Provide ?id= or ?identifier=" });

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = QSchema.parse({
      id: url.searchParams.get("id") ?? undefined,
      identifier: url.searchParams.get("identifier") ?? undefined
    });

    let user = null;
    if (q.id) user = await getUserById(Number(q.id));
    else if (q.identifier) user = await getUserByLoginOrEmail(q.identifier);

    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      ID: user.ID,
      user_login: user.user_login,
      user_email: user.user_email,
      display_name: user.display_name
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Bad request" }, { status: 400 });
  }
}
