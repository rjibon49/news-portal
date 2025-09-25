// src/app/api/r2/users/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { isAdmin } from "@/lib/auth/isAdmin";
import { listUsersRepo } from "@/db/repo/users.repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  q: z.string().optional(),
  role: z
    .enum(["administrator", "editor", "author", "contributor", "subscriber", "no_role", "any"])
    .optional()
    .default("any"),
  page: z.coerce.number().int().positive().optional().default(1),
  perPage: z.coerce.number().int().positive().max(100).optional().default(20),
  orderBy: z.enum(["user_login", "user_registered", "ID"]).optional().default("user_login"),
  order: z.enum(["asc", "desc"]).optional().default("asc"),
});

export async function GET(req: Request) {
  try {
    // ✅ admin/session guard
    const session = await getServerSession(authOptions);
    const uid = Number((session as any)?.user?.id || 0);
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(uid))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const url = new URL(req.url);
    const parsed = QuerySchema.parse({
      q: url.searchParams.get("q") ?? undefined,
      role: url.searchParams.get("role") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      perPage: url.searchParams.get("perPage") ?? undefined,
      orderBy: url.searchParams.get("orderBy") ?? undefined,
      order: url.searchParams.get("order") ?? undefined,
    });

    const result = await listUsersRepo(parsed);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to load users" }, { status: 400 });
  }
}
