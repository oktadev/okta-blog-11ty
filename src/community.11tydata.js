export default {
  eleventyComputed: {
    title: (data) =>
      data.community
        ? `${data.community.label} | ${data.site.title}`
        : data.site.title,
    description: (data) =>
      data.community
        ? `Okta Developer Blog posts about ${data.community.label}.`
        : undefined,
  },
};
