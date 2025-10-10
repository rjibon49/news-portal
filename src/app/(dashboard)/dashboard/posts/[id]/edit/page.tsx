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
  subtitle?: string | null;
  highlight?: string | null;
  format?: "standard" | "gallery" | "video";
  gallery?: GalleryItem[] | null;
  videoEmbed?: string | null;

  // OPTIONAL: if your endpoint includes author object
  author?: {
    id?: number;
    ID?: number;
    name?: string;
    display_name?: string;
    username?: string;
    user_login?: string;
    email?: string | null;
    user_email?: string | null;
    avatar?: string | null;
    avatarUrl?: string | null;
    avatar_url?: string | null;
    slug?: string;
    user_nicename?: string;
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

type MeInfo = { id: number; role: "administrator" | "editor" | "author" | "contributor" | "subscriber"; canPublishNow: boolean };

/* ---------------------- BD time helpers ---------------------- */
function formatBDDisplay(s: string) {
  if (!s) return "";
  try {
    const d = new Date(s);
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

function nowForBDInput(): string {
  const bangladeshOffsetMs = 6 * 60 * 60 * 1000; // UTC+6
  const bd = new Date(Date.now() + bangladeshOffsetMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${bd.getUTCFullYear()}-${pad(bd.getUTCMonth() + 1)}-${pad(bd.getUTCDate())}T${pad(
    bd.getUTCHours()
  )}:${pad(bd.getUTCMinutes())}`;
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

  // Author (NEW)
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

  const effectiveSlug = useMemo(
    () =>
      (slug
        ? slugify(slug, { keepUnicode: false })
        : slugify(title, { keepUnicode: false })) || "post",
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

  /* ---------------------------- Load ---------------------------- */
  async function load() {
    setLoading(true);
    try {
      // me
      const meRes = await fetch("/api/r2/me", { cache: "no-store" });
      if (meRes.ok) setMe(await meRes.json());
      else setMe(null);

      // post
      const res = await fetch(`/api/r2/posts/${id}`, { cache: "no-store" });
      const j: Prefill = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error((j as any)?.error || "Failed to load");

      setTitle(j.title || "");
      setSlug(j.slug || "");
      const norm =
        (j.status === "trash" ? "draft" : j.status) as "publish" | "draft" | "pending" | "future";
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
        } catch {
          setFeatured({ id: j.featuredImageId });
        }
      } else {
        setFeatured(null);
      }

      setSubtitle((j.subtitle ?? "") || "");
      setHighlight((j.highlight ?? "") || "");
      setFormat(j.format || "standard");
      setGallery(Array.isArray(j.gallery) ? j.gallery : []);
      setVideoEmbed((j.videoEmbed ?? "") || "");

      // Author prefill (type-safe)
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
      } else {
        setSelectedAuthor(null);
      }

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

  useEffect(() => {
    if (id) void load();
  }, [id]);

  // When user toggles schedule ON and no value exists, seed with "now in BD"
  useEffect(() => {
    if (scheduleEnabled && !scheduleAt) setScheduleAt(nowForBDInput());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleEnabled]);

  /* ----------------------- Build payload ----------------------- */
  function buildPayload(forceStatus?: "draft" | "publish" | "pending") {
    const cleanCats = Array.from(new Set(selectedCats)).filter(
      (x) => Number.isFinite(x) && x > 0
    ) as number[];

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

    // author override (admin/editor only)
    if (canChangeAuthor && selectedAuthor?.id) {
      payload.authorId = selectedAuthor.id;
    }

    // schedule
    if (scheduleEnabled && scheduleAt) {
      const d = new Date(scheduleAt);
      if (!isNaN(d.getTime())) payload.scheduledAt = d.toISOString(); // UTC ISO
    } else {
      payload.scheduledAt = null;
    }

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
      if (!canPublish) {
        payload.scheduledAt = null;
      }

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

  if (loading) return <div className="container">Loading…</div>;
  const isInitiallyPublished = initialStatus === "publish";

  const publishBtnLabel = me?.canPublishNow
    ? scheduleEnabled && isFuture
      ? "Schedule"
      : "Publish"
    : "Pending Review";

  return (
    <div className="container dashboardContainer">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onUpdate();
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <h2>Edit Post</h2>
          <small className="dim">
            {/* simple live hint could be wired with your autosave if needed */}
          </small>
        </div>

        <label className="label">Title *</label>
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter title here"
        />

        <label className="label" style={{ marginTop: 10 }}>
          Slug
        </label>
        <input
          className="input"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="optional"
        />
        <small className="dim">
          Preview: <code>{effectiveSlug}</code>
        </small>

        <label className="label" style={{ marginTop: 10 }}>
          Subtitle
        </label>
        <input
          className="input"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          placeholder="Subtitle (optional)"
        />

        <label className="label" style={{ marginTop: 10 }}>
          Highlight / Tagline
        </label>
        <input
          className="input"
          value={highlight}
          onChange={(e) => setHighlight(e.target.value)}
          placeholder="Highlight / Tagline (optional)"
        />

        <label className="label" style={{ marginTop: 10 }}>
          Content *
        </label>
        <TinyEditor value={content} onChange={setContent} />

        <div className="card" style={{ marginTop: 12 }}>
          <div className="card-hd">Format</div>
          <div className="card-bd">
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              {(["standard", "gallery", "video"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`chip ${format === f ? "active" : ""}`}
                  onClick={() => setFormat(f)}
                >
                  {f[0].toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {format === "gallery" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <strong>Gallery Images</strong>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setGalleryPickerOpen(true)}
                  >
                    Choose Image
                  </button>
                </div>

                {!gallery.length ? (
                  <small className="dim">No images selected</small>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                      gap: 10,
                    }}
                  >
                    {gallery.map((g, i) => (
                      <div
                        key={`${g.id}-${i}`}
                        style={{
                          border: "1px solid #333",
                          borderRadius: 8,
                          overflow: "hidden",
                          background: "#222",
                        }}
                      >
                        {g.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={g.url}
                            alt=""
                            style={{ width: "100%", height: 100, objectFit: "cover", display: "block" }}
                          />
                        ) : (
                          <div
                            style={{
                              height: 100,
                              display: "grid",
                              placeItems: "center",
                              opacity: 0.6,
                            }}
                          >
                            #{g.id}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 4, padding: 6 }}>
                          <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => moveGalleryItem(i, -1)}
                            disabled={i === 0}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => moveGalleryItem(i, 1)}
                            disabled={i === gallery.length - 1}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className="btn-ghost"
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
              <div>
                <label className="label">Insert video URL or embed code</label>
                <textarea
                  className="textarea"
                  rows={4}
                  value={videoEmbed}
                  onChange={(e) => setVideoEmbed(e.target.value)}
                  placeholder="https://youtu.be/... or <iframe ...></iframe>"
                />
              </div>
            )}
          </div>
        </div>

        <details style={{ marginTop: 12 }}>
          <summary>Excerpt</summary>
          <textarea
            className="textarea"
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            rows={4}
          />
        </details>
      </form>

      <aside style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <div className="card">
          <div className="card-hd">Publish</div>
          <div className="card-bd" style={{ display: "grid", gap: 10 }}>
            <label>
              <span className="label">Status</span>
              <select
                className="select"
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
              >
                <option value="draft">Draft</option>
                <option value="pending">Pending</option>
                <option value="publish">Publish</option>
              </select>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                <span className="label">Publish on</span>
                <input
                  type="datetime-local"
                  className="input"
                  value={scheduleAt}
                  onChange={(e) => setScheduleAt(e.target.value)}
                />
                {!!scheduleAt && (
                  <small className="dim" style={{ display: "block", marginTop: 4 }}>
                    {isFuture ? "Will schedule at " : "Will set date "}
                    {formatBDDisplay(scheduleAt)}
                  </small>
                )}
              </label>
            )}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="btn-ghost" onClick={onSaveDraft} disabled={saving}>
                {saving ? "Saving…" : "Save Draft"}
              </button>
              {!isInitiallyPublished && (
                <button type="button" className="btn" onClick={onPublishNow} disabled={saving}>
                  {saving ? (me?.canPublishNow ? "Publishing…" : "Sending…") : publishBtnLabel}
                </button>
              )}
              <button type="button" className="btn" onClick={onUpdate} disabled={saving}>
                {saving ? "Updating…" : "Update"}
              </button>
            </div>
          </div>
        </div>

        {/* NEW: Authors */}
        <div className="card">
          <div className="card-hd">Authors</div>
          <div className="card-bd" style={{ display: "grid", gap: 8 }}>
            <small className="dim">
              {canChangeAuthor
                ? "Pick a different author for this post."
                : "You can’t change the author. Ask an editor/admin if needed."}
            </small>
            <div
              aria-disabled={!canChangeAuthor}
              style={{ opacity: canChangeAuthor ? 1 : 0.6, pointerEvents: canChangeAuthor ? "auto" : "none" }}
            >
              <AuthorPicker value={selectedAuthor} onChange={setSelectedAuthor} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-hd">Categories</div>
          <div className="card-bd scroll" style={{ display: "grid", gap: 6, maxHeight: 280, overflow: "auto" }}>
            {catOptions.map((opt) => (
              <label
                key={opt.id}
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  paddingLeft: opt.depth ? Math.min(opt.depth * 12, 48) : 0,
                }}
                title={opt.name}
              >
                <input
                  type="checkbox"
                  checked={selectedCats.includes(opt.id)}
                  onChange={(e) =>
                    setSelectedCats((p) => (e.target.checked ? [...p, opt.id] : p.filter((x) => x !== opt.id)))
                  }
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        <TagPicker value={tagNames} onChange={setTagNames} />

        <div className="card">
          <div className="card-hd">Featured image</div>
          <div className="card-bd" style={{ display: "grid", gap: 8 }}>
            {featured ? (
              <>
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    aspectRatio: "16 / 9",
                    border: "1px solid #333",
                    borderRadius: 8,
                    overflow: "hidden",
                    background: "#222",
                  }}
                >
                  {featured.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={featured.url}
                      alt="Featured"
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        display: "grid",
                        placeItems: "center",
                        opacity: 0.6,
                      }}
                    >
                      Preview not available
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="btn-ghost" onClick={() => setPickerOpen(true)}>
                    Change
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => setFeatured(null)}>
                    Remove
                  </button>
                </div>
              </>
            ) : (
              <>
                <button type="button" className="btn-ghost" onClick={() => setPickerOpen(true)}>
                  Choose Image
                </button>
                <small className="dim">No image selected</small>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Media Pickers */}
      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(m) => {
          setFeatured({ id: m.ID, url: m.guid });
          setPickerOpen(false);
        }}
        imagesOnly
      />
      <MediaPicker
        open={galleryPickerOpen}
        onClose={() => setGalleryPickerOpen(false)}
        onSelect={(m) => {
          setGallery((prev) => [...prev, { id: m.ID, url: m.guid }]);
          setGalleryPickerOpen(false);
        }}
        imagesOnly
      />
    </div>
  );
}
