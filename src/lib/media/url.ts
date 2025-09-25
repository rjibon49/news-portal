// src/lib/media/url.ts
import path from "node:path";

/** `/uploads/2025/09/file.webp` এই অংশটা বের করে আনে */
export function urlToRelativeUploadPath(url: string): string | null {
  try {
    const u = new URL(url, "http://dummy"); // base needed for relative
    const p = u.pathname || url; // handle absolute/relative
    const m = p.match(/\/uploads\/(\d{4})\/(\d{2})\/[^/]+$/);
    if (!m) return null;
    // Remove leading slash
    return p.replace(/^\/+/, "");
  } catch {
    // If it's already a path
    const m = url.match(/\/?uploads\/(\d{4})\/(\d{2})\/[^/]+$/);
    return m ? url.replace(/^\/+/, "") : null;
  }
}

/** public absolute path (…/public/uploads/…/file.webp) */
export function publicPathFromUrl(appRoot: string, url: string): string | null {
  const rel = urlToRelativeUploadPath(url);
  if (!rel) return null;
  return path.join(appRoot, "public", rel);
}
