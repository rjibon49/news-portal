// src/app/api/r2/users/route.ts
// -----------------------------------------------------------------------------
// Users collection API
// - GET  : list users (with avatar_url absolute if site-relative)
// - POST : create user (supports optional avatarUrl)
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { isAdmin } from "@/lib/auth/isAdmin";
import { listUsersRepo, createUserRepo, type UserRole } from "@/db/repo/users.repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ----------------------------- GET (list) ----------------------------- */

const ListQ = z.object({
  q: z.string().optional().default(""),
  role: z
    .enum(["administrator", "editor", "author", "contributor", "subscriber", "no_role", "any"])
    .optional()
    .default("any"),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(200).default(20),
  orderBy: z.enum(["user_login", "user_registered", "ID"]).default("user_login"),
  order: z.enum(["asc", "desc"]).default("asc"),
});

export async function GET(req: Request) {
  try {
    const qs = Object.fromEntries(new URL(req.url).searchParams);
    const q = ListQ.parse(qs);
    const data = await listUsersRepo(q);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: "Invalid query", issues: e.flatten() }, { status: 422 });
    }
    return NextResponse.json({ error: e?.message || "Failed to load users" }, { status: 400 });
  }
}

/* ----------------------------- POST (create) ----------------------------- */

/** Accept http(s) URL OR site-relative path (starts with "/"). */
const AvatarUrlSchema = z
  .string()
  .trim()
  .refine((v) => /^https?:\/\//i.test(v) || v.startsWith("/"), {
    message: "Invalid URL",
  });

const CreateBody = z.object({
  username: z.string().min(1).max(60),
  email: z.string().email().max(100),
  password: z.string().min(6).max(150),
  first_name: z.string().max(60).optional().default(""),
  last_name: z.string().max(60).optional().default(""),
  website: z.union([z.string().url(), z.literal("")]).optional().default(""),
  bio: z.string().max(1000).optional().default(""),
  role: z.enum(["administrator", "editor", "author", "contributor", "subscriber"]),
  // 👇 avatarUrl accepts http(s) | leading "/" | "" | null | undefined
  avatarUrl: z.union([AvatarUrlSchema, z.literal(""), z.null()]).optional(),
});

export async function POST(req: Request) {
  try {
    // (optional) guard: only admins can create users
    const session = await getServerSession(authOptions);
    const uid = Number((session as any)?.user?.id || 0);
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const admin = await isAdmin(uid);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const data = CreateBody.parse(body);

    // Normalize avatar: "" -> null (clear), undefined -> pass undefined
    const avatar =
      data.avatarUrl === "" ? null : (data.avatarUrl as string | null | undefined);

    const created = await createUserRepo({
      username: data.username,
      email: data.email,
      password: data.password,
      first_name: data.first_name,
      last_name: data.last_name,
      website: data.website,
      bio: data.bio,
      role: data.role as UserRole,
      avatarUrl: avatar,
    });

    return NextResponse.json(created, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e: any) {
    if (e instanceof ZodError) {
      // Zod's .flatten() is nice for your toast
      return NextResponse.json({ error: "Invalid payload", issues: e.flatten() }, { status: 422 });
    }
    // repo throws 409 on conflict
    const status = e?.status && Number.isFinite(e.status) ? e.status : 400;
    return NextResponse.json({ error: e?.message || "Failed to create user" }, { status });
  }
}
/* ────────────────────────────────────────────────────────────────────────────
   NOTES:
   - listUsersRepo() role filter matches serialized WP caps (repo already handles).
   - dynamic = "force-dynamic" ensures no caching (admin data sensitive).
   - If later adding rate-limit, wrap handlers here (before parse).
   - If adding more fields to create user, just extend CreateSchema + repo.
   ──────────────────────────────────────────────────────────────────────────── */
