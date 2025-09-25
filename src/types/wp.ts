// src/types/wp.ts

export interface WPUser {
  ID: number;
  user_login: string;
  user_pass: string;
  user_nicename: string;
  user_email: string;
  user_url: string;
  user_registered: string;
  user_activation_key: string;
  user_status: number;
  display_name: string;
}

export interface WPUserMeta {
  umeta_id: number;
  user_id: number;
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
  term_id: number;
  taxonomy: string;              // 'category' | 'post_tag' | custom
  description: string;
  parent: number;                // parent term_taxonomy_id
  count: number;
}

export interface WPTermRelationship {
  object_id: number;             // post ID
  term_taxonomy_id: number;
  term_order: number;
}

export interface WPPost {
  ID: number;
  post_author: number;
  post_date: string;
  post_date_gmt: string;
  post_content: string;
  post_title: string;
  post_excerpt: string;
  post_status: string;           // 'publish' | 'draft' | 'pending' | ...
  comment_status: string;        // 'open' | 'closed'
  ping_status: string;           // 'open' | 'closed'
  post_password: string;
  post_name: string;             // slug
  to_ping: string;
  pinged: string;
  post_modified: string;
  post_modified_gmt: string;
  post_content_filtered: string;
  post_parent: number;
  guid: string;
  menu_order: number;
  post_type: string;             // 'post' | 'page' | 'attachment' | ...
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
  autoload: string;              // 'yes'|'no'
}

// Handy DTOs used in UI/APIs
export type CategoryDTO = {
  term_taxonomy_id: number;
  term_id: number;
  name: string;
  slug: string;
  description: string;
  parent: number;
  count: number;
};
