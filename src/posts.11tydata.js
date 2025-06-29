export default {
  eleventyComputed: {
    title: (data) => `Posts | ${data.site.title}`,
  },
};
