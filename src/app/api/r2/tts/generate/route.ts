// src/app/api/r2/tts/generate/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { query, withTx } from "@/db/mysql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  postId: z.coerce.number().int().positive(),
  lang: z.string().trim().default("bn").optional(),   // 'bn' | 'en' | 'auto'
  voice: z.string().trim().optional(),
  provider: z.string().trim().optional(),
  text: z.string().optional(),
});

function json(data: any, init?: ResponseInit) {
  return NextResponse.json(data, {
    status: init?.status ?? 200,
    headers: {
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      ...(init?.headers || {}),
    },
  });
}
export async function OPTIONS() { return json({}, { status: 200 }); }

// --- tiny HTML stripper
function stripHtml(s: string) {
  return s.replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// --- make small but audible 8kHz 8-bit PCM WAV data URI
function makeWavDataUri(seconds: number) {
  const sr = 8000;           // sample rate (low = small file)
  const ch = 1;              // mono
  const bits = 8;            // 8-bit PCM (unsigned)
  const n = Math.max(1, Math.floor(seconds * sr));
  const freq = 220;          // 220 Hz tone
  const bytes = new Uint8Array(44 + n);
  const v = new DataView(bytes.buffer);

  // RIFF header
  const writeStr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
  writeStr(0, "RIFF");
  v.setUint32(4, 36 + n, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  v.setUint32(16, 16, true);          // PCM chunk size
  v.setUint16(20, 1, true);           // audio format = PCM
  v.setUint16(22, ch, true);
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * ch * bits / 8, true);
  v.setUint16(32, ch * bits / 8, true);
  v.setUint16(34, bits, true);
  writeStr(36, "data");
  v.setUint32(40, n, true);

  // samples: simple sine, scaled to 0..255
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const s = Math.sin(2 * Math.PI * freq * t) * 0.35; // -0.35..+0.35
    const u = Math.max(0, Math.min(255, Math.round((s * 127) + 128)));
    v.setUint8(44 + i, u);
  }

  const b64 = Buffer.from(bytes).toString("base64");
  return `data:audio/wav;base64,${b64}`;
}

async function fetchPost(postId: number) {
  const rows = await query<any>(
    `SELECT p.ID, p.post_author, p.post_title, p.post_content,
            e.audio_status, e.audio_url, e.audio_lang, e.audio_chars, e.audio_duration_sec
       FROM wp_posts p
       LEFT JOIN wp_post_extra e ON e.post_id = p.ID
      WHERE p.ID=? LIMIT 1`,
    [postId]
  );
  return rows[0] || null;
}

async function upsertAudioState(cx: any, postId: number, patch: {
  status?: "none" | "queued" | "ready" | "error",
  url?: string | null,
  lang?: string | null,
  chars?: number | null,
  duration?: number | null
}) {
  await cx.execute(
    `INSERT INTO wp_post_extra
       (post_id, subtitle, highlight, format, gallery_json, video_embed,
        audio_status, audio_url, audio_lang, audio_chars, audio_duration_sec, audio_updated_at)
     VALUES (?, NULL, NULL, 'standard', NULL, NULL,
             ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       audio_status = VALUES(audio_status),
       audio_url = VALUES(audio_url),
       audio_lang = VALUES(audio_lang),
       audio_chars = VALUES(audio_chars),
       audio_duration_sec = VALUES(audio_duration_sec),
       audio_updated_at = VALUES(audio_updated_at)`,
    [postId,
     patch.status ?? "queued",
     patch.url ?? null,
     patch.lang ?? null,
     patch.chars ?? null,
     patch.duration ?? null]
  );
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const uid = Number((session as any)?.user?.id || 0);
    if (!uid) return json({ error: "Unauthorized" }, { status: 401 });

    const raw = await req.json().catch(() => ({}));
    const { postId, lang = "bn", voice, provider, text } = Body.parse(raw);

    const post = await fetchPost(postId);
    if (!post) return json({ error: "Post not found" }, { status: 404 });

    // role check (admin / editor / author)
    const capsRow = await query<{ meta_value: string }>(
      `SELECT meta_value FROM wp_usermeta WHERE user_id=? AND meta_key LIKE '%capabilities' LIMIT 1`,
      [uid]
    ).catch(() => []);
    const caps = capsRow?.[0]?.meta_value?.toLowerCase() || "";
    const role = caps.includes("administrator") ? "admin"
               : caps.includes("editor") ? "editor"
               : caps.includes("author") ? "author" : "other";
    const canEdit = role === "admin" || role === "editor" || Number(post.post_author) === uid;
    if (!canEdit) return json({ error: "Forbidden" }, { status: 403 });

    const plain = (text && text.trim()) ? text.trim() : stripHtml(String(post.post_content || ""));
    if (plain.length < 20) return json({ error: "Not enough content to synthesize (min ~20 chars)." }, { status: 422 });
    if (plain.length > 20000) return json({ error: "Content too long for a single TTS request (>20k chars)." }, { status: 422 });

    const envProvider = process.env.TTS_PROVIDER || "";
    const activeProvider = (provider || envProvider || "").toLowerCase();

    // queue first
    await withTx(async (cx) => {
      await upsertAudioState(cx, postId, {
        status: "queued",
        url: null,
        lang,
        chars: plain.length,
        duration: null,
      });
    });

    // DEV fake: produce audible WAV data-URI
    if (process.env.DEV_FAKE_TTS === "true" || !activeProvider) {
      // ~12 chars/sec reading speed (very rough)
      const seconds = Math.max(5, Math.round(plain.length / 12));
      const dataUri = makeWavDataUri(seconds);

      await withTx(async (cx) => {
        await upsertAudioState(cx, postId, {
          status: "ready",
          url: dataUri,
          lang,
          chars: plain.length,
          duration: seconds,
        });
      });

      return json({ ok: true, postId, status: "ready", url: dataUri, duration_sec: seconds, chars: plain.length, lang });
    }

    // TODO: real provider adapters (ElevenLabs/Azure/GCP/PlayHT) → then set ready + URL

    return json({
      ok: true,
      postId,
      status: "queued",
      note: `Provider '${activeProvider}' not implemented yet. Audio is queued.`,
    });
  } catch (e: any) {
    // best-effort: mark error
    try {
      const body = await req.json().catch(() => ({}));
      const pid = Number(body?.postId || 0);
      if (pid) await withTx(async (cx) => { await upsertAudioState(cx, pid, { status: "error" }); });
    } catch {}
    return json({ error: e?.message || "TTS failed" }, { status: 500 });
  }
}
