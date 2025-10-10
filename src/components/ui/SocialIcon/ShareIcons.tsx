// src/components/ui/SocilaIcon/ShareIcons.tsx

"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconProp } from "@fortawesome/fontawesome-svg-core";
import {
  faFacebookF,
  faXTwitter,       // not available in some versions
  faTwitter,        // fallback
  faWhatsapp,
} from "@fortawesome/free-brands-svg-icons";
import { faLink, faPrint } from "@fortawesome/free-solid-svg-icons";
import styles from "./ShareIcons.module.css";

type Props = {
  className?: string;
  title: string;
  absUrl: string;         // absolute URL
  printSelector?: string; // defaults to "#print-article"
};

export default function ShareIcons({
  className,
  title,
  absUrl,
  printSelector = "#print-article",
}: Props) {
  const enc = (s: string) => encodeURIComponent(s);

  const hrefs = {
    fb: `https://www.facebook.com/sharer/sharer.php?u=${enc(absUrl)}`,
    x:  `https://twitter.com/intent/tweet?url=${enc(absUrl)}&text=${enc(title)}`,
    wa: `https://api.whatsapp.com/send?text=${enc(title)}%20${enc(absUrl)}`,
  };

  // Some packages don’t ship faXTwitter – fallback to faTwitter
  const xIcon = ((faXTwitter as unknown as IconProp) ?? (faTwitter as IconProp)) as IconProp;

  const onCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(absUrl);
      // simple toast
      alert("লিংক কপি হয়েছে!");
    } catch {
      // silent
    }
  };

  const onPrint = (e: React.MouseEvent) => {
    e.preventDefault();
    // যদি নির্দিষ্ট ব্লক প্রিন্ট করতে চাও, CSS @media print দিয়ে handle করো
    const node = document.querySelector(printSelector);
    // Node না থাকলেও full-page print হবে
    window.print();
  };

  return (
    <div className={`${styles.root} ${className ?? ""}`}>
      <a
        className={`${styles.btn} ${styles.facebook}`}
        href={hrefs.fb}
        target="_blank"
        rel="noopener noreferrer"
        title="Facebook"
        aria-label="Share on Facebook"
      >
        <FontAwesomeIcon icon={faFacebookF as IconProp} />
      </a>

      <a
        className={`${styles.btn} ${styles.x}`}
        href={hrefs.x}
        target="_blank"
        rel="noopener noreferrer"
        title="X (Twitter)"
        aria-label="Share on X"
      >
        <FontAwesomeIcon icon={xIcon} />
      </a>

      <a
        className={`${styles.btn} ${styles.whatsapp}`}
        href={hrefs.wa}
        target="_blank"
        rel="noopener noreferrer"
        title="WhatsApp"
        aria-label="Share on WhatsApp"
      >
        <FontAwesomeIcon icon={faWhatsapp as IconProp} />
      </a>

      <button
        type="button"
        onClick={onCopy}
        className={`${styles.btn} ${styles.copy}`}
        title="Copy link"
        aria-label="Copy link"
      >
        <FontAwesomeIcon icon={faLink as IconProp} />
      </button>

      <button
        type="button"
        onClick={onPrint}
        className={styles.btn}
        title="প্রিন্ট"
        aria-label="Print article"
      >
        <FontAwesomeIcon icon={faPrint as IconProp} />
      </button>
    </div>
  );
}