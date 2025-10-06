// src/middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

type Role = "administrator" | "editor" | "author" | "contributor" | "subscriber";

const adminOnlyPrefixes = [
  // Users management pages & APIs
  "/dashboard/users",
  "/api/r2/users",
];

const contributorOrHigherPrefixes = [
  "/dashboard/posts",
  "/dashboard/categories",
  "/dashboard/tags",
  "/dashboard/media",
  "/api/r2/posts",      // you already re-check inside routes, this is extra guard
  "/api/r2/categories", // adjust if you have write routes
  "/api/r2/tags",
];

function hasAtLeast(role: Role, min: Role): boolean {
  const rank: Record<Role, number> = {
    subscriber: 0,
    contributor: 1,
    author: 2,
    editor: 3,
    administrator: 4,
  };
  return rank[role] >= rank[min];
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Public paths: allow
  if (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.startsWith("/images") ||
    pathname === "/" ||
    pathname.startsWith("/site") // your public site segment if any
  ) {
    return NextResponse.next();
  }

  // We only care about dashboard + secured APIs
  const checksDashboard = pathname.startsWith("/dashboard");
  const checksSecuredApi =
    adminOnlyPrefixes.some((p) => pathname.startsWith(p)) ||
    contributorOrHigherPrefixes.some((p) => pathname.startsWith(p));

  if (!checksDashboard && !checksSecuredApi) {
    return NextResponse.next();
  }

  // Read token (needs NEXTAUTH_SECRET set)
  const token = await getToken({ req });
  if (!token) {
    // Not logged in → send to sign-in with callback
    const login = new URL("/auth/signin", req.url);
    login.searchParams.set("callbackUrl", pathname + (search || ""));
    return NextResponse.redirect(login);
  }

  const role = ((token as any).role || "subscriber") as Role;

  // Admin area guards
  if (adminOnlyPrefixes.some((p) => pathname.startsWith(p))) {
    if (!hasAtLeast(role, "administrator")) {
      // For API: 403; For page: redirect to /dashboard
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // Contributor+ area guards
  if (contributorOrHigherPrefixes.some((p) => pathname.startsWith(p))) {
    if (!hasAtLeast(role, "contributor")) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      // Subscriber → let them see only overview/profile
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // `/dashboard` & `/dashboard/profile` require login only → already satisfied
  return NextResponse.next();
}

// Only run on relevant routes
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/r2/:path*",      // protect selected API prefixes inside middleware
  ],
};
