// src/app/(dashboard)/dashboard/page.tsx
"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import MonthlyViewsChart, { MonthBucket } from "@/components/ui/charts/MonthlyViewsChart";
import styles from "./dashboard.module.css";

type LatestPost = { id: number; title: string; slug: string; published_at: string };

export default function DashboardHome() {
  // 1) সব Hook টপ-লেভেলে
  const { isLoading, isAuthenticated, canPublishNow } = useRequireAuth();
  const [months, setMonths] = useState<MonthBucket[]>([]);
  const [latest, setLatest] = useState<LatestPost[]>([]);
  const [busy, setBusy] = useState(true);

  // 2) ডাটা লোডিং (একবারে দুটি)
  useEffect(() => {
  let alive = true;
  (async () => {
    try {
      const [mRes, lRes] = await Promise.all([
        fetch("/api/r2/posts/months", { cache: "no-store" }),
        // ✅ সর্বশেষ ৫টা published
        fetch("/api/r2/posts?status=publish&perPage=5&orderBy=date&order=desc", { cache: "no-store" }),
      ]);

      const mJson = await mRes.json().catch(() => ({}));
      const lJson = await lRes.json().catch(() => ({}));

      if (!alive) return;

      const m = Array.isArray(mJson) ? mJson : (mJson.months || []);
      setMonths(m);

      const rows = Array.isArray(lJson?.rows) ? lJson.rows : [];
      setLatest(
        rows.map((r: any) => ({
          id: r.ID,
          title: r.post_title,
          slug: r.post_name || r.slug,   // ✅ slug
          published_at: r.post_date,
        }))
      );
    } finally {
      if (alive) setBusy(false);
    }
  })();
  return () => { alive = false; };
}, []);

  // 3) UI state ব্যাখ্যা
  const showLoading = isLoading || busy;
  const ok = isAuthenticated;

  // 4) UI
  return (
    <div className={styles.container}>
      {/* Quick Actions + Activity/Latest */}
      <div className={styles.grid2}>
        <div className="card">
          <div className="card-hd">Quick Links</div>
          <div className="card-bd" style={{ display: "grid", gap: 8 }}>
            <Link href="/dashboard/posts/new" className="btn">+ New Post</Link>
            <Link href="/dashboard/categories" className="btn-ghost">Manage Categories</Link>
            <Link href="/dashboard/users" className="btn-ghost">Manage Users</Link>
          </div>
        </div>

        <div className="card">
          <div className="card-hd">Recently Published</div>
          <div className="card-bd">
            {showLoading ? (
              <div className={styles.skeletonList}>
                <div className={styles.skeleton} />
                <div className={styles.skeleton} />
                <div className={styles.skeleton} />
              </div>
            ) : latest.length ? (
              <ul className={styles.latestList}>
                {latest.map(p => (
                  <li key={p.id}>
                    <a
                      href={`/${encodeURIComponent(p.slug)}`}   // ✅ /(site)/[slug]
                      target="_blank" rel="noopener noreferrer"
                    >
                      {p.title || "(no title)"}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <small className="dim">No recent posts.</small>
            )}
          </div>
        </div>
      </div>

      {/* Stats row: Chart + Tips */}
      <div className={styles.grid2}>
        <div className="card">
          <div className="card-hd">Monthly Views</div>
          <div className="card-bd">
            {showLoading ? (
              <div className={styles.chartSkeleton} />
            ) : (
              <MonthlyViewsChart data={months} />
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-hd">Tips</div>
          <div className="card-bd">
            <p className="dim">
              Use the left sidebar to navigate. Toggle the top-right theme.  
              {canPublishNow ? " You can publish immediately." : " Your posts go to review."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}