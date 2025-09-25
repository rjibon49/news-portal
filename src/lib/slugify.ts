// src/lib/slugify.ts

export type SlugifyOptions = {
  /** keepUnicode=true হলে বাংলা/ইউনিকোড অক্ষর রাখা হবে */
  keepUnicode?: boolean;
  /** সর্বোচ্চ দৈর্ঘ্য (WP style) */
  maxLength?: number;
};

/**
 * বাংলা + ইংরেজি সাপোর্টেড slugify।
 * - keepUnicode=true: [\u0980-\u09FF] (বাংলা) অক্ষর রাখা হয়
 * - keepUnicode=false: pure ASCII (diacritics strip)
 */
export function slugify(input: string, opts: SlugifyOptions = {}): string {
  const { keepUnicode = true, maxLength = 190 } = opts;

  let s = (input ?? "").toString().trim().toLowerCase();

  // বিভিন্ন ধরনের ড্যাশ/হাইফেনকে সাধারণ হাইফেনে রূপান্তর
  s = s.replace(/[\u2010-\u2015\u2212\u2043\uFE58\uFE63\uFF0D]/g, "-");

  if (keepUnicode) {
    // বাংলা + ইংরেজি, স্পেস/হাইফেন ব্যতীত বাকিগুলো বাদ
    s = s
      .normalize("NFKD")
      .replace(/[^\u0980-\u09FFa-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  } else {
    // pure ASCII
    s = s
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")   // diacritics strip
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  // সর্বোচ্চ দৈর্ঘ্য কেটে নিন, তারপর আবার শেষের হাইফেন ট্রিম
  s = s.slice(0, maxLength).replace(/-+$/g, "");

  // খালি হয়ে গেলে fallback
  return s || "n-a";
}

export default slugify;
