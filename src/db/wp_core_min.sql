-- WordPress core (minimal) schema for MySQL 8+
-- Charset/Collation match: utf8mb4_unicode_ci

SET NAMES utf8mb4;
SET time_zone = "+00:00";

-- ------------------
-- USERS
-- ------------------
CREATE TABLE IF NOT EXISTS `wp_users` (
  `ID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_login` varchar(60) NOT NULL DEFAULT '',
  `user_pass` varchar(255) NOT NULL DEFAULT '',
  `user_nicename` varchar(50) NOT NULL DEFAULT '',
  `user_email` varchar(100) NOT NULL DEFAULT '',
  `user_url` varchar(100) NOT NULL DEFAULT '',
  `user_registered` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,   -- FIX
  `user_activation_key` varchar(255) NOT NULL DEFAULT '',
  `user_status` int(11) NOT NULL DEFAULT 0,
  `display_name` varchar(250) NOT NULL DEFAULT '',
  PRIMARY KEY (`ID`),
  KEY `user_login_key` (`user_login`),
  KEY `user_nicename` (`user_nicename`),
  KEY `user_email` (`user_email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_usermeta` (
  `umeta_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL DEFAULT 0,
  `meta_key` varchar(255) DEFAULT NULL,
  `meta_value` longtext,
  PRIMARY KEY (`umeta_id`),
  KEY `user_id` (`user_id`),
  KEY `meta_key` (`meta_key`(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------
-- TERMS & TAXONOMY
-- ------------------
CREATE TABLE IF NOT EXISTS `wp_terms` (
  `term_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(200) NOT NULL DEFAULT '',
  `slug` varchar(200) NOT NULL DEFAULT '',
  `term_group` bigint(10) NOT NULL DEFAULT 0,
  PRIMARY KEY (`term_id`),
  KEY `slug` (`slug`(191)),
  KEY `name` (`name`(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_term_taxonomy` (
  `term_taxonomy_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `term_id` bigint(20) unsigned NOT NULL DEFAULT 0,
  `taxonomy` varchar(32) NOT NULL DEFAULT '',
  `description` longtext,
  `parent` bigint(20) unsigned NOT NULL DEFAULT 0,
  `count` bigint(20) NOT NULL DEFAULT 0,
  PRIMARY KEY (`term_taxonomy_id`),
  UNIQUE KEY `term_id_taxonomy` (`term_id`,`taxonomy`),
  KEY `taxonomy` (`taxonomy`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_term_relationships` (
  `object_id` bigint(20) unsigned NOT NULL DEFAULT 0,
  `term_taxonomy_id` bigint(20) unsigned NOT NULL DEFAULT 0,
  `term_order` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`object_id`,`term_taxonomy_id`),
  KEY `term_taxonomy_id` (`term_taxonomy_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_termmeta` (
  `meta_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `term_id` bigint(20) unsigned NOT NULL DEFAULT 0,
  `meta_key` varchar(255) DEFAULT NULL,
  `meta_value` longtext,
  PRIMARY KEY (`meta_id`),
  KEY `term_id` (`term_id`),
  KEY `meta_key` (`meta_key`(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------
-- POSTS
-- ------------------
CREATE TABLE IF NOT EXISTS `wp_posts` (
  `ID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `post_author` bigint(20) unsigned NOT NULL DEFAULT 0,
  `post_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,          -- FIX
  `post_date_gmt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,      -- FIX
  `post_content` longtext NOT NULL,
  `post_title` text NOT NULL,
  `post_excerpt` text NOT NULL,
  `post_status` varchar(20) NOT NULL DEFAULT 'publish',
  `comment_status` varchar(20) NOT NULL DEFAULT 'open',
  `ping_status` varchar(20) NOT NULL DEFAULT 'open',
  `post_password` varchar(255) NOT NULL DEFAULT '',
  `post_name` varchar(200) NOT NULL DEFAULT '',
  `to_ping` text NOT NULL,
  `pinged` text NOT NULL,
  `post_modified` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP        -- FIX
                    ON UPDATE CURRENT_TIMESTAMP,                     -- FIX
  `post_modified_gmt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP    -- FIX
                       ON UPDATE CURRENT_TIMESTAMP,                  -- FIX
  `post_content_filtered` longtext NOT NULL,
  `post_parent` bigint(20) unsigned NOT NULL DEFAULT 0,
  `guid` varchar(255) NOT NULL DEFAULT '',
  `menu_order` int(11) NOT NULL DEFAULT 0,
  `post_type` varchar(20) NOT NULL DEFAULT 'post',
  `post_mime_type` varchar(100) NOT NULL DEFAULT '',
  `comment_count` bigint(20) NOT NULL DEFAULT 0,
  PRIMARY KEY (`ID`),
  KEY `post_name` (`post_name`(191)),
  KEY `type_status_date` (`post_type`,`post_status`,`post_date`,`ID`),
  KEY `post_parent` (`post_parent`),
  KEY `post_author` (`post_author`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_postmeta` (
  `meta_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `post_id` bigint(20) unsigned NOT NULL DEFAULT 0,
  `meta_key` varchar(255) DEFAULT NULL,
  `meta_value` longtext,
  PRIMARY KEY (`meta_id`),
  KEY `post_id` (`post_id`),
  KEY `meta_key` (`meta_key`(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------
-- COMMENTS
-- ------------------
CREATE TABLE IF NOT EXISTS `wp_comments` (
  `comment_ID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `comment_post_ID` bigint(20) unsigned NOT NULL DEFAULT 0,
  `comment_author` tinytext NOT NULL,
  `comment_author_email` varchar(100) NOT NULL DEFAULT '',
  `comment_author_url` varchar(200) NOT NULL DEFAULT '',
  `comment_author_IP` varchar(100) NOT NULL DEFAULT '',
  `comment_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,         -- FIX
  `comment_date_gmt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,     -- FIX
  `comment_content` text NOT NULL,
  `comment_karma` int(11) NOT NULL DEFAULT 0,
  `comment_approved` varchar(20) NOT NULL DEFAULT '1',
  `comment_agent` varchar(255) NOT NULL DEFAULT '',
  `comment_type` varchar(20) NOT NULL DEFAULT '',
  `comment_parent` bigint(20) unsigned NOT NULL DEFAULT 0,
  `user_id` bigint(20) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`comment_ID`),
  KEY `comment_post_ID` (`comment_post_ID`),
  KEY `comment_approved_date_gmt` (`comment_approved`,`comment_date_gmt`),
  KEY `comment_date_gmt` (`comment_date_gmt`),
  KEY `comment_parent` (`comment_parent`),
  KEY `comment_author_email` (`comment_author_email`(10)),
  KEY `user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_commentmeta` (
  `meta_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `comment_id` bigint(20) unsigned NOT NULL DEFAULT 0,
  `meta_key` varchar(255) DEFAULT NULL,
  `meta_value` longtext,
  PRIMARY KEY (`meta_id`),
  KEY `comment_id` (`comment_id`),
  KEY `meta_key` (`meta_key`(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------
-- LINKS (legacy)
-- ------------------
CREATE TABLE IF NOT EXISTS `wp_links` (
  `link_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `link_url` varchar(255) NOT NULL DEFAULT '',
  `link_name` varchar(255) NOT NULL DEFAULT '',
  `link_image` varchar(255) NOT NULL DEFAULT '',
  `link_target` varchar(25) NOT NULL DEFAULT '',
  `link_description` varchar(255) NOT NULL DEFAULT '',
  `link_visible` varchar(20) NOT NULL DEFAULT 'Y',
  `link_owner` bigint(20) unsigned NOT NULL DEFAULT 1,
  `link_rating` int(11) NOT NULL DEFAULT 0,
  `link_updated` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,         -- FIX
  `link_rel` varchar(255) NOT NULL DEFAULT '',
  `link_notes` mediumtext NOT NULL,
  `link_rss` varchar(255) NOT NULL DEFAULT '',
  PRIMARY KEY (`link_id`),
  KEY `link_visible` (`link_visible`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------
-- OPTIONS
-- ------------------
CREATE TABLE IF NOT EXISTS `wp_options` (
  `option_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `option_name` varchar(191) NOT NULL DEFAULT '',
  `option_value` longtext NOT NULL,
  `autoload` varchar(20) NOT NULL DEFAULT 'yes',
  PRIMARY KEY (`option_id`),
  UNIQUE KEY `option_name` (`option_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- wp_post_extra
--   - প্রতি পোস্টে সর্বোচ্চ একটি সারি (PRIMARY KEY = post_id)
--   - পোস্ট মুছে দিলে সাথে সাথে extra সারিটাও মুছে যাবে (ON DELETE CASCADE)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `wp_post_extra` (
  `post_id`     BIGINT(20) UNSIGNED NOT NULL,            -- FK -> wp_posts.ID (একইসাথে PK)
  `subtitle`    VARCHAR(255)      NULL,
  `highlight`   VARCHAR(255)      NULL,
  `format`      ENUM('standard','gallery','video') NOT NULL DEFAULT 'standard',
  `gallery_json` LONGTEXT         NULL,                  -- [{id: number, url?: string}, ...]
  `video_embed`  MEDIUMTEXT       NULL,                  -- ভিডিও URL/ইমবেড HTML
  `updated_at`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                                 ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`post_id`),

  CONSTRAINT `fk_post_extra_post`
    FOREIGN KEY (`post_id`)
    REFERENCES `wp_posts`(`ID`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- wp_post_gallery
--   - এক পোস্টে একাধিক মিডিয়া আইটেম (attachment post_id)
--   - পোস্ট/অ্যাটাচমেন্ট মুছে গেলে সারিও মুছে যাবে
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `wp_post_gallery` (
  `id`         BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `post_id`    BIGINT(20) UNSIGNED NOT NULL,             -- FK -> wp_posts.ID (parent post)
  `media_id`   BIGINT(20) UNSIGNED NOT NULL,             -- FK -> wp_posts.ID (attachment)
  `sort_order` INT(11)          NOT NULL DEFAULT 0,

  PRIMARY KEY (`id`),
  KEY `idx_gallery_post` (`post_id`),
  KEY `idx_gallery_post_order` (`post_id`, `sort_order`),
  KEY `idx_gallery_media` (`media_id`),

  CONSTRAINT `fk_gallery_post`
    FOREIGN KEY (`post_id`)
    REFERENCES `wp_posts`(`ID`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT `fk_gallery_media`
    FOREIGN KEY (`media_id`)
    REFERENCES `wp_posts`(`ID`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;

-- 1) wp_terms এ Others না থাকলে ইনসার্ট
INSERT INTO wp_terms (name, slug, term_group)
SELECT '0 Others', 'others', 0
WHERE NOT EXISTS (SELECT 1 FROM wp_terms WHERE slug = 'others');

-- 2) ওই term এর জন্য category taxonomy নিশ্চিত করা
INSERT INTO wp_term_taxonomy (term_id, taxonomy, description, parent, count)
SELECT t.term_id, 'category', '', 0, 0
FROM wp_terms t
LEFT JOIN wp_term_taxonomy tt
  ON tt.term_id = t.term_id AND tt.taxonomy = 'category'
WHERE t.slug = 'others' AND tt.term_taxonomy_id IS NULL;

/* ───────────────────────────────────────────────────────────
   Create default admin user (wp_users + wp_usermeta)
   How to use:
   1) bcrypt hash বানিয়ে @pass_hash এ বসান (e.g. $2y$10$....)
   2) পুরো স্ক্রিপ্ট রান করুন।
   ─────────────────────────────────────────────────────────── */

-- ► editable variables
SET @login        := 'masteradmin';
SET @email        := 'admin@example.com';
SET @display_name := 'Administrator';
SET @user_url     := '';

SET @pass_hash    := '$2b$10$7qlmh0mK8mrHLqPgAPvtZuldE3QNsOvkkMxbL2YXY6.hLcTb6xbFa';

-- ► computed nicename (সরল ভ্যারিয়েন্ট; প্রয়োজন হলে নিজে slugify করে দিন)
SET @nicename := LOWER(REPLACE(@display_name, ' ', '-'));

-- ── create user if not exists
INSERT INTO wp_users
  (user_login, user_pass, user_nicename, user_email, user_url,
   user_registered, user_activation_key, user_status, display_name)
SELECT
  @login, @pass_hash, @nicename, @email, @user_url,
  NOW(), '', 0, @display_name
WHERE NOT EXISTS (
  SELECT 1 FROM wp_users
  WHERE user_login = @login OR user_email = @email
);

-- ── fetch ID of that user (new or existing)
SET @uid := (
  SELECT ID FROM wp_users
  WHERE user_login = @login OR user_email = @email
  ORDER BY ID DESC LIMIT 1
);

-- ── ensure capabilities (administrator) and level (10)
-- wp_capabilities uses WP’s serialized format: a:1:{s:13:"administrator";b:1;}
INSERT INTO wp_usermeta (user_id, meta_key, meta_value)
SELECT @uid, 'wp_capabilities', 'a:1:{s:13:"administrator";b:1;}'
WHERE NOT EXISTS (
  SELECT 1 FROM wp_usermeta
  WHERE user_id = @uid AND meta_key = 'wp_capabilities'
);

INSERT INTO wp_usermeta (user_id, meta_key, meta_value)
SELECT @uid, 'wp_user_level', '10'
WHERE NOT EXISTS (
  SELECT 1 FROM wp_usermeta
  WHERE user_id = @uid AND meta_key = 'wp_user_level'
);

-- ── Post View Counter

-- একদিনে এক ইউজার/ডিভাইস একবার করে কাউন্ট
CREATE TABLE IF NOT EXISTS wp_post_view_hits (
  post_id BIGINT UNSIGNED NOT NULL,
  ymd DATE NOT NULL,
  fp VARBINARY(20) NOT NULL,    -- SHA1 first 20 bytes (বা HEX রাখলে VARCHAR(40))
  PRIMARY KEY (post_id, ymd, fp),
  KEY idx_ymd (ymd)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- অল-টাইম ভিউ
CREATE TABLE IF NOT EXISTS wp_post_view_total (
  post_id BIGINT UNSIGNED NOT NULL,
  views BIGINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- দৈনিক ভিউ
CREATE TABLE IF NOT EXISTS wp_post_view_daily (
  post_id BIGINT UNSIGNED NOT NULL,
  ymd DATE NOT NULL,
  views INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (post_id, ymd),
  KEY idx_ymd (ymd)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


/* 1) কোথায় অ্যাড বসবে: beforeTitle, beforeImage, ... */
CREATE TABLE ad_slot (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slot_key     VARCHAR(64) NOT NULL UNIQUE,   -- e.g. 'beforeTitle', 'afterBody'
  label        VARCHAR(120) NOT NULL,         -- human name
  enabled      TINYINT(1) NOT NULL DEFAULT 1, -- on/off from admin
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

/* 2) অ্যাড ক্রিয়েটিভ (image/html/script ইত্যাদি) */
CREATE TABLE ad_creative (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,              -- internal name
  type          ENUM('image','html','script') NOT NULL DEFAULT 'html',
  html          MEDIUMTEXT NULL,                    -- for 'html'/'script' types
  image_url     VARCHAR(1024) NULL,                 -- for 'image'
  click_url     VARCHAR(1024) NULL,                 -- target when clicked
  target_blank  TINYINT(1) NOT NULL DEFAULT 1,
  weight        INT NOT NULL DEFAULT 1,             -- rotation weight
  active_from   DATETIME NULL,
  active_to     DATETIME NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

/* 3) কোন slot-এ কোন creative যাবে + optional date window */
CREATE TABLE ad_placement (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slot_id       INT UNSIGNED NOT NULL,
  creative_id   INT UNSIGNED NOT NULL,
  weight        INT NOT NULL DEFAULT 1,            -- override or add to creative.weight
  active_from   DATETIME NULL,
  active_to     DATETIME NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_ap_slot FOREIGN KEY (slot_id) REFERENCES ad_slot(id) ON DELETE CASCADE,
  CONSTRAINT fk_ap_creative FOREIGN KEY (creative_id) REFERENCES ad_creative(id) ON DELETE CASCADE,
  INDEX idx_ap_slot_active (slot_id, is_active, active_from, active_to)
) ENGINE=InnoDB;

/* 4) র’ ইভেন্ট লগ (impression/click) — CTR এটাতেই ভিত্তি */
CREATE TABLE ad_event (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  occurred_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  event_type    ENUM('impression','click') NOT NULL,
  slot_id       INT UNSIGNED NOT NULL,
  creative_id   INT UNSIGNED NOT NULL,

  /* অ্যাট্রিবিউশন/ডিডাপের কাজে লাগে */
  page_path     VARCHAR(1024) NULL,     -- /post/my-article
  referrer      VARCHAR(1024) NULL,
  ip_hash       BINARY(16) NULL,        -- IPv4/6 hashed (MD5/xxhash of IP) to reduce PII
  ua_hash       BINARY(16) NULL,        -- hashed user agent
  session_id    VARCHAR(64) NULL,       -- client-side session key (cookie/localStorage)
  dedupe_key    CHAR(40) NULL,          -- sha1(slot|creative|session|minute|type)
  user_id       INT UNSIGNED NULL,      -- if logged-in

  CONSTRAINT fk_ae_slot FOREIGN KEY (slot_id) REFERENCES ad_slot(id) ON DELETE RESTRICT,
  CONSTRAINT fk_ae_creative FOREIGN KEY (creative_id) REFERENCES ad_creative(id) ON DELETE RESTRICT,

  INDEX idx_event_when (occurred_at),
  INDEX idx_event_type (event_type),
  INDEX idx_event_creative_when (creative_id, occurred_at),
  INDEX idx_event_slot_when (slot_id, occurred_at),
  UNIQUE KEY uq_event_dedupe (dedupe_key)         -- ১ মিনিটের উইন্ডোতে ডাবল কাউন্ট রোধ
) ENGINE=InnoDB;

/* 5) দৈনিক স্ট্যাটস (materialized) — দ্রুত রিপোর্টের জন্য */
CREATE TABLE ad_stats_daily (
  day           DATE NOT NULL,
  slot_id       INT UNSIGNED NOT NULL,
  creative_id   INT UNSIGNED NOT NULL,
  impressions   BIGINT UNSIGNED NOT NULL DEFAULT 0,
  clicks        BIGINT UNSIGNED NOT NULL DEFAULT 0,
  ctr           DECIMAL(6,4) GENERATED ALWAYS AS (
                  CASE WHEN impressions > 0 THEN (clicks / impressions) ELSE 0 END
                ) STORED,

  PRIMARY KEY (day, slot_id, creative_id),
  CONSTRAINT fk_asd_slot FOREIGN KEY (slot_id) REFERENCES ad_slot(id) ON DELETE CASCADE,
  CONSTRAINT fk_asd_creative FOREIGN KEY (creative_id) REFERENCES ad_creative(id) ON DELETE CASCADE
) ENGINE=InnoDB;

/* 6) গ্লোবাল কনফিগ (admin টগল/keys/thresholds) */
CREATE TABLE ad_config (
  cfg_key     VARCHAR(64) PRIMARY KEY,
  cfg_value   JSON NOT NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

/* seed: default slot keys */
INSERT INTO ad_slot (slot_key, label, enabled) VALUES
('beforeTitle','Before Title',1),
('beforeImage','Before Featured Image',1),
('afterImage','After Featured Image',1),
('beforeBody','Before Article Body',1),
('afterBody','After Article Body',1),
('afterTags','After Tags',1);



/* ── (optional) প্রোফাইল নেম sync করতে চাইলে:

