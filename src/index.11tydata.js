export default {
  eleventyComputed: {
    title: (data) => data.site.title,
    description: (data) => data.site.description,
  },
};
