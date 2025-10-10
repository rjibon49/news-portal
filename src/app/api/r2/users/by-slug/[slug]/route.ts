// -----------------------------------------------------------------------------
// GET /api/r2/users/by-slug/:slug
// - Accepts user_nicename (preferred), or username, or numeric ID
// - Returns: { id, name, username, slug, email?, avatarUrl?, bio?, website?, socials? }
// - Also safe "no-store" headers so page always fresh.
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { query } from "@/db/mysql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = {
  ID: number;
  user_login: string;
  user_nicename: string;
  user_email: string | null;
  display_name: string | null;
  user_url: string | null;
  description: string | null; // many WP installs store bio in usermeta; we’ll fallback below
};

function to404(msg = "Author not found") {
  return NextResponse.json({ error: msg }, { status: 404 });
}

function to200(data: any) {
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

function extractUrlFromMeta(v?: string | null) {
  if (!v) return undefined;
  const s = String(v).trim();
  if (s.startsWith("{") || s.startsWith("[")) {
    try {
      const j = JSON.parse(s);
      if (typeof j === "string" && /^https?:\/\//i.test(j)) return j;
      if (j && typeof j === "object") {
        if (typeof (j as any).full === "string") return (j as any).full;
        if (typeof (j as any).url === "string") return (j as any).url;
        if (typeof (j as any)["96"] === "string") return (j as any)["96"];
        for (const v2 of Object.values(j as any)) {
          if (typeof v2 === "string" && /^https?:\/\//i.test(v2)) return v2;
        }
      }
    } catch {}
  }
  const m = s.match(/https?:\/\/[^\s'"]+/i);
  if (m) return m[0];
  if (s.startsWith("/")) return s;
  return undefined;
}

function md5(str: string) {
  const { createHash } = require("crypto");
  return createHash("md5").update(str).digest("hex");
}

async function findUser(slug: string) {
  const trimmed = decodeURIComponent(slug).trim();

  // numeric ID?
  const asId = Number(trimmed);
  if (Number.isFinite(asId) && asId > 0) {
    const byId = await query<Row>(
      `SELECT ID,user_login,user_nicename,user_email,display_name,user_url,NULL as description
         FROM wp_users WHERE ID = ? LIMIT 1`,
      [asId]
    );
    if (byId.length) return byId[0];
  }

  // 1) try NICENAME (canonical)
  const byNice = await query<Row>(
    `SELECT ID,user_login,user_nicename,user_email,display_name,user_url,NULL as description
       FROM wp_users WHERE user_nicename = ? LIMIT 1`,
    [trimmed]
  );
  if (byNice.length) return byNice[0];

  // 2) try username
  const byLogin = await query<Row>(
    `SELECT ID,user_login,user_nicename,user_email,display_name,user_url,NULL as description
       FROM wp_users WHERE user_login = ? LIMIT 1`,
    [trimmed]
  );
  if (byLogin.length) return byLogin[0];

  // 3) very last resort: match display_name lowercased dashified
  const byDisplay = await query<Row>(
    `SELECT ID,user_login,user_nicename,user_email,display_name,user_url,NULL as description
       FROM wp_users
      WHERE LOWER(REPLACE(display_name,' ','-')) = ? LIMIT 1`,
    [trimmed.toLowerCase()]
  );
  if (byDisplay.length) return byDisplay[0];

  return null;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await ctx.params;
    if (!slug) return to404();

    const u = await findUser(slug);
    if (!u) return to404();

    // Optional meta: avatar & bio (wp_usermeta)
    const metas = await query<{ meta_key: string; meta_value: string }>(
      `SELECT meta_key, meta_value FROM wp_usermeta WHERE user_id = ? 
         AND meta_key IN ('avatar_url','profile_image','avatar','wp_user_avatar','simple_local_avatar',
                          'description','bio','user_description')`,
      [u.ID]
    );

    const metaMap = Object.fromEntries(metas.map(m => [m.meta_key, m.meta_value]));
    const avatarMeta =
      metaMap["avatar_url"] ||
      metaMap["profile_image"] ||
      metaMap["avatar"] ||
      metaMap["wp_user_avatar"] ||
      metaMap["simple_local_avatar"] ||
      null;

    let avatarUrl = extractUrlFromMeta(avatarMeta);
    if (!avatarUrl && u.user_email) {
      const hash = md5(u.user_email.trim().toLowerCase());
      avatarUrl = `https://www.gravatar.com/avatar/${hash}?s=128&d=identicon`;
    }

    const bio =
      metaMap["description"] ||
      metaMap["bio"] ||
      metaMap["user_description"] ||
      null;

    const dto = {
      id: u.ID,
      username: u.user_login,
      slug: u.user_nicename, // canonical slug
      name: u.display_name || u.user_login,
      email: u.user_email || null,
      website: u.user_url || null,
      avatarUrl: avatarUrl || null,
      bio: bio,
    };

    return to200({ author: dto });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200 });
}
