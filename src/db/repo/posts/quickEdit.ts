// -----------------------------------------------------------------------------
// FILE: src/db/repo/posts/quickEdit.ts
// [UNCHANGED]
// -----------------------------------------------------------------------------
import { withTx } from "@/db/mysql";
import { ensureUniquePostSlug } from "./util";
import { replaceTaxForPost } from "./taxonomy";
import { getCurrentBangladeshTime } from "@/lib/bangladesh-time";
import type { QuickStatus } from "./types";

export type QuickEditInput = {
  id: number;
  title?: string;
  slug?: string;
  status?: QuickStatus;
  categoryTtxIds?: number[];
  tagTtxIds?: number[];
};

export async function quickEditPostRepo(input: QuickEditInput) {
  const { id, title, slug, status, categoryTtxIds, tagTtxIds } = input;

  await withTx(async (cx) => {
    const currentTime = getCurrentBangladeshTime();

    const [rows]: any = await cx.query(
      `SELECT ID, post_title, post_name, post_status FROM wp_posts WHERE ID = ? LIMIT 1`,
      [id]
    );
    const row = rows[0];
    if (!row) throw new Error("Post not found");

    let nextSlug: string | undefined;
    if (typeof slug === "string") {
      const base = slug || title || row.post_title || "post";
      nextSlug = await ensureUniquePostSlug(base, id);
    } else if (title && !row.post_name) {
      nextSlug = await ensureUniquePostSlug(title, id);
    }

    const sets: string[] = [];
    const args: any[] = [];
    if (typeof title === "string") { sets.push("post_title=?"); args.push(title); }
    if (typeof nextSlug === "string") { sets.push("post_name=?"); args.push(nextSlug); }
    if (status && ["publish", "draft", "pending"].includes(status)) { sets.push("post_status=?"); args.push(status); }
    if (sets.length) {
      sets.push("post_modified=?", "post_modified_gmt=?");
      args.push(currentTime.local, currentTime.utc);
      await cx.execute(`UPDATE wp_posts SET ${sets.join(", ")} WHERE ID = ?`, [...args, id]);
    }

    await replaceTaxForPost(cx, id, "category", categoryTtxIds);
    await replaceTaxForPost(cx, id, "post_tag", tagTtxIds);
  });
}



// // -----------------------------------------------------------------------------
// // FILE: src/db/repo/posts/quickEdit.ts
// // -----------------------------------------------------------------------------
// import { withTx } from "@/db/mysql";
// import { ensureUniquePostSlug } from "./util";
// import { replaceTaxForPost } from "./taxonomy";
// import { getCurrentBangladeshTime } from "@/lib/bangladesh-time";
// import type { QuickStatus } from "./types";


// export type QuickEditInput = {
// id: number;
// title?: string;
// slug?: string;
// status?: QuickStatus;
// categoryTtxIds?: number[];
// tagTtxIds?: number[];
// };


// export async function quickEditPostRepo(input: QuickEditInput) {
// const { id, title, slug, status, categoryTtxIds, tagTtxIds } = input;


// await withTx(async (cx) => {
// const currentTime = getCurrentBangladeshTime();


// const [rows]: any = await cx.query(
// `SELECT ID, post_title, post_name, post_status FROM wp_posts WHERE ID = ? LIMIT 1`,
// [id]
// );
// const row = rows[0];
// if (!row) throw new Error("Post not found");


// let nextSlug: string | undefined;
// if (typeof slug === "string") {
// const base = slug || title || row.post_title || "post";
// nextSlug = await ensureUniquePostSlug(base, id);
// } else if (title && !row.post_name) {
// nextSlug = await ensureUniquePostSlug(title, id);
// }


// const sets: string[] = [];
// const args: any[] = [];
// if (typeof title === "string") { sets.push("post_title=?"); args.push(title); }
// if (typeof nextSlug === "string") { sets.push("post_name=?"); args.push(nextSlug); }
// if (status && ["publish", "draft", "pending"].includes(status)) { sets.push("post_status=?"); args.push(status); }
// if (sets.length) {
// sets.push("post_modified=?", "post_modified_gmt=?");
// args.push(currentTime.local, currentTime.utc);
// await cx.execute(`UPDATE wp_posts SET ${sets.join(", ")} WHERE ID = ?`, [...args, id]);
// }


// await replaceTaxForPost(cx, id, "category", categoryTtxIds);
// await replaceTaxForPost(cx, id, "post_tag", tagTtxIds);
// });
// }