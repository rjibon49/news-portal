// src/components/site/PostCard.tsx
"use client";

import Link from "next/link";
import styles from "./PostCard.module.css";
import type { PostListRow } from "@/types/post";
import { formatBanglaDate } from "@/utils/dateFormatter";

export default function PostCard({ row }: { row: PostListRow }) {
  const slug = row.slug || "";
  return (
    <article className={styles.card}>
      {/* Title -> slug link */}
      <h3 className={styles.title}>
        <Link href={`/${encodeURIComponent(slug)}`}>{row.post_title}</Link>
      </h3>

      {/* Meta */}
      <div className={styles.meta}>
        <span className={styles.date}>{formatBanglaDate(row.post_date)}</span>
        {row.author_name ? <span> • {row.author_name}</span> : null}
      </div>

      {/* Categories & Tags */}
      <div className={styles.tax}>
        {row.categories && (
          <span className={styles.cat}>🗂 {row.categories}</span>
        )}
        {row.tags && <span className={styles.tag}>🏷 {row.tags}</span>}
      </div>
    </article>
  );
}
