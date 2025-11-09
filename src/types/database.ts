// src/types/database.ts

/** Core WP tables --------------------------------------------------------- */

export interface WPUser {
  ID: number;
  user_login: string;
  user_pass: string;
  user_nicename: string;
  user_email: string;
  user_url: string;
  user_registered: string;      // DATETIME string
  user_activation_key: string;
  user_status: number;
  display_name: string;         // varchar(250)
}

export interface WPUserMeta {
  umeta_id: number;
  user_id: number;              // FK -> wp_users.ID
  meta_key: string;
  meta_value: string;
}

export interface WPTerm {
  term_id: number;
  name: string;
  slug: string;
  term_group: number;
}

export interface WPTermTaxonomy {
  term_taxonomy_id: number;
  term_id: number;              // FK -> wp_terms.term_id
  taxonomy: string;             // 'category' | 'post_tag' | custom
  description: string;
  parent: number;               // bigint unsigned in DB → number here
  count: number;
}

export interface WPTermRelationship {
  object_id: number;            // post ID
  term_taxonomy_id: number;
  term_order: number;
}

export type WPPostStatus =
  | "publish"
  | "draft"
  | "pending"
  | "future"
  | "private"
  | "trash"
  | string;

export interface WPPost {
  ID: number;
  post_author: number;
  post_date: string;            // local DATETIME (as string)
  post_date_gmt: string;        // UTC DATETIME (as string)
  post_content: string;
  post_title: string;
  post_excerpt: string;
  post_status: WPPostStatus;
  comment_status: string;       // 'open' | 'closed'
  ping_status: string;          // 'open' | 'closed'
  post_password: string;
  post_name: string;            // slug
  to_ping: string;
  pinged: string;
  post_modified: string;
  post_modified_gmt: string;
  post_content_filtered: string;
  post_parent: number;
  guid: string;
  menu_order: number;
  post_type: string;            // 'post' | 'page' | 'attachment' | ...
  post_mime_type: string;
  comment_count: number;
}

export interface WPPostMeta {
  meta_id: number;
  post_id: number;
  meta_key: string | null;
  meta_value: string | null;
}

export interface WPComment {
  comment_ID: number;
  comment_post_ID: number;
  comment_author: string;
  comment_author_email: string;
  comment_author_url: string;
  comment_author_IP: string;
  comment_date: string;
  comment_date_gmt: string;
  comment_content: string;
  comment_karma: number;
  comment_approved: string;
  comment_agent: string;
  comment_type: string;
  comment_parent: number;
  user_id: number;
}

export interface WPOption {
  option_id: number;
  option_name: string;
  option_value: string;
  autoload: string;             // 'yes' | 'no'
}

/** Your custom tables ----------------------------------------------------- */

export type PostFormat = "standard" | "gallery" | "video";
export type AudioStatus = "none" | "queued" | "ready" | "error";

export interface WPPostExtra {
  post_id: number;              // PK + FK -> wp_posts.ID
  subtitle: string | null;      // varchar(255)
  highlight: string | null;     // varchar(255)
  format: PostFormat;           // enum
  gallery_json: string | null;  // LONGTEXT (JSON string)
  video_embed: string | null;   // MEDIUMTEXT
  updated_at: string;           // TIMESTAMP (as string)

  // ---- Text-to-Speech (TTS) fields ----
  audio_status: AudioStatus;          // enum, default 'none'
  audio_url: string | null;           // CDN/URL or NULL
  audio_lang: string | null;          // 'en', 'bn', etc. or NULL
  audio_chars: number | null;         // char count used to generate
  audio_duration_sec: number | null;  // duration in seconds
  audio_updated_at: string | null;    // TIMESTAMP (as string) or NULL
}

export interface WPPostGallery {
  id: number;                   // PK
  post_id: number;              // FK -> wp_posts.ID
  media_id: number;             // attachment ID (if you use)
  sort_order: number;           // int
}

export interface WPPostEditLog {
  id: number;
  post_id: number;
  editor_id: number;
  edited_at: string;

  title: string | null;
  content: string | null;
  excerpt: string | null;
  status: string | null;
  slug: string | null;
  post_date: string | null;
  post_modified: string | null;

  featured_image_id: number | null;
  scheduled_at: string | null;

  categories_json: string | null; // JSON string
  tags_json: string | null;       // JSON string
  extra_json: string | null;      // JSON string
  meta_json: string | null;       // JSON string
  snapshot_hash: string;
}

/** Handy DTOs used in UI/APIs ------------------------------------------- */

export type CategoryDTO = {
  term_taxonomy_id: number;
  term_id: number;
  name: string;
  slug: string;
  description: string;
  parent: number;                // parent tt_id
  count: number;
};

/** Optional convenience DTOs (useful in repos) --------------------------- */
export type PostAudioDTO = Pick<
  WPPostExtra,
  | "audio_status"
  | "audio_url"
  | "audio_lang"
  | "audio_chars"
  | "audio_duration_sec"
  | "audio_updated_at"
> & { post_id: number };

export type PostExtraDTO = Pick<
  WPPostExtra,
  | "subtitle"
  | "highlight"
  | "format"
  | "gallery_json"
  | "video_embed"
> & { post_id: number };
