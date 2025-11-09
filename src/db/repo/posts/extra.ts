// src/db/repo/posts/extra.ts

import { setPostMeta } from "./meta";

type ExtraPayload = {
  subtitle?: string | null;
  highlight?: string | null;
  format?: "standard" | "gallery" | "video";
  gallery?: Array<number | { id: number; url?: string }>;
  videoEmbed?: string | null;

  // Audio fields (optional, don’t overwrite if undefined)
  audio_status?: "none" | "queued" | "ready" | "error";
  audio_url?: string | null;
  audio_lang?: string | null;
  audio_chars?: number | null;
  audio_duration_sec?: number | null;
};

function normalizeGallery(g?: ExtraPayload["gallery"]): string | null {
  if (!g || !Array.isArray(g) || !g.length) return null;
  const arr = g
    .map((x) => (typeof x === "number" ? { id: x } : x))
    .filter((x) => x && Number.isFinite(Number(x.id)) && Number(x.id) > 0)
    .map((x) => ({ id: Number(x.id), url: x.url }));
  return arr.length ? JSON.stringify(arr) : null;
}

export async function upsertPostExtra(cx: any, postId: number, extra?: ExtraPayload) {
  if (!extra) return;

  const gallery_json = normalizeGallery(extra.gallery);
  const format = extra.format || "standard";
  const subtitle = extra.subtitle ?? null;
  const highlight = extra.highlight ?? null;
  const video_embed = extra.videoEmbed ?? null;

  // Prepare audio fields but avoid overwriting with NULL if caller didn't pass
  const audio_status = extra.audio_status ?? undefined;
  const audio_url = (extra.audio_url === undefined) ? undefined : (extra.audio_url ?? null);
  const audio_lang = (extra.audio_lang === undefined) ? undefined : (extra.audio_lang ?? null);
  const audio_chars = (extra.audio_chars === undefined) ? undefined : (extra.audio_chars ?? null);
  const audio_duration_sec = (extra.audio_duration_sec === undefined) ? undefined : (extra.audio_duration_sec ?? null);

  // Build dynamic parts for audio cols
  const setAudioCols: string[] = [];
  const audioParams: any[] = [];
  if (audio_status !== undefined) { setAudioCols.push(`audio_status=?`); audioParams.push(audio_status); }
  if (audio_url !== undefined)    { setAudioCols.push(`audio_url=?`); audioParams.push(audio_url); }
  if (audio_lang !== undefined)   { setAudioCols.push(`audio_lang=?`); audioParams.push(audio_lang); }
  if (audio_chars !== undefined)  { setAudioCols.push(`audio_chars=?`); audioParams.push(audio_chars); }
  if (audio_duration_sec !== undefined) { setAudioCols.push(`audio_duration_sec=?`); audioParams.push(audio_duration_sec); }
  if (setAudioCols.length) setAudioCols.push(`audio_updated_at=NOW()`);

  await cx.execute(
    `INSERT INTO wp_post_extra
       (post_id, subtitle, highlight, format, gallery_json, video_embed)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       subtitle=VALUES(subtitle),
       highlight=VALUES(highlight),
       format=VALUES(format),
       gallery_json=VALUES(gallery_json),
       video_embed=VALUES(video_embed)
       ${setAudioCols.length ? `, ${setAudioCols.join(", ")}` : ""}`,
    [postId, subtitle, highlight, format, gallery_json, video_embed, ...audioParams]
  );

  // mirror to postmeta (optional)
  await setPostMeta(cx, postId, "_subtitle", subtitle);
  await setPostMeta(cx, postId, "_highlight", highlight);
  await setPostMeta(cx, postId, "_format", format);
  await setPostMeta(cx, postId, "_gallery", gallery_json);
  await setPostMeta(cx, postId, "_video", video_embed);
}




// // -----------------------------------------------------------------------------
// // FILE: src/db/repo/posts/extra.ts
// // [UNCHANGED] – logic kept same; only lightweight comments added
// // -----------------------------------------------------------------------------
// import { setPostMeta } from "./meta";

// type ExtraPayload = {
//   subtitle?: string | null;
//   highlight?: string | null;
//   format?: "standard" | "gallery" | "video";
//   gallery?: Array<number | { id: number; url?: string }>;
//   videoEmbed?: string | null;
// };

// function normalizeGallery(g?: ExtraPayload["gallery"]): string | null {
//   if (!g || !Array.isArray(g) || !g.length) return null;
//   const arr = g
//     .map((x) => (typeof x === "number" ? { id: x } : x))
//     .filter((x) => x && Number.isFinite(Number(x.id)) && Number(x.id) > 0)
//     .map((x) => ({ id: Number(x.id), url: x.url }));
//   return arr.length ? JSON.stringify(arr) : null;
// }

// export async function upsertPostExtra(cx: any, postId: number, extra?: ExtraPayload) {
//   if (!extra) return;

//   const gallery_json = normalizeGallery(extra.gallery);
//   const format = extra.format || "standard";
//   const subtitle = extra.subtitle ?? null;
//   const highlight = extra.highlight ?? null;
//   const video_embed = extra.videoEmbed ?? null;

//   await cx.execute(
//     `INSERT INTO wp_post_extra
//       (post_id, subtitle, highlight, format, gallery_json, video_embed)
//      VALUES (?, ?, ?, ?, ?, ?)
//      ON DUPLICATE KEY UPDATE
//       subtitle=VALUES(subtitle),
//       highlight=VALUES(highlight),
//       format=VALUES(format),
//       gallery_json=VALUES(gallery_json),
//       video_embed=VALUES(video_embed)`,
//     [postId, subtitle, highlight, format, gallery_json, video_embed]
//   );

//   await setPostMeta(cx, postId, "_subtitle", subtitle);
//   await setPostMeta(cx, postId, "_highlight", highlight);
//   await setPostMeta(cx, postId, "_format", format);
//   await setPostMeta(cx, postId, "_gallery", gallery_json);
//   await setPostMeta(cx, postId, "_video", video_embed);
// }



// // -----------------------------------------------------------------------------
// // FILE: src/db/repo/posts/extra.ts
// // -----------------------------------------------------------------------------
// import { setPostMeta } from "./meta";


// type ExtraPayload = {
// subtitle?: string | null;
// highlight?: string | null;
// format?: "standard" | "gallery" | "video";
// gallery?: Array<number | { id: number; url?: string }>;
// videoEmbed?: string | null;
// };


// function normalizeGallery(g?: ExtraPayload["gallery"]): string | null {
// if (!g || !Array.isArray(g) || !g.length) return null;
// const arr = g
// .map((x) => (typeof x === "number" ? { id: x } : x))
// .filter((x) => x && Number.isFinite(Number(x.id)) && Number(x.id) > 0)
// .map((x) => ({ id: Number(x.id), url: x.url }));
// return arr.length ? JSON.stringify(arr) : null;
// }


// export async function upsertPostExtra(cx: any, postId: number, extra?: ExtraPayload) {
// if (!extra) return;


// const gallery_json = normalizeGallery(extra.gallery);
// const format = extra.format || "standard";
// const subtitle = extra.subtitle ?? null;
// const highlight = extra.highlight ?? null;
// const video_embed = extra.videoEmbed ?? null;


// await cx.execute(
// `INSERT INTO wp_post_extra
// (post_id, subtitle, highlight, format, gallery_json, video_embed)
// VALUES (?, ?, ?, ?, ?, ?)
// ON DUPLICATE KEY UPDATE
// subtitle=VALUES(subtitle),
// highlight=VALUES(highlight),
// format=VALUES(format),
// gallery_json=VALUES(gallery_json),
// video_embed=VALUES(video_embed)`,
// [postId, subtitle, highlight, format, gallery_json, video_embed]
// );


// await setPostMeta(cx, postId, "_subtitle", subtitle);
// await setPostMeta(cx, postId, "_highlight", highlight);
// await setPostMeta(cx, postId, "_format", format);
// await setPostMeta(cx, postId, "_gallery", gallery_json);
// await setPostMeta(cx, postId, "_video", video_embed);
// }