export default {
  tags: ["posts"],
  layout: "post.njk",
  eleventyComputed: {
    title: (data) => data.title,
  },
};
