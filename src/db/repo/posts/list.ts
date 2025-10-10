// -----------------------------------------------------------------------------
// FILE: src/db/repo/posts/list.ts
// -----------------------------------------------------------------------------
import { query } from "@/db/mysql";
import type { ListPostsParams, ListPostsResult, PostListRow, MonthBucket } from "./types";

export async function listPostsRepo(params: ListPostsParams = {}): Promise<ListPostsResult> {
  const {
    q = "", status = "all", authorId, categoryTtxId, categorySlug, yearMonth,
    page = 1, perPage = 20, orderBy = "date", order = "desc",
    slug, // [ADDED]
  } = params;

  const ORDER_BY_COL = orderBy === "title" ? "p.post_title" : "p.post_date";
  const ORDER_DIR = order.toUpperCase() === "ASC" ? "ASC" : "DESC";

  const where: string[] = ["p.post_type = 'post'"];
  const args: any[] = [];

  if (status !== "all") { where.push("p.post_status = ?"); args.push(status); }
  else { where.push("p.post_status IN ('publish','draft','pending','future')"); }

  // ---------- [ADDED] slug filter ----------
  // match either real post_name OR computed fallback from title
  if (slug) {
    where.push(`(
      p.post_name = ? OR
      LOWER(REPLACE(REGEXP_REPLACE(p.post_title, '[^A-Za-z0-9\\-\\s]', ''), ' ', '-')) = ?
    )`);
    args.push(slug, slug);
  }
  // ----------------------------------------

  if (q) {
    const like = `%${q}%`;
    where.push("(p.post_title LIKE ? OR p.post_content LIKE ?)");
    args.push(like, like);
  }
  if (authorId) { where.push("p.post_author = ?"); args.push(authorId); }

  if (yearMonth) {
    const [y, m] = yearMonth.split("-").map(Number);
    const start = new Date(Date.UTC(y, (m || 1) - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(y, (m || 1), 1, 0, 0, 0));
    where.push("(p.post_date >= ? AND p.post_date < ?)");
    args.push(
      start.toISOString().slice(0, 19).replace("T", " "),
      end.toISOString().slice(0, 19).replace("T", " ")
    );
  }

  if (categoryTtxId || categorySlug) {
    where.push(`EXISTS (
      SELECT 1
      FROM wp_term_relationships tr2
      JOIN wp_term_taxonomy tt2 ON tt2.term_taxonomy_id = tr2.term_taxonomy_id
      JOIN wp_terms t2 ON t2.term_id = tt2.term_id
      WHERE tr2.object_id = p.ID
        AND tt2.taxonomy = 'category'
        ${categoryTtxId ? "AND tt2.term_taxonomy_id = ?" : ""}
        ${categorySlug ? "AND t2.slug = ?" : ""}
    )`);
    if (categoryTtxId) args.push(categoryTtxId);
    if (categorySlug) args.push(categorySlug);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const rows = await query<PostListRow>(
    `
    SELECT
      p.ID,
      p.post_title,
      p.post_date,
      p.post_modified,
      p.post_status,
      p.post_author,

      CASE
        WHEN p.post_name IS NULL OR p.post_name = ''
          THEN LOWER(REPLACE(REGEXP_REPLACE(p.post_title, '[^A-Za-z0-9\\-\\s]', ''), ' ', '-'))
        ELSE p.post_name
      END AS slug,

      /* 👇 Featured image */
      att.guid AS thumbnail_url,

      /* 👇 EXTRA (from wp_post_extra) */
      ex.subtitle       AS extra_subtitle,
      ex.highlight      AS extra_highlight,
      ex.format         AS extra_format,
      ex.gallery_json   AS extra_gallery_json,
      ex.video_embed    AS extra_video_embed,

      u.display_name AS author_name,
      GROUP_CONCAT(DISTINCT CASE WHEN tt.taxonomy='category' THEN t.name END ORDER BY t.name SEPARATOR ', ') AS categories,
      GROUP_CONCAT(DISTINCT CASE WHEN tt.taxonomy='post_tag' THEN t.name END ORDER BY t.name SEPARATOR ', ') AS tags
    FROM wp_posts p
    LEFT JOIN wp_users u ON u.ID = p.post_author
    LEFT JOIN wp_term_relationships tr ON tr.object_id = p.ID
    LEFT JOIN wp_term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
    LEFT JOIN wp_terms t ON t.term_id = tt.term_id

    LEFT JOIN wp_postmeta pm_thumb
      ON pm_thumb.post_id = p.ID AND pm_thumb.meta_key = '_thumbnail_id'
    LEFT JOIN wp_posts att
      ON att.ID = pm_thumb.meta_value AND att.post_type = 'attachment'

    /* 👇 NEW extra join */
    LEFT JOIN wp_post_extra ex
      ON ex.post_id = p.ID

    ${whereSql}
    GROUP BY p.ID
    ORDER BY ${ORDER_BY_COL} ${ORDER_DIR}, p.ID ${ORDER_DIR}
    LIMIT ? OFFSET ?
    `,
    [...args, perPage, (page - 1) * perPage]
  );

  const totalRows = await query<{ total: number }>(
    `SELECT COUNT(DISTINCT p.ID) AS total FROM wp_posts p ${whereSql}`,
    args
  );

  return { rows, total: totalRows[0]?.total ?? 0, page, perPage };
}


export async function getMonthBucketsRepo(): Promise<MonthBucket[]> {
  const rows = await query<{ ym: string; total: number }>(
    `
    SELECT DATE_FORMAT(p.post_date, '%Y-%m') AS ym, COUNT(*) AS total
    FROM wp_posts p
    WHERE p.post_type='post' AND p.post_status IN ('publish','draft','pending','future')
    GROUP BY ym
    ORDER BY ym DESC
    `
  );
  const toLabel = (ym: string) => {
    const [y, m] = ym.split("-").map(Number);
    const d = new Date(Date.UTC(y, (m || 1) - 1, 1));
    return d.toLocaleString(undefined, { month: "long", year: "numeric" });
  };
  return rows.map(r => ({ ym: r.ym, label: toLabel(r.ym), total: Number(r.total || 0) }));
}




// // -----------------------------------------------------------------------------
// // FILE: src/db/repo/posts/list.ts
// // NOTE: This is exactly your code, moved into its own file.
// // -----------------------------------------------------------------------------
// import { query } from "@/db/mysql";
// import type { ListPostsParams, ListPostsResult, PostListRow, MonthBucket } from "./types";

// export async function listPostsRepo(params: ListPostsParams = {}): Promise<ListPostsResult> {
//   const {
//     q = "", status = "all", authorId, categoryTtxId, categorySlug, yearMonth,
//     page = 1, perPage = 20, orderBy = "date", order = "desc",
//   } = params;

//   const ORDER_BY_COL = orderBy === "title" ? "p.post_title" : "p.post_date";
//   const ORDER_DIR = order.toUpperCase() === "ASC" ? "ASC" : "DESC";

//   const where: string[] = ["p.post_type = 'post'"];
//   const args: any[] = [];

//   if (status !== "all") {
//     where.push("p.post_status = ?");
//     args.push(status);
//   } else {
//     where.push("p.post_status IN ('publish','draft','pending','future')");
//   }

//   if (q) {
//     const like = `%${q}%`;
//     where.push("(p.post_title LIKE ? OR p.post_content LIKE ?)");
//     args.push(like, like);
//   }
//   if (authorId) { where.push("p.post_author = ?"); args.push(authorId); }

//   if (yearMonth) {
//     const [y, m] = yearMonth.split("-").map(Number);
//     const start = new Date(Date.UTC(y, (m || 1) - 1, 1, 0, 0, 0));
//     const end = new Date(Date.UTC(y, (m || 1), 1, 0, 0, 0));
//     where.push("(p.post_date >= ? AND p.post_date < ?)");
//     args.push(
//       start.toISOString().slice(0, 19).replace("T", " "),
//       end.toISOString().slice(0, 19).replace("T", " ")
//     );
//   }

//   if (categoryTtxId || categorySlug) {
//     where.push(`EXISTS (
//       SELECT 1
//       FROM wp_term_relationships tr2
//       JOIN wp_term_taxonomy tt2 ON tt2.term_taxonomy_id = tr2.term_taxonomy_id
//       JOIN wp_terms t2 ON t2.term_id = tt2.term_id
//       WHERE tr2.object_id = p.ID
//         AND tt2.taxonomy = 'category'
//         ${categoryTtxId ? "AND tt2.term_taxonomy_id = ?" : ""}
//         ${categorySlug ? "AND t2.slug = ?" : ""}
//     )`);
//     if (categoryTtxId) args.push(categoryTtxId);
//     if (categorySlug) args.push(categorySlug);
//   }

//   const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

//   const rows = await query<PostListRow>(
//     `
//     SELECT
//       p.ID, p.post_title, p.post_date, p.post_modified, p.post_status, p.post_author,
//       u.display_name AS author_name,
//       GROUP_CONCAT(DISTINCT CASE WHEN tt.taxonomy='category' THEN t.name END ORDER BY t.name SEPARATOR ', ') AS categories,
//       GROUP_CONCAT(DISTINCT CASE WHEN tt.taxonomy='post_tag' THEN t.name END ORDER BY t.name SEPARATOR ', ') AS tags
//     FROM wp_posts p
//     LEFT JOIN wp_users u ON u.ID = p.post_author
//     LEFT JOIN wp_term_relationships tr ON tr.object_id = p.ID
//     LEFT JOIN wp_term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
//     LEFT JOIN wp_terms t ON t.term_id = tt.term_id
//     ${whereSql}
//     GROUP BY p.ID
//     ORDER BY ${ORDER_BY_COL} ${ORDER_DIR}, p.ID ${ORDER_DIR}
//     LIMIT ? OFFSET ?
//     `,
//     [...args, perPage, (page - 1) * perPage]
//   );

//   const totalRows = await query<{ total: number }>(
//     `SELECT COUNT(DISTINCT p.ID) AS total FROM wp_posts p ${whereSql}`,
//     args
//   );

//   return { rows, total: totalRows[0]?.total ?? 0, page, perPage };
// }

// export async function getMonthBucketsRepo(): Promise<MonthBucket[]> {
//   const rows = await query<{ ym: string; total: number }>(
//     `
//     SELECT DATE_FORMAT(p.post_date, '%Y-%m') AS ym, COUNT(*) AS total
//     FROM wp_posts p
//     WHERE p.post_type='post' AND p.post_status IN ('publish','draft','pending','future')
//     GROUP BY ym
//     ORDER BY ym DESC
//     `
//   );
//   const toLabel = (ym: string) => {
//     const [y, m] = ym.split("-").map(Number);
//     const d = new Date(Date.UTC(y, (m || 1) - 1, 1));
//     return d.toLocaleString(undefined, { month: "long", year: "numeric" });
//   };
//   return rows.map(r => ({ ym: r.ym, label: toLabel(r.ym), total: Number(r.total || 0) }));
// }


// // -----------------------------------------------------------------------------
// import { query } from "@/db/mysql";
// import type { ListPostsParams, ListPostsResult, PostListRow, MonthBucket } from "./types";


// export async function listPostsRepo(params: ListPostsParams = {}): Promise<ListPostsResult> {
// const {
// q = "", status = "all", authorId, categoryTtxId, categorySlug, yearMonth,
// page = 1, perPage = 20, orderBy = "date", order = "desc",
// } = params;


// const ORDER_BY_COL = orderBy === "title" ? "p.post_title" : "p.post_date";
// const ORDER_DIR = order.toUpperCase() === "ASC" ? "ASC" : "DESC";


// const where: string[] = ["p.post_type = 'post'"];
// const args: any[] = [];


// if (status !== "all") {
// where.push("p.post_status = ?");
// args.push(status);
// } else {
// where.push("p.post_status IN ('publish','draft','pending','future')");
// }


// if (q) {
// const like = `%${q}%`;
// where.push("(p.post_title LIKE ? OR p.post_content LIKE ?)");
// args.push(like, like);
// }
// if (authorId) { where.push("p.post_author = ?"); args.push(authorId); }


// if (yearMonth) {
// const [y, m] = yearMonth.split("-").map(Number);
// const start = new Date(Date.UTC(y, (m || 1) - 1, 1, 0, 0, 0));
// const end = new Date(Date.UTC(y, (m || 1), 1, 0, 0, 0));
// where.push("(p.post_date >= ? AND p.post_date < ?)");
// args.push(
// start.toISOString().slice(0, 19).replace("T", " "),
// end.toISOString().slice(0, 19).replace("T", " ")
// );
// }

// if (categoryTtxId || categorySlug) {
// where.push(`EXISTS (
// SELECT 1
// FROM wp_term_relationships tr2
// JOIN wp_term_taxonomy tt2 ON tt2.term_taxonomy_id = tr2.term_taxonomy_id
// JOIN wp_terms t2 ON t2.term_id = tt2.term_id
// WHERE tr2.object_id = p.ID
// AND tt2.taxonomy = 'category'
// ${categoryTtxId ? "AND tt2.term_taxonomy_id = ?" : ""}
// ${categorySlug ? "AND t2.slug = ?" : ""}
// )`);
// if (categoryTtxId) args.push(categoryTtxId);
// if (categorySlug) args.push(categorySlug);
// }


// const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";


// const rows = await query<PostListRow>(
// `
// SELECT
// p.ID, p.post_title, p.post_date, p.post_modified, p.post_status, p.post_author,
// u.display_name AS author_name,
// GROUP_CONCAT(DISTINCT CASE WHEN tt.taxonomy='category' THEN t.name END ORDER BY t.name SEPARATOR ', ') AS categories,
// GROUP_CONCAT(DISTINCT CASE WHEN tt.taxonomy='post_tag' THEN t.name END ORDER BY t.name SEPARATOR ', ') AS tags
// FROM wp_posts p
// LEFT JOIN wp_users u ON u.ID = p.post_author
// LEFT JOIN wp_term_relationships tr ON tr.object_id = p.ID
// LEFT JOIN wp_term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
// LEFT JOIN wp_terms t ON t.term_id = tt.term_id
// ${whereSql}
// GROUP BY p.ID
// ORDER BY ${ORDER_BY_COL} ${ORDER_DIR}, p.ID ${ORDER_DIR}
// LIMIT ? OFFSET ?
// `,
// [...args, perPage, (page - 1) * perPage]
// );

// const totalRows = await query<{ total: number }>(
// `SELECT COUNT(DISTINCT p.ID) AS total FROM wp_posts p ${whereSql}`,
// args
// );


// return { rows, total: totalRows[0]?.total ?? 0, page, perPage };
// }


// export async function getMonthBucketsRepo(): Promise<MonthBucket[]> {
// const rows = await query<{ ym: string; total: number }>(
// `
// SELECT DATE_FORMAT(p.post_date, '%Y-%m') AS ym, COUNT(*) AS total
// FROM wp_posts p
// WHERE p.post_type='post' AND p.post_status IN ('publish','draft','pending','future')
// GROUP BY ym
// ORDER BY ym DESC
// `
// );
// const toLabel = (ym: string) => {
// const [y, m] = ym.split("-").map(Number);
// const d = new Date(Date.UTC(y, (m || 1) - 1, 1));
// return d.toLocaleString(undefined, { month: "long", year: "numeric" });
// };
// return rows.map(r => ({ ym: r.ym, label: toLabel(r.ym), total: Number(r.total || 0) }));
// }