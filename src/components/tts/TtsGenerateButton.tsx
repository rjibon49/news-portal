// src/components/tts/TtsGenerateButton.tsx

"use client";
import { useState } from "react";
import { toast } from "react-toastify";

export default function TtsGenerateButton({
  postId,
  slug,
  html,               // আর্টিকেল body (HTML)
  lang = "en",
}: {
  postId: number;
  slug: string;
  html: string;
  lang?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  async function run(overwrite = false) {
    try {
      setBusy(true);
      const r = await fetch("/api/r2/tts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, slug, html, lang, overwrite }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed");
      setUrl(j.url);
      toast.success(j.reused ? "Reused existing audio." : "Audio generated.");
    } catch (e: any) {
      toast.error(e?.message || "TTS failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button className="btn" disabled={busy} onClick={() => run(false)}>
        {busy ? "Generating…" : "Generate Audio"}
      </button>
      <button className="btn-ghost" disabled={busy} onClick={() => run(true)} title="Force re-generate">
        Regenerate
      </button>
      {url && (
        <a className="btn-ghost" href={url} target="_blank" rel="noopener noreferrer">
          Preview MP3
        </a>
      )}
    </div>
  );
}
