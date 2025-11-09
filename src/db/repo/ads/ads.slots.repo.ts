// src/db/repo/ads/ads.slots.repo.ts

import { query } from "@/db/mysql";
import type { AdSlot, CreateAdSlot, UpdateAdSlot } from "@/db/types/ads";

const isOn = (v: unknown) => v === 1 || v === true || v === "1";

/* -------------------------- Read -------------------------- */
export async function getSlotByIdRepo(id: number): Promise<AdSlot | null> {
  const rows = await query<AdSlot>(`
    SELECT id, slot_key, name, enabled, max_ads, created_at, updated_at
    FROM wp_ad_slot
    WHERE id = ?
    LIMIT 1
  `, [id]);
  return rows[0] ?? null;
}

export async function getSlotByKeyRepo(slotKey: string): Promise<AdSlot | null> {
  const rows = await query<AdSlot>(`
    SELECT id, slot_key, name, enabled, max_ads, created_at, updated_at
    FROM wp_ad_slot
    WHERE slot_key = ?
    LIMIT 1
  `, [slotKey]);
  return rows[0] ?? null;
}

export async function listSlotsRepo(): Promise<AdSlot[]> {
  return query<AdSlot>(`
    SELECT id, slot_key, name, enabled, max_ads, created_at, updated_at
    FROM wp_ad_slot
    ORDER BY id DESC
  `);
}

/* -------------------------- Write ------------------------- */
export async function createSlotRepo(data: CreateAdSlot): Promise<AdSlot> {
  const { slot_key, name, enabled, max_ads } = data;
  const res = await query<{ insertId: number }>(`
    INSERT INTO wp_ad_slot (slot_key, name, enabled, max_ads, created_at, updated_at)
    VALUES (?, ?, ?, ?, NOW(), NOW())
  `, [
    slot_key,
    name,
    isOn(enabled) ? 1 : 0,
    max_ads ?? null
  ]) as any;

  const id = (res as any).insertId;
  const slot = await getSlotByIdRepo(id);
  if (!slot) throw new Error("Failed to create slot");
  return slot;
}

export async function updateSlotRepo(id: number, data: UpdateAdSlot): Promise<AdSlot> {
  const prev = await getSlotByIdRepo(id);
  if (!prev) throw new Error("Slot not found");

  const next = {
    slot_key: data.slot_key ?? prev.slot_key,
    name: data.name ?? prev.name,
    enabled: data.enabled ?? prev.enabled,
    max_ads: data.max_ads ?? prev.max_ads,
  };

  await query(`
    UPDATE wp_ad_slot
    SET slot_key=?, name=?, enabled=?, max_ads=?, updated_at=NOW()
    WHERE id=?
  `, [
    next.slot_key,
    next.name,
    isOn(next.enabled) ? 1 : 0,
    next.max_ads,
    id
  ]);

  const updated = await getSlotByIdRepo(id);
  if (!updated) throw new Error("Update failed");
  return updated;
}

export async function deleteSlotRepo(id: number): Promise<void> {
  await query(`DELETE FROM wp_ad_slot WHERE id=?`, [id]);
}