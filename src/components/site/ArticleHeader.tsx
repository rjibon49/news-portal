// src/components/site/ArticleHeader.tsx
import Link from "next/link";
import Image from "next/image";
import styles from "./ArticleHeader.module.css";
import ShareIcons from "@/components/ui/SocialIcon/ShareIcons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser as faUserSolid } from "@fortawesome/free-solid-svg-icons";

function toSlug(s: string) {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

type Post = {
  title: string;
  slug: string;
  date?: string;
  author?:
    | {
        id?: number;
        name?: string;
        slug?: string;
        // API বিভিন্ন নামে পাঠাতে পারে:
        avatarUrl?: string | null;
        avatar_url?: string | null;
        avatar?: string | null;
        profile_image?: string | null;
        photoUrl?: string | null;
        photo_url?: string | null;
      }
    | null;
  authorName?: string | null;
  authorAvatarUrl?: string | null; // top-level fallback
  category?: string | null;
  image?: { src?: string; alt?: string } | null;
  imageUrl?: string | null;
};

function resolveAuthorName(post: Post) {
  return post.author?.name ?? post.authorName ?? "";
}

// ⬇️ এখানে যেকোনো নামে এলে ধরার চেষ্টা
function resolveAuthorAvatar(post: Post) {
  const a = post.author ?? {};
  return (
    a.avatarUrl ??
    a.avatar_url ??
    a.avatar ??
    a.profile_image ??
    a.photoUrl ??
    a.photo_url ??
    post.authorAvatarUrl ??
    "" // not found → empty
  );
}

function resolveAuthorSlug(post: Post, authorName: string) {
  return (
    post.author?.slug ??
    (authorName ? toSlug(authorName) : undefined) ??
    (post.author?.id ? String(post.author?.id) : undefined)
  );
}

export default function ArticleHeader({
  post,
  absUrl,
  showTitle = true,
  showImage = true,
  ratio = "16/9",
}: {
  post: Post;
  absUrl: string;
  showTitle?: boolean;
  showImage?: boolean;
  ratio?: "16/9" | "4/3" | "1/1";
}) {
  const authorName = resolveAuthorName(post);
  const authorSlug = resolveAuthorSlug(post, authorName);
  const authorHref = authorSlug ? `/author/${authorSlug}` : undefined;
  const authorAvatar = resolveAuthorAvatar(post);

  const catList = (post.category || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name) => ({ name, slug: toSlug(name) }));

  const imageUrl = post.image?.src || post.imageUrl || undefined;
  const imageAlt = post.image?.alt || post.title;

  return (
    <header className={styles.header}>
      {showTitle && <h1 className={styles.title}>{post.title}</h1>}

      <div className={styles.metaRow}>
        <div className={styles.metaLeft}>
          {authorName ? (
            <div className={styles.authorWrap}>
              {authorHref ? (
                <Link href={authorHref} className={styles.authorLink} aria-label={authorName}>
                  <Avatar avatarUrl={authorAvatar} name={authorName} />
                  <span className={styles.authorName}>{authorName}</span>
                </Link>
              ) : (
                <span className={styles.authorLink} aria-label={authorName}>
                  <Avatar avatarUrl={authorAvatar} name={authorName} />
                  <span className={styles.authorName}>{authorName}</span>
                </span>
              )}
            </div>
          ) : null}

          {!!catList.length && (
            <span className={styles.cats}>
              {catList.map((c) => (
                <Link key={c.slug} href={`/category/${c.slug}`} className={styles.cat}>
                  {c.name}
                </Link>
              ))}
            </span>
          )}

          {post.date && (
            <time className={styles.date} dateTime={post.date}>
              {post.date}
            </time>
          )}
        </div>

        <ShareIcons className={styles.share} title={post.title} absUrl={absUrl} />
      </div>

      {showImage && imageUrl && (
        <figure className={styles.figure}>
          <div className={styles.featuredBox} data-ratio={ratio}>
            <Image
              src={imageUrl}
              alt={imageAlt}
              fill
              className={styles.featuredImg}
              sizes="(min-width: 1024px) 900px, 100vw"
              unoptimized
              priority
            />
          </div>
        </figure>
      )}
    </header>
  );
}

function Avatar({ avatarUrl, name }: { avatarUrl?: string | null; name: string }) {
  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={name}
        width={28}
        height={28}
        className={styles.avatar}
        unoptimized
      />
    );
  }
  return (
    <span className={styles.avatarIcon} aria-hidden>
      <FontAwesomeIcon icon={faUserSolid} />
    </span>
  );
}
