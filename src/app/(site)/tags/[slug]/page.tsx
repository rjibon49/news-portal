// src/app/(site)/tags/[slug]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import styles from "./page.module.css";
import ArticleBlock14 from "@/components/ArticleBlocks/ArticleBlock14/ArticleBlock14";
import PagePager from "@/components/ui/Pagination/PagePager";
import { listPublishedPostsByTagSlugRepo } from "@/db/repo/posts/byTag";

const PER_PAGE = 12;

function toNews(rows: Awaited<ReturnType<typeof listPublishedPostsByTagSlugRepo>>["rows"]) {
  return rows.map(r => ({
    id: r.ID,
    slug: r.post_name || "",
    title: r.post_title,
    excerpt: r.post_excerpt || "",
    imageUrl: r.thumb_url || undefined,
    publishedAt: r.post_date,
    authorName: r.author_name || undefined,
    isVideo: !!r.is_video,
    isGallery: !!r.is_gallery,
  }));
}

export async function generateMetadata(
  { params, searchParams }: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
  }
): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  const page = Number(sp.page ?? 1) || 1;

  const data = await listPublishedPostsByTagSlugRepo(slug, page, PER_PAGE);
  if (data.total === 0) {
    return { title: `ট্যাগ: ${slug} – কিছু পাওয়া যায়নি` };
  }
  return {
    title: `ট্যাগ: ${slug} – পেজ ${page}`,
    description: `“${slug}” ট্যাগের আর্টিকেলসমূহ`,
  };
}

export default async function TagPage({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const page = Number(sp.page ?? 1) || 1;

  const data = await listPublishedPostsByTagSlugRepo(slug, page, PER_PAGE);
  if (page > 1 && data.total === 0) return notFound();

  const items = toNews(data.rows);

  return (
    <main className={styles.wrap}>
      <h1 className={styles.title}>ট্যাগ: {slug}</h1>

      {items.length === 0 ? (
        <p>এই ট্যাগে কোনো পোস্ট পাওয়া যায়নি।</p>
      ) : (
        <ArticleBlock14
          title={`“${slug}” ট্যাগের পোস্ট`}
          items={items}
          listCount={items.length}
          showExcerpt
          showDates
          showAuthor
        />
      )}

      {data.total > data.perPage && (
        <PagePager
          currentPage={data.page}
          totalPages={Math.ceil(data.total / data.perPage)}
          className={styles.pager}
          mode="numbers"
        />
      )}
    </main>
  );
}
