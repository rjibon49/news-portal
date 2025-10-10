import { formatBanglaDate, formatBanglaRelative } from "@/utils/dateFormatter";

export const displayDate = (iso?: string, relative?: boolean) => {
  if (!iso) return "";
  return relative ? formatBanglaRelative(iso) : formatBanglaDate(iso);
};

// 0-9 → ০-৯, with optional left padding
export const bnDigits = (n: number | string, pad = 0) => {
  const s = String(n).padStart(pad, "0");
  return s.replace(/\d/g, d => "০১২৩৪৫৬৭৮৯"[Number(d)]);
};

// Safe text truncation with ellipsis
export const truncate = (s?: string, n?: number) => {
  if (!s || !n || s.length <= n) return s ?? "";
  return s.slice(0, Math.max(0, n - 1)).trimEnd() + "…";
};
