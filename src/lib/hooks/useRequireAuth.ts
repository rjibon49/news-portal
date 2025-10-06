// src/lib/hooks/useRequireAuth.ts
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type UseRequireAuthOptions = {
  /** Sign-in page (must accept ?callbackUrl=) */
  redirectTo?: string;               // default: '/auth/signin'
  /** Paths that should not enforce auth (e.g. public landing) */
  publicPaths?: string[];            // default: []
  /** Skip calling /api/r2/me (if you only need the auth gate) */
  skipMe?: boolean;                  // default: false
};

type MeResp = {
  id: number;
  role: "administrator" | "editor" | "author" | "contributor" | "subscriber";
  canPublishNow: boolean;
};

export function useRequireAuth(options: UseRequireAuthOptions = {}) {
  const {
    redirectTo = "/auth/signin",
    publicPaths = [],
    skipMe = false,
  } = options;

  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const redirected = useRef(false); // guard so we only redirect once

  // Build current URL (for callbackUrl)
  const currentUrl = searchParams?.toString()
    ? `${pathname}?${searchParams.toString()}`
    : pathname;

  const isOnRedirectPage =
    pathname === redirectTo || pathname.startsWith(`${redirectTo}?`);

  const isPublic =
    publicPaths.some((p) => p === pathname || pathname.startsWith(`${p}/`));

  // --- Redirect effect (unchanged behavior) ---
  useEffect(() => {
    if (status === "loading") return;

    if (status === "authenticated" || isPublic || isOnRedirectPage) return;

    if (status === "unauthenticated" && !redirected.current) {
      redirected.current = true;
      const url = `${redirectTo}?callbackUrl=${encodeURIComponent(currentUrl)}`;
      router.replace(url);
    }
  }, [status, isPublic, isOnRedirectPage, currentUrl, redirectTo, router]);

  // --- /api/r2/me (role + publish permissions) ---
  const [me, setMe] = useState<MeResp | null>(null);
  const [meLoading, setMeLoading] = useState(false);

  async function loadMe(signal?: AbortSignal) {
    if (skipMe) return;
    try {
      setMeLoading(true);
      const r = await fetch("/api/r2/me", { cache: "no-store", signal });
      const j = (await r.json().catch(() => ({}))) as Partial<MeResp>;
      if (!r.ok) throw new Error((j as any)?.error || "Failed to load /me");
      setMe({
        id: Number(j.id ?? 0),
        role:
          (j.role as MeResp["role"]) ??
          "subscriber",
        canPublishNow: !!j.canPublishNow,
      });
    } catch {
      setMe(null);
    } finally {
      setMeLoading(false);
    }
  }

  useEffect(() => {
    if (skipMe) return;
    if (status !== "authenticated") {
      setMe(null);
      return;
    }
    const ctrl = new AbortController();
    loadMe(ctrl.signal);
    return () => ctrl.abort();
  }, [status, skipMe]);

  // Derived helpers
  const role = me?.role ?? "subscriber";
  const canPublishNow = !!me?.canPublishNow;

  const flags = useMemo(
    () => ({
      isAdmin: role === "administrator",
      isEditor: role === "editor",
      isAuthor: role === "author",
      isContributor: role === "contributor",
      isSubscriber: role === "subscriber",
    }),
    [role]
  );

  return {
    // original fields
    session,
    status,
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated",

    // new fields
    me,
    role,
    canPublishNow,
    meLoading,
    refreshMe: () => loadMe(), // call when you need to re-fetch /me
    ...flags,
  };
}
