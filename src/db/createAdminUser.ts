// src/db/createAdminUser.ts

import bcrypt from "bcryptjs";
import { execute, query, getPool } from "./mysql.js";
import { slugify } from "../lib/slugify.js";
import "./loadEnv.js";

// MySQL DATETIME string
function toMySQLDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * Creates an administrator if not existing.
 * - Inserts into wp_users with bcrypt hash (converted to $2y$ prefix for WP-style).
 * - Inserts wp_usermeta rows: wp_capabilities (administrator) and wp_user_level=10
 */
async function createAdminUser() {
  // ----- customize defaults here if you want -----
  const user_login = "masteradmin";
  const user_email = "admin@example.com";
  const rawPassword = "password123";
  const display_name = "Administrator";
  const user_url = "";

  const user_nicename = slugify(display_name || user_login, { keepUnicode: false });

  // Exists?
  const exists = await query<{ ID: number }>(
    `SELECT ID FROM wp_users WHERE user_login = ? OR user_email = ? LIMIT 1`,
    [user_login, user_email]
  );

  // Hash as bcrypt; normalize prefix to $2y$ (PHP/WP style)
  const bcryptHash = await bcrypt.hash(rawPassword, 10);
  const wpHash = bcryptHash.replace(/^\$2a\$/, "$2y$");

  const now = new Date();
  const user_registered = toMySQLDate(now);

  // Insert wp_users
  const res = await execute(
    `INSERT INTO wp_users
      (user_login, user_pass, user_nicename, user_email, user_url,
       user_registered, user_activation_key, user_status, display_name)
     VALUES
      (?, ?, ?, ?, ?, ?, '', 0, ?)`,
    [user_login, wpHash, user_nicename, user_email, user_url, user_registered, display_name]
  );

  const userId = res.insertId;
  console.log("✅ Admin user created, ID:", userId);

  // wp_usermeta: capabilities + level
  const CAPABILITIES = `a:1:{s:13:"administrator";b:1;}`;
  await execute(
    `INSERT INTO wp_usermeta (user_id, meta_key, meta_value) VALUES (?, 'wp_capabilities', ?)`,
    [userId, CAPABILITIES]
  );
  await execute(
    `INSERT INTO wp_usermeta (user_id, meta_key, meta_value) VALUES (?, 'wp_user_level', '10')`,
    [userId]
  );

  console.log("✅ Capabilities & level assigned (administrator, level 10).");
}

(async () => {
  try {
    // ensure pool is initialised
    getPool();
    await createAdminUser();
  } catch (err) {
    console.error("❌ Error creating admin user:", err);
    process.exitCode = 1;
  } finally {
    // close pool so the script exits cleanly
    try {
      await getPool().end();
    } catch {}
  }
})();
