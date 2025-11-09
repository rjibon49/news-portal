// src/db/repo/ads/ads.placements.repo.ts

import { query } from "@/db/mysql";
import type { AdPlacement, CreateAdPlacement, UpdateAdPlacement } from "@/db/types/ads";

const isOn = (v: unknown) => v === 1 || v === true || v === "1";

/* -------------------------- Read -------------------------- */
export async function getPlacementByIdRepo(id: number): Promise<AdPlacement | null> {
  const rows = await query<AdPlacement>(`
    SELECT id, slot_id, creative_id, weight, active_from, active_to, is_active, created_at, updated_at
    FROM wp_ad_placement
    WHERE id = ?
    LIMIT 1
  `, [id]);
  return rows[0] ?? null;
}

export async function listPlacementsRepo(slotId?: number): Promise<AdPlacement[]> {
  if (slotId) {
    return query<AdPlacement>(`
      SELECT id, slot_id, creative_id, weight, active_from, active_to, is_active, created_at, updated_at
      FROM wp_ad_placement
      WHERE slot_id = ?
      ORDER BY id DESC
    `, [slotId]);
  }
  return query<AdPlacement>(`
    SELECT id, slot_id, creative_id, weight, active_from, active_to, is_active, created_at, updated_at
    FROM wp_ad_placement
    ORDER BY id DESC
  `);
}

/* -------------------------- Write ------------------------- */
export async function createPlacementRepo(data: CreateAdPlacement): Promise<AdPlacement> {
  const { slot_id, creative_id, weight, active_from, active_to, is_active } = data;
  const res = await query<{ insertId: number }>(`
    INSERT INTO wp_ad_placement
      (slot_id, creative_id, weight, active_from, active_to, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
  `, [
    slot_id,
    creative_id,
    weight ?? 0,
    active_from ?? null,
    active_to ?? null,
    isOn(is_active) ? 1 : 0
  ]) as any;

  const id = (res as any).insertId;
  const row = await getPlacementByIdRepo(id);
  if (!row) throw new Error("Failed to create placement");
  return row;
}

export async function updatePlacementRepo(id: number, data: UpdateAdPlacement): Promise<AdPlacement> {
  const prev = await getPlacementByIdRepo(id);
  if (!prev) throw new Error("Placement not found");

  const next = {
    slot_id: data.slot_id ?? prev.slot_id,
    creative_id: data.creative_id ?? prev.creative_id,
    weight: data.weight ?? prev.weight,
    active_from: data.active_from ?? prev.active_from,
    active_to: data.active_to ?? prev.active_to,
    is_active: data.is_active ?? prev.is_active,
  };

  await query(`
    UPDATE wp_ad_placement
    SET slot_id=?, creative_id=?, weight=?, active_from=?, active_to=?, is_active=?, updated_at=NOW()
    WHERE id=?
  `, [
    next.slot_id,
    next.creative_id,
    next.weight,
    next.active_from,
    next.active_to,
    isOn(next.is_active) ? 1 : 0,
    id
  ]);

  const updated = await getPlacementByIdRepo(id);
  if (!updated) throw new Error("Update failed");
  return updated;
}

export async function deletePlacementRepo(id: number): Promise<void> {
  await query(`DELETE FROM wp_ad_placement WHERE id=?`, [id]);
}
