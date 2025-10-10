import Image from "next/image";
import Link from "next/link";
import styles from "./Footer.module.css";

/* Font Awesome */
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { IconProp } from "@fortawesome/fontawesome-svg-core";
import {
  faFacebookF,
  // কিছু প্যাকে faXTwitter না-ও থাকতে পারে; fallback হিসেবে faTwitter রাখলাম
  faXTwitter,
  faTwitter,
  faYoutube,
  faInstagram,
} from "@fortawesome/free-brands-svg-icons";

// ছোট util: IconDefinition → IconProp কাস্ট
const toIcon = (i: unknown) => i as IconProp;

export default function Footer() {
  // faXTwitter না থাকলে faTwitter
  const twitterIcon = (faXTwitter ?? faTwitter) as unknown as IconProp;

  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        {/* Col 1: Logo */}
        <div className={styles.colLogo}>
          {/* <Link href="/" aria-label="Home">
            <Image
              src="/brand/channel-i-logo.png"
              alt="Channel i"
              width={140}
              height={56}
              className={styles.logo}
            />
          </Link> */}
          <h1>News Portal</h1>
        </div>

        {/* Col 2: Address / Publisher */}
        <div className={styles.colText}>
          <p className={styles.links}>
            <a href="https://www.channeli.com.bd" target="_blank" rel="noopener noreferrer">
              www.example.com.bd
            </a>
            ,<br />
            <a href="https://www.channelionline.com" target="_blank" rel="noopener noreferrer">
              www.exampple.com
            </a>
          </p>
        </div>

        {/* Col 3: Contacts */}
        <div className={styles.colText}>{/* ... */}</div>

        {/* Col 4: Quick Links */}
        <nav className={styles.colNav} aria-label="Footer">
          <ul>
            <li><Link href="#">Example Link 1</Link></li>
            <li><Link href="#">Example Link 2</Link></li>
            <li><Link href="#">Example Link 3</Link></li>
          </ul>

          <div className={styles.social}>
            <a href="https://facebook.com/channelionline" target="_blank" aria-label="Facebook" rel="noopener noreferrer">
              <FontAwesomeIcon icon={toIcon(faFacebookF)} size="lg" />
            </a>
            <a href="https://x.com" target="_blank" aria-label="X (Twitter)" rel="noopener noreferrer">
              <FontAwesomeIcon icon={twitterIcon} size="lg" />
            </a>
            <a href="https://youtube.com/channeli" target="_blank" aria-label="YouTube" rel="noopener noreferrer">
              <FontAwesomeIcon icon={toIcon(faYoutube)} size="lg" />
            </a>
            <a href="https://instagram.com" target="_blank" aria-label="Instagram" rel="noopener noreferrer">
              <FontAwesomeIcon icon={toIcon(faInstagram)} size="lg" />
            </a>
          </div>
        </nav>
      </div>

      <div className={styles.meta}>
        © {new Date().getFullYear()} News Portal — All rights reserved.
      </div>
    </footer>
  );
}
