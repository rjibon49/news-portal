// src/app/(dashboard)/dashboard/posts/[id]/edit/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "react-toastify";
import TinyEditor from "@/components/rich/TinyEditor";
import MediaPicker from "@/components/media/MediaPicker";
import TagPicker from "@/components/post-editor/TagPicker";
import AuthorPicker, { type AuthorLite } from "@/components/post-editor/AuthorPicker";
import { slugify } from "@/lib/slugify";
import styles from "./edit.module.css";

/**
 * Edit Post (Bangladesh time aware)
 * - Server returns `scheduledAt` in BD local "YYYY-MM-DDTHH:mm" for input[type=datetime-local].
 * - While sending schedule, we convert to ISO(UTC).
 */

type GalleryItem = { id: number; url?: string };

type Prefill = {
  id: number;
  title: string;
  content: string;
  excerpt: string;
  status: "publish" | "draft" | "pending" | "trash" | "future";
  slug: string;
  categoryTtxIds: number[];
  tagNames: string[];
  featuredImageId: number | null;
  scheduledAt: string | null; // BD local for input

  // EXTRA
  subtitle?: string | null;
  highlight?: string | null;
  format?: "standard" | "gallery" | "video";
  gallery?: GalleryItem[] | null;
  videoEmbed?: string | null;

  author?: {
    id?: number; ID?: number;
    name?: string; display_name?: string;
    username?: string; user_login?: string;
    email?: string | null; user_email?: string | null;
    avatar?: string | null; avatarUrl?: string | null; avatar_url?: string | null;
    slug?: string; user_nicename?: string;
  } | null;
};

type Category = {
  term_taxonomy_id: number;
  term_id: number;
  name: string;
  slug: string;
  parent: number;
  count: number;
};

type CatOption = { id: number; name: string; label: string; depth: number };

type MeInfo = {
  id: number;
  role: "administrator" | "editor" | "author" | "contributor" | "subscriber";
  canPublishNow: boolean;
};

/* ---------------------- BD time helpers ---------------------- */
function formatBDDisplay(s: string) {
  if (!s) return "";
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString("en-BD", {
      timeZone: "Asia/Dhaka",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
    });
  } catch { return ""; }
}

function nowForBDInput(): string {
  const bangladeshOffsetMs = 6 * 60 * 60 * 1000; // UTC+6
  const bd = new Date(Date.now() + bangladeshOffsetMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${bd.getUTCFullYear()}-${pad(bd.getUTCMonth() + 1)}-${pad(bd.getUTCDate())}T${pad(bd.getUTCHours())}:${pad(bd.getUTCMinutes())}`;
}

/* ---------------------- TTS helpers/types ---------------------- */
type TtsGenResp = { url: string; duration_sec?: number; chars?: number; lang?: string; voice?: string; };

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/* ============================================================ */

export default function EditPostPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const postId = Number(id);

  const [loading, setLoading] = useState(true);
  const [cats, setCats] = useState<Category[]>([]);
  const [me, setMe] = useState<MeInfo | null>(null);

  // Initial status (to hide Publish button when already published)
  const [initialStatus, setInitialStatus] =
    useState<"publish" | "draft" | "pending" | "future">("draft");

  // Core
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState<"publish" | "draft" | "pending">("draft");
  const [content, setContent] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [selectedCats, setSelectedCats] = useState<number[]>([]);
  const [tagNames, setTagNames] = useState<string[]>([]);
  const [featured, setFeatured] = useState<{ id: number; url?: string } | null>(null);

  // Author
  const [selectedAuthor, setSelectedAuthor] = useState<AuthorLite | null>(null);

  // EXTRA
  const [subtitle, setSubtitle] = useState("");
  const [highlight, setHighlight] = useState("");
  const [format, setFormat] = useState<"standard" | "gallery" | "video">("standard");
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [videoEmbed, setVideoEmbed] = useState("");

  // Media pickers
  const [pickerOpen, setPickerOpen] = useState(false);
  const [galleryPickerOpen, setGalleryPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Schedule
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleAt, setScheduleAt] = useState<string>(""); // BD local for input

  // TTS UI state
  const [ttsLang, setTtsLang] = useState<"bn-BD" | "en-US">("bn-BD");
  const [ttsVoice, setTtsVoice] = useState<string>("female_1");
  const [ttsBusy, setTtsBusy] = useState(false);
  const [ttsAudio, setTtsAudio] = useState<TtsGenResp | null>(null);

  const effectiveSlug = useMemo(
    () => (slug ? slugify(slug, { keepUnicode: false }) : slugify(title, { keepUnicode: false })) || "post",
    [slug, title]
  );

  const isFuture = useMemo(() => {
    if (!scheduleEnabled || !scheduleAt) return false;
    const t = new Date(scheduleAt).getTime();
    return !isNaN(t) && t > Date.now();
  }, [scheduleEnabled, scheduleAt]);

  const canChangeAuthor = me?.role === "administrator" || me?.role === "editor";

  function makeCategoryOptions(rows: Category[]): CatOption[] {
    const byParent: Record<number, Category[]> = {};
    rows.forEach((r) => { const p = r.parent || 0; (byParent[p] ||= []).push(r); });
    Object.values(byParent).forEach((list) => list.sort((a, b) => a.name.localeCompare(b.name)));
    const out: CatOption[] = [];
    const walk = (parentId: number, depth: number) => {
      (byParent[parentId] || []).forEach((c) => {
        out.push({ id: c.term_taxonomy_id, name: c.name, label: `${"— ".repeat(depth)}${c.name}`, depth });
        walk(c.term_taxonomy_id, depth + 1);
      });
    };
    walk(0, 0);
    return out;
  }

  const catOptions = useMemo(() => makeCategoryOptions(cats), [cats]);

  /* ---------------------------- Load ---------------------------- */
  async function load() {
    setLoading(true);
    try {
      // me
      const meRes = await fetch("/api/r2/me", { cache: "no-store" });
      if (meRes.ok) setMe(await meRes.json()); else setMe(null);

      // post
      const res = await fetch(`/api/r2/posts/${id}`, { cache: "no-store" });
      const j: Prefill = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error((j as any)?.error || "Failed to load");

      setTitle(j.title || "");
      setSlug(j.slug || "");
      const norm = (j.status === "trash" ? "draft" : j.status) as "publish" | "draft" | "pending" | "future";
      setInitialStatus(norm);
      setStatus((norm === "future" ? "draft" : (norm as any)) as any);

      setContent(j.content || "");
      setExcerpt(j.excerpt || "");
      setSelectedCats(Array.isArray(j.categoryTtxIds) ? j.categoryTtxIds : []);
      setTagNames(Array.isArray(j.tagNames) ? j.tagNames : []);

      if (j.featuredImageId) {
        try {
          const mr = await fetch(`/api/r2/media/${j.featuredImageId}`, { cache: "no-store" });
          if (mr.ok) {
            const m = await mr.json();
            setFeatured({ id: j.featuredImageId, url: m.guid || m.url });
          } else setFeatured({ id: j.featuredImageId });
        } catch { setFeatured({ id: j.featuredImageId }); }
      } else setFeatured(null);

      setSubtitle((j.subtitle ?? "") || "");
      setHighlight((j.highlight ?? "") || "");
      setFormat(j.format || "standard");
      setGallery(Array.isArray(j.gallery) ? j.gallery : []);
      setVideoEmbed((j.videoEmbed ?? "") || "");

      // Author prefill
      const a = j.author;
      if (a && (a.id || a.ID)) {
        const authorLite: AuthorLite = {
          id: Number(a.id ?? a.ID),
          name: String(a.name ?? a.display_name ?? `User #${a.id ?? a.ID}`),
          username: String(a.username ?? a.user_login ?? `user${a.id ?? a.ID}`),
          email: (a.email ?? a.user_email ?? null) as string | null,
          avatar: (a.avatar ?? a.avatarUrl ?? a.avatar_url ?? null) as string | null,
        };
        setSelectedAuthor(authorLite);
      } else setSelectedAuthor(null);

      // schedule (server gives BD-local or null)
      setScheduleEnabled(false);
      setScheduleAt(j.scheduledAt || "");

      // categories
      const rc = await fetch("/api/r2/categories", { cache: "no-store" });
      if (rc.ok) setCats(await rc.json());
    } catch (e: any) {
      toast.error(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (id) void load(); }, [id]);

  // When user toggles schedule ON and no value exists, seed with "now in BD"
  useEffect(() => {
    if (scheduleEnabled && !scheduleAt) setScheduleAt(nowForBDInput());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleEnabled]);

  /* ----------------------- Build payload ----------------------- */
  function buildPayload(forceStatus?: "draft" | "publish" | "pending") {
    const cleanCats = Array.from(new Set(selectedCats)).filter((x) => Number.isFinite(x) && x > 0) as number[];
    const cleanTags = tagNames.map((t) => (t || "").trim()).filter(Boolean);
    const cleanGallery = (Array.isArray(gallery) ? gallery : [])
      .filter((g) => Number.isFinite(g.id) && g.id > 0)
      .map((g) => ({ id: Number(g.id), url: g.url || undefined }));

    const payload: any = {
      title: title.trim(),
      content: content.trim(),
      excerpt: excerpt.trim(),
      status: forceStatus || status,
      slug: effectiveSlug,
      categoryTtxIds: cleanCats,
      tagNames: cleanTags,
      featuredImageId: featured ? featured.id : null,
      subtitle: subtitle.trim() || null,
      highlight: highlight.trim() || null,
      format,
      gallery: cleanGallery.length ? cleanGallery : null,
      videoEmbed: (format === "video" ? videoEmbed.trim() : "").trim() || null,
    };

    if (canChangeAuthor && selectedAuthor?.id) payload.authorId = selectedAuthor.id;

    if (scheduleEnabled && scheduleAt) {
      const d = new Date(scheduleAt);
      if (!isNaN(d.getTime())) payload.scheduledAt = d.toISOString();
    } else payload.scheduledAt = null;

    return payload;
  }

  async function save(payload: any) {
    const res = await fetch(`/api/r2/posts/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const responseData = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(responseData?.error || "Update failed");
    return responseData;
  }

  async function onUpdate() {
    if (!title.trim()) return toast.error("Title is required");
    if (!content.trim()) return toast.error("Content is required");

    setSaving(true);
    try {
      const payload = buildPayload();
      await save(payload);
      toast.success("Updated");
      router.push("/dashboard/posts");
    } catch (e: any) {
      toast.error(e.message || "Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function onSaveDraft() {
    if (!title.trim()) return toast.error("Title is required");
    setSaving(true);
    try {
      const payload = buildPayload("draft");
      await save(payload);
      toast.success("Saved as draft");
      router.push("/dashboard/posts");
    } catch (e: any) {
      toast.error(e.message || "Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function onPublishNow() {
    if (!title.trim()) return toast.error("Title is required");
    if (!content.trim()) return toast.error("Content is required");

    const canPublish = !!me?.canPublishNow;
    setSaving(true);
    try {
      const payload = buildPayload(canPublish ? "publish" : "pending");
      if (!canPublish) payload.scheduledAt = null;

      await save(payload);

      if (!canPublish) toast.success("Sent for review");
      else toast.success(scheduleEnabled && isFuture ? "Scheduled" : "Published");

      router.push("/dashboard/posts");
    } catch (e: any) {
      toast.error(e.message || "Publish failed");
    } finally {
      setSaving(false);
    }
  }

  /* ----------------------- Gallery ops ----------------------- */
  const removeGalleryItem = (idx: number) => setGallery((p) => p.filter((_, i) => i !== idx));
  const moveGalleryItem = (idx: number, dir: -1 | 1) =>
    setGallery((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });

  /* ----------------------- TTS action ----------------------- */
  async function onGenerateTts() {
    try {
      if (!content.trim()) return toast.error("Write some content first.");
      setTtsBusy(true);

      const text = stripHtml(content);
      if (!text) {
        setTtsBusy(false);
        return toast.error("Nothing to convert. Please add content.");
      }

      const res = await fetch("/api/r2/tts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId,
          lang: ttsLang,
          voice: ttsVoice,
          text,
          title: title?.trim() || undefined,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as TtsGenResp & { error?: string };
      if (!res.ok) throw new Error(j?.error || "TTS failed");

      setTtsAudio(j);
      toast.success("Audio generated");
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate audio");
    } finally {
      setTtsBusy(false);
    }
  }

  if (loading) return <div className={styles.container}>Loading…</div>;
  const isInitiallyPublished = initialStatus === "publish";

  const publishBtnLabel = me?.canPublishNow
    ? (scheduleEnabled && isFuture ? "Schedule" : "Publish")
    : "Pending Review";

  return (
    <div className={styles.container}>
      <div className={styles.grid}>
        {/* ====================== Main column ====================== */}
        <div className={styles.mainCol}>
          <form
            onSubmit={(e) => { e.preventDefault(); onUpdate(); }}
          >
            <div className={styles.headerRow}>
              <h2 className={styles.h2}>Edit Post</h2>
              <small className={styles.dim} />
            </div>

            <label className={styles.label}>Title *</label>
            <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter title here" />

            <label className={styles.label}>Slug</label>
            <input className={styles.input} value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="optional" />
            <small className={styles.dim}>Preview: <code>{effectiveSlug}</code></small>

            <label className={styles.label}>Subtitle</label>
            <input className={styles.input} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Subtitle (optional)" />

            <label className={styles.label}>Highlight / Tagline</label>
            <input className={styles.input} value={highlight} onChange={(e) => setHighlight(e.target.value)} placeholder="Highlight / Tagline (optional)" />

            <label className={styles.label}>Content *</label>
            <TinyEditor value={content} onChange={setContent} />

            <div className={styles.card}>
              <div className={styles.cardHd}>Format</div>
              <div className={styles.cardBd}>
                <div className={styles.chipsRow}>
                  {(["standard", "gallery", "video"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      className={`${styles.chip} ${format === f ? styles.chipActive : ""}`}
                      onClick={() => setFormat(f)}
                    >
                      {f[0].toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>

                {format === "gallery" && (
                  <div>
                    <div className={styles.rowBetween}>
                      <strong>Gallery Images</strong>
                      <button type="button" className={styles.btnGhost} onClick={() => setGalleryPickerOpen(true)}>Choose Image</button>
                    </div>

                    {!gallery.length ? (
                      <small className={styles.dim}>No images selected</small>
                    ) : (
                      <div className={styles.galleryGrid}>
                        {gallery.map((g, i) => (
                          <div key={`${g.id}-${i}`} className={styles.galleryItem}>
                            {g.url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={g.url} alt="" className={styles.galleryImg} />
                            ) : (
                              <div className={styles.galleryPlaceholder}>#{g.id}</div>
                            )}
                            <div className={styles.galleryBtns}>
                              <button type="button" className={styles.btnGhost} onClick={() => moveGalleryItem(i, -1)} disabled={i === 0}>↑</button>
                              <button type="button" className={styles.btnGhost} onClick={() => moveGalleryItem(i, 1)} disabled={i === gallery.length - 1}>↓</button>
                              <button type="button" className={styles.btnGhost} onClick={() => removeGalleryItem(i)}>Remove</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {format === "video" && (
                  <div>
                    <label className={styles.label}>Insert video URL or embed code</label>
                    <textarea className={styles.textarea} rows={4} value={videoEmbed} onChange={(e) => setVideoEmbed(e.target.value)} placeholder="https://youtu.be/... or <iframe ...></iframe>" />
                  </div>
                )}
              </div>
            </div>

            <details className={styles.details}>
              <summary>Excerpt</summary>
              <textarea className={styles.textarea} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={4} />
            </details>
          </form>
        </div>

        {/* ====================== Side column ====================== */}
        <aside className={styles.sideCol}>
          <div className={styles.card}>
            <div className={styles.cardHd}>Publish</div>
            <div className={styles.cardBdGrid}>
              <label>
                <span className={styles.label}>Status</span>
                <select className={styles.select} value={status} onChange={(e) => setStatus(e.target.value as any)}>
                  <option value="draft">Draft</option>
                  <option value="pending">Pending</option>
                  <option value="publish">Publish</option>
                </select>
              </label>

              <label className={styles.inlineCheck}>
                <input
                  type="checkbox"
                  checked={scheduleEnabled}
                  onChange={(e) => setScheduleEnabled(e.target.checked)}
                  disabled={!me?.canPublishNow}
                  title={!me?.canPublishNow ? "You can't schedule. Send for review." : undefined}
                />
                <span>Schedule this post</span>
              </label>

              {scheduleEnabled && me?.canPublishNow && (
                <label>
                  <span className={styles.label}>Publish on</span>
                  <input type="datetime-local" className={styles.input} value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
                  {!!scheduleAt && (
                    <small className={styles.dim}>
                      {isFuture ? "Will schedule at " : "Will set date "}{formatBDDisplay(scheduleAt)}
                    </small>
                  )}
                </label>
              )}

              <div className={styles.btnRowWrap}>
                <button type="button" className={styles.btnGhost} onClick={onSaveDraft} disabled={saving}>
                  {saving ? "Saving…" : "Save Draft"}
                </button>
                {!isInitiallyPublished && (
                  <button type="button" className={styles.btn} onClick={onPublishNow} disabled={saving}>
                    {saving ? (me?.canPublishNow ? "Publishing…" : "Sending…") : publishBtnLabel}
                  </button>
                )}
                <button type="button" className={styles.btn} onClick={onUpdate} disabled={saving}>
                  {saving ? "Updating…" : "Update"}
                </button>
              </div>
            </div>
          </div>

          {/* Authors */}
          <div className={styles.card}>
            <div className={styles.cardHd}>Authors</div>
            <div className={styles.cardBdGrid}>
              <small className={styles.dim}>
                {canChangeAuthor ? "Pick a different author for this post." : "You can’t change the author. Ask an editor/admin if needed."}
              </small>
              <div
                aria-disabled={!canChangeAuthor}
                className={!canChangeAuthor ? styles.disabled : ""}
              >
                <AuthorPicker value={selectedAuthor} onChange={setSelectedAuthor} />
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHd}>Categories</div>
            <div className={`${styles.cardBd} ${styles.scroll}`}>
              {catOptions.map((opt) => (
                <label key={opt.id} className={styles.catRow} title={opt.name} style={{ paddingLeft: opt.depth ? Math.min(opt.depth * 12, 48) : 0 }}>
                  <input
                    type="checkbox"
                    checked={selectedCats.includes(opt.id)}
                    onChange={(e) => setSelectedCats((p) => (e.target.checked ? [...p, opt.id] : p.filter((x) => x !== opt.id)))}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <TagPicker value={tagNames} onChange={setTagNames} />

          <div className={styles.card}>
            <div className={styles.cardHd}>Featured image</div>
            <div className={styles.cardBdGrid}>
              {featured ? (
                <>
                  <div className={styles.featuredBox}>
                    {featured.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={featured.url} alt="Featured" className={styles.featuredImg} />
                    ) : (
                      <div className={styles.featuredPlaceholder}>Preview not available</div>
                    )}
                  </div>
                  <div className={styles.btnRow}>
                    <button type="button" className={styles.btnGhost} onClick={() => setPickerOpen(true)}>Change</button>
                    <button type="button" className={styles.btnGhost} onClick={() => setFeatured(null)}>Remove</button>
                  </div>
                </>
              ) : (
                <>
                  <button type="button" className={styles.btnGhost} onClick={() => setPickerOpen(true)}>Choose Image</button>
                  <small className={styles.dim}>No image selected</small>
                </>
              )}
            </div>
          </div>

          {/* 🔊 Text-to-Audio (TTS) */}
          <div className={styles.card}>
            <div className={styles.cardHd}>Text-to-Audio</div>
            <div className={styles.cardBdGrid}>
              <label>
                <span className={styles.label}>Language</span>
                <select className={styles.select} value={ttsLang} onChange={(e) => setTtsLang(e.target.value as any)}>
                  <option value="bn-BD">Bengali (Bangladesh)</option>
                  <option value="en-US">English (US)</option>
                </select>
              </label>

              <label>
                <span className={styles.label}>Voice</span>
                <select className={styles.select} value={ttsVoice} onChange={(e) => setTtsVoice(e.target.value)}>
                  <option value="female_1">Female 1</option>
                  <option value="male_1">Male 1</option>
                </select>
              </label>

              <button type="button" className={styles.btn} onClick={onGenerateTts} disabled={ttsBusy}>
                {ttsBusy ? "Generating…" : "Generate from Content"}
              </button>

              {ttsAudio?.url ? (
                <>
                  <small className={styles.dim}>
                    {ttsAudio.duration_sec ? `~${Math.round(ttsAudio.duration_sec)}s` : ""} {ttsAudio.chars ? `(${ttsAudio.chars} chars)` : ""}
                  </small>
                  <audio controls preload="none" src={ttsAudio.url} className={styles.audio} />
                  <small className={styles.dim}>This audio will appear at the top of the single article page.</small>
                </>
              ) : (
                <small className={styles.dim}>Click “Generate from Content” to create an audio narration.</small>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Media Pickers */}
      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(m) => { setFeatured({ id: m.ID, url: m.guid }); setPickerOpen(false); }}
        imagesOnly
      />
      <MediaPicker
        open={galleryPickerOpen}
        onClose={() => setGalleryPickerOpen(false)}
        onSelect={(m) => { setGallery((prev) => [...prev, { id: m.ID, url: m.guid }]); setGalleryPickerOpen(false); }}
        imagesOnly
      />
    </div>
  );
}
