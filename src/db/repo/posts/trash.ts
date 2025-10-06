// -----------------------------------------------------------------------------
// FILE: src/db/repo/posts/trash.ts
// -----------------------------------------------------------------------------
import { withTx } from "@/db/mysql";
import { setPostMeta } from "./meta";
import { getCurrentBangladeshTime } from "@/lib/bangladesh-time";


export async function movePostToTrashRepo(postId: number) {
await withTx(async (cx) => {
const currentTime = getCurrentBangladeshTime();


const [rows]: any = await cx.query(
`SELECT post_status FROM wp_posts WHERE ID = ? LIMIT 1`,
[postId]
);
const row = rows[0];
if (!row) throw new Error("Post not found");
if (row.post_status === "trash") return;


await setPostMeta(cx, postId, "_wp_trash_meta_status", row.post_status);
await setPostMeta(cx, postId, "_wp_trash_meta_time", String(Math.floor(Date.now() / 1000)));


await cx.execute(
`UPDATE wp_posts
SET post_status='trash', post_modified=?, post_modified_gmt=?
WHERE ID = ?`,
[currentTime.local, currentTime.utc, postId]
);
});
}


export async function restorePostFromTrashRepo(postId: number) {
await withTx(async (cx) => {
const currentTime = getCurrentBangladeshTime();


const [metaRows]: any = await cx.query(
`SELECT meta_value FROM wp_postmeta WHERE post_id = ? AND meta_key = '_wp_trash_meta_status' LIMIT 1`,
[postId]
);
const prev = metaRows[0]?.meta_value || "draft";


await cx.execute(
`UPDATE wp_posts
SET post_status=?, post_modified=?, post_modified_gmt=?
WHERE ID = ?`,
[prev, currentTime.local, currentTime.utc, postId]
);


await cx.execute(
`DELETE FROM wp_postmeta
WHERE post_id = ? AND meta_key IN ('_wp_trash_meta_status','_wp_trash_meta_time')`,
[postId]
);
});
}


export async function hardDeletePostRepo(postId: number) {
await withTx(async (cx) => {
await cx.execute(`DELETE FROM wp_term_relationships WHERE object_id = ?`, [postId]);
await cx.execute(`DELETE FROM wp_postmeta WHERE post_id = ?`, [postId]);
await cx.execute(`DELETE FROM wp_comments WHERE comment_post_ID = ?`, [postId]);
await cx.execute(`DELETE FROM wp_posts WHERE ID = ?`, [postId]);
});
}