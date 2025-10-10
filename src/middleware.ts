// src/middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

type Role = "administrator" | "editor" | "author" | "contributor" | "subscriber";

const adminOnlyPrefixes = ["/dashboard/users", "/api/r2/users"];
const contributorOrHigherPrefixes = [
  "/dashboard/posts",
  "/dashboard/categories",
  "/dashboard/tags",
  "/dashboard/media",
  "/api/r2/posts",
  "/api/r2/categories",
  "/api/r2/tags",
];

// ✅ public read-only API (GET only)
const publicApiGetPrefixes = [
  "/api/r2/posts",
  "/api/r2/categories",
  "/api/r2/tags",
  "/api/r2/media",
];

function hasAtLeast(role: Role, min: Role) {
  const rank: Record<Role, number> = { subscriber:0, contributor:1, author:2, editor:3, administrator:4 };
  return rank[role] >= rank[min];
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // ---- Allowlist: assets/auth roots ----
  if (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.startsWith("/images") ||
    pathname === "/" ||
    pathname.startsWith("/site")
  ) {
    return NextResponse.next();
  }

  // ✅ EARLY RETURN: Public GET APIs — কোনো রিডাইরেক্ট নয়
  if (req.method === "GET" && publicApiGetPrefixes.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // ---- Protect dashboard + secured APIs ----
  const checksDashboard = pathname.startsWith("/dashboard");
  const checksSecuredApi =
    adminOnlyPrefixes.some(p => pathname.startsWith(p)) ||
    contributorOrHigherPrefixes.some(p => pathname.startsWith(p));

  if (!checksDashboard && !checksSecuredApi) {
    return NextResponse.next();
  }

  const token = await getToken({ req });
  if (!token) {
    // API হলে JSON 401 (HTML redirect নয়)
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const login = new URL("/auth/signin", req.url);
    login.searchParams.set("callbackUrl", pathname + (search || ""));
    return NextResponse.redirect(login);
  }

  const role = ((token as any).role || "subscriber") as Role;

  if (adminOnlyPrefixes.some(p => pathname.startsWith(p))) {
    if (!hasAtLeast(role, "administrator")) {
      return pathname.startsWith("/api/")
        ? NextResponse.json({ error: "Forbidden" }, { status: 403 })
        : NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  if (contributorOrHigherPrefixes.some(p => pathname.startsWith(p))) {
    if (!hasAtLeast(role, "contributor")) {
      return pathname.startsWith("/api/")
        ? NextResponse.json({ error: "Forbidden" }, { status: 403 })
        : NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/r2/:path*"],
};
