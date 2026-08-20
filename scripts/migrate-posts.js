// Convert Jekyll posts from the okta-blog repo into 11ty posts.
//
// Replaces the old blog-migration.sh, whose sed expressions ran over whole
// files and so rewrote code samples as well as prose (stripping HTML
// attributes, rewriting Liquid whitespace markers). Everything inside a fenced
// code block or an inline code span is left byte-for-byte identical here; the
// transforms below only touch prose.
//
// Usage: node scripts/migrate-posts.js <source-posts-dir> [dest-dir]
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const DEFAULT_DEST = "src/blog/posts";

// Split into prose and code segments. Code = fenced blocks (``` or ~~~, closing
// fence at least as long as the opener), which are passed through untouched.
function splitSegments(text) {
  const segments = [];
  const lines = text.split("\n");
  let prose = [];
  let fence = null;
  let code = [];

  const flushProse = () => {
    if (prose.length) segments.push({ code: false, text: prose.join("\n") });
    prose = [];
  };

  for (const line of lines) {
    const open = line.match(/^[ \t]*(`{3,}|~{3,})/);
    if (!fence && open) {
      flushProse();
      fence = { char: open[1][0], len: open[1].length };
      code = [line];
      continue;
    }
    if (fence) {
      code.push(line);
      const close = line.match(/^[ \t]*(`{3,}|~{3,})[ \t]*$/);
      if (close && close[1][0] === fence.char && close[1].length >= fence.len) {
        segments.push({ code: true, text: code.join("\n") });
        fence = null;
        code = [];
      }
      continue;
    }
    prose.push(line);
  }
  // An unterminated fence still counts as code; never transform it.
  if (fence) segments.push({ code: true, text: code.join("\n") });
  flushProse();
  return segments;
}

// Inline code spans are protected the same way fenced blocks are: swapped for a
// placeholder, then restored after the prose transforms run.
const MASK_OPEN = "\u0000";
const MASK_CLOSE = "\u0001";

function transformProse(text, apply) {
  const spans = [];
  const masked = text.replace(/(`+)([^\n]*?)\1/g, (match) => {
    spans.push(match);
    return `${MASK_OPEN}${spans.length - 1}${MASK_CLOSE}`;
  });
  const converted = apply(masked);
  return converted.replace(
    new RegExp(`${MASK_OPEN}(\\d+)${MASK_CLOSE}`, "g"),
    (_, index) => spans[Number(index)],
  );
}

// Build `{% img {src: "...", alt: "...", header: "..."} %}` from the Jekyll
// `{% img blog/<src> alt:"..." width:"..." %}` tag, whose attributes appear in
// any order. (The old script emitted positional arguments, which the current
// shortcode no longer accepts.)
function imgTag(src, attrs) {
  // Values in the source appear as name:"value", name=value and bare name:value,
  // and some tags carry stray tokens, so read each attribute leniently.
  const get = (name) => {
    const quoted = attrs.match(new RegExp(`${name}\\s*[:=]\\s*"([^"]*)"`));
    if (quoted) return quoted[1];
    const bare = attrs.match(new RegExp(`${name}\\s*[:=]\\s*([^\\s"%]+)`));
    return bare ? bare[1] : undefined;
  };
  const parts = [`src: "${src}"`, `alt: "${get("alt") || ""}"`];
  const width = get("width");
  if (width) parts.push(`header: "${width}"`);
  return `{% img {${parts.join(", ")}} %}`;
}

function convertProse(text) {
  return (
    text
      // Front matter
      .replace(/^layout: blog_post[ \t]*\n/m, "")
      .replace(/^image: blog\//m, "image: ")
      // Kramdown leftovers
      .replace(/ "no_toc"=""/g, "")
      .replace(/\{: \.center-image \}/g, "")
      // Liquid whitespace control isn't needed in Nunjucks
      .replace(/\{%- /g, "{% ")
      .replace(/ -%\}/g, " %}")
      // Table of contents
      .replace(/\* Table of Contents\n\{:toc\}/g, "[[toc]]")
      .replace(/\* Table of Contents\n\{% include toc\.md %\}/g, "[[toc]]")
      .replace(/\{% include toc\.md %\}/g, "[[toc]]")
      // Tags that changed name in Nunjucks
      .replace(/\{% capture/g, "{% set")
      .replace(/\{% endcapture/g, "{% endset")
      .replace(/\{% comment %\}/g, "{#")
      .replace(/\{% endcomment %\}/g, "#}")
      // Shortcodes
      // Match lazily to the closing tag: attribute values can contain `%` (e.g.
      // width:"100%") and a few tags wrap onto a second line.
      .replace(/\{%\s*img\s+blog\/([^\s%]+)([\s\S]*?)%\}/g, (_, src, attrs) =>
        imgTag(src, attrs),
      )
      .replace(
        /\{%\s*speakerdeck\s+(\w+)\s+(\d+)px\s*%\}/g,
        '{% speakerdeck "$1", $2 %}',
      )
      .replace(/\{%\s*excerpt\s+\S*\/(\S+)\s*%\}/g, '{% excerpt "$1" %}')
      // Includes that became macros or Nunjucks includes
      .replace(
        /\{% include setup\/integrator\.md ([^%]*) %\}/g,
        "{{ macro.integrator({$1}) }}",
      )
      .replace(
        /\{% include setup\/cli\.md ([^%]*) %\}/g,
        "{{ macro.cli({$1}) }}",
      )
      .replace(
        /\{% include setup\/oidcdebugger\.md %\}/g,
        "{{ macro.oidcdebugger() }}",
      )
      .replace(
        /\{% include integrator-org-warning\.html %\}/g,
        '{% include "integrator-org-warning.njk" %}',
      )
      // Drop empty attributes but keep the rest of the tag. The old script
      // matched the whole tag and replaced it with just the tag name, throwing
      // away every other attribute.
      .replace(/<([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g, (match, tag, attrs) =>
        attrs.includes('=""')
          ? `<${tag}${attrs.replace(/\s+[a-zA-Z-]+=""/g, "")}>`
          : match,
      )
      .replace(/<([a-zA-Z][a-zA-Z0-9]*) style: /g, "<$1 style=")
  );
}

export function convert(content) {
  // Some source posts use CRLF, which would break fence detection and the
  // front-matter match. Normalize before doing anything else.
  return (
    splitSegments(content.replace(/\r\n/g, "\n"))
      .map((segment) =>
        segment.code
          ? segment.text
          : transformProse(segment.text, convertProse),
      )
      // Each segment holds consecutive lines joined by newlines, so rejoining the
      // segments the same way reproduces the original line structure.
      .join("\n")
  );
}

const [srcDir, destDir = DEFAULT_DEST] = process.argv.slice(2);
if (srcDir) {
  mkdirSync(destDir, { recursive: true });
  let count = 0;
  for (const file of readdirSync(srcDir).filter((f) => f.endsWith(".md"))) {
    writeFileSync(
      path.join(destDir, file),
      convert(readFileSync(path.join(srcDir, file), "utf8")),
    );
    count++;
  }
  console.log(`Converted ${count} posts into ${destDir}`);
  console.log(
    "Do not run Prettier or any formatter over these files: it reformats the code samples.",
  );
}
