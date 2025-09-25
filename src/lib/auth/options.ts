// src/lib/auth/options.ts
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { query } from "@/db/mysql";

type WPUserRow = {
  ID: number;
  user_login: string;
  user_pass: string;
  user_email: string;
  display_name: string;
};

export const authOptions: NextAuthOptions = {
  debug: process.env.NODE_ENV !== "production",
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/auth/signin" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        identifier: { label: "Username or Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        try {
          const identifier = creds?.identifier?.trim() || "";
          const password = creds?.password || "";
          if (!identifier || !password) return null;

          const rows = await query<WPUserRow>(
            `SELECT ID, user_login, user_pass, user_email, display_name
               FROM wp_users
              WHERE user_login = ? OR user_email = ?
              LIMIT 1`,
            [identifier, identifier]
          );
          const user = rows[0];
          if (!user) return null;

          const hash = user.user_pass || "";

          // 🔧 Important: normalize WP-style prefixes for bcryptjs
          // bcryptjs reliably supports $2a$; map $2y$/$2b$ -> $2a$ before compare.
          const normalized = hash
            .replace(/^\$2y\$/, "$2a$")
            .replace(/^\$2b\$/, "$2a$");

          const ok = await bcrypt.compare(password, normalized);
          if (!ok) return null;

          return {
            id: String(user.ID),
            name: user.display_name || user.user_login,
            email: user.user_email,
            username: user.user_login,
          } as any;
        } catch (e) {
          console.error("[next-auth] credentials authorize error:", e);
          return null; // never throw -> ensures JSON response
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.username = (user as any).username;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = session.user || {};
      // @ts-expect-error augment at runtime
      session.user.id = token.id;
      session.user.username = token.username;
      return session;
    },
  },
};
