// src/components/news/Thumb.tsx
"use client"

import Image from "next/image";
import { useState } from "react";

const DEFAULT_FALLBACK = "/placeholder.jpg"; // নিশ্চিত হও public/ এ ফাইলটা আছে

export function Thumb({
  src,
  alt,
  sizes = "100vw",
  className,
  fallback = DEFAULT_FALLBACK,
}: {
  src?: string;
  alt: string;
  sizes?: string;
  className?: string;
  fallback?: string;
}) {
  const [err, setErr] = useState(false);
  const finalSrc = !src || err ? fallback : src;

  // src না থাকলে কিছু রেন্ডার না করাই বেস্ট
  if (!finalSrc) return null;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Image
        src={finalSrc}
        alt={alt}
        fill
        sizes={sizes}
        className={className}
        style={{ objectFit: "cover" }}
        priority={false}
        onError={() => setErr(true)}
      />
    </div>
  );
}