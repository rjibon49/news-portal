// src/app/(dashboard)/dashboard/ads/layout.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { isAdmin } from "@/lib/auth/isAdmin";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdsAdminLayout({
  children,
}: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const uid = Number((session as any)?.user?.id || 0);
  if (!uid) redirect("/");                 // not logged in → home
  const admin = await isAdmin(uid);
  if (!admin) redirect("/dashboard");      // logged in but not admin

  return <>{children}</>;
}
