// =============================================================
// Refactor: Split WordPress‑compatible Posts Repo into modules
// Target: Next.js 15 + mysql2/promise (same as your current setup)
// Paths assume: src/db/repo/posts/*
// Import style: alias @/ already configured (tsconfig paths)
// =============================================================


// -----------------------------------------------------------------------------
// FILE: src/db/repo/posts/types.ts
// -----------------------------------------------------------------------------

export type QuickStatus = "publish" | "draft" | "pending";
export type PostStatus = "publish" | "draft" | "pending" | "trash" | "future";


export type ListPostsParams = {
q?: string;
status?: "all" | PostStatus;
authorId?: number;
categoryTtxId?: number;
categorySlug?: string;
yearMonth?: string; // YYYY-MM
page?: number; // 1-based
perPage?: number; // default 20
orderBy?: "date" | "title";
order?: "asc" | "desc";
};


export type PostListRow = {
ID: number;
post_title: string;
post_date: string;
post_modified: string;
post_status: string;
post_author: number;
author_name: string | null;
categories: string | null; // CSV
tags: string | null; // CSV
};


export type ListPostsResult = {
rows: PostListRow[];
total: number;
page: number;
perPage: number;
};


export type CreatePostInput = {
authorId: number;
title: string;
content: string;
excerpt?: string;
status: "publish" | "draft" | "pending" | "future";
slug?: string;
categoryTtxIds?: number[];
tagNames?: string[];
featuredImageId?: number;


// EXTRA -> wp_post_extra
subtitle?: string;
highlight?: string;
format?: "standard" | "gallery" | "video";
gallery?: Array<number | { id: number; url?: string }>;
videoEmbed?: string;


// Optional schedule
scheduledAt?: string; // JS-parseable
};


export type CreatedPostDTO = { id: number; slug: string; status: string };


export type UpdatePostInput = {
id: number;
title?: string;
content?: string;
excerpt?: string;
status?: PostStatus; // 'trash' allowed
slug?: string;
categoryTtxIds?: number[];
tagNames?: string[];
featuredImageId?: number | null;


// EXTRA
subtitle?: string | null;
highlight?: string | null;
format?: "standard" | "gallery" | "video";
gallery?: Array<number | { id: number; url?: string }> | null;
videoEmbed?: string | null;


// schedule: null => clear, string => set
scheduledAt?: string | null;
};


export type MonthBucket = { ym: string; label: string; total: number };