// src/db/repo/posts/byTag.ts
import { query } from "@/db/mysql";

export type TagPostRow = {
  ID: number;
  post_title: string;
  post_name: string | null;
  post_date: string;
  post_excerpt: string | null;
  author_name: string | null;
  thumb_url: string | null;
  is_video: number;   // 0/1
  is_gallery: number; // 0/1
};

export type ListByTagResult = {
  rows: TagPostRow[];
  total: number;
  page: number;
  perPage: number;
};

export async function listPublishedPostsByTagSlugRepo(
  slug: string,
  page = 1,
  perPage = 12
): Promise<ListByTagResult> {
  const limit = perPage;
  const offset = (page - 1) * limit;

  const rows = await query<TagPostRow>(
    `
    SELECT
      p.ID,
      p.post_title,
      p.post_name,
      p.post_date,
      p.post_excerpt,
      u.display_name AS author_name,
      att.guid AS thumb_url,
      CASE WHEN pe.format = 'video' THEN 1 ELSE 0 END AS is_video,
      CASE WHEN pe.format = 'gallery' THEN 1 ELSE 0 END AS is_gallery
    FROM wp_posts p
    JOIN wp_term_relationships tr  ON tr.object_id = p.ID
    JOIN wp_term_taxonomy tt       ON tt.term_taxonomy_id = tr.term_taxonomy_id AND tt.taxonomy='post_tag'
    JOIN wp_terms t                ON t.term_id = tt.term_id
    LEFT JOIN wp_users u           ON u.ID = p.post_author
    LEFT JOIN wp_postmeta pm       ON pm.post_id = p.ID AND pm.meta_key = '_thumbnail_id'
    LEFT JOIN wp_posts att         ON att.ID = pm.meta_value AND att.post_type='attachment'
    LEFT JOIN wp_post_extra pe     ON pe.post_id = p.ID
    WHERE p.post_type='post'
      AND p.post_status='publish'
      AND t.slug = ?
    ORDER BY p.post_date DESC, p.ID DESC
    LIMIT ? OFFSET ?
    `,
    [slug, limit, offset]
  );

  const totalRows = await query<{ total: number }>(
    `
    SELECT COUNT(DISTINCT p.ID) AS total
    FROM wp_posts p
    JOIN wp_term_relationships tr  ON tr.object_id = p.ID
    JOIN wp_term_taxonomy tt       ON tt.term_taxonomy_id = tr.term_taxonomy_id AND tt.taxonomy='post_tag'
    JOIN wp_terms t                ON t.term_id = tt.term_id
    WHERE p.post_type='post'
      AND p.post_status='publish'
      AND t.slug = ?
    `,
    [slug]
  );

  return {
    rows,
    total: totalRows[0]?.total ?? 0,
    page,
    perPage: limit,
  };
}
