// -----------------------------------------------------------------------------
// FILE: src/utils/dateFormatter.ts
// Bangla date/time utilities — safe, flexible & SSR-friendly
// -----------------------------------------------------------------------------

// Bangla digits map
const BN_DIGITS = ["০","১","২","৩","৪","৫","৬","৭","৮","৯"] as const;

// [ADDED] Optional reverse map (if you ever need to parse Bangla numerals)
const BN_TO_EN: Record<string, string> = {
  "০":"0","১":"1","২":"2","৩":"3","৪":"4","৫":"5","৬":"6","৭":"7","৮":"8","৯":"9",
};

// [ADDED] Safe date parser supporting string | number | Date
function toDate(input?: string | number | Date): Date | null {
  if (input == null) return null;
  const d = input instanceof Date ? new Date(input.getTime()) : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Number → Bangla digits (for manual formatting)
function digitsToBangla(input: string): string {
  return input.replace(/\d/g, (d) => BN_DIGITS[Number(d)]);
}

// [UNCHANGED] Public: toBanglaDigits (kept for compatibility)
export function toBanglaDigits(input: string): string {
  return digitsToBangla(input);
}

// [ADDED] Optional helper: Bangla → English digits (if needed)
export function fromBanglaDigits(input: string): string {
  return input.replace(/[০-৯]/g, (ch) => BN_TO_EN[ch] ?? ch);
}

// [CHANGED] formatBanglaDate: safer + optional tz
export function formatBanglaDate(
  iso?: string | number | Date,
  tz: string = "Asia/Dhaka"
): string {
  const d = toDate(iso);
  if (!d) return "";
  try {
    // Prefer Intl to get correct month/day for the target tz
    const s = new Intl.DateTimeFormat("bn-BD", {
      timeZone: tz, year: "numeric", month: "long", day: "numeric",
    }).format(d);
    return digitsToBangla(s);
  } catch {
    return "";
  }
}

// [CHANGED] Relative time — tries Intl.RelativeTimeFormat first, falls back gracefully
export function formatBanglaRelative(iso?: string | number | Date): string {
  const d = toDate(iso);
  if (!d) return "";
  const now = Date.now();
  const diffSec = Math.max(1, Math.round((now - d.getTime()) / 1000));

  // [ADDED] Try Intl.RelativeTimeFormat (bn) for nicer grammar
  try {
    const rtf = new Intl.RelativeTimeFormat("bn", { numeric: "auto" });
    const MIN = 60, HOUR = 3600, DAY = 86400, WEEK = 604800;
    if (diffSec < MIN) return digitsToBangla(rtf.format(-diffSec, "second"));
    if (diffSec < HOUR) return digitsToBangla(rtf.format(-Math.round(diffSec / MIN), "minute"));
    if (diffSec < DAY) return digitsToBangla(rtf.format(-Math.round(diffSec / HOUR), "hour"));
    if (diffSec < WEEK) return digitsToBangla(rtf.format(-Math.round(diffSec / DAY), "day"));
    return formatBanglaDate(d);
  } catch {
    // Fallback: your original phrasing
    const MIN = 60, HOUR = 3600, DAY = 86400, WEEK = 604800;
    let out: string;
    if (diffSec < MIN) out = `${diffSec} সেকেন্ড আগে`;
    else if (diffSec < HOUR) out = `${Math.round(diffSec / MIN)} মিনিট আগে`;
    else if (diffSec < DAY) out = `${Math.round(diffSec / HOUR)} ঘণ্টা আগে`;
    else if (diffSec < WEEK) out = `${Math.round(diffSec / DAY)} দিন আগে`;
    else out = formatBanglaDate(d);
    return digitsToBangla(out);
  }
}

// [CHANGED] Month names আর ম্যানুয়াল ক্যাল্ক বাদ দিয়ে Intl দিয়ে টাইম+ডেট
// Output example: "১২:৫১ অপরাহ্ণ, ২৮ আগস্ট ২০২৫"
export function formatBanglaDateTime(
  iso?: string | number | Date,
  tz: string = "Asia/Dhaka"
): string {
  const d = toDate(iso);
  if (!d) return "";
  try {
    // Hour/minute + am/pm (বাঙলায় AM/PM কে পূর্বাহ্ণ/অপরাহ্ণ দেখানো)
    const parts = new Intl.DateTimeFormat("bn-BD", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).formatToParts(d);

    let hh = "00", mm = "00", dayPeriod = "";
    for (const p of parts) {
      if (p.type === "hour") hh = p.value;
      else if (p.type === "minute") mm = p.value;
      else if (p.type === "dayPeriod") dayPeriod = p.value; // bn locale gives "AM"/"PM" in Bangla context
    }

    // Normalize AM/PM → পূর্বাহ্ণ/অপরাহ্ণ (in case some runtimes give English)
    const dp =
      /pm|পূর্বাহ্ণ|অপরাহ্ণ|PM|AM/i.test(dayPeriod)
        ? /pm|PM/i.test(dayPeriod) ? "অপরাহ্ণ" : "পূর্বাহ্ণ"
        : dayPeriod || "পূর্বাহ্ণ";

    const dateStr = new Intl.DateTimeFormat("bn-BD", {
      timeZone: tz, year: "numeric", month: "long", day: "numeric",
    }).format(d);

    // Ensure numerals are Bangla
    const timeStr = digitsToBangla(`${hh}:${mm}`);
    const full = `${timeStr} ${dp}, ${dateStr}`;
    return digitsToBangla(full);
  } catch {
    return "";
  }
}

// [ADDED] Utility: format with a custom template using Intl options
export function formatBangla(
  iso?: string | number | Date,
  opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" },
  tz: string = "Asia/Dhaka"
): string {
  const d = toDate(iso);
  if (!d) return "";
  try {
    const s = new Intl.DateTimeFormat("bn-BD", { timeZone: tz, ...opts }).format(d);
    return digitsToBangla(s);
  } catch {
    return "";
  }
}
