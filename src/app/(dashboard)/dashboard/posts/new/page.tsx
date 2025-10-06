// src/app/(dashboard)/dashboard/posts/new/page.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "react-toastify";
import TinyEditor from "@/components/rich/TinyEditor";
import MediaPicker from "@/components/media/MediaPicker";
import TagPicker from "@/components/post-editor/TagPicker";
import AuthorPicker, { AuthorLite } from "@/components/post-editor/AuthorPicker";
import { slugify } from "@/lib/slugify";
import { useAutoDraft } from "@/lib/hooks/useAutoDraft";
import styles from "./newPost.module.css";

/**
 * New Post (Bangladesh time aware)
 * - Admin/Editor can publish/schedule.
 * - Author/Contributor/Subscriber can only submit for review (pending).
 */

/* -------------------- Types -------------------- */
type Category = {
  term_taxonomy_id: number;
  term_id: number;
  name: string;
  slug: string;
  parent: number;
  count: number;
};
type GalleryItem = { id: number; url?: string };
type CatOption = { id: number; name: string; label: string; depth: number };

type CreatePostPayload = {
  title: string;
  content: string;
  excerpt?: string;
  status: "publish" | "draft" | "pending" | "future";
  slug?: string;
  categoryTtxIds: number[];
  tagNames: string[];
  featuredImageId?: number;
  // EXTRA
  subtitle?: string;
  highlight?: string;
  format?: "standard" | "gallery" | "video";
  gallery?: Array<number | { id: number; url?: string }>;
  videoEmbed?: string;
  // schedule
  scheduledAt?: string; // ISO (UTC)
  // admin override
  authorId?: number;
};

type MeInfo = { id: number; role: "administrator" | "editor" | "author" | "contributor" | "subscriber"; canPublishNow?: boolean };

/* -------------------- Helpers -------------------- */
async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as any)?.error || "Failed");
  return j as T;
}

// BD display for datetime-local
function formatBDDisplay(dateString: string) {
  if (!dateString) return "";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString("en-BD", {
      timeZone: "Asia/Dhaka",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}
function getCurrentDateTimeForInputBD(): string {
  const now = new Date();
  const bangladeshOffsetMs = 6 * 60 * 60 * 1000; // UTC+6
  const bd = new Date(now.getTime() + bangladeshOffsetMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${bd.getUTCFullYear()}-${pad(bd.getUTCMonth() + 1)}-${pad(bd.getUTCDate())}T${pad(
    bd.getUTCHours()
  )}:${pad(bd.getUTCMinutes())}`;
}

/* ==================== Page ==================== */
export default function NewPostPage() {
  const router = useRouter();

  // who am I? (for role-based UI)
  const [me, setMe] = useState<MeInfo | null>(null);

  // Core
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState<"publish" | "draft" | "pending">("draft");
  const [content, setContent] = useState("");
  const [excerpt, setExcerpt] = useState("");

  // Taxonomies
  const [cats, setCats] = useState<Category[]>([]);
  const [selectedCats, setSelectedCats] = useState<number[]>([]);
  const [catQ, setCatQ] = useState("");
  const [tagNames, setTagNames] = useState<string[]>([]);
  const [defaultCatId, setDefaultCatId] = useState<number | null>(null);

  // Featured
  const [featured, setFeatured] = useState<{ id: number; url: string } | null>(null);

  // Author override
  const [selectedAuthor, setSelectedAuthor] = useState<AuthorLite | null>(null);

  // EXTRA
  const [subtitle, setSubtitle] = useState("");
  const [highlight, setHighlight] = useState("");
  const [format, setFormat] = useState<"standard" | "gallery" | "video">("standard");
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [videoEmbed, setVideoEmbed] = useState("");

  // Schedule UI
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleAt, setScheduleAt] = useState<string>(getCurrentDateTimeForInputBD());

  // pickers
  const [pickerOpen, setPickerOpen] = useState(false);
  const [galleryPickerOpen, setGalleryPickerOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // compute publish permission (local rule): only admin/editor can publish
  const canPublishNow = useMemo(
    () => (me?.role === "administrator" || me?.role === "editor") ?? false,
    [me]
  );

  // slug: Title → auto (unless user customizes)
  const effectiveSlug = useMemo(
    () =>
      (slug
        ? slugify(slug, { keepUnicode: false })
        : slugify(title, { keepUnicode: false })) || "post",
    [slug, title]
  );

  // schedule future?
  const isFuture = useMemo(() => {
    if (!scheduleEnabled || !scheduleAt) return false;
    const t = new Date(scheduleAt).getTime();
    return !isNaN(t) && t > Date.now();
  }, [scheduleAt, scheduleEnabled]);

  const scheduleDisplay = useMemo(() => {
    if (!scheduleEnabled || !scheduleAt) return "";
    return formatBDDisplay(scheduleAt);
  }, [scheduleAt, scheduleEnabled]);

  /* ---------- Load me + categories ---------- */
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        // role info
        try {
          const info = await fetchJson<MeInfo>("/api/r2/me");
          setMe(info);
        } catch {
          setMe(null);
        }

        // categories
        const list = await fetchJson<Category[]>("/api/r2/categories");
        setCats(list);

        // default Others
        const others =
          list.find((c) => /others/i.test(c.name)) ||
          list.find((c) => (c.slug || "").toLowerCase() === "others");

        if (others) {
          setDefaultCatId(others.term_taxonomy_id);
          setSelectedCats((prev) => (prev.length ? prev : [others.term_taxonomy_id]));
        }
      } catch (e: any) {
        console.error("Init load failed:", e);
        toast.error(e?.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* -------------------- Submit helpers -------------------- */
  function buildPayload(forceStatus?: "draft" | "publish" | "pending"): CreatePostPayload {
    const cleanCats = Array.from(new Set(selectedCats)).filter(
      (x) => Number.isFinite(x) && x > 0
    ) as number[];

    const finalCats = cleanCats.length ? cleanCats : defaultCatId ? [defaultCatId] : [];

    const cleanGallery = gallery
      .filter((g) => Number.isFinite(g.id) && g.id > 0)
      .map((g) => ({ id: Number(g.id), url: g.url || undefined }));

    // Base status; caller can force it
    let finalStatus: "publish" | "draft" | "pending" | "future" =
      forceStatus ?? status;

    // If schedule is ON and user *can* publish → future
    if (canPublishNow && scheduleEnabled && scheduleAt) {
      const d = new Date(scheduleAt);
      if (!isNaN(d.getTime()) && d.getTime() > Date.now()) {
        finalStatus = "future";
      }
    }

    const payload: CreatePostPayload = {
      title: title.trim(),
      content: content.trim(),
      excerpt: excerpt.trim(),
      status: finalStatus,
      slug: effectiveSlug,
      categoryTtxIds: finalCats,
      tagNames: tagNames.map((t) => t.trim()).filter(Boolean),
      featuredImageId: featured?.id,
      subtitle: subtitle.trim() || undefined,
      highlight: highlight.trim() || undefined,
      format,
      gallery: cleanGallery.length ? cleanGallery : undefined,
      videoEmbed: (format === "video" ? videoEmbed.trim() : "").trim() || undefined,
    };

    // Schedule datetime (only meaningful if you can publish)
    if (canPublishNow && scheduleEnabled && scheduleAt) {
      const d = new Date(scheduleAt);
      if (!isNaN(d.getTime())) payload.scheduledAt = d.toISOString();
    }

    if (selectedAuthor) payload.authorId = selectedAuthor.id;

    return payload;
  }

  async function createPost(payload: CreatePostPayload) {
    const res = await fetch("/api/r2/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j?.error || j?.message || "Create failed");
    return j as { id: number; slug: string; status: string };
  }

  /* -------------------- Submit actions -------------------- */
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSaveDraft();
  }

  async function onSaveDraft() {
    if (!title.trim()) return toast.error("Title is required");

    setSaving(true);
    try {
      const payload = buildPayload("draft");
      const j = await createPost(payload);
      toast.success("Saved as draft");
      router.push(`/dashboard/posts/${j.id}/edit`);
    } catch (e: any) {
      toast.error(e.message || "Failed to save draft");
    } finally {
      setSaving(false);
    }
  }

  async function onPrimaryAction() {
    if (!title.trim()) return toast.error("Title is required");
    if (canPublishNow && !content.trim()) {
      return toast.error("Content is required");
    }

    setSaving(true);
    try {
      // Only admin/editor can publish; others submit pending.
      const forced: "publish" | "pending" =
        canPublishNow ? "publish" : "pending";

      const payload = buildPayload(forced);

      // If user cannot publish, ensure schedule is ignored
      if (!canPublishNow) {
        delete payload.scheduledAt;
        payload.status = "pending";
      }

      const j = await createPost(payload);

      if (!canPublishNow) {
        toast.success("Submitted for review");
      } else if (payload.status === "future") {
        toast.success("Post scheduled successfully");
      } else {
        toast.success("Published successfully");
      }

      router.push(`/dashboard/posts`);
    } catch (e: any) {
      toast.error(e.message || "Action failed");
    } finally {
      setSaving(false);
    }
  }

  /* -------------------- Category helpers -------------------- */
  function makeCategoryOptions(rows: Category[]): CatOption[] {
    const byParent: Record<number, Category[]> = {};
    rows.forEach((r) => {
      const p = r.parent || 0;
      (byParent[p] ||= []).push(r);
    });
    Object.values(byParent).forEach((list) => list.sort((a, b) => a.name.localeCompare(b.name)));

    const out: CatOption[] = [];
    const walk = (parentId: number, depth: number) => {
      (byParent[parentId] || []).forEach((c) => {
        out.push({
          id: c.term_taxonomy_id,
          name: c.name,
          label: `${"— ".repeat(depth)}${c.name}`,
          depth,
        });
        walk(c.term_taxonomy_id, depth + 1);
      });
    };
    walk(0, 0);
    return out;
  }

  const catOptions = useMemo(() => makeCategoryOptions(cats), [cats]);
  const filteredCatOptions = useMemo(() => {
    if (!catQ.trim()) return catOptions;
    const q = catQ.trim().toLowerCase();
    return catOptions.filter((o) => o.name.toLowerCase().includes(q));
  }, [catQ, catOptions]);

  function toggleCat(ttxId: number, checked: boolean) {
    setSelectedCats((prev) => (checked ? [...prev, ttxId] : prev.filter((x) => x !== ttxId)));
  }

  /* -------------------- Gallery helpers -------------------- */
  function removeGalleryItem(idx: number) {
    setGallery((prev) => prev.filter((_, i) => i !== idx));
  }
  function moveGalleryItem(idx: number, dir: -1 | 1) {
    setGallery((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }

  // Title → auto-slug (only if not customized)
  const handleTitleChange = (newTitle: string) => {
    const prevAuto = slugify(title, { keepUnicode: false });
    setTitle(newTitle);
    if (!slug || slug === prevAuto) {
      setSlug(slugify(newTitle, { keepUnicode: false }));
    }
  };

  /* -------------------- AUTOSAVE (NEW) --------------------
   * Hook (useAutoDraft) has default ~25s debounce.
   * It won't trigger until payload has something (hasTyped).
   */
  const hasTyped =
    !!title.trim() ||
    !!content.trim() ||
    !!excerpt.trim() ||
    !!subtitle.trim() ||
    !!highlight.trim() ||
    (tagNames && tagNames.length > 0) ||
    (gallery && gallery.length > 0);

  const { state: autoState, lastSavedAt } = useAutoDraft({
    mode: "new",
    storageKey: "autosave:new-post",
    buildPayload: () => buildPayload("draft"),
    createDraft: async (payload) => {
      const j = await createPost(payload); // POST
      return { id: j.id }; // hook will keep server id internally
    },
    updateDraft: async (id, payload) => {
      // subsequent autosaves → PATCH as draft
      await fetch(`/api/r2/posts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, status: "draft" }),
      });
    },
    // Anything that should trigger an autosave when changed:
    deps: [
      hasTyped,
      title,
      slug,
      content,
      excerpt,
      subtitle,
      highlight,
      format,
      videoEmbed,
      JSON.stringify(tagNames),
      JSON.stringify(selectedCats),
      JSON.stringify(gallery),
      scheduleEnabled,
      scheduleAt,
    ],
  });

  const autoLabel =
    autoState === "saving"
      ? "Autosaving…"
      : autoState === "offline"
      ? "Offline — locally saved"
      : autoState === "error"
      ? "Autosave failed"
      : lastSavedAt
      ? `Autosaved ${lastSavedAt.toLocaleTimeString()}`
      : "";

  /* -------------------- UI -------------------- */
  if (loading) {
    return (
      <div className="container dashboardContainer">
        <div style={{ textAlign: "center", padding: "40px" }}>
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  const primaryBtnLabel = canPublishNow
    ? (scheduleEnabled && isFuture ? "Schedule" : "Publish")
    : "Submit";

  return (
    <div className={styles.dashboardContainer}>
      <form onSubmit={onSubmit}>
        <div className={styles.headerRow}>
          <h2 className={styles.pageTitle}>Add New Post</h2>
          <small className="dim">{autoLabel}</small>
        </div>

        <div className={styles.grid}>
          {/* Main Content */}
          <div className={styles.mainCol}>
            {/* Title */}
            <div className={styles.field}>
              <label className="label">Title *</label>
              <input
                className={`input ${styles.input}`}
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Enter title here"
                required
              />
            </div>

            {/* Slug */}
            <div className={styles.field}>
              <label className="label">Slug</label>
              <input
                className={`input ${styles.input}`}
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="auto from title"
              />
              <small className={styles.helper}>
                Preview: <code>{effectiveSlug}</code>
              </small>
            </div>

            {/* Subtitle / Highlight */}
            <div className={styles.field}>
              <label className="label">Subtitle</label>
              <input
                className={`input ${styles.input}`}
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Subtitle (optional)"
              />
            </div>

            <div className={styles.field}>
              <label className="label">Highlight / Tagline</label>
              <input
                className={`input ${styles.input}`}
                value={highlight}
                onChange={(e) => setHighlight(e.target.value)}
                placeholder="Highlight / Tagline (optional)"
              />
            </div>

            {/* Content Editor */}
            <div className={styles.field}>
              <label className="label">
                Content {canPublishNow ? "*" : "(optional for pending)"}
              </label>
              <TinyEditor value={content} onChange={setContent} />
            </div>

            {/* Excerpt */}
            <details className={styles.details}>
              <summary className={styles.detailsSummary}>Excerpt</summary>
              <div className={styles.detailsBody}>
                <textarea
                  className={`textarea ${styles.textarea}`}
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  rows={4}
                  placeholder="Optional excerpt..."
                />
              </div>
            </details>

            {/* Format */}
            <div className={`card ${styles.card}`}>
              <div className={`card-hd ${styles.cardHd}`}>Format</div>
              <div className={`card-bd ${styles.cardBd}`}>
                <div className={styles.chipRow}>
                  {(["standard", "gallery", "video"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      className={`${styles.chip} ${format === f ? styles.chipActive : ""}`}
                      onClick={() => setFormat(f)}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>

                {format === "gallery" && (
                  <div>
                    <div className={styles.rowBetween}>
                      <strong>Gallery Images</strong>
                      <button
                        type="button"
                        className={`btn-ghost ${styles.ghost}`}
                        onClick={() => setGalleryPickerOpen(true)}
                      >
                        Choose Image
                      </button>
                    </div>

                    {!gallery.length ? (
                      <small className={styles.muted}>No images selected</small>
                    ) : (
                      <div className={styles.galleryGrid}>
                        {gallery.map((g, i) => (
                          <div key={`${g.id}-${i}`} className={styles.galleryItem}>
                            {g.url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={g.url} alt="" className={styles.galleryThumb} />
                            ) : (
                              <div className={styles.galleryPlaceholder}>#{g.id}</div>
                            )}
                            <div className={styles.galleryActions}>
                              <button
                                type="button"
                                className={`btn-ghost ${styles.ghost}`}
                                onClick={() => moveGalleryItem(i, -1)}
                                disabled={i === 0}
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                className={`btn-ghost ${styles.ghost}`}
                                onClick={() => moveGalleryItem(i, 1)}
                                disabled={i === gallery.length - 1}
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                className={`btn-ghost ${styles.remove}`}
                                onClick={() => removeGalleryItem(i)}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {format === "video" && (
                  <div className={styles.field}>
                    <label className="label">Video URL or Embed Code *</label>
                    <textarea
                      className={`textarea ${styles.textarea}`}
                      rows={4}
                      value={videoEmbed}
                      onChange={(e) => setVideoEmbed(e.target.value)}
                      placeholder="https://youtu.be/... or <iframe ...></iframe>"
                      required
                    />
                    <small className={styles.muted}>Required for video format</small>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <aside className={styles.sidebar}>
            {/* Publish box */}
            <div className={`card ${styles.card}`}>
              <div className={`card-hd ${styles.cardHd}`}>Publish</div>
              <div className={`card-bd ${styles.cardBdCol}`}>
                {/* status dropdown */}
                <label className={styles.field}>
                  <span className="label">Status</span>
                  <select
                    className={`select ${styles.input}`}
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                  >
                    <option value="draft">Draft</option>
                    <option value="pending">Pending Review</option>
                    <option value="publish">Publish</option>
                  </select>
                </label>

                {/* schedule toggle + field */}
                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={scheduleEnabled}
                    onChange={(e) => setScheduleEnabled(e.target.checked)}
                    disabled={!canPublishNow}
                    title={!canPublishNow ? "Only editors/admins can schedule" : undefined}
                  />
                  <span>Schedule this post</span>
                </label>

                {scheduleEnabled && canPublishNow && (
                  <label className={styles.field}>
                    <span className="label">Publish on</span>
                    <input
                      type="datetime-local"
                      className={`input ${styles.input}`}
                      value={scheduleAt}
                      onChange={(e) => setScheduleAt(e.target.value)}
                    />
                    {scheduleAt && (
                      <small className={styles.muted}>
                        {isFuture ? "Will schedule at " : "Will set date "}
                        {scheduleDisplay}
                      </small>
                    )}
                  </label>
                )}

                {/* action buttons */}
                <div className={styles.actionsRow}>
                  <button
                    className={`btn-ghost ${styles.ghost}`}
                    onClick={onSaveDraft}
                    disabled={saving}
                    type="button"
                  >
                    {saving ? "Saving…" : "Save Draft"}
                  </button>
                  <button
                    className={`btn ${styles.primary}`}
                    onClick={onPrimaryAction}
                    disabled={saving}
                    type="button"
                  >
                    {saving
                      ? canPublishNow
                        ? "Processing…"
                        : "Submitting…"
                      : primaryBtnLabel}
                  </button>
                </div>
              </div>
            </div>

            {/* Categories */}
            <div className={`card ${styles.card}`}>
              <div className={`card-hd ${styles.cardHd} ${styles.rowBetween}`}>
                <span className={styles.flexGrow}>Categories</span>
                <input
                  value={catQ}
                  onChange={(e) => setCatQ(e.target.value)}
                  placeholder="Search…"
                  className={`input ${styles.inputSm}`}
                  aria-label="Search categories"
                />
              </div>
              <div className={`card-bd ${styles.catList}`}>
                {filteredCatOptions.map((opt) => (
                  <label key={opt.id} className={styles.catItem} title={opt.name}>
                    <input
                      type="checkbox"
                      checked={selectedCats.includes(opt.id)}
                      onChange={(e) => toggleCat(opt.id, e.target.checked)}
                    />
                    <span className={styles.catLabel} style={{ paddingLeft: Math.min(opt.depth * 12, 48) }} >
                      {opt.label}
                    </span>
                  </label>
                ))}
                {!filteredCatOptions.length && (
                  <div className={styles.mutedCenter}>No categories found.</div>
                )}
              </div>
              {defaultCatId && (
                <small className={styles.cardFoot}>
                  Default category: Others (ID {defaultCatId})
                </small>
              )}
            </div>

            {/* Authors */}
            <div className={`card ${styles.card}`}>
              <div className={`card-hd ${styles.cardHd}`}>Authors</div>
              <div className={`card-bd ${styles.cardBdCol}`}>
                <small className={styles.muted}>
                  Pick an author; otherwise current user will be used.
                </small>
                <AuthorPicker value={selectedAuthor} onChange={setSelectedAuthor} />
              </div>
            </div>

            {/* Tags */}
            <div className={`card ${styles.card}`}>
              <TagPicker value={tagNames} onChange={setTagNames} />
            </div>

            {/* Featured image */}
            <div className={`card ${styles.card}`}>
              <div className={`card-hd ${styles.cardHd}`}>Featured image</div>
              <div className={`card-bd ${styles.cardBdCol}`}>
                {featured ? (
                  <>
                    <div className={styles.featuredWrap}>
                      <Image
                        src={featured.url}
                        alt="Featured"
                        width={300}
                        height={169}
                        className={styles.featuredImg}
                        priority
                      />
                    </div>
                    <div className={styles.actionsRow}>
                      <button
                        type="button"
                        className={`btn-ghost ${styles.ghost}`}
                        onClick={() => setPickerOpen(true)}
                      >
                        Change
                      </button>
                      <button
                        type="button"
                        className={`btn-ghost ${styles.dangerGhost}`}
                        onClick={() => (window as any).confirm && (/* no-op for type */ 0)}
                      >
                        Remove
                      </button>
                    </div>
                    <small className={styles.mutedCenter}>ID: {featured.id}</small>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className={`btn-ghost ${styles.selectBox}`}
                      onClick={() => setPickerOpen(true)}
                    >
                      Choose Image
                    </button>
                    <small className={styles.mutedCenter}>No image selected</small>
                  </>
                )}
              </div>
            </div>
          </aside>
        </div>

        {/* Pickers */} <MediaPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={(m) => { setFeatured({ id: m.ID, url: m.guid }); setPickerOpen(false); }} imagesOnly /> <MediaPicker open={galleryPickerOpen} onClose={() => setGalleryPickerOpen(false)} onSelect={(m) => { setGallery((prev) => [...prev, { id: m.ID, url: m.guid }]); setGalleryPickerOpen(false); }} imagesOnly />
      </form>
    </div>
  );
}
