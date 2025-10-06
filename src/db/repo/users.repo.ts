// src/db/repo/users.repo.ts
// ---------------------------------------------------------------------------
// WordPress-style Users repository (MySQL 8)
//   listUsersRepo, createUserRepo, getUserProfileRepo,
//   updateUserProfileRepo, updateUserPasswordRepo, deleteUserRepo,
//   searchUsersRepo
// ---------------------------------------------------------------------------

import bcrypt from "bcryptjs";
import { query, withTx } from "@/db/mysql";
import { slugify } from "@/lib/slugify";

// ----- Roles / helpers -------------------------------------------------------

export type UserRole =
  | "administrator"
  | "editor"
  | "author"
  | "contributor"
  | "subscriber";

const ROLE_LEVEL: Record<UserRole, number> = {
  administrator: 10,
  editor: 7,
  author: 2,
  contributor: 1,
  subscriber: 0,
};

function serializeCaps(role: UserRole) {
  // WP serialized caps string. Example for admin:
  // a:1:{s:13:"administrator";b:1;}
  return `a:1:{s:${role.length}:"${role}";b:1;}`;
}

// ----- List + Create ---------------------------------------------------------

export type ListUsersInput = {
  q?: string;
  role?: UserRole | "no_role" | "any";
  page: number;
  perPage: number;
  orderBy: "user_login" | "user_registered" | "ID";
  order: "asc" | "desc";
};

export type ListUsersRow = {
  id: number;
  username: string;
  name: string;
  email: string;
  role: string;
  posts: number;
  registered: string;
  avatar_url?: string;
};

export async function listUsersRepo(input: ListUsersInput) {
  const { q = "", role = "any", page, perPage, orderBy, order } = input;

  const where: string[] = ["1=1"];
  const params: any[] = [];

  // search by login + email + display name
  if (q) {
    where.push("(u.user_login LIKE ? OR u.user_email LIKE ? OR u.display_name LIKE ?)");
    const like = `%${q}%`;
    params.push(like, like, like);
  }

  // role filter (including "no_role")
  if (role !== "any") {
    if (role === "no_role") {
      where.push(
        "NOT EXISTS (SELECT 1 FROM wp_usermeta mu WHERE mu.user_id = u.ID AND mu.meta_key = 'wp_capabilities')"
      );
    } else {
      where.push(
        "EXISTS (SELECT 1 FROM wp_usermeta mu WHERE mu.user_id = u.ID AND mu.meta_key='wp_capabilities' AND mu.meta_value LIKE ?)"
      );
      params.push(`%s:${(role as string).length}:"${role}";b:1%`);
    }
  }

  const offset = (page - 1) * perPage;

  const tot = await query<{ n: number }>(
    `SELECT COUNT(*) n FROM wp_users u WHERE ${where.join(" AND ")}`,
    params
  );
  const total = Number(tot[0]?.n || 0);

  const rows = await query<
    ListUsersRow & { avatar_profile?: string; avatar_legacy?: string }
  >(
    `
    SELECT
      u.ID AS id,
      u.user_login AS username,
      u.display_name AS name,
      u.user_email AS email,
      DATE_FORMAT(u.user_registered,'%Y-%m-%d %H:%i:%s') AS registered,
      COALESCE(
        (SELECT CASE
           WHEN m.meta_value LIKE '%"administrator";b:1%' THEN 'administrator'
           WHEN m.meta_value LIKE '%"editor";b:1%'        THEN 'editor'
           WHEN m.meta_value LIKE '%"author";b:1%'        THEN 'author'
           WHEN m.meta_value LIKE '%"contributor";b:1%'   THEN 'contributor'
           WHEN m.meta_value LIKE '%"subscriber";b:1%'    THEN 'subscriber'
           ELSE 'subscriber'
         END FROM wp_usermeta m WHERE m.user_id=u.ID AND m.meta_key='wp_capabilities' LIMIT 1),
        'subscriber'
      ) AS role,
      (SELECT COUNT(*) FROM wp_posts p
        WHERE p.post_author=u.ID AND p.post_type='post'
          AND p.post_status IN ('publish','draft','pending','future')) AS posts,
      (SELECT meta_value FROM wp_usermeta WHERE user_id=u.ID AND meta_key='profile_picture' LIMIT 1) AS avatar_profile,
      (SELECT meta_value FROM wp_usermeta WHERE user_id=u.ID AND meta_key='wp_user_avatar'   LIMIT 1) AS avatar_legacy
    FROM wp_users u
    WHERE ${where.join(" AND ")}
    ORDER BY ${orderBy} ${order}
    LIMIT ? OFFSET ?
    `,
    [...params, perPage, offset]
  );

  // pick first available avatar key
  const normalized: ListUsersRow[] = rows.map((r) => ({
    id: r.id,
    username: r.username,
    name: r.name,
    email: r.email,
    role: r.role,
    posts: r.posts,
    registered: r.registered,
    avatar_url: r.avatar_profile || r.avatar_legacy || undefined,
  }));

  return { rows: normalized, total, page, perPage };
}

export type CreateUserInput = {
  username: string;
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  website?: string;
  bio?: string;
  role: UserRole;
  avatarUrl?: string | null;
};

export type CreatedUserDTO = {
  id: number;
  username: string;
  email: string;
  display_name: string;
  role: UserRole;
};

export async function createUserRepo(input: CreateUserInput): Promise<CreatedUserDTO> {
  const {
    username,
    email,
    password,
    first_name = "",
    last_name = "",
    website = "",
    bio = "",
    role,
    avatarUrl,
  } = input;

  // unique by login OR email
  const exists = await query<{ ID: number }>(
    `SELECT ID FROM wp_users WHERE user_login=? OR user_email=? LIMIT 1`,
    [username, email]
  );
  if (exists.length) {
    const e: any = new Error("Username or email already exists.");
    e.status = 409;
    throw e;
  }

  const hash = await bcrypt.hash(password, 10);
  const display = `${first_name} ${last_name}`.trim() || username;
  const nicename = slugify(display || username, { keepUnicode: false });

  const userId = await withTx(async (cx) => {
    // insert into wp_users
    const [ins] = await cx.execute<any>(
      `INSERT INTO wp_users
        (user_login, user_pass, user_nicename, user_email, user_url,
         user_registered, user_activation_key, user_status, display_name)
       VALUES (?, ?, ?, ?, ?, NOW(), '', 0, ?)`,
      [username, hash, nicename, email, website, display]
    );
    const id = Number((ins as any).insertId);

    // usermeta
    const metas: Array<[string, string]> = [
      ["wp_capabilities", serializeCaps(role)],
      ["wp_user_level", String(ROLE_LEVEL[role])],
      ["first_name", first_name],
      ["last_name", last_name],
      ["nickname", display || username],
      ["description", bio],
      ["rich_editing", "true"],
      ["show_admin_bar_front", "true"],
    ];

    // store avatar in both keys for compatibility
    if (avatarUrl) {
      metas.push(["profile_picture", avatarUrl]);
      metas.push(["wp_user_avatar", avatarUrl]);
    }

    const values = metas.map(() => "(?, ?, ?)").join(", ");
    const params: any[] = [];
    metas.forEach(([k, v]) => params.push(id, k, v));
    await cx.execute(
      `INSERT INTO wp_usermeta (user_id, meta_key, meta_value) VALUES ${values}`,
      params
    );

    return id;
  });

  return { id: userId, username, email, display_name: display, role };
}

// ----- Profile read/update/password/delete/search ----------------------------

export type UserProfileDTO = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  nickname: string;
  display_name: string;
  website: string;
  bio: string;
  role: UserRole;
  avatar_url?: string;
  socials: Record<string, string>; // key->url (empty "" allowed)
};

export async function getUserProfileRepo(userId: number): Promise<UserProfileDTO | null> {
  const basic = await query<any>(
    `SELECT
       u.ID AS id,
       u.user_login AS username,
       u.user_email AS email,
       u.user_url   AS website,
       u.display_name AS display_name,
       COALESCE(
         (SELECT CASE
           WHEN m.meta_value LIKE '%"administrator";b:1%' THEN 'administrator'
           WHEN m.meta_value LIKE '%"editor";b:1%'        THEN 'editor'
           WHEN m.meta_value LIKE '%"author";b:1%'        THEN 'author'
           WHEN m.meta_value LIKE '%"contributor";b:1%'   THEN 'contributor'
           WHEN m.meta_value LIKE '%"subscriber";b:1%'    THEN 'subscriber'
           ELSE 'subscriber'
         END FROM wp_usermeta m
         WHERE m.user_id=u.ID AND m.meta_key='wp_capabilities' LIMIT 1),
         'subscriber'
       ) AS role
     FROM wp_users u
     WHERE u.ID = ? LIMIT 1`,
    [userId]
  );
  if (!basic.length) return null;

  const meta = await query<{ meta_key: string; meta_value: string }>(
    `SELECT meta_key, meta_value FROM wp_usermeta WHERE user_id = ?
     AND meta_key IN ('first_name','last_name','nickname','description','profile_picture','wp_user_avatar')`,
    [userId]
  );

  const M = new Map(meta.map((m) => [m.meta_key, m.meta_value || ""]));

  // fetch any "social_*" keys and expose as {facebook: "...", ...}
  const socialsRows = await query<{ meta_key: string; meta_value: string }>(
    `SELECT meta_key, meta_value FROM wp_usermeta
     WHERE user_id=? AND meta_key LIKE 'social_%'`,
    [userId]
  );
  const socials: Record<string, string> = {};
  socialsRows.forEach((r) => (socials[r.meta_key.replace(/^social_/, "")] = r.meta_value || ""));

  return {
    id: basic[0].id,
    username: basic[0].username,
    email: basic[0].email,
    first_name: M.get("first_name") || "",
    last_name: M.get("last_name") || "",
    nickname: M.get("nickname") || "",
    display_name: basic[0].display_name || "",
    website: basic[0].website || "",
    bio: M.get("description") || "",
    role: basic[0].role,
    avatar_url: M.get("profile_picture") || M.get("wp_user_avatar") || undefined,
    socials,
  };
}

export type UpdateUserProfileInput = {
  userId: number;
  email?: string;
  website?: string | "";
  first_name?: string | "";
  last_name?: string | "";
  nickname?: string | "";
  display_name?: string;
  bio?: string | "";
  avatarUrl?: string | null;               // undefined=no change, null=clear
  role?: UserRole;                         // API will gate admin-only
  socials?: Record<string, string | "">;  // empty string allowed
};

export async function updateUserProfileRepo(input: UpdateUserProfileInput): Promise<void> {
  const {
    userId,
    email,
    website,
    first_name,
    last_name,
    nickname,
    display_name,
    bio,
    avatarUrl,
    role,
    socials,
  } = input;

  await withTx(async (cx) => {
    // update wp_users with only changed fields
    const set: string[] = [];
    const vals: any[] = [];
    if (email !== undefined) { set.push("user_email = ?"); vals.push(email); }
    if (website !== undefined) { set.push("user_url = ?"); vals.push(website); }
    if (display_name !== undefined) { set.push("display_name = ?"); vals.push(display_name); }

    if (set.length) {
      await cx.execute(`UPDATE wp_users SET ${set.join(", ")} WHERE ID=? LIMIT 1`, [...vals, userId]);
    }

    // helper: set/delete a meta key
    async function setMeta(key: string, value: string | null | undefined) {
      if (typeof value === "undefined") return;            // skip
      await cx.execute(`DELETE FROM wp_usermeta WHERE user_id=? AND meta_key=?`, [userId, key]);
      if (value !== null) {
        await cx.execute(
          `INSERT INTO wp_usermeta (user_id, meta_key, meta_value) VALUES (?, ?, ?)`,
          [userId, key, value]
        );
      }
    }

    // names + bio
    await setMeta("first_name", first_name ?? undefined ? String(first_name) : undefined);
    await setMeta("last_name",  last_name  ?? undefined ? String(last_name)  : undefined);
    await setMeta("nickname",   nickname   ?? undefined ? String(nickname)   : undefined);
    await setMeta("description",bio        ?? undefined ? String(bio)        : undefined);

    // avatar (both keys kept in sync)
    if (typeof avatarUrl !== "undefined") {
      await setMeta("profile_picture", avatarUrl);
      await setMeta("wp_user_avatar",  avatarUrl);
    }

    // role/caps
    if (role) {
      await setMeta("wp_capabilities", serializeCaps(role));
      await setMeta("wp_user_level", String(ROLE_LEVEL[role]));
    }

    // socials -> social_<key>
    if (socials) {
      for (const [k, v] of Object.entries(socials)) {
        await setMeta(`social_${k}`, v ?? "");
      }
    }
  });
}

export async function updateUserPasswordRepo(userId: number, newPassword: string): Promise<void> {
  const hash = await bcrypt.hash(newPassword, 10);
  await query(`UPDATE wp_users SET user_pass=? WHERE ID=? LIMIT 1`, [hash, userId]);
}

export async function deleteUserRepo(userId: number): Promise<void> {
  await withTx(async (cx) => {
    await cx.execute(`UPDATE wp_posts SET post_author=0 WHERE post_author=?`, [userId]);
    await cx.execute(`DELETE FROM wp_usermeta WHERE user_id=?`, [userId]);
    await cx.execute(`DELETE FROM wp_users WHERE ID=? LIMIT 1`, [userId]);
  });
}

// ----- lightweight search for pickers/mentions -------------------------------

export async function searchUsersRepo(
  q: string,
  limit = 10
): Promise<Array<{ id: number; username: string; name: string; email: string; avatar_url?: string }>> {
  const like = `%${q}%`;
  const rows = await query<any>(
    `
    SELECT
      u.ID AS id,
      u.user_login AS username,
      u.display_name AS name,
      u.user_email AS email,
      (SELECT meta_value FROM wp_usermeta WHERE user_id=u.ID AND meta_key='profile_picture' LIMIT 1) AS avatar_profile,
      (SELECT meta_value FROM wp_usermeta WHERE user_id=u.ID AND meta_key='wp_user_avatar' LIMIT 1) AS avatar_legacy
    FROM wp_users u
    WHERE u.user_login LIKE ? OR u.display_name LIKE ? OR u.user_email LIKE ? OR u.user_nicename LIKE ?
    ORDER BY u.user_login ASC
    LIMIT ?`,
    [like, like, like, like, limit]
  );

  return rows.map((r: any) => ({
    id: r.id,
    username: r.username,
    name: r.name,
    email: r.email,
    avatar_url: r.avatar_profile || r.avatar_legacy || undefined,
  }));
}
