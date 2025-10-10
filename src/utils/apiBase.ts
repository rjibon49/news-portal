import { headers } from "next/headers";

/**
 * Build an absolute URL for server-side fetches.
 * Works with proxies (x-forwarded-*) and has .env fallback.
 */
export async function absoluteUrl(path: string) {
  // already absolute?
  if (/^https?:\/\//i.test(path)) return path;

  // Try headers() first (Next.js 15 returns a Promise)
  try {
    const h = await headers(); // ⬅️ await is required in Next.js 15+
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
    const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
    const base = `${proto}://${host}`.replace(/\/$/, "");
    return path.startsWith("/") ? base + path : `${base}/${path}`;
  } catch {
    // Fallback to env or localhost
    const base =
      (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
    return path.startsWith("/") ? base + path : `${base}/${path}`;
  }
}
