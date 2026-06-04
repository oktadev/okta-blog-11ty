import { DateTime } from "luxon";
import slugify from "slugify";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

export default function (eleventyConfig) {
  eleventyConfig.addFilter("htmlDateString", (dateObj) => {
    // dateObj input: https://html.spec.whatwg.org/multipage/common-microsyntaxes.html#valid-date-string
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat("yyyy-LL-dd");
  });

  eleventyConfig.addFilter("readableDate", (dateObj, format, zone) => {
    // Formatting tokens for Luxon: https://moment.github.io/luxon/#/formatting?id=table-of-tokens
    return DateTime.fromJSDate(dateObj, { zone: zone || "utc" }).toFormat(
      format || "dd LLLL yyyy",
    );
  });

  eleventyConfig.addFilter("postsAuthorFilter", function (posts, author) {
    const filtered = posts.filter(
      (post) => post.data.author == slugify(author).toLowerCase(),
    );
    return filtered;
  });

  eleventyConfig.addFilter("authorFilter", function (authorsList, authors) {
    const authorsArray = Array.isArray(authors) ? authors : [authors];

    return authorsArray.map((authorKey) => {
      return authorsList[authorKey];
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

  // eleventyConfig.addFilter("toAbsoluteBlogImageUrl", async () => {
  //   const imageOptions = {
  //     widths: [width],
  //     formats: [null],
  //     outputDir: "_site/img/blog",
  //     urlPath: "public/img/blog",
  //   };
  //   const stats = await Image(src, imageOptions);
  //   const imageUrl = Object.values(stats)[0][0].url;

  //   return toAbsoluteUrl(imageUrl);
  // });

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

  eleventyConfig.addFilter("readingTime", (content) => {
    const READING_SPEED = 300;
    const sanitizeHtml = content.replace(/<\/?[^>]+(>|$)/g, "");
    const numWords = sanitizeHtml.split(" ").length;
    const minutes = Math.round(numWords / READING_SPEED);
    const text = minutes < 1 ? 1 : minutes;

    return `<div class="px-2 bg-okta-cloud rounded-xl content-center font-bold"><p class="text-xs uppercase">${text} min read</p></div>`;
  });
}
