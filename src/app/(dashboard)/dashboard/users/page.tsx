// src/app/(dashboard)/dashboard/users/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

type UserRow = {
  id: number;
  username: string;
  name: string;
  email: string;
  role: string;
  posts: number;
  registered: string;
};
type ApiResponse = {
  rows: UserRow[];
  total: number;
  page: number;
  perPage: number;
};

const ROLES = ["any", "administrator", "editor", "author", "contributor", "subscriber", "no_role"] as const;

export default function UsersPage() {
  const [data, setData] = useState<ApiResponse>({ rows: [], total: 0, page: 1, perPage: 20 });
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<typeof ROLES[number]>("any");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [orderBy, setOrderBy] = useState<"user_login" | "user_registered" | "ID">("user_login");
  const [order, setOrder] = useState<"asc" | "desc">("asc");

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        q,
        role,
        page: String(page),
        perPage: String(perPage),
        orderBy,
        order,
      });
      const res = await fetch(`/api/r2/users?${qs.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Failed to load users");
      }
      const json = (await res.json()) as ApiResponse;
      setData(json);
    } catch (e: any) {
      toast.error(e.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, role, page, perPage, orderBy, order]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(data.total / data.perPage)), [data]);

  return (
    <div className="container" style={{ display: "grid", gap: 12 }}>
      <h2 style={{ margin: "8px 0" }}>Users</h2>

      {/* Controls */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          placeholder="Search username, name or email…"
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          style={{ padding: 8, minWidth: 260 }}
        />
        <select
          value={role}
          onChange={(e) => {
            setPage(1);
            setRole(e.target.value as any);
          }}
          style={{ padding: 8 }}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              Role: {r === "any" ? "Any" : r.replace("_", " ")}
            </option>
          ))}
        </select>

        <select
          value={orderBy}
          onChange={(e) => setOrderBy(e.target.value as any)}
          style={{ padding: 8 }}
        >
          <option value="user_login">Order by: Username</option>
          <option value="user_registered">Order by: Registered</option>
          <option value="ID">Order by: ID</option>
        </select>

        <button
          onClick={() => setOrder((o) => (o === "asc" ? "desc" : "asc"))}
          style={{ padding: "6px 10px" }}
        >
          {order.toUpperCase()}
        </button>

        <span style={{ marginLeft: "auto", opacity: 0.75 }}>
          {loading ? "Loading…" : `${data.total} users`}
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Username</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Name</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Email</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Role</th>
              <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>Posts</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Registered</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((u) => (
              <tr key={u.id}>
                <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{u.username}</td>
                <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{u.name}</td>
                <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{u.email}</td>
                <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{u.role}</td>
                <td style={{ borderBottom: "1px solid #eee", padding: 8, textAlign: "right" }}>{u.posts}</td>
                <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{u.registered}</td>
              </tr>
            ))}
            {!data.rows.length && !loading && (
              <tr>
                <td colSpan={6} style={{ padding: 12, textAlign: "center", opacity: 0.7 }}>
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end" }}>
        <label>
          <span style={{ marginRight: 6 }}>Per page</span>
          <select
            value={perPage}
            onChange={(e) => {
              setPage(1);
              setPerPage(Number(e.target.value));
            }}
            style={{ padding: 6 }}
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <button onClick={() => setPage(1)} disabled={page <= 1}>«</button>
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>‹</button>
        <span>Page {page} / {totalPages}</span>
        <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>›</button>
        <button onClick={() => setPage(totalPages)} disabled={page >= totalPages}>»</button>
      </div>
    </div>
  );
}
