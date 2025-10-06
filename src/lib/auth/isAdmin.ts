// src/lib/auth/isAdmin.ts
// -----------------------------------------------------------------------------
// Admin check by reading wp_usermeta('wp_capabilities') and parsing caps
// -----------------------------------------------------------------------------

import { query } from "@/db/mysql";
import { parseWpCapabilities, isAdministrator } from "@/lib/wordpress/capabilities";

export async function isAdmin(userId: number): Promise<boolean> {
  // If no row, treat as non-admin.
  const rows = await query<{ meta_value: string }>(
    `SELECT meta_value
       FROM wp_usermeta
      WHERE user_id = ? AND meta_key = 'wp_capabilities'
      LIMIT 1`,
    [userId]
  );

  const metaValue = rows[0]?.meta_value ?? "";
  const caps = parseWpCapabilities(metaValue);
  return isAdministrator(caps);
}
