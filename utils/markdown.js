import markdownIt from "markdown-it";
import markdownItAttrs from "markdown-it-attrs";
import markdownItAnchor from "markdown-it-anchor";
import markdownItToc from "markdown-it-table-of-contents";
import markdownItFootnote from "markdown-it-footnote";

// Heading ids follow kramdown's GFM rule, which the old site used for its
// Markdown posts, so links into its anchors keep resolving here: lowercase,
// drop everything but letters, marks, digits, underscores, hyphens and spaces,
// and turn each space into a hyphen. Runs are not collapsed ("Vue + Go" is
// "vue--go"); duplicates get "-1", "-2" from markdown-it-anchor, as there.
export const slugify = (s) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{Nd}\p{Pc}\- \t]/gu, "")
    .replace(/[ \t]/g, "-");

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
  // Footnotes, which kramdown rendered on the old site.
  .use(markdownItFootnote)
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

// The old site's footnote marker is the bare number, not "[1]".
markdownLibrary.renderer.rules.footnote_caption = (tokens, idx) => {
  const n = Number(tokens[idx].meta.id + 1).toString();
  return tokens[idx].meta.subId > 0 ? `${n}:${tokens[idx].meta.subId}` : n;
};

// Eleventy disables indented (four-space) code blocks each time it builds a
// Markdown engine, but runs amendLibrary only once per library, so a second
// engine in a full build leaves them off (Eleventy issues #2438 and #3816).
// The old site rendered them and eight posts rely on them, so that one call
// is ignored here.
const disable = markdownLibrary.disable.bind(markdownLibrary);
markdownLibrary.disable = (rules, ignoreInvalid) => {
  const kept = [rules].flat().filter((name) => name !== "code");
  return kept.length ? disable(kept, ignoreInvalid) : markdownLibrary;
};
