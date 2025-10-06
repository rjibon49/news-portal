// src/types/next-auth.d.ts
// -----------------------------------------------------------------------------
// Type augmentation for NextAuth (Session/User/JWT)
// -----------------------------------------------------------------------------

import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;                // ← required in our app
      username?: string | null;  // ← wp_users.user_login
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    username?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    username?: string | null;
  }
}

export {};
