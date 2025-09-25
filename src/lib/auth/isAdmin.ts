// src/lib/auth/isAdmin.ts

import { query } from "@/db/mysql";

function parseWpCapabilities(val?: string | null): Record<string, boolean> {
  const value = val ?? "";

  // Try JSON first (some sites store JSON)
  try {
    const j = JSON.parse(value);
    if (j && typeof j === "object") return j as Record<string, boolean>;
  } catch {}

  // Fallback: PHP-serialized pattern match
  const caps: Record<string, boolean> = {};
  if (/"administrator";b:1/.test(value)) caps.administrator = true;
  if (/"editor";b:1/.test(value)) caps.editor = true;
  if (/"author";b:1/.test(value)) caps.author = true;
  if (/"contributor";b:1/.test(value)) caps.contributor = true;
  if (/"subscriber";b:1/.test(value)) caps.subscriber = true;
  return caps;
}

export async function isAdmin(userId: number): Promise<boolean> {
  // NOTE: give query() an ARRAY type
  const rows = await query<Array<{ meta_value: string }>>(
    `SELECT meta_value
       FROM wp_usermeta
      WHERE user_id = ? AND meta_key = 'wp_capabilities'
      LIMIT 1`,
    [userId]
  );

  const metaValue = rows.length ? rows[0].meta_value : null;
  const caps = parseWpCapabilities(metaValue);

  // only administrators
  return !!caps.administrator;
}
