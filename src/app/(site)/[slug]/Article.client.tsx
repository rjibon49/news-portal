// src/app/(site)/[slug]/Article.client.tsx

"use client";

import { useMemo } from "react";
import Image from "next/image";
import AdSlot from "./AdSlot.client";                 // একই ফোল্ডারে থাকলে
import { useAdConfig, InlineRule } from "@/components/ads/useAdConfig";
import styles from "./post.module.css";

/* bodyHtml → <p>…</p> ব্লকে ভাঙা */
function splitHtmlIntoParagraphs(html: string): string[] {
  if (!html) return [];
  const parts = html
    .replace(/\n+/g, " ")
    .split(/<\/p>/i)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.toLowerCase().endsWith("</p>") ? s : s + "</p>"));
  return parts;
}

/* প্যারাগ্রাফগুলোর মাঝে inline ad ঢোকানো */
function renderWithInlineAds(paragraphs: string[], inlineRules: InlineRule[]) {
  const byIndex = new Map<number, InlineRule[]>();
  inlineRules.forEach((r) => {
    const key = Math.max(1, r.afterParagraph);
    const arr = byIndex.get(key) || [];
    arr.push(r);
    byIndex.set(key, arr);
  });

  const out: React.ReactNode[] = [];
  paragraphs.forEach((pHtml, idx) => {
    out.push(
      <div key={`p-${idx}`} dangerouslySetInnerHTML={{ __html: pHtml }} />
    );
    const list = byIndex.get(idx + 1);
    if (list) {
      list.forEach((r, j) =>
        out.push(<AdSlot key={`ad-${idx + 1}-${j}-${r.slotKey}`} slotKey={r.slotKey} />)
      );
    }
  });
  return out;
}

export default function ArticleClient({
  post,
}: {
  post: { slug: string; title: string; cover?: string; bodyHtml: string };
}) {
  // 1) কনফিগ (API + override)
  const { isEnabled, inlineRules } = useAdConfig(
    `/api/r2/ads/config?slug=${post.slug}`,
    {
      // override উদাহরণ: চাইলে ডিফল্ট অন রাখো
      slots: { beforeTitle: true },
      inline: [{ slotKey: "article_inline_1", afterParagraph: 2 }],
    }
  );

  // 2) প্যারাগ্রাফে ভাঙা
  const paragraphs = useMemo(
    () => splitHtmlIntoParagraphs(post.bodyHtml || ""),
    [post.bodyHtml]
  );

  return (
    <article className={styles.article}>
      {isEnabled("beforeTitle") && <AdSlot slotKey="beforeTitle" />}

      <h1 className={styles.title}>{post.title}</h1>

      {isEnabled("beforeImage") && <AdSlot slotKey="beforeImage" />}

      {!!post.cover && (
        <div className={styles.coverWrap}>
          <Image
            src={post.cover}
            alt={post.title}
            width={1200}
            height={628}
            className={styles.cover}
            priority
          />
        </div>
      )}

      {isEnabled("afterImage") && <AdSlot slotKey="afterImage" />}

      <div className={styles.content}>
        {renderWithInlineAds(paragraphs, inlineRules)}
      </div>

      {isEnabled("afterBody") && <AdSlot slotKey="afterBody" />}

      {isEnabled("afterTags") && <AdSlot slotKey="afterTags" />}
    </article>
  );
}
