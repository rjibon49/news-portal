// src/app/[slug]/page.tsx
import InfiniteArticleReader from "@/components/reader/InfiniteArticleReader";
import { absoluteUrl } from "@/utils/apiBase";
import grid from "@/components/reader/reader.module.css";

export const dynamic = "force-dynamic";

/** server-side: single post fetch */
async function fetchPost(slug: string) {
  const url = await absoluteUrl(`/api/r2/post/${encodeURIComponent(slug)}`);
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) return null;
  const j = await r.json().catch(() => ({}));
  return j?.post ?? null;
}

export default async function SingleArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await fetchPost(slug);

  if (!post) {
    return (
      <main className="container" style={{ padding: 24 }}>
        <h2>Sorry, this article was not found.</h2>
        <p><a href="/">← Back to Home</a></p>
      </main>
    );
  }

  return (
    <main className="container" style={{ padding: "24px 0" }}>
      {/* 3-column responsive layout: 30% / 40% / 30% (xl), ছোট স্ক্রিনে 1-col */}
      <div className={grid.wrap}>
        {/* Left 30% (এখন ফাঁকা) */}
        <aside className={grid.left} aria-hidden />

        {/* Center 40% – Article stream */}
        <section className={grid.center}>
          <InfiniteArticleReader
            initialPost={post}
            batchSize={2}              // একবারে কয়টা স্লাগ আনবে
            changeUrl={true}           // স্ক্রলে URL আপডেট
            urlPrefix=""               // রুট প্রিফিক্স (যদি nested route হয়, সেট করো)
            itemThreshold={0.6}        // কোন আর্টিকেল ভিউতে ধরা হবে (60%)
            sentinelRootMargin="400px 0px"
            maxArticles={Infinity}     // কতগুলো আর্টিকেল পর্যন্ত লোড করবে (চাইলে সংখ্যা দাও)
          />
        </section>

        {/* Right 30% (এখন ফাঁকা) */}
        <aside className={grid.right} aria-hidden />
      </div>
    </main>
  );
}
