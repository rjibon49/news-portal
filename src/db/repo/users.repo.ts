// src/db/repo/users.repo.ts

import { query } from "@/db/mysql";
import type { WPUser } from "@/types/wp";

const USER_FIELDS = `
  ID, user_login, user_pass, user_nicename, user_email, user_url,
  user_registered, user_activation_key, user_status, display_name
`;

export async function getUserById(id: number): Promise<WPUser | undefined> {
  const rows = await query<WPUser>(
    `SELECT ${USER_FIELDS} FROM wp_users WHERE ID = ? LIMIT 1`,
    [id]
  );
  return rows[0];
}

export async function getUserByLoginOrEmail(identifier: string): Promise<WPUser | undefined> {
  const rows = await query<WPUser>(
    `SELECT ${USER_FIELDS}
       FROM wp_users
      WHERE user_login = ? OR user_email = ?
      LIMIT 1`,
    [identifier, identifier]
  );
  return rows[0];
}
