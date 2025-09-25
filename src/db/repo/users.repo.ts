// src/db/repo/users.repo.ts
import { execute, query, withTx } from "@/db/mysql";
import type { WPUser } from "@/types/wp";
import { parseWpCapabilities, primaryRoleLabel } from "@/lib/wordpress/capabilities";
import { slugify } from "@/lib/slugify";
import bcrypt from "bcryptjs";


// Keep your original field set
const USER_FIELDS = `
  u.ID, u.user_login, u.user_pass, u.user_nicename, u.user_email, u.user_url,
  u.user_registered, u.user_activation_key, u.user_status, u.display_name
`;

// ---------- single fetchers (unchanged) ----------
export async function getUserById(id: number): Promise<WPUser | undefined> {
  const rows = await query<WPUser>(
    `SELECT ${USER_FIELDS} FROM wp_users u WHERE u.ID = ? LIMIT 1`,
    [id]
  );
  return rows[0];
}

export async function getUserByLoginOrEmail(identifier: string): Promise<WPUser | undefined> {
  const rows = await query<WPUser>(
    `SELECT ${USER_FIELDS}
       FROM wp_users u
      WHERE u.user_login = ? OR u.user_email = ?
      LIMIT 1`,
    [identifier, identifier]
  );
  return rows[0];
}

// ---------- list (new) ----------
export type ListUsersParams = {
  q?: string;
  role?: "administrator" | "editor" | "author" | "contributor" | "subscriber" | "no_role" | "any";
  page?: number;        // 1-based
  perPage?: number;     // default 20
  orderBy?: "user_login" | "user_registered" | "ID";
  order?: "asc" | "desc";
};

export type UserListItemDTO = {
  id: number;
  username: string;
  name: string;
  email: string;
  role: string;
  posts: number;
  registered: string; // mysql DATETIME as string (dateStrings=true)
};

export type ListUsersResult = {
  rows: UserListItemDTO[];
  total: number;
  page: number;
  perPage: number;
};

export async function listUsersRepo(params: ListUsersParams = {}): Promise<ListUsersResult> {
  const {
    q = "",
    role = "any",
    page = 1,
    perPage = 20,
    orderBy = "user_login",
    order = "asc",
  } = params;

  // Safe column mapping (prevents SQL injection via identifiers)
  const ORDER_BY_COL: Record<NonNullable<ListUsersParams["orderBy"]>, string> = {
    user_login: "u.user_login",
    user_registered: "u.user_registered",
    ID: "u.ID",
  };
  const ORDER_DIR = order.toUpperCase() === "DESC" ? "DESC" : "ASC";

  // WHERE builder
  const where: string[] = [];
  const args: any[] = [];

  if (q) {
    const like = `%${q}%`;
    where.push(`(u.user_login LIKE ? OR u.user_email LIKE ? OR u.display_name LIKE ?)`);
    args.push(like, like, like);
  }

  // role via wp_usermeta meta_value (serialized caps)
  if (role && role !== "any") {
    if (role === "no_role") {
      where.push(`(um.meta_value IS NULL OR um.meta_value = '' OR um.meta_value = 'a:0:{}')`);
    } else {
      where.push(`(um.meta_value LIKE ?)`);
      args.push(`%\"${role}\";b:1%`);
    }
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  // main rows with publish post counts
  const rows = await query<{
    ID: number;
    user_login: string;
    user_email: string;
    display_name: string;
    user_registered: string;
    caps: string | null;
    post_count: number | null;
  }>(
    `
    SELECT u.ID, u.user_login, u.user_email, u.display_name, u.user_registered,
           um.meta_value AS caps,
           COALESCE(p.post_count, 0) AS post_count
      FROM wp_users u
      LEFT JOIN wp_usermeta um
        ON um.user_id = u.ID AND um.meta_key = 'wp_capabilities'
      LEFT JOIN (
        SELECT post_author, COUNT(*) AS post_count
          FROM wp_posts
         WHERE post_type = 'post' AND post_status = 'publish'
         GROUP BY post_author
      ) p ON p.post_author = u.ID
      ${whereSql}
     ORDER BY ${ORDER_BY_COL[orderBy]} ${ORDER_DIR}
     LIMIT ? OFFSET ?
    `,
    [...args, perPage, (page - 1) * perPage]
  );

  // total count
  const totalRows = await query<{ total: number }>(
    `
    SELECT COUNT(*) AS total
      FROM wp_users u
      LEFT JOIN wp_usermeta um
        ON um.user_id = u.ID AND um.meta_key = 'wp_capabilities'
      ${whereSql}
    `,
    args
  );
  const total = totalRows[0]?.total ?? 0;

  const mapped: UserListItemDTO[] = rows.map((r) => {
    const caps = parseWpCapabilities(r.caps ?? undefined);
    return {
      id: r.ID,
      username: r.user_login,
      name: r.display_name,
      email: r.user_email,
      role: primaryRoleLabel(caps),
      posts: Number(r.post_count ?? 0),
      registered: r.user_registered,
    };
  });

  return { rows: mapped, total, page, perPage };
}


// PHP serialized wp_capabilities তৈরি
function serializeCaps(role: UserRole): string {
  const key = role; // e.g. "administrator"
  return `a:1:{s:${key.length}:"${key}";b:1;}`;
}
type UserRole = "administrator" | "editor" | "author" | "contributor" | "subscriber";
const ROLE_LEVEL: Record<UserRole, number> = {
  administrator: 10,
  editor: 7,
  author: 2,
  contributor: 1,
  subscriber: 0,
};

export type CreateUserInput = {
  username: string;
  email: string;
  password: string;          // plain; will be bcrypt'd
  first_name?: string;
  last_name?: string;
  website?: string;
  bio?: string;              // Biographical Info -> usermeta 'description'
  role: UserRole;
  avatarUrl?: string;
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

  const exists = await query<{ ID: number }>(
    `SELECT ID FROM wp_users WHERE user_login = ? OR user_email = ? LIMIT 1`,
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

  const insertId = await withTx(async (cx) => {
    // wp_users
    const [ins] = await cx.execute<any>(
      `INSERT INTO wp_users
        (user_login, user_pass, user_nicename, user_email, user_url,
         user_registered, user_activation_key, user_status, display_name)
       VALUES (?, ?, ?, ?, ?, NOW(), '', 0, ?)`,
      [username, hash, nicename, email, website, display]
    );
    const userId = Number((ins as any).insertId);

    // metas
    const metas: Array<[string, string]> = [
      ["wp_capabilities", serializeCaps(role)],
      ["wp_user_level", String(ROLE_LEVEL[role])],
      ["first_name", first_name],
      ["last_name", last_name],
      ["nickname", display || username],
      ["description", bio],
      // optional goodies:
      ["rich_editing", "true"],
      ["show_admin_bar_front", "true"],
    ];

    // ⬇️ avatar দিলে usermeta তে সেভ হবে
    if (avatarUrl) {
      metas.push(["profile_picture", avatarUrl]);   // আমাদের UI-র জন্য
      // কিছু থিম/প্লাগিন এই key নামও দেখে:
      metas.push(["wp_user_avatar", avatarUrl]);    // ঐচ্ছিক কম্প্যাট
    }

    const values = metas.map(() => "(?, ?, ?)").join(", ");
    const params: any[] = [];
    metas.forEach(([k, v]) => params.push(userId, k, v));

    await cx.execute(
      `INSERT INTO wp_usermeta (user_id, meta_key, meta_value) VALUES ${values}`,
      params
    );

    return userId;
  });

  return {
    id: insertId,
    username,
    email,
    display_name: display,
    role,
  };
}