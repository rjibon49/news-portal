// src/db/repo/media.repo.ts
import { query, execute, withTx } from "@/db/mysql";
import { slugify } from "@/lib/slugify";

async function ensureUniqueAttachmentSlug(base: string): Promise<string> {
  const baseSlug = slugify(base, { keepUnicode: true, maxLength: 190 }) || "attachment";
  let candidate = baseSlug;
  let i = 2;
  while (true) {
    const rows = await query<{ ID: number }>(
      `SELECT ID FROM wp_posts WHERE post_name = ? AND post_type = 'attachment' LIMIT 1`,
      [candidate]
    );
    if (rows.length === 0) return candidate;
    candidate = `${baseSlug}-${i++}`.slice(0, 190);
  }
}

export type MediaItemDTO = {
  ID: number;
  guid: string;
  post_title: string;
  post_excerpt: string;
  post_content: string;
  post_mime_type: string;
  post_date: string;
  post_author: number;
  author_name?: string;
};

export type ListMediaParams = {
  q?: string;
  type?: "all" | "image" | "video" | "audio" | "other";
  page?: number;
  perPage?: number;
  order?: "desc" | "asc";
  yearMonth?: string; // "YYYY-MM"
};

export type ListMediaResult = {
  rows: MediaItemDTO[];
  total: number;
  page: number;
  perPage: number;
};

export type CreateAttachmentInput = {
  authorId: number;
  url: string;
  title?: string;
  caption?: string;
  description?: string;
  mimeType?: string;
};

export type UpdateAttachmentInput = {
  id: number;
  title?: string;
  caption?: string;
  description?: string;
};

export async function listMediaRepo(params: ListMediaParams = {}): Promise<ListMediaResult> {
  const {
    q = "",
    type = "all",
    page = 1,
    perPage = 40,
    order = "desc",
    yearMonth,
  } = params;

  const where: string[] = [`p.post_type = 'attachment'`];
  const args: unknown[] = [];

  if (q) {
    const like = `%${q}%`;
    where.push(`(p.post_title LIKE ? OR p.guid LIKE ?)`);
    args.push(like, like);
  }

  if (type !== "all") {
    if (type === "image") where.push(`p.post_mime_type LIKE 'image/%'`);
    else if (type === "video") where.push(`p.post_mime_type LIKE 'video/%'`);
    else if (type === "audio") where.push(`p.post_mime_type LIKE 'audio/%'`);
    else
      where.push(
        `NOT (p.post_mime_type LIKE 'image/%' OR p.post_mime_type LIKE 'video/%' OR p.post_mime_type LIKE 'audio/%')`
      );
  }

  if (yearMonth) {
    // ✅ TZ-safe: MySQL-side month filter, no UTC math needed
    where.push(`DATE_FORMAT(p.post_date, '%Y-%m') = ?`);
    args.push(yearMonth);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const sortDir = order.toLowerCase() === "asc" ? "ASC" : "DESC";

  const rows = await query<MediaItemDTO>(
    `
    SELECT
      p.ID, p.guid, p.post_title, p.post_excerpt, p.post_content,
      p.post_mime_type, p.post_date, p.post_author,
      u.display_name AS author_name
    FROM wp_posts p
    LEFT JOIN wp_users u ON u.ID = p.post_author
    ${whereSql}
    ORDER BY p.post_date ${sortDir}, p.ID ${sortDir}
    LIMIT ? OFFSET ?
    `,
    [...args, perPage, (page - 1) * perPage]
  );

  const totalRows = await query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM wp_posts p ${whereSql}`,
    args
  );

  const total = Number(totalRows[0]?.total ?? 0);
  return { rows: rows ?? [], total, page, perPage };
}

export async function createAttachmentRepo(input: CreateAttachmentInput): Promise<MediaItemDTO> {
  const {
    authorId,
    url,
    title = "",
    caption = "",
    description = "",
    mimeType = "image/webp",
  } = input;

  const base_name = title || url.split("/").pop() || "file";
  const post_name = await ensureUniqueAttachmentSlug(base_name);
  const now = new Date();

  const insertId = await withTx(async (cx) => {
    // cx.execute returns [result, fields]; type result minimally
    const [res] = await cx.execute(
      `
      INSERT INTO wp_posts (
        post_author, post_date, post_date_gmt, post_content, post_title, post_excerpt,
        post_status, comment_status, ping_status, post_password, post_name, to_ping, pinged,
        post_modified, post_modified_gmt, post_content_filtered, post_parent, guid, menu_order,
        post_type, post_mime_type, comment_count
      )
      VALUES (?, ?, UTC_TIMESTAMP(), ?, ?, ?, 'inherit','closed','closed','', ?, '', '',
              ?, UTC_TIMESTAMP(), '', 0, ?, 0, 'attachment', ?, 0)
      `,
      [authorId, now, description, title || post_name, caption, post_name, now, url, mimeType]
    );

    const result = res as { insertId: number };
    const id = Number(result.insertId);

    const rel = url.replace(/^\/+/, "").replace(/^.*?uploads\//, "uploads/");
    await cx.execute(
      `INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (?, '_wp_attached_file', ?)`,
      [id, rel]
    );
    return id;
  });

  const createdRows = await query<MediaItemDTO>(
    `
    SELECT
      p.ID, p.guid, p.post_title, p.post_excerpt, p.post_content,
      p.post_mime_type, p.post_date, p.post_author,
      u.display_name AS author_name
    FROM wp_posts p
    LEFT JOIN wp_users u ON u.ID = p.post_author
    WHERE p.ID = ? LIMIT 1
    `,
    [insertId]
  );
  return createdRows[0];
}

export async function updateAttachmentRepo(input: UpdateAttachmentInput): Promise<MediaItemDTO> {
  const { id, title, caption, description } = input;

  await execute(
    `
    UPDATE wp_posts
    SET
      post_title = COALESCE(?, post_title),
      post_excerpt = COALESCE(?, post_excerpt),
      post_content = COALESCE(?, post_content),
      post_modified = NOW(),
      post_modified_gmt = UTC_TIMESTAMP()
    WHERE ID = ? AND post_type='attachment'
    `,
    [title ?? null, caption ?? null, description ?? null, id]
  );

  const updatedRows = await query<MediaItemDTO>(
    `
    SELECT
      p.ID, p.guid, p.post_title, p.post_excerpt, p.post_content,
      p.post_mime_type, p.post_date, p.post_author,
      u.display_name AS author_name
    FROM wp_posts p
    LEFT JOIN wp_users u ON u.ID = p.post_author
    WHERE p.ID = ? AND p.post_type='attachment' LIMIT 1
    `,
    [id]
  );

  if (!updatedRows[0]) {
    const e = new Error("Attachment not found") as Error & { status?: number };
    e.status = 404;
    throw e;
  }
  return updatedRows[0];
}

export async function deleteAttachmentRepo(id: number): Promise<void> {
  await withTx(async (cx) => {
    await cx.execute(`DELETE FROM wp_postmeta WHERE post_id = ?`, [id]);

    const [res] = await cx.execute(`DELETE FROM wp_posts WHERE ID = ? AND post_type='attachment'`, [id]);
    const result = res as { affectedRows?: number };
    if (!result.affectedRows) {
      const e = new Error("Attachment not found") as Error & { status?: number };
      e.status = 404;
      throw e;
    }
  });
}
