export default {
  tags: ["posts"],
  layout: "post.njk",
  eleventyComputed: {
    title: (data) => data.title,
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
