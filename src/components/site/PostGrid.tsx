//src/components/site/PostGrid.tsx

import styles from "./PostGrid.module.css";

export default function PostGrid({ children }: { children: React.ReactNode }) {
  return <div className={styles.grid}>{children}</div>;
}
