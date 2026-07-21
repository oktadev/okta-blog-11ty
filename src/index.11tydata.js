export default {
  eleventyComputed: {
    title: (data) =>
      data.pagination && data.pagination.pageNumber > 0
        ? `${data.site.title} - Page ${data.pagination.pageNumber + 1}`
        : data.site.title,
    description: (data) => data.site.description,
  },
};
