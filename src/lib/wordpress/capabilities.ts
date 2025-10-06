// src/lib/wordpress/capabilities.ts

/** WordPress wp_capabilities map */
export type CapMap = Record<string, boolean>;

/** Core roles we support writing back to DB */
export type UserRole =
  | "administrator"
  | "editor"
  | "author"
  | "contributor"
  | "subscriber";

/** Parse wp_usermeta.meta_value for 'wp_capabilities' into a JS map. */
export function parseWpCapabilities(val?: string | null): CapMap {
  const value = (val ?? "").trim();
  if (!value) return {};

  // Some sites/plugins store JSON—try first.
  try {
    const j = JSON.parse(value);
    if (j && typeof j === "object") return j as CapMap;
  } catch {}

  // Default: PHP-serialized array like: a:1:{s:13:"administrator";b:1;}
  // We only need the role names that are set to true.
  const caps: CapMap = {};
  const re = /"([a-zA-Z0-9_]+)";b:1/g; // matches s:N:"role";b:1
  let m: RegExpExecArray | null;
  while ((m = re.exec(value))) caps[m[1]] = true;
  return caps;
}

/** Primary role label to show in UI (falls back to first custom key or 'No role') */
export function primaryRoleLabel(caps: CapMap): string {
  if (caps.administrator) return "Administrator";
  if (caps.editor) return "Editor";
  if (caps.author) return "Author";
  if (caps.contributor) return "Contributor";
  if (caps.subscriber) return "Subscriber";
  const keys = Object.keys(caps);
  return keys.length ? keys[0] : "No role";
}

/** True if user has administrator capability */
export function isAdministrator(caps: CapMap): boolean {
  return !!caps.administrator;
}

/** Map WP role -> wp_user_level (classic WP convention) */
export const ROLE_LEVEL: Record<UserRole, number> = {
  administrator: 10,
  editor: 7,
  author: 2,
  contributor: 1,
  subscriber: 0,
};

/** Serialize a single role back to the PHP-serialized wp_capabilities format */
export function serializeCaps(role: UserRole): string {
  // a:1:{s:13:"administrator";b:1;}
  const len = role.length;
  return `a:1:{s:${len}:"${role}";b:1;}`;
}
