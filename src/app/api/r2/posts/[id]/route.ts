// src/app/api/r2/posts/[id]/route.ts
// -----------------------------------------------------------------------------
// Single Post API (GET / PATCH / DELETE)
// - GET    : editor prefill (+ schedule info + EXTRA + last edited + AUDIO)
// - PATCH  : full update (status, tax, tags, featured, slug, scheduledAt, EXTRA)
//            + optional audio generation trigger
// - DELETE : hard delete (admin only)
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { isAdmin } from "@/lib/auth/isAdmin";
import { z, ZodError } from "zod";
import { query } from "@/db/mysql";

// ✅ modular repo barrel
import { hardDeletePostRepo, updatePostRepo } from "@/db/repo/posts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ─────────────── helpers ─────────────── */
async function getPostAuthorId(postId: number): Promise<number | null> {
  const rows = await query<{ post_author: number }>(
    `SELECT post_author FROM wp_posts WHERE ID = ? LIMIT 1`,
    [postId]
  );
  return rows[0]?.post_author ?? null;
}

// accept ISO বা 'YYYY-MM-DDTHH:mm'
const DatetimeLocalOrISO = z.union([
  z.string().datetime({ offset: true }),
  z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
]);

const GalleryItemSchema = z.object({
  id: z.coerce.number().int().positive(),
  url: z.string().optional(),
});

// PATCH payload (lenient but typed)
const UpdateSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().optional(),
  excerpt: z.string().optional(),
  status: z.enum(["publish", "draft", "pending", "trash", "future"]).optional(),
  slug: z.string().max(190).optional(),

  categoryTtxIds: z.array(z.coerce.number().int().positive()).optional(),
  tagNames: z.array(z.string().min(1)).optional(),
  featuredImageId: z.coerce.number().int().positive().nullable().optional(),

  // EXTRA
  subtitle: z.string().nullable().optional(),
  highlight: z.string().nullable().optional(),
  format: z.enum(["standard", "gallery", "video"]).optional(),
  gallery: z
    .array(z.union([z.coerce.number().int().positive(), GalleryItemSchema]))
    .nullable()
    .optional(),
  videoEmbed: z.string().nullable().optional(),

  // Schedule
  scheduledAt: DatetimeLocalOrISO.nullable().optional(), // null=clear

  // 🔊 Optional TTS intent (handled AFTER update)
  audio: z
    .object({
      generate: z.boolean().optional(),
      lang: z.string().optional(),       // e.g., 'en', 'bn'
      overwrite: z.boolean().optional(), // re-generate even if exists
    })
    .partial()
    .optional(),
});

/* ─────────────── GET /posts/:id ─────────────── */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const postId = Number(id);
    if (!Number.isFinite(postId) || postId <= 0) {
      return NextResponse.json({ error: "Bad id" }, { status: 400 });
    }

    // core post
    const rows = await query<{
      ID: number;
      post_title: string;
      post_content: string;
      post_excerpt: string;
      post_status: string;
      post_name: string;
      post_date: string; // local datetime (WP style)
      post_modified: string;
    }>(
      `SELECT p.ID, p.post_title, p.post_content, p.post_excerpt, p.post_status, p.post_name, p.post_date, p.post_modified
         FROM wp_posts p WHERE p.ID = ? LIMIT 1`,
      [postId]
    );
    if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // taxonomies
    const cats = await query<{ term_taxonomy_id: number }>(
      `SELECT tr.term_taxonomy_id
         FROM wp_term_relationships tr
         JOIN wp_term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
        WHERE tr.object_id = ? AND tt.taxonomy = 'category'`,
      [postId]
    );
    const tags = await query<{ name: string }>(
      `SELECT t.name
         FROM wp_term_relationships tr
         JOIN wp_term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
         JOIN wp_terms t ON t.term_id = tt.term_id
        WHERE tr.object_id = ? AND tt.taxonomy = 'post_tag'`,
      [postId]
    );

    // featured image
    const thumb = await query<{ meta_value: string }>(
      `SELECT meta_value FROM wp_postmeta WHERE post_id=? AND meta_key='_thumbnail_id' LIMIT 1`,
      [postId]
    );

    // EXTRA (+ AUDIO)
    const extra = await query<{
      subtitle: string | null;
      highlight: string | null;
      format: "standard" | "gallery" | "video" | null;
      gallery_json: string | null;
      video_embed: string | null;

      audio_status: "none" | "queued" | "ready" | "error" | null;
      audio_url: string | null;
      audio_lang: string | null;
      audio_chars: number | null;
      audio_duration_sec: number | null;
      audio_updated_at: string | null;
    }>(
      `SELECT subtitle, highlight, format, gallery_json, video_embed,
              audio_status, audio_url, audio_lang, audio_chars, audio_duration_sec, audio_updated_at
         FROM wp_post_extra WHERE post_id = ? LIMIT 1`,
      [postId]
    );
    const ex = extra[0] || ({} as any);
    const gallery = ex?.gallery_json
      ? (JSON.parse(ex.gallery_json) as Array<{ id: number; url?: string }>)
      : [];

    // last edited (post_modified + _edit_last)
    const lastMeta = await query<{ meta_value: string }>(
      `SELECT meta_value FROM wp_postmeta WHERE post_id=? AND meta_key='_edit_last' LIMIT 1`,
      [postId]
    );
    const lastEditorId = lastMeta[0]?.meta_value ? Number(lastMeta[0].meta_value) : null;
    const lastEditor =
      lastEditorId && Number.isFinite(lastEditorId)
        ? await query<{ ID: number; display_name: string }>(
            `SELECT ID, display_name FROM wp_users WHERE ID = ? LIMIT 1`,
            [lastEditorId]
          ).then((r) => r[0] || null)
        : null;

    // datetime-local input: YYYY-MM-DDTHH:mm
    const toLocalInput = (s: string) => {
      if (!s) return null;
      const d = new Date(s.replace(" ", "T"));
      if (isNaN(d.getTime())) return null;
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
        d.getHours()
      )}:${pad(d.getMinutes())}`;
    };

    const r = rows[0];
    return NextResponse.json(
      {
        id: r.ID,
        title: r.post_title,
        content: r.post_content,
        excerpt: r.post_excerpt,
        status: r.post_status,
        slug: r.post_name,
        categoryTtxIds: cats.map((c) => c.term_taxonomy_id),
        tagNames: tags.map((t) => t.name),
        featuredImageId: thumb[0]?.meta_value ? Number(thumb[0].meta_value) : null,
        scheduledAt: toLocalInput(r.post_date),

        // EXTRA
        subtitle: ex?.subtitle ?? null,
        highlight: ex?.highlight ?? null,
        format: (ex?.format as "standard" | "gallery" | "video" | undefined) ?? "standard",
        gallery,
        videoEmbed: ex?.video_embed ?? null,

        // 🔊 AUDIO snapshot
        audio: {
          status: ex?.audio_status ?? "none",
          url: ex?.audio_url ?? null,
          lang: ex?.audio_lang ?? null,
          chars: ex?.audio_chars ?? null,
          durationSec: ex?.audio_duration_sec ?? null,
          updatedAt: ex?.audio_updated_at ?? null,
        },

        // last edited
        lastEdited: {
          at: r.post_modified || null,
          by: lastEditor ? { id: lastEditor.ID, name: lastEditor.display_name } : null,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}

/* ─────────────── PATCH /posts/:id ─────────────── */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const postId = Number(id);
    if (!Number.isFinite(postId) || postId <= 0) {
      return NextResponse.json({ error: "Bad id" }, { status: 400 });
    }

    // 🔐 session
    const session = await getServerSession(authOptions);
    const uid = Number((session as any)?.user?.id || 0);
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 🔐 authZ: admin or post author
    const admin = await isAdmin(uid);
    if (!admin) {
      const authorId = await getPostAuthorId(postId);
      if (!authorId) return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (authorId !== uid) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 🧪 validate payload (be tolerant)
    const rawData = await req.json().catch(() => ({}));
    let data: z.infer<typeof UpdateSchema>;
    try {
      data = UpdateSchema.parse(rawData);
    } catch (_zodErr) {
      // very lenient fallback (keeps your earlier behavior)
      data = {
        title: rawData.title,
        content: rawData.content,
        excerpt: rawData.excerpt,
        status: rawData.status,
        slug: rawData.slug,
        categoryTtxIds: Array.isArray(rawData.categoryTtxIds)
          ? rawData.categoryTtxIds
          : undefined,
        tagNames: Array.isArray(rawData.tagNames) ? rawData.tagNames : undefined,
        featuredImageId:
          rawData.featuredImageId !== undefined ? rawData.featuredImageId : undefined,
        subtitle: rawData.subtitle,
        highlight: rawData.highlight,
        format: rawData.format,
        gallery: rawData.gallery,
        videoEmbed: rawData.videoEmbed,
        scheduledAt: rawData.scheduledAt,
        audio: rawData.audio,
      } as any;
    }

    // ✅ (Optional) tighten policy for non-admins
    if (!admin && data.status && data.status !== "draft") {
      const authorId = await getPostAuthorId(postId);
      if (authorId !== uid) {
        return NextResponse.json({ error: "Can only edit your own posts" }, { status: 403 });
      }
    }

    // 🗃️ repo update
    await updatePostRepo({
      id: postId,
      title: data.title,
      content: data.content,
      excerpt: data.excerpt,
      status: data.status,
      slug: data.slug,
      categoryTtxIds: data.categoryTtxIds,
      tagNames: data.tagNames,
      featuredImageId: data.featuredImageId,
      subtitle: data.subtitle,
      highlight: data.highlight,
      format: data.format,
      gallery: data.gallery,
      videoEmbed: data.videoEmbed,
      scheduledAt: data.scheduledAt,
    });

    // 🔊 Optionally queue TTS after successful update (non-fatal if it fails)
    let audioQueued = false;
    try {
      if (data.audio?.generate) {
        const origin = new URL(req.url).origin;
        await fetch(`${origin}/api/r2/tts/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            postId,
            lang: data.audio.lang,
            overwrite: data.audio.overwrite ?? false,
          }),
        }).catch(() => {});
        audioQueued = true;
      }
    } catch (e) {
      console.warn("[posts.update] TTS queue failed (non-fatal):", e);
    }

    return NextResponse.json(
      { ok: true, audioQueued },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid payload", issues: e.flatten() },
        { status: 422 }
      );
    }
    return NextResponse.json({ error: e?.message || "Update failed" }, { status: 400 });
  }
}

/* ─────────────── DELETE /posts/:id ─────────────── */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const postId = Number(id);
  if (!Number.isFinite(postId) || postId <= 0) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  const uid = Number((session as any)?.user?.id || 0);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(uid))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await hardDeletePostRepo(postId);
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
