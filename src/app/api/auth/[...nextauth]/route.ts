// src/app/api/auth/[...nextauth]/route.ts
// -----------------------------------------------------------------------------
// NextAuth route handler (GET/POST)
// - Uses authOptions above
// -----------------------------------------------------------------------------

import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth/options";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // avoid caching auth endpoints

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
