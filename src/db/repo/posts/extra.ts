// -----------------------------------------------------------------------------
// FILE: src/db/repo/posts/extra.ts
// [UNCHANGED] – logic kept same; only lightweight comments added
// -----------------------------------------------------------------------------
import { setPostMeta } from "./meta";

type ExtraPayload = {
  subtitle?: string | null;
  highlight?: string | null;
  format?: "standard" | "gallery" | "video";
  gallery?: Array<number | { id: number; url?: string }>;
  videoEmbed?: string | null;
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

  await cx.execute(
    `INSERT INTO wp_post_extra
      (post_id, subtitle, highlight, format, gallery_json, video_embed)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      subtitle=VALUES(subtitle),
      highlight=VALUES(highlight),
      format=VALUES(format),
      gallery_json=VALUES(gallery_json),
      video_embed=VALUES(video_embed)`,
    [postId, subtitle, highlight, format, gallery_json, video_embed]
  );

  await setPostMeta(cx, postId, "_subtitle", subtitle);
  await setPostMeta(cx, postId, "_highlight", highlight);
  await setPostMeta(cx, postId, "_format", format);
  await setPostMeta(cx, postId, "_gallery", gallery_json);
  await setPostMeta(cx, postId, "_video", video_embed);
}



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