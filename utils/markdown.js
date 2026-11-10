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

const headingText = (tokens) =>
  tokens
    .filter((t) => ["text", "code_inline"].includes(t.type))
    .map((t) => t.content)
    .join("")
    .trim();

// The TOC plugin re-renders a heading's text as Markdown, and the default drops
// the backticks, so inline code in a heading came out as plain text (#219). Put
// them back: a fence longer than any backtick run inside, padded with a space
// when the content starts or ends with a backtick or space, or the fence would
// merge with it.
export const headingMarkdown = (tokens) =>
  tokens
    .filter((t) => ["text", "code_inline"].includes(t.type))
    .map((t) => {
      if (t.type !== "code_inline") return t.content;
      const longestRun = Math.max(
        0,
        ...(t.content.match(/`+/g) || []).map((run) => run.length),
      );
      const fence = "`".repeat(longestRun + 1);
      const pad = /^[` ]|[` ]$/.test(t.content) ? " " : "";
      return `${fence}${pad}${t.content}${pad}${fence}`;
    })
    .join("")
    .trim();

// The site's Markdown library. Shared so anything that renders markdown outside
// the main pipeline (e.g. the markdown-in-HTML transform) stays consistent.
// A newline inside a paragraph is a space, as on the old site (kramdown) and
// in CommonMark; a line break takes two trailing spaces or a backslash (#205).
export const markdownLibrary = markdownIt({
  html: true,
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
    // The slug comes from the plain text, as for the headings' own ids: the
    // padding getTokensText adds below would otherwise become hyphens.
    slugify: (_text, token) => slugify(headingText(token.children)),
    getTokensText: headingMarkdown,
    containerClass: "table-of-contents not-prose",
    containerHeaderHtml: '<p class="toc-header">Table of Contents</p>',
    transformContainerOpen: (containerClass, containerHeaderHtml) =>
      `<nav class="${containerClass}" aria-label="Table of contents">${containerHeaderHtml}`,
    transformContainerClose: () => "</nav>",
  });

// A bare "{placeholder}" at the end of a prose line is text a reader copies,
// not an attribute list (the old site only read "{: ...}"). markdown-it-attrs
// would strip it and leave a bogus attribute, so the word it ends is handed
// over as a text_special token, which that plugin ignores, linkify leaves
// alone (so "https://${yourOktaDomain}" is not half a link), and text_join
// turns back into text. Classes, ids and key=value lists are left for the
// plugin.
const PLACEHOLDER_END = /\S*\{[A-Za-z_][\w-]*\}\s*$/;
markdownLibrary.core.ruler.before(
  "curly_attributes",
  "placeholder_text",
  (state) => {
    for (const token of state.tokens) {
      if (token.type !== "inline") continue;
      const children = token.children;
      const last = children[children.length - 1];
      if (!last || last.type !== "text") continue;
      const m = last.content.match(PLACEHOLDER_END);
      if (!m) continue;
      const special = new state.Token("text_special", "", 0);
      special.content = last.content.slice(m.index);
      last.content = last.content.slice(0, m.index);
      children.push(special);
    }
  },
);

// A URL whose host is a template placeholder ("https://${yourOktaDomain}/…")
// is text to copy, not a link; linkify would otherwise link "https://$" and
// leave the rest dangling. Same validation as linkify-it's own, minus those.
// linkify-it 6 no longer aliases "https:" to "http:", so both are overridden.
const placeholderSafeWeb = {
  validate(text, pos, self) {
    if (/^\/\/\$?\{/.test(text.slice(pos))) return 0;
    const re = self.re.get_http_validator();
    re.lastIndex = pos;
    const m = re.exec(text);
    return m ? m[0].length : 0;
  },
};
markdownLibrary.linkify.add("http:", placeholderSafeWeb);
markdownLibrary.linkify.add("https:", placeholderSafeWeb);

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
