// -----------------------------------------------------------------------------
// FILE: src/db/repo/posts/util.ts
// [UNCHANGED]
// -----------------------------------------------------------------------------
import { slugify } from "@/lib/slugify";
import { query } from "@/db/mysql";

export function normalizeIds(ids?: Array<number | string | null | undefined>): number[] {
  return Array.from(
    new Set(
      (ids ?? [])
        .map((v) => Number(v))
        .filter((n) => Number.isFinite(n) && n > 0) as number[]
    )
  );
}

export function cleanIdArray(arr?: unknown[]): number[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export async function ensureUniquePostSlug(base: string, excludeId?: number): Promise<string> {
  const baseSlug = slugify(base || "post", { keepUnicode: false, maxLength: 190 }) || "post";
  let candidate = baseSlug;
  let i = 2;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const taken = await query<{ ID: number }>(
      `SELECT ID FROM wp_posts
       WHERE post_name = ?
         AND post_type = 'post'
         AND post_status <> 'trash'
         ${excludeId ? "AND ID <> ?" : ""}
       LIMIT 1`,
      excludeId ? [candidate, excludeId] : [candidate]
    );
    if (!taken.length) return candidate;
    candidate = `${baseSlug}-${i++}`.slice(0, 190);
  }
}















// // -----------------------------------------------------------------------------
// // FILE: src/db/repo/posts/util.ts
// // -----------------------------------------------------------------------------
// import { slugify } from "@/lib/slugify";
// import { query } from "@/db/mysql";


// // normalize id arrays (dedupe + finite + >0)
// export function normalizeIds(ids?: Array<number | string | null | undefined>): number[] {
// return Array.from(
// new Set(
// (ids ?? [])
// .map((v) => Number(v))
// .filter((n) => Number.isFinite(n) && n > 0) as number[]
// )
// );
// }


// export function cleanIdArray(arr?: unknown[]): number[] {
// if (!Array.isArray(arr)) return [];
// return arr
// .map((x) => Number(x))
// .filter((n) => Number.isFinite(n) && n > 0);
// }


// export async function ensureUniquePostSlug(base: string, excludeId?: number): Promise<string> {
// const baseSlug = slugify(base || "post", { keepUnicode: false, maxLength: 190 }) || "post";
// let candidate = baseSlug;
// let i = 2;


// // eslint-disable-next-line no-constant-condition
// while (true) {
// const taken = await query<{ ID: number }>(
// `SELECT ID FROM wp_posts
// WHERE post_name = ?
// AND post_type = 'post'
// AND post_status <> 'trash'
// ${excludeId ? "AND ID <> ?" : ""}
// LIMIT 1`,
// excludeId ? [candidate, excludeId] : [candidate]
// );
// if (!taken.length) return candidate;
// candidate = `${baseSlug}-${i++}`.slice(0, 190);
// }
// }