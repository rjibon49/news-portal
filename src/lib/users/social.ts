// src/lib/users/social.ts

export type SocialKey =
  | "facebook" | "x_username" | "tiktok" | "linkedin" | "pinterest" | "behance"
  | "github" | "flickr" | "tumblr" | "dribbble" | "soundcloud" | "instagram"
  | "vimeo" | "youtube" | "reddit" | "vk" | "weibo" | "twitch" | "rss"
  | "myspace" | "wikipedia";

export const SOCIAL_FIELDS: Array<{ key: SocialKey; label: string; placeholder?: string }> = [
  { key: "facebook", label: "Facebook profile URL", placeholder: "https://facebook.com/username" },
  { key: "x_username", label: "X username (without @)", placeholder: "elonmusk" },
  { key: "tiktok", label: "Tiktok", placeholder: "https://www.tiktok.com/@user" },
  { key: "linkedin", label: "LinkedIn profile URL" },
  { key: "pinterest", label: "Pinterest profile URL" },
  { key: "behance", label: "Behance" },
  { key: "github", label: "Github" },
  { key: "flickr", label: "Flickr" },
  { key: "tumblr", label: "Tumblr profile URL" },
  { key: "dribbble", label: "Dribbble" },
  { key: "soundcloud", label: "SoundCloud profile URL" },
  { key: "instagram", label: "Instagram profile URL" },
  { key: "vimeo", label: "Vimeo" },
  { key: "youtube", label: "YouTube profile URL" },
  { key: "reddit", label: "Reddit" },
  { key: "vk", label: "Vk" },
  { key: "weibo", label: "Weibo" },
  { key: "twitch", label: "Twitch" },
  { key: "rss", label: "Rss" },
  { key: "myspace", label: "MySpace profile URL" },
  { key: "wikipedia", label: "Wikipedia page about you" },
];
