import { postToMarkdown } from "../utils/markdown-export.js";

// One Markdown file per post, next to its page: /blog/YYYY/MM/DD/slug/ is
// mirrored at /blog/YYYY/MM/DD/slug.md. Backs the "Copy page" and "View as
// Markdown" actions in the post layout.
export default class {
  data() {
    return {
      pagination: { data: "collections.posts", size: 1, alias: "post" },
      permalink: (data) => `${data.post.url.replace(/\/$/, "")}.md`,
      eleventyExcludeFromCollections: true,
    };
  }

  render({ post, authors, site }) {
    const keys = [].concat(post.data.author || []);
    return postToMarkdown({
      html: post.templateContent || "",
      title: post.data.title,
      description: post.data.description,
      authors: keys.map((key) => authors[key]?.full_name || key),
      // From the URL, like the permalink: page.date can shift a day by zone.
      date: post.url
        .match(/(\d{4})\/(\d{2})\/(\d{2})/)
        .slice(1)
        .join("-"),
      url: post.url,
      origin: site.baseUrl,
    });
  }
}
