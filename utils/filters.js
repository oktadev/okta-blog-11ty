import { DateTime } from "luxon";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import markdownIt from "markdown-it";

// Lightweight Markdown renderer for inline snippets (changelog descriptions),
// which contain links and inline code but no block-level markup.
const inlineMd = markdownIt({ html: true, linkify: true });

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

  // Normalize a post's `changelog` front-matter into [{ date, text }]. YAML
  // parses each `YYYY-MM-DD: ...` entry as a single-key object whose key js-yaml
  // turned into a Date; parse it back (readableDate formats it in UTC so the day
  // doesn't shift) and keep the Markdown description as `text`. Order is
  // preserved as authored (newest first).
  eleventyConfig.addFilter("changelogEntries", function (changelog) {
    if (!Array.isArray(changelog)) return [];
    return changelog.map((entry) => {
      const key = Object.keys(entry)[0];
      return { date: new Date(key), text: entry[key] };
    });
  });

  // Render a Markdown string inline (no wrapping <p>), for changelog descriptions.
  eleventyConfig.addFilter("inlineMarkdown", (str) =>
    inlineMd.renderInline(str || ""),
  );

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

  eleventyConfig.addFilter("toAbsoluteUrl", (url) => {
    return new URL(url, "https://developer.okta.com").href;
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
