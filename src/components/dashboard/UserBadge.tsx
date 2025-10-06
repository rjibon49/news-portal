// src/components/dashboard/UserBadge.tsx
"use client";

import useSWR from "swr";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser } from "@fortawesome/free-solid-svg-icons";

// ✅ Safe fetcher: error হলে {} রিটার্ন করে (UI আর ক্র্যাশ করবে না)
const safeFetcher = async (url: string) => {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) return {};
  return r.json().catch(() => ({}));
};

export default function UserBadge() {
  const { data: session, status } = useSession();

  // key == null হলে SWR কল হবে না
  const key =
    status === "authenticated" && session?.user?.id
      ? `/api/r2/users/${session.user.id}`
      : null;

  // 🚫 suspense=false রাখলে error throw হলেও লেআউট ভাঙবে না
  const { data } = useSWR<
    { id: number; display_name?: string; username?: string | null; avatar_url?: string | null } | {}
  >(key, safeFetcher, { suspense: false, errorRetryCount: 0 });

  // skeleton state
  if (status === "loading") {
    return (
      <div className="user-badge skeleton" aria-busy="true" title="Loading user…">
        <div className="avatar" />
        <div className="meta">
          <div className="line" />
          <div className="line small" />
        </div>
      </div>
    );
  }

  // not signed in
  if (status !== "authenticated" || !session?.user?.id) {
    return (
      <Link href="/auth/signin" className="user-badge">
        <span className="avatar icon">
          <FontAwesomeIcon icon={faUser} />
        </span>
        <div className="meta">
          <div className="name">Sign in</div>
          <div className="sub">Guest</div>
        </div>
      </Link>
    );
  }

  // profile data (safe defaults)
  const profile = (data || {}) as any;
  const name =
    profile.display_name ||
    profile.username ||
    session.user.name ||
    session.user.username ||
    "User";
  const avatar = profile.avatar_url || null;

  // প্রোফাইল পেইজ লিংক—চাইলে `/dashboard/users/${session.user.id}/edit` করতে পারো
  return (
    <Link href={`/dashboard/users/${session.user.id}/edit`} className="user-badge" title="Profile" style={{display:"flex", gap:"10px"}}>
      {avatar ? (
        <Image src={avatar} alt={name} width={32} height={32} className="avatar" />
      ) : (
        <span className="avatar icon" aria-hidden="true">
          <FontAwesomeIcon icon={faUser} />
        </span>
      )}
      <div className="meta">
        <div className="name">{name}</div>
        <div className="sub">@{session.user.username || "me"}</div>
      </div>
    </Link>
  );
}
