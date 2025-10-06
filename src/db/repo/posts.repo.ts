// // src/db/repo/posts.repo.ts
// // -----------------------------------------------------------------------------
// // WordPress-compatible Post Repository (MySQL 8 / mysql2)
// // - create (EXTRA: wp_post_extra), list (filters + pagination + sort)
// // - month filter (YYYY-MM) + month buckets (dropdown)
// // - quick edit, full edit (with schedule)
// // - trash / restore / hard delete
// // -----------------------------------------------------------------------------

// import { query, execute, withTx } from "@/db/mysql";
// import { slugify } from "@/lib/slugify";
// import { getCurrentBangladeshTime, toBangladeshDateTime } from "@/lib/bangladesh-time";

// // -----------------------------------------------------------------------------
// // Types
// // -----------------------------------------------------------------------------

// export type QuickStatus = "publish" | "draft" | "pending";
// export type PostStatus = "publish" | "draft" | "pending" | "trash" | "future";

// export type ListPostsParams = {
//   q?: string;
//   status?: "all" | PostStatus;
//   authorId?: number;
//   categoryTtxId?: number;
//   categorySlug?: string;
//   yearMonth?: string;          // YYYY-MM
//   page?: number;               // 1-based
//   perPage?: number;            // default 20
//   orderBy?: "date" | "title";
//   order?: "asc" | "desc";
// };

// export type PostListRow = {
//   ID: number;
//   post_title: string;
//   post_date: string;
//   post_modified: string;
//   post_status: string;
//   post_author: number;
//   author_name: string | null;
//   categories: string | null;    // CSV
//   tags: string | null;          // CSV
// };

// export type ListPostsResult = {
//   rows: PostListRow[];
//   total: number;
//   page: number;
//   perPage: number;
// };

// export type CreatePostInput = {
//   authorId: number;
//   title: string;
//   content: string;
//   excerpt?: string;
//   status: "publish" | "draft" | "pending" | "future";
//   slug?: string;
//   categoryTtxIds?: number[];
//   tagNames?: string[];
//   featuredImageId?: number;

//   // EXTRA -> wp_post_extra
//   subtitle?: string;
//   highlight?: string;
//   format?: "standard" | "gallery" | "video";
//   gallery?: Array<number | { id: number; url?: string }>;
//   videoEmbed?: string;

//   // Optional schedule
//   scheduledAt?: string; // JS-parseable
// };

// export type CreatedPostDTO = { id: number; slug: string; status: string };

// export type UpdatePostInput = {
//   id: number;
//   title?: string;
//   content?: string;
//   excerpt?: string;
//   status?: PostStatus;              // 'trash' allowed
//   slug?: string;
//   categoryTtxIds?: number[];
//   tagNames?: string[];
//   featuredImageId?: number | null;

//   // EXTRA
//   subtitle?: string | null;
//   highlight?: string | null;
//   format?: "standard" | "gallery" | "video";
//   gallery?: Array<number | { id: number; url?: string }> | null;
//   videoEmbed?: string | null;

//   // schedule: null => clear, string => set
//   scheduledAt?: string | null;
// };

// export type MonthBucket = { ym: string; label: string; total: number };


// // -----------------------------------------------------------------------------
// // Helper: unique slug (WP style)
// // -----------------------------------------------------------------------------

// // ✅ hard guard: normalize id arrays (dedupe + finite + >0)
// function normalizeIds(ids?: Array<number | string | null | undefined>): number[] {
//   return Array.from(
//     new Set(
//       (ids ?? [])
//         .map((v) => Number(v))
//         .filter((n) => Number.isFinite(n) && n > 0) as number[]
//     )
//   );
// }

// async function ensureUniquePostSlug(base: string, excludeId?: number): Promise<string> {
//   const baseSlug =
//     slugify(base || "post", { keepUnicode: false, maxLength: 190 }) || "post";
//   let candidate = baseSlug;
//   let i = 2;

//   // eslint-disable-next-line no-constant-condition
//   while (true) {
//     const taken = await query<{ ID: number }>(
//       `SELECT ID FROM wp_posts
//          WHERE post_name = ?
//            AND post_type = 'post'
//            AND post_status <> 'trash'
//            ${excludeId ? "AND ID <> ?" : ""}
//          LIMIT 1`,
//       excludeId ? [candidate, excludeId] : [candidate]
//     );
//     if (!taken.length) return candidate;
//     candidate = `${baseSlug}-${i++}`.slice(0, 190);
//   }
// }

// // -----------------------------------------------------------------------------
// // Helper: tag term_taxonomy ensure (returns term_taxonomy_id)
// // -----------------------------------------------------------------------------

// async function getOrCreateTagTermTaxonomyId(name: string): Promise<number> {
//   const nm = name.trim();
//   if (!nm) throw new Error("Empty tag name");
//   const s = slugify(nm, { keepUnicode: true, maxLength: 190 }) || nm;

//   const term = await query<{ term_id: number }>(
//     `SELECT term_id FROM wp_terms WHERE slug = ? LIMIT 1`,
//     [s]
//   );
//   let termId: number;
//   if (term.length) {
//     termId = term[0].term_id;
//   } else {
//     const [ins]: any = await execute(
//       `INSERT INTO wp_terms (name, slug, term_group) VALUES (?, ?, 0)`,
//       [nm, s]
//     );
//     termId = Number(ins.insertId);
//   }

//   const ttx = await query<{ term_taxonomy_id: number }>(
//     `SELECT term_taxonomy_id FROM wp_term_taxonomy WHERE term_id = ? AND taxonomy = 'post_tag' LIMIT 1`,
//     [termId]
//   );
//   if (ttx.length) return ttx[0].term_taxonomy_id;

//   const [ins2]: any = await execute(
//     `INSERT INTO wp_term_taxonomy (term_id, taxonomy, description, parent, count)
//       VALUES (?, 'post_tag', '', 0, 0)`,
//     [termId]
//   );
//   return Number(ins2.insertId);
// }

// // -----------------------------------------------------------------------------
// // Helper: replace taxonomy relationships (category / post_tag) with recount
// // -----------------------------------------------------------------------------

// function cleanIdArray(arr?: unknown[]): number[] {
//   if (!Array.isArray(arr)) return [];
//   return arr
//     .map((x) => Number(x))
//     .filter((n) => Number.isFinite(n) && n > 0);
// }

// async function replaceTaxForPost(
//   cx: any,
//   postId: number,
//   taxonomy: "category" | "post_tag",
//   termTaxonomyIds?: number[],
// ) {
//   // ⛑️ clean incoming ids (prevents NaN/0/undefined)
//   const nextIds = cleanIdArray(termTaxonomyIds);
//   // Collect previous for recount
//   const [prevRows] = await cx.query(
//     `SELECT tr.term_taxonomy_id
//        FROM wp_term_relationships tr
//        JOIN wp_term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
//       WHERE tr.object_id = ? AND tt.taxonomy = ?`,
//     [postId, taxonomy]
//   );
//   const prevIds: number[] = (prevRows as Array<{ term_taxonomy_id: number }> ?? [])
//     .map((r) => Number(r.term_taxonomy_id))
//     .filter((n) => Number.isFinite(n) && n > 0);

//   // Delete all for taxonomy
//   await cx.execute(
//     `DELETE tr FROM wp_term_relationships tr
//        JOIN wp_term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
//      WHERE tr.object_id = ? AND tt.taxonomy = ?`,
//     [postId, taxonomy]
//   );

//   // Insert new (if any)
//   if (nextIds.length) {
//     const values = nextIds.map(() => "(?, ?)").join(", ");
//     const params: any[] = [];
//     nextIds.forEach((ttx) => params.push(postId, ttx));
//     await cx.execute(
//       `INSERT INTO wp_term_relationships (object_id, term_taxonomy_id) VALUES ${values}`,
//       params
//     );
//   }

//   // Recount only when we actually have affected ids
//   const affected = Array.from(new Set([...prevIds, ...nextIds]));
//   if (affected.length) {
//     await cx.execute(
//       `UPDATE wp_term_taxonomy tt
//           SET tt.count = (
//             SELECT COUNT(*) FROM wp_term_relationships tr
//              WHERE tr.term_taxonomy_id = tt.term_taxonomy_id
//           )
//         WHERE tt.term_taxonomy_id IN (${affected.map(() => "?").join(",")})`,
//       affected
//     );
//   }
// }

// // -----------------------------------------------------------------------------
// // Helper: meta set (delete-then-insert for safety)
// // -----------------------------------------------------------------------------

// async function setPostMeta(cx: any, postId: number, key: string, val: string | null) {
//   await cx.execute(`DELETE FROM wp_postmeta WHERE post_id=? AND meta_key=?`, [postId, key]);
//   if (val !== null) {
//     await cx.execute(
//       `INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (?, ?, ?)`,
//       [postId, key, val]
//     );
//   }
// }

// // -----------------------------------------------------------------------------
// // EXTRA: wp_post_extra upsert
// // -----------------------------------------------------------------------------

// type ExtraPayload = {
//   subtitle?: string | null;
//   highlight?: string | null;
//   format?: "standard" | "gallery" | "video";
//   gallery?: Array<number | { id: number; url?: string }>;
//   videoEmbed?: string | null;
// };

// function normalizeGallery(g?: ExtraPayload["gallery"]): string | null {
//   if (!g || !Array.isArray(g) || !g.length) return null;
//   const arr = g
//     .map((x) => (typeof x === "number" ? { id: x } : x))
//     .filter((x) => x && Number.isFinite(Number(x.id)) && Number(x.id) > 0)
//     .map((x) => ({ id: Number(x.id), url: x.url }));
//   return arr.length ? JSON.stringify(arr) : null;
// }

// async function upsertPostExtra(cx: any, postId: number, extra?: ExtraPayload) {
//   if (!extra) return;

//   const gallery_json = normalizeGallery(extra.gallery);
//   const format = extra.format || "standard";
//   const subtitle = extra.subtitle ?? null;
//   const highlight = extra.highlight ?? null;
//   const video_embed = extra.videoEmbed ?? null;

//   await cx.execute(
//     `INSERT INTO wp_post_extra
//        (post_id, subtitle, highlight, format, gallery_json, video_embed)
//      VALUES (?, ?, ?, ?, ?, ?)
//      ON DUPLICATE KEY UPDATE
//        subtitle=VALUES(subtitle),
//        highlight=VALUES(highlight),
//        format=VALUES(format),
//        gallery_json=VALUES(gallery_json),
//        video_embed=VALUES(video_embed)`,
//     [postId, subtitle, highlight, format, gallery_json, video_embed]
//   );

//   // (ঐচ্ছিক) থিম মিরর মেটাগুলো আপ টু ডেট রাখা
//   await setPostMeta(cx, postId, "_subtitle", subtitle);
//   await setPostMeta(cx, postId, "_highlight", highlight);
//   await setPostMeta(cx, postId, "_format", format);
//   await setPostMeta(cx, postId, "_gallery", gallery_json);
//   await setPostMeta(cx, postId, "_video", video_embed);
// }

// // -----------------------------------------------------------------------------
// // CREATE
// // -----------------------------------------------------------------------------

// // CREATE ফাংশনে সময় ব্যবস্থাপনা ঠিক করুন
// export async function createPostRepo(input: CreatePostInput): Promise<CreatedPostDTO> {
//   const {
//     authorId, title, content, excerpt = "",
//     status, slug,
//     categoryTtxIds = [], tagNames = [], featuredImageId,
//     // EXTRA
//     subtitle, highlight, format = "standard", gallery, videoEmbed,
//     // schedule
//     scheduledAt,
//   } = input;

//   const finalSlug = await ensureUniquePostSlug(slug || title);

//   console.log("createPostRepo - Input scheduledAt:", scheduledAt);

//   const postId = await withTx(async (cx) => {
//     // বর্তমান বাংলাদেশ টাইম পাওয়া
//     const currentTime = getCurrentBangladeshTime();

//     let postStatus = status;
//     let postDate = currentTime.local;
//     let postDateGmt = currentTime.utc;

//     // Schedule handling
//     if (scheduledAt) {
//       console.log("createPostRepo - Processing schedule:", scheduledAt);
//       const bangladeshTime = toBangladeshDateTime(scheduledAt);
//       postStatus = bangladeshTime.isFuture ? "future" : status;
//       postDate = bangladeshTime.local;
//       postDateGmt = bangladeshTime.utc;
      
//       console.log("createPostRepo - Final post date (BD):", postDate);
//       console.log("createPostRepo - Final post date (UTC):", postDateGmt);
//       console.log("createPostRepo - Final status:", postStatus);
//     }

//     // 1) insert core post - বাংলাদেশ টাইম ব্যবহার করে
//     const [ins]: any = await cx.execute(
//       `INSERT INTO wp_posts
//          (post_author, post_date, post_date_gmt, post_content, post_title, post_excerpt,
//           post_status, comment_status, ping_status, post_password, post_name,
//           to_ping, pinged, post_modified, post_modified_gmt, post_content_filtered,
//           post_parent, guid, menu_order, post_type, post_mime_type, comment_count)
//        VALUES
//          (?, ?, ?, ?, ?, ?,
//           ?, 'open', 'open', '', ?,
//           '', '', ?, ?, '',
//           0, '', 0, 'post', '', 0)`,
//       [authorId, postDate, postDateGmt, content, title, excerpt, postStatus, finalSlug, currentTime.local, currentTime.utc]
//     );
//     const id = Number(ins.insertId);

//     // 2) schedule meta
//     if (scheduledAt) {
//       const bangladeshTime = toBangladeshDateTime(scheduledAt);
//       await setPostMeta(cx, id, "_scheduled_at", bangladeshTime.local);
//     }

//     // 3) taxonomies (⛑️ clean arrays)
//     await replaceTaxForPost(cx, id, "category", cleanIdArray(categoryTtxIds));

//     if (Array.isArray(tagNames) && tagNames.length) {
//       const ttxIds: number[] = [];
//       for (const n of tagNames) {
//         const nm = String(n ?? "").trim();
//         if (!nm) continue;
//         ttxIds.push(await getOrCreateTagTermTaxonomyId(nm));
//       }
//       await replaceTaxForPost(cx, id, "post_tag", ttxIds);
//     } else {
//       await replaceTaxForPost(cx, id, "post_tag", []);
//     }

//     // 4) featured image
//     if (Number.isFinite(Number(featuredImageId)) && Number(featuredImageId) > 0) {
//       await setPostMeta(cx, id, "_thumbnail_id", String(Number(featuredImageId)));
//     }

//     // 5) EXTRA
//     await upsertPostExtra(cx, id, { subtitle, highlight, format, gallery, videoEmbed });

//     return id;
//   });

//   const row = await query<{ post_status: string }>(
//     `SELECT post_status FROM wp_posts WHERE ID=?`,
//     [postId]
//   );
//   return { id: postId, slug: finalSlug, status: row[0]?.post_status || status };
// }

// // -----------------------------------------------------------------------------
// // LIST (filters + pagination + sorting)
// // -----------------------------------------------------------------------------

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
//        SELECT 1
//          FROM wp_term_relationships tr2
//          JOIN wp_term_taxonomy tt2 ON tt2.term_taxonomy_id = tr2.term_taxonomy_id
//          JOIN wp_terms t2 ON t2.term_id = tt2.term_id
//         WHERE tr2.object_id = p.ID
//           AND tt2.taxonomy = 'category'
//           ${categoryTtxId ? "AND tt2.term_taxonomy_id = ?" : ""}
//           ${categorySlug ? "AND t2.slug = ?" : ""}
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

// // -----------------------------------------------------------------------------
// // Month buckets (for dropdown)
// // -----------------------------------------------------------------------------

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
// // Quick Edit
// // -----------------------------------------------------------------------------

// export type QuickEditInput = {
//   id: number;
//   title?: string;
//   slug?: string;
//   status?: QuickStatus;
//   categoryTtxIds?: number[];
//   tagTtxIds?: number[];
// };

// export async function quickEditPostRepo(input: QuickEditInput) {
//   const { id, title, slug, status, categoryTtxIds, tagTtxIds } = input;

//   await withTx(async (cx) => {
//     const currentTime = getCurrentBangladeshTime();
    
//     const [rows]: any = await cx.query(
//       `SELECT ID, post_title, post_name, post_status FROM wp_posts WHERE ID = ? LIMIT 1`,
//       [id]
//     );
//     const row = rows[0];
//     if (!row) throw new Error("Post not found");

//     // slug compute (if needed)
//     let nextSlug: string | undefined;
//     if (typeof slug === "string") {
//       const base = slug || title || row.post_title || "post";
//       nextSlug = await ensureUniquePostSlug(base, id);
//     } else if (title && !row.post_name) {
//       nextSlug = await ensureUniquePostSlug(title, id);
//     }

//     const sets: string[] = [];
//     const args: any[] = [];
//     if (typeof title === "string") { sets.push("post_title=?"); args.push(title); }
//     if (typeof nextSlug === "string") { sets.push("post_name=?"); args.push(nextSlug); }
//     if (status && ["publish", "draft", "pending"].includes(status)) { sets.push("post_status=?"); args.push(status); }
//     if (sets.length) {
//       sets.push("post_modified=?", "post_modified_gmt=?");
//       args.push(currentTime.local, currentTime.utc);
//       await cx.execute(`UPDATE wp_posts SET ${sets.join(", ")} WHERE ID = ?`, [...args, id]);
//     }

//     await replaceTaxForPost(cx, id, "category", categoryTtxIds);
//     await replaceTaxForPost(cx, id, "post_tag", tagTtxIds);
//   });
// }

// // -----------------------------------------------------------------------------
// // Full Edit (Editor save) – EXTRA + schedule
// // -----------------------------------------------------------------------------

// export async function updatePostRepo(input: UpdatePostInput) {
//   const {
//     id, title, content, excerpt, status, slug,
//     categoryTtxIds, tagNames, featuredImageId,
//     subtitle, highlight, format, gallery, videoEmbed,
//     scheduledAt,
//   } = input;

//   console.log("=== updatePostRepo DEBUG ===");
//   console.log("Input status:", status);
//   console.log("Input scheduledAt:", scheduledAt);

//   await withTx(async (cx) => {
//     const currentTime = getCurrentBangladeshTime();
    
//     // 1. First get current post data
//     const [currentRows]: any = await cx.query(
//       `SELECT post_status, post_date FROM wp_posts WHERE ID = ? LIMIT 1`,
//       [id]
//     );
//     const currentPost = currentRows[0];
//     console.log("Current post status:", currentPost?.post_status);

//     // 2. Handle slug
//     let nextSlug: string | undefined;
//     if (typeof slug === "string") {
//       const base = slug || title || "post";
//       nextSlug = await ensureUniquePostSlug(base, id);
//     }

//     // 3. Build update sets
//     const sets: string[] = [];
//     const args: any[] = [];

//     if (typeof title === "string") { sets.push("post_title=?"); args.push(title); }
//     if (typeof content === "string") { sets.push("post_content=?"); args.push(content); }
//     if (typeof excerpt === "string") { sets.push("post_excerpt=?"); args.push(excerpt); }
//     if (typeof nextSlug === "string") { sets.push("post_name=?"); args.push(nextSlug); }

//     // 4. Handle status and schedule - বাংলাদেশ টাইম ব্যবহার করে
//     let finalStatus = status;

//     if (scheduledAt !== undefined) {
//       if (scheduledAt === null) {
//         // Clear schedule - set to current বাংলাদেশ টাইম
//         sets.push("post_date=?", "post_date_gmt=?");
//         args.push(currentTime.local, currentTime.utc);
//         await setPostMeta(cx, id, "_scheduled_at", null);
//         console.log("Cleared schedule - using current Bangladesh time");
//       } else {
//         // Set schedule with বাংলাদেশ টাইম
//         const bangladeshTime = toBangladeshDateTime(scheduledAt);
//         sets.push("post_date=?", "post_date_gmt=?");
//         args.push(bangladeshTime.local, bangladeshTime.utc);
        
//         finalStatus = bangladeshTime.isFuture ? "future" : (status || "publish");
//         await setPostMeta(cx, id, "_scheduled_at", bangladeshTime.local);
//         console.log("Set schedule with Bangladesh time, finalStatus:", finalStatus);
//       }
//     }

//     // 5. Apply status if provided
//     if (finalStatus && ["publish","draft","pending","trash","future"].includes(finalStatus)) {
//       sets.push("post_status=?");
//       args.push(finalStatus);
//       console.log("Setting post_status to:", finalStatus);
//     }

//     // 6. Always update modified dates with বাংলাদেশ টাইম
//     sets.push("post_modified=?", "post_modified_gmt=?");
//     args.push(currentTime.local, currentTime.utc);

//     // 7. Execute post update
//     if (sets.length > 2) { // More than just modified dates
//       const sql = `UPDATE wp_posts SET ${sets.join(", ")} WHERE ID = ?`;
//       console.log("Executing SQL:", sql);
//       console.log("With args:", [...args, id]);
      
//       await cx.execute(sql, [...args, id]);
//     }

//     // 8. Handle taxonomies
//     if (categoryTtxIds !== undefined) {
//       await replaceTaxForPost(cx, id, "category", categoryTtxIds);
//     }

//     if (tagNames !== undefined) {
//       if (Array.isArray(tagNames) && tagNames.length) {
//         const ttxIds: number[] = [];
//         for (const n of tagNames) {
//           const nm = String(n ?? "").trim();
//           if (!nm) continue;
//           ttxIds.push(await getOrCreateTagTermTaxonomyId(nm));
//         }
//         await replaceTaxForPost(cx, id, "post_tag", ttxIds);
//       } else {
//         await replaceTaxForPost(cx, id, "post_tag", []);
//       }
//     }

//     // 9. Featured image
//     if (featuredImageId !== undefined) {
//       if (featuredImageId === null) {
//         await setPostMeta(cx, id, "_thumbnail_id", null);
//       } else if (Number.isFinite(featuredImageId) && featuredImageId > 0) {
//         await setPostMeta(cx, id, "_thumbnail_id", String(featuredImageId));
//       }
//     }

//     // 10. EXTRA fields
//     if (subtitle !== undefined || highlight !== undefined || format !== undefined || gallery !== undefined || videoEmbed !== undefined) {
//       await upsertPostExtra(cx, id, {
//         subtitle: subtitle,
//         highlight: highlight,
//         format: format,
//         gallery: gallery === null ? [] : gallery,
//         videoEmbed: videoEmbed,
//       });
//     }

//     console.log("=== updatePostRepo COMPLETED ===");
//   });
// }

// // -----------------------------------------------------------------------------
// // Trash / Restore / Hard Delete
// // -----------------------------------------------------------------------------

// export async function movePostToTrashRepo(postId: number) {
//   await withTx(async (cx) => {
//     const currentTime = getCurrentBangladeshTime();
    
//     const [rows]: any = await cx.query(
//       `SELECT post_status FROM wp_posts WHERE ID = ? LIMIT 1`,
//       [postId]
//     );
//     const row = rows[0];
//     if (!row) throw new Error("Post not found");
//     if (row.post_status === "trash") return;

//     await setPostMeta(cx, postId, "_wp_trash_meta_status", row.post_status);
//     await setPostMeta(cx, postId, "_wp_trash_meta_time", String(Math.floor(Date.now() / 1000)));

//     await cx.execute(
//       `UPDATE wp_posts
//           SET post_status='trash', post_modified=?, post_modified_gmt=?
//         WHERE ID = ?`,
//       [currentTime.local, currentTime.utc, postId]
//     );
//   });
// }

// export async function restorePostFromTrashRepo(postId: number) {
//   await withTx(async (cx) => {
//     const currentTime = getCurrentBangladeshTime();
    
//     const [metaRows]: any = await cx.query(
//       `SELECT meta_value FROM wp_postmeta WHERE post_id = ? AND meta_key = '_wp_trash_meta_status' LIMIT 1`,
//       [postId]
//     );
//     const prev = metaRows[0]?.meta_value || "draft";

//     await cx.execute(
//       `UPDATE wp_posts
//           SET post_status=?, post_modified=?, post_modified_gmt=?
//         WHERE ID = ?`,
//       [prev, currentTime.local, currentTime.utc, postId]
//     );

//     await cx.execute(
//       `DELETE FROM wp_postmeta
//         WHERE post_id = ? AND meta_key IN ('_wp_trash_meta_status','_wp_trash_meta_time')`,
//       [postId]
//     );
//   });
// }

// export async function hardDeletePostRepo(postId: number) {
//   await withTx(async (cx) => {
//     await cx.execute(`DELETE FROM wp_term_relationships WHERE object_id = ?`, [postId]);
//     await cx.execute(`DELETE FROM wp_postmeta WHERE post_id = ?`, [postId]);
//     await cx.execute(`DELETE FROM wp_comments WHERE comment_post_ID = ?`, [postId]);
//     await cx.execute(`DELETE FROM wp_posts WHERE ID = ?`, [postId]);
//   });
// }