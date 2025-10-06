// src/lib/auth/options.ts
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { query } from "@/db/mysql";
import { parseWpCapabilities } from "@/lib/wordpress/capabilities"; // already in your repo

type WPUserRow = {
  ID: number;
  user_login: string;
  user_pass: string;
  user_email: string;
  display_name: string;
};

async function getUserPrimaryRole(userId: number): Promise<
  "administrator" | "editor" | "author" | "contributor" | "subscriber"
> {
  const rows = await query<{ meta_value: string }>(
    `SELECT meta_value
       FROM wp_usermeta
      WHERE user_id=? AND meta_key LIKE '%capabilities'
      LIMIT 1`,
    [userId]
  );
  const caps = parseWpCapabilities(rows[0]?.meta_value);
  if (caps.administrator) return "administrator";
  if (caps.editor) return "editor";
  if (caps.author) return "author";
  if (caps.contributor) return "contributor";
  return "subscriber";
}

export const authOptions: NextAuthOptions = {
  debug: process.env.NODE_ENV !== "production",
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 },
  pages: { signIn: "/auth/signin" },

  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        identifier: { label: "Username or Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        const identifier = creds?.identifier?.trim() || "";
        const password = creds?.password || "";
        if (!identifier || !password) return null;

        const rows = await query<WPUserRow>(
          `SELECT ID, user_login, user_pass, user_email, display_name
             FROM wp_users
            WHERE user_login=? OR user_email=?
            LIMIT 1`,
          [identifier, identifier]
        );
        const user = rows[0];
        if (!user) return null;

        const normalized = (user.user_pass || "")
          .replace(/^\$2y\$/, "$2a$")
          .replace(/^\$2b\$/, "$2a$");

        const ok = await bcrypt.compare(password, normalized);
        if (!ok) return null;

        // ✅ return minimal, we’ll add role in jwt()
        return {
          id: String(user.ID),
          name: user.display_name || user.user_login,
          email: user.user_email,
          username: user.user_login,
        } as any;
      },
    }),
  ],

  callbacks: {
    // 🔐 Put role into the token once on login; keep it afterwards
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.username = (user as any).username;
        // fetch role once at sign-in
        try {
          const role = await getUserPrimaryRole(Number((user as any).id));
          (token as any).role = role;
        } catch {
          (token as any).role = "subscriber";
        }
      }
      return token;
    },

    async session({ session, token }) {
      session.user = session.user ?? ({} as any);
      session.user.id = (token.id ?? session.user.id ?? "") as string;
      session.user.username = (token.username ?? session.user.username ?? null) as string | null;
      // ✅ expose role on session (useful in client)
      (session.user as any).role = (token as any).role || "subscriber";
      return session;
    },
  },
};
