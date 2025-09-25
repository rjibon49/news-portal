// src/app/(dashboard)/dashboard/tag/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { slugify } from "@/lib/slugify";
import { toast } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faPenToSquare, faTrash } from "@fortawesome/free-solid-svg-icons";

type TagDTO = {
  term_taxonomy_id: number;
  term_id: number;
  name: string;
  slug: string;
  description: string;
  count: number;
};

export default function TagPage() {
  const [tags, setTags] = useState<TagDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // form
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [editingTTId, setEditingTTId] = useState<number | null>(null);

  // list helpers
  const [q, setQ] = useState("");
  const [sortAsc, setSortAsc] = useState(true);

  const effectiveSlug = useMemo(() => slugify(slug || name), [slug, name]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/r2/tags", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load tags");
      const data = (await res.json()) as TagDTO[];
      setTags(data);
    } catch (e: any) {
      setError(e.message || "Error loading tags");
      toast.error(e.message || "Error loading tags");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function beginEdit(t: TagDTO) {
    setEditingTTId(t.term_taxonomy_id);
    setName(t.name);
    setSlug(t.slug);
    setDescription(t.description || "");
  }
  function resetForm() {
    setEditingTTId(null);
    setName("");
    setSlug("");
    setDescription("");
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
        const res = await fetch(`/api/r2/tags/${editingTTId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
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
            name: name.trim(),
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
      await load();
    } catch (e: any) {
      setError(e.message || "Save failed");
      toast.error(e.message || "Save failed");
    }
  }

  async function onDelete(ttid: number) {
    if (!confirm("Delete this tag? It will be removed from any posts.")) return;
    try {
      const res = await fetch(`/api/r2/tags/${ttid}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Delete failed");
      }
      toast.success("Tag deleted.");
      if (editingTTId === ttid) resetForm();
      await load();
    } catch (e: any) {
      toast.error(e.message || "Delete failed");
    }
  }

  const filtered = useMemo(
    () =>
      (q
        ? tags.filter(
            (t) =>
              t.name.toLowerCase().includes(q.toLowerCase()) ||
              t.slug.toLowerCase().includes(q.toLowerCase())
          )
        : [...tags]
      ).sort((a, b) =>
        sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
      ),
    [q, tags, sortAsc]
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1.5rem" }}>
      {/* Left: form */}
      <div>
        <h2 style={{ marginBottom: 12 }}>{editingTTId ? "Edit Tag" : "Add New Tag"}</h2>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
          <label>
            <div>Name *</div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tag name"
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
              {editingTTId ? "Update Tag" : "Add Tag"}
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
          <h2 style={{ margin: 0, marginRight: "auto" }}>Tags</h2>
          <input
            placeholder="Search tags…"
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
                <th style={{ textAlign: "center", borderBottom: "1px solid #ddd", padding: 8, width: 120 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.term_taxonomy_id}>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{t.name}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{t.slug}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8, textAlign: "right" }}>{t.count}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8, textAlign: "center" }}>
                    <button
                      title="View"
                      onClick={() => toast.info(`${t.name}\nslug: ${t.slug}\nid: ${t.term_taxonomy_id}`)}
                      style={{ background: "transparent", border: 0, cursor: "pointer", marginRight: 8 }}
                      aria-label={`View ${t.name}`}
                    >
                      <FontAwesomeIcon icon={faEye} />
                    </button>
                    <button
                      title="Edit"
                      onClick={() => beginEdit(t)}
                      style={{ background: "transparent", border: 0, cursor: "pointer", marginRight: 8 }}
                      aria-label={`Edit ${t.name}`}
                    >
                      <FontAwesomeIcon icon={faPenToSquare} />
                    </button>
                    <button
                      title="Delete"
                      onClick={() => onDelete(t.term_taxonomy_id)}
                      style={{ background: "transparent", border: 0, cursor: "pointer", color: "crimson" }}
                      aria-label={`Delete ${t.name}`}
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={4} style={{ padding: 12, textAlign: "center", opacity: 0.75 }}>
                    No tags found.
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
