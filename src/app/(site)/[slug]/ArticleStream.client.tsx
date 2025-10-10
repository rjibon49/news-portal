// // src/app/(site)/[slug]/ArticleStream.client.tsx
// "use client";

// import { useRef, useCallback, useEffect, useState } from "react";
// import Link from "next/link";
// import Image from "next/image";
// import styles from "./post.module.css";

// import FeaturedMedia from "@/components/ui/FeaturedMedia/FeaturedMedia";
// import SanitizedHtml from "@/components/Html/SanitizedHtml";
// import { formatBanglaDateTime } from "@/utils/dateFormatter";
// import { extractYouTubeFromHtml, toYouTubeThumb, toYouTubeEmbed } from "@/utils/video";
// // ⚠️ তোমার ফোল্ডারটির নাম 'SocilaIcon' ছিল — তাই একইটাই ব্যবহার করলাম:
// import ShareIcons from "@/components/ui/SocialIcon/ShareIcons";

// type Article = {
//   id: number;
//   slug: string;
//   title: string;
//   excerpt?: string;
//   contentHtml?: string;
//   imageUrl?: string | null;
//   publishedAt?: string | null;
//   updatedAt?: string | null;

//   authorId?: number | null;
//   authorName?: string | null;
//   authorSlug?: string | null;
//   authorAvatarUrl?: string | null;

//   categories?: Array<{ id?: number; slug: string; name: string }>;
//   tags?: Array<{ id?: number; slug: string; name: string }>;

//   subtitle?: string | null;
//   highlight?: string | null;
//   format?: "standard" | "gallery" | "video";
//   gallery?: Array<{ id: number; url?: string }>;
//   videoUrl?: string | null;
// };

// type Props = {
//   first: Article;
//   siteUrl: string;
//   maxCount?: number;
// };

// export default function ArticleStream({ first, siteUrl, maxCount = 3 }: Props) {
//   const [items, setItems] = useState<Article[]>([first]);
//   const [loading, setLoading] = useState(false);
//   const [done, setDone] = useState(false);

//   const refs = useRef<Record<number, HTMLElement | null>>({});
//   const setNodeRef = useCallback(
//     (id: number) => (el: HTMLElement | null) => {
//       refs.current[id] = el;
//     },
//     []
//   );

//   const sentinelRef = useRef<HTMLDivElement | null>(null);
//   const currentSlugRef = useRef<string>(first.slug);

//   // পরের (older) পোস্ট আনুন — তোমার API থাকলে এখানে হিট দাও
//   const loadNext = useCallback(async () => {
//     if (loading || done) return;
//     if (items.length >= maxCount) {
//       setDone(true);
//       return;
//     }

//     setLoading(true);
//     try {
//       const fromId = items[items.length - 1].id;
//       // এখানে তোমার নিজের next API দিও (না থাকলে পরে ইমপ্লিমেন্ট করবে)
//       const res = await fetch(`/api/articles/next?from=${fromId}`, {
//         cache: "no-store",
//       });
//       const json = await res.json().catch(() => null);
//       const next: Article | null = json?.item ?? null;
//       if (!next) {
//         setDone(true);
//         return;
//       }
//       setItems((prev) => [...prev, next]);
//     } finally {
//       setLoading(false);
//     }
//   }, [items, loading, done, maxCount]);

//   // sentinel viewport-এ এলে পরেরটা লোড
//   useEffect(() => {
//     const el = sentinelRef.current;
//     if (!el) return;
//     const io = new IntersectionObserver(
//       (ents) => ents.forEach((e) => e.isIntersecting && loadNext()),
//       { rootMargin: "600px 0px 600px 0px" }
//     );
//     io.observe(el);
//     return () => io.disconnect();
//   }, [loadNext, items.length]);

//   // কোন আর্টিকেল ~30%+ দৃশ্যমান ⇒ URL replace
//   useEffect(() => {
//     const elements = items.map((a) => refs.current[a.id]).filter(Boolean) as HTMLElement[];
//     if (!elements.length) return;

//     const io = new IntersectionObserver(
//       (entries) => {
//         const best = entries
//           .filter((e) => e.isIntersecting)
//           .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
//         if (best) {
//           const id = Number(best.target.getAttribute("data-article-id"));
//           const item = items.find((x) => x.id === id);
//           if (item && currentSlugRef.current !== item.slug) {
//             currentSlugRef.current = item.slug;
//             window.history.replaceState(null, "", `/${item.slug}`);
//           }
//         }
//       },
//       { threshold: [0.3] }
//     );

//     elements.forEach((el) => io.observe(el));
//     return () => io.disconnect();
//   }, [items]);

//   const renderOne = (post: Article, idx: number) => {
//     // ভিডিও/গ্যালারি হ্যান্ডলিং
//     const rawVideo =
//       post.videoUrl || extractYouTubeFromHtml(post.contentHtml) || null;
//     const coverImage =
//       post.imageUrl ?? toYouTubeThumb(rawVideo, "hq") ?? "/placeholder-16x9.jpg";
//     const embedUrl = post.format === "video" ? toYouTubeEmbed(rawVideo, true) : null;

//     return (
//       <div key={post.id}>
//         {idx > 0 && <hr className={styles.divider} aria-hidden />}

//         <article
//           data-article-id={post.id}
//           ref={setNodeRef(post.id)}
//           className={`${styles.article} content`}
//         >
//           {/* Title */}
//           <h1
//             className={styles.title}
//             dangerouslySetInnerHTML={{ __html: post.title }}
//           />

//           {/* highlight/subtitle থাকলে দেখাও */}
//           {post.highlight && <div className={styles.highlight}>{post.highlight}</div>}
//           {post.subtitle && <p className={styles.subtitle}>{post.subtitle}</p>}

//           {/* Meta */}
//           <div className={styles.meta}>
//             <div className={styles.metaLeft}>
//               {post.authorName && (
//                 <Link
//                   href={`/author/${post.authorSlug || post.authorId}`}
//                   className={styles.author}
//                   aria-label={post.authorName}
//                 >
//                   {post.authorAvatarUrl && (
//                     <Image
//                       src={post.authorAvatarUrl}
//                       alt={post.authorName}
//                       width={28}
//                       height={28}
//                       className={styles.authorAvatar}
//                       unoptimized
//                     />
//                   )}
//                   <span className={styles.authorName}>{post.authorName}</span>
//                 </Link>
//               )}

//               {post.publishedAt && (
//                 <span className={styles.dateWrap}>
//                   <span className={styles.metaIcon} aria-hidden>
//                     <svg viewBox="0 0 24 24">
//                       <path d="M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7zm12 7H5v10h14V9z" />
//                     </svg>
//                   </span>
//                   <time dateTime={post.publishedAt} className={styles.date}>
//                     {formatBanglaDateTime(post.publishedAt)}
//                   </time>
//                 </span>
//               )}

//               {!!post.categories?.length && (
//                 <span className={styles.cats}>
//                   {post.categories.map((c) => (
//                     <Link key={c.slug} href={`/category/${c.slug}`} className={styles.cat}>
//                       {c.name}
//                     </Link>
//                   ))}
//                 </span>
//               )}
//             </div>

//             <ShareIcons
//               className={styles.metaShare}
//               title={post.title.replace(/<[^>]*>/g, "")}
//               absUrl={`${siteUrl}/${post.slug}`}
//             />
//           </div>

//           {/* Featured media: video হলে এমবেড, নাহলে ছবি */}
//           <FeaturedMedia
//             imageUrl={coverImage}
//             imageAlt={post.title.replace(/<[^>]*>/g, "")}
//             ratio="16/9"
//             videoUrl={embedUrl || undefined}
//           />

//           {/* Content */}
//           <SanitizedHtml html={post.contentHtml} className={styles.entry} runScripts="safe" />

//           {/* Gallery format হলে (author যদি gallery পাঠায়) */}
//           {post.format === "gallery" && Array.isArray(post.gallery) && post.gallery.length > 0 && (
//             <div className={styles.galleryGrid}>
//               {post.gallery.map((g) => (
//                 <figure key={g.id} className={styles.galleryItem}>
//                   <Image
//                     src={g.url || "/placeholder-16x9.jpg"}
//                     alt=""
//                     width={640}
//                     height={360}
//                     className={styles.galleryImg}
//                     unoptimized
//                   />
//                 </figure>
//               ))}
//             </div>
//           )}

//           {/* Tags */}
//           {!!post.tags?.length && (
//             <div className={styles.tags}>
//               {post.tags.map((t) => (
//                 <Link key={t.slug} href={`/tag/${t.slug}`} className={styles.tag}>
//                   #{t.name}
//                 </Link>
//               ))}
//             </div>
//           )}
//         </article>
//       </div>
//     );
//   };

//   return (
//     <>
//       {items.map((p, i) => renderOne(p, i))}
//       {!done && <div ref={sentinelRef} style={{ height: 1 }} />}
//       {loading && <p className={styles.loadBadge}>লোড হচ্ছে…</p>}
//     </>
//   );
// }
