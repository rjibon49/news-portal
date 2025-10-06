// src/components/post-editor/AuthorPicker.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser, faTrash } from "@fortawesome/free-solid-svg-icons";

export type AuthorLite = {
  id: number;
  name: string;
  username: string;
  email: string | null;
  avatar?: string | null;  // URL from API (gravatar/wp avatar/etc.)
};

type Props = {
  value: AuthorLite | null;
  onChange: (a: AuthorLite | null) => void;
  placeholder?: string;
};

export default function AuthorPicker({ value, onChange, placeholder = "Search by name, username, or email" }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AuthorLite[]>([]);
  const [hi, setHi] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Debounced search
    useEffect(() => {
    if (!q.trim()) { setItems([]); setOpen(false); return; }
    const t = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/r2/users/search?q=${encodeURIComponent(q)}&limit=8`, { cache: "no-store" });
        const j = await res.json();
        setItems(j.users || []);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  // Click-outside to close
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(a: AuthorLite) {
    onChange(a);
    setQ("");
    setOpen(false);
  }

  function clear() {
    onChange(null);
    setQ("");
    setItems([]);
    setOpen(false);
  }

  // Small helper to render avatar or fallback icon
  const Avatar = ({ url, size = 24 }: { url?: string | null; size?: number }) => (
    url
      ? <img src={url} alt="" width={size} height={size} style={{ borderRadius: 6, display: "block" }} />
      : <div style={{ width: size, height: size, display: "grid", placeItems: "center", background:"#2a2f3a", borderRadius: 6 }}>
          <FontAwesomeIcon icon={faUser} />
        </div>
  );

  return (
    <div ref={wrapRef} className="author-picker" style={{ position: "relative" }}>
      {value ? (
        <div className="chip" style={{ display:"flex", gap:8, alignItems:"center", justifyContent:"space-between", padding:"6px 8px", border:"1px solid #333", borderRadius:8 }}>
          {/* ⬇️ avatar or user icon */}
          <Avatar url={value.avatar} size={20} />
          <span>{value.name}</span>
          <small className="dim">#{value.id}</small>

          {/* ⬇️ trash icon button instead of text */}
          <button
            type="button"
            className="btn-ghost"
            onClick={clear}
            aria-label="Remove author"
            title="Remove"
            style={{ marginLeft: 6 }}
          >
            <FontAwesomeIcon icon={faTrash} />
          </button>
        </div>
      ) : (
        <input
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => items.length && setOpen(true)}
          placeholder={placeholder}
        />
      )}

      {open && items.length > 0 && (
        <div
          className="dropdown"
          style={{
            position: "absolute",
            zIndex: 20,
            left: 0, right: 0, top: "calc(100% + 6px)",
            border: "1px solid #333", borderRadius: 8, background: "#111", overflow: "hidden"
          }}
        >
          {items.map((it, i) => (
            <button
              key={it.id}
              type="button"
              onClick={() => pick(it)}
              className="row"
              style={{
                width: "100%", textAlign: "left", padding: "8px 10px",
                background: hi === i ? "#191919" : "transparent",
                display:"grid", gridTemplateColumns:"24px 1fr auto", gap:8
              }}
              onMouseEnter={() => setHi(i)}
            >
              {/* ⬇️ avatar or icon in list */}
              <Avatar url={it.avatar} />

              <div>
                <div style={{ fontWeight: 600 }}>
                  {it.name} <span className="dim" style={{ fontSize:12 }}>#{it.id}</span>
                </div>
                <div className="dim" style={{ fontSize:12 }}>
                  @{it.username}{it.email ? ` • ${it.email}` : ""}
                </div>
              </div>

              <div className="dim" style={{ fontSize:12 }}>Select</div>
            </button>
          ))}
        </div>
      )}

      {loading && <div className="dim" style={{ fontSize: 12, marginTop: 6 }}>Searching…</div>}
      {!loading && open && items.length === 0 && q && (
        <div className="dim" style={{ fontSize: 12, marginTop: 6 }}>No matches</div>
      )}
    </div>
  );
}