// src/components/ads/AdSlot.tsx
"use client";

import React from "react";

export default function AdSlot({
  id,
  enabled,
  className,
  style,
}: {
  id: string;
  enabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  if (!enabled) return null;

  return (
    <div
      data-ad-slot={id}
      className={className || "ad-slot"}
      style={{
        margin: "16px 0",
        padding: 12,
        border: "1px dashed var(--border,#334)",
        background: "var(--ad-bg,#0e1320)",
        borderRadius: 8,
        textAlign: "center",
        ...style,
      }}
      // 👉 এখানে পরে তোমার ad loader/refresh ট্রিগার করতে পারো
    >
      {/* Placeholder – পরে নিজের creative/script বসিয়ে দেবে */}
      <small style={{ opacity: 0.8 }}>Ad: {id}</small>
    </div>
  );
}
