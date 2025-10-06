// src/app/(dashboard)/dashboard/layout.tsx

// =====================
// Role-aware Dashboard shell with sidebar + topbar
// - Menu visibility depends on WP role (subscriber / contributor / author / editor / administrator)
// - Uses /api/r2/me to read { id, role } and filters nav accordingly
// - Lots of comments so you can extend easily
// =====================
"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import ClientOnly from "@/components/ClientOnly";
import UserBadge from "@/components/dashboard/UserBadge";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faGauge,
  faFeather,
  faFolderTree,
  faTags,
  faImages,
  faUsers,
  faUserPlus,
  faMoon,
  faSun,
  faRightFromBracket,
  faList,
  faPlus,
  faIdBadge,
  faChevronDown,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

import "./dashboard.css";

/* ──────────────────────────────────────────────────────────────
   Types
────────────────────────────────────────────────────────────── */
type Role =
  | "administrator"
  | "editor"
  | "author"
  | "contributor"
  | "subscriber";

type NavNode = {
  label: string;
  icon: IconDefinition;
  href?: string;           // leaf item হলে href থাকবে
  children?: NavNode[];    // group হলে children থাকবে
  match?: (path: string) => boolean; // parent item active-state rules
};

/* ──────────────────────────────────────────────────────────────
   Tiny helper: fetch current user's role once (client side)
   Shape comes from /api/r2/me → { id, role, canPublishNow }
────────────────────────────────────────────────────────────── */
async function fetchRole(): Promise<Role> {
  try {
    const r = await fetch("/api/r2/me", { cache: "no-store" });
    if (!r.ok) return "subscriber";
    const j = (await r.json()) as { role?: Role };
    return (j.role as Role) || "subscriber";
  } catch {
    return "subscriber";
  }
}

/* ──────────────────────────────────────────────────────────────
   Role predicates (easy to tweak)
────────────────────────────────────────────────────────────── */
const isAdmin = (role: Role) => role === "administrator";
const isEditorOrHigher = (role: Role) =>
  role === "administrator" || role === "editor";
const isAuthorOrHigher = (role: Role) =>
  role === "administrator" || role === "editor" || role === "author";
const isContributorOrHigher = (role: Role) =>
  role === "administrator" || role === "editor" || role === "author" || role === "contributor";

/* ──────────────────────────────────────────────────────────────
   Role-based visibility rule
   - Return TRUE if an href should be visible for the given role
   - Keep all your paths here in one place → very easy to edit later
────────────────────────────────────────────────────────────── */
function visibleFor(href: string | undefined, role: Role): boolean {
  if (!href) return true;

  // Always visible
  if (href === "/dashboard") return true;               // Overview
  if (href === "/dashboard/profile") return true;       // Profile

  // Subscribers: only Overview + Profile
  if (role === "subscriber") return false;

  // Users group (list + add) → Admin only
  if (href.startsWith("/dashboard/users")) {
    return isAdmin(role);
  }

  // Everything else (Posts, Add New, Categories, Tags, Media...) → Contributor+
  return isContributorOrHigher(role);
}

/* ──────────────────────────────────────────────────────────────
   Build the tree (flat definition with icons)
   - Group nodes contain children[]
   - You can add more items safely; just ensure `visibleFor()` covers them
────────────────────────────────────────────────────────────── */
function buildNavTree(role: Role): NavNode[] {
  // Base tree (no filtering here)
  const tree: NavNode[] = [
    { label: "Overview", href: "/dashboard", icon: faGauge },

    {
      label: "Posts",
      icon: faFeather,
      children: [
        { label: "All Posts", href: "/dashboard/posts", icon: faList },
        { label: "Add New", href: "/dashboard/posts/new", icon: faPlus },
        { label: "Categories", href: "/dashboard/categories", icon: faFolderTree },
        { label: "Tags", href: "/dashboard/tags", icon: faTags },
      ],
      // parent is active if any child matches
      match: (p) =>
        p.startsWith("/dashboard/posts") ||
        p.startsWith("/dashboard/categories") ||
        p.startsWith("/dashboard/tags"),
    },

    { label: "Media", href: "/dashboard/media", icon: faImages },

    {
      label: "Users",
      icon: faUsers,
      children: [
        { label: "All Users", href: "/dashboard/users", icon: faUsers },
        { label: "Add New", href: "/dashboard/users/new", icon: faUserPlus },
        { label: "Profile", href: "/dashboard/profile", icon: faIdBadge }, // profile kept here for convenience
      ],
      match: (p) => p.startsWith("/dashboard/users") || p.startsWith("/dashboard/profile"),
    },
  ];

  // Filter by role (leafs first, then drop empty groups)
  const filterNode = (node: NavNode): NavNode | null => {
    if (node.children?.length) {
      const kept = node.children
        .map(filterNode)
        .filter(Boolean) as NavNode[];

      if (!kept.length) return null;
      return { ...node, children: kept };
    }
    // leaf
    return visibleFor(node.href, role) ? node : null;
  };

  // Special case: Profile should always be visible even if Users group is hidden.
  // We’ll ensure a top-level Profile exists for subscriber role.
  const filtered = tree
    .map(filterNode)
    .filter(Boolean) as NavNode[];

  if (role === "subscriber") {
    // Add a top-level Profile if it isn't already visible through Users group
    const hasProfile =
      filtered.some(
        (n) => n.href === "/dashboard/profile" ||
          n.children?.some((c) => c.href === "/dashboard/profile")
      );
    if (!hasProfile) {
      filtered.push({ label: "Profile", href: "/dashboard/profile", icon: faIdBadge });
    }
  }

  return filtered;
}

/* ──────────────────────────────────────────────────────────────
   Component
────────────────────────────────────────────────────────────── */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const router = useRouter();

  // Theme
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    const saved =
      (localStorage.getItem("ui.theme") as "dark" | "light") ||
      (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(saved);
  }, []);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("ui.theme", theme);
  }, [theme]);

  // Sidebar (mobile)
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  // Current role (defaults to subscriber until we fetch)
  const [role, setRole] = useState<Role>("subscriber");
  const [roleLoading, setRoleLoading] = useState(true);
  useEffect(() => {
    (async () => {
      setRoleLoading(true);
      const r = await fetchRole();
      setRole(r);
      setRoleLoading(false);
    })();
  }, []);

  // Role-aware tree
  const navTree = useMemo(() => buildNavTree(role), [role]);

  // Expanded groups (auto-expand on path)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const node of navTree) {
      if (node.children?.length) {
        const activeGroup =
          node.match?.(pathname) ||
          node.children.some((c) => (c.href ? pathname.startsWith(c.href) : false));
        if (activeGroup) next[node.label] = true;
      }
    }
    setExpanded((prev) => ({ ...prev, ...next }));
  }, [pathname, navTree]);

  function toggleGroup(label: string) {
    setExpanded((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  async function handleSignOut() {
    try {
      await signOut({ redirect: false });
      router.replace("/");
    } catch {
      // ignore
    }
  }

  // Active helper for links
  const isActive = (href?: string) => {
    if (!href) return false;
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <ClientOnly>
      <div className="dash-root">
        {/* Topbar */}
        <header className="dash-topbar">
          <button className="icon-btn" aria-label="Toggle sidebar" onClick={() => setOpen((v) => !v)}>
            <FontAwesomeIcon icon={faBars} />
          </button>

          {/* Brand → User badge */}
          <Suspense
            fallback={
              <span className="brand user-badge" aria-busy="true" style={{ opacity: 0.6 }}>
                <span
                  className="user-avatar"
                  style={{ display: "inline-block", width: 28, height: 28, borderRadius: "9999px", background: "var(--muted-200)" }}
                />
                <span style={{ marginLeft: 8 }}>Loading…</span>
              </span>
            }
          >
            <UserBadge />
          </Suspense>

          <div className="spacer" />

          <button
            className="icon-btn"
            aria-label="Toggle theme"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            title={theme === "dark" ? "Switch to light" : "Switch to dark"}
          >
            <FontAwesomeIcon icon={theme === "dark" ? faSun : faMoon} />
          </button>

          <button className="icon-btn" onClick={handleSignOut} title="Sign out" aria-label="Sign out">
            <FontAwesomeIcon icon={faRightFromBracket} />
          </button>
        </header>

        {/* Sidebar */}
        <aside className={`dash-sidebar ${open ? "open" : ""}`}>
          <nav className="nav" aria-busy={roleLoading}>
            {navTree.map((node) =>
              node.children?.length ? (
                <div
                  key={node.label}
                  className={`nav-group ${node.match?.(pathname) ? "active" : ""}`}
                >
                  <button
                    className="nav-link"
                    aria-expanded={!!expanded[node.label]}
                    aria-controls={`group-${node.label}`}
                    onClick={() => toggleGroup(node.label)}
                    type="button"
                  >
                    <FontAwesomeIcon icon={node.icon} className="nav-ic" />
                    <span>{node.label}</span>
                    <FontAwesomeIcon
                      icon={faChevronDown}
                      className={`nav-caret ${expanded[node.label] ? "open" : ""}`}
                    />
                  </button>

                  <div id={`group-${node.label}`} className={`nav-children ${expanded[node.label] ? "open" : ""}`}>
                    {node.children.map((child) => (
                      <Link
                        key={child.href ?? child.label}
                        href={child.href ?? "#"}
                        className={`nav-sublink ${isActive(child.href) ? "active" : ""}`}
                      >
                        <FontAwesomeIcon icon={child.icon} className="nav-ic" />
                        <span>{child.label}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <Link
                  key={node.href ?? node.label}
                  href={node.href ?? "#"}
                  className={`nav-link ${isActive(node.href) ? "active" : ""}`}
                >
                  <FontAwesomeIcon icon={node.icon} className="nav-ic" />
                  <span>{node.label}</span>
                </Link>
              )
            )}
          </nav>
        </aside>

        {/* Main content */}
        <main className="dash-main">
          <div className="dash-container">{children}</div>
        </main>

        {/* Mobile overlay */}
        {open && (
          <button
            aria-label="Close sidebar"
            className="sidebar-overlay"
            onClick={() => setOpen(false)}
          />
        )}
      </div>
    </ClientOnly>
  );
}
