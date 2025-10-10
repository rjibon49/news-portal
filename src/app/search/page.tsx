// src/app/search/page.tsx
import Link from "next/link";
import Image from "next/image";
import { absoluteUrl } from "@/utils/apiBase"; // ✅ তোমার প্রজেক্টের helper

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Author = {
  id: number;
  username: string;
  slug: string;
  name: string;
  email?: string | null;
  avatarUrl?: string | null;
};

type PostItem = {
  id: number;
  title: string;
  slug: string;
  date: string;
  excerpt: string;
  authorName: string;
  imageUrl: string | null;
};

type Resp = {
  author: Author | null;
  posts: { rows: PostItem[]; total: number; page: number; perPage: number };
};

// ✅ Server থেকে fetch করার সময় absolute URL ব্যবহার
async function fetchSearch(q: string, page = 1, perPage = 12): Promise<Resp> {
  const qs = new URLSearchParams({ q, page: String(page), perPage: String(perPage) });
  const url = await absoluteUrl(`/api/r2/search?${qs.toString()}`);
  const r = await fetch(url, { cache: "no-store", next: { revalidate: 0 } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || "Failed");
  return j as Resp;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "")?.trim();
  const page = Number(sp.page || 1) || 1;

  if (!q) {
    return (
      <main className="container" style={{ padding: "24px 0" }}>
        <h2>Search</h2>
        <p className="dim">Type a query in the search box to find articles.</p>
      </main>
    );
  }

  const data = await fetchSearch(q, page, 12);
  const { author } = data;
  const rows = data.posts.rows;
  const totalPages = Math.max(1, Math.ceil(data.posts.total / data.posts.perPage));

  return (
    <main className="container" style={{ padding: "24px 0" }}>
      <h2 style={{ marginBottom: 8 }}>Search results for “{q}”</h2>

      {/* Author highlight (if found) */}
      {author && (
        <section
          style={{
            border: "1px solid var(--border,#333)",
            borderRadius: 12,
            padding: 16,
            margin: "12px 0 20px",
            display: "grid",
            gridTemplateColumns: "64px 1fr auto",
            gap: 12,
            alignItems: "center",
            background: "var(--card,#111)",
          }}
        >
          <div style={{ width: 64, height: 64, borderRadius: 8, overflow: "hidden", background: "#222" }}>
            {author.avatarUrl ? (
              <Image
                src={author.avatarUrl}
                alt={author.name}
                width={64}
                height={64}
                unoptimized
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", opacity: 0.6 }}>👤</div>
            )}
          </div>

          <div>
            <div style={{ fontWeight: 700 }}>{author.name}</div>
            <div className="dim" style={{ fontSize: 13 }}>@{author.slug}</div>
          </div>

          <Link href={`/author/${encodeURIComponent(author.slug || String(author.id))}`} className="btn">
            View author
          </Link>
        </section>
      )}

      {/* Posts list */}
      <section style={{ display: "grid", gap: 16 }}>
        {rows.length === 0 ? (
          <p className="dim">No matching articles.</p>
        ) : (
          rows.map((p) => (
            <article
              key={p.id}
              style={{
                display: "grid",
                gridTemplateColumns: "180px 1fr",
                gap: 14,
                borderBottom: "1px solid var(--border,#333)",
                paddingBottom: 14,
              }}
            >
              <Link
                href={`/${encodeURIComponent(p.slug)}`}
                style={{
                  width: 180,
                  aspectRatio: "16/9",
                  borderRadius: 10,
                  overflow: "hidden",
                  background: "#222",
                  display: "block",
                }}
              >
                {p.imageUrl ? (
                  <Image
                    src={p.imageUrl}
                    alt={p.title}
                    width={180}
                    height={101}
                    unoptimized
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", opacity: 0.4 }}>
                    No image
                  </div>
                )}
              </Link>

              <div>
                <h3 style={{ margin: 0 }}>
                  <Link href={`/${encodeURIComponent(p.slug)}`}>{p.title}</Link>
                </h3>
                <div className="dim" style={{ fontSize: 13, marginTop: 4 }}>
                  {new Date(p.date).toLocaleString()} — {p.authorName || "Unknown"}
                </div>
                {!!p.excerpt && (
                  <p style={{ marginTop: 8, opacity: 0.85 }}>
                    {p.excerpt.length > 220 ? p.excerpt.slice(0, 220) + "…" : p.excerpt}
                  </p>
                )}
              </div>
            </article>
          ))
        )}
      </section>

      {/* Simple pager */}
      {totalPages > 1 && (
        <nav style={{ display: "flex", gap: 8, marginTop: 18 }} aria-label="Pagination">
          <Link
            className="btn-ghost"
            href={`/search?q=${encodeURIComponent(q)}&page=${Math.max(1, page - 1)}`}
            aria-disabled={page <= 1}
          >
            ← Prev
          </Link>
          <span className="dim" style={{ alignSelf: "center" }}>
            Page {page} / {totalPages}
          </span>
          <Link
            className="btn-ghost"
            href={`/search?q=${encodeURIComponent(q)}&page=${Math.min(totalPages, page + 1)}`}
            aria-disabled={page >= totalPages}
          >
            Next →
          </Link>
        </nav>
      )}
    </main>
  );
}
