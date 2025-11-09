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
  faPlay,
  faArrowsRotate,
  faCircleNotch,
} from "@fortawesome/free-solid-svg-icons";
import styles from "./posts.module.css";

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

type AudioInfo = {
  status: "none" | "queued" | "ready" | "error";
  url: string | null;
  lang: string | null;
  chars: number | null;
  durationSec: number | null;
  updatedAt: string | null;
};

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
    <div className={styles.container}>
      <div className={`${styles.toolbar} ${styles.toolbarHeader}`}>
        <h2 className={styles.h2}>Posts</h2>
        <Link href="/dashboard/posts/new" className={styles.btnPrimary}>Add New</Link>
      </div>

      <div className={styles.toolbarTabs}>
        {(["all", "publish", "draft", "pending", "trash"] as const).map((s) => (
          <button
            key={s}
            className={`${styles.chip} ${status === s ? styles.chipActive : ""}`}
            onClick={() => { setStatus(s); setPage(1); }}
          >
            {s === "all" ? "All Posts" : s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <Suspense
        fallback={
          <div className={styles.toolbar} aria-busy="true">
            <input className={styles.input} placeholder="Search…" disabled />
            <select className={styles.select} disabled><option>All dates</option></select>
            <select className={styles.select} disabled><option>All Categories</option></select>
            <select className={styles.select} disabled><option>All formats</option></select>
            <select className={styles.select} disabled><option>Order by Date</option></select>
            <select className={styles.select} disabled><option>DESC</option></select>
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

      <Suspense fallback={<div className={styles.card}><div className={styles.cardBodyCenter}>Loading posts...</div></div>}>
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
    <div className={styles.toolbar}>
      <input
        className={styles.input}
        value={props.q}
        onChange={(e) => props.setQ(e.target.value)}
        placeholder="Search title or content…"
      />

      <select className={styles.select} value={props.yearMonth} onChange={(e) => props.setYearMonth(e.target.value)} title="Filter by month">
        <option value="">All dates</option>
        {months.map((m) => <option key={m.ym} value={m.ym}>{m.label} ({m.total})</option>)}
      </select>

      <select className={styles.select} value={props.categorySlug} onChange={(e) => props.setCategorySlug(e.target.value)} title="Filter by category">
        <option value="">All Categories</option>
        {catOptions.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
      </select>

      {/* Backend: apply 'format' filter in listPostsRepo(...) if not already */}
      <select className={styles.select} value={props.format} onChange={(e) => props.setFormat(e.target.value)} title="Filter by format">
        {props.formatOptions.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
      </select>

      <select className={styles.select} value={props.orderBy} onChange={(e) => props.setOrderBy(e.target.value as "date" | "title")}>
        <option value="date">Order by Date</option>
        <option value="title">Order by Title</option>
      </select>
      <select className={styles.select} value={props.order} onChange={(e) => props.setOrder(e.target.value as "asc" | "desc")}>
        <option value="desc">DESC</option>
        <option value="asc">ASC</option>
      </select>
    </div>
  );
}

/* ============================== Audio Cell ============================== */
const AudioCell = memo(function AudioCell({ postId }: { postId: number }) {
  const { mutate } = useSWRConfig();
  const { data } = useSWR<{ audio?: AudioInfo }>(`/api/r2/posts/${postId}`, fetcher);
  const audio = data?.audio;
  const [lang, setLang] = useState<string>(() => audio?.lang || "en");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (audio?.lang) setLang(audio.lang);
  }, [audio?.lang]);

  const statusBadge = (() => {
    switch (audio?.status) {
      case "ready": return styles.badgeSuccess;
      case "queued": return styles.badgeInfo;
      case "error": return styles.badgeDanger;
      default: return styles.badgeSecondary;
    }
  })();

  const trigger = async (overwrite = false) => {
    try {
      setBusy(true);
      const r = await fetch(`/api/r2/tts/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, lang, overwrite }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Failed to queue audio");
      toast.success(overwrite ? "Regeneration queued" : "Audio generation queued");
      await mutate(`/api/r2/posts/${postId}`);
    } catch (e: any) {
      toast.error(e?.message || "Audio action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.audioWrap}>
      <span className={`${styles.badge} ${statusBadge}`} title={`Audio: ${audio?.status || "none"}`}>
        {audio?.status || "none"}
        {audio?.status === "queued" && <FontAwesomeIcon icon={faCircleNotch} spin className={styles.badgeSpin} />}
      </span>

      <select
        className={styles.langSelect}
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        title="Audio language"
        disabled={busy}
      >
        <option value="en">EN</option>
        <option value="bn">BN</option>
      </select>

      {(audio?.status === "none" || audio?.status === "error") && (
        <button className={styles.btnGhost} onClick={() => trigger(false)} disabled={busy}>
          Generate
        </button>
      )}
      {(audio?.status === "ready" || audio?.status === "error") && (
        <button className={styles.btnGhost} onClick={() => trigger(true)} disabled={busy}>
          <FontAwesomeIcon icon={faArrowsRotate} className={styles.btnIcon} />
          Re-gen
        </button>
      )}
      {audio?.status === "queued" && (
        <button className={styles.btnGhost} disabled>
          <FontAwesomeIcon icon={faCircleNotch} spin className={styles.btnIcon} />
          Queued
        </button>
      )}
      {audio?.url ? (
        <a
          href={audio.url}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.playLink}
          title="Play audio"
        >
          <FontAwesomeIcon icon={faPlay} />
        </a>
      ) : (
        <span className={styles.dim}>—</span>
      )}
    </div>
  );
});

/* ============================== View count cell ============================== */
const ViewAllCell = memo(function ViewAllCell({ postId }: { postId: number }) {
  const { data } = useSWR<{ today: number; last7d: number; last30d: number; all: number }>(
    `/api/r2/posts/${postId}/view`,
    fetcher
  );
  return <span>{data?.all ?? "…"}</span>;
});

/* ============================== Row ============================== */
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
  // Always fetch post details once (gives slug + audio)
  const { data: detail } = useSWR<{ slug?: string }>(`/api/r2/posts/${row.ID}`, fetcher);
  const slug = row.post_name || row.slug || detail?.slug || "";
  const frontHref = slug ? `/${slug}` : undefined;

  const badgeClass = (() => {
    switch (row.post_status) {
      case "publish": return styles.badgeSuccess;
      case "draft": return styles.badgeSecondary;
      case "pending": return styles.badgeWarning;
      case "future": return styles.badgeInfo;
      case "trash": return styles.badgeDanger;
      default: return styles.badgeSecondary;
    }
  })();

  return (
    <tr className={styles.tr}>
      <td className={styles.tdTitle}>
        <div className={styles.title}>{row.post_title || "(no title)"}</div>
        <div className={styles.metaDim}>ID: {row.ID}</div>
      </td>
      <td className={styles.td}>{row.author_name || "-"}</td>
      <td className={styles.td}>{row.categories || "—"}</td>
      <td className={styles.td}>{row.tags || "—"}</td>
      <td className={styles.td}>
        <span className={`${styles.badge} ${badgeClass}`}>{row.post_status}</span>
      </td>
      <td className={styles.tdDate}>
        <div><strong>Published:</strong> {fmtBDFromMySQLLocal(row.post_date)}</div>
        <div className={styles.metaDim}><strong>Modified:</strong> {fmtBDFromMySQLLocal(row.post_modified)}</div>
      </td>
      <td className={styles.td}><ViewAllCell postId={row.ID} /></td>

      {/* 🔊 Audio */}
      <td className={styles.td}>
        <AudioCell postId={row.ID} />
      </td>

      {/* Actions */}
      <td className={styles.td}>
        <div className={styles.actions}>
          {frontHref ? (
            <a
              href={frontHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View on site"
              title="View on site"
              className={styles.actionLinkInfo}
            >
              <FontAwesomeIcon icon={faEye} />
            </a>
          ) : (
            <span className={styles.dim} title="Slug not available">—</span>
          )}

          <Link
            href={`/dashboard/posts/${row.ID}/edit`}
            aria-label="Edit"
            title="Edit"
            className={styles.actionLinkPrimary}
          >
            <FontAwesomeIcon icon={faPenToSquare} />
          </Link>

          {row.post_status === "trash" ? (
            <>
              <button
                className={styles.actionLinkSuccess}
                onClick={() => onRestore(row.ID)}
                title="Restore"
                aria-label="Restore"
              >
                <FontAwesomeIcon icon={faRotateLeft} />
              </button>
              <button
                className={styles.actionLinkDanger}
                onClick={() => onDelete(row.ID)}
                title="Delete permanently"
                aria-label="Delete permanently"
              >
                <FontAwesomeIcon icon={faTrashCan} />
              </button>
            </>
          ) : (
            <button
              className={styles.actionLinkDanger}
              onClick={() => onTrash(row.ID)}
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
      <div className={styles.card}>
        {!data.rows.length ? (
          <div className={styles.cardBodyCenter}>
            <p className={styles.metaDim}>No posts found.</p>
          </div>
        ) : (
          <div className={styles.tableResponsive}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Title</th>
                  <th className={styles.th}>Author</th>
                  <th className={styles.th}>Categories</th>
                  <th className={styles.th}>Tags</th>
                  <th className={styles.th} style={{ width: 140 }}>Status</th>
                  <th className={styles.th} style={{ width: 180 }}>Date</th>
                  <th className={styles.th} style={{ width: 100 }}>Views</th>
                  <th className={styles.th} style={{ width: 220 }}>Audio</th>
                  <th className={styles.th} style={{ width: 140 }}>Actions</th>
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
