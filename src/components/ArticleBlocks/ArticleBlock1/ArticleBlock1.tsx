//src/components/ArticleBlocks/ArticleBlock1.tsx

import Link from "next/link";
import styles from "./ArticleBlock1.module.css";
import { Thumb } from "@/components/news/Thumb";
import { displayDate, truncate } from "@/components/news/utils";
import type { NewsItem, NewsBlockProps } from "@/components/news/types";
import SectionHeading, { HeadingVariant } from "@/components/ui/Heading/SectionHeading";
import Pagination, { PaginationMode } from "@/components/ui/Pagination/Pagination";

/** Center overlays (pure icon, no video/iframe) */
function PlayOverlay() {
  return (
    <span className={styles.centerOverlay} aria-label="ভিডিও">
      <span className={styles.centerBubble}>
        <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.centerIcon}>
          <polygon points="9,7 19,12 9,17" />
        </svg>
      </span>
    </span>
  );
}
function GalleryOverlay() {
  return (
    <span className={styles.centerOverlay} aria-label="গ্যালারী">
      <span className={styles.centerBubble}>
        <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.centerIcon}>
          <path d="M4 6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-2H4a2 2 0 0 1-2-2V6zm3 1v11h12V10h-2v7H7V7z" />
        </svg>
      </span>
    </span>
  );
}

/** 🔹 Pagination props (optional) — spread করে Pagination-এ যাবে */
type PaginationControls = {
  visible?: boolean;
  /** NEW: JNews-like mode */
  mode?: PaginationMode; // "none" | "next-prev" | "load-more" | "infinite" | "numbers"

  currentPage: number; // 1-based
  totalPages: number;
  onPageChange: (page: number) => void;

  windowSize?: number;

  onLoadMore?: () => void;
  loading?: boolean;
  autoLoad?: boolean;          // (kept for compatibility; use mode="infinite")
  autoLoadOffset?: number;

  labels?: { prev?: string; next?: string; more?: string };
  className?: string;

  variant?: "classic" | "pill" | "minimal" | "ghost";
  size?: "sm" | "md" | "lg";
  hideNumbers?: boolean; // only for mode="numbers"
};

type Props = NewsBlockProps<NewsItem> & {
  showCategory?: boolean;
  maxTitleChars?: number;
  maxExcerptChars?: number;
  /** @deprecated use `relativeDates` instead */
  showRelative?: boolean;

  /** 🔹 Heading customization */
  headingVariant?: HeadingVariant;
  headingColor?: string;
  headingBg?: string;
  headingAlign?: "left" | "center" | "right";
  headingFontSize?: string | number;
  headingWidth?: string | number;
  headingHref?: string;

  /** 🔹 Optional pagination control (pass করলে তবেই দেখাবে) */
  pagination?: PaginationControls;
};

export default function ArticleBlock1({
  items,
  listCount = 5,
  title,
  showDates = true,
  relativeDates,
  showExcerpt = false,
  showCategory = true,
  maxTitleChars,
  maxExcerptChars = 140,
  fallbackImage,
  className,
  showRelative,

  // heading props
  headingVariant = 1,
  headingColor,
  headingBg,
  headingAlign = "left",
  headingFontSize,
  headingWidth = "100%",
  headingHref,

  // pagination (optional)
  pagination,
}: Props) {
  if (!items?.length) return null;

  const useRelative = (relativeDates ?? showRelative) ?? false;

  const [lead, ...rest] = items;
  const list = rest.slice(0, listCount);

  const leadImg = lead.imageUrl || fallbackImage;
  const leadShowPlay = !!lead.isVideo;
  const leadShowGallery = !leadShowPlay && !!lead.isGallery;

  return (
    <section className={`${styles.block} ${className || ""}`}>
      {title && (
        <SectionHeading
          title={title}
          variant={headingVariant}
          color={headingColor}
          bg={headingBg}
          align={headingAlign}
          fontSize={headingFontSize}
          width={headingWidth}
          href={headingHref}
        />
      )}

      <div className={styles.grid}>
        {/* Lead card (left) */}
        <article className={styles.lead}>
          {leadImg && (
            <div className={styles.leadMedia}>
              {leadShowPlay && <PlayOverlay />}
              {leadShowGallery && <GalleryOverlay />}
              <Thumb
                src={leadImg}
                alt={lead.title}
                sizes="(min-width:1100px) 700px, (min-width:768px) 60vw, 100vw"
                className={styles.img}
              />
            </div>
          )}

          <div className={styles.leadBody}>
            {showCategory && lead.categoryName && (
              <span className={styles.pill}>{lead.categoryName}</span>
            )}
            {lead.highlight && (
              <span className={styles.highlight}>{lead.highlight}</span>
            )}

            <Link href={`/${lead.slug}`} className={styles.leadTitle}>
              {truncate(lead.title, maxTitleChars)}
            </Link>

            {showExcerpt && lead.excerpt && (
              <p className={styles.leadExcerpt}>
                {truncate(lead.excerpt, maxExcerptChars)}
              </p>
            )}

            {showDates && lead.publishedAt && (
              <time className={styles.date} dateTime={lead.publishedAt}>
                {displayDate(lead.publishedAt, useRelative)}
              </time>
            )}
          </div>
        </article>

        {/* List (right) */}
        <ul className={styles.list} role="list">
          {list.map((item) => {
            const img = item.imageUrl || fallbackImage;
            const showPlay = !!item.isVideo;
            const showGallery = !showPlay && !!item.isGallery;

            return (
              <li key={item.id} className={styles.listItem}>
                <Link href={`/${item.slug}`} className={styles.itemLink} aria-label={item.title}>
                  {img && (
                    <span className={styles.thumb}>
                      {showPlay && <PlayOverlay />}
                      {showGallery && <GalleryOverlay />}
                      <Thumb src={img} alt="" sizes="120px" className={styles.img} />
                    </span>
                  )}

                  <span className={styles.meta}>
                    {showCategory && item.categoryName && (
                      <span className={styles.pillSmall}>{item.categoryName}</span>
                    )}
                    <span className={styles.itemTitle}>
                      {truncate(item.title, maxTitleChars)}
                    </span>
                    {showDates && item.publishedAt && (
                      <time className={styles.itemDate} dateTime={item.publishedAt}>
                        {displayDate(item.publishedAt, useRelative)}
                      </time>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* 🔹 Optional Pagination (only renders if `pagination` prop provided) */}
      
      {pagination?.visible && pagination.totalPages > 1 && (
        <Pagination
          visible={pagination.visible}
          mode={pagination.mode ?? (pagination.autoLoad ? "infinite" : "numbers")}
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          onPageChange={pagination.onPageChange}
          windowSize={pagination.windowSize}
          onLoadMore={pagination.onLoadMore}
          loading={pagination.loading}
          autoLoadOffset={pagination.autoLoadOffset}
          labels={pagination.labels}
          className={pagination.className}
          variant={pagination.variant}
          size={pagination.size}
          hideNumbers={pagination.hideNumbers}
        />
      )}
    </section>
  );
}
