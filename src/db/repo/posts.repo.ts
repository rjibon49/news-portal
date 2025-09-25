// src/db/repo/posts.repo.ts

import { execute, query } from "@/db/mysql";

export type CreatePostInput = {
  authorId: number;
  title: string;
  content?: string;
  excerpt?: string;
  status?: "publish" | "draft" | "pending";
  slug: string;
  postType?: string; // 'post' default
  categories?: number[]; // term_taxonomy_id[]
};

export async function createPostRepo(input: CreatePostInput) {
  const now = new Date();
  const ts = toMySQL(now);
  const gmt = toMySQL(new Date(now.getTime() - now.getTimezoneOffset() * 60000));

  const res = await execute(
    `INSERT INTO wp_posts
      (post_author, post_date, post_date_gmt, post_content, post_title, post_excerpt,
       post_status, comment_status, ping_status, post_password, post_name, to_ping, pinged,
       post_modified, post_modified_gmt, post_content_filtered, post_parent, guid, menu_order,
       post_type, post_mime_type, comment_count)
     VALUES
      (?, ?, ?, ?, ?, ?, ?, 'open', 'closed', '', ?, '', '', ?, ?, '', 0, '', 0, ?, '', 0)`,
    [
      input.authorId, ts, gmt, input.content ?? "", input.title, input.excerpt ?? "",
      input.status ?? "draft", input.slug, ts, gmt, input.postType ?? "post"
    ]
  );

  const postId = res.insertId;

  if (input.categories?.length) {
    const values = input.categories.map(() => "(?, ?, 0)").join(",");
    const params = input.categories.flatMap((tt) => [postId, tt]);
    await execute(
      `INSERT IGNORE INTO wp_term_relationships (object_id, term_taxonomy_id, term_order) VALUES ${values}`,
      params
    );
  }

  const rows = await query<{ ID: number; post_name: string; post_status: string }>(
    `SELECT ID, post_name, post_status FROM wp_posts WHERE ID = ? LIMIT 1`,
    [postId]
  );
  return rows[0];
}

function toMySQL(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
