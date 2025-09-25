// src/components/post-editor/PostEditor.tsx

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import './post-editor.css';
import ImageUpload from './ImageUpload';
import TinyEditor from "@/components/rich/TinyEditor";

type Category = { id: number; name: string; parent: number };

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

export default function PostEditor() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [content, setContent] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [status, setStatus] = useState<'draft' | 'publish' | 'pending'>('draft');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCats, setSelectedCats] = useState<number[]>([]);
  const [tags, setTags] = useState(''); // comma separated
  const [featuredImage, setFeaturedImage] = useState(''); // URL (আপনার R2 আপলোড ফ্লো পরে বসাতে পারবেন)
  const [saving, setSaving] = useState(false);

  const slug = useMemo(() => slugify(title), [title]);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/r2/category?taxonomy=category', { cache: 'no-store' });
      const json = await res.json().catch(() => []);
      // ✅ accept only arrays
      setCategories(Array.isArray(json) ? json : []);
    })();
  }, []);

  const toggleCat = (id: number) =>
    setSelectedCats((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handlePublish = async () => {
    setSaving(true);
    try {
      const payload = {
        post_title: title,
        post_content: content,
        post_excerpt: excerpt,
        post_status: status,
        post_type: 'post' as const,
        slug,
        categories: selectedCats,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        featured_image: featuredImage,
        subtitle, // চাইলে meta তে সেভ করবেন
      };
      const res = await fetch('/api/r2/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? 'Failed');
      router.push('/');
    } catch (e: any) {
      alert(e?.message ?? 'Failed to create post');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="wp-wrap">
      {/* Topbar */}
      <div className="wp-topbar">
        <div className="wp-topbar-left">Edit Post</div>
        <div className="wp-topbar-right">
          <button className="wp-btn ghost" onClick={() => router.push('/')}>Preview</button>
          <button className="wp-btn primary" onClick={handlePublish} disabled={saving}>
            {status === 'publish' ? 'Publish' : 'Save Draft'}
          </button>
        </div>
      </div>

      <div className="wp-grid">
        {/* Main column */}
        <div className="wp-main">
          <input
            className="wp-title"
            placeholder="Add title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <input
            className="wp-subtitle"
            placeholder="Enter subtitle here"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
          />

          <div className="wp-permalink">
            Permalink:&nbsp;<span>https://example.com/</span>
            <span className="slug">{slug || 'your-slug'}</span>
          </div>

          {/* ============== Text Editor ================== */}

          <TinyEditor
            value={content}
            onChange={(html) => setContent(html)}
          />

          <div className="wp-panel">
            <label>Excerpt</label>
            <textarea
              className="wp-input"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              rows={4}
              placeholder="Optional summary"
            />
          </div>
        </div>

        {/* Sidebar */}
        <aside className="wp-sidebar">
          <div className="wp-box">
            <div className="wp-box-h">Publish</div>
            <div className="wp-box-b">
              <div className="row">
                <label>Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="wp-select"
                >
                  <option value="draft">Draft</option>
                  <option value="publish">Publish</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              <button className="wp-btn primary block" onClick={handlePublish} disabled={saving}>
                {status === 'publish' ? 'Publish' : 'Save Draft'}
              </button>
            </div>
          </div>

          {/* ============== Categories ================== */}

          <div className="wp-box">
            <div className="wp-box-h">Categories</div>
            <div className="wp-box-b cat-list">
              {categories.length === 0 ? (
                <div className="muted">No categories found</div>
              ) : (
                categories.map((c) => (
                  <label key={c.id} className="cat-item">
                    <input
                      type="checkbox"
                      checked={selectedCats.includes(c.id)}
                      onChange={() => toggleCat(c.id)}
                    />
                    {c.name}
                  </label>
                ))
              )}
            </div>
          </div>

          {/* ============== Tags ================== */}

          <div className="wp-box">
            <div className="wp-box-h">Tags</div>
            <div className="wp-box-b">
              <input
                className="wp-input"
                placeholder="tag1, tag2"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
              <small>Separate tags with commas</small>
            </div>
          </div>

          {/* ============== Featured Image ================== */}
          <div className="wp-box">
            <div className="wp-box-h">Featured image</div>
            <div className="wp-box-b">
              {/* paste URL manually if you want */}
              <input
                type="text"
                className="wp-input"
                placeholder="Image URL"
                value={featuredImage}
                onChange={(e) => setFeaturedImage(e.target.value)}
              />

              {/* always show the uploader; when it finishes, set the URL */}
              <div style={{ marginTop: 8 }}>
                <ImageUpload onUploaded={(url) => setFeaturedImage(url)} />
              </div>

              {/* preview + remove button only when we have a URL */}
              {featuredImage && (
                <div className="thumb" style={{ marginTop: 10 }}>
                  <img
                    src={featuredImage}
                    alt="Featured"
                    style={{ maxWidth: '100%', borderRadius: 4, display: 'block' }}
                  />
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() => setFeaturedImage('')}
                    style={{ marginTop: 6 }}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ============== Slug ================== */}

          <div className="wp-box">
            <div className="wp-box-h">Slug</div>
            <div className="wp-box-b">
              <input className="wp-input" value={slug} readOnly />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
