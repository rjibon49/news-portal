// src/components/ui/Heading/SectionHeading.tsx

import React from "react";
import cls from "./SectionHeading.module.css";

export type HeadingVariant = 1|2|3|4|5|6|7|8|9;

type Props = {
  title: string;
  variant?: HeadingVariant;

  // Customization
  color?: string;
  bg?: string;
  lineColor?: string;
  fontSize?: string | number;
  align?: "left" | "center" | "right";
  width?: string | number;
  className?: string;

  // NEW: link support (optional)
  href?: string;
  target?: "_self" | "_blank";
  rel?: string;
  ariaLevel?: 1|2|3|4|5|6; // for screen readers (defaults to 2)
};

export default function SectionHeading({
  title,
  variant = 1,
  color,
  bg,
  lineColor,
  fontSize,
  align = "left",
  width = "100%",
  className = "",
  href,
  target = "_self",
  rel,
  ariaLevel = 2,
}: Props) {
  // TS-safe CSS variables (no any)
  const style: React.CSSProperties & Record<string, string | number> = {
    "--h-width": typeof width === "number" ? `${width}px` : width,
    "--h-align": align,
    "--h-color": color ?? "",
    "--h-bg": bg ?? "",
    "--h-fs": typeof fontSize === "number" ? `${fontSize}px` : (fontSize ?? ""),
    "--h-line": (lineColor ?? bg ?? color ?? "") as string,
  };

  const inner = (
    <span className={cls.text}>
      {title}
    </span>
  );

  const content = href ? (
    <a
      href={href}
      target={target}
      rel={target === "_blank" ? (rel ? rel : "noopener noreferrer") : rel}
      className={cls.link}
      aria-label={title}
    >
      {inner}
    </a>
  ) : inner;

  return (
    <div
      className={`${cls.heading} ${cls[`v${variant}`]} ${className}`}
      style={style}
      role="heading"
      aria-level={ariaLevel}
    >
      {content}
    </div>
  );
}
