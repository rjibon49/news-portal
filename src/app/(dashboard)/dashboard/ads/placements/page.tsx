// src/app/(dashboard)/dashboard/ads/placements/page.tsx

"use client";

import { useEffect, useState } from "react";

type Slot = { id: number; slot_key: string; name: string };
type Creative = { id: number; name: string; type: "html"|"image" };
type Placement = {
  id: number;
  slot_id: number;
  creative_id: number;
  weight: number;
  is_active: 0 | 1;
  active_from?: string | null;
  active_to?: string | null;
  created_at?: string;
  updated_at?: string;
  slot?: Slot;
  creative?: Creative;
};

type Resp<T> = T & { error?: string };

// Date input => ISO for API (needed for Zod datetime)
function toISO(dt: string | null | undefined) {
  if (!dt) return null;
  try { return new Date(dt).toISOString(); }
  catch { return null; }
}

async function jfetch<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, cache: "no-store" });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error || "Request failed");
  return j as T;
}

export default function AdsPlacementsPage() {
  const [rows, setRows] = useState<Placement[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [form, setForm] = useState<Partial<Placement>>({
    is_active: 1, weight: 1,
  });
  const [editing, setEditing] = useState<Placement | null>(null);

  const load = async () => {
    setLoading(true); setErr(null);
    try {
      const ps = await jfetch<Resp<{ rows: Placement[] }>>("/api/r2/ads/placements");
      const ss = await jfetch<Resp<{ rows: Slot[] }>>("/api/r2/ads/slots");
      const cs = await jfetch<Resp<{ rows: Creative[] }>>("/api/r2/ads/creatives");
      setRows(ps.rows); setSlots(ss.rows); setCreatives(cs.rows);
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const payload: any = {
        slot_id: Number(form.slot_id),
        creative_id: Number(form.creative_id),
        weight: Number(form.weight || 1),
        is_active: form.is_active ? 1 : 0,
        active_from: toISO(form.active_from),
        active_to: toISO(form.active_to),
      };
      if (!payload.slot_id || !payload.creative_id) throw new Error("Select slot & creative");
      await jfetch("/api/r2/ads/placements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setForm({ is_active: 1, weight: 1 });
      await load();
    } catch (e: any) {
      setErr(e?.message || "Create failed");
    }
  }

  async function onSave(row: Placement) {
    setErr(null);
    try {
      const payload: any = {
        slot_id: Number(row.slot_id),
        creative_id: Number(row.creative_id),
        weight: Number(row.weight || 1),
        is_active: row.is_active ? 1 : 0,
        active_from: toISO(row.active_from),
        active_to: toISO(row.active_to),
      };
      await jfetch(`/api/r2/ads/placements/${row.id}`, {
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
    if (!confirm("Delete this placement?")) return;
    setErr(null);
    try {
      await jfetch(`/api/r2/ads/placements/${id}`, { method: "DELETE" });
      await load();
    } catch (e: any) {
      setErr(e?.message || "Delete failed");
    }
  }

  return (
    <div className="container" style={{ padding: 16 }}>
      <h2>Ad Placements</h2>
      {err && <div className="dim" style={{ color: "#ff6b6b", marginTop: 8 }}>{err}</div>}

      {/* Create */}
      <form onSubmit={onCreate} style={{ marginTop: 16, display: "grid", gap: 8 }}>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <select
            className="select"
            value={form.slot_id ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, slot_id: Number(e.target.value) }))}
          >
            <option value="">Select slot…</option>
            {slots.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.slot_key})</option>
            ))}
          </select>

          <select
            className="select"
            value={form.creative_id ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, creative_id: Number(e.target.value) }))}
          >
            <option value="">Select creative…</option>
            {creatives.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
            ))}
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
        </div>

        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(2, minmax(160px, 1fr))" }}>
          <input
            className="input"
            type="datetime-local"
            value={form.active_from || ""}
            onChange={(e) => setForm((f) => ({ ...f, active_from: e.target.value || null }))}
          />
          <input
            className="input"
            type="datetime-local"
            value={form.active_to || ""}
            onChange={(e) => setForm((f) => ({ ...f, active_to: e.target.value || null }))}
          />
        </div>

        <div><button className="btn" type="submit">+ Create Placement</button></div>
      </form>

      {/* Table */}
      <div style={{ marginTop: 16 }}>
        {loading ? (
          <div className="dim">Loading…</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th><th>Slot</th><th>Creative</th><th>Weight</th><th>Active</th><th>Updated</th>
                <th className="actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const slot = slots.find((s) => s.id === r.slot_id);
                const cr = creatives.find((c) => c.id === r.creative_id);
                return (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>
                      {editing?.id === r.id ? (
                        <select
                          className="select"
                          value={editing.slot_id}
                          onChange={(e) => setEditing({ ...editing, slot_id: Number(e.target.value) })}
                        >
                          {slots.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.slot_key})</option>)}
                        </select>
                      ) : slot ? `${slot.name} (${slot.slot_key})` : r.slot_id}
                    </td>
                    <td>
                      {editing?.id === r.id ? (
                        <select
                          className="select"
                          value={editing.creative_id}
                          onChange={(e) => setEditing({ ...editing, creative_id: Number(e.target.value) })}
                        >
                          {creatives.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}
                        </select>
                      ) : cr ? `${cr.name} (${cr.type})` : r.creative_id}
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
                    <td>{r.updated_at?.replace("T"," ").slice(0,19) ?? "—"}</td>
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
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="text-center dim" style={{ padding: 16 }}>No placements.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}