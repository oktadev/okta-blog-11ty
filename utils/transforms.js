import { minify } from "html-minifier-terser";
import { markdownLibrary as md } from "./markdown.js";

const isDev = process.env.ELEVENTY_ENV === "development";

// Kramdown's `markdown="span"|"1"|"div"` attribute (carried over from the Jekyll
// source, mostly on table cells) told the parser to render markdown inside that
// element. markdown-it ignores it, so tables end up showing raw `**bold**` and
// `` `code` ``. Render those elements' content with the site's Markdown library:
// "span" is inline, any other value is block.
const MARKDOWN_ATTR =
  /<(td|th|div)\b([^>]*?)\smarkdown="([^"]*)"([^>]*?)>([\s\S]*?)<\/\1>/gi;

// Strip the common leading indentation so block content isn't mistaken for an
// indented code block by markdown-it.
function dedent(text) {
  const lines = text.replace(/^\n+/, "").replace(/\s+$/, "").split("\n");
  const indents = lines
    .filter((l) => l.trim())
    .map((l) => l.match(/^[ \t]*/)[0].length);
  const min = indents.length ? Math.min(...indents) : 0;
  return lines.map((l) => l.slice(min)).join("\n");
}

function renderMarkdownAttrs(content) {
  if (!content.includes('markdown="')) return content;
  return content.replace(
    MARKDOWN_ATTR,
    (_match, tag, pre, mode, post, inner) => {
      const text = dedent(inner);
      const rendered =
        mode === "span" ? md.renderInline(text) : md.render(text);
      return `<${tag}${pre}${post}>${rendered}</${tag}>`;
    },
  );
}

export default function (eleventyConfig) {
  eleventyConfig.addTransform("markdownInHtml", function (content) {
    if (!(this.page.outputPath || "").endsWith(".html")) return content;
    return renderMarkdownAttrs(content);
  });

  if (isDev) return; // skip minification in dev for speed

  eleventyConfig.addTransform("htmlmin", async function (content) {
    if ((this.page.outputPath || "").endsWith(".html")) {
      return await minify(content, {
        useShortDoctype: true,
        removeComments: true,
        collapseWhitespace: true,
        minifyCSS: true,
        minifyJS: true,
      });
    }
    return content;
  });
}
