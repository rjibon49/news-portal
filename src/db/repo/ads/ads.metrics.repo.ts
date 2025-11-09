// src/db/repo/ads/ads.metrics.repo.ts

import { query } from "@/db/mysql";
import type { AdMetricDaily } from "@/db/types/ads";

// Use the actual daily stats table in your DB
const DAILY_TABLE = "wp_ad_stats_daily";

// Get today's date in Asia/Dhaka (UTC+6, no DST)
function ymdBD(d = new Date()) {
  const bd = new Date(d.getTime() + 6 * 60 * 60 * 1000);
  const y = bd.getUTCFullYear();
  const m = String(bd.getUTCMonth() + 1).padStart(2, "0");
  const da = String(bd.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

export async function trackImpressionRepo(slotId: number, creativeId: number, ymd?: string) {
  const day = ymd || ymdBD();
  await query(
    `
    INSERT INTO ${DAILY_TABLE} (ymd, slot_id, creative_id, impressions, clicks, updated_at)
    VALUES (?, ?, ?, 1, 0, NOW())
    ON DUPLICATE KEY UPDATE impressions = impressions + 1, updated_at = NOW()
    `,
    [day, slotId, creativeId]
  );
}

export async function trackClickRepo(slotId: number, creativeId: number, ymd?: string) {
  const day = ymd || ymdBD();
  await query(
    `
    INSERT INTO ${DAILY_TABLE} (ymd, slot_id, creative_id, impressions, clicks, updated_at)
    VALUES (?, ?, ?, 0, 1, NOW())
    ON DUPLICATE KEY UPDATE clicks = clicks + 1, updated_at = NOW()
    `,
    [day, slotId, creativeId]
  );
}

export async function listMetricsRepo(params: {
  from?: string; // 'YYYY-MM-DD'
  to?: string;
  slotId?: number;
  creativeId?: number;
}): Promise<AdMetricDaily[]> {
  const conds: string[] = [];
  const args: any[] = [];

  if (params.from) { conds.push(`ymd >= ?`); args.push(params.from); }
  if (params.to) { conds.push(`ymd <= ?`); args.push(params.to); }
  if (params.slotId) { conds.push(`slot_id = ?`); args.push(params.slotId); }
  if (params.creativeId) { conds.push(`creative_id = ?`); args.push(params.creativeId); }

  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

  return query<AdMetricDaily>(
    `
    SELECT ymd, slot_id, creative_id, impressions, clicks, updated_at
    FROM ${DAILY_TABLE}
    ${where}
    ORDER BY ymd DESC, slot_id ASC, creative_id ASC
    `,
    args
  );
}
