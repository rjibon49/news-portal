// src/components/media/MediaPicker.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";

type MediaItem = {
  ID: number;
  guid: string;
  post_title: string;
  post_mime_type: string;
  post_date: string;
};

export type MediaPickerProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (item: MediaItem) => void;
  imagesOnly?: boolean;
};

export default function MediaPicker({
  open,
  onClose,
  onSelect,
  imagesOnly = true,
}: MediaPickerProps) {
  const [tab, setTab] = useState<"upload" | "library">("library");
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(40);
  const [total, setTotal] = useState(0);
  const [sel, setSel] = useState<MediaItem | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const type = imagesOnly ? "image" : "all";
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / perPage)), [total, perPage]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function load() {
    if (!open) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        q,
        type,
        page: String(page),
        perPage: String(perPage),
        order: "desc",
      });
      const res = await fetch(`/api/r2/media?${qs.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Failed to load media");
      }
      const json = await res.json();
      
      // ✅ FIX: Safely check if `json.rows` is an array before setting state.
      if (Array.isArray(json?.rows)) {
        setItems(json.rows);
        setTotal(json.total || 0);
        setSel(json.rows.length ? json.rows[0] : null);
      } else {
        console.error("MediaPicker API returned unexpected data:", json);
        toast.error("Received invalid data from server.");
        setItems([]); // Fallback to avoid crash
        setTotal(0);
        setSel(null);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to load media");
      setItems([]); // Also clear items on error
      setTotal(0);
      setSel(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "library") void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab, q, page, perPage, imagesOnly]);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const fd = new FormData();
      fd.append("file", f);
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
          title: f.name.replace(/\.[^.]+$/, ""),
          mimeType: f.type || "image/webp",
        }),
      });
      if (!created.ok) {
        const j = await created.json().catch(() => ({}));
        throw new Error(j?.error || "Failed to register attachment");
      }
      toast.success("Uploaded");
      setTab("library");
      setPage(1);
      // No need to call load() again, useEffect will trigger it.
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.6)",
        zIndex: 2147483000,
        display: "grid",
        placeItems: "center",
        padding: 20,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "min(1200px, 96vw)",
          height: "min(86vh, 820px)",
          background: "#111",
          borderRadius: 8,
          border: "1px solid #333",
          display: "grid",
          gridTemplateRows: "48px 1fr 56px",
          color: "white",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", padding: "0 14px", borderBottom: "1px solid #222" }}>
          <strong style={{ flex: 1 }}>Choose Image</strong>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", overflow: "hidden" }}>
          {/* left: upload/library */}
          <div style={{ padding: 12, borderRight: "1px solid #222", display: 'flex', flexDirection: 'column' }}>
            {/* tabs */}
            <div style={{ display: "flex", gap: 10, marginBottom: 10, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setTab("upload")}
                style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: "6px 10px", borderBottom: tab === "upload" ? "2px solid dodgerblue" : "2px solid transparent" }}
              >
                Upload files
              </button>
              <button
                type="button"
                onClick={() => setTab("library")}
                style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: "6px 10px", borderBottom: tab === "library" ? "2px solid dodgerblue" : "2px solid transparent" }}
              >
                Media Library
              </button>
            </div>

            {tab === "upload" ? (
              <div
                style={{
                  flex: 1,
                  border: "2px dashed #444",
                  display: "grid",
                  placeItems: "center",
                  borderRadius: 8,
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <input ref={fileRef} type="file" accept={imagesOnly ? "image/*" : undefined} hidden onChange={onUpload} />
                  <p>Drag & drop to upload or</p>
                  <button type="button" onClick={() => fileRef.current?.click()} style={{ padding: "8px 12px", cursor: 'pointer' }}>
                    Select Files
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {/* toolbar */}
                <div style={{ display: "flex", gap: 8, paddingBottom: 10, flexShrink: 0 }}>
                  <input
                    placeholder="Search media…"
                    value={q}
                    onChange={(e) => {
                      setQ(e.target.value);
                      setPage(1);
                    }}
                    style={{ padding: 8, flex: 1, background: '#222', border: '1px solid #444', color: 'white', borderRadius: 4 }}
                  />
                  <select
                    value={perPage}
                    onChange={(e) => {
                      setPerPage(Number(e.target.value));
                      setPage(1);
                    }}
                    style={{ padding: 6, background: '#222', border: '1px solid #444', color: 'white', borderRadius: 4 }}
                  >
                    {[20, 40, 80, 120].map((n) => (
                      <option key={n} value={n}>
                        {n}/page
                      </option>
                    ))}
                  </select>
                </div>

                {/* grid */}
                {loading ? (
                  <div style={{ padding: 20 }}>Loading…</div>
                ) : (
                  <div
                    style={{
                      flex: 1,
                      overflowY: "auto",
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                      gap: 10,
                      paddingRight: 6,
                    }}
                  >
                    {items.map((m) => (
                      <button
                        type="button"
                        key={m.ID}
                        onClick={() => setSel(m)}
                        style={{
                          border: sel?.ID === m.ID ? "2px solid dodgerblue" : "1px solid #444",
                          padding: 0,
                          background: "transparent",
                          cursor: "pointer",
                          height: 120,
                          overflow: "hidden",
                          borderRadius: 6,
                        }}
                        title={m.post_title}
                      >
                        {m.post_mime_type?.startsWith("image/") ? (
                          <img src={m.guid} alt={m.post_title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <div style={{ height: "100%", display: "grid", placeItems: "center" }}>
                            <code>{m.post_mime_type}</code>
                          </div>
                        )}
                      </button>
                    ))}
                    {!items.length && <div style={{ padding: 20, opacity: 0.7, gridColumn: '1 / -1' }}>No media found.</div>}
                  </div>
                )}

                {/* pager */}
                <div style={{ display: "flex", justifyContent: "center", alignItems: 'center', gap: 8, paddingTop: 8, flexShrink: 0 }}>
                  <button type="button" onClick={() => setPage(1)} disabled={page <= 1}>«</button>
                  <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>‹</button>
                  <span style={{ opacity: 0.8 }}>
                    Page {page} / {totalPages}
                  </span>
                  <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>›</button>
                  <button type="button" onClick={() => setPage(totalPages)} disabled={page >= totalPages}>»</button>
                </div>
              </div>
            )}
          </div>

          {/* right: details */}
          <div style={{ padding: 12, overflowY: 'auto' }}>
            {sel ? (
              <div style={{ display: "grid", gap: 10 }}>
                <div
                  style={{
                    width: "100%",
                    aspectRatio: "1/1",
                    border: "1px solid #333",
                    borderRadius: 6,
                    overflow: "hidden",
                    background: "#000",
                  }}
                >
                  {sel.post_mime_type?.startsWith("image/") ? (
                    <img src={sel.guid} alt={sel.post_title} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  ) : (
                    <div style={{ height: "100%", display: "grid", placeItems: "center" }}>
                      <code>{sel.post_mime_type}</code>
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 12, opacity: 0.8, display: 'grid', gap: 4 }}>
                  <strong>{sel.post_title || "(untitled)"}</strong>
                  <span>{new Date(sel.post_date).toLocaleString()}</span>
                  <span style={{ textTransform: 'uppercase' }}>{sel.post_mime_type}</span>
                  <div style={{ wordBreak: "break-all", opacity: 0.7 }}>{sel.guid}</div>
                </div>
              </div>
            ) : (
              <div style={{ opacity: 0.7 }}>Select an item to view details.</div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 8,
            padding: "0 14px",
            borderTop: "1px solid #222",
          }}
        >
          <button type="button" onClick={onClose} style={{ padding: "8px 14px", cursor: 'pointer' }}>Cancel</button>
          <button
            type="button"
            onClick={() => sel && onSelect(sel)}
            disabled={!sel}
            style={{ padding: "8px 14px", background: "dodgerblue", color: "white", borderRadius: 6, border: 'none', cursor: 'pointer' }}
          >
            Select
          </button>
        </div>
      </div>
    </div>
  );
}