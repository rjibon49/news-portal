// src/lib/bangladesh-time.ts

/**
 * বাংলাদেশ টাইমজোন (UTC+6) সম্পর্কিত ইউটিলিটি ফাংশন
 */

/**
 * বর্তমান বাংলাদেশ সময় পান
 */
export function getCurrentBangladeshTime(): { local: string; utc: string } {
  const now = new Date();
  const bangladeshOffset = 6 * 60 * 60 * 1000; // UTC+6 in milliseconds
  
  // বাংলাদেশ টাইম (বর্তমান UTC + 6 ঘন্টা)
  const bangladeshTime = new Date(now.getTime() + bangladeshOffset);
  
  const pad = (n: number) => String(n).padStart(2, "0");
  
  // বাংলাদেশ লোকাল টাইম (MySQL ফরম্যাট)
  const localStr = `${bangladeshTime.getUTCFullYear()}-${pad(bangladeshTime.getUTCMonth() + 1)}-${pad(bangladeshTime.getUTCDate())} ` +
                   `${pad(bangladeshTime.getUTCHours())}:${pad(bangladeshTime.getUTCMinutes())}:${pad(bangladeshTime.getUTCSeconds())}`;

  // UTC টাইম
  const utcStr = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ` +
                 `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;

  return { local: localStr, utc: utcStr };
}

/**
 * তারিখ স্ট্রিংকে বাংলাদেশ সময়ে কনভার্ট করুন
 */
export function toBangladeshDateTime(input: string): { local: string; utc: string; isFuture: boolean } {
  try {
    const d = new Date(input);
    if (isNaN(d.getTime())) throw new Error("Invalid date");

    // বাংলাদেশ টাইমজোন (UTC+6)
    const bangladeshOffset = 6 * 60 * 60 * 1000;
    
    // বাংলাদেশ টাইম (ইনপুট + 6 ঘন্টা)
    const bangladeshTime = new Date(d.getTime() + bangladeshOffset);
    
    const pad = (n: number) => String(n).padStart(2, "0");
    
    // বাংলাদেশ লোকাল টাইম
    const localStr = `${bangladeshTime.getUTCFullYear()}-${pad(bangladeshTime.getUTCMonth() + 1)}-${pad(bangladeshTime.getUTCDate())} ` +
                     `${pad(bangladeshTime.getUTCHours())}:${pad(bangladeshTime.getUTCMinutes())}:${pad(bangladeshTime.getUTCSeconds())}`;

    // UTC টাইম
    const utcTime = new Date(d.getTime());
    const utcStr = `${utcTime.getUTCFullYear()}-${pad(utcTime.getUTCMonth() + 1)}-${pad(utcTime.getUTCDate())} ` +
                   `${pad(utcTime.getUTCHours())}:${pad(utcTime.getUTCMinutes())}:${pad(utcTime.getUTCSeconds())}`;

    const isFuture = bangladeshTime.getTime() > Date.now();

    return { local: localStr, utc: utcStr, isFuture };
  } catch (error) {
    console.error('Error in toBangladeshDateTime:', error);
    throw error;
  }
}

/**
 * MySQL DATETIME কে বাংলাদেশ সময়ে ফরম্যাট করুন
 */
export function formatMySQLDateTimeToBD(mysqlDateTime: string): string {
  if (!mysqlDateTime) return "—";
  
  try {
    // MySQL DATETIME ফরম্যাট: "YYYY-MM-DD HH:MM:SS"
    const [datePart, timePart] = mysqlDateTime.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes, seconds] = timePart.split(':').map(Number);
    
    // UTC তারিখ তৈরি করুন (MySQL UTC তে স্টোর করে)
    const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
    
    // বাংলাদেশ টাইমজোনে কনভার্ট করুন (UTC+6)
    const bangladeshTime = new Date(utcDate.getTime() + (6 * 60 * 60 * 1000));
    
    // বাংলাদেশ টাইমজোনে ফরম্যাট করুন
    return bangladeshTime.toLocaleString("en-BD", {
      timeZone: "Asia/Dhaka",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    });
  } catch (e) {
    console.error("Date formatting error for:", mysqlDateTime, e);
    return "—";
  }
}

/**
 * datetime-local input এর জন্য বর্তমান বাংলাদেশ সময় পান
 */
export function getCurrentDateTimeForInput(): string {
  const now = new Date();
  const bangladeshOffset = 6 * 60 * 60 * 1000;
  const bangladeshTime = new Date(now.getTime() + bangladeshOffset);
  
  const pad = (n: number) => String(n).padStart(2, "0");
  
  return `${bangladeshTime.getUTCFullYear()}-${pad(bangladeshTime.getUTCMonth() + 1)}-${pad(bangladeshTime.getUTCDate())}T${pad(bangladeshTime.getUTCHours())}:${pad(bangladeshTime.getUTCMinutes())}`;
}

/**
 * ISO তারিখ স্ট্রিংকে datetime-local ফরম্যাটে কনভার্ট করুন
 */
export function isoToDateTimeLocal(isoString: string): string {
  const date = new Date(isoString);
  const bangladeshOffset = 6 * 60 * 60 * 1000;
  const bangladeshTime = new Date(date.getTime() + bangladeshOffset);
  
  const pad = (n: number) => String(n).padStart(2, "0");
  
  return `${bangladeshTime.getUTCFullYear()}-${pad(bangladeshTime.getUTCMonth() + 1)}-${pad(bangladeshTime.getUTCDate())}T${pad(bangladeshTime.getUTCHours())}:${pad(bangladeshTime.getUTCMinutes())}`;
}