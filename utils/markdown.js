import markdownIt from "markdown-it";
import markdownItAttrs from "markdown-it-attrs";
import markdownItAnchor from "markdown-it-anchor";
import markdownItToc from "markdown-it-table-of-contents";

export const slugify = (s) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");

// The site's Markdown library. Shared so anything that renders markdown outside
// the main pipeline (e.g. the markdown-in-HTML transform) stays consistent.
export const markdownLibrary = markdownIt({
  html: true,
  breaks: true,
  linkify: true,
})
  .use(markdownItAnchor, {
    permalink: markdownItAnchor.permalink.headerLink({
      safariReaderFix: true,
      class: "direct-link",
    }),
    slugify,
  })
  .use(markdownItAttrs)
  .use(markdownItToc, {
    includeLevel: [2, 3],
    listType: "ul",
    slugify,
    containerClass: "table-of-contents not-prose",
    containerHeaderHtml: '<p class="toc-header">Table of Contents</p>',
    transformContainerOpen: (containerClass, containerHeaderHtml) =>
      `<nav class="${containerClass}" aria-label="Table of contents">${containerHeaderHtml}`,
    transformContainerClose: () => "</nav>",
  });
