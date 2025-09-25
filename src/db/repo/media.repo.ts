// src/db/repo/media.repo.ts
import { query, execute, withTx } from "@/db/mysql";
import { slugify } from "@/lib/slugify";

export type MediaItemDTO = {
  ID: number;
  guid: string;                 // file URL
  post_title: string;           // Title
  post_excerpt: string;         // Caption
  post_content: string;         // Description
  post_mime_type: string;
  post_date: string;
  post_author: number;
  author_name?: string;
};

export type ListMediaParams = {
  q?: string;                       // search in title/file
  type?: "all" | "image" | "video" | "audio" | "other";
  page?: number;                    // 1-based
  perPage?: number;                 // default 40
  order?: "desc" | "asc";
};

export type ListMediaResult = {
  rows: MediaItemDTO[];
  total: number;
  page: number;
  perPage: number;
};

export async function listMediaRepo(params: ListMediaParams = {}): Promise<ListMediaResult> {
  const {
    q = "",
    type = "all",
    page = 1,
    perPage = 40,
    order = "desc",
  } = params;

  const where: string[] = [`p.post_type = 'attachment'`];
  const args: any[] = [];

  if (q) {
    const like = `%${q}%`;
    where.push(`(p.post_title LIKE ? OR p.guid LIKE ?)`);
    args.push(like, like);
  }

  if (type !== "all") {
    if (type === "image") where.push(`p.post_mime_type LIKE 'image/%'`);
    else if (type === "video") where.push(`p.post_mime_type LIKE 'video/%'`);
    else if (type === "audio") where.push(`p.post_mime_type LIKE 'audio/%'`);
    else where.push(`p.post_mime_type NOT LIKE 'image/%' AND p.post_mime_type NOT LIKE 'video/%' AND p.post_mime_type NOT LIKE 'audio/%'`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const rows = await query<MediaItemDTO>(
    `
    SELECT p.ID, p.guid, p.post_title, p.post_excerpt, p.post_content,
           p.post_mime_type, p.post_date, p.post_author, u.display_name AS author_name
      FROM wp_posts p
      LEFT JOIN wp_users u ON u.ID = p.post_author
     ${whereSql}
     ORDER BY p.post_date ${order.toUpperCase()}
     LIMIT ? OFFSET ?
    `,
    [...args, perPage, (page - 1) * perPage]
  );

  const totalRow = await query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM wp_posts p ${whereSql}`,
    args
  );

  return { rows, total: Number(totalRow[0]?.total || 0), page, perPage };
}

export type CreateAttachmentInput = {
  authorId: number;
  url: string;                 // /uploads/YYYY/MM/filename.webp (or full URL that contains it)
  title?: string;
  caption?: string;
  description?: string;
  mimeType?: string;           // e.g. image/webp
};

export async function createAttachmentRepo(input: CreateAttachmentInput): Promise<MediaItemDTO> {
  const { authorId, url, title = "", caption = "", description = "", mimeType = "image/webp" } = input;
  const post_name = slugify(title || url.split("/").pop() || "file", { keepUnicode: true });
  const now = new Date();

  const insertId = await withTx(async (cx) => {
    const [res] = await cx.execute<any>(
      `INSERT INTO wp_posts
         (post_author, post_date, post_date_gmt, post_content, post_title, post_excerpt,
          post_status, comment_status, ping_status, post_password, post_name,
          to_ping, pinged, post_modified, post_modified_gmt, post_content_filtered,
          post_parent, guid, menu_order, post_type, post_mime_type, comment_count)
       VALUES (?, ?, UTC_TIMESTAMP(), ?, ?, ?,
               'inherit','closed','closed','',?,
               '','', ?, UTC_TIMESTAMP(), '',
               0, ?, 0, 'attachment', ?, 0)`,
      [
        authorId,
        now, description, title || post_name, caption,
        post_name,
        now, url, mimeType,
      ]
    );
    const id = Number((res as any).insertId);

    // _wp_attached_file meta (relative path uploads/…)
    const rel = url.replace(/^\/+/, "").replace(/^.*?uploads\//, "uploads/");
    await cx.execute(
      `INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (?, '_wp_attached_file', ?)`,
      [id, rel]
    );

    return id;
  });

  const row = await query<MediaItemDTO>(
    `SELECT p.ID, p.guid, p.post_title, p.post_excerpt, p.post_content,
            p.post_mime_type, p.post_date, p.post_author, u.display_name AS author_name
       FROM wp_posts p LEFT JOIN wp_users u ON u.ID = p.post_author
      WHERE p.ID = ? LIMIT 1`,
    [insertId]
  );
  return row[0];
}

export type UpdateAttachmentInput = {
  id: number;
  title?: string;
  caption?: string;
  description?: string;
};

export async function updateAttachmentRepo(input: UpdateAttachmentInput): Promise<MediaItemDTO> {
  const { id, title, caption, description } = input;

  await execute(
    `UPDATE wp_posts
        SET post_title = COALESCE(?, post_title),
            post_excerpt = COALESCE(?, post_excerpt),
            post_content = COALESCE(?, post_content),
            post_modified = NOW(), post_modified_gmt = UTC_TIMESTAMP()
      WHERE ID = ? AND post_type='attachment'`,
    [title ?? null, caption ?? null, description ?? null, id]
  );

  const row = await query<MediaItemDTO>(
    `SELECT p.ID, p.guid, p.post_title, p.post_excerpt, p.post_content,
            p.post_mime_type, p.post_date, p.post_author, u.display_name AS author_name
       FROM wp_posts p LEFT JOIN wp_users u ON u.ID = p.post_author
      WHERE p.ID = ? LIMIT 1`,
    [id]
  );
  return row[0];
}

export async function deleteAttachmentRepo(id: number): Promise<void> {
  await withTx(async (cx) => {
    // delete metas
    await cx.execute(`DELETE FROM wp_postmeta WHERE post_id = ?`, [id]);
    // delete post (attachment)
    await cx.execute(`DELETE FROM wp_posts WHERE ID = ? AND post_type='attachment'`, [id]);
  });
}
