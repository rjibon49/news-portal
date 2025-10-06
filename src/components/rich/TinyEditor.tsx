// src/components/rich/TinyEditor.tsx
"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { Editor as TinyMCEEditorType } from "tinymce";

// SSR এ Tiny লোড হয় না—client-only dynamic import
const TinyEditorImpl = dynamic(
  async () => (await import("@tinymce/tinymce-react")).Editor,
  { ssr: false }
);

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  height?: number;
  id?: string;
};

export default function TinyEditor({
  value,
  onChange,
  placeholder = "Start writing…",
  id = "post-editor",
  height = 420,
}: Props) {
  const init = useMemo(
    () => ({
      height,
      resize: false,        // ইউজার ড্র্যাগ-রিসাইজ অফ
      menubar: false,
      branding: false,

      // autoresize বাদ—fixed height বজায় থাকবে
      plugins: [
        "advlist","autolink","lists","link","image","charmap","preview",
        "anchor","searchreplace","visualblocks","code","fullscreen",
        "insertdatetime","media","table","help","wordcount","directionality"
      ],

      toolbar:
        "undo redo | blocks | bold italic underline | " +
        "alignleft aligncenter alignright alignjustify | " +
        "bullist numlist outdent indent | link image table | ltr rtl | code",

      toolbar_mode: "sliding",
      placeholder: placeholder as any, // v6 placeholder সাপোর্ট করে

      content_style:
        "body{font-family:system-ui,-apple-system,Segoe UI,Roboto,'Helvetica Neue',Arial,'Noto Sans',sans-serif;font-size:14px;}",

      // ✅ আপলোড রুট統一: /api/r2/upload/local
      automatic_uploads: true,
      images_upload_handler: async (blobInfo: any): Promise<string> => {
        const form = new FormData();
        form.append("file", blobInfo.blob(), blobInfo.filename());
        const r = await fetch("/api/r2/upload/local", { method: "POST", body: form });
        const j = await r.json();
        if (!r.ok || !j.url) throw new Error(j?.error ?? "Upload failed");
        return j.url;
      },

      file_picker_types: "image",
      file_picker_callback: (callback: (url: string, opts?: { title?: string }) => void) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.onchange = async () => {
          const f = input.files?.[0];
          if (!f) return;
          const fd = new FormData();
          fd.append("file", f);
          const r = await fetch("/api/r2/upload/local", { method: "POST", body: fd });
          const j = await r.json();
          if (j?.url) callback(j.url, { title: f.name });
        };
        input.click();
      },
    }),
    [height, placeholder]
  );

  return (
    <TinyEditorImpl
      id={id}
      value={value}
      onEditorChange={(html: string, _ed?: TinyMCEEditorType) => onChange(html)}
      tinymceScriptSrc="https://cdn.jsdelivr.net/npm/tinymce@6.8.3/tinymce.min.js"
      init={init as any}
    />
  );
}
