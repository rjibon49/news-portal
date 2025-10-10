//src/components/ui/Pagination/Pagination.tsx

"use client";

import React, { useEffect, useMemo, useRef } from "react";
import styles from "./Pagination.module.css";

type Labels = { prev?: string; next?: string; more?: string };
type Variant = "classic" | "pill" | "minimal" | "ghost";

/** NEW: JNews-like modes */
export type PaginationMode = "none" | "next-prev" | "load-more" | "infinite" | "numbers";

// ⬅ add near the top of the file
const BN = ["০","১","২","৩","৪","৫","৬","৭","৮","৯"];
const bn = (v: number | string) => String(v).replace(/\d/g, d => BN[+d]);

type Props = {
  /** Show/hide container. Keep true for modes except 'none'. */
  visible?: boolean;

  /** Mode selector (JNews parity). Default: 'numbers' (your original UI) */
  mode?: PaginationMode;

  /** Paging model (used by next/prev & numbers) */
  currentPage: number;              // 1-based
  totalPages: number;
  onPageChange: (page: number) => void;

  /** Numeric window (only for 'numbers') */
  windowSize?: number;

  /** Load-more / Infinite */
  onLoadMore?: () => void;
  loading?: boolean;
  autoLoadOffset?: number;

  /** Labels */
  labels?: Labels;

  /** (Visual skin) — kept for backward compatibility */
  variant?: Variant;
  size?: "sm" | "md" | "lg";

  /** Hide numeric block (legacy). You won’t need this if you use mode */
  hideNumbers?: boolean;

  className?: string;
};

export default function Pagination({
  visible = false,
  mode = "numbers", // default: your original numbered pagination
  currentPage,
  totalPages,
  onPageChange,
  windowSize = 5,

  onLoadMore,
  loading = false,
  autoLoadOffset = 160,

  labels = { prev: "পূর্ববর্তী", next: "পরবর্তী", more: "আরও" },

  variant = "classic",
  size = "md",

  hideNumbers = false, // only used by legacy "numbers" mode
  className = "",
}: Props) {
  // Clamp
  const clampedPage = Math.min(Math.max(1, currentPage), Math.max(1, totalPages));
  const canPrev = clampedPage > 1;
  const canNext = clampedPage < totalPages;

  // Numeric window (only needed for 'numbers' mode)
  const half = Math.floor(windowSize / 2);
  const start = Math.max(1, clampedPage - half);
  const end = Math.min(totalPages, start + windowSize - 1);
  const startFinal = Math.max(1, Math.min(start, end - windowSize + 1));
  const pages = useMemo(() => {
    if (mode !== "numbers") return [];
    const arr: number[] = [];
    for (let p = startFinal; p <= end; p++) arr.push(p);
    return arr;
  }, [mode, startFinal, end]);

  // ========== Early exits by mode ==========
  if (mode === "none" || !visible) return null;

  // Infinite only: render just the sentinel (keeps layout clean)
  if (mode === "infinite") {
    if (!onLoadMore) return null;
    return (
      <AutoLoadSentinel
        onLoadMore={onLoadMore}
        loading={loading}
        rootMargin={autoLoadOffset}
      />
    );
  }

  // Load-more only: center one big button
  if (mode === "load-more") {
    if (!onLoadMore) return null;
    return (
      <div className={[styles.pagination, styles.center, className].join(" ")}>
        <button
          type="button"
          className={`${styles.btn} ${styles.more}`}
          onClick={() => onLoadMore()}
          disabled={loading || !canNext}
        >
          {loading ? "লোড হচ্ছে…" : (labels.more ?? "আরও")}
        </button>
      </div>
    );
  }

  // Next/Prev only (no numbers)
  if (mode === "next-prev") {
    return (
      <nav
        className={[
          styles.pagination,
          styles[`variant--${variant}`],
          styles[`size--${size}`],
          styles.onlyNav,
          className,
        ].join(" ")}
        aria-label="Pagination Navigation"
      >
        <div className={styles.rowNP}>
          <button
            type="button"
            className={`${styles.btn} ${styles.nav}`}
            onClick={() => canPrev && onPageChange(clampedPage - 1)}
            disabled={!canPrev || loading}
            aria-label="Previous page"
          >
            <span aria-hidden>‹</span> {labels.prev ?? "পূর্ববর্তী"}
          </button>

          <button
            type="button"
            className={`${styles.btn} ${styles.nav}`}
            onClick={() => canNext && onPageChange(clampedPage + 1)}
            disabled={!canNext || loading}
            aria-label="Next page"
          >
            {labels.next ?? "পরবর্তী"} <span aria-hidden>›</span>
          </button>
        </div>
      </nav>
    );
  }

  // Default 'numbers' (your original UI)
  if (totalPages <= 1) return null;

  const rootClass = [
    styles.pagination,
    styles[`variant--${variant}`],
    styles[`size--${size}`],
    className,
  ].join(" ");

  return (
    <nav className={rootClass} aria-label="Pagination Navigation">
      <div className={styles.row}>
        {/* Prev */}
        <button
          type="button"
          className={`${styles.btn} ${styles.nav}`}
          onClick={() => canPrev && onPageChange(clampedPage - 1)}
          disabled={!canPrev || loading}
          aria-label="Previous page"
        >
          <span aria-hidden>‹</span> {labels.prev ?? "পূর্ববর্তী"}
        </button>

        {/* Numbers */}
        {!hideNumbers && (
          <ul className={styles.pages} role="list">
            {startFinal > 1 && (
              <>
                <li>
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={() => onPageChange(1)}
                    disabled={loading}
                    aria-label={`পৃষ্ঠা ${bn(1)}`}
                  >
                    {bn(1)}
                  </button>
                </li>
                {startFinal > 2 && <li className={styles.ellipsis} aria-hidden="true">⋯</li>}
              </>
            )}

            {pages.map((p) => (
              <li key={p}>
                {p === clampedPage ? (
                  <span
                    className={`${styles.btn} ${styles.active}`}
                    aria-current="page"
                    aria-label={`বর্তমান পৃষ্ঠা ${bn(p)}`}
                  >
                    {bn(p)}
                  </span>
                ) : (
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={() => onPageChange(p)}
                    disabled={loading}
                    aria-label={`পৃষ্ঠা ${bn(p)} এ যান`}
                  >
                    {bn(p)}
                  </button>
                )}
              </li>
            ))}

            {end < totalPages && (
              <>
                {end < totalPages - 1 && <li className={styles.ellipsis} aria-hidden="true">⋯</li>}
                <li>
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={() => onPageChange(totalPages)}
                    disabled={loading}
                    aria-label={`পৃষ্ঠা ${bn(totalPages)}`}
                  >
                    {bn(totalPages)}
                  </button>
                </li>
              </>
            )}
          </ul>
        )}

        {/* Next */}
        <button
          type="button"
          className={`${styles.btn} ${styles.nav}`}
          onClick={() => canNext && onPageChange(clampedPage + 1)}
          disabled={!canNext || loading}
          aria-label="Next page"
        >
          {labels.next ?? "পরবর্তী"} <span aria-hidden>›</span>
        </button>
      </div>
    </nav>
  );
}

/** Invisible sentinel for infinite scrolling */
function AutoLoadSentinel({
  onLoadMore,
  loading,
  rootMargin = 160,
}: {
  onLoadMore: () => void;
  loading: boolean;
  rootMargin?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e.isIntersecting && !loading) onLoadMore();
      },
      { root: null, rootMargin: `0px 0px ${rootMargin}px 0px`, threshold: 0 }
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [loading, onLoadMore, rootMargin]);

  return <div ref={ref} aria-hidden="true" style={{ height: 1 }} />;
}


// How to use (4 examples)

// // 1) Classic (default)
// <Pagination
//   visible
//   currentPage={page}
//   totalPages={total}
//   onPageChange={setPage}
// />

// // 2) Pill, larger
// <Pagination
//   visible
//   variant="pill"
//   size="lg"
//   currentPage={page}
//   totalPages={total}
//   onPageChange={setPage}
// />

// // 3) Minimal (prev/next only)
// <Pagination
//   visible
//   variant="minimal"
//   hideNumbers
//   currentPage={page}
//   totalPages={total}
//   onPageChange={setPage}
// />

// // 4) Ghost with Load More + Infinite
// <Pagination
//   visible
//   variant="ghost"
//   showMoreButton
//   onLoadMore={loadMore}
//   autoLoad
//   currentPage={page}
//   totalPages={total}
//   onPageChange={setPage}
// />