// -----------------------------------------------------------------------------
// Clean 4-item list block (thumb + title + meta + optional excerpt)
// Works with your project's NewsItem/Thumb/displayDate/SectionHeading
// -----------------------------------------------------------------------------

import Link from "next/link";
import styles from "./ArticleBlock14.module.css";

import { Thumb } from "@/components/news/Thumb";
import type { NewsItem, NewsBlockProps } from "@/components/news/types";
import SectionHeading, { HeadingVariant } from "@/components/ui/Heading/SectionHeading";
import { displayDate } from "@/components/news/utils";

/** Clean WP excerpt and turn &hellip; into … */
function normalizeExcerpt(s?: string) {
  if (!s) return s;
  return s
    .replace(/\s*\[\s*&hellip;\s*\]\s*$/i, "") // remove trailing [...] from WP
    .replace(/&hellip;/gi, "…")
    .replace(/<[^>]+>/g, "") // strip html
    .trim();
}

/** Word-trim then append label (defaults: [বিস্তারিত]) */
function buildExcerptNode(opts: { raw?: string; maxWords?: number; readMoreLabel?: string }) {
  const { raw, maxWords, readMoreLabel = "[বিস্তারিত]" } = opts;
  if (!raw) return null;

  const cleaned = normalizeExcerpt(raw) ?? "";
  if (!maxWords || maxWords <= 0) return cleaned;

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return cleaned;

  const trimmed = words.slice(0, maxWords).join(" ");
  return (
    <>
      {trimmed}{" "}
      <span className={styles.readMore}>{readMoreLabel}</span>
    </>
  );
}

type Props = NewsBlockProps<NewsItem> & {
  /** কতগুলো আইটেম দেখাবে (ডিফল্ট 4) */
  listCount?: number;

  /** ইমেজ না থাকলে কোন প্লেসহোল্ডার ইউজ করবে */
  fallbackImage?: string;

  /** excerpt কনফিগ */
  maxExcerptWords?: number;
  readMoreLabel?: string;

  /** meta visibility */
  showAuthor?: boolean;

  /** SectionHeading কাস্টমাইজেশন */
  headingVariant?: HeadingVariant;
  headingColor?: string;
  headingBg?: string;
  headingAlign?: "left" | "center" | "right";
  headingFontSize?: string | number;
  headingWidth?: string | number;
  headingHref?: string;
};

export default function ArticleBlock14({
  items,
  title,
  listCount = 4,
  showExcerpt = false,
  showDates = false,
  relativeDates = false,
  showAuthor = true,
  fallbackImage = "/placeholder.jpg",
  className,

  maxExcerptWords,
  readMoreLabel = "[বিস্তারিত]",

  headingVariant,
  headingColor,
  headingBg,
  headingAlign,
  headingFontSize,
  headingWidth,
  headingHref,
}: Props) {
  if (!items?.length) return null;

  const shown = items.slice(0, listCount);

  // যদি SectionHeading এর প্রপসগুলোর যেকোনোটা দেয়া থাকে তাহলে SectionHeading রেন্ডার করবো
  const useSectionHeading =
    !!headingVariant || !!headingColor || !!headingBg || !!headingAlign ||
    !!headingFontSize || !!headingWidth || !!headingHref;

  return (
    <section className={`${styles.block} ${className || ""}`}>
      {title &&
        (useSectionHeading ? (
          <SectionHeading
            title={title}
            variant={headingVariant ?? 6}
            color={headingColor}
            bg={headingBg}
            align={headingAlign}
            fontSize={headingFontSize}
            width={headingWidth}
            href={headingHref}
          />
        ) : (
          <h2 className={styles.heading}>{title}</h2>
        ))}

      <ul className={styles.list} role="list">
        {shown.map((p) => {
          const href = `/${p.slug ?? p.id}`;
          const img = p.imageUrl || fallbackImage;
          const hasAuthor = showAuthor && !!(p as any).authorName; // authorName থাকলে
          const hasDate = showDates && !!p.publishedAt;

          return (
            <li key={p.id} className={styles.item}>
              <Link href={href} className={styles.card} aria-label={p.title}>
                {/* Thumb + format badges */}
                <div className={styles.thumbWrap}>
                  <Thumb
                    src={img}
                    alt={p.title}
                    className={styles.thumb}
                    sizes="(min-width:1024px) 220px, (min-width:768px) 34vw, 100vw"
                  />

                  {(p.isVideo || p.isGallery) && (
                    <div className={styles.badges} aria-hidden="true">
                      {p.isVideo && (
                        <span className={`${styles.badge} ${styles.badgeVideo}`} title="ভিডিও">
                          <svg viewBox="0 0 24 24" className={styles.badgeIcon}>
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </span>
                      )}
                      {p.isGallery && (
                        <span className={`${styles.badge} ${styles.badgeGallery}`} title="গ্যালারি">
                          <svg viewBox="0 0 24 24" className={styles.badgeIcon}>
                            <path d="M21 19V5a2 2 0 0 0-2-2H7v2h12v12h2zM3 7h14a2 2 0 0 1 2 2v10H5a2 2 0 0 1-2-2V7zm4 9 2.5-3.2 1.8 2.2L14 12l3 4H7z" />
                          </svg>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className={styles.content}>
                  {/* highlight/subtitle থাকলে ছোট লাইন দেখানো (তোমার extras সাপোর্ট) */}
                  {p.highlight && <span className={styles.highlight}>{p.highlight}</span>}
                  <h3 className={styles.title}>{p.title}</h3>
                  {p.subtitle && <p className={styles.subtitle}>{p.subtitle}</p>}

                  {(hasAuthor || hasDate) && (
                    <div className={styles.meta}>
                      {hasAuthor && (
                        <span className={styles.author}>
                          {(p as any).authorName}
                        </span>
                      )}
                      {hasAuthor && hasDate && <span className={styles.dot} aria-hidden>*</span>}
                      {hasDate && (
                        <time className={styles.date} dateTime={p.publishedAt!}>
                          {displayDate(p.publishedAt!, relativeDates)}
                        </time>
                      )}
                    </div>
                  )}

                  {showExcerpt && (
                    <p className={styles.excerpt}>
                      {buildExcerptNode({
                        raw: p.excerpt,
                        maxWords: maxExcerptWords,
                        readMoreLabel,
                      })}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
