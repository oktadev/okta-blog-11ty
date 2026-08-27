import { DateTime } from "luxon";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { baseUrl } from "./base-url.js";
import markdownIt from "markdown-it";
import Image from "@11ty/eleventy-img";

const inlineMd = markdownIt({ html: true, linkify: true });

// Decode the HTML entities left in rendered content (e.g. `&#39;`, `&amp;`) so a
// stripped-to-text excerpt reads naturally before it's re-escaped on output.
function decodeEntities(str) {
  // Handle the full Unicode range (astral code points like emoji), leaving an
  // out-of-range entity as-is rather than throwing.
  const fromCodePoint = (match, codePoint) =>
    codePoint >= 0 && codePoint <= 0x10ffff
      ? String.fromCodePoint(codePoint)
      : match;
  return str
    .replace(/&#(\d+);/g, (m, n) => fromCodePoint(m, Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (m, n) => fromCodePoint(m, parseInt(n, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

export default function (eleventyConfig) {
  eleventyConfig.addFilter("htmlDateString", (dateObj) => {
    // dateObj input: https://html.spec.whatwg.org/multipage/common-microsyntaxes.html#valid-date-string
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat("yyyy-LL-dd");
  });

  eleventyConfig.addFilter("readableDate", (dateObj, format, zone) => {
    // Formatting tokens for Luxon: https://moment.github.io/luxon/#/formatting?id=table-of-tokens
    return DateTime.fromJSDate(dateObj, { zone: zone || "utc" }).toFormat(
      format || "LLLL d, yyyy",
    );
  });

  // Entries are single-key { <date>: <text> } objects; sort newest-first.
  eleventyConfig.addFilter("changelogEntries", function (changelog) {
    if (!Array.isArray(changelog)) return [];
    return changelog
      .map((entry) => {
        const key = Object.keys(entry)[0];
        return { date: new Date(key), text: entry[key] };
      })
      .sort((a, b) => b.date - a.date);
  });

  eleventyConfig.addFilter("inlineMarkdown", (str) =>
    inlineMd.renderInline(str || ""),
  );

  // A listing excerpt drawn from the post's first content paragraph (not the SEO
  // `description`), capped to a word count. Skips headings/images/callouts by
  // matching the first <p>, and falls back to `description` if there's none.
  eleventyConfig.addFilter("postExcerpt", function (post, wordLimit = 50) {
    const paragraph = (post.templateContent || "").match(
      /<p\b[^>]*>([\s\S]*?)<\/p>/i,
    );
    const text = decodeEntities(
      (paragraph ? paragraph[1] : "").replace(/<[^>]+>/g, " "),
    )
      .replace(/\s+/g, " ")
      .trim();
    if (!text) return post.data.description || "";
    const words = text.split(" ");
    return words.length > wordLimit
      ? words.slice(0, wordLimit).join(" ") + "…"
      : text;
  });

  eleventyConfig.addFilter("postsAuthorFilter", function (posts, authorKey) {
    // Match posts whose `author` (a key or list of keys) includes this author.
    return posts.filter((post) => {
      const postAuthor = post.data.author;
      return Array.isArray(postAuthor)
        ? postAuthor.includes(authorKey)
        : postAuthor === authorKey;
    });
  });

  eleventyConfig.addFilter("authorFilter", function (authorsList, authors) {
    const authorsArray = Array.isArray(authors) ? authors : [authors];

    // Skip missing/unknown author keys so callers never get an empty entry
    // (which would render a broken author link).
    return authorsArray
      .filter((authorKey) => authorKey && authorsList[authorKey])
      .map((authorKey) => {
        return { ...authorsList[authorKey], slug: authorKey };
      });
  });

  eleventyConfig.addFilter("allTagsFilter", function (collections) {
    const filteredTags = Object.keys(collections).filter((key) => {
      return key !== "all" && key !== "posts" && key;
    });

    return filteredTags.sort();
  });

  // A post's reader-facing tags: strips the internal collection tags
  // ("posts"/"all") so templates can gate on real tags and never render an
  // empty tag list. Returns [] for posts that have no tags of their own.
  eleventyConfig.addFilter("visibleTags", function (tags) {
    return (tags || []).filter((tag) => tag !== "posts" && tag !== "all");
  });

  // Group tags alphabetically by first letter for the tags index page.
  // Returns [{ letter, tags: [...] }] sorted A–Z, with non-letter tags (e.g.
  // ".net", numbers) grouped under "#" and placed last.
  eleventyConfig.addFilter("tagsByLetter", function (collections) {
    const tags = Object.keys(collections)
      .filter((key) => key !== "all" && key !== "posts")
      .sort((a, b) => a.localeCompare(b));

    const groups = {};
    for (const tag of tags) {
      const first = tag.charAt(0).toUpperCase();
      const letter = /[A-Z]/.test(first) ? first : "#";
      (groups[letter] ||= []).push(tag);
    }

    return Object.keys(groups)
      .sort((a, b) => (a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b)))
      .map((letter) => ({ letter, tags: groups[letter] }));
  });

  eleventyConfig.addFilter("toAbsoluteUrl", (url) => {
    return new URL(url, baseUrl).href;
  });

  // Turn an author's X/Twitter profile URL into an @handle (for twitter:creator).
  eleventyConfig.addFilter("twitterHandle", (url) => {
    const match = (url || "").match(/(?:twitter\.com|x\.com)\/@?([^/?#]+)/i);
    return match ? `@${match[1]}` : "";
  });

  // An http(s) URL, or "" for anything else (relative paths, other schemes).
  // Front matter is hand-authored, so templates validate before emitting a URL
  // into an href.
  eleventyConfig.addFilter("httpUrl", (url) => {
    try {
      const { protocol } = new URL(String(url));
      return protocol === "http:" || protocol === "https:" ? String(url) : "";
    } catch {
      return "";
    }
  });

  // Display host for an external URL (e.g. the "Originally published at"
  // note on syndicated posts). Returns the input unchanged if it will not parse.
  eleventyConfig.addFilter("hostname", (url) => {
    const value = String(url ?? "");
    try {
      return new URL(value).hostname.replace(/^www\./i, "");
    } catch {
      return value;
    }
  });

  // Wrap content in a CDATA section, splitting any literal `]]>` so a post's code
  // sample can't close the section early (used for the feed's <content:encoded>).
  eleventyConfig.addFilter("cdata", (content) => {
    return `<![CDATA[${String(content || "").replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
  });

  // Process the front-matter social `image` through eleventy-img (so it's actually
  // served, unlike the raw original) and return its root-relative URL. Pair with
  // `toAbsoluteUrl` for og:image. External (http) values pass through unchanged.
  eleventyConfig.addAsyncFilter("socialImage", async (src) => {
    if (!src) return "";
    if (/^https?:\/\//.test(src)) return src;
    const subdir = src.includes("/")
      ? src.substring(0, src.lastIndexOf("/"))
      : "";
    const outputDir = subdir ? `_site/img/blog/${subdir}` : "_site/img/blog";
    const urlPath = subdir ? `/img/blog/${subdir}` : "/img/blog";
    try {
      const metadata = await Image(`./public/img/blog/${src}`, {
        widths: [1200],
        formats: [null], // keep the original format for social scrapers
        outputDir,
        urlPath,
      });
      return Object.values(metadata)[0].at(-1).url;
    } catch (err) {
      console.warn(
        `[socialImage] could not process img/blog/${src}: ${err.message}`,
      );
      return "";
    }
  });

  // Cap a collection to the first n items (the feed only carries recent posts).
  eleventyConfig.addFilter("limit", (array, n) => (array || []).slice(0, n));

  eleventyConfig.addFilter("postBySlug", function (posts, slug) {
    const filtered = posts.find((post) => post.fileSlug === slug);

    return filtered;
  });

  eleventyConfig.addFilter("hashFile", function (url) {
    const filePath = path.join("_site", url);
    try {
      const content = readFileSync(filePath);
      const hash = createHash("md5").update(content).digest("hex").slice(0, 10);
      return `${url}?v=${hash}`;
    } catch {
      // File not yet built; return URL without hash
      return url;
    }
  });

  eleventyConfig.addFilter("readingTimeBadge", (minutes) => {
    const text = !minutes || minutes < 1 ? 1 : minutes;

    return `<div class="px-2 bg-okta-cloud rounded-xl content-center font-bold"><p class="text-xs uppercase">${text} min read</p></div>`;
  });
}
