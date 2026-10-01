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

const TABLE_TAG = /<table[\s>]|<\/table>/gi;
const SCROLL_OPEN =
  '<div class="overflow-x-auto" tabindex="0" role="region" aria-label="Table">';

// Depth-tracked rather than a regex pair match: one post nests a table inside a
// cell, and pair matching would close the wrapper on the inner </table>.
function wrapTables(content) {
  if (!content.includes("<table")) return content;

  let out = "";
  let cursor = 0;
  let depth = 0;
  let match;

  TABLE_TAG.lastIndex = 0;
  while ((match = TABLE_TAG.exec(content)) !== null) {
    const isOpen = match[0][1] !== "/";
    if (isOpen) {
      if (depth === 0) {
        out += content.slice(cursor, match.index) + SCROLL_OPEN;
        cursor = match.index;
      }
      depth += 1;
    } else {
      depth -= 1;
      if (depth < 0) return content; // unbalanced; leave it alone
      if (depth === 0) {
        const end = match.index + match[0].length;
        out += content.slice(cursor, end) + "</div>";
        cursor = end;
      }
    }
  }

  if (depth !== 0) return content;
  return out + content.slice(cursor);
}

export default function (eleventyConfig) {
  // The macro preprocessor prepends a newline; HTML minification hides it, but the
  // unminified feed needs its <?xml> declaration on the first line to parse.
  eleventyConfig.addTransform("xmlLeadingTrim", function (content) {
    if ((this.page.outputPath || "").endsWith(".xml")) {
      return content.replace(/^\s+/, "");
    }
    return content;
  });

  eleventyConfig.addTransform("markdownInHtml", function (content) {
    if (!(this.page.outputPath || "").endsWith(".html")) return content;
    return renderMarkdownAttrs(content);
  });

  // A transform, not a markdown-it renderer rule: `html: true` means 65 posts carry
  // literal <table> markup that never becomes a markdown token.
  eleventyConfig.addTransform("tableScroll", function (content) {
    if (!(this.page.outputPath || "").endsWith(".html")) return content;
    return wrapTables(content);
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
