// src/app/api/r2/users/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { isAdmin } from "@/lib/auth/isAdmin";
import { listUsersRepo } from "@/db/repo/users.repo";
import { createUserRepo } from "@/db/repo/users.repo";

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

const CreateSchema = z.object({
  username: z.string().min(3).max(60),
  email: z.string().email().max(100),
  password: z.string().min(6).max(150),
  first_name: z.string().max(60).optional().default(""),
  last_name: z.string().max(60).optional().default(""),
  website: z.string().url().max(200).optional().or(z.literal("")).default(""),
  bio: z.string().max(1000).optional().default(""),
  role: z.enum(["administrator", "editor", "author", "contributor", "subscriber"]),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const uid = Number((session as any)?.user?.id || 0);
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(uid))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const data = CreateSchema.parse(body);

    const created = await createUserRepo(data);
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    const status = e?.status ?? 400;
    return NextResponse.json({ error: e.message || "Failed to create user" }, { status });
  }
}
