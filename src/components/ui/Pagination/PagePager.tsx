// src/components/ui/Pagination/PagePager.tsx
"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Pagination from "./Pagination";

export default function PagePager({
  currentPage,
  totalPages,
  mode = "numbers",
  className = "",
}: {
  currentPage: number;
  totalPages: number;
  mode?: "none" | "next-prev" | "load-more" | "infinite" | "numbers";
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const onPageChange = (p: number) => {
    // guard: same page হলে push না করি
    if (p === currentPage) return;

    const params = new URLSearchParams(sp?.toString() ?? "");

    if (p <= 1) params.delete("page");   // ✅ page=1 হলে param বাদ
    else params.set("page", String(p));

    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: true }); // scroll: true → টপে ওঠে
  };

  return (
    <Pagination
      visible
      mode={mode}
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={onPageChange}
      className={className}
    />
  );
}
