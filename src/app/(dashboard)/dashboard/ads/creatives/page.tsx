// src/app/(dashboard)/dashboard/ads/creatives/page.tsx
"use client";

import { useEffect, useState } from "react";

type CreativeType = "html" | "image";

type Creative = {
  id: number;
  name: string;
  type: CreativeType;
  target_blank: 0 | 1;
  weight: number;
  is_active: 0 | 1;
  html?: string | null;
  image_url?: string | null;
  click_url?: string | null;
  active_from?: string | null;
  active_to?: string | null;
  created_at?: string;
  updated_at?: string;
};

type Resp<T> = T & { error?: string };

async function jfetch<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, cache: "no-store" });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error || "Request failed");
  return j as T;
}

// Helper: local date string ("YYYY-MM-DDTHH:mm") -> ISO string ("YYYY-MM-DDTHH:mm:ss.sssZ")
function toISO(dt: string | null | undefined) {
  if (!dt) return null;
  // On Chrome/React, datetime-local is in "YYYY-MM-DDTHH:mm"
  // Pass into Date() then toISOString to make valid
  try {
    return new Date(dt).toISOString();
  } catch {
    return null;
  }
}

export default function AdsCreativesPage() {
  const [rows, setRows] = useState<Creative[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [form, setForm] = useState<Partial<Creative>>({
    type: "image",
    target_blank: 1,
    weight: 1,
    is_active: 1,
  });
  const [editing, setEditing] = useState<Creative | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await jfetch<Resp<{ rows: Creative[] }>>("/api/r2/ads/creatives");
      setRows(data.rows);
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const payload: any = {
        name: String(form.name || "").trim(),
        type: form.type || "image",
        target_blank: form.target_blank ? 1 : 0,
        weight: Number(form.weight || 1),
        is_active: form.is_active ? 1 : 0,
        html: form.type === "html" ? (form.html ?? "") : null,
        image_url: form.type === "image" ? (form.image_url ?? "") : null,
        click_url: form.click_url ?? "",
        // The critical lines:
        active_from: toISO(form.active_from),
        active_to: toISO(form.active_to),
      };
      if (!payload.name) throw new Error("Name required");

      await jfetch("/api/r2/ads/creatives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setForm({ type: "image", target_blank: 1, weight: 1, is_active: 1 });
      await load();
    } catch (e: any) {
      setErr(e?.message || "Create failed");
    }
  }

  async function onSave(row: Creative) {
    setErr(null);
    try {
      const payload: any = {
        name: row.name,
        type: row.type,
        target_blank: row.target_blank ? 1 : 0,
        weight: Number(row.weight || 1),
        is_active: row.is_active ? 1 : 0,
        html: row.type === "html" ? (row.html ?? "") : null,
        image_url: row.type === "image" ? (row.image_url ?? "") : null,
        click_url: row.click_url ?? "",
        // The critical lines:
        active_from: toISO(row.active_from),
        active_to: toISO(row.active_to),
      };
      await jfetch(`/api/r2/ads/creatives/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setEditing(null);
      await load();
    } catch (e: any) {
      setErr(e?.message || "Update failed");
    }
  }

  async function onDelete(id: number) {
    if (!confirm("Delete this creative?")) return;
    setErr(null);
    try {
      await jfetch(`/api/r2/ads/creatives/${id}`, { method: "DELETE" });
      await load();
    } catch (e: any) {
      setErr(e?.message || "Delete failed");
    }
  }

  return (
    <div className="container" style={{ padding: 16 }}>
      <h2>Ad Creatives</h2>
      {err && <div className="dim" style={{ color: "#ff6b6b", marginTop: 8 }}>{err}</div>}

      {/* Create */}
      <form onSubmit={onCreate} style={{ marginTop: 16, display: "grid", gap: 8 }}>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <input
            className="input"
            placeholder="Name"
            value={form.name || ""}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <select
            className="select"
            value={form.type || "image"}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as CreativeType }))}
          >
            <option value="image">image</option>
            <option value="html">html</option>
          </select>
          <input
            className="input"
            type="number"
            placeholder="Weight"
            value={form.weight ?? 1}
            onChange={(e) => setForm((f) => ({ ...f, weight: Number(e.target.value || 1) }))}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={!!form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked ? 1 : 0 }))}
            />
            Active
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={!!form.target_blank}
              onChange={(e) => setForm((f) => ({ ...f, target_blank: e.target.checked ? 1 : 0 }))}
            />
            Open in new tab
          </label>
        </div>

        {form.type === "image" ? (
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "2fr 1fr" }}>
            <input
              className="input"
              placeholder="Image URL"
              value={form.image_url || ""}
              onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
            />
            <input
              className="input"
              placeholder="Click URL"
              value={form.click_url || ""}
              onChange={(e) => setForm((f) => ({ ...f, click_url: e.target.value }))}
            />
          </div>
        ) : (
          <textarea
            className="input"
            placeholder="<div>HTML snippet…</div>"
            rows={4}
            value={form.html || ""}
            onChange={(e) => setForm((f) => ({ ...f, html: e.target.value }))}
          />
        )}

        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(2, minmax(160px, 1fr))" }}>
          <input
            className="input"
            type="datetime-local"
            value={form.active_from ? form.active_from.slice(0, 16) : ""}
            onChange={(e) => setForm((f) => ({ ...f, active_from: e.target.value || null }))}
          />
          <input
            className="input"
            type="datetime-local"
            value={form.active_to ? form.active_to.slice(0, 16) : ""}
            onChange={(e) => setForm((f) => ({ ...f, active_to: e.target.value || null }))}
          />
        </div>

        <div>
          <button className="btn" type="submit">+ Create Creative</button>
        </div>
      </form>

      {/* Table */}
      <div style={{ marginTop: 16 }}>
        {loading ? (
          <div className="dim">Loading…</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th><th>Name</th><th>Type</th><th>Weight</th><th>Active</th><th>Updated</th>
                <th className="actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>
                    {editing?.id === r.id ? (
                      <input className="input" value={editing.name}
                        onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                    ) : r.name}
                  </td>
                  <td>
                    {editing?.id === r.id ? (
                      <select
                        className="select"
                        value={editing.type}
                        onChange={(e) => setEditing({ ...editing, type: e.target.value as CreativeType })}
                      >
                        <option value="image">image</option>
                        <option value="html">html</option>
                      </select>
                    ) : r.type}
                  </td>
                  <td style={{ width: 90 }}>
                    {editing?.id === r.id ? (
                      <input className="input" type="number" value={editing.weight}
                        onChange={(e) => setEditing({ ...editing, weight: Number(e.target.value || 1) })} />
                    ) : r.weight}
                  </td>
                  <td style={{ width: 90 }}>
                    {editing?.id === r.id ? (
                      <input type="checkbox" checked={!!editing.is_active}
                        onChange={(e) => setEditing({ ...editing, is_active: e.target.checked ? 1 : 0 })} />
                    ) : r.is_active ? "Yes" : "No"}
                  </td>
                  <td>{r.updated_at?.replace("T", " ").slice(0, 19) ?? "—"}</td>
                  <td>
                    {editing?.id === r.id ? (
                      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                        <button className="btn" onClick={() => onSave(editing)}>Save</button>
                        <button className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                        <button className="btn-ghost" onClick={() => setEditing(r)}>Edit</button>
                        <button className="btn-ghost btn-danger" onClick={() => onDelete(r.id)}>Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="text-center dim" style={{ padding: 16 }}>No creatives.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
