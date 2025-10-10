// src/component/layout/Header/header.tsx

"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import styles from "./Header.module.css";
import { MAIN_MENU } from "@/config/menu";

/* Font Awesome */
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { IconProp } from "@fortawesome/fontawesome-svg-core";
import {
  faFacebookF,
  faXTwitter,
  faTwitter,
  faYoutube,
  faInstagram,
} from "@fortawesome/free-brands-svg-icons";
import { faBars, faXmark, faMoon, faSun } from "@fortawesome/free-solid-svg-icons";

import SearchBox from "../../Search/SearchBox";
const toIcon = (i: unknown) => i as IconProp;

type Theme = "light" | "dark";

/** read current theme from DOM/localStorage/prefers-color-scheme */
function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const saved = localStorage.getItem("theme");
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export default function Header() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");

  const toggle = () => setOpen((v) => !v);
  const close = () => setOpen(false);

  // lock body scroll when drawer open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = open ? "hidden" : prev || "";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // initialize theme on mount (avoid flash)
  useEffect(() => {
    const t = getInitialTheme();
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
  }, []);

  // apply & persist theme
  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
      return next;
    });
  };

  const twitterIcon = (faXTwitter ?? faTwitter) as unknown as IconProp;

  return (
    <header className={styles.header}>
      {/* Top bar */}
      <div className={styles.top}>
        <div className={styles.container}>
          <div className={styles.logoWrap}>
            <Link href="/" className={styles.logoLink} aria-label="News Portal Home" onClick={close}>
              <h1>News Portal</h1>
            </Link>
          </div>

          {/* desktop socials (hidden on <=1024) */}
          <nav className={styles.socials} aria-label="Social media">
            <a href="https://www.facebook.com/" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className={styles.social} title="Facebook">
              <FontAwesomeIcon icon={toIcon(faFacebookF)} size="lg" />
            </a>
            <a href="https://twitter.com/" target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)" className={styles.social} title="X (Twitter)">
              <FontAwesomeIcon icon={twitterIcon} size="lg" />
            </a>
            <a href="https://www.youtube.com/" target="_blank" rel="noopener noreferrer" aria-label="YouTube" className={styles.social} title="YouTube">
              <FontAwesomeIcon icon={toIcon(faYoutube)} size="lg" />
            </a>
            <a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className={styles.social} title="Instagram">
              <FontAwesomeIcon icon={toIcon(faInstagram)} size="lg" />
            </a>

            {/* Theme toggle (desktop) */}
            <button
              type="button"
              className={styles.themeToggle}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              title={theme === "dark" ? "Light mode" : "Dark mode"}
              onClick={toggleTheme}
            >
              <FontAwesomeIcon icon={toIcon(theme === "dark" ? faSun : faMoon)} />
            </button>
          </nav>

          {/* hamburger (<=1024 visible) */}
          <button
            className={styles.hamburger}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-controls="mobile-drawer"
            aria-expanded={open ? "true" : "false"}
            onClick={toggle}
            type="button"
          >
            <FontAwesomeIcon icon={open ? toIcon(faXmark) : toIcon(faBars)} />
          </button>
        </div>
      </div>

      {/* desktop menu bar (hidden on <=1024) */}
      <div className={styles.menuBar}>
        <div className={styles.container}>
          <nav className={styles.menu} aria-label="Primary">
            {MAIN_MENU.map((m) => (
              <Link key={m.href} href={m.href} className={styles.menuItem} onClick={close}>
                {m.label}
              </Link>
            ))}
          </nav>

          <Suspense fallback={null}>
            <SearchBox className={styles.search} />
          </Suspense>
        </div>
      </div>

      {/* off-canvas overlay + drawer (mobile) */}
      <div className={`${styles.ocOverlay} ${open ? styles.open : ""}`} onClick={close} aria-hidden={!open} />
      <aside
        id="mobile-drawer"
        className={`${styles.ocPanel} ${open ? styles.open : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile menu"
        aria-hidden={!open}
      >
        <div className={styles.ocInner}>
          <nav className={styles.ocMenu} aria-label="Primary">
            {MAIN_MENU.map((m) => (
              <Link key={m.href} href={m.href} className={styles.ocMenuItem} onClick={close}>
                {m.label}
              </Link>
            ))}
          </nav>

          <div className={styles.ocSearch}>
            <Suspense fallback={<div className="loader loader--sm" />}>
              <SearchBox />
            </Suspense>
          </div>

          <nav className={styles.ocSocials} aria-label="Social media">
            <a href="https://www.facebook.com/" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className={styles.social} title="Facebook">
              <FontAwesomeIcon icon={toIcon(faFacebookF)} size="lg" />
            </a>
            <a href="https://twitter.com/" target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)" className={styles.social} title="X (Twitter)">
              <FontAwesomeIcon icon={twitterIcon} size="lg" />
            </a>
            <a href="https://www.youtube.com/" target="_blank" rel="noopener noreferrer" aria-label="YouTube" className={styles.social} title="YouTube">
              <FontAwesomeIcon icon={toIcon(faYoutube)} size="lg" />
            </a>
            <a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className={styles.social} title="Instagram">
              <FontAwesomeIcon icon={toIcon(faInstagram)} size="lg" />
            </a>

            {/* Theme toggle (drawer) */}
            <div className={styles.ocToggleWrap}>
              <button
                type="button"
                className={styles.themeToggle}
                aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                title={theme === "dark" ? "Light mode" : "Dark mode"}
                onClick={toggleTheme}
              >
                <FontAwesomeIcon icon={toIcon(theme === "dark" ? faSun : faMoon)} />
              </button>
            </div>
          </nav>
        </div>
      </aside>
    </header>
  );
}
