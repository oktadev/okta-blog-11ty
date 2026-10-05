export default {
  eleventyComputed: {
    title: (data) => `Communities | ${data.site.title}`,
    description: () =>
      "Browse Okta Developer Blog posts by language, platform, or discipline.",
  },
};
