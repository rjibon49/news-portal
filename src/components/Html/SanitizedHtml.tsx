// // src/components/HTML/SanitizedHtml.tsx
// 'use client';

// import { useEffect, useMemo, useRef } from 'react';
// import DOMPurify from 'isomorphic-dompurify';
// import type { Config as DOMPurifyConfig } from 'dompurify';

// type RunMode = 'none' | 'safe' | 'all';

// type Props = {
//   html: string;
//   className?: string;
//   /** 'safe' = external scripts from allowlist only (default)
//    *  'all'  = run both external + inline scripts (use when you trust the HTML)
//    *  'none' = do not run scripts */
//   runScripts?: RunMode;
// };

// /* ---------------- Script allowlist for 'safe' mode ---------------- */
// const SCRIPT_HOST_WHITELIST = [
//   'pagead2.googlesyndication.com',
//   'securepubads.g.doubleclick.net',
//   'static.doubleclick.net',
//   'googlesyndication.com',
//   'showcase.infostation.co',
//   'infostation.digital',
// ] as const;

// /* ---------------- Small helpers (type-safe, no `any`) ------------- */
// type AdsQueue = { push: (arg?: unknown) => number };
// function isAdsQueue(v: unknown): v is AdsQueue {
//   return !!v && typeof (v as { push?: unknown }).push === 'function';
// }

// function sanitizePostHtml(html: string): string {
//   const cfg: DOMPurifyConfig = {
//     ADD_TAGS: [
//       // media/embeds
//       'iframe', 'audio', 'video', 'source', 'figure', 'figcaption',
//       // ads
//       'ins',
//       // meta/link/style/noscript sometimes appear in blocks
//       'meta', 'link', 'style', 'noscript'
//     ],
//     ADD_ATTR: [
//       // common media attrs
//       'src', 'width', 'height', 'title', 'type', 'preload', 'controls',
//       'controlslist', 'autoplay', 'muted', 'loop', 'poster', 'playsinline',
//       // iframe attrs
//       'allow', 'allowfullscreen', 'frameborder', 'loading', 'referrerpolicy', 'sandbox',
//       // link/meta
//       'href', 'rel', 'target', 'integrity', 'crossorigin', 'name', 'content',
//       // presentation
//       'class', 'style',
//       // adsbygoogle & other data-* hooks
//       'data-ad-client', 'data-ad-slot', 'data-ad-format',
//       'data-full-width-responsive', 'data-adsbygoogle-status',
//       // generic data-*
//       'data-*'
//     ],
//     ALLOW_DATA_ATTR: true,
//     FORBID_TAGS: ['script'],           // scripts will be replayed manually
//     KEEP_CONTENT: false,
//     ALLOWED_URI_REGEXP:
//       /^(?:(?:https?|ftp|mailto|tel|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
//   };

//   // Add loading="lazy" to allowed iframes
//   const withLazyIframes = html.replace(
//     /<iframe\b([^>]*)>/gi,
//     (_m, attrs) => `<iframe loading="lazy"${/^\s/.test(attrs) ? '' : ' '}${attrs}>`
//   );

//   return DOMPurify.sanitize(withLazyIframes, cfg) as string;
// }

// /* ================================================================== */

// export default function SanitizedHtml({ html, className, runScripts = 'safe' }: Props) {
//   const ref = useRef<HTMLDivElement>(null);
//   const safeHtml = useMemo(() => sanitizePostHtml(html), [html]);

//   /* 1) Initialize AdSense blocks inside this HTML (if present) */
//   useEffect(() => {
//     const root = ref.current;
//     if (!root) return;

//     const ins = root.querySelectorAll<HTMLModElement>(
//       'ins.adsbygoogle:not([data-adsbygoogle-status])'
//     );

//     // Access window.adsbygoogle without redeclaring global types
//     const w = window as Window & { adsbygoogle?: unknown };
//     if (ins.length && isAdsQueue(w.adsbygoogle)) {
//       ins.forEach(() => w.adsbygoogle!.push({}));
//     }
//   }, [safeHtml]);

//   /* 2) Optionally replay scripts from the original HTML */
//   useEffect(() => {
//     if (runScripts === 'none') return;

//     const root = ref.current;
//     if (!root) return;

//     // Parse original HTML in an off-document container
//     const doc = document.implementation.createHTMLDocument('');
//     const container = doc.createElement('div');
//     container.innerHTML = html;

//     const scripts = Array.from(container.querySelectorAll('script'));
//     if (!scripts.length) return;

//     scripts.forEach((s) => {
//       const src = s.getAttribute('src');
//       const hasSrc = typeof src === 'string' && src.length > 0;

//       // In 'safe' mode only allow external scripts from our allowlist
//       if (runScripts === 'safe') {
//         if (!hasSrc) return;
//         try {
//           const url = new URL(src!, location.origin);
//           const allowed = SCRIPT_HOST_WHITELIST.some(
//             (h) => url.hostname === h || url.hostname.endsWith(`.${h}`)
//           );
//           if (!allowed) return;

//           const el = document.createElement('script');
//           el.src = url.href;
//           if (s.async) el.async = true;
//           if (s.defer) el.defer = true;

//           // copy only data-* attributes
//           Array.from(s.attributes).forEach((a) => {
//             if (a.name === 'src') return;
//             if (a.name.startsWith('data-')) el.setAttribute(a.name, a.value);
//           });

//           root.appendChild(el);
//         } catch {
//           /* ignore invalid URLs */
//         }
//         return;
//       }

//       // In 'all' mode run both external + inline scripts
//       if (runScripts === 'all') {
//         if (hasSrc) {
//           try {
//             const url = new URL(src!, location.origin);
//             const el = document.createElement('script');
//             el.src = url.href;
//             if (s.async) el.async = true;
//             if (s.defer) el.defer = true;
//             Array.from(s.attributes).forEach((a) => {
//               if (a.name !== 'src') el.setAttribute(a.name, a.value);
//             });
//             root.appendChild(el);
//           } catch {
//             /* ignore invalid URLs */
//           }
//         } else {
//           const el = document.createElement('script');
//           el.textContent = s.textContent ?? '';
//           Array.from(s.attributes).forEach((a) => el.setAttribute(a.name, a.value));
//           root.appendChild(el);
//         }
//       }
//     });
//   }, [html, runScripts]);

//   /* 3) Harden external links opened in new tab */
//   useEffect(() => {
//     const root = ref.current;
//     if (!root) return;

//     root.querySelectorAll<HTMLAnchorElement>('a[target="_blank"]').forEach((a) => {
//       const rel = (a.getAttribute('rel') || '').split(/\s+/);
//       if (!rel.includes('noopener')) rel.push('noopener');
//       if (!rel.includes('noreferrer')) rel.push('noreferrer');
//       a.setAttribute('rel', rel.join(' ').trim());
//     });
//   }, [safeHtml]);

//   return (
//     <div
//       ref={ref}
//       className={className}
//       suppressHydrationWarning
//       dangerouslySetInnerHTML={{ __html: safeHtml }}
//     />
//   );
// }



// // // src/components/HTML/SanitizedHTml.tsx

// // 'use client';

// // import { useEffect, useMemo, useRef } from 'react';
// // import DOMPurify from 'isomorphic-dompurify';
// // import type { Config as DOMPurifyConfig } from 'dompurify';

// // type Props = {
// //   html: string;
// //   className?: string;
// // };

// // function sanitizePostHtml(html: string): string {
// //   const cfg: DOMPurifyConfig = {
// //     ADD_TAGS: ['iframe', 'audio', 'source', 'ins'],
// //     ADD_ATTR: [
// //       'src', 'width', 'height', 'title', 'allow', 'allowfullscreen',
// //       'frameborder', 'loading', 'referrerpolicy', 'sandbox',
// //       'controls', 'controlslist', 'autoplay', 'loop', 'muted', 'preload', 'type',
// //       'class', 'style',
// //       'data-ad-client', 'data-ad-slot', 'data-ad-format','div',
// //       'data-full-width-responsive', 'data-adsbygoogle-status'
// //     ],
// //     FORBID_TAGS: ['script', 'style'],
// //     KEEP_CONTENT: false,
// //     ALLOWED_URI_REGEXP:
// //       /^(?:(?:https?|ftp|mailto|tel|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
// //   };

// //   // Add loading="lazy" to iframes we allow
// //   const withLazy = html.replace(
// //     /<iframe\b([^>]*?)>/gi,
// //     (_m, attrs) => `<iframe loading="lazy"${/^\s/.test(attrs) ? '' : ' '}${attrs}></iframe>`
// //   );

// //   return DOMPurify.sanitize(withLazy, cfg) as string;
// // }

// // export default function SanitizedHtml({ html, className }: Props) {
// //   const ref = useRef<HTMLDivElement>(null);
// //   const safeHtml = useMemo(() => sanitizePostHtml(html), [html]);

// //   // Optional: trigger AdSense (if <ins class="adsbygoogle"> is present)
// //   useEffect(() => {
// //     const root = ref.current;
// //     if (!root) return;

// //     try {
// //       const ins = root.querySelectorAll<HTMLModElement>(
// //         'ins.adsbygoogle:not([data-adsbygoogle-status])'
// //       );
// //       if (ins.length && Array.isArray(window.adsbygoogle)) {
// //         ins.forEach(() => window.adsbygoogle!.push({}));
// //       }
// //     } catch {
// //       /* no-op */
// //     }
// //   }, [safeHtml]);

// //   return (
// //     <div
// //       ref={ref}
// //       className={className}
// //       suppressHydrationWarning
// //       dangerouslySetInnerHTML={{ __html: safeHtml }}
// //     />
// //   );
// // }
