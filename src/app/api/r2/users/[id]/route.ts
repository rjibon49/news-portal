// src/app/api/r2/users/[id]/route.ts
// 👤 Read/Update/Delete a user profile
// Next.js 15: params must be awaited; repo uses bcrypt => nodejs runtime.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z, ZodError } from "zod";

import { authOptions } from "@/lib/auth/options";
import { isAdmin } from "@/lib/auth/isAdmin";
import {
  getUserProfileRepo,
  updateUserProfileRepo,
  updateUserPasswordRepo,
  deleteUserRepo,
} from "@/db/repo/users.repo";
import { SOCIAL_FIELDS, type SocialKey } from "@/lib/users/social";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* helpers */
function bad(message = "Bad request", status = 400) {
  return NextResponse.json({ error: message }, { status });
}
function parseId(id: string | undefined) {
  const n = Number(id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const AvatarUrlSchema = z.string().trim().refine(
  (v) => /^https?:\/\//i.test(v) || v.startsWith("/"),
  { message: "Invalid URL" }
);

const HttpUrl = z
  .string()
  .trim()
  .url()
  .refine((u) => /^https?:\/\//i.test(u), "Only http(s) URLs allowed");

function socialSchemaFor(key: SocialKey): z.ZodType<string> {
  if (key === "x_username") {
    return z
      .union([
        z.string().trim().regex(/^[A-Za-z0-9_]{1,15}$/, "Invalid username"),
        z.literal(""),
      ])
      .transform((v) => v as string) as unknown as z.ZodType<string>;
  }
  return z
    .union([HttpUrl, z.literal("")])
    .transform((v) => v as string) as unknown as z.ZodType<string>;
}

const SocialShape: Record<SocialKey, z.ZodType<string>> = {} as any;
for (const f of SOCIAL_FIELDS) SocialShape[f.key] = socialSchemaFor(f.key);

const PatchSchema = z.object({
  email: z.string().email().max(100).optional(),
  website: z.union([HttpUrl, z.literal("")]).optional(),
  first_name: z.union([z.string().max(60), z.literal("")]).optional(),
  last_name: z.union([z.string().max(60), z.literal("")]).optional(),
  nickname: z.union([z.string().max(250), z.literal("")]).optional(),
  display_name: z.string().max(250).optional(),
  bio: z.union([z.string().max(1000), z.literal("")]).optional(),
  avatarUrl: z.union([AvatarUrlSchema, z.literal(""), z.null()]).optional(),
  role: z.enum(["administrator", "editor", "author", "contributor", "subscriber"]).optional(),
  socials: z.object(SocialShape).partial().optional(),
  newPassword: z.string().min(6).max(150).optional(),
});

/* GET /api/r2/users/:id */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const userId = parseId(id);
    if (!userId) return bad("Bad id", 400);

    const profile = await getUserProfileRepo(userId);
    if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(profile, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return bad(e?.message || "Failed", 400);
  }
}

/* PATCH /api/r2/users/:id */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const requesterId = Number((session as any)?.user?.id || 0);
    if (!requesterId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await ctx.params;
    const userId = parseId(id);
    if (!userId) return bad("Bad id", 400);

    const raw = await req.json().catch(() => ({}));
    const data = PatchSchema.parse(raw);

    const admin = await isAdmin(requesterId);
    if (!admin && requesterId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!admin && data.role) {
      return NextResponse.json({ error: "Only admin can change role" }, { status: 403 });
    }

    const socialsPayload: Record<string, string> | undefined = data.socials
      ? (Object.fromEntries(
          Object.entries(data.socials).map(([k, v]) => [k, (v ?? "") as string])
        ) as Record<string, string>)
      : undefined;

    await updateUserProfileRepo({
      userId,
      email: data.email,
      website: data.website,
      first_name: data.first_name,
      last_name: data.last_name,
      nickname: data.nickname,
      display_name: data.display_name,
      bio: data.bio,
      avatarUrl: data.avatarUrl === "" ? null : data.avatarUrl ?? undefined,
      role: data.role,
      socials: socialsPayload,
    });

    if (data.newPassword) {
      if (!admin && requesterId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      await updateUserPasswordRepo(userId, data.newPassword);
    }

    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: "Invalid payload", issues: e.flatten() }, { status: 422 });
    }
    return bad(e?.message || "Failed", 400);
  }
}

/* DELETE /api/r2/users/:id */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const uid = Number((session as any)?.user?.id || 0);
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = await isAdmin(uid);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await ctx.params;
    const userId = parseId(id);
    if (!userId) return bad("Bad id", 400);
    if (userId === uid) return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });

    await deleteUserRepo(userId);
    return new NextResponse(null, { status: 204 });
  } catch (e: any) {
    return bad(e?.message || "Delete failed", 400);
  }
}
