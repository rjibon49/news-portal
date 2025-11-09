// src/app/(dashboard)/dashboard/ads/slots/page.tsx
"use client";

import { useEffect, useState } from "react";

type Row = { id: number; slot_key: string; name: string; max_ads: number | null; enabled: 0 | 1; updated_at: string };

export default function SlotsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [slotKey, setSlotKey] = useState("");
  const [name, setName] = useState("");
  const [maxAds, setMaxAds] = useState<string>("");
  const [enabled, setEnabled] = useState(true);

  async function load() {
    setErr(null);
    const r = await fetch("/api/r2/ads/slots", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(j?.error || "Failed to load"); return; }
    setRows(j.rows || []);
  }
  useEffect(() => { void load(); }, []);

  async function onCreate() {
    setErr(null);
    try {
      const payload = {
        slot_key: slotKey.trim(),
        name: name.trim(),
        max_ads: maxAds.trim() ? Number(maxAds) : null,
        enabled // boolean, server will cast 1/0
      };

      const res = await fetch("/api/r2/ads/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Create failed");

      setSlotKey("");
      setName("");
      setMaxAds("");
      setEnabled(true);
      await load();
    } catch (e: any) {
      setErr(e?.message || "Unexpected error");
    }
  }

  return (
    <div className="pad">
      <h1>Ad Slots</h1>
      {err && <div className="error">{err}</div>}

      <div style={{display:"flex", gap:10, alignItems:"center", marginBottom:12}}>
        <input value={slotKey} onChange={e=>setSlotKey(e.target.value)} placeholder="slot_key (unique)" />
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Display name" />
        <input value={maxAds} onChange={e=>setMaxAds(e.target.value)} placeholder="Max ads (optional)" />
        <label style={{display:"flex",alignItems:"center",gap:6}}>
          <input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)} />
          Enabled
        </label>
        <button type="button" onClick={onCreate}>+ Create Slot</button>
      </div>

      <table className="table">
        <thead>
          <tr><th>ID</th><th>slot_key</th><th>Name</th><th>Max</th><th>Enabled</th><th>Updated</th></tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={6} className="dim">No slots.</td></tr>
          ) : rows.map(r => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{r.slot_key}</td>
              <td>{r.name}</td>
              <td>{r.max_ads ?? "-"}</td>
              <td>{r.enabled ? "Yes" : "No"}</td>
              <td>{r.updated_at}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
