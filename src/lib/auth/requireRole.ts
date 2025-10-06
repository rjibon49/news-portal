// src/lib/auth/requireRole.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { query } from "@/db/mysql";
import { parseWpCapabilities } from "@/lib/wordpress/capabilities";

export async function requireRole(min: "subscriber"|"contributor"|"author"|"editor"|"administrator") {
  const session = await getServerSession(authOptions);
  const uid = Number((session as any)?.user?.id || 0);
  if (!uid) throw new Error("Unauthorized");

  const rows = await query<{ meta_value: string }>(
    `SELECT meta_value FROM wp_usermeta
      WHERE user_id=? AND meta_key LIKE '%capabilities' LIMIT 1`,
    [uid]
  );
  const caps = parseWpCapabilities(rows[0]?.meta_value);
  const role =
    caps.administrator ? "administrator" :
    caps.editor ? "editor" :
    caps.author ? "author" :
    caps.contributor ? "contributor" : "subscriber";

  const rank = { subscriber:0, contributor:1, author:2, editor:3, administrator:4 } as const;
  if (rank[role] < rank[min]) throw new Error("Forbidden");

  return { uid, role };
}
