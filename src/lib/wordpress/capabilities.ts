// src/lib/wordpress/capabilities.ts
export type CapMap = Record<string, boolean>;

export function parseWpCapabilities(val?: string | null): CapMap {
  const value = (val ?? "").trim();
  if (!value) return {};
  // Sometimes plugins store JSON. Try that first.
  try {
    const j = JSON.parse(value);
    if (j && typeof j === "object") return j as CapMap;
  } catch {}
  // Default: PHP serialized like a:1:{s:13:"administrator";b:1;}
  const caps: CapMap = {};
  const re = /"([a-zA-Z0-9_]+)";b:1/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value))) caps[m[1]] = true;
  return caps;
}

export function primaryRoleLabel(caps: CapMap): string {
  if (caps.administrator) return "Administrator";
  if (caps.editor) return "Editor";
  if (caps.author) return "Author";
  if (caps.contributor) return "Contributor";
  if (caps.subscriber) return "Subscriber";
  const keys = Object.keys(caps);
  if (keys.length) return keys[0]; // custom role key
  return "No role";
}
