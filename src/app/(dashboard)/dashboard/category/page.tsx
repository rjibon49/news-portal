// src/app/(dashboard)/dashboard/category/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { slugify } from "@/lib/slugify";
import { toast } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faPenToSquare, faTrash } from "@fortawesome/free-solid-svg-icons";

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

export default function CategoryPage() {
  const [cats, setCats] = useState<CategoryDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // form state
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [parent, setParent] = useState<number | "">("");
  const [editingTTId, setEditingTTId] = useState<number | null>(null);

  // list helpers
  const [q, setQ] = useState("");
  const [sortAsc, setSortAsc] = useState(true);

  const effectiveSlug = useMemo(() => slugify(slug || name), [slug, name]);

  function normalizeTree(rows: CategoryDTO[]): CategoryDTO[] {
    const byTT: Record<number, CategoryDTO> = {};
    rows.forEach(r => (byTT[r.term_taxonomy_id] = { ...r, _depth: 0 }));

    rows.forEach((r) => {
      if (r.parent && byTT[r.parent]) {
        byTT[r.term_taxonomy_id]._depth = (byTT[r.parent]._depth ?? 0) + 1;
      }
    });

    const ordered = [...rows].sort((a, b) =>
      sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    );
    return ordered.map(r => byTT[r.term_taxonomy_id]);
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/r2/categories", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load categories");
      const data = (await res.json()) as CategoryDTO[];
      setCats(data);
    } catch (e: any) {
      setError(e.message || "Error loading categories");
      toast.error(e.message || "Error loading categories");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function beginEdit(cat: CategoryDTO) {
    setEditingTTId(cat.term_taxonomy_id);
    setName(cat.name);
    setSlug(cat.slug);
    setDescription(cat.description || "");
    setParent(cat.parent || "");
  }

  function resetForm() {
    setEditingTTId(null);
    setName("");
    setSlug("");
    setDescription("");
    setParent("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      const msg = "Name is required.";
      setError(msg);
      toast.error(msg);
      return;
    }

    try {
      if (editingTTId) {
        // UPDATE
        const res = await fetch(`/api/r2/categories/${editingTTId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
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
        // CREATE
        const res = await fetch("/api/r2/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
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
      await load();
    } catch (e: any) {
      setError(e.message || "Save failed");
      toast.error(e.message || "Save failed");
    }
  }

  async function onDelete(ttid: number) {
    if (!confirm("Delete this category? Child categories will be moved to root.")) return;
    try {
      const res = await fetch(`/api/r2/categories/${ttid}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Delete failed");
      }
      toast.success("Category deleted.");
      if (editingTTId === ttid) resetForm();
      await load();
    } catch (e: any) {
      toast.error(e.message || "Delete failed");
    }
  }

  const flat = useMemo(() => normalizeTree(cats), [cats, sortAsc]);
  const filtered = useMemo(
    () => (q ? flat.filter(
      c => c.name.toLowerCase().includes(q.toLowerCase()) || c.slug.toLowerCase().includes(q.toLowerCase())
    ) : flat),
    [q, flat]
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1.5rem" }}>
      {/* Left: form (Create / Update) */}
      <div>
        <h2 style={{ marginBottom: 12 }}>{editingTTId ? "Edit Category" : "Add New Category"}</h2>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
          <label>
            <div>Name *</div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Category name"
              required
              style={{ width: "100%", padding: 8 }}
            />
          </label>

          <label>
            <div>Slug (optional)</div>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="auto-generated from name"
              style={{ width: "100%", padding: 8 }}
            />
            <small style={{ opacity: 0.7 }}>Preview: <code>{effectiveSlug}</code></small>
          </label>

          <label>
            <div>Parent (optional)</div>
            <select
              value={parent}
              onChange={(e) => setParent(e.target.value === "" ? "" : Number(e.target.value))}
              style={{ width: "100%", padding: 8 }}
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
            <div>Description</div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              style={{ width: "100%", padding: 8 }}
            />
          </label>

          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" style={{ padding: "8px 14px" }}>
              {editingTTId ? "Update Category" : "Add Category"}
            </button>
            {editingTTId && (
              <button type="button" onClick={resetForm} style={{ padding: "8px 14px" }}>
                Cancel
              </button>
            )}
          </div>

          {error && <div style={{ color: "crimson" }}>{error}</div>}
        </form>
      </div>

      {/* Right: table */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <h2 style={{ margin: 0, marginRight: "auto" }}>Categories</h2>
          <input
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ padding: 8, minWidth: 220 }}
          />
          <button onClick={() => setSortAsc((v) => !v)} style={{ padding: "6px 10px" }}>
            Sort: {sortAsc ? "A→Z" : "Z→A"}
          </button>
        </div>

        {loading ? (
          <div>Loading…</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Name</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Slug</th>
                <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>Count</th>
                <th style={{ textAlign: "center", borderBottom: "1px solid #ddd", padding: 8, width: 120 }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.term_taxonomy_id}>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    <span style={{ paddingLeft: (c._depth ?? 0) * 16 }}>{c.name}</span>
                  </td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{c.slug}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8, textAlign: "right" }}>{c.count}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8, textAlign: "center" }}>
                    <button
                      title="View"
                      onClick={() => toast.info(`${c.name}\nslug: ${c.slug}\nid: ${c.term_taxonomy_id}`)}
                      style={{ background: "transparent", border: 0, cursor: "pointer", marginRight: 8 }}
                      aria-label={`View ${c.name}`}
                    >
                      <FontAwesomeIcon icon={faEye} />
                    </button>
                    <button
                      title="Edit"
                      onClick={() => beginEdit(c)}
                      style={{ background: "transparent", border: 0, cursor: "pointer", marginRight: 8 }}
                      aria-label={`Edit ${c.name}`}
                    >
                      <FontAwesomeIcon icon={faPenToSquare} />
                    </button>
                    <button
                      title="Delete"
                      onClick={() => onDelete(c.term_taxonomy_id)}
                      style={{ background: "transparent", border: 0, cursor: "pointer", color: "crimson" }}
                      aria-label={`Delete ${c.name}`}
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={4} style={{ padding: 12, textAlign: "center", opacity: 0.75 }}>
                    No categories found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
