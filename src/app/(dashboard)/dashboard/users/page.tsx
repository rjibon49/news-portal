// src/app/(dashboard)/dashboard/users/page.tsx
// ------------------------------------------------------------------
// Users list with filters + pagination (SWR + Suspense).
// API: GET /api/r2/users -> { rows, total, page, perPage }.
// Row.avatar_url সোজা <img />-এ দেখাই, নাহলে আইকন।
// ------------------------------------------------------------------

"use client";

import { Suspense, useMemo, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser, faEye, faPenToSquare, faTrash } from "@fortawesome/free-solid-svg-icons";
import Pagination from "@/components/ui/Pagination";

// --- types (API-এর সাথে একই) ---
type Row = {
  id: number;
  username: string;
  name: string;
  email: string;
  role: string;
  posts: number;
  registered: string;
  avatar_url?: string;
};

type Resp = {
  rows: Row[];
  total: number;
  page: number;
  perPage: number;
};

// --- fetcher ---
const fetcher = async (key: string) => {
  const r = await fetch(key, { cache: "no-store" });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j?.error || "Failed to load users");
  }
  return (await r.json()) as Resp;
};

export default function UsersPage() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("any");
  const [orderBy, setOrderBy] =
    useState<"user_login" | "user_registered" | "ID">("user_login");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  return (
    <div className="container">
      <h2 className="mb-12">Users</h2>

      {/* toolbar */}
      <div className="toolbar">
        <input
          className="input"
          placeholder="Search username, name or email…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="select"
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
        >
          <option value="any">Role: Any</option>
          <option value="administrator">Administrator</option>
          <option value="editor">Editor</option>
          <option value="author">Author</option>
          <option value="contributor">Contributor</option>
          <option value="subscriber">Subscriber</option>
          <option value="no_role">No role</option>
        </select>
        <select
          className="select"
          value={orderBy}
          onChange={(e) => setOrderBy(e.target.value as any)}
        >
          <option value="user_login">Order by: Username</option>
          <option value="user_registered">Order by: Registered</option>
          <option value="ID">Order by: ID</option>
        </select>
        <button
          className="btn-ghost"
          onClick={() => setOrder((o) => (o === "asc" ? "desc" : "asc"))}
        >
          {order.toUpperCase()}
        </button>
        <div className="spacer" />
        <Link href="/dashboard/users/new" className="btn">
          + Add User
        </Link>
      </div>

      {/* grid */}
      <Suspense fallback={<div className="dim" style={{ padding: 12 }}>Loading users…</div>}>
        <UsersGrid
          q={q}
          role={role}
          orderBy={orderBy}
          order={order}
          page={page}
          perPage={perPage}
          onPageChange={setPage}
          onPerPageChange={(n) => {
            setPerPage(n);
            setPage(1);
          }}
        />
      </Suspense>
    </div>
  );
}

function UsersGrid(props: {
  q: string;
  role: string;
  orderBy: "user_login" | "user_registered" | "ID";
  order: "asc" | "desc";
  page: number;
  perPage: number;
  onPageChange: (n: number) => void;
  onPerPageChange: (n: number) => void;
}) {
  const { mutate } = useSWRConfig();

  // SWR key
  const key = useMemo(() => {
    const qs = new URLSearchParams({
      q: props.q,
      role: props.role,
      page: String(props.page),
      perPage: String(props.perPage),
      orderBy: props.orderBy,
      order: props.order,
    });
    return `/api/r2/users?${qs.toString()}`;
  }, [props.q, props.role, props.page, props.perPage, props.orderBy, props.order]);

  // SSR-safe fallback
  const fallbackData: Resp = useMemo(
    () => ({ rows: [], total: 0, page: props.page, perPage: props.perPage }),
    [props.page, props.perPage]
  );

  const swr = useSWR<Resp>(key, fetcher, { suspense: true, fallbackData });
  const data = swr.data ?? fallbackData;
  const rows = data.rows;

  async function onDelete(id: number) {
    if (!confirm("Delete this user? Their posts will be reassigned to author 0.")) return;
    const res = await fetch(`/api/r2/users/${id}`, { method: "DELETE" });
    if (!res.ok && res.status !== 204) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error || "Delete failed");
      return;
    }
    void mutate(key); // revalidate
  }

  return (
    <>
      <table className="table">
        <thead>
          <tr>
            <th>User</th>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th className="text-right">Posts</th>
            <th>Registered</th>
            <th className="actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div className="avatar">
                    {r.avatar_url ? (
                      <img
                        src={r.avatar_url}
                        alt={r.username}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <FontAwesomeIcon icon={faUser} />
                    )}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{r.username}</div>
                    <small className="dim">ID: {r.id}</small>
                  </div>
                </div>
              </td>
              <td>{r.name}</td>
              <td>{r.email}</td>
              <td>{r.role}</td>
              <td className="text-right">{r.posts}</td>
              <td>{r.registered}</td>
              <td>
                <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                  <Link href={`/dashboard/users/${r.id}`} title="View" className="btn-ghost">
                    <FontAwesomeIcon icon={faEye} />
                  </Link>
                  <Link href={`/dashboard/users/${r.id}/edit`} title="Edit" className="btn-ghost">
                    <FontAwesomeIcon icon={faPenToSquare} />
                  </Link>
                  <button
                    onClick={() => onDelete(r.id)}
                    title="Delete"
                    className="btn-ghost btn-danger"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center dim" style={{ padding: 16 }}>
                No users found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* ✅ Reusable Pagination */}
      <Pagination
        total={data.total}
        page={props.page}
        perPage={props.perPage}
        onPageChange={props.onPageChange}
        onPerPageChange={props.onPerPageChange}
      />
    </>
  );
}