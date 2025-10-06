// src/app/(dashboard)/dashboard/posts/page.tsx
"use client";

import { Suspense, useMemo, useState, useEffect, memo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "react-toastify";
import Pagination from "@/components/ui/Pagination";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPenToSquare,
  faTrash,
  faRotateLeft,
  faTrashCan,
  faEye,
} from "@fortawesome/free-solid-svg-icons";

/* ----------------------------- Types ----------------------------- */
type PostRow = {
  ID: number;
  post_title: string;
  post_date: string;
  post_modified: string;
  post_status: "publish" | "draft" | "pending" | "trash" | "future";
  post_author: number;
  author_name: string | null;
  categories: string | null;
  tags: string | null;
  post_name?: string; // slug
  slug?: string;
};
type ListResp = { rows: PostRow[]; total: number; page: number; perPage: number };
type StatusTab = "all" | "publish" | "draft" | "pending" | "trash";

type CategoryDTO = {
  term_taxonomy_id: number;
  term_id: number;
  name: string;
  slug: string;
  parent: number;
  count: number;
};
type MonthBucket = { ym: string; label: string; total: number };

/* ----------------------------- Utils ----------------------------- */
const fetcher = async (url: string) => {
  const r = await fetch(url, { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || "Failed to load");
  return j;
};

function fmtBDFromMySQLLocal(s: string) {
  if (!s) return "—";
  try {
    const [datePart, timePart] = s.split(" ");
    if (!datePart || !timePart) return "—";
    const [y, m, d] = datePart.split("-").map(Number);
    const [hh, mm, ss] = timePart.split(":").map(Number);
    // saved as BD local; convert to UTC by -6h
    const utcMs = Date.UTC(y, (m || 1) - 1, d || 1, (hh || 0) - 6, mm || 0, ss || 0);
    const dt = new Date(utcMs);
    return dt.toLocaleString("en-BD", {
      timeZone: "Asia/Dhaka",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return "—";
  }
}

function makeCategoryOptions(rows: CategoryDTO[]) {
  const byParent: Record<number, CategoryDTO[]> = {};
  for (const r of rows) (byParent[r.parent || 0] ||= []).push(r);
  Object.values(byParent).forEach((list) => list.sort((a, b) => a.name.localeCompare(b.name)));
  const out: { slug: string; label: string }[] = [];
  const walk = (pid: number, depth: number) => {
    for (const c of byParent[pid] || []) {
      out.push({ slug: c.slug, label: `${"— ".repeat(depth)}${c.name}` });
      walk(c.term_taxonomy_id, depth + 1);
    }
  };
  walk(0, 0);
  return out;
}

/* ============================== Page Shell ============================== */
export default function PostsListPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const DEFAULTS = {
    q: "",
    status: "all" as StatusTab,
    page: 1,
    perPage: 20,
    orderBy: "date" as "date" | "title",
    order: "desc" as "asc" | "desc",
    yearMonth: "",
    categorySlug: "",
    format: "",
  };

  const [q, setQ] = useState(sp.get("q") ?? DEFAULTS.q);
  const [status, setStatus] = useState<StatusTab>((sp.get("status") as StatusTab) ?? DEFAULTS.status);
  const [page, setPage] = useState(Number(sp.get("page") ?? DEFAULTS.page));
  const [perPage, setPerPage] = useState(Number(sp.get("perPage") ?? DEFAULTS.perPage));
  const [orderBy, setOrderBy] = useState<"date" | "title">((sp.get("orderBy") as any) ?? DEFAULTS.orderBy);
  const [order, setOrder] = useState<"asc" | "desc">((sp.get("order") as any) ?? DEFAULTS.order);
  const [yearMonth, setYearMonth] = useState(sp.get("yearMonth") ?? DEFAULTS.yearMonth);
  const [categorySlug, setCategorySlug] = useState(sp.get("categorySlug") ?? DEFAULTS.categorySlug);
  const [format, setFormat] = useState(sp.get("format") ?? DEFAULTS.format);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (q && q !== DEFAULTS.q) p.set("q", q);
    if (status !== DEFAULTS.status) p.set("status", status);
    if (page !== DEFAULTS.page) p.set("page", String(page));
    if (perPage !== DEFAULTS.perPage) p.set("perPage", String(perPage));
    if (orderBy !== DEFAULTS.orderBy) p.set("orderBy", orderBy);
    if (order !== DEFAULTS.order) p.set("order", order);
    if (yearMonth) p.set("yearMonth", yearMonth);
    if (categorySlug) p.set("categorySlug", categorySlug);
    if (format) p.set("format", format);
    return p.toString();
  }, [q, status, page, perPage, orderBy, order, yearMonth, categorySlug, format]);

  const listApiKey = useMemo(
    () => (queryString ? `/api/r2/posts?${queryString}` : `/api/r2/posts`),
    [queryString]
  );

  useEffect(() => {
    const curQs = sp.toString();
    if (queryString !== curQs) {
      router.replace(queryString ? `/dashboard/posts?${queryString}` : `/dashboard/posts`, { scroll: false });
    }
  }, [queryString, router, sp]);

  const formatOptions = [
    { key: "", label: "All formats" },
    { key: "standard", label: "Standard" },
    { key: "gallery", label: "Gallery" },
    { key: "video", label: "Video" },
  ];

  return (
    <div className="container">
      <div className="toolbar" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Posts</h2>
        <Link href="/dashboard/posts/new" className="btn btn-primary">Add New</Link>
      </div>

      <div className="toolbar" style={{ marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        {(["all", "publish", "draft", "pending", "trash"] as const).map((s) => (
          <button
            key={s}
            className={`chip ${status === s ? "active" : ""}`}
            onClick={() => { setStatus(s); setPage(1); }}
          >
            {s === "all" ? "All" : s[0].toUpperCase() + s.slice(1)}{s === "all" && " Posts"}
          </button>
        ))}
      </div>

      <Suspense
        fallback={
          <div className="toolbar" style={{ gap: 8, opacity: 0.6, marginBottom: 16 }} aria-busy="true">
            <input className="input" placeholder="Search…" disabled />
            <select className="select" disabled><option>All dates</option></select>
            <select className="select" disabled><option>All Categories</option></select>
            <select className="select" disabled><option>All formats</option></select>
            <select className="select" disabled><option>Order by Date</option></select>
            <select className="select" disabled><option>DESC</option></select>
          </div>
        }
      >
        <FiltersPanel
          q={q} setQ={(v) => { setQ(v); setPage(1); }}
          yearMonth={yearMonth} setYearMonth={(v) => { setYearMonth(v); setPage(1); }}
          categorySlug={categorySlug} setCategorySlug={(v) => { setCategorySlug(v); setPage(1); }}
          format={format} setFormat={(v) => { setFormat(v); setPage(1); }}
          orderBy={orderBy} setOrderBy={setOrderBy}
          order={order} setOrder={setOrder}
          formatOptions={formatOptions}
        />
      </Suspense>

      <Suspense fallback={<div className="card"><div className="card-body" style={{ padding: 20, textAlign: "center" }}>Loading posts...</div></div>}>
        <PostsGrid
          listKey={listApiKey}
          page={page}
          perPage={perPage}
          onPageChange={setPage}
          onPerPageChange={(n) => { setPerPage(n); setPage(1); }}
        />
      </Suspense>
    </div>
  );
}

/* ============================== Filters Panel ============================== */
function FiltersPanel(props: {
  q: string; setQ: (v: string) => void;
  yearMonth: string; setYearMonth: (v: string) => void;
  categorySlug: string; setCategorySlug: (v: string) => void;
  format: string; setFormat: (v: string) => void;
  orderBy: "date" | "title"; setOrderBy: (v: "date" | "title") => void;
  order: "asc" | "desc"; setOrder: (v: "asc" | "desc") => void;
  formatOptions: { key: string; label: string }[];
}) {
  const { data: catRows = [] } = useSWR<CategoryDTO[]>("/api/r2/categories", fetcher, {
    suspense: true, fallbackData: [],
  });
  const { data: monthsResp = [] } = useSWR<any>("/api/r2/posts/months", fetcher, {
    suspense: true, fallbackData: [],
  });

  const months: MonthBucket[] = Array.isArray(monthsResp) ? monthsResp : (monthsResp.months || []);
  const catOptions = useMemo(() => makeCategoryOptions(catRows), [catRows]);

  return (
    <div className="toolbar" style={{ gap: 8, marginBottom: 16 }}>
      <input
        className="input"
        value={props.q}
        onChange={(e) => props.setQ(e.target.value)}
        placeholder="Search title or content…"
        style={{ minWidth: 280, flex: "1 1 280px" }}
      />

      <select className="select" value={props.yearMonth} onChange={(e) => props.setYearMonth(e.target.value)} title="Filter by month" style={{ minWidth: 150 }}>
        <option value="">All dates</option>
        {months.map((m) => <option key={m.ym} value={m.ym}>{m.label} ({m.total})</option>)}
      </select>

      <select className="select" value={props.categorySlug} onChange={(e) => props.setCategorySlug(e.target.value)} title="Filter by category" style={{ minWidth: 150 }}>
        <option value="">All Categories</option>
        {catOptions.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
      </select>

      {/* ⚠️ Backend: GET /api/r2/posts → listPostsRepo(...) এ format ফিল্টার অ্যাপ্লাই করো */}
      <select className="select" value={props.format} onChange={(e) => props.setFormat(e.target.value)} title="Filter by format" style={{ minWidth: 140 }}>
        {props.formatOptions.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
      </select>

      <select className="select" value={props.orderBy} onChange={(e) => props.setOrderBy(e.target.value as "date" | "title")} style={{ minWidth: 140 }}>
        <option value="date">Order by Date</option>
        <option value="title">Order by Title</option>
      </select>
      <select className="select" value={props.order} onChange={(e) => props.setOrder(e.target.value as "asc" | "desc")} style={{ minWidth: 100 }}>
        <option value="desc">DESC</option>
        <option value="asc">ASC</option>
      </select>
    </div>
  );
}

/* ============================== Helpers (child components) ============================== */

// শুধু all-time views দেখায়
const ViewAllCell = memo(function ViewAllCell({ postId }: { postId: number }) {
  const { data } = useSWR<{ today: number; last7d: number; last30d: number; all: number }>(
    `/api/r2/posts/${postId}/view`,
    fetcher
  );
  return <span>{data?.all ?? "…"}</span>;
});

// এক রো আইটেম; এখানে Hooks ব্যবহার নিরাপদ কারণ এটি আলাদা কম্পোনেন্ট
function PostRowItem({
  row,
  onTrash,
  onRestore,
  onDelete,
}: {
  row: PostRow;
  onTrash: (id: number) => void;
  onRestore: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  // slug যদি লিস্টে না আসে, হালকা ফেচ
  const slugFromRow = row.post_name || row.slug;
  const { data: slugData } = useSWR<{ slug: string }>(
    slugFromRow ? null : `/api/r2/posts/${row.ID}`,
    async (key: string) => {
      const r = await fetch(key, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Failed");
      return { slug: j.slug || j.post_name || "" };
    }
  );
  const slug = slugFromRow || slugData?.slug || "";
  const frontHref = slug ? `/${slug}` : undefined;

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "publish": return "badge-success";
      case "draft": return "badge-secondary";
      case "pending": return "badge-warning";
      case "future": return "badge-info";
      case "trash": return "badge-danger";
      default: return "badge-secondary";
    }
  };

  return (
    <tr style={{ borderBottom: "1px solid #eee" }}>
      <td style={{ padding: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{row.post_title || "(no title)"}</div>
        <div style={{ fontSize: 12, color: "#666" }}>ID: {row.ID}</div>
      </td>
      <td style={{ padding: 12 }}>{row.author_name || "-"}</td>
      <td style={{ padding: 12 }}>{row.categories || "—"}</td>
      <td style={{ padding: 12 }}>{row.tags || "—"}</td>
      <td style={{ padding: 12 }}>
        <span className={`badge ${getStatusBadgeClass(row.post_status)}`} style={{ display: "inline-block", padding: "4px 8px", borderRadius: 4, fontSize: 12, fontWeight: 500 }}>
          {row.post_status}
        </span>
      </td>
      <td style={{ padding: 12 }}>
        <div style={{ fontSize: 14 }}><strong>Published:</strong> {fmtBDFromMySQLLocal(row.post_date)}</div>
        <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}><strong>Modified:</strong> {fmtBDFromMySQLLocal(row.post_modified)}</div>
      </td>
      {/* Views: all-time only */}
      <td style={{ padding: 12 }}>
        <ViewAllCell postId={row.ID} />
      </td>
      <td style={{ padding: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {frontHref ? (
            <a
              href={frontHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View on site"
              title="View on site"
              style={{ color: "#17a2b8", textDecoration: "none" }}
            >
              <FontAwesomeIcon icon={faEye} />
            </a>
          ) : (
            <span className="dim" title="Slug not available">—</span>
          )}

          <Link
            href={`/dashboard/posts/${row.ID}/edit`}
            aria-label="Edit"
            title="Edit"
            style={{ color: "#007bff", textDecoration: "none" }}
          >
            <FontAwesomeIcon icon={faPenToSquare} />
          </Link>

          {row.post_status === "trash" ? (
            <>
              <button
                className="btn-link"
                onClick={() => onRestore(row.ID)}
                title="Restore"
                aria-label="Restore"
                style={{ color: "#28a745", border: "none", background: "none", cursor: "pointer" }}
              >
                <FontAwesomeIcon icon={faRotateLeft} />
              </button>
              <button
                className="btn-link"
                onClick={() => onDelete(row.ID)}
                style={{ color: "#dc3545", border: "none", background: "none", cursor: "pointer" }}
                title="Delete permanently"
                aria-label="Delete permanently"
              >
                <FontAwesomeIcon icon={faTrashCan} />
              </button>
            </>
          ) : (
            <button
              className="btn-link"
              onClick={() => onTrash(row.ID)}
              style={{ color: "#dc3545", border: "none", background: "none", cursor: "pointer" }}
              title="Move to Trash"
              aria-label="Move to Trash"
            >
              <FontAwesomeIcon icon={faTrash} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

/* ============================== Posts Grid ============================== */
function PostsGrid(props: {
  listKey: string;
  page: number;
  perPage: number;
  onPageChange: (n: number) => void;
  onPerPageChange: (n: number) => void;
}) {
  const { mutate } = useSWRConfig();

  const fallback: ListResp = useMemo(
    () => ({ rows: [], total: 0, page: props.page, perPage: props.perPage }),
    [props.page, props.perPage]
  );

  const { data = fallback } = useSWR<ListResp>(props.listKey, fetcher, {
    suspense: true,
    fallbackData: fallback,
  });

  const onTrash = async (id: number) => {
    if (!confirm("Move to Trash?")) return;
    try {
      const res = await fetch(`/api/r2/posts/${id}/trash`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Failed to move to trash");
      toast.success("Moved to Trash");
      void mutate(props.listKey);
    } catch (e: any) {
      toast.error(e?.message || "Failed to move to trash");
    }
  };

  const onRestore = async (id: number) => {
    try {
      const res = await fetch(`/api/r2/posts/${id}/restore`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Failed to restore");
      toast.success("Restored");
      void mutate(props.listKey);
    } catch (e: any) {
      toast.error(e?.message || "Failed to restore");
    }
  };

  const onDelete = async (id: number) => {
    if (!confirm("Delete permanently? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/r2/posts/${id}`, { method: "DELETE" });
      if (res.status !== 204) throw new Error((await res.json().catch(() => ({})))?.error || "Failed to delete");
      toast.success("Deleted permanently");
      void mutate(props.listKey);
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete");
    }
  };

  return (
    <>
      <div className="card">
        {!data.rows.length ? (
          <div className="card-body" style={{ padding: "40px 20px", textAlign: "center" }}>
            <p style={{ margin: 0, color: "#666" }}>No posts found.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ padding: 12, textAlign: "left", borderBottom: "1px solid #ddd", fontWeight: 600 }}>Title</th>
                  <th style={{ padding: 12, textAlign: "left", borderBottom: "1px solid #ddd", fontWeight: 600 }}>Author</th>
                  <th style={{ padding: 12, textAlign: "left", borderBottom: "1px solid #ddd", fontWeight: 600 }}>Categories</th>
                  <th style={{ padding: 12, textAlign: "left", borderBottom: "1px solid #ddd", fontWeight: 600 }}>Tags</th>
                  <th style={{ padding: 12, textAlign: "left", borderBottom: "1px solid #ddd", fontWeight: 600, width: 140 }}>Status</th>
                  <th style={{ padding: 12, textAlign: "left", borderBottom: "1px solid #ddd", fontWeight: 600, width: 180 }}>Date</th>
                  <th style={{ padding: 12, textAlign: "left", borderBottom: "1px solid #ddd", fontWeight: 600, width: 100 }}>Views</th>
                  <th style={{ padding: 12, textAlign: "left", borderBottom: "1px solid #ddd", fontWeight: 600, width: 140 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <PostRowItem
                    key={row.ID}
                    row={row}
                    onTrash={onTrash}
                    onRestore={onRestore}
                    onDelete={onDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {data.total > 0 && (
        <Pagination
          total={data.total || 0}
          page={props.page}
          perPage={props.perPage}
          perPageOptions={[10, 20, 40, 80]}
          onPageChange={props.onPageChange}
          onPerPageChange={props.onPerPageChange}
        />
      )}
    </>
  );
}
