// src/app/(dashboard)/dashboard/category/page.tsx
"use client";

import {
  Suspense,
  useMemo,
  useState,
  useTransition,
  useEffect,
} from "react";
import useSWR, { mutate as globalMutate } from "swr";
import Link from "next/link";
import { slugify } from "@/lib/slugify";
import { toast } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faPenToSquare, faTrash } from "@fortawesome/free-solid-svg-icons";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import Pagination from "@/components/ui/Pagination"; // ✅ pagination import

// -------------------------- Types --------------------------
type CategoryDTO = {
  term_taxonomy_id: number;
  term_id: number;
  name: string;
  slug: string;
  description: string;
  parent: number;
  count: number;
  _depth?: number;
};

// -------------------------- Fetcher ------------------------
const fetcher = (url: string) =>
  fetch(url, { cache: "no-store" }).then(async (r) => {
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(j?.error || "Failed to load categories");
    }
    return r.json();
  });

// -------------------------- Hook (SWR + suspense) ----------
function useCategories() {
  const { data } = useSWR<CategoryDTO[]>("/api/r2/categories", fetcher, { suspense: true });
  return data!;
}

// -------------------------- Helpers ------------------------
function buildFlatTree(rows: CategoryDTO[]): CategoryDTO[] {
  const byParent = new Map<number, CategoryDTO[]>();
  const getP = (p?: number | null) => (p && p > 0 ? p : 0);
  rows.forEach((r) => {
    const pid = getP(r.parent);
    const arr = byParent.get(pid) ?? [];
    arr.push(r);
    byParent.set(pid, arr);
  });
  for (const [k, list] of byParent) {
    list.sort((a, b) => a.name.localeCompare(b.name));
    byParent.set(k, list);
  }

  const out: CategoryDTO[] = [];
  const visited = new Set<number>();
  function visit(parentId: number, depth: number) {
    const children = byParent.get(parentId) ?? [];
    for (const c of children) {
      if (visited.has(c.term_taxonomy_id)) continue;
      visited.add(c.term_taxonomy_id);
      out.push({ ...c, _depth: depth });
      visit(c.term_taxonomy_id, depth + 1);
    }
  }
  visit(0, 0);
  rows.forEach((r) => {
    if (!visited.has(r.term_taxonomy_id)) {
      out.push({ ...r, _depth: 0 });
      visit(r.term_taxonomy_id, 1);
    }
  });
  return out;
}

// ==========================================================
// Page
// ==========================================================
export default function CategoryPage() {
  const { isLoading, isAuthenticated } = useRequireAuth();
  if (isLoading) return <div className="container">Loading…</div>;
  if (!isAuthenticated) return null;

  return (
    <div className="container" style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1.5rem" }}>
      <Suspense
        fallback={
          <div>
            <h2 className="mb-12">Add New Category</h2>
            <div className="card" aria-busy="true" style={{ opacity: 0.6, padding: 16 }}>
              Loading form…
            </div>
          </div>
        }
      >
        <CategoryFormPanel />
      </Suspense>

      <Suspense
        fallback={
          <div>
            <div className="toolbar">
              <h2 className="m-0" style={{ marginRight: "auto" }}>
                Categories
              </h2>
              <input className="input" placeholder="Search…" disabled />
            </div>
            <div className="card" aria-busy="true" style={{ opacity: 0.6, padding: 16 }}>
              Loading categories…
            </div>
          </div>
        }
      >
        <CategoryTablePanel />
      </Suspense>
    </div>
  );
}

// ==========================================================
// Left panel: Form
// ==========================================================
function CategoryFormPanel() {
  const cats = useCategories();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [parent, setParent] = useState<number | "">("");
  const [editingTTId, setEditingTTId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const effectiveSlug = useMemo(() => slugify(slug || name), [slug, name]);

  function beginEdit(cat: CategoryDTO) {
    setEditingTTId(cat.term_taxonomy_id);
    setName(cat.name);
    setSlug(cat.slug);
    setDescription(cat.description || "");
    setParent(cat.parent || "");
  }

  useEffect(() => {
    const onEdit = (ev: Event) => {
      const cat = (ev as CustomEvent<CategoryDTO>).detail;
      if (!cat) return;
      beginEdit(cat);
    };
    window.addEventListener("category:edit", onEdit as EventListener);
    return () => window.removeEventListener("category:edit", onEdit as EventListener);
  }, []);

  function resetForm() {
    setEditingTTId(null);
    setName("");
    setSlug("");
    setDescription("");
    setParent("");
    setError(null);
  }

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
          const res = await fetch(`/api/r2/categories/${editingTTId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: nm,
              slug: effectiveSlug,
              description: description.trim(),
              parent: parent === "" ? null : Number(parent),
            }),
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j?.error || "Failed to update category");
          }
          toast.success("Category updated.");
        } else {
          const res = await fetch("/api/r2/categories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: nm,
              slug: effectiveSlug,
              description: description.trim(),
              parent: parent === "" ? null : Number(parent),
            }),
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j?.error || "Failed to create category");
          }
          toast.success("Category created.");
        }

        resetForm();
        await globalMutate("/api/r2/categories");
      } catch (e: any) {
        const msg = e?.message || "Save failed";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  return (
    <div>
      <h2 className="mb-12">{editingTTId ? "Edit Category" : "Add New Category"}</h2>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <label>
          <span className="label">Name *</span>
          <input
            className="input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Category name"
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
          <span className="label">Parent (optional)</span>
          <select
            className="select"
            value={parent}
            onChange={(e) => setParent(e.target.value === "" ? "" : Number(e.target.value))}
            disabled={isPending}
          >
            <option value="">None</option>
            {cats.map((c) => (
              <option key={c.term_taxonomy_id} value={c.term_taxonomy_id}>
                {c.name}
              </option>
            ))}
          </select>
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
            {editingTTId ? "Update Category" : "Add Category"}
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
// Right panel: Table (+ ✅ Pagination)
// ==========================================================
function CategoryTablePanel() {
  const cats = useCategories();
  const [q, setQ] = useState("");
  const [isPending, startTransition] = useTransition();

  // 🔢 pagination state
  const [page, setPage] = useState(1);       // 1-based
  const [perPage, setPerPage] = useState(20);

  const flat = useMemo(() => buildFlatTree(cats), [cats]);
  const filtered = useMemo(() => {
    if (!q) return flat;
    const qq = q.toLowerCase();
    return flat.filter((c) => c.name.toLowerCase().includes(qq) || c.slug.toLowerCase().includes(qq));
  }, [q, flat]);

  // 🔁 search বদলালে পেজ রিসেট
  useEffect(() => {
    setPage(1);
  }, [q]);

  // বর্তমান পেজের slice
  const paged = useMemo(() => {
    const start = (page - 1) * perPage;
    const end = start + perPage;
    return filtered.slice(start, end);
  }, [filtered, page, perPage]);

  function beginEdit(cat: CategoryDTO) {
    window.dispatchEvent(new CustomEvent<CategoryDTO>("category:edit", { detail: cat }));
  }

  async function onDelete(ttid: number) {
    if (!confirm("Delete this category? Child categories will be moved to root.")) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/r2/categories/${ttid}`, { method: "DELETE" });
        if (!res.ok && res.status !== 204) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || "Delete failed");
        }
        toast.success("Category deleted.");
        await globalMutate("/api/r2/categories");
      } catch (e: any) {
        toast.error(e?.message || "Delete failed");
      }
    });
  }

  return (
    <div>
      <div className="toolbar">
        <h2 className="m-0" style={{ marginRight: "auto" }}>
          Categories
        </h2>
        <input
          className="input"
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          disabled={isPending}
        />
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
          {paged.map((c) => {
            const depth = c._depth ?? 0;
            const dashPrefix = depth > 0 ? `${"- ".repeat(depth)}` : "";
            return (
              <tr key={c.term_taxonomy_id}>
                <td>
                  <span style={{ paddingLeft: depth * 16 }}>
                    {dashPrefix}
                    {c.name}
                  </span>
                </td>
                <td>{c.slug}</td>
                <td className="text-right">
                  <Link
                    href={`/dashboard/posts?categorySlug=${encodeURIComponent(c.slug)}`}
                    className="link"
                    title="View posts in this category"
                  >
                    {c.count}
                  </Link>
                </td>
                <td>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                    <Link
                      href={`/category/${encodeURIComponent(c.slug)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost"
                      title="Open on website"
                      aria-label={`Open ${c.name} on website`}
                    >
                      <FontAwesomeIcon icon={faEye} />
                    </Link>
                    <button
                      title="Edit"
                      onClick={() => beginEdit(c)}
                      className="btn-ghost"
                      aria-label={`Edit ${c.name}`}
                      disabled={isPending}
                    >
                      <FontAwesomeIcon icon={faPenToSquare} />
                    </button>
                    <button
                      title="Delete"
                      onClick={() => onDelete(c.term_taxonomy_id)}
                      className="btn-ghost btn-danger"
                      aria-label={`Delete ${c.name}`}
                      disabled={isPending}
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
          {!paged.length && (
            <tr>
              <td colSpan={4} className="text-center dim" style={{ padding: 12 }}>
                No categories found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* ✅ Pagination */}
      <Pagination
        total={filtered.length}
        page={page}
        perPage={perPage}
        onPageChange={setPage}
        onPerPageChange={(n) => { setPerPage(n); setPage(1); }}
      />
    </div>
  );
}
