// src/app/(site)/category/[slug]/page.tsx
import type { Metadata } from "next";
import ArticleBlock14 from "@/components/ArticleBlocks/ArticleBlock14/ArticleBlock14";
import PagePager from "@/components/ui/Pagination/PagePager";
import styles from "../../page.module.css";
import type { ListPostsResult } from "@/types/post";
import { absoluteUrl } from "@/utils/apiBase";
import { mapPostsToNews } from "@/components/news/mapPost";

export const dynamic = "force-dynamic";

function isNumeric(v: string) {
  return /^[0-9]+$/.test(v);
}
function humanizeSlug(s: string) {
  const t = decodeURIComponent(s).trim().replace(/\s+/g, "-");
  return t.split("-").map(w => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");
}

async function fetchCategoryPosts(
  slugOrId: string,
  sp: Record<string, string | string[] | undefined>
) {
  const page = Number(sp.page ?? 1) || 1;
  const perPage = Number(sp.perPage ?? 12) || 12;
  const q = typeof sp.q === "string" ? sp.q : "";

  const params: Record<string, string> = {
    status: "publish",
    page: String(page),
    perPage: String(perPage),
  };
  if (isNumeric(slugOrId)) params.categoryTtxId = slugOrId;
  else params.categorySlug = slugOrId;
  if (q) params.q = q;

  const url = await absoluteUrl(`/api/r2/posts?${new URLSearchParams(params).toString()}`);
  const res = await fetch(url, { cache: "no-store", next: { revalidate: 0 } });
  if (!res.ok) return { rows: [], total: 0, page, perPage } as ListPostsResult;
  return (await res.json()) as ListPostsResult;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const name = isNumeric(slug) ? `Category #${slug}` : humanizeSlug(slug);
  return {
    title: `Category: ${name} – News Portal`,
    description: `Latest posts from ${name}.`,
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const result = await fetchCategoryPosts(slug, sp);
  const news = mapPostsToNews(result.rows);

  const heading = isNumeric(slug) ? `Category #${slug}` : humanizeSlug(slug);

  return (
    <main className={styles.wrap}>
      <div className={styles.head}>
        <h2 className={styles.h2}>Category: {heading}</h2>

        <form action={`/category/${encodeURIComponent(slug)}`} className={styles.search}>
          <input
            name="q"
            placeholder="Search in this category…"
            defaultValue={typeof sp.q === "string" ? sp.q : ""}
          />
          <button type="submit">Search</button>
        </form>
      </div>

      {news.length === 0 ? (
        <p>No articles found in “{heading}”.</p>
      ) : (
        <ArticleBlock14
          title={heading}
          items={news}
          listCount={news.length}
          showDates
          relativeDates
          showExcerpt={false}
          fallbackImage="/placeholder.jpg"
          headingVariant={6}
          headingBg="#0b1e4a"
          headingColor="#0b1e4a"
        />
      )}

      <PagePager
        currentPage={result.page}
        totalPages={Math.max(1, Math.ceil(result.total / result.perPage))}
        mode="numbers"
        className={styles.pager}
      />
    </main>
  );
}
