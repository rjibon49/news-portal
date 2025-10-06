// -----------------------------------------------------------------------------
// FILE: src/db/repo/posts/index.ts
// Barrel: single import surface for callers
// -----------------------------------------------------------------------------
export * from "./types";
export * from "./create";
export * from "./list";
export * from "./quickEdit";
export * from "./update";
export * from "./trash";


// (Internal helpers are intentionally NOT re-exported by default)
// If you need them for tests, explicitly export:
export { ensureUniquePostSlug, normalizeIds } from "./util";