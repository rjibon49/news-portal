// src/lib/text/cleanForTts.ts

export function cleanForTts(htmlOrText: string, maxChars = 10000): string {
  const withoutTags = (htmlOrText || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");

  const decoded = withoutTags
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');

  // collapse whitespace
  const collapsed = decoded.replace(/\s+/g, " ").trim();
  return collapsed.slice(0, maxChars);
}
