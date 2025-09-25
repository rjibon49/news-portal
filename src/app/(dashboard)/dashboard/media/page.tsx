// src/app/(dashboard)/dashboard/media/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash, faCopy, faFloppyDisk } from "@fortawesome/free-solid-svg-icons";

type MediaItem = {
  ID: number;
  guid: string;
  post_title: string;
  post_excerpt: string;
  post_content: string;
  post_mime_type: string;
  post_date: string;
  post_author: number;
  author_name?: string;
};

type ListResp = {
  rows: MediaItem[];
  total: number;
  page: number;
  perPage: number;
};

export default function MediaLibraryPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [type, setType] = useState<"all"|"image"|"video"|"audio"|"other">("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(40);
  const [total, setTotal] = useState(0);
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / perPage)), [total, perPage]);

  // selected (details panel)
  const [sel, setSel] = useState<MediaItem | null>(null);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [description, setDescription] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        q, type, page: String(page), perPage: String(perPage),
      });
      const res = await fetch(`/api/r2/media?${qs.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Failed to load media");
      }
      const json = (await res.json()) as ListResp;
      setItems(json.rows);
      setTotal(json.total);
      if (json.rows.length && !sel) setSel(json.rows[0]);
    } catch (e: any) {
      toast.error(e.message || "Failed to load media");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [q, type, page, perPage]);

  useEffect(() => {
    if (sel) {
      setTitle(sel.post_title || "");
      setCaption(sel.post_excerpt || "");
      setDescription(sel.post_content || "");
    } else {
      setTitle(""); setCaption(""); setDescription("");
    }
  }, [sel]);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch("/api/r2/upload/local", { method: "POST", body: fd });
      if (!up.ok) {
        const j = await up.json().catch(() => ({}));
        throw new Error(j?.error || "Upload failed");
      }
      const { url } = await up.json();

      const created = await fetch("/api/r2/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          title: file.name.replace(/\.[^.]+$/, ""),
          mimeType: file.type || undefined,
        }),
      });
      if (!created.ok) {
        const j = await created.json().catch(() => ({}));
        throw new Error(j?.error || "Failed to register attachment");
      }
      toast.success("Uploaded");
      setPage(1);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function saveMeta() {
    if (!sel) return;
    try {
      const res = await fetch(`/api/r2/media/${sel.ID}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, caption, description }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Save failed");
      }
      toast.success("Saved");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    }
  }

  async function onDelete() {
    if (!sel) return;
    if (!confirm("Delete this file permanently?")) return;
    try {
      const res = await fetch(`/api/r2/media/${sel.ID}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Delete failed");
      }
      toast.success("Deleted");
      setSel(null);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Delete failed");
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
      {/* Left: toolbar + grid */}
      <div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
          <input
            placeholder="Search media…"
            value={q}
            onChange={(e) => { setPage(1); setQ(e.target.value); }}
            style={{ padding: 8, minWidth: 260 }}
          />
          <select value={type} onChange={(e) => { setPage(1); setType(e.target.value as any); }} style={{ padding: 8 }}>
            <option value="all">All media items</option>
            <option value="image">Images</option>
            <option value="video">Videos</option>
            <option value="audio">Audio</option>
            <option value="other">Other</option>
          </select>

          <label style={{ marginLeft: "auto" }}>
            <input ref={fileRef} type="file" hidden onChange={onUpload} />
            <button onClick={() => fileRef.current?.click()} style={{ padding: "8px 12px" }}>
              Add Media File
            </button>
          </label>
        </div>

        {loading ? (
          <div>Loading…</div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
              gap: 10,
            }}
          >
            {items.map((m) => (
              <button
                key={m.ID}
                onClick={() => setSel(m)}
                style={{
                  border: sel?.ID === m.ID ? "2px solid dodgerblue" : "1px solid #444",
                  padding: 0, cursor: "pointer", background: "transparent",
                }}
                title={m.post_title}
              >
                {/* thumb */}
                {m.post_mime_type.startsWith("image/") ? (
                  <img src={m.guid} alt={m.post_title} style={{ width: "100%", height: 120, objectFit: "cover" }} />
                ) : (
                  <div style={{ height: 120, display: "grid", placeItems: "center" }}>
                    <code>{m.post_mime_type}</code>
                  </div>
                )}
              </button>
            ))}
            {!items.length && <div>No media found.</div>}
          </div>
        )}

        {/* pagination */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end", marginTop: 12 }}>
          <label>
            <span style={{ marginRight: 6 }}>Per page</span>
            <select value={perPage} onChange={(e) => { setPage(1); setPerPage(Number(e.target.value)); }} style={{ padding: 6 }}>
              {[20, 40, 80, 120].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <button onClick={() => setPage(1)} disabled={page <= 1}>«</button>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>‹</button>
          <span>Page {page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>›</button>
          <button onClick={() => setPage(totalPages)} disabled={page >= totalPages}>»</button>
        </div>
      </div>

      {/* Right: details panel */}
      <aside style={{ borderLeft: "1px solid #333", paddingLeft: 12 }}>
        {sel ? (
          <div style={{ display: "grid", gap: 10 }}>
            <div>
              {sel.post_mime_type.startsWith("image/") && (
                <img src={sel.guid} alt={sel.post_title} style={{ maxWidth: "100%", borderRadius: 6 }} />
              )}
            </div>

            <div style={{ fontSize: 12, opacity: 0.8 }}>
              <div>File type: {sel.post_mime_type}</div>
              <div>Uploaded: {sel.post_date}</div>
              <div>By: {sel.author_name || sel.post_author}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <button
                  onClick={() => navigator.clipboard.writeText(new URL(sel.guid, location.origin).toString()).then(() => toast.info("URL copied"))}
                  title="Copy URL"
                >
                  <FontAwesomeIcon icon={faCopy} /> Copy URL
                </button>
                <button onClick={onDelete} title="Delete" style={{ color: "crimson" }}>
                  <FontAwesomeIcon icon={faTrash} /> Delete
                </button>
              </div>
            </div>

            <label>
              <div>Title</div>
              <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", padding: 8 }} />
            </label>
            <label>
              <div>Caption</div>
              <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={2} style={{ width: "100%", padding: 8 }} />
            </label>
            <label>
              <div>Description</div>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} style={{ width: "100%", padding: 8 }} />
            </label>
            <button onClick={saveMeta} style={{ padding: "8px 12px" }}>
              <FontAwesomeIcon icon={faFloppyDisk} /> Save
            </button>
          </div>
        ) : (
          <div style={{ opacity: 0.7 }}>Select a media item to view details.</div>
        )}
      </aside>
    </div>
  );
}
