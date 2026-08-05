import { DateTime } from "luxon";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { baseUrl } from "./base-url.js";

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

    return authorsArray.map((authorKey) => {
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

  // Wrap content in a CDATA section, splitting any literal `]]>` so a post's code
  // sample can't close the section early (used for the feed's <content:encoded>).
  eleventyConfig.addFilter("cdata", (content) => {
    return `<![CDATA[${String(content || "").replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
  });

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
