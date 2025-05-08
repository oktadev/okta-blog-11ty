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

  eleventyConfig.addFilter("postsByTagFilter", function (collections, tag) {
    const filteredPosts = Object.entries(collections).filter(([key, value]) => {
      if (key === tag) {
        return value;
      }
    });

    return Object.fromEntries(filteredPosts)[tag];
  });
}
