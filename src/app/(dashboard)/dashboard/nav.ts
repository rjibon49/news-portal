// src/app/(dashboard)/dashboard/nav.ts
// -----------------------------------------------------------------------------
// Centralized Dashboard Navigation Config
// - Add/remove items here
// - Supports admin-only items
// - Includes helpers to compute 'active' state and map icons
// -----------------------------------------------------------------------------

/** Icon names we support in the sidebar (map with your icon lib) */
export type IconName =
  | "gauge"
  | "feather"
  | "folder"
  | "tags"
  | "images"
  | "users"
  | "userPlus";

/** One navigation item */
export type NavItem = {
  href: string;         // absolute app path, e.g. "/dashboard/posts"
  label: string;        // human readable label
  icon: IconName;       // pick from IconName union
  adminOnly?: boolean;  // show only for admins (optional)
};

/** Base definition (edit here) */
export const DASH_NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: "gauge" },
  { href: "/dashboard/posts", label: "Posts", icon: "feather" },

  // NOTE: singular paths to match your file structure
  { href: "/dashboard/category", label: "Categories", icon: "folder" },
  { href: "/dashboard/tag", label: "Tags", icon: "tags" },

  { href: "/dashboard/media", label: "Media", icon: "images" },

  // Admin-only sections
  { href: "/dashboard/users", label: "Users", icon: "users", adminOnly: true },
  { href: "/dashboard/users/new", label: "Add User", icon: "userPlus", adminOnly: true },

  // Create new post route
  { href: "/dashboard/post/new", label: "Add Post", icon: "feather" },
];

/* ────────────────────────────────────────────────────────────────────────────
   Helper: icon map (optional)
   - Example mapping for lucide-react (or your icon set)
   - In your component: const Icon = ICON_MAP[item.icon]; <Icon className="..." />
   - Replace imports accordingly if you use a different icon lib.
─────────────────────────────────────────────────────────────────────────────*/
// Example (uncomment if you use lucide-react):
// import { Gauge, Feather, Folder, Tags, Images, Users, UserPlus } from "lucide-react";
// export const ICON_MAP: Record<IconName, React.ComponentType<any>> = {
//   gauge: Gauge,
//   feather: Feather,
//   folder: Folder,
//   tags: Tags,
//   images: Images,
//   users: Users,
//   userPlus: UserPlus,
// };

/* ────────────────────────────────────────────────────────────────────────────
   Helper: buildNav
   - Filters admin-only items based on isAdmin
   - Adds .active boolean based on currentPath (startsWith match)
   - You can tweak matching rules if needed
─────────────────────────────────────────────────────────────────────────────*/
export type BuiltNavItem = NavItem & { active: boolean };

export function buildNav(opts: { currentPath: string; isAdmin?: boolean }): BuiltNavItem[] {
  const { currentPath, isAdmin = false } = opts;
  // Filter admin-only
  const items = DASH_NAV.filter((i) => (i.adminOnly ? isAdmin : true));
  // Compute active (prefix match so /dashboard/posts/123 also highlights Posts)
  return items.map((i) => ({
    ...i,
    active:
      i.href === "/dashboard"
        ? currentPath === "/dashboard"
        : currentPath === i.href || currentPath.startsWith(i.href + "/"),
  }));
}

/* ────────────────────────────────────────────────────────────────────────────
   Usage (example in a Client Component):
   const pathname = usePathname();
   const { data: session } = useSession();
   const isAdmin = Boolean(session?.user) && // optionally hit your /me endpoint
                   // better: pass isAdmin from server via props
   const nav = buildNav({ currentPath: pathname ?? "", isAdmin });

   return nav.map(item => {
     const Icon = ICON_MAP[item.icon]; // if you wired it
     return (
       <Link key={item.href} href={item.href}
         className={cn("nav-link", item.active && "nav-link--active")}>
         {Icon ? <Icon className="mr-2 h-4 w-4" /> : null}
         {item.label}
       </Link>
     );
   });
─────────────────────────────────────────────────────────────────────────────*/
