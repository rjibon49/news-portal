// src/types/next-auth.d.ts

import { DefaultSession } from "next-auth";

// ---- augment next-auth session/user ----
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    username?: string | null;
  }
}

// ---- augment JWT so token.id & token.username are typed ----
declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    username?: string | null;
  }
}

export {};