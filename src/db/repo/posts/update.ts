// -----------------------------------------------------------------------------
// FILE: src/db/repo/posts/update.ts
// [UNCHANGED behavior] – Only using tx-aware tag creator
// -----------------------------------------------------------------------------
import { withTx } from "@/db/mysql";
import { ensureUniquePostSlug } from "./util";
import { replaceTaxForPost, getOrCreateTagTermTaxonomyId } from "./taxonomy";
import { setPostMeta } from "./meta";
import { upsertPostExtra } from "./extra";
import { getCurrentBangladeshTime, toBangladeshDateTime } from "@/lib/bangladesh-time";
import type { UpdatePostInput } from "./types";

export async function updatePostRepo(input: UpdatePostInput) {
  const {
    id, title, content, excerpt, status, slug,
    categoryTtxIds, tagNames, featuredImageId,
    subtitle, highlight, format, gallery, videoEmbed,
    scheduledAt,
  } = input;

  await withTx(async (cx) => {
    const currentTime = getCurrentBangladeshTime();

    const [currentRows]: any = await cx.query(
      `SELECT post_status, post_date FROM wp_posts WHERE ID = ? LIMIT 1`,
      [id]
    );
    const _current = currentRows[0];

    let nextSlug: string | undefined;
    if (typeof slug === "string") {
      const base = slug || title || "post";
      nextSlug = await ensureUniquePostSlug(base, id);
    }

    const sets: string[] = [];
    const args: any[] = [];

    if (typeof title === "string") { sets.push("post_title=?"); args.push(title); }
    if (typeof content === "string") { sets.push("post_content=?"); args.push(content); }
    if (typeof excerpt === "string") { sets.push("post_excerpt=?"); args.push(excerpt); }
    if (typeof nextSlug === "string") { sets.push("post_name=?"); args.push(nextSlug); }

    let finalStatus = status;

    if (scheduledAt !== undefined) {
      if (scheduledAt === null) {
        sets.push("post_date=?", "post_date_gmt=?");
        args.push(currentTime.local, currentTime.utc);
        await setPostMeta(cx, id, "_scheduled_at", null);
      } else {
        const bd = toBangladeshDateTime(scheduledAt);
        sets.push("post_date=?", "post_date_gmt=?");
        args.push(bd.local, bd.utc);
        finalStatus = bd.isFuture ? "future" : (status || "publish");
        await setPostMeta(cx, id, "_scheduled_at", bd.local);
      }
    }

    if (finalStatus && ["publish","draft","pending","trash","future"].includes(finalStatus)) {
      sets.push("post_status=?");
      args.push(finalStatus);
    }

    sets.push("post_modified=?", "post_modified_gmt=?");
    args.push(currentTime.local, currentTime.utc);

    if (sets.length > 2) {
      const sql = `UPDATE wp_posts SET ${sets.join(", ")} WHERE ID = ?`;
      await cx.execute(sql, [...args, id]);
    }

    if (categoryTtxIds !== undefined) {
      await replaceTaxForPost(cx, id, "category", categoryTtxIds);
    }

    if (tagNames !== undefined) {
      if (Array.isArray(tagNames) && tagNames.length) {
        const ttxIds: number[] = [];
        for (const n of tagNames) {
          const nm = String(n ?? "").trim();
          if (!nm) continue;
          ttxIds.push(await getOrCreateTagTermTaxonomyId(nm, cx)); // [CHANGED] tx-aware use
        }
        await replaceTaxForPost(cx, id, "post_tag", ttxIds);
      } else {
        await replaceTaxForPost(cx, id, "post_tag", []);
      }
    }

    if (featuredImageId !== undefined) {
      if (featuredImageId === null) {
        await setPostMeta(cx, id, "_thumbnail_id", null);
      } else if (Number.isFinite(featuredImageId) && (featuredImageId as number) > 0) {
        await setPostMeta(cx, id, "_thumbnail_id", String(featuredImageId));
      }
    }

    if (subtitle !== undefined || highlight !== undefined || format !== undefined || gallery !== undefined || videoEmbed !== undefined) {
      await upsertPostExtra(cx, id, {
        subtitle: subtitle,
        highlight: highlight,
        format: format,
        gallery: gallery === null ? [] : gallery,
        videoEmbed: videoEmbed,
      });
    }
  });
}







// // -----------------------------------------------------------------------------
// // FILE: src/db/repo/posts/update.ts
// // -----------------------------------------------------------------------------
// import { withTx } from "@/db/mysql";
// import { ensureUniquePostSlug } from "./util";
// import { replaceTaxForPost, getOrCreateTagTermTaxonomyId } from "./taxonomy";
// import { setPostMeta } from "./meta";
// import { upsertPostExtra } from "./extra";
// import { getCurrentBangladeshTime, toBangladeshDateTime } from "@/lib/bangladesh-time";
// import type { UpdatePostInput } from "./types";


// export async function updatePostRepo(input: UpdatePostInput) {
// const {
// id, title, content, excerpt, status, slug,
// categoryTtxIds, tagNames, featuredImageId,
// subtitle, highlight, format, gallery, videoEmbed,
// scheduledAt,
// } = input;


// await withTx(async (cx) => {
// const currentTime = getCurrentBangladeshTime();


// const [currentRows]: any = await cx.query(
// `SELECT post_status, post_date FROM wp_posts WHERE ID = ? LIMIT 1`,
// [id]
// );
// const _current = currentRows[0];


// let nextSlug: string | undefined;
// if (typeof slug === "string") {
// const base = slug || title || "post";
// nextSlug = await ensureUniquePostSlug(base, id);
// }


// const sets: string[] = [];
// const args: any[] = [];


// if (typeof title === "string") { sets.push("post_title=?"); args.push(title); }
// if (typeof content === "string") { sets.push("post_content=?"); args.push(content); }
// if (typeof excerpt === "string") { sets.push("post_excerpt=?"); args.push(excerpt); }
// if (typeof nextSlug === "string") { sets.push("post_name=?"); args.push(nextSlug); }

// let finalStatus = status;


// if (scheduledAt !== undefined) {
// if (scheduledAt === null) {
// sets.push("post_date=?", "post_date_gmt=?");
// args.push(currentTime.local, currentTime.utc);
// await setPostMeta(cx, id, "_scheduled_at", null);
// } else {
// const bd = toBangladeshDateTime(scheduledAt);
// sets.push("post_date=?", "post_date_gmt=?");
// args.push(bd.local, bd.utc);
// finalStatus = bd.isFuture ? "future" : (status || "publish");
// await setPostMeta(cx, id, "_scheduled_at", bd.local);
// }
// }


// if (finalStatus && ["publish","draft","pending","trash","future"].includes(finalStatus)) {
// sets.push("post_status=?");
// args.push(finalStatus);
// }


// sets.push("post_modified=?", "post_modified_gmt=?");
// args.push(currentTime.local, currentTime.utc);


// if (sets.length > 2) {
// const sql = `UPDATE wp_posts SET ${sets.join(", ")} WHERE ID = ?`;
// await cx.execute(sql, [...args, id]);
// }


// if (categoryTtxIds !== undefined) {
// await replaceTaxForPost(cx, id, "category", categoryTtxIds);
// }


// if (tagNames !== undefined) {
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
// }

// if (featuredImageId !== undefined) {
// if (featuredImageId === null) {
// await setPostMeta(cx, id, "_thumbnail_id", null);
// } else if (Number.isFinite(featuredImageId) && (featuredImageId as number) > 0) {
// await setPostMeta(cx, id, "_thumbnail_id", String(featuredImageId));
// }
// }


// if (subtitle !== undefined || highlight !== undefined || format !== undefined || gallery !== undefined || videoEmbed !== undefined) {
// await upsertPostExtra(cx, id, {
// subtitle: subtitle,
// highlight: highlight,
// format: format,
// gallery: gallery === null ? [] : gallery,
// videoEmbed: videoEmbed,
// });
// }
// });
// }