// src/components/tax/TagPicker.tsx

"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Suggest = { name: string; slug: string; count?: number };

export default function TagPicker({
  value,
  onChange,
  placeholder = "Type tag and press Enter…",
  label = "Tags",
}: {
  value: string[];                    // নির্বাচিত tag নামগুলো
  onChange: (next: string[]) => void; // parent এ state লিফট
  placeholder?: string;
  label?: string;
}) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sugs, setSugs] = useState<Suggest[]>([]);
  const [highlight, setHighlight] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  // ডুপ্লিকেট এড়াতে: lowercase set
  const lowerSet = useMemo(() => new Set(value.map(v => v.toLowerCase())), [value]);

  // Debounced suggest fetch
  useEffect(() => {
    let stop = false;
    const t = setTimeout(async () => {
      const q = input.trim();
      if (!q) { setSugs([]); return; }
      try {
        setLoading(true);
        const r = await fetch(`/api/r2/tags?q=${encodeURIComponent(q)}`, { cache: "no-store" });
        const j = await r.json();
        if (!stop) setSugs((j.items || []) as Suggest[]);
      } catch {
        if (!stop) setSugs([]);
      } finally {
        if (!stop) setLoading(false);
      }
    }, 180);
    return () => { stop = true; clearTimeout(t); };
  }, [input]);

  // বাইরে ক্লিক করলে dropdown বন্ধ
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("click", fn);
    return () => window.removeEventListener("click", fn);
  }, []);

  function addTag(raw: string) {
    const t = raw.trim();
    if (!t) return;
    if (lowerSet.has(t.toLowerCase())) return;
    onChange([...value, t]);
    setInput("");
    setOpen(false);
  }

  function removeTag(idx: number) {
    const next = [...value];
    next.splice(idx, 1);
    onChange(next);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
      return;
    }
    if (open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      setHighlight(h => {
        const n = sugs.length || 1;
        return e.key === "ArrowDown" ? (h + 1) % n : (h - 1 + n) % n;
      });
    }
    if (open && e.key === "Tab") setOpen(false);
  }

  return (
    <div className="card">
      <div className="card-hd">{label}</div>

      <div className="card-bd" ref={boxRef} style={{ position: "relative" }}>
        {/* input + Add button */}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="input"
            placeholder={placeholder}
            value={input}
            onChange={(e) => { setInput(e.target.value); setOpen(true); setHighlight(0); }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
          />
          <button type="button" className="btn" onClick={() => addTag(input)}>Add</button>
        </div>

        <small className="dim">Separate tags with commas</small>

        {/* suggestions dropdown */}
        {open && (loading || sugs.length > 0) && (
          <div
            className="dropdown"
            style={{
              position: "absolute",
              insetInlineStart: 0,
              insetBlockStart: "calc(100% + 6px)",
              zIndex: 30,
              minWidth: 280,
              maxHeight: 260,
              overflow: "auto",
              border: "1px solid #333",
              borderRadius: 6,
              background: "#111",
              padding: 4,
            }}
          >
            {loading ? (
              <div className="dim" style={{ padding: 8 }}>Loading…</div>
            ) : sugs.map((s, i) => (
              <button
                key={`${s.slug}-${i}`}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); addTag(s.name); }}
                className="dropdown-item"
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 10px",
                  borderRadius: 4,
                  background: i === highlight ? "rgba(255,255,255,.06)" : "transparent",
                }}
              >
                {s.name}{typeof s.count === "number" && <span className="dim"> — {s.count}</span>}
              </button>
            ))}
            {!loading && !sugs.length && (
              <div className="dim" style={{ padding: 8 }}>No suggestions</div>
            )}
          </div>
        )}

        {/* selected tags */}
        {value.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            {value.map((t, i) => (
              <span key={`${t}-${i}`} className="chip">
                {t}
                <button
                  type="button"
                  aria-label={`Remove ${t}`}
                  onClick={() => removeTag(i)}
                  className="chip-close"
                  style={{ marginInlineStart: 6 }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
