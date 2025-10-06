// -----------------------------------------------------------------------------
// FILE: src/db/repo/posts/taxonomy.ts
// -----------------------------------------------------------------------------
import { query, execute } from "@/db/mysql";
import { slugify } from "@/lib/slugify";
import { cleanIdArray } from "./util";


export async function getOrCreateTagTermTaxonomyId(name: string): Promise<number> {
const nm = name.trim();
if (!nm) throw new Error("Empty tag name");
const s = slugify(nm, { keepUnicode: true, maxLength: 190 }) || nm;


const term = await query<{ term_id: number }>(
`SELECT term_id FROM wp_terms WHERE slug = ? LIMIT 1`,
[s]
);
let termId: number;
if (term.length) {
termId = term[0].term_id;
} else {
const [ins]: any = await execute(
`INSERT INTO wp_terms (name, slug, term_group) VALUES (?, ?, 0)`,
[nm, s]
);
termId = Number(ins.insertId);
}


const ttx = await query<{ term_taxonomy_id: number }>(
`SELECT term_taxonomy_id FROM wp_term_taxonomy WHERE term_id = ? AND taxonomy = 'post_tag' LIMIT 1`,
[termId]
);
if (ttx.length) return ttx[0].term_taxonomy_id;


const [ins2]: any = await execute(
`INSERT INTO wp_term_taxonomy (term_id, taxonomy, description, parent, count)
VALUES (?, 'post_tag', '', 0, 0)`,
[termId]
);
return Number(ins2.insertId);
}

export async function replaceTaxForPost(
cx: any,
postId: number,
taxonomy: "category" | "post_tag",
termTaxonomyIds?: number[],
) {
const nextIds = cleanIdArray(termTaxonomyIds);


const [prevRows] = await cx.query(
`SELECT tr.term_taxonomy_id
FROM wp_term_relationships tr
JOIN wp_term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
WHERE tr.object_id = ? AND tt.taxonomy = ?`,
[postId, taxonomy]
);
const prevIds: number[] = (prevRows as Array<{ term_taxonomy_id: number }> ?? [])
.map((r) => Number(r.term_taxonomy_id))
.filter((n) => Number.isFinite(n) && n > 0);


await cx.execute(
`DELETE tr FROM wp_term_relationships tr
JOIN wp_term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
WHERE tr.object_id = ? AND tt.taxonomy = ?`,
[postId, taxonomy]
);


if (nextIds.length) {
const values = nextIds.map(() => "(?, ?)").join(", ");
const params: any[] = [];
nextIds.forEach((ttx) => params.push(postId, ttx));
await cx.execute(
`INSERT INTO wp_term_relationships (object_id, term_taxonomy_id) VALUES ${values}`,
params
);
}


const affected = Array.from(new Set([...prevIds, ...nextIds]));
if (affected.length) {
await cx.execute(
`UPDATE wp_term_taxonomy tt
SET tt.count = (
SELECT COUNT(*) FROM wp_term_relationships tr
WHERE tr.term_taxonomy_id = tt.term_taxonomy_id
)
WHERE tt.term_taxonomy_id IN (${affected.map(() => "?").join(",")})`,
affected
);
}
}