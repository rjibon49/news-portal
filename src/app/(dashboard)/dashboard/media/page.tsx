// src/app/(dashboard)/dashboard/media/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash, faCopy, faFloppyDisk } from "@fortawesome/free-solid-svg-icons";
import Pagination from "@/components/ui/Pagination";

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
  // -------- list state --------
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [type, setType] = useState<"all" | "image" | "video" | "audio" | "other">("all");
  const [yearMonth, setYearMonth] = useState<string | "">("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(40);
  const [total, setTotal] = useState(0);

  // -------- selection + edit form --------
  const [sel, setSel] = useState<MediaItem | null>(null);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [description, setDescription] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);

  // -------- load list from API (filters + pagination aware) --------
  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        q,
        type,
        page: String(page),
        perPage: String(perPage),
      });
      if (yearMonth) qs.set("yearMonth", yearMonth);

      const res = await fetch(`/api/r2/media?${qs.toString()}`, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed to load media");

      const data = j as ListResp;

      // ✅ FIX: Safely check if `data.rows` is an array before setting state to prevent crashes.
      if (Array.isArray(data?.rows)) {
        setItems(data.rows);
        setTotal(data.total || 0);
        // Set a default selection if nothing is selected yet
        if (data.rows.length && !sel) {
          setSel(data.rows[0]);
        }
      } else {
        // Handle cases where the API might return unexpected data
        console.error("API returned unexpected data structure:", j);
        toast.error("Received invalid data from the server.");
        setItems([]); // Fallback to an empty array
        setTotal(0);
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to load media");
      setItems([]); // Also clear items on error
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  // -------- reload when filters / pagination change --------
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, type, yearMonth, page, perPage]);

  // -------- keep side form in sync with selection --------
  useEffect(() => {
    if (sel) {
      setTitle(sel.post_title || "");
      setCaption(sel.post_excerpt || "");
      setDescription(sel.post_content || "");
    } else {
      setTitle("");
      setCaption("");
      setDescription("");
    }
  }, [sel]);

  // -------- upload handler --------
  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch("/api/r2/upload/local", { method: "POST", body: fd });
      const u = await up.json();
      if (!up.ok) throw new Error(u?.error || "Upload failed");

      const created = await fetch("/api/r2/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: u.url,
          title: file.name.replace(/\.[^.]+$/, ""),
          mimeType: file.type || undefined,
        }),
      });
      const cj = await created.json().catch(() => ({}));
      if (!created.ok) throw new Error(cj?.error || "Failed to register attachment");

      toast.success("Uploaded");
      setPage(1);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // -------- save meta --------
  async function saveMeta() {
    if (!sel) return;
    try {
      const res = await fetch(`/api/r2/media/${sel.ID}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, caption, description }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Save failed");
      toast.success("Saved");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    }
  }

  // -------- delete --------
  async function onDelete() {
    if (!sel) return;
    if (!confirm("Delete this file permanently?")) return;
    try {
      const res = await fetch(`/api/r2/media/${sel.ID}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 204) throw new Error(j?.error || "Delete failed");
      toast.success("Deleted");
      setSel(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  }

  return (
    <div className="container" style={{ display: "grid", gridTemplateColumns: "5fr 1fr", gap: 16 }}>
      {/* Left: toolbar + grid */}
      <div>
        <div className="toolbar" style={{ gap: 8 }}>
          <input
            className="input"
            placeholder="Search media…"
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
          />
          <select
            className="select"
            value={type}
            onChange={(e) => {
              setPage(1);
              setType(e.target.value as typeof type);
            }}
          >
            <option value="all">All media items</option>
            <option value="image">Images</option>
            <option value="video">Videos</option>
            <option value="audio">Audio</option>
            <option value="other">Other</option>
          </select>
          <input
            className="input"
            type="month"
            value={yearMonth}
            onChange={(e) => {
              setPage(1);
              setYearMonth(e.target.value);
            }}
            title="Filter by month"
          />
          <button
            className="btn-ghost"
            onClick={async () => {
              const res = await fetch("/api/r2/media/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
              });
              const j = await res.json();
              if (!res.ok) return toast.error(j?.error || "Import failed");
              toast.success(`Imported: ${j.inserted} (scanned ${j.scanned})`);
              setPage(1);
              await load();
            }}
          >
            Re-index uploads
          </button>
          <label style={{ marginLeft: "auto" }}>
            <input ref={fileRef} type="file" hidden onChange={onUpload} />
            <button onClick={() => fileRef.current?.click()} className="btn-ghost">
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
                  border: sel?.ID === m.ID ? "2px solid var(--brand)" : "1px solid var(--border)",
                  padding: 0,
                  cursor: "pointer",
                  background: "transparent",
                }}
                title={m.post_title}
              >
                {m.post_mime_type.startsWith("image/") ? (
                  <img
                    src={m.guid}
                    alt={m.post_title}
                    style={{ width: "100%", height: 120, objectFit: "cover" }}
                  />
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

        <Pagination
          total={total}
          page={page}
          perPage={perPage}
          perPageOptions={[20, 40, 80, 120]}
          onPageChange={setPage}
          onPerPageChange={(n) => {
            setPerPage(n);
            setPage(1);
          }}
        />
      </div>

      {/* Right: details panel */}
      <aside style={{ borderLeft: "1px solid var(--border)", paddingLeft: 12 }}>
        {sel ? (
          <div style={{ display: "grid", gap: 10 }}>
            <div>
              {sel.post_mime_type.startsWith("image/") && (
                <img src={sel.guid} alt={sel.post_title} style={{ maxWidth: "100%", borderRadius: 6 }} />
              )}
            </div>
            <div className="dim" style={{ fontSize: 12 }}>
              <div>File type: {sel.post_mime_type}</div>
              <div>Uploaded: {new Date(sel.post_date).toLocaleString()}</div>
              <div>By: {sel.author_name || sel.post_author}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <button
                  onClick={() =>
                    navigator.clipboard
                      .writeText(new URL(sel.guid, location.origin).toString())
                      .then(() => toast.info("URL copied"))
                  }
                  title="Copy URL"
                  className="btn-ghost"
                >
                  <FontAwesomeIcon icon={faCopy} /> Copy URL
                </button>
                <button onClick={onDelete} title="Delete" className="btn-ghost btn-danger">
                  <FontAwesomeIcon icon={faTrash} /> Delete
                </button>
              </div>
            </div>
            <label>
              <span className="label">Title</span>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label>
              <span className="label">Caption</span>
              <textarea
                className="textarea"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={2}
              />
            </label>
            <label>
              <span className="label">Description</span>
              <textarea
                className="textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </label>
            <button onClick={saveMeta} className="btn">
              <FontAwesomeIcon icon={faFloppyDisk} /> Save
            </button>
          </div>
        ) : (
          <div className="dim">Select a media item to view details.</div>
        )}
      </aside>
    </div>
  );
}