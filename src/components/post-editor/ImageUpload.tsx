// src/components/post-editor/ImageUpload.tsx

'use client';
import { useRef, useState } from 'react';

export default function ImageUpload({
  onUploaded,
  endpoint = '/api/upload/local',
}: {
  onUploaded: (url: string) => void;
  endpoint?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;               // cache element before awaits
    const f = input.files?.[0];
    if (!f) return;

    setBusy(true);
    setErr(null);
    try {
      const form = new FormData();
      form.append('file', f);
      const res = await fetch(endpoint, { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json?.error ?? 'Upload failed');
      onUploaded(json.url);
    } catch (ex: any) {
      setErr(ex?.message ?? 'Upload failed');
    } finally {
      setBusy(false);
      // safely reset the file input
      if (input) input.value = '';
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={pick}
        disabled={busy}
      />
      {busy && <small>Uploading…</small>}
      {err && <small style={{ color: 'crimson' }}>{err}</small>}
    </div>
  );
}