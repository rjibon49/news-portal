"use client";

import Image from "next/image";
import styles from "./FeaturedMedia.module.css";
import LightboxImage from "@/components/LightboxImage/LightboxImage";

type Props = {
  imageUrl: string;                 // must be a concrete string
  imageAlt?: string;
  imageCaptionHtml?: string;
  ratio?: string;                   // "16/9", "4/3", "1/1"…
  videoUrl?: string | null;         // YouTube embed URL (if any)
};

export default function FeaturedMedia({
  imageUrl,
  imageAlt = "",
  imageCaptionHtml,
  ratio = "16/9",
  videoUrl,
}: Props) {
  return (
    <figure className={styles.figure}>
      <LightboxImage
        src={imageUrl}
        alt={imageAlt}
        captionHtml={imageCaptionHtml}
        videoUrl={videoUrl || null}
        className={styles.lightboxTrigger}
      >
        <div className={styles.box} style={{ ["--ar" as unknown as string]: ratio }}>
          <Image
            src={imageUrl}
            alt={imageAlt}
            fill
            sizes="(min-width:1280px) 1024px, (min-width:768px) 90vw, 100vw"
            className={styles.img}
            priority
          />
          {videoUrl && (
            <span className={styles.play} aria-hidden>
              <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </span>
          )}
        </div>
      </LightboxImage>

      {imageCaptionHtml && (
        <figcaption
          className={styles.caption}
          dangerouslySetInnerHTML={{ __html: imageCaptionHtml }}
        />
      )}
    </figure>
  );
}
