export default {
  eleventyComputed: {
    title: (data) => `${data.author.full_name} | ${data.site.title}`,
  },
};
