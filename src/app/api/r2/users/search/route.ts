// src/app/api/r2/users/search/route.ts
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { searchUsersRepo } from "@/db/repo/users.repo";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Q = z.object({
  q: z.string().trim().min(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
});

function absolutize(urlStr: string | null | undefined, origin: string) {
  if (!urlStr) return null;
  if (/^https?:\/\//i.test(urlStr)) return urlStr;
  if (/^[a-z]+:/i.test(urlStr)) return null;
  const path = urlStr.startsWith("/") ? urlStr : `/${urlStr}`;
  return `${origin}${path}`;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const origin = `${url.protocol}//${url.host}`;
    const { q, limit } = Q.parse(Object.fromEntries(url.searchParams));
    const rows = await searchUsersRepo(q, limit);

    const users = rows.map((u) => {
      const localAvatar = absolutize(u.avatar_url || null, origin);
      const gravatar = u.email
        ? `https://www.gravatar.com/avatar/${crypto
            .createHash("md5")
            .update(u.email.trim().toLowerCase())
            .digest("hex")}?s=64&d=mp`
        : null;

      return {
        id: u.id,
        name: u.name,
        username: u.username,
        email: u.email,
        avatar: localAvatar || gravatar,
      };
    });

    return NextResponse.json({ users }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: "Invalid query", issues: e.flatten() }, { status: 422 });
    }
    return NextResponse.json({ error: e?.message || "Invalid request" }, { status: 400 });
  }
}
