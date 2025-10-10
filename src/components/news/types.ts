// src/components/news/types.ts

export type NewsItem = {
  id: number | string;
  slug: string;
  title: string;
  excerpt?: string;
  imageUrl?: string;
  categoryName?: string;
  publishedAt?: string;
  isVideo?: boolean;
  isGallery?: boolean;

  /* 👇 extras */
  subtitle?: string | null;
  highlight?: string | null;
  format?: "standard" | "gallery" | "video" | null;
  gallery?: Array<number | { id: number; url?: string }> | null;
  videoEmbed?: string | null;
};

export type NewsBlockProps<T extends NewsItem> = {
  items: T[];
  listCount?: number;
  title?: string;
  showDates?: boolean;
  /** prefer this over showRelative */
  relativeDates?: boolean;
  showExcerpt?: boolean;
  fallbackImage?: string;
  className?: string;
};
