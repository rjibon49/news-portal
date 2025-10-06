// src/db/createDefaultCategory.ts
//
// Creates/ensures a default "Others" category.
// - wp_terms (name, slug)
// - wp_term_taxonomy (taxonomy='category')
// Safe to run multiple times.

import { execute, query, getPool } from "./mysql.js";
import { slugify } from "../lib/slugify.js";
import "./loadEnv.js";

/** Ensure a 'category' taxonomy exists for given term_id, return term_taxonomy_id */
async function ensureCategoryTTX(termId: number): Promise<number> {
  // already has a category ttx?
  const rows = await query<{ term_taxonomy_id: number }>(
    `SELECT term_taxonomy_id
       FROM wp_term_taxonomy
      WHERE term_id = ? AND taxonomy = 'category'
      LIMIT 1`,
    [termId]
  );
  if (rows.length) return rows[0].term_taxonomy_id;

  const ins = await execute(
    `INSERT INTO wp_term_taxonomy
       (term_id, taxonomy, description, parent, count)
     VALUES (?, 'category', '', 0, 0)`,
    [termId]
  );
  return Number(ins.insertId);
}

/** Ensure a term (wp_terms) exists by slug, return term_id */
async function ensureTerm(name: string, slug: string): Promise<number> {
  const found = await query<{ term_id: number }>(
    `SELECT term_id FROM wp_terms WHERE slug = ? LIMIT 1`,
    [slug]
  );
  if (found.length) return found[0].term_id;

  const ins = await execute(
    `INSERT INTO wp_terms (name, slug, term_group) VALUES (?, ?, 0)`,
    [name, slug]
  );
  return Number(ins.insertId);
}

async function ensureDefaultCategory() {
  const name = "0 Others";
  // WP-স্টাইলে স্লাগ বানাই (ASCII; 200 chars cap)
  const slug = slugify(name, { keepUnicode: false, maxLength: 200 }) || "others";

  // terms + taxonomy ensure
  const termId = await ensureTerm(name, slug);
  const ttxId = await ensureCategoryTTX(termId);

  console.log(
    `✅ Default category ensured: name="${name}", slug="${slug}", term_id=${termId}, term_taxonomy_id=${ttxId}`
  );
}

(async () => {
  try {
    getPool();                 // init pool
    await ensureDefaultCategory();
  } catch (err) {
    console.error("❌ Error ensuring default category:", err);
    process.exitCode = 1;
  } finally {
    try {
      await getPool().end();   // close pool
    } catch {}
  }
})();
