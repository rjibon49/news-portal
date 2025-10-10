import styles from "./ArticleBody.module.css";

// Trusting server-side HTML from your WP-compatible API.
// If needed, add sanitizer here before dangerouslySetInnerHTML.
export default function ArticleBody({ html }: { html: string }) {
  return <div className={styles.body} dangerouslySetInnerHTML={{ __html: html }} />;
}
