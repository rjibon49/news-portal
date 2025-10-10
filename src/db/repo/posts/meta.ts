// -----------------------------------------------------------------------------
// FILE: src/db/repo/posts/meta.ts
// [UNCHANGED]
// -----------------------------------------------------------------------------
export async function setPostMeta(cx: any, postId: number, key: string, val: string | null) {
  await cx.execute(`DELETE FROM wp_postmeta WHERE post_id=? AND meta_key=?`, [postId, key]);
  if (val !== null) {
    await cx.execute(
      `INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (?, ?, ?)`,
      [postId, key, val]
    );
  }
}


// // -----------------------------------------------------------------------------
// // FILE: src/db/repo/posts/meta.ts
// // -----------------------------------------------------------------------------
// export async function setPostMeta(cx: any, postId: number, key: string, val: string | null) {
// await cx.execute(`DELETE FROM wp_postmeta WHERE post_id=? AND meta_key=?`, [postId, key]);
// if (val !== null) {
// await cx.execute(
// `INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (?, ?, ?)`,
// [postId, key, val]
// );
// }
// }