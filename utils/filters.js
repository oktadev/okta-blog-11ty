import { DateTime } from "luxon";
import slugify from "slugify";

export default function (eleventyConfig) {
  eleventyConfig.addFilter("htmlDateString", (dateObj) => {
    // dateObj input: https://html.spec.whatwg.org/multipage/common-microsyntaxes.html#valid-date-string
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat("yyyy-LL-dd");
  });

  eleventyConfig.addFilter("readableDate", (dateObj, format, zone) => {
    // Formatting tokens for Luxon: https://moment.github.io/luxon/#/formatting?id=table-of-tokens
    return DateTime.fromJSDate(dateObj, { zone: zone || "utc" }).toFormat(
      format || "dd LLLL yyyy"
    );
  });

  eleventyConfig.addFilter("postsAuthorFilter", function (posts, author) {
    const filtered = posts.filter(
      (post) => post.data.author == slugify(author).toLowerCase()
    );
    return filtered;
  });

  eleventyConfig.addFilter("authorFilter", function (authors, author) {
    const filteredAuthor = Object.entries(authors).find(
      ([key, value]) => key === author
    );

    return filteredAuthor[1];
  });

  eleventyConfig.addFilter("allTagsFilter", function (collections) {
    const filteredTags = Object.keys(collections).filter(
      (key) => key !== "all" && key !== "posts"
    );

    return filteredTags.sort();
  });

  eleventyConfig.addFilter("toAbsoluteUrl", (url) => {
    return new URL(url, "https://developer.okta.com").href;
  });

  eleventyConfig.addFilter("toBlogUrl", (url) => {
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
}
