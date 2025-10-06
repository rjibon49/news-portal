// src/app/(dashboard)/dashboard/tags/page.tsx

"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import useSWR, { mutate as globalMutate } from "swr";
import Link from "next/link";
import { slugify } from "@/lib/slugify";
import { toast } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faPenToSquare, faTrash } from "@fortawesome/free-solid-svg-icons";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import Pagination from "@/components/ui/Pagination"; // ✅ reusable pagination

// ---------------- Types ----------------
type TagDTO = {
  term_taxonomy_id: number;
  term_id: number;
  name: string;
  slug: string;
  description: string;
  count: number;
};

// ---------------- SWR fetcher ----------------
const fetcher = (url: string) =>
  fetch(url, { cache: "no-store" }).then(async (r) => {
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.error || "Failed to load tags");
    return j as TagDTO[]; // API returns TagDTO[]
  });

function useTags() {
  const { data } = useSWR<TagDTO[]>("/api/r2/tags", fetcher, { suspense: true });
  return data!;
}

// ==========================================================
// Page shell with auth guard + suspense boundaries
// ==========================================================
export default function TagPage() {
  const { isLoading, isAuthenticated } = useRequireAuth();
  if (isLoading) return <div className="container">Loading…</div>;
  if (!isAuthenticated) return null;

  return (
    <div
      className="container"
      style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1.5rem" }}
    >
      <Suspense
        fallback={
          <div>
            <h2 className="mb-12">Add New Tag</h2>
            <div className="card" aria-busy="true" style={{ opacity: 0.6, padding: 16 }}>
              Loading form…
            </div>
          </div>
        }
      >
        <TagFormPanel />
      </Suspense>

      <Suspense
        fallback={
          <div>
            <div className="toolbar">
              <h2 className="m-0" style={{ marginRight: "auto" }}>Tags</h2>
              <input className="input" placeholder="Search tags…" disabled />
            </div>
            <div className="card" aria-busy="true" style={{ opacity: 0.6, padding: 16 }}>
              Loading tags…
            </div>
          </div>
        }
      >
        <TagTablePanel />
      </Suspense>
    </div>
  );
}

// ==========================================================
// Left panel: Create / Edit form
// ==========================================================
function TagFormPanel() {
  const tags = useTags();
  const [isPending, startTransition] = useTransition();

  // form state
  const [editingTTId, setEditingTTId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const effectiveSlug = useMemo(() => slugify(slug || name), [slug, name]);

  function resetForm() {
    setEditingTTId(null);
    setName("");
    setSlug("");
    setDescription("");
    setError(null);
  }

  function beginEdit(t: TagDTO) {
    setEditingTTId(t.term_taxonomy_id);
    setName(t.name);
    setSlug(t.slug);
    setDescription(t.description || "");
  }

  // 🔔 listen to "tag:edit" events from table
  useEffect(() => {
    const onEdit = (ev: Event) => {
      const tag = (ev as CustomEvent<TagDTO>).detail;
      if (tag) beginEdit(tag);
    };
    window.addEventListener("tag:edit", onEdit as EventListener);
    return () => window.removeEventListener("tag:edit", onEdit as EventListener);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const nm = name.trim();
    if (!nm) {
      const msg = "Name is required.";
      setError(msg);
      toast.error(msg);
      return;
    }

    startTransition(async () => {
      try {
        if (editingTTId) {
          const res = await fetch(`/api/r2/tags/${editingTTId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: nm,
              slug: effectiveSlug,
              description: description.trim(),
            }),
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j?.error || "Failed to update tag");
          }
          toast.success("Tag updated.");
        } else {
          const res = await fetch("/api/r2/tags", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: nm,
              slug: effectiveSlug,
              description: description.trim(),
            }),
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j?.error || "Failed to create tag");
          }
          toast.success("Tag created.");
        }

        resetForm();
        await globalMutate("/api/r2/tags");
      } catch (e: any) {
        const msg = e?.message || "Save failed";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  return (
    <div>
      <h2 className="mb-12">{editingTTId ? "Edit Tag" : "Add New Tag"}</h2>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <label>
          <span className="label">Name *</span>
          <input
            className="input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tag name"
            required
            disabled={isPending}
          />
        </label>

        <label>
          <span className="label">Slug (optional)</span>
          <input
            className="input"
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="auto-generated from name"
            disabled={isPending}
          />
          <small className="dim">
            Preview: <code>{effectiveSlug}</code>
          </small>
        </label>

        <label>
          <span className="label">Description</span>
          <textarea
            className="textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            disabled={isPending}
          />
        </label>

        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" className="btn" disabled={isPending}>
            {editingTTId ? "Update Tag" : "Add Tag"}
          </button>
          {editingTTId && (
            <button type="button" onClick={resetForm} className="btn-ghost" disabled={isPending}>
              Cancel
            </button>
          )}
        </div>

        {error && <div style={{ color: "crimson" }}>{error}</div>}
      </form>
    </div>
  );
}

// ==========================================================
// Right panel: List + actions (+ ✅ pagination)
// ==========================================================
function TagTablePanel() {
  const tags = useTags();
  const [q, setQ] = useState("");
  const [sortAsc, setSortAsc] = useState(true);
  const [isPending, startTransition] = useTransition();

  // 🔢 pagination state
  const [page, setPage] = useState(1);       // 1-based
  const [perPage, setPerPage] = useState(20);

  // filter + sort (pure) — pagination থেকে আলাদা রাখা হয়েছে
  const filtered = useMemo(() => {
    const base = Array.isArray(tags) ? tags : [];
    const list = q
      ? base.filter(
          (t) =>
            t.name.toLowerCase().includes(q.toLowerCase()) ||
            t.slug.toLowerCase().includes(q.toLowerCase())
        )
      : base;
    return [...list].sort((a, b) =>
      sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    );
  }, [tags, q, sortAsc]);

  // 🧹 search/sort বদলালে প্রথম পেজে ফেরত
  useEffect(() => {
    setPage(1);
  }, [q, sortAsc]);

  // বর্তমান পেজের slice
  const paged = useMemo(() => {
    const start = (page - 1) * perPage;
    const end = start + perPage;
    return filtered.slice(start, end);
  }, [filtered, page, perPage]);

  function beginEdit(tag: TagDTO) {
    window.dispatchEvent(new CustomEvent<TagDTO>("tag:edit", { detail: tag }));
  }

  async function onDelete(ttid: number) {
    if (!confirm("Delete this tag? It will be removed from any posts.")) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/r2/tags/${ttid}`, { method: "DELETE" });
        if (!res.ok && res.status !== 204) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || "Delete failed");
        }
        toast.success("Tag deleted.");
        await globalMutate("/api/r2/tags");
      } catch (e: any) {
        toast.error(e?.message || "Delete failed");
      }
    });
  }

  return (
    <div>
      <div className="toolbar">
        <h2 className="m-0" style={{ marginRight: "auto" }}>Tags</h2>
        <input
          className="input"
          placeholder="Search tags…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          disabled={isPending}
        />
        <button className="btn-ghost" onClick={() => setSortAsc((v) => !v)} disabled={isPending}>
          Sort: {sortAsc ? "A→Z" : "Z→A"}
        </button>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Slug</th>
            <th className="text-right">Count</th>
            <th className="actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {paged.map((t) => (
            <tr key={t.term_taxonomy_id}>
              <td>{t.name}</td>
              <td>{t.slug}</td>
              <td className="text-right">{t.count}</td>
              <td>
                <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                  <Link
                    href={`/tags/${encodeURIComponent(t.slug)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ghost"
                    title="Open on website"
                    aria-label={`Open ${t.name} on website`}
                  >
                    <FontAwesomeIcon icon={faEye} />
                  </Link>
                  <button
                    title="Edit"
                    onClick={() => beginEdit(t)}
                    className="btn-ghost"
                    aria-label={`Edit ${t.name}`}
                    disabled={isPending}
                  >
                    <FontAwesomeIcon icon={faPenToSquare} />
                  </button>
                  <button
                    title="Delete"
                    onClick={() => onDelete(t.term_taxonomy_id)}
                    className="btn-ghost btn-danger"
                    aria-label={`Delete ${t.name}`}
                    disabled={isPending}
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {!paged.length && (
            <tr>
              <td colSpan={4} className="text-center dim" style={{ padding: 12 }}>
                No tags found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* ✅ Pagination (client-side) */}
      <Pagination
        total={filtered.length}            // মোট ফিল্টারড রেকর্ড
        page={page}
        perPage={perPage}
        onPageChange={setPage}
        onPerPageChange={(n) => { setPerPage(n); setPage(1); }}
      />
    </div>
  );
}
