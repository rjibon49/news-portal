// src/app/(dashboard)/dashboard/category/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { slugify } from "@/lib/slugify";
import { toast } from "react-toastify";

type CategoryDTO = {
  term_taxonomy_id: number;
  term_id: number;
  name: string;
  slug: string;
  description: string;
  parent: number;
  count: number;
  // optional helper for rendering tree
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

  // list helpers
  const [q, setQ] = useState(""); // search
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [sortAsc, setSortAsc] = useState(true);

  const effectiveSlug = useMemo(() => slugify(slug || name), [slug, name]);

  function normalizeTree(rows: CategoryDTO[]): CategoryDTO[] {
    // quick flat->tree->flat to mimic WP indent (based on parent term_taxonomy_id)
    const byTT: Record<number, CategoryDTO> = {};
    rows.forEach(r => (byTT[r.term_taxonomy_id] = { ...r, _depth: 0 }));

    const roots: CategoryDTO[] = [];
    rows.forEach((r) => {
      if (!r.parent || !byTT[r.parent]) {
        roots.push(byTT[r.term_taxonomy_id]);
      } else {
        // child
        byTT[r.term_taxonomy_id]._depth = (byTT[r.parent]._depth ?? 0) + 1;
      }
    });

    // simple order by name (asc/desc)
    const ordered = [...rows].sort((a, b) =>
      sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    );

    // return ordered with computed depth
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
      // reset + reload
      setName("");
      setSlug("");
      setDescription("");
      setParent("");
      await load();
      toast.success("Category created successfully.");
    } catch (e: any) {
      setError(e.message || "Failed to create category");
      toast.error(e.message || "Failed to create category");
    }
  }

  const flat = useMemo(() => normalizeTree(cats), [cats, sortAsc]);
  const filtered = useMemo(
    () =>
      q
        ? flat.filter(
            (c) =>
              c.name.toLowerCase().includes(q.toLowerCase()) ||
              c.slug.toLowerCase().includes(q.toLowerCase())
          )
        : flat,
    [q, flat]
  );

  function toggleAll(checked: boolean) {
    const next: Record<number, boolean> = {};
    if (checked) filtered.forEach((c) => (next[c.term_taxonomy_id] = true));
    setSelected(next);
  }
  function toggleOne(id: number, checked: boolean) {
    setSelected((s) => ({ ...s, [id]: checked }));
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1.5rem" }}>
      {/* Left: form */}
      <div>
        <h2 style={{ marginBottom: 12 }}>Add New Category</h2>
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

          <div>
            <button type="submit" style={{ padding: "8px 14px" }}>Add Category</button>
          </div>

          {error && <div style={{ color: "crimson" }}>{error}</div>}
        </form>
      </div>

      {/* Right: table */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <h2 style={{ margin: 0, marginRight: "auto" }}>Categories</h2>
          <input
            placeholder="Search categories…"
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
                <th style={{ borderBottom: "1px solid #ddd", padding: 8, width: 36 }}>
                  <input
                    type="checkbox"
                    onChange={(e) => toggleAll(e.currentTarget.checked)}
                    checked={
                      filtered.length > 0 &&
                      filtered.every((c) => selected[c.term_taxonomy_id])
                    }
                    aria-label="Select all"
                  />
                </th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Name</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Slug</th>
                <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>Count</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.term_taxonomy_id}>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    <input
                      type="checkbox"
                      checked={!!selected[c.term_taxonomy_id]}
                      onChange={(e) => toggleOne(c.term_taxonomy_id, e.currentTarget.checked)}
                    />
                  </td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    <span style={{ paddingLeft: (c._depth ?? 0) * 16 }}>{c.name}</span>
                  </td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{c.slug}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8, textAlign: "right" }}>{c.count}</td>
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
