// src/db/repo/ads/ads.creatives.repo.ts

import { query } from "@/db/mysql";
import type { AdCreative, CreateAdCreative, UpdateAdCreative } from "@/db/types/ads";

const isOn = (v: unknown) => v === 1 || v === true || v === "1";

/* -------------------------- Read -------------------------- */
export async function getCreativeByIdRepo(id: number): Promise<AdCreative | null> {
  const rows = await query<AdCreative>(`
    SELECT id, name, type, html, image_url, click_url, target_blank, weight,
           active_from, active_to, is_active, created_at, updated_at
    FROM wp_ad_creative
    WHERE id = ?
    LIMIT 1
  `, [id]);
  return rows[0] ?? null;
}

export async function listCreativesRepo(): Promise<AdCreative[]> {
  return query<AdCreative>(`
    SELECT id, name, type, html, image_url, click_url, target_blank, weight,
           active_from, active_to, is_active, created_at, updated_at
    FROM wp_ad_creative
    ORDER BY id DESC
  `);
}

/* -------------------------- Write ------------------------- */
export async function createCreativeRepo(data: CreateAdCreative): Promise<AdCreative> {
  const {
    name, type, html, image_url, click_url, target_blank,
    weight, active_from, active_to, is_active,
  } = data;

  const res = await query<{ insertId: number }>(`
    INSERT INTO wp_ad_creative (
      name, type, html, image_url, click_url, target_blank, weight,
      active_from, active_to, is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `, [
    name,
    type,
    html ?? null,
    image_url ?? null,
    click_url ?? null,
    isOn(target_blank) ? 1 : 0,
    weight ?? 0,
    active_from ?? null,
    active_to ?? null,
    isOn(is_active) ? 1 : 0,
  ]) as any;

  const id = (res as any).insertId;
  const row = await getCreativeByIdRepo(id);
  if (!row) throw new Error("Failed to create creative");
  return row;
}

export async function updateCreativeRepo(id: number, data: UpdateAdCreative): Promise<AdCreative> {
  const prev = await getCreativeByIdRepo(id);
  if (!prev) throw new Error("Creative not found");

  const next = {
    name: data.name ?? prev.name,
    type: (data.type ?? prev.type) as "html" | "image",
    html: data.html ?? prev.html,
    image_url: data.image_url ?? prev.image_url,
    click_url: data.click_url ?? prev.click_url,
    target_blank: data.target_blank ?? prev.target_blank,
    weight: data.weight ?? prev.weight,
    active_from: data.active_from ?? prev.active_from,
    active_to: data.active_to ?? prev.active_to,
    is_active: data.is_active ?? prev.is_active,
  };

  await query(`
    UPDATE wp_ad_creative
    SET name=?, type=?, html=?, image_url=?, click_url=?, target_blank=?,
        weight=?, active_from=?, active_to=?, is_active=?, updated_at=NOW()
    WHERE id=?
  `, [
    next.name,
    next.type,
    next.html,
    next.image_url,
    next.click_url,
    isOn(next.target_blank) ? 1 : 0,
    next.weight,
    next.active_from,
    next.active_to,
    isOn(next.is_active) ? 1 : 0,
    id,
  ]);

  const updated = await getCreativeByIdRepo(id);
  if (!updated) throw new Error("Update failed");
  return updated;
}

export async function deleteCreativeRepo(id: number): Promise<void> {
  await query(`DELETE FROM wp_ad_creative WHERE id=?`, [id]);
}
