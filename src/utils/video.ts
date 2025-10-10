// src/utils/video.ts

/** Try to pull a YouTube URL out of an HTML snippet (e.g. iframe). */
export function extractYouTubeFromHtml(html?: string): string | null {
  if (!html) return null;

  // 1) iframe src="...youtube..."
  const m1 = html.match(
    /<iframe[^>]+src=["'](https?:\/\/[^"']*youtube(?:-nocookie)?\.com\/[^"']+|https?:\/\/youtu\.be\/[^"']+)["']/i
  );
  if (m1?.[1]) return m1[1];

  // 2) any bare youtube/youtu.be link inside text
  const m2 = html.match(
    /(https?:\/\/(?:www\.)?(?:youtube(?:-nocookie)?\.com\/[^\s"'<>]+|youtu\.be\/[^\s"'<>]+))/i
  );
  return m2 ? m2[1] : null;
}

/** Extract a YouTube video ID from many common URL shapes. */
export function getYouTubeId(url?: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);

    // youtu.be/<id>(/anything)?...
    if (u.hostname.includes("youtu.be")) {
      const seg = u.pathname.split("/").filter(Boolean);
      return seg[0] ?? null;
    }

    // youtube.com/watch?v=<id>
    if (u.searchParams.has("v")) {
      return u.searchParams.get("v");
    }

    // /embed/<id>
    let m = u.pathname.match(/\/embed\/([\w-]+)/i);
    if (m) return m[1];

    // /shorts/<id>
    m = u.pathname.match(/\/shorts\/([\w-]+)/i);
    if (m) return m[1];

    // /live/<id>
    m = u.pathname.match(/\/live\/([\w-]+)/i);
    if (m) return m[1];

    // old /v/<id>
    m = u.pathname.match(/\/v\/([\w-]+)/i);
    if (m) return m[1];

    return null;
  } catch {
    return null;
  }
}

/** Privacy-friendly embed URL. Extra flags make the player behave nicer. */
export function toYouTubeEmbed(
  urlOrId?: string | null,
  opts: {
    autoplay?: boolean;
    nocookie?: boolean;
    origin?: string;       // e.g. window.location.origin (optional)
    playsinline?: boolean; // iOS inline playback
    modestbranding?: 0 | 1;
    rel?: 0 | 1;
    start?: number;        // seconds
  } = {}
): string | null {
  const {
    autoplay = true,
    nocookie = true,
    origin,
    playsinline = true,
    modestbranding = 1,
    rel = 0,
    start,
  } = opts;

  // allow passing raw id
  const id = urlOrId && /^[\w-]{6,}$/.test(urlOrId) ? urlOrId : getYouTubeId(urlOrId);
  if (!id) return null;

  const base = nocookie
    ? `https://www.youtube-nocookie.com/embed/${id}`
    : `https://www.youtube.com/embed/${id}`;

  const p = new URLSearchParams();
  p.set("autoplay", autoplay ? "1" : "0");
  p.set("modestbranding", String(modestbranding));
  p.set("rel", String(rel));
  p.set("playsinline", playsinline ? "1" : "0");
  p.set("enablejsapi", "1");
  if (origin) p.set("origin", origin);
  if (start && start > 0) p.set("start", String(Math.floor(start)));

  return `${base}?${p.toString()}`;
}

/** YouTube thumbnails. Tries maxres first (static), otherwise hq/mq. */
export function toYouTubeThumb(
  urlOrId?: string | null,
  quality: "max" | "hq" | "mq" = "hq",
  format: "jpg" | "webp" = "jpg"
): string | null {
  const id = urlOrId && /^[\w-]{6,}$/.test(urlOrId) ? urlOrId : getYouTubeId(urlOrId);
  if (!id) return null;

  const q = quality === "max"
    ? "maxresdefault"
    : quality === "hq"
    ? "hqdefault"
    : "mqdefault";

  // webp CDN path works for most modern browsers; jpg is the classic path
  const host = format === "webp" ? "i.ytimg.com" : "i.ytimg.com";
  return `https://${host}/vi/${id}/${q}.${format}`;
}
