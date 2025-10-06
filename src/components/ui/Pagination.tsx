// src/components/ui/Pagination.tsx
"use client";

/**
 * Pagination (reusable)
 * --------------------------------------------------------------
 * Props:
 * - total: মোট রেকর্ড সংখ্যা
 * - page: বর্তমান পেজ (1-based)
 * - perPage: প্রতি পেজে কয়টা
 * - perPageOptions: সিলেক্টে দেখানোর অপশন (ডিফল্ট [10,20,40,80])
 * - onPageChange: পেজ বদলালে কলব্যাক
 * - onPerPageChange: perPage বদলালে কলব্যাক (optional)
 *
 * নোট: UI খুব সিম্পল রাখা হয়েছে—Prev/Next + Page X / Y + Per page select
 * প্রয়োজনে এখানে First/Last বা numbered buttons যোগ করতে পারো।
 */

type Props = {
  total: number;                 // মোট রেকর্ড
  page: number;                  // 1-based
  perPage: number;
  perPageOptions?: number[];
  onPageChange: (next: number) => void;
  onPerPageChange?: (n: number) => void;
};

/**
 * Reusable Pagination
 * - Prev / Next + "Page X / Y"
 * - Optional per-page selector
 */
export default function Pagination({
  total,
  page,
  perPage,
  perPageOptions = [10, 20, 40, 80],
  onPageChange,
  onPerPageChange,
}: Props) {
  const pages = Math.max(1, Math.ceil((total || 0) / Math.max(1, perPage)));

  const prev = () => page > 1 && onPageChange(page - 1);
  const next = () => page < pages && onPageChange(page + 1);

  return (
    <div className="toolbar" style={{ justifyContent: "space-between", marginTop: 12 }}>
      {/* Left: page info + buttons */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button className="btn-ghost" onClick={prev} disabled={page <= 1} aria-label="Previous page">
          « Prev
        </button>
        <div className="btn-ghost" aria-live="polite">Page {page} / {pages}</div>
        <button className="btn-ghost" onClick={next} disabled={page >= pages} aria-label="Next page">
          Next »
        </button>
      </div>

      {/* Right: per page selector (optional) */}
      {onPerPageChange && (
        <div>
          <select
            className="select"
            value={perPage}
            onChange={(e) => onPerPageChange(Number(e.target.value))}
            title="Items per page"
            aria-label="Items per page"
          >
            {perPageOptions.map((n) => (
              <option key={n} value={n}>
                Per page: {n}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}