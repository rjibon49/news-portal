import type { Metadata } from "next";
import styles from "./page.module.css";
import type { ListPostsResult } from "@/types/post";
import { absoluteUrl } from "@/utils/apiBase";
import { mapPostsToNews } from "@/components/news/mapPost";
import ArticleBlock1 from "@/components/ArticleBlocks/ArticleBlock1/ArticleBlock1";
import PagePager from "@/components/ui/Pagination/PagePager";
import ArticleBlock14 from "@/components/ArticleBlocks/ArticleBlock14/ArticleBlock14";

export const metadata: Metadata = {
  title: "News Portal – Home",
  description: "Latest posts and top stories.",
};

export const dynamic = "force-dynamic";

async function fetchPosts(sp: Record<string, string | string[] | undefined>) {
  const page = Number(sp.page ?? 1) || 1;
  const q = typeof sp.q === "string" ? sp.q : "";

  const qs = new URLSearchParams({
    status: "publish",
    page: String(page),
    perPage: "12",
    ...(q ? { q } : {}),
  });

  const url = await absoluteUrl(`/api/r2/posts?${qs.toString()}`);
  const res = await fetch(url, { next: { revalidate: 0 }, cache: "no-store" });
  if (!res.ok) return { rows: [], total: 0, page, perPage: 12 } as ListPostsResult;
  return (await res.json()) as ListPostsResult;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const result = await fetchPosts(sp);
  const totalPages = Math.max(1, Math.ceil(result.total / result.perPage));

  const news = mapPostsToNews(result.rows);

  return (
    <main className={styles.wrap}>
      <div className={styles.head}>
        <h2 className={styles.h2}>Latest Articles</h2>
        <div className={styles.tools}>
          <form action="/" className={styles.search}>
            <input
              name="q"
              placeholder="Search articles..."
              defaultValue={typeof sp.q === "string" ? sp.q : ""}
            />
            <button type="submit">Search</button>
          </form>
        </div>
      </div>

      {news.length === 0 ? (
        <p>No articles found.</p>
      ) : (
        <>
          <ArticleBlock1
            title="সর্বশেষ খবর"
            items={news}
            listCount={4}
            showExcerpt={false}
            fallbackImage="/placeholder.jpg"
            headingVariant={6}
            headingBg="#0b1e4a"
            headingColor="#0b1e4a"
            showDates={false}
            showCategory={false}
          />

          <PagePager
            currentPage={result.page}
            totalPages={totalPages}
            mode="numbers"
            className={styles.pager}
          />
          <ArticleBlock14
            title="টপ স্টোরিজ"
            items={news}
            listCount={4}
            showDates
            relativeDates
            showExcerpt
            maxExcerptWords={24}
            headingVariant={6}
            headingBg="#0b1e4a"
            headingColor="#0b1e4a"
          />
        </>
      )}
    </main>
  );
}
