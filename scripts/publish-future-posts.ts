// scripts/publish-future-posts.ts
// -----------------------------------------------------------------------------
// Promote scheduled (future) posts to publish when post_date <= NOW()
// Safe to run every minute from cron/PM2/systemd.
// -----------------------------------------------------------------------------

import { query, execute, withTx } from "@/db/mysql"; // আপনার বিদ্যমান helper

async function publishDueFuturePosts() {
  // 1) যেগুলো due হয়ে গেছে সেগুলো বের করি
  const due = await query<{ ID: number }>(`
    SELECT ID
    FROM wp_posts
    WHERE post_type='post'
      AND post_status='future'
      AND post_date <= NOW()
  `);

  if (!due.length) {
    console.log(`[${new Date().toISOString()}] No due future posts.`);
    return;
  }

  const ids = due.map(r => r.ID);
  console.log(`[${new Date().toISOString()}] Found ${ids.length} due posts: ${ids.join(", ")}`);

  // 2) ট্রানজ্যাকশনে status publish করে দেই
  await withTx(async (cx) => {
    // status publish + modified timestamps set
    await cx.execute(
      `UPDATE wp_posts
         SET post_status='publish',
             post_modified=NOW(),
             post_modified_gmt=UTC_TIMESTAMP()
       WHERE ID IN (${ids.map(()=>"?").join(",")})`,
      ids
    );
  });

  console.log(`[${new Date().toISOString()}] Promoted ${ids.length} posts to publish.`);
}

publishDueFuturePosts()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error running publish-future-posts:", err);
    process.exit(1);
  });
