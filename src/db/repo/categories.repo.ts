// src/db/repo/categories.repo.ts

import { execute, query, withTx } from "@/db/mysql";

export type CategoryDTO = {
  term_taxonomy_id: number;
  term_id: number;
  name: string;
  slug: string;
  description: string;
  parent: number;
  count: number;
};

export async function listCategoriesRepo(): Promise<CategoryDTO[]> {
  return query<CategoryDTO>(
    `SELECT tt.term_taxonomy_id, t.term_id, t.name, t.slug,
            tt.description, tt.parent, tt.count
     FROM wp_terms t
     INNER JOIN wp_term_taxonomy tt ON t.term_id = tt.term_id
     WHERE tt.taxonomy = 'category'
     ORDER BY t.name ASC`
  );
}

export async function getCategoryByTTIdRepo(ttId: number): Promise<CategoryDTO | undefined> {
  const rows = await query<CategoryDTO>(
    `SELECT tt.term_taxonomy_id, t.term_id, t.name, t.slug,
            tt.description, tt.parent, tt.count
       FROM wp_terms t
       INNER JOIN wp_term_taxonomy tt ON t.term_id = tt.term_id
      WHERE tt.term_taxonomy_id = ? LIMIT 1`,
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
    // parent validation (if provided)
    if (parent) {
      const [prow] = await cx.query<any[]>(
        `SELECT term_taxonomy_id FROM wp_term_taxonomy WHERE term_taxonomy_id = ? AND taxonomy = 'category' LIMIT 1`,
        [parent]
      );
      if (!prow?.length) {
        const err: any = new Error("Invalid parent category");
        err.status = 400;
        throw err;
      }
    }

    // check term by slug
    const [trows] = await cx.query<any[]>(
      `SELECT term_id, slug FROM wp_terms WHERE slug = ? LIMIT 1`,
      [slug]
    );

    let termId: number;

    if (trows?.length) {
      termId = Number(trows[0].term_id);
      const [catRows] = await cx.query<any[]>(
        `SELECT term_taxonomy_id FROM wp_term_taxonomy WHERE term_id = ? AND taxonomy = 'category' LIMIT 1`,
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
