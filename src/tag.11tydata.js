export default {
  eleventyComputed: {
    title: (data) => `Articles tagged ${data.tag} | ${data.site.title}`,
  },
};
