// -----------------------------------------------------------------------------
// FILE: src/db/repo/posts/create.ts
// NOTE: Structure & behavior kept the same.
//       Only comments added and one safety note on tag creation is documented.
// -----------------------------------------------------------------------------
import { withTx, query } from "@/db/mysql";
import { ensureUniquePostSlug } from "./util";
import { replaceTaxForPost, getOrCreateTagTermTaxonomyId } from "./taxonomy";
import { setPostMeta } from "./meta";
import { upsertPostExtra } from "./extra";
import { getCurrentBangladeshTime, toBangladeshDateTime } from "@/lib/bangladesh-time";
import type { CreatePostInput, CreatedPostDTO } from "./types";

export async function createPostRepo(input: CreatePostInput): Promise<CreatedPostDTO> {
  const {
    authorId, title, content, excerpt = "",
    status, slug,
    categoryTtxIds = [], tagNames = [], featuredImageId,
    // EXTRA
    subtitle, highlight, format = "standard", gallery, videoEmbed,
    // schedule
    scheduledAt,
  } = input;

  const finalSlug = await ensureUniquePostSlug(slug || title);

  const postId = await withTx(async (cx) => {
    const currentTime = getCurrentBangladeshTime();

    let postStatus = status;
    let postDate = currentTime.local;
    let postDateGmt = currentTime.utc;

    if (scheduledAt) {
      const bd = toBangladeshDateTime(scheduledAt);
      postStatus = bd.isFuture ? "future" : status;
      postDate = bd.local;
      postDateGmt = bd.utc;
    }

    // INSERT wp_posts (modified/modified_gmt = currentTime)
    const [ins]: any = await cx.execute(
      `INSERT INTO wp_posts
        (post_author, post_date, post_date_gmt, post_content, post_title, post_excerpt,
         post_status, comment_status, ping_status, post_password, post_name,
         to_ping, pinged, post_modified, post_modified_gmt, post_content_filtered,
         post_parent, guid, menu_order, post_type, post_mime_type, comment_count)
       VALUES
        (?, ?, ?, ?, ?, ?,
         ?, 'open', 'open', '', ?,
         '', '', ?, ?, '',
         0, '', 0, 'post', '', 0)`,
      [ authorId, postDate, postDateGmt, content, title, excerpt, postStatus, finalSlug,
        currentTime.local, currentTime.utc ]
    );
    const id = Number(ins.insertId);

    if (scheduledAt) {
      const bd = toBangladeshDateTime(scheduledAt);
      await setPostMeta(cx, id, "_scheduled_at", bd.local);
    }

    // Categories (replace)
    await replaceTaxForPost(cx, id, "category", categoryTtxIds);

    // Tags by name -> create if not exists then replace
    // NOTE: getOrCreateTagTermTaxonomyId is now tx-aware; it will use `cx` when provided.
    if (Array.isArray(tagNames) && tagNames.length) {
      const ttxIds: number[] = [];
      for (const n of tagNames) {
        const nm = String(n ?? "").trim();
        if (!nm) continue;
        // [UNCHANGED callsite] – function internally handles cx if supplied
        ttxIds.push(await getOrCreateTagTermTaxonomyId(nm, cx)); // [CHANGED] tx-aware use
      }
      await replaceTaxForPost(cx, id, "post_tag", ttxIds);
    } else {
      await replaceTaxForPost(cx, id, "post_tag", []);
    }

    // Featured image
    if (Number.isFinite(Number(featuredImageId)) && Number(featuredImageId) > 0) {
      await setPostMeta(cx, id, "_thumbnail_id", String(Number(featuredImageId)));
    }

    // Extras row
    await upsertPostExtra(cx, id, { subtitle, highlight, format, gallery, videoEmbed });

    return id;
  });

  const row = await query<{ post_status: string }>(
    `SELECT post_status FROM wp_posts WHERE ID=?`,
    [postId]
  );
  return { id: postId, slug: finalSlug, status: row[0]?.post_status || input.status };
}


// // -----------------------------------------------------------------------------
// // FILE: src/db/repo/posts/create.ts
// // -----------------------------------------------------------------------------
// import { withTx, query } from "@/db/mysql";
// import { ensureUniquePostSlug } from "./util";
// import { replaceTaxForPost, getOrCreateTagTermTaxonomyId } from "./taxonomy";
// import { setPostMeta } from "./meta";
// import { upsertPostExtra } from "./extra";
// import { getCurrentBangladeshTime, toBangladeshDateTime } from "@/lib/bangladesh-time";
// import type { CreatePostInput, CreatedPostDTO } from "./types";


// export async function createPostRepo(input: CreatePostInput): Promise<CreatedPostDTO> {
// const {
// authorId, title, content, excerpt = "",
// status, slug,
// categoryTtxIds = [], tagNames = [], featuredImageId,
// // EXTRA
// subtitle, highlight, format = "standard", gallery, videoEmbed,
// // schedule
// scheduledAt,
// } = input;

// const finalSlug = await ensureUniquePostSlug(slug || title);


// const postId = await withTx(async (cx) => {
// const currentTime = getCurrentBangladeshTime();


// let postStatus = status;
// let postDate = currentTime.local;
// let postDateGmt = currentTime.utc;


// if (scheduledAt) {
// const bd = toBangladeshDateTime(scheduledAt);
// postStatus = bd.isFuture ? "future" : status;
// postDate = bd.local;
// postDateGmt = bd.utc;
// }


// const [ins]: any = await cx.execute(
// `INSERT INTO wp_posts
// (post_author, post_date, post_date_gmt, post_content, post_title, post_excerpt,
// post_status, comment_status, ping_status, post_password, post_name,
// to_ping, pinged, post_modified, post_modified_gmt, post_content_filtered,
// post_parent, guid, menu_order, post_type, post_mime_type, comment_count)
// VALUES
// (?, ?, ?, ?, ?, ?,
// ?, 'open', 'open', '', ?,
// '', '', ?, ?, '',
// 0, '', 0, 'post', '', 0)`,
// [authorId, postDate, postDateGmt, content, title, excerpt, postStatus, finalSlug, currentTime.local, currentTime.utc]
// );
// const id = Number(ins.insertId);

// if (scheduledAt) {
// const bd = toBangladeshDateTime(scheduledAt);
// await setPostMeta(cx, id, "_scheduled_at", bd.local);
// }


// await replaceTaxForPost(cx, id, "category", categoryTtxIds);


// if (Array.isArray(tagNames) && tagNames.length) {
// const ttxIds: number[] = [];
// for (const n of tagNames) {
// const nm = String(n ?? "").trim();
// if (!nm) continue;
// ttxIds.push(await getOrCreateTagTermTaxonomyId(nm));
// }
// await replaceTaxForPost(cx, id, "post_tag", ttxIds);
// } else {
// await replaceTaxForPost(cx, id, "post_tag", []);
// }


// if (Number.isFinite(Number(featuredImageId)) && Number(featuredImageId) > 0) {
// await setPostMeta(cx, id, "_thumbnail_id", String(Number(featuredImageId)));
// }


// await upsertPostExtra(cx, id, { subtitle, highlight, format, gallery, videoEmbed });


// return id;
// });


// const row = await query<{ post_status: string }>(
// `SELECT post_status FROM wp_posts WHERE ID=?`,
// [postId]
// );
// return { id: postId, slug: finalSlug, status: row[0]?.post_status || input.status };
// }