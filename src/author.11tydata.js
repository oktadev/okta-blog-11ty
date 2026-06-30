export default {
  eleventyComputed: {
    title: (data) =>
      `${data.authors[data.authorKey].full_name} | ${data.site.title}`,
  },
};
