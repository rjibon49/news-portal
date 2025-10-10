// src/config/menu.ts
export type MenuItem = { label: string; href: string };

export const MAIN_MENU: MenuItem[] = [
  { label: "Home", href: "/" },
  { label: "National", href: "/category/national" },
  { label: "Lead", href: "/category/lead" },
  { label: "Sports", href: "/category/sports" },
];