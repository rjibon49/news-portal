// src/app/api/r2/tts/worker/route.ts

import { NextResponse } from "next/server";
import { query, execute } from "@/db/mysql";
// import { doGenerateForPost } from "@/lib/tts/generateForPost"; // আপনার জেনারেটর

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const max = Math.min(Number(url.searchParams.get("max") || 3), 10);

  // কিউড আইটেম নিন
  const rows = await query<{
    post_id: number; audio_lang: string | null; audio_updated_at: string | null;
  }>(`
    SELECT post_id, audio_lang, audio_updated_at
      FROM wp_post_extra
     WHERE audio_status='queued'
     ORDER BY (audio_updated_at IS NULL) DESC, audio_updated_at ASC
     LIMIT ?
  `, [max]);

  const done: number[] = [];
  for (const r of rows) {
    try {
      // post টেক্সট নিন
      const p = await query<{ post_title: string; post_content: string }>(
        `SELECT post_title, post_content FROM wp_posts WHERE ID=? LIMIT 1`, [r.post_id]
      );
      const text = (p[0]?.post_title || "") + "\n\n" + (p[0]?.post_content || "");

      // জেনারেট রান (আপনার বিদ্যমান ইঞ্জিন ব্যবহার করুন)
      // const out = await doGenerateForPost({ postId: r.post_id, lang: r.audio_lang || "bn-BD", text });

      // উদাহরণস্বরূপ আপডেট (out.url ইত্যাদি থেকে)
      // await execute(
      //   `UPDATE wp_post_extra
      //       SET audio_status='ready', audio_url=?, audio_lang=?, audio_chars=?, audio_duration_sec=?,
      //           audio_updated_at=NOW()
      //     WHERE post_id=?`,
      //   [out.url, out.lang, out.chars || null, out.duration_sec || null, r.post_id]
      // );
      done.push(r.post_id);
    } catch (e) {
      // ব্যর্থ হলে error স্ট্যাটাস দিতে পারেন
      await execute(
        `UPDATE wp_post_extra SET audio_status='error', audio_updated_at=NOW() WHERE post_id=?`,
        [r.post_id]
      );
    }
  }

  return NextResponse.json({ processed: done.length, postIds: done }, { headers: { "Cache-Control": "no-store" } });
}
