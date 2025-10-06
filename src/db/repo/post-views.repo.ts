// src/db/repo/post-views.repo.ts
import { query, withTx } from "@/db/mysql";

/**
 * Bangladesh local date (UTC+6) – SQL side-এ করি যাতে server TZ নিয়ে ঝামেলা না হয়।
 * DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+06:00')) -> আজকের BD date
 */

/* ───────────────────────────── Write (with dedup) ───────────────────────────── */

/**
 * One-per-device-per-day dedup:
 *  - hits(post_id, ymd, fp) টেবিলে INSERT IGNORE; নতুন হলে তবেই কাউন্টার বাড়াই
 *  - `fp` = fingerprint (e.g., SHA1(IP|UA|postId))
 *    - DB যদি VARBINARY(20) ব্যবহার করে → Buffer দিন (recommended)
 *    - DB যদি VARCHAR(40) HEX ব্যবহার করে → hex string দিন
 *
 * Return: { counted: true } হলে নতুন ভিউ গোনা হয়েছে, না হলে আগে থেকেই ছিল।
 */
export async function recordPostViewWithDedupRepo(
  postId: number,
  fp: Buffer | string
): Promise<{ counted: boolean }> {
  if (!Number.isFinite(postId) || postId <= 0) throw new Error("Bad post id");

  let counted = false;

  await withTx(async (cx) => {
    // 1) fingerprint insert (Bangladesh local day)
    const [ins] = await cx.execute(
      `INSERT IGNORE INTO wp_post_view_hits (post_id, ymd, fp)
       VALUES (?, DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+06:00')), ?)`,
      [postId, fp]
    );
    const affected = (ins as any)?.affectedRows ?? 0;
    counted = affected > 0;

    if (!counted) return; // একই দিন + একই fp আগে থেকেই ছিল → কিছু করার নেই

    // 2) all-time counter
    await cx.execute(
      `INSERT INTO wp_post_view_total (post_id, views)
       VALUES (?, 1)
       ON DUPLICATE KEY UPDATE views = views + 1`,
      [postId]
    );

    // 3) daily counter (Bangladesh local date)
    await cx.execute(
      `INSERT INTO wp_post_view_daily (post_id, ymd, views)
       VALUES (?, DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+06:00')), 1)
       ON DUPLICATE KEY UPDATE views = views + 1`,
      [postId]
    );
  });

  return { counted };
}

/**
 * (optional) Simple counter — কোন ডেডুপ ছাড়াই বাড়াবে
 * আগের কোডের compatible ভার্সন; দরকার হলে ব্যবহার করো।
 */
export async function recordPostViewRepo(postId: number): Promise<void> {
  if (!Number.isFinite(postId) || postId <= 0) throw new Error("Bad post id");

  await withTx(async (cx) => {
    await cx.execute(
      `INSERT INTO wp_post_view_total (post_id, views)
       VALUES (?, 1)
       ON DUPLICATE KEY UPDATE views = views + 1`,
      [postId]
    );

    await cx.execute(
      `INSERT INTO wp_post_view_daily (post_id, ymd, views)
       VALUES (?, DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+06:00')), 1)
       ON DUPLICATE KEY UPDATE views = views + 1`,
      [postId]
    );
  });
}

/* ───────────────────────────── Read (stats) ───────────────────────────── */

export async function getPostViewStatsRepo(postId: number): Promise<{
  today: number;
  last7d: number;
  last30d: number;
  all: number;
}> {
  if (!Number.isFinite(postId) || postId <= 0) throw new Error("Bad post id");

  // today (BD)
  const todayRows = await query<{ views: number }>(
    `SELECT COALESCE(SUM(views), 0) AS views
       FROM wp_post_view_daily
      WHERE post_id = ?
        AND ymd = DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+06:00'))`,
    [postId]
  );

  // last 7 days (BD cut-off)
  const d7Rows = await query<{ views: number }>(
    `SELECT COALESCE(SUM(views), 0) AS views
       FROM wp_post_view_daily
      WHERE post_id = ?
        AND ymd >= DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+06:00')) - INTERVAL 6 DAY`,
    [postId]
  );

  // last 30 days
  const d30Rows = await query<{ views: number }>(
    `SELECT COALESCE(SUM(views), 0) AS views
       FROM wp_post_view_daily
      WHERE post_id = ?
        AND ymd >= DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+06:00')) - INTERVAL 29 DAY`,
    [postId]
  );

  // all-time (daily থেকে sum করলে index ধরে কাজ করবে)
  const allRows = await query<{ views: number }>(
    `SELECT COALESCE(SUM(views), 0) AS views
       FROM wp_post_view_daily
      WHERE post_id = ?`,
    [postId]
  );

  return {
    today: todayRows[0]?.views ?? 0,
    last7d: d7Rows[0]?.views ?? 0,
    last30d: d30Rows[0]?.views ?? 0,
    all: allRows[0]?.views ?? 0,
  };
}

/* ───────────────────────── Popular posts (windowed) ──────────────────────── */

export async function getPopularPostsRepo(opts: {
  range: "1d" | "7d" | "30d" | "all";
  limit?: number;
}) {
  const { range, limit = 10 } = opts;

  const where =
    range === "1d"
      ? `d.ymd = DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+06:00'))`
      : range === "7d"
      ? `d.ymd >= DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+06:00')) - INTERVAL 6 DAY`
      : range === "30d"
      ? `d.ymd >= DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+06:00')) - INTERVAL 29 DAY`
      : `1=1`; // all

  // publish/future/pending/… ফিল্টার দরকার হলে WHERE-এ p.post_status যোগ করো
  const rows = await query<{
    post_id: number;
    views: number;
    post_title: string;
    post_date: string;
    post_status: string;
    post_author: number;
  }>(
    `SELECT p.ID AS post_id,
            SUM(d.views) AS views,
            p.post_title,
            p.post_date,
            p.post_status,
            p.post_author
       FROM wp_post_view_daily d
       JOIN wp_posts p ON p.ID = d.post_id
      WHERE ${where}
      GROUP BY p.ID
      ORDER BY views DESC
      LIMIT ?`,
    [limit]
  );

  return rows;
}
