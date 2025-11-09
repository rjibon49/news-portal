// src/db/types/ads.ts

// Basic TypeScript types mirroring your ads tables

export type TinyBool = 0 | 1 | boolean;

/* ----------------------- wp_ad_slot ----------------------- */
export interface AdSlot {
  id: number;
  slot_key: string;
  name: string;
  enabled: TinyBool;
  max_ads: number | null;
  created_at: string;
  updated_at: string;
}

export type CreateAdSlot = Omit<AdSlot, "id" | "created_at" | "updated_at">;
export type UpdateAdSlot = Partial<Omit<AdSlot, "id" | "created_at" | "updated_at">>;

/* --------------------- wp_ad_creative --------------------- */
export interface AdCreative {
  id: number;
  name: string;
  type: "html" | "image";
  html: string | null;
  image_url: string | null;
  click_url: string | null;
  target_blank: TinyBool;
  weight: number;
  active_from: string | null;
  active_to: string | null;
  is_active: TinyBool;
  created_at: string;
  updated_at: string;
}

export type CreateAdCreative = Omit<AdCreative, "id" | "created_at" | "updated_at">;
export type UpdateAdCreative = Partial<Omit<AdCreative, "id" | "created_at" | "updated_at">>;

/* -------------------- wp_ad_placement --------------------- */
export interface AdPlacement {
  id: number;
  slot_id: number;
  creative_id: number;
  weight: number;
  active_from: string | null;
  active_to: string | null;
  is_active: TinyBool;
  created_at: string;
  updated_at: string;
}

export type CreateAdPlacement = Omit<AdPlacement, "id" | "created_at" | "updated_at">;
export type UpdateAdPlacement = Partial<Omit<AdPlacement, "id" | "created_at" | "updated_at">>;

/* ------------------- wp_ad_metric_daily ------------------- */
export interface AdMetricDaily {
  ymd: string; // 'YYYY-MM-DD'
  slot_id: number;
  creative_id: number;
  impressions: number;
  clicks: number;
  updated_at: string;
}
