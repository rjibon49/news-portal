// src/db/repo/tags.repo.ts
// -----------------------------------------------------------------------------
// WordPress-style Tags Repository (taxonomy = 'post_tag')
// - List, Get-by-id (both return LIVE count of published posts)
// - Create/Upsert  ➜ reuse existing wp_terms slug & ensure post_tag taxonomy
// - Update (name/slug/description) with slug uniqueness check
// - Delete (detach relationships, delete taxonomy; delete term if unused)
// -----------------------------------------------------------------------------

import { query, withTx } from "@/db/mysql";

// --------------------------------- Types ------------------------------------
export type TagDTO = {
  term_taxonomy_id: number;
  term_id: number;
  name: string;
  slug: string;
  description: string;
  count: number; // LIVE count (only published posts)
};

// ------------------------------ Shared snippet ------------------------------
const LIVE_COUNT_SUBQUERY = `
(
  SELECT COUNT(*)
  FROM wp_term_relationships tr
  JOIN wp_posts p ON p.ID = tr.object_id
  WHERE tr.term_taxonomy_id = tt.term_taxonomy_id
    AND p.post_type = 'post'
    AND p.post_status = 'publish'
) AS count
`;

// ------------------------------ Basic Selects -------------------------------
export async function listTagsRepo(): Promise<TagDTO[]> {
  return query<TagDTO>(
    `
    SELECT
      tt.term_taxonomy_id,
      t.term_id,
      t.name,
      t.slug,
      tt.description,
      ${LIVE_COUNT_SUBQUERY}
    FROM wp_terms t
    INNER JOIN wp_term_taxonomy tt ON t.term_id = tt.term_id
    WHERE tt.taxonomy = 'post_tag'
    ORDER BY t.name ASC
    `
  );
}

export async function getTagByTTIdRepo(ttid: number): Promise<TagDTO | undefined> {
  const rows = await query<TagDTO>(
    `
    SELECT
      tt.term_taxonomy_id,
      t.term_id,
      t.name,
      t.slug,
      tt.description,
      ${LIVE_COUNT_SUBQUERY}
    FROM wp_terms t
    INNER JOIN wp_term_taxonomy tt ON t.term_id = tt.term_id
    WHERE tt.term_taxonomy_id = ? AND tt.taxonomy='post_tag'
    LIMIT 1
    `,
    [ttid]
  );
  return rows[0];
}

// ------------------------------ Create / Upsert ------------------------------
export type CreateTagInput = {
  name: string;         // Tag name (human-readable)
  slug: string;         // Unique slug (shared across all taxonomies in wp_terms)
  description?: string; // Optional description (stored on wp_term_taxonomy)
};

/**
 * createTagRepo (idempotent "upsert")
 * - If a term with the slug exists ➜ reuse term (sync name), ensure post_tag taxonomy
 * - If post_tag already exists ➜ update description and return it (no error)
 * - Else ➜ create new term + taxonomy
 */
export async function createTagRepo(input: CreateTagInput): Promise<TagDTO> {
  const { name, slug, description = "" } = input;

  const created = await withTx(async (cx) => {
    // 1) Find term by slug
    const [termRows] = await cx.query<any[]>(
      `SELECT term_id, name FROM wp_terms WHERE slug = ? LIMIT 1`,
      [slug]
    );

    let termId: number;

    if (termRows?.length) {
      // term exists ➜ optionally sync name
      termId = Number(termRows[0].term_id);
      if (termRows[0].name !== name) {
        await cx.execute(
          `UPDATE wp_terms SET name = ? WHERE term_id = ?`,
          [name, termId]
        );
      }

      // 2) ensure post_tag taxonomy
      const [tagRows] = await cx.query<any[]>(
        `SELECT term_taxonomy_id
           FROM wp_term_taxonomy
          WHERE term_id = ? AND taxonomy='post_tag'
          LIMIT 1`,
        [termId]
      );

      if (tagRows?.length) {
        const ttid = Number(tagRows[0].term_taxonomy_id);
        // keep description up-to-date
        await cx.execute(
          `UPDATE wp_term_taxonomy SET description = ? WHERE term_taxonomy_id = ?`,
          [description, ttid]
        );
        return { term_taxonomy_id: ttid };
      }

      // create taxonomy if missing
      const [insTT] = await cx.execute<any>(
        `INSERT INTO wp_term_taxonomy (term_id, taxonomy, description, parent, count)
         VALUES (?, 'post_tag', ?, 0, 0)`,
        [termId, description]
      );
      return { term_taxonomy_id: Number((insTT as any).insertId) };
    }

    // 3) create new term + taxonomy
    const [insT] = await cx.execute<any>(
      `INSERT INTO wp_terms (name, slug, term_group) VALUES (?, ?, 0)`,
      [name, slug]
    );
    termId = Number((insT as any).insertId);

    const [insTT] = await cx.execute<any>(
      `INSERT INTO wp_term_taxonomy (term_id, taxonomy, description, parent, count)
       VALUES (?, 'post_tag', ?, 0, 0)`,
      [termId, description]
    );

    return { term_taxonomy_id: Number((insTT as any).insertId) };
  });

  const dto = await getTagByTTIdRepo(created.term_taxonomy_id);
  if (!dto) throw new Error("Failed to fetch created tag");
  return dto;
}

// --------------------------------- Update -----------------------------------
export type UpdateTagInput = {
  term_taxonomy_id: number;
  name?: string;
  slug?: string;
  description?: string;
};

/**
 * updateTagRepo
 * - name/slug in wp_terms
 * - description in wp_term_taxonomy
 * - slug uniqueness across wp_terms (409 on conflict)
 */
export async function updateTagRepo(input: UpdateTagInput): Promise<TagDTO> {
  const { term_taxonomy_id, name, slug, description } = input;

  await withTx(async (cx) => {
    // current term + slug
    const [rows] = await cx.query<any[]>(
      `SELECT tt.term_id, t.name, t.slug
         FROM wp_term_taxonomy tt
         JOIN wp_terms t ON t.term_id = tt.term_id
        WHERE tt.term_taxonomy_id = ? AND tt.taxonomy='post_tag'
        LIMIT 1`,
      [term_taxonomy_id]
    );
    if (!rows?.length) {
      const err: any = new Error("Tag not found");
      err.status = 404;
      throw err;
    }
    const cur = rows[0] as { term_id: number; slug: string; name: string };

    // slug conflict check
    if (slug && slug !== cur.slug) {
      const [conflict] = await cx.query<any[]>(
        `SELECT term_id FROM wp_terms WHERE slug = ? AND term_id <> ? LIMIT 1`,
        [slug, cur.term_id]
      );
      if (conflict?.length) {
        const err: any = new Error("Slug already in use.");
        err.status = 409;
        throw err;
      }
    }

    // update term
    if (name || slug) {
      await cx.execute(
        `UPDATE wp_terms SET name = ?, slug = ? WHERE term_id = ?`,
        [name ?? cur.name, slug ?? cur.slug, cur.term_id]
      );
    }

    // update taxonomy description
    if (description != null) {
      await cx.execute(
        `UPDATE wp_term_taxonomy SET description = ? WHERE term_taxonomy_id = ?`,
        [description, term_taxonomy_id]
      );
    }
  });

  const dto = await getTagByTTIdRepo(term_taxonomy_id);
  if (!dto) throw new Error("Failed to fetch updated tag");
  return dto;
}

// --------------------------------- Delete -----------------------------------
/**
 * deleteTagRepo
 * - delete relationships for this ttid
 * - delete taxonomy row
 * - delete term if now unused by any taxonomy
 */
export async function deleteTagRepo(term_taxonomy_id: number): Promise<void> {
  await withTx(async (cx) => {
    // find term id
    const [tt] = await cx.query<any[]>(
      `SELECT term_id
         FROM wp_term_taxonomy
        WHERE term_taxonomy_id = ? AND taxonomy='post_tag'
        LIMIT 1`,
      [term_taxonomy_id]
    );
    if (!tt?.length) {
      const err: any = new Error("Tag not found");
      err.status = 404;
      throw err;
    }
    const termId = Number(tt[0].term_id);

    // remove relationships
    await cx.execute(
      `DELETE FROM wp_term_relationships WHERE term_taxonomy_id = ?`,
      [term_taxonomy_id]
    );

    // remove taxonomy row
    await cx.execute(
      `DELETE FROM wp_term_taxonomy
        WHERE term_taxonomy_id = ? AND taxonomy='post_tag'`,
      [term_taxonomy_id]
    );

    // remove term if unused elsewhere
    const [others] = await cx.query<any[]>(
      `SELECT 1 FROM wp_term_taxonomy WHERE term_id = ? LIMIT 1`,
      [termId]
    );
    if (!others?.length) {
      await cx.execute(`DELETE FROM wp_terms WHERE term_id = ?`, [termId]);
    }
  });
}
