// src/app/[slug]/page.tsx
import ArticleClient from "./Article.client";
import ArticleStream from "./ArticleStream.client";

export const dynamic = "force-dynamic";

async function fetchPost(slug: string) {
  const base =
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const url = `${base}/api/r2/post/${encodeURIComponent(slug)}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) return null;
  const j = await r.json().catch(() => ({}));
  return j?.post ?? null;         // <-- আপনার API shape
}

type PageParams = { slug: string };

export default async function SingleArticlePage({ params }: { params: Promise<PageParams> }) {
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

  // 🔁 API → UI mapping: ArticleClient যে প্রপ্স চায় তার মতো বানিয়ে দিচ্ছি
  const postUI = {
    slug,
    title: post.title,
    cover: post?.image?.src ?? post?.imageUrl ?? null,     // আপনার ডেটা অনুযায়ী
    bodyHtml: post?.contentHtml ?? post?.tailHtml ?? "",   // আপনার ফিল্ড অনুযায়ী
  };

  return (
    <main className="container" style={{ padding: "24px 0" }}>
      {/* <ArticleClient post={postUI} /> */}
      {/* চাইলে নিচে related/next পড়ুন সেকশনে ArticleStream দেওয়া যায় */}
      <div style={{marginTop: 32}}>
        {/* <h3>More for you</h3> */}
        <ArticleStream first={post} siteUrl={process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'} maxCount={2} />
      </div>
    </main>
  );
}
