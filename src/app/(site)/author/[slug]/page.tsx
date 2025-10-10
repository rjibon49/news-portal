// -----------------------------------------------------------------------------
// Author page (DB-direct version) — /author/[slug]
// - Next.js 15 compatible: await params/searchParams
// - No API calls; reads from MySQL directly to avoid URL/tooling issues
// - Shows author avatar/name/bio/website + lists published posts with pager
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { query } from "@/db/mysql";
import ArticleBlock14 from "@/components/ArticleBlocks/ArticleBlock14/ArticleBlock14";
import PagePager from "@/components/ui/Pagination/PagePager";
import { mapPostsToNews } from "@/components/news/mapPost";
import styles from "../../page.module.css";
import { createHash } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ---------------- utils ---------------- */
function md5(s: string) {
  return createHash("md5").update(s).digest("hex");
}

// try to pull a URL out of random meta formats
function extractUrlFromMeta(v?: string | null): string | undefined {
  if (!v) return;
  const t = String(v).trim();
  if (!t) return;

  if (t.startsWith("{") || t.startsWith("[")) {
    try {
      const j = JSON.parse(t);
      if (typeof j === "string" && /^https?:\/\//i.test(j)) return j;
      if (j && typeof j === "object") {
        if (typeof (j as any).full === "string") return (j as any).full;
        if (typeof (j as any).url === "string") return (j as any).url;
        if (typeof (j as any)["96"] === "string") return (j as any)["96"];
        for (const val of Object.values(j)) {
          if (typeof val === "string" && /^https?:\/\//i.test(val)) return val;
        }
      }
    } catch {}
  }
  const m = t.match(/https?:\/\/[^\s'"]+/i);
  if (m) return m[0];
  if (t.startsWith("/")) return t;
}

/* ---------------- DB helpers ---------------- */
type UserRow = {
  ID: number;
  user_login: string;
  user_nicename: string;
  display_name: string;
  user_email: string | null;
  user_url: string | null;
  description?: string | null; // some WP installs put bio here
};

async function loadAuthorBySlug(slug: string) {
  // match by nicename; fallback to slugified display_name
  const rows = await query<UserRow>(
    `
    SELECT ID, user_login, user_nicename, display_name, user_email, user_url
    FROM wp_users
    WHERE user_nicename = ?
       OR LOWER(REPLACE(display_name,' ','-')) = ?
    LIMIT 1
    `,
    [slug, slug.toLowerCase()]
  );
  if (!rows.length) return null;

  const u = rows[0];

  // bio (if you keep profile bio in usermeta or wp_users.description)
  const bioRow = await query<{ meta_value: string }>(
    `SELECT meta_value FROM wp_usermeta WHERE user_id=? AND meta_key IN ('description','bio') LIMIT 1`,
    [u.ID]
  ).catch(() => []);
  const bio =
    bioRow?.[0]?.meta_value ??
    null;

  // avatar
  const avatarMeta = await query<{ meta_value: string }>(
    `SELECT meta_value
       FROM wp_usermeta
      WHERE user_id=? AND meta_key IN ('avatar_url','profile_image','avatar','wp_user_avatar','simple_local_avatar')
      ORDER BY FIELD(meta_key,'avatar_url','profile_image','avatar','wp_user_avatar','simple_local_avatar')
      LIMIT 1`,
    [u.ID]
  ).catch(() => []);
  let avatarUrl = extractUrlFromMeta(avatarMeta?.[0]?.meta_value);
  if (!avatarUrl && u.user_email) {
    const hash = md5(u.user_email.trim().toLowerCase());
    avatarUrl = `https://www.gravatar.com/avatar/${hash}?s=128&d=identicon`;
  }

  return {
    id: u.ID,
    username: u.user_login,
    slug: u.user_nicename,
    name: u.display_name,
    email: u.user_email,
    website: u.user_url,
    bio,
    avatarUrl: avatarUrl ?? null,
  };
}

type PostRow = {
  ID: number;
  post_title: string;
  post_name: string | null;
  post_date: string;
  post_excerpt: string | null;
  thumb_id: string | null;
  categories: string | null;
};

async function loadPostsByAuthor(authorId: number, page: number, perPage: number) {
  const offset = (page - 1) * perPage;

  const rows = await query<PostRow>(
    `
    SELECT
      p.ID, p.post_title, p.post_name, p.post_date, p.post_excerpt,
      (SELECT pm.meta_value FROM wp_postmeta pm
        WHERE pm.post_id=p.ID AND pm.meta_key='_thumbnail_id' LIMIT 1) AS thumb_id,
      GROUP_CONCAT(DISTINCT CASE WHEN tt.taxonomy='category' THEN t.name END ORDER BY t.name SEPARATOR ', ') AS categories
    FROM wp_posts p
    LEFT JOIN wp_term_relationships tr ON tr.object_id = p.ID
    LEFT JOIN wp_term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
    LEFT JOIN wp_terms t ON t.term_id = tt.term_id
    WHERE p.post_type='post' AND p.post_status='publish' AND p.post_author=?
    GROUP BY p.ID
    ORDER BY p.post_date DESC
    LIMIT ? OFFSET ?
    `,
    [authorId, perPage, offset]
  );

  const count = await query<{ c: number }>(
    `SELECT COUNT(*) AS c FROM wp_posts WHERE post_type='post' AND post_status='publish' AND post_author=?`,
    [authorId]
  );
  const total = count?.[0]?.c ?? 0;

  // resolve thumbnails to urls (guid)
  let newsItems: any[] = [];
  if (rows.length) {
    const ids = rows
      .map((r) => Number(r.thumb_id))
      .filter((n) => Number.isFinite(n) && n > 0);

    const att: Record<number, string> = {};
    if (ids.length) {
      const ph = ids.map(() => "?").join(",");
      const arows = await query<{ ID: number; guid: string }>(
        `SELECT ID, guid FROM wp_posts WHERE post_type='attachment' AND ID IN (${ph})`,
        ids
      );
      arows.forEach((a) => (att[a.ID] = a.guid));
    }

    // map to the shape that mapPostsToNews expects
    newsItems = rows.map((r) => ({
      id: r.ID,
      slug: r.post_name || String(r.ID),
      title: r.post_title,
      date: r.post_date,
      excerpt: r.post_excerpt ?? "",
      imageUrl: r.thumb_id ? att[Number(r.thumb_id)] : undefined,
      category: r.categories ?? undefined,
    }));
  }

  return { rows: newsItems, total, page, perPage };
}

/* ---------------- Metadata ---------------- */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const a = await loadAuthorBySlug(slug);
  if (!a) return { title: "Author not found – News Portal" };
  return {
    title: `${a.name} – Author`,
    description: a.bio || `${a.name}'s articles`,
    openGraph: {
      title: `${a.name} – Author`,
      description: a.bio || `${a.name}'s articles`,
      images: a.avatarUrl ? [{ url: a.avatarUrl, alt: a.name }] : [],
      type: "profile",
      url: `/author/${a.slug}`,
    },
  };
}

/* ---------------- Page ---------------- */
export default async function AuthorPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const author = await loadAuthorBySlug(slug);

  if (!author) {
    return (
      <main className={styles.wrap}>
        <h2 className={styles.h2}>Author not found</h2>
      </main>
    );
  }

  const page = Number(sp.page ?? 1) || 1;
  const perPage = Number(sp.perPage ?? 12) || 12;

  const list = await loadPostsByAuthor(author.id, page, perPage);
  const news = mapPostsToNews(list.rows);

  return (
    <main className={styles.wrap}>
      {/* Author header */}
      <section className={styles.authorHead}>
        <div className={styles.authorBox}>
          <div className={styles.authorAvatar}>
            {author.avatarUrl ? (
              <Image
                src={author.avatarUrl}
                alt={author.name}
                width={96}
                height={96}
                className={styles.avatarImg}
                unoptimized
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/user-icon.svg" alt="" width={96} height={96} className={styles.avatarImg} />
            )}
          </div>
          <div>
            <h1 className={styles.h2} style={{ marginBottom: 4 }}>
              {author.name}
            </h1>
            <div className="dim" style={{ marginBottom: 6 }}>
              @{author.username}
              {author.website ? (
                <>
                  {" · "}
                  <a href={author.website} target="_blank" rel="noopener noreferrer">
                    {author.website.replace(/^https?:\/\//, "")}
                  </a>
                </>
              ) : null}
            </div>
            {author.bio ? <p className={styles.bio}>{author.bio}</p> : null}
          </div>
        </div>
      </section>

      {/* Posts */}
      {news.length === 0 ? (
        <p>No articles by {author.name} yet.</p>
      ) : (
        <ArticleBlock14
          title={`Articles by ${author.name}`}
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

      {/* Pager */}
      <PagePager
        currentPage={list.page}
        totalPages={Math.max(1, Math.ceil(list.total / list.perPage))}
        mode="numbers"
        className={styles.pager}
      />

      <div className={styles.back}>
        <Link href="/">← Back to Home</Link>
      </div>
    </main>
  );
}
