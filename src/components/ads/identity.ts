// src/components/ads/identity.ts

export function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = crypto.getRandomValues(new Uint32Array(1))[0] & 0xf;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function get(name: string) {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : null;
}
function set(name: string, val: string, maxAgeSec: number) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(val)}; path=/; samesite=lax; max-age=${maxAgeSec}`;
}

// ১ বছর বৈধ
export function getUid(): string {
  let v = get("ads_uid");
  if (!v) {
    v = uuid();
    set("ads_uid", v, 3600 * 24 * 365);
  }
  return v;
}

// ৩০-মিনিট সেশন (প্রতি কলেই রিফ্রেশ)
export function getSid(): string {
  let v = get("ads_sid");
  if (!v) v = uuid();
  set("ads_sid", v, 60 * 30);
  return v;
}
