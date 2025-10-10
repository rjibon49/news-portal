// Basic shared types for posts

export type PostListRow = {
  ID: number;
  post_title: string;
  post_date: string;
  post_modified: string;
  post_status: string;
  post_author: number;
  author_name: string | null;
  categories: string | null;
  tags: string | null;
  slug?: string | null;
};

export type ListPostsResult = {
  rows: PostListRow[];
  total: number;
  page: number;
  perPage: number;
};

export type PostDetail = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  date: string;
  updatedAt: string;
  category: string | null;
  author: { id: number; name: string } | null;
  image?: { src: string; alt: string } | null;
  tags: string | null;
  status: string;
};
