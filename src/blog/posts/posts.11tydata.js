import { readFileSync } from "node:fs";

// Estimate reading time from the raw source (front-matter + markdown stripped)
// rather than the rendered HTML. Computing it here, in the data cascade, means
// listing pages can read post.data.readingTime without forcing the post to
// render first — which avoids TemplateContentPrematureUseError (notably once
// the Vite plugin reorders the build).
const WORDS_PER_MINUTE = 300;
function readingTimeMinutes(inputPath) {
  let raw;
  try {
    raw = readFileSync(inputPath, "utf8");
  } catch {
    return 1;
  }
  const text = raw
    .replace(/^---\r?\n[\s\S]*?\r?\n---/, "") // front-matter
    .replace(/```[\s\S]*?```/g, " ") // fenced code
    .replace(/`[^`]*`/g, " ") // inline code
    .replace(/[#>*_~`>|-]/g, " "); // markdown punctuation
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

export default {
  tags: ["posts"],
  layout: "post.njk",
  eleventyComputed: {
    title: (data) => data.title,
    readingTime: (data) => readingTimeMinutes(data.page.inputPath),
    // Match the live URL structure: /blog/YYYY/MM/DD/slug/.
    // Derived from the filename (always YYYY-MM-DD-slug.md) rather than
    // page.date so it's timezone-proof and exact.
    permalink: (data) => {
      const m = data.page.inputPath.match(/(\d{4})-(\d{2})-(\d{2})-(.+)\.md$/);
      if (!m) return data.permalink;
      const [, year, month, day, slug] = m;
      return `/blog/${year}/${month}/${day}/${slug}/`;
    },
  },
};
