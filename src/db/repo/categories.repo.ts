// src/db/repo/categories.repo.ts

import { execute, query, withTx } from "@/db/mysql";

export type CategoryDTO = {
  term_taxonomy_id: number;
  term_id: number;
  name: string;
  slug: string;
  description: string;
  parent: number;
  count: number; // live count (only published posts)
};

/**
 * Live count subquery (reuse in list + get).
 * Counts only published 'post' items attached to the given term_taxonomy_id.
 */
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

export async function listCategoriesRepo(): Promise<CategoryDTO[]> {
  return query<CategoryDTO>(
    `
    SELECT
      tt.term_taxonomy_id,
      t.term_id,
      t.name,
      t.slug,
      tt.description,
      tt.parent,
      ${LIVE_COUNT_SUBQUERY}
    FROM wp_terms t
    INNER JOIN wp_term_taxonomy tt ON t.term_id = tt.term_id
    WHERE tt.taxonomy = 'category'
    ORDER BY t.name ASC
    `
  );
}

export async function getCategoryByTTIdRepo(ttId: number): Promise<CategoryDTO | undefined> {
  const rows = await query<CategoryDTO>(
    `
    SELECT
      tt.term_taxonomy_id,
      t.term_id,
      t.name,
      t.slug,
      tt.description,
      tt.parent,
      ${LIVE_COUNT_SUBQUERY}
    FROM wp_terms t
    INNER JOIN wp_term_taxonomy tt ON t.term_id = tt.term_id
    WHERE tt.term_taxonomy_id = ? AND tt.taxonomy = 'category'
    LIMIT 1
    `,
    [ttId]
  );
  return rows[0];
}

export type CreateCategoryInput = {
  name: string;
  slug: string;
  description?: string;
  parent?: number | null; // parent term_taxonomy_id
};

export async function createCategoryRepo(input: CreateCategoryInput): Promise<CategoryDTO> {
  const { name, slug, description = "", parent } = input;

  const created = await withTx(async (cx) => {
    // Validate parent if provided
    if (parent) {
      const [prow] = await cx.query<any[]>(
        `SELECT term_taxonomy_id
           FROM wp_term_taxonomy
          WHERE term_taxonomy_id = ? AND taxonomy = 'category'
          LIMIT 1`,
        [parent]
      );
      if (!prow?.length) {
        const err: any = new Error("Invalid parent category");
        err.status = 400;
        throw err;
      }
    }

    // See if a term exists with this slug
    const [trows] = await cx.query<any[]>(
      `SELECT term_id, slug FROM wp_terms WHERE slug = ? LIMIT 1`,
      [slug]
    );

    let termId: number;
    if (trows?.length) {
      // Term exists; ensure it doesn't already have a 'category' taxonomy row
      termId = Number(trows[0].term_id);
      const [catRows] = await cx.query<any[]>(
        `SELECT term_taxonomy_id
           FROM wp_term_taxonomy
          WHERE term_id = ? AND taxonomy = 'category'
          LIMIT 1`,
        [termId]
      );
      if (catRows?.length) {
        const err: any = new Error("A category with this slug already exists.");
        err.status = 409;
        throw err;
      }

      const [insTT] = await cx.execute<any>(
        `INSERT INTO wp_term_taxonomy (term_id, taxonomy, description, parent, count)
         VALUES (?, 'category', ?, ?, 0)`,
        [termId, description, parent ?? 0]
      );
      return { term_taxonomy_id: Number((insTT as any).insertId), term_id: termId };
    } else {
      // Create new term + taxonomy
      const [insT] = await cx.execute<any>(
        `INSERT INTO wp_terms (name, slug, term_group) VALUES (?, ?, 0)`,
        [name, slug]
      );
      termId = Number((insT as any).insertId);

      const [insTT] = await cx.execute<any>(
        `INSERT INTO wp_term_taxonomy (term_id, taxonomy, description, parent, count)
         VALUES (?, 'category', ?, ?, 0)`,
        [termId, description, parent ?? 0]
      );
      return { term_taxonomy_id: Number((insTT as any).insertId), term_id: termId };
    }
  });

  const dto = await getCategoryByTTIdRepo(created.term_taxonomy_id);
  if (!dto) throw new Error("Failed to fetch created category");
  return dto;
}

export type UpdateCategoryInput = {
  term_taxonomy_id: number;
  name?: string;
  slug?: string;
  description?: string;
  parent?: number | null;
};

/**
 * Conservative update:
 * - Validates parent (not itself; must exist if provided)
 * - If slug changes: must be unique across wp_terms (avoid conflicts)
 * - Updates wp_terms (name/slug) and wp_term_taxonomy (description/parent)
 */
export async function updateCategoryRepo(input: UpdateCategoryInput): Promise<CategoryDTO> {
  const { term_taxonomy_id, name, slug, description, parent } = input;

  await withTx(async (cx) => {
    // Current term + tt
    const [curRows] = await cx.query<any[]>(
      `SELECT tt.term_taxonomy_id, tt.term_id, tt.parent, t.name, t.slug
         FROM wp_term_taxonomy tt
         JOIN wp_terms t ON t.term_id = tt.term_id
        WHERE tt.term_taxonomy_id = ? AND tt.taxonomy = 'category'
        LIMIT 1`,
      [term_taxonomy_id]
    );
    if (!curRows?.length) {
      const err: any = new Error("Category not found");
      err.status = 404;
      throw err;
    }
    const cur = curRows[0] as { term_id: number; name: string; slug: string };

    // Parent validation
    if (parent != null) {
      if (parent === term_taxonomy_id) {
        const err: any = new Error("A category cannot be its own parent");
        err.status = 400;
        throw err;
      }
      if (parent > 0) {
        const [prow] = await cx.query<any[]>(
          `SELECT term_taxonomy_id
             FROM wp_term_taxonomy
            WHERE term_taxonomy_id = ? AND taxonomy='category'
            LIMIT 1`,
          [parent]
        );
        if (!prow?.length) {
          const err: any = new Error("Invalid parent category");
          err.status = 400;
          throw err;
        }
      }
    }

    // Slug uniqueness (across wp_terms)
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

    // Update wp_terms (only if changed fields provided)
    if (name || slug) {
      const newName = name ?? cur.name;
      const newSlug = slug ?? cur.slug;
      await cx.execute(
        `UPDATE wp_terms SET name = ?, slug = ? WHERE term_id = ?`,
        [newName, newSlug, cur.term_id]
      );
    }

    // Update wp_term_taxonomy (COALESCE preserves existing when null passed)
    if (description != null || parent != null) {
      await cx.execute(
        `UPDATE wp_term_taxonomy
            SET description = COALESCE(?, description),
                parent      = COALESCE(?, parent)
          WHERE term_taxonomy_id = ?`,
        [description ?? null, parent ?? null, term_taxonomy_id]
      );
    }
  });

  const dto = await getCategoryByTTIdRepo(term_taxonomy_id);
  if (!dto) throw new Error("Failed to fetch updated category");
  return dto;
}

/**
 * Delete category:
 * - Re-parent children to root (parent=0)
 * - Remove relationships
 * - Delete tt row
 * - If term has no other taxonomies, delete term row
 */
export async function deleteCategoryRepo(term_taxonomy_id: number): Promise<void> {
  await withTx(async (cx) => {
    // fetch tt -> term_id
    const [tt] = await cx.query<any[]>(
      `SELECT term_id
         FROM wp_term_taxonomy
        WHERE term_taxonomy_id = ? AND taxonomy='category'
        LIMIT 1`,
      [term_taxonomy_id]
    );
    if (!tt?.length) {
      const err: any = new Error("Category not found");
      err.status = 404;
      throw err;
    }
    const termId = Number(tt[0].term_id);

    // re-parent children to root
    await cx.execute(
      `UPDATE wp_term_taxonomy
          SET parent = 0
        WHERE taxonomy='category' AND parent = ?`,
      [term_taxonomy_id]
    );

    // remove relationships (detach posts from this category)
    await cx.execute(
      `DELETE FROM wp_term_relationships WHERE term_taxonomy_id = ?`,
      [term_taxonomy_id]
    );

    // delete taxonomy row
    await cx.execute(
      `DELETE FROM wp_term_taxonomy
        WHERE term_taxonomy_id = ? AND taxonomy='category'`,
      [term_taxonomy_id]
    );

    // if no more taxonomies reference the term, delete term row
    const [others] = await cx.query<any[]>(
      `SELECT 1 FROM wp_term_taxonomy WHERE term_id = ? LIMIT 1`,
      [termId]
    );
    if (!others?.length) {
      await cx.execute(`DELETE FROM wp_terms WHERE term_id = ?`, [termId]);
    }
  });
}
