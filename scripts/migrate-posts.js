// Migrate posts from the okta-blog (Jekyll) repo into 11ty posts.
//
// Two source formats are handled:
//   - Markdown: Liquid tags become the shortcodes and macros this site uses.
//     Fenced code and inline code spans are never touched.
//   - AsciiDoc: converted to Markdown for the constructs the okta-blog posts
//     actually use (headings, paragraphs, lists, admonitions, example, sidebar,
//     quote, open, collapsible and passthrough blocks, source listings with
//     callouts, tables, images, links, xrefs, kbd, attributes, Liquid tags).
//     Anything else is reported rather than silently dropped.
//
// Usage:
//   node scripts/migrate-posts.js [--src ../okta-blog] [--only slug,slug] [--force]
//                                 [--yes] [--dry-run] [--no-assets] [--report file]
//
// By default only posts missing from src/blog/posts are written; --force
// re-converts the existing ones too. Posts the old repo no longer has are
// listed and, after confirmation (or with --yes), removed along with the asset
// folders only they used, provided vercel.json redirects their URL. Images the
// posts reference and avatars for new authors are copied when absent; existing
// files are never overwritten. A report of per-post notes is printed at the end.
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  statSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { createInterface } from "node:readline/promises";
import * as yaml from "js-yaml";
// The site's slug rules, so xrefs land on the anchors markdown-it-anchor generates.
import { slugify } from "../utils/markdown.js";

// Asciidoctor's section id, as the old site generated it (idprefix "",
// idseparator "-"): drop tags, entities and everything but letters, digits,
// underscores, spaces, dots and hyphens, then fold runs of those separators
// into one hyphen. Duplicates get "-2", "-3".
export function asciidoctorId(title) {
  return title
    .toLowerCase()
    .replace(
      /<[^>]+>|&(?:[a-z][a-z]+\d{0,2}|#\d\d\d{0,4}|#x[\da-f][\da-f][\da-f]{0,3});|[^ \p{L}\p{M}\p{Nd}\p{Pc}\-.]+?/gu,
      "",
    )
    .replace(/[ .\-]+/g, "-")
    .replace(/^-|-$/g, "");
}

// A heading's text without the Markdown the converter put in it.
function headingText(md) {
  return md
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/[`*_]+/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

const DEST_DIR = "src/blog/posts";
const IMG_DIR = "public/img/blog";
const AVATAR_DIR = "public/img/avatar";
const AUTHORS_FILE = "src/_data/authors.yaml";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

// Split "---\nyaml\n---\nbody" into its two halves. Front matter is kept as
// text so the migration never reformats an author's YAML.
export function splitFrontMatter(content) {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { frontMatter: "", body: content };
  return { frontMatter: m[1], body: content.slice(m[0].length) };
}

// Front matter edits shared by both formats: drop the Jekyll layout, strip the
// `blog/` prefix from the social image (this site's {% img %} adds it back).
export function convertFrontMatter(frontMatter) {
  // Redirects live in vercel.json here (#82); a redirect_to post is a
  // placeholder the old site redirected away from, kept out of the listings.
  const redirectTo = /^redirect_to:/m.test(frontMatter);
  const out = frontMatter
    .replace(/^layout: ["']?blog_post["']?[ \t]*\r?\n?/m, "")
    .replace(/^redirect_from:[ \t]*\r?\n(?:[ \t]*-[^\n]*\r?\n?)*/m, "")
    .replace(/^redirect_to:[^\n]*\r?\n?(?:[ \t]*-[^\n]*\r?\n?)*/m, "")
    .replace(/\s*$/, redirectTo ? "\neleventyExcludeFromCollections: true" : "")
    .replace(/^image: (["']?)blog\//m, "image: $1")
    // A bare `communities: java` is a one-item list (the validator wants a list).
    .replace(/^communities:[ \t]*([\w.#+-]+)[ \t]*$/m, "communities: [$1]");
  try {
    yaml.load(out);
    return out;
  } catch {
    return repairFrontMatter(out);
  }
}

// Ruby's YAML accepts a quoted scalar whose continuation lines start at
// column 0; js-yaml (which this site's validator uses) does not. Indent those
// continuation lines so both parsers agree.
export function repairFrontMatter(frontMatter) {
  // A flow list spread over several lines ("communities: [", one item per
  // line, "]") is Ruby-only YAML too; join it onto its key's line.
  const lines = [];
  let pending = null;
  for (const line of frontMatter.split("\n")) {
    if (pending !== null) {
      pending += ` ${line.trim()}`;
      if (line.includes("]")) {
        lines.push(pending.replace(/\[\s+/, "[").replace(/\s+\]/, "]"));
        pending = null;
      }
      continue;
    }
    if (/^[\w-]+:\s*\[[^\]]*$/.test(line)) pending = line.trimEnd();
    else lines.push(line);
  }
  if (pending !== null) lines.push(pending);
  let open = false;
  const repaired = lines.map((line) => {
    const wasOpen = open;
    const quotes = (line.match(/(?<!\\)"/g) || []).length;
    if (quotes % 2 === 1) open = !open;
    return wasOpen && !/^\s/.test(line) ? `  ${line}` : line;
  });
  const text = repaired.join("\n");
  yaml.load(text); // still invalid: let the caller see the parser's message
  return text;
}

// Jekyll `key="value" other=var` include arguments -> a Nunjucks object literal.
export function liquidArgsToObject(args) {
  const pairs = [];
  const re =
    /([A-Za-z_][\w-]*)\s*=\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^\s"']+)/g;
  let m;
  while ((m = re.exec(args))) {
    let value = m[2];
    if (value.startsWith("'")) {
      value = `"${value.slice(1, -1).replace(/"/g, '\\"')}"`;
    }
    pairs.push(`${m[1]}: ${value}`);
  }
  return `{${pairs.join(", ")}}`;
}

function jekyllImgAttr(attrs, name) {
  // Values appear as name:"value", name=value and bare name:value.
  const quoted = attrs.match(
    new RegExp(`(?<![\\w:"'])${name}\\s*[:=]\\s*"([^"]*)"`),
  );
  if (quoted) return quoted[1];
  const bare = attrs.match(
    new RegExp(`(?<![\\w:"'])${name}\\s*[:=]\\s*([^\\s"%]+)`),
  );
  return bare ? bare[1] : undefined;
}

function imgShortcode(src, alt = "", width) {
  const parts = [`src: "${src}"`, `alt: "${(alt || "").replace(/"/g, '\\"')}"`];
  if (width) parts.push(`header: "${String(width).replace(/px$/, "")}"`);
  // Author photos live in img/avatar here; the shortcode needs to know.
  if (/^avatar-/.test(src)) parts.push("avatar: true");
  return `{% img {${parts.join(", ")}} %}`;
}

// The old stylesheet's image classes: a float, a width, or nothing we can map.
function imageRoles(roles) {
  const width = roles
    .map((r) => r.match(/^(?:img-|w-)(\d+)(?:px)?$/)?.[1])
    .find(Boolean);
  const float = roles.includes("pull-right")
    ? "float-right ml-4 mb-2"
    : roles.includes("pull-left")
      ? "float-left mr-4 mb-2"
      : "";
  const unmapped = roles.filter(
    (r) =>
      !/^(pull-right|pull-left|img-\d+px|w-\d+(px)?|BlogPost-avatar|center-image)$/.test(
        r,
      ),
  );
  return { float, width, unmapped };
}

// Kramdown attribute lists right after an image tag: "{: .pull-right }" floats
// the image the way the old stylesheet did, "{: }" is nothing.
export function imageAttributes(text, note = () => {}) {
  return text.replace(
    /(\{%\s*img\s[^%]*%\})\{:\s*([^}]*)\}/g,
    (_, img, attrs) => {
      const roles = attrs
        .split(/\s+/)
        .filter((r) => r.startsWith("."))
        .map((r) => r.slice(1));
      const { float, width, unmapped } = imageRoles(roles);
      if (unmapped.length) {
        note(
          `image class "${unmapped.join(" ")}" dropped (no equivalent here)`,
        );
      }
      const sized =
        width && !/\bheader:/.test(img)
          ? img.replace(/\}\s*%\}$/, `, header: "${width}"} %}`)
          : img;
      return float ? `<span class="${float}">${sized}</span>` : sized;
    },
  );
}

// Liquid tags that appear in both Markdown and AsciiDoc posts. Applied to prose
// only; code is protected by the callers.
export function convertLiquid(text) {
  return (
    text
      // Liquid whitespace control isn't needed in Nunjucks
      .replace(/\{%- /g, "{% ")
      .replace(/ -%\}/g, " %}")
      // Table of contents
      .replace(/^\* Table of Contents\r?\n\{:toc\}[ \t]*$/gm, "[[toc]]")
      .replace(/\* Table of Contents\n\{% include toc\.md %\}/g, "[[toc]]")
      .replace(/\{%\s*include toc\.md\s*%\}/g, "[[toc]]")
      // Tags that changed name in Nunjucks
      .replace(/\{%\s*capture\b/g, "{% set")
      .replace(/\{%\s*endcapture\b/g, "{% endset")
      .replace(/\{%\s*comment\s*%\}/g, "{#")
      .replace(/\{%\s*endcomment\s*%\}/g, "#}")
      // Jekyll images: {% img blog/<src> alt:"..." width:"..." %}
      .replace(
        /\{%\s*img\s+(?!\{)(?:blog\/)?([^\s%]+)([\s\S]*?)%\}/g,
        (_, src, attrs) =>
          imgShortcode(
            src,
            jekyllImgAttr(attrs, "alt"),
            jekyllImgAttr(attrs, "width"),
          ),
      )
      // Embeds
      .replace(
        /\{%\s*youtube\s+["']?([\w-]+)["']?(?:\s+(\d+))?(?:\s+(\d+))?\s*%\}/g,
        (_, id, w, h) =>
          w
            ? `{% youtube "${id}", "", ${w}${h ? `, ${h}` : ""} %}`
            : `{% youtube "${id}" %}`,
      )
      .replace(
        /\{%\s*twitter\s+(\d+)\s*%\}/g,
        "https://twitter.com/i/status/$1",
      )
      .replace(
        /\{%\s*speakerdeck\s+(\w+)\s+(\d+)px\s*%\}/g,
        '{% speakerdeck "$1", $2 %}',
      )
      .replace(/\{%\s*excerpt\s+\S*\/(\S+?)\/?\s*%\}/g, '{% excerpt "$1" %}')
      // Links to other posts
      .replace(
        /\{%\s*post_url\s+(\d{4})-(\d{1,2})-(\d{1,2})-([^\s%]+)\s*%\}/g,
        (_, y, mo, d, slug) =>
          `/blog/${y}/${mo.padStart(2, "0")}/${d.padStart(2, "0")}/${slug}/`,
      )
      // Asset paths written by hand (video sources, posters) and the old
      // site's hashed asset URLs point at the served copy here.
      .replace(
        /\{%\s*asset_path\s+["']?([^"'%\s]+)["']?\s*%\}/g,
        (_, p) => `/img/${p.replace(/^\//, "")}`,
      )
      .replace(
        /\/assets-jekyll\/blog\/([^\s"')]+?)-[0-9a-f]{64}(\.\w+)/g,
        "/img/blog/$1$2",
      )
      // Includes that became macros or Nunjucks includes
      .replace(
        /\{%\s*include setup\/(integrator|cli|oidcdebugger)\.md([^%]*)%\}/g,
        (_, name, args) => `{{ macro.${name}(${liquidArgsToObject(args)}) }}`,
      )
      .replace(/\{%\s*include setup\/maven\.md\s*%\}/g, "{{ macro.maven() }}")
      .replace(
        /\{%\s*include integrator-org-warning\.html\s*%\}/g,
        '{% include "integrator-org-warning.njk" %}',
      )
  );
}

// ---------------------------------------------------------------------------
// Markdown posts
// ---------------------------------------------------------------------------

const FENCE_OPEN = /^[ \t]*(?:>[ \t]*)*(`{3,}|~{3,})/;
const FENCE_CLOSE = /^[ \t]*(?:>[ \t]*)*(`{3,}|~{3,})[ \t]*$/;

// Split into prose and code segments. Code = fenced blocks (``` or ~~~, closing
// fence at least as long as the opener), which are passed through untouched.
export function splitSegments(text) {
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
    const open = line.match(FENCE_OPEN);
    if (!fence && open) {
      flushProse();
      fence = { char: open[1][0], len: open[1].length };
      code = [line];
      continue;
    }
    if (fence) {
      code.push(line);
      const close = line.match(FENCE_CLOSE);
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
const MASK_OPEN = " ";
const MASK_CLOSE = "";
const MASK_RE = new RegExp(`${MASK_OPEN}(\\d+)${MASK_CLOSE}`, "g");

export function transformProse(text, apply) {
  const spans = [];
  const masked = text.replace(/(`+)([^\n]*?)\1/g, (match) => {
    spans.push(match);
    return `${MASK_OPEN}${spans.length - 1}${MASK_CLOSE}`;
  });
  return apply(masked).replace(MASK_RE, (_, index) => spans[Number(index)]);
}

// Kramdown attribute lists ("{: ...}" on a line of their own). A heading's
// "{: .no_toc }" keeps it out of the table of contents: the TOC plugin reads
// an HTML comment before the heading and markdown-it-attrs sets the class, so
// the heading keeps its id and its class as on the old site. "{:start="N"}"
// is implied by the list's own first number. Styling attributes have no
// equivalent and are dropped; "{:toc}" is handled with the TOC itself.
export function kramdownAttributes(text) {
  return text
    .replace(
      /^(#{1,6} [^\n]+)\n\{: ?\.no_toc ?\}[ \t]*$/gm,
      "<!-- omit from toc -->\n$1 {.no_toc}",
    )
    .replace(/^\{:start="\d+"\}[ \t]*\n(?=\d+\. )/gm, "")
    .replace(/^\{:(?!toc\})[^}\n]*\}[ \t]*\n?/gm, "");
}

// kramdown treats a lone "<br>" at column 0 between list items as inline
// text, so the list continues; markdown-it reads it as an HTML block that
// ends the list and swallows the next item. Indent it to the item's content.
export function listBreaks(text) {
  return text.replace(/(\n( {2,})\S[^\n]*\n)<br>(?=\n)/g, "$1$2<br>");
}

// Kramdown accepted these as written; markdown-it does not.
// - "**text **" with a space just inside a marker is not bold in CommonMark.
//   The space moves outside, which is what the author meant (kramdown's own
//   rendering paired the markers differently).
// - "<http://host/path?q=a b>" with spaces is not an autolink in CommonMark.
//   It becomes a link whose text keeps the spaces and whose target encodes
//   them, as kramdown rendered it.
export function kramdownLeniencies(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, (m, inner, at, all) => {
      const core = inner.trim();
      if (!core || core === inner) return m;
      // A moved space is dropped where it would double one or precede punctuation.
      const lead = at === 0 || /\s/.test(all[at - 1]) ? "" : " ";
      const after = all[at + m.length];
      const trail =
        inner.endsWith(" ") &&
        !(after === undefined || /[\s.,;:!?)]/.test(after))
          ? " "
          : "";
      return `${lead}**${core}**${trail}`;
    })
    .replace(
      /<(https?:\/\/[^>\n]*\s[^>\n]*)>/g,
      (_, url) => `[${url}](${url.replace(/\s/g, "%20")})`,
    );
}

// "``code```": a code span closed with one backtick too many, which CommonMark
// leaves as literal backticks. The extra one is dropped. Runs before code spans
// are masked, since the span is not recognizable until it is balanced.
export function fixBackticks(text) {
  return text.replace(/(?<!`)(`{2,})([^`\s][^`\n]*?)\1`(?!`)/g, "$1$2$1");
}

// A fence indented four spaces straight after a top-level paragraph: kramdown
// rendered a code block, CommonMark reads the lines as the paragraph's
// continuation. The block is dedented to the paragraph's level.
export function dedentFences(segments) {
  let lastProse = "";
  return segments.map((segment) => {
    if (!segment.code) {
      lastProse = segment.text;
      return segment;
    }
    const indent = segment.text.match(/^[ \t]*/)[0].length;
    // The paragraph block just before the fence: a list item anywhere in it
    // (or an indented line) means the fence belongs to that item.
    const block = [];
    for (const line of lastProse.split("\n").reverse()) {
      if (!line.trim()) {
        if (block.length) break;
        continue;
      }
      block.push(line);
    }
    const inList = block.some(
      (l) => /^\s/.test(l) || /^\s*([-*+]|\d+\.)\s/.test(l),
    );
    if (indent < 4 || !block.length || inList) return segment;
    const lines = segment.text.split("\n");
    const common = Math.min(
      ...lines.filter((l) => l.trim()).map((l) => l.match(/^[ \t]*/)[0].length),
    );
    return {
      ...segment,
      text: lines.map((l) => l.slice(Math.min(common, indent))).join("\n"),
    };
  });
}

function convertMarkdownProse(text, note) {
  return (
    imageAttributes(
      convertLiquid(
        kramdownLeniencies(listBreaks(kramdownAttributes(text)))
          // Kramdown leftovers, inline after a tag
          .replace(/ "no_toc"=""/g, "")
          .replace(/\{: \.center-image \}/g, "")
          .replace(/^\*\*Table of Contents\*\*\{: \.hide \}[ \t]*\r?\n/gm, ""),
      ),
      note,
    )
      // Drop empty attributes but keep the rest of the tag.
      .replace(/<([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g, (match, tag, attrs) =>
        attrs.includes('=""')
          ? `<${tag}${attrs.replace(/\s+[a-zA-Z-]+=""/g, "")}>`
          : match,
      )
      .replace(/<([a-zA-Z][a-zA-Z0-9]*) style: /g, "<$1 style=")
  );
}

const TEMPLATE_SYNTAX = /\{\{|\{%|\{#/;

// Nunjucks renders every post before Markdown does, so template syntax inside a
// code sample is evaluated unless it sits in a raw block. Jekyll had the same
// rule for Liquid, so authors usually wrapped these already; this catches the
// ones they missed. Returns the number of blocks and spans it wrapped.
export function protectTemplateSyntax(text) {
  let wrapped = 0;
  let inRaw = false;
  const out = splitSegments(text).map((segment) => {
    if (!segment.code) {
      // Track raw regions and wrap inline code spans that need it.
      return segment.text
        .split(/(\{%-?\s*(?:raw|endraw)\s*-?%\})/)
        .map((piece) => {
          if (/^\{%-?\s*raw/.test(piece)) inRaw = true;
          else if (/^\{%-?\s*endraw/.test(piece)) inRaw = false;
          else if (!inRaw) {
            return piece.replace(/(`+)([^\n]*?)\1/g, (span) => {
              if (!TEMPLATE_SYNTAX.test(span)) return span;
              wrapped++;
              return `{% raw %}${span}{% endraw %}`;
            });
          }
          return piece;
        })
        .join("");
    }
    // A fence that carries its own raw/endraw lines (a Jekyll habit) is
    // already protected; just keep the raw state in step with it.
    const rawTags = segment.text.match(/\{%-?\s*(raw|endraw)\s*-?%\}/g);
    if (rawTags) {
      inRaw =
        /\braw\b/.test(rawTags[rawTags.length - 1]) &&
        !/endraw/.test(rawTags[rawTags.length - 1]);
      return segment.text;
    }
    if (inRaw || !TEMPLATE_SYNTAX.test(segment.text)) return segment.text;
    wrapped++;
    return `{% raw %}\n${segment.text}\n{% endraw %}`;
  });
  return { text: out.join("\n"), wrapped };
}

export function convertMarkdown(content) {
  const notes = [];
  const { frontMatter, body } = splitFrontMatter(
    content.replace(/\r\n/g, "\n"),
  );
  const converted = dedentFences(splitSegments(body))
    .map((segment) =>
      segment.code
        ? segment.text
        : transformProse(fixBackticks(segment.text), (t) =>
            convertMarkdownProse(t, (m) => {
              if (!notes.includes(m)) notes.push(m);
            }),
          ),
    )
    // Each segment holds consecutive lines joined by newlines, so rejoining the
    // segments the same way reproduces the original line structure.
    .join("\n");
  const styled = body.match(/^\{: ?style=[^}\n]*\}[ \t]*$/gm);
  if (styled) {
    notes.push(
      `dropped ${styled.length} kramdown style attribute line(s), e.g. ${styled[0]}`,
    );
  }
  const redirects = frontMatter.match(
    /^redirect_(from|to):[^\n]*(?:\n[ \t]*-[^\n]*)*/gm,
  );
  if (redirects) {
    notes.push(
      `dropped ${redirects.join("; ").replace(/\s+/g, " ")}; redirects live in vercel.json, check it carries these`,
    );
  }
  const guarded = protectTemplateSyntax(converted);
  if (guarded.wrapped) {
    notes.push(
      `wrapped ${guarded.wrapped} code block(s)/span(s) containing template syntax in {% raw %}`,
    );
  }
  const fm = frontMatter
    ? `---\n${convertFrontMatter(frontMatter)}\n---\n`
    : "";
  return { markdown: fm + guarded.text, notes };
}

// ---------------------------------------------------------------------------
// AsciiDoc posts
// ---------------------------------------------------------------------------

const ADMONITIONS = ["NOTE", "TIP", "WARNING", "IMPORTANT", "CAUTION"];
const DELIMITERS = {
  "----": "listing",
  "....": "literal",
  "++++": "passthrough",
  "****": "sidebar",
  ____: "quote",
  "--": "open",
  "////": "comment",
};
// Example blocks use four or more '=' so they can nest.
const EXAMPLE_RE = /^={4,}$/;
const CODE_FENCE_RE = /^`{3,}/;
// A block attribute line: [source,java], [quote, Who, 'https://x[cite]'], [.role]
const BLOCK_ATTR_RE = /^\[(?!\[)[^\s\]][^\n]*\]$/;
const isDelimiter = (t) =>
  Boolean(DELIMITERS[t]) ||
  EXAMPLE_RE.test(t) ||
  CODE_FENCE_RE.test(t) ||
  t === "|===";
// A block title line: ".Title"
const BLOCK_TITLE_RE = /^\.[^\s.]/;
// Block metadata precedes a block in either order: [source,java] then .Title,
// or .Title then [source,java].
const isBlockMeta = (t) => BLOCK_ATTR_RE.test(t) || BLOCK_TITLE_RE.test(t);
// A Markdown fence closes on any backtick run at least as long as its opener,
// whatever info string the opener carried; other delimiters close on themselves.
const closesBlock = (line, opener) => {
  const t = line.trim();
  const fence = opener.match(/^(`{3,})/);
  if (!fence) return t === opener;
  const m = t.match(/^(`{3,})$/);
  return Boolean(m && m[1].length >= fence[1].length);
};

// Parse "[source,java,indent=0]" / "[NOTE]" / "[%collapsible]" / "[.role]" /
// "[#id]" / "[quote, Author, cite]" into a small descriptor.
export function parseBlockAttrs(line) {
  const inner = line.slice(1, -1);
  const attrs = { positional: [], named: {}, roles: [], options: [], id: null };
  // Shorthand: [#id.role%option]
  if (/^[#.%]/.test(inner) && !inner.includes(",")) {
    for (const part of inner.match(/[#.%][^#.%]+/g) || []) {
      if (part[0] === "#") attrs.id = part.slice(1);
      else if (part[0] === ".") attrs.roles.push(part.slice(1));
      else attrs.options.push(part.slice(1));
    }
    return attrs;
  }
  // Split on commas outside quotes.
  const parts = [];
  let current = "";
  let quote = null;
  for (const ch of inner) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
    } else if (ch === ",") {
      parts.push(current);
      current = "";
    } else current += ch;
  }
  parts.push(current);
  const unquote = (s) => s.replace(/^(["'])(.*)\1$/s, "$2");
  for (let part of parts) {
    part = part.trim();
    if (!part) continue;
    const named = part.match(/^([\w-]+)=(.*)$/s);
    if (named) {
      const value = unquote(named[2]);
      if (named[1] === "role") attrs.roles.push(...value.split(/\s+/));
      else if (named[1] === "options" || named[1] === "opts") {
        attrs.options.push(...value.split(","));
      } else if (named[1] === "id") attrs.id = value;
      else attrs.named[named[1]] = value;
    } else {
      attrs.positional.push(unquote(part));
    }
  }
  return attrs;
}

// Values of image:/image::/link macros: "alt=..., width=800, align=center" or
// positional "Alt text,800".
function parseMacroAttrs(text) {
  const attrs = parseBlockAttrs(`[${text}]`);
  return {
    alt: attrs.named.alt ?? attrs.positional[0] ?? "",
    width: attrs.named.width ?? attrs.positional[1],
    role: attrs.roles.join(" "),
    link: attrs.named.link,
  };
}

// "{% asset_path 'blog/dir/file.png' %}" or "blog/dir/file.png" -> "dir/file.png"
function imageSrc(target) {
  const asset = target.match(/\{%\s*asset_path\s+["']?([^"'%\s]+)["']?\s*%\}/);
  return (asset ? asset[1] : target).replace(/^\/?blog\//, "");
}

// Placeholder for bold markers while constrained/unconstrained forms are resolved.
const BOLD = "";

class AsciidocConverter {
  constructor() {
    this.attrs = {};
    this.notes = [];
    this.toc = null;
    this.examples = 0;
    this.figures = 0;
    this.tables = 0;
    this.ids = new Map();
  }

  // Asciidoctor's id for a section title, unique within the document.
  sectionId(text) {
    const base = asciidoctorId(headingText(text));
    const n = (this.ids.get(base) || 0) + 1;
    this.ids.set(base, n);
    return n > 1 ? `${base}-${n}` : base;
  }

  note(message) {
    if (!this.notes.includes(message)) this.notes.push(message);
  }

  // A raw asset reference (video, pdf, or an <img> in passthrough HTML) that
  // can't go through the {% img %} shortcode.
  assetUrl(p) {
    this.note(
      "raw asset path used outside {% img %}; the file must be served as-is",
    );
    return `/img/${p.replace(/^\//, "")}`;
  }

  // An image's link= target, which may itself be an asset path.
  linkTarget(target) {
    return target.replace(
      /\{%\s*asset_path\s+["']?([^"'%\s]+)["']?\s*%\}/g,
      (_, p) => this.assetUrl(p),
    );
  }

  // ---- inline ------------------------------------------------------------

  inline(text) {
    // Protect inline code and literal passthroughs first: `code`, `+code+`, +literal+.
    const masks = [];
    const mask = (s) => {
      masks.push(s);
      return `${MASK_OPEN}${masks.length - 1}${MASK_CLOSE}`;
    };
    let out = text
      // Attribute references defined in the document header. Undefined ones
      // (placeholders like {port} in prose) stay as written.
      .replace(/\{([a-zA-Z][\w-]*)\}/g, (m, name) =>
        Object.hasOwn(this.attrs, name.toLowerCase())
          ? this.attrs[name.toLowerCase()]
          : m,
      )
      // "\http://…" only suppresses AsciiDoc's auto-link; the backslash is not text.
      .replace(/\\(?=https?:\/\/)/g, "")
      // "`quoted`" and '`quoted`' are AsciiDoc smart quotes, not code.
      .replace(/"`(.+?)`"/g, '"$1"')
      .replace(/'`(.+?)`'/g, "'$1'")
      // Keyboard shortcuts, before the literal pass so their "+" survives.
      .replace(/kbd:\[([^\]]+)\]/g, (_, keys) =>
        mask(
          keys
            .split(/\s*\+\s*/)
            .filter(Boolean)
            .map((k) => `<kbd>${k.trim()}</kbd>`)
            .join("+"),
        ),
      )
      .replace(/(`+)\+([^`\n]*?)\+\1/g, (_, ticks, code) =>
        mask(`${ticks}${code}${ticks}`),
      )
      // Backslashes that only stop AsciiDoc substitutions ("\\{attr}", "\\*")
      // are not part of the code; Asciidoctor drops them in monospace too.
      .replace(/(`+)([^`\n]*?)\1/g, (m) => mask(m.replace(/\\([{*_#])/g, "$1")))
      .replace(/pass:[a-z,]*\[([^\]]*)\]/g, (_, s) => mask(s))
      // +literal+: no space just inside the plus signs, none inside words.
      .replace(
        /(^|[^\w+])\+(\S(?:[^+\n]*?\S)?)\+(?![\w+])/g,
        (_, pre, s) => pre + mask(s),
      );

    // Unsupported macros are kept verbatim and reported.
    for (const macro of [
      "btn",
      "menu",
      "icon",
      "footnote",
      "footnoteref",
      "indexterm",
    ]) {
      if (new RegExp(`\\b${macro}:`).test(out)) {
        this.note(`unsupported inline macro ${macro}: left as-is`);
      }
    }

    out = out
      // Inline images (also inside link text): image:target[attrs]
      .replace(
        /image:(\{%[^%]*%\}|[^\s[]+)\[([^\]]*)\]/g,
        (_, target, attrText) => {
          const a = parseMacroAttrs(attrText);
          // Roles carry the float and width the old stylesheet applied:
          // "pull-right img-100px" and the like.
          const roles = a.role ? a.role.split(/\s+/) : [];
          const mapped = imageRoles(roles);
          const width = a.width ?? mapped.width;
          const { float, unmapped } = mapped;
          if (unmapped.length) {
            this.note(
              `inline image role "${unmapped.join(" ")}" dropped (no equivalent here)`,
            );
          }
          let img = imgShortcode(imageSrc(target), a.alt, width);
          if (a.link) img = `[${img}](${this.linkTarget(a.link)})`;
          // Masked so the later "<" escaping leaves the wrapper alone.
          return float ? mask(`<span class="${float}">${img}</span>`) : img;
        },
      )
      // Links: https://x[text], link:x[text] (any target), mailto:x[text]
      .replace(
        /(?:link:([^\s[\]<>]+)|((?:https?|mailto):[^\s[\]<>]+))\[((?:[^[\]]|\[[^\]]*\])*)\]/g,
        (_, linkTarget, urlTarget, textPart) => {
          const url = linkTarget || urlTarget;
          // The whole bracket is the link text (commas included) unless it
          // ends in named attributes such as ",window=_blank".
          const label = textPart
            .replace(/,\s*(?:role|window|opts|options|id|title)=.*$/, "")
            .replace(/\^$/, "")
            .trim();
          return label
            ? `[${label}](${url})`
            : `<${url.replace(/^mailto:/, "")}>`;
        },
      )
      // Cross references: <<id,text>>, <<#id,text>>, <<Section Title>>
      .replace(/<<#?([^,>]+?)(?:,([^>]+))?>>/g, (_, target, label) => {
        const plain = target.trim();
        const isId = /^[\w-]+$/.test(plain);
        const id = isId ? plain : asciidoctorId(plain);
        if (!label && !isId) {
          this.note(
            `xref by section title "<<${plain}>>" converted to #${id}; verify the anchor exists`,
          );
        }
        return `[${label ? label.trim() : plain}](#${id})`;
      })
      // A bare URL with a "<placeholder>" in it: the auto-linker would stop at
      // the placeholder and double-escape it, so link it explicitly.
      .replace(/(?<![\w"'(\[])(https?:\/\/[^\s[\]]*<[^\s[\]]*)(?!\[)/g, (m) => {
        const url = m.replace(/[.,;:!?)]+$/, "");
        const text = url.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const href = url.replace(/</g, "%3C").replace(/>/g, "%3E");
        return `[${text}](${href})${m.slice(url.length)}`;
      })
      // AsciiDoc prose never contains raw HTML (that needs a passthrough), so
      // a "<placeholder>" is text; Markdown would read it as a tag.
      .replace(/<(?!(?:https?|mailto):)(?=[A-Za-z/!?])/g, "&lt;")
      // "--" between words or between spaces is an em dash.
      .replace(/(?<=\w)--(?=\w)/g, "\u2014")
      .replace(/(?<= )--(?= )/g, "\u2014")
      // Formatting. Unconstrained forms first, then constrained. Unconstrained
      // bold may start or end with a space ("** text**"); Markdown's may not.
      .replace(/\*\*(.+?)\*\*/g, (m, inner, at, all) => {
        const core = inner.trim();
        if (!core) return m;
        const afterSpace = at === 0 || /\s/.test(all[at - 1]);
        const lead = afterSpace ? "" : inner.slice(0, inner.indexOf(core));
        const trail = inner.slice(inner.indexOf(core) + core.length);
        return `${lead}${BOLD}${BOLD}${core}${BOLD}${BOLD}${trail}`;
      })
      .replace(
        /(^|[^\w*\\])\*(\S(?:[^*\n]*?\S)?)\*(?![\w*])/g,
        `$1${BOLD}${BOLD}$2${BOLD}${BOLD}`,
      )
      .replace(/__(.+?)__/g, "_$1_")
      .replace(/##(.+?)##/g, "<mark>$1</mark>")
      .replace(/\[\.([\w-]+)\]#([^#]+)#/g, '<span class="$1">$2</span>')
      .replace(/(^|[^\w#\\])#([^#\s][^#\n]*?)#(?![\w#])/g, "$1<mark>$2</mark>")
      .replace(/\^([^\s^]+)\^/g, "<sup>$1</sup>")
      .replace(/(^|[^\w~])~([^\s~]+)~(?![\w~])/g, "$1<sub>$2</sub>")
      .replace(//g, "*")
      // Remaining asset paths (link targets, raw HTML) point at the served copy.
      .replace(/\{%\s*asset_path\s+["']?([^"'%\s]+)["']?\s*%\}/g, (_, p) =>
        this.assetUrl(p),
      )
      // Escapes and symbol replacements Asciidoctor applies to prose
      .replace(/\\([*_#{}`])/g, "$1")
      .replace(/\(C\)/g, "©")
      .replace(/\(R\)/g, "®")
      .replace(/\(TM\)/g, "™");

    // Liquid tags that were wrapped over several source lines arrive here
    // reflowed onto one line, so they are converted after the join.
    out = convertLiquid(out);

    return out.replace(MASK_RE, (_, i) => masks[Number(i)]);
  }

  // Join a paragraph's lines into one (markdown-it runs with breaks: true, so a
  // newline would become <br>). A trailing " +" is an explicit hard break and
  // is kept as a newline.
  paragraph(lines, hardbreaks = false) {
    const out = [];
    let current = "";
    for (const raw of lines) {
      const line = raw.trim();
      const hard = hardbreaks || / \+$/.test(line);
      const text = line.replace(/ \+$/, "");
      current = current ? `${current} ${text}` : text;
      if (hard) {
        out.push(current);
        current = "";
      }
    }
    if (current) out.push(current);
    // "1) text" opens a paragraph in AsciiDoc but a list in Markdown.
    return out
      .map((l) => this.inline(l).replace(/^(\d+)([.)]) /, "$1\\$2 "))
      .join("\n");
  }

  // ---- document ----------------------------------------------------------

  convert(content) {
    const { frontMatter, body } = splitFrontMatter(
      content.replace(/\r\n/g, "\n"),
    );
    const lines = body.split("\n");

    // Header attribute entries (:name: value) come right after the front matter.
    let i = 0;
    while (
      i < lines.length &&
      (/^:[\w-]+!?:/.test(lines[i]) ||
        lines[i].trim() === "" ||
        /^\/\//.test(lines[i]))
    ) {
      this.attributeEntry(lines[i]);
      i++;
    }
    // Collapse runs of blank lines between blocks, never inside a fence.
    const bodyMd = splitSegments(this.blocks(lines.slice(i)))
      .map((s) => (s.code ? s.text : s.text.replace(/\n{3,}/g, "\n\n")))
      .join("\n");
    const fm = frontMatter
      ? `---\n${convertFrontMatter(frontMatter)}\n---\n`
      : "";
    let markdown = fm + bodyMd.replace(/\s+$/, "") + "\n";
    if (this.toc && this.toc !== "macro" && !markdown.includes("[[toc]]")) {
      // :toc: without a macro renders the TOC after the preamble; put it before
      // the first heading.
      markdown = markdown.replace(/^(#{2,} )/m, "[[toc]]\n\n$1");
    }
    const guarded = protectTemplateSyntax(markdown);
    if (guarded.wrapped) {
      this.note(
        `wrapped ${guarded.wrapped} code block(s)/span(s) containing template syntax in {% raw %}`,
      );
    }
    return { markdown: guarded.text, notes: this.notes };
  }

  attributeEntry(line) {
    const m = line.match(/^:([\w-]+)(!?):\s*(.*)$/);
    if (!m) return false;
    if (m[1] === "toc") this.toc = m[3] || "auto";
    else if (
      !["page-liquid", "experimental", "source-highlighter", "icons"].includes(
        m[1],
      )
    ) {
      // Asciidoctor lowercases attribute names, so {commandKey} reads :commandkey:.
      this.attrs[m[1].toLowerCase()] = m[2] ? "" : m[3];
    }
    return true;
  }

  // ---- blocks ------------------------------------------------------------

  // Convert a run of lines to Markdown blocks.
  blocks(lines) {
    const out = [];
    let i = 0;
    let pendingAttrs = null;
    let pendingTitle = null;
    let pendingAnchor = null;

    const push = (text) => {
      if (text !== "") out.push(text);
    };
    const takeAttrs = () => {
      const a = pendingAttrs;
      pendingAttrs = null;
      return a;
    };
    const takeTitle = () => {
      const t = pendingTitle;
      pendingTitle = null;
      return t;
    };

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed === "") {
        i++;
        continue;
      }

      // Comments
      if (trimmed === "////") {
        i = this.findClose(lines, i + 1, "////") + 1;
        continue;
      }
      if (/^\/\//.test(trimmed)) {
        i++;
        continue;
      }

      // Attribute entries in the body
      if (this.attributeEntry(trimmed)) {
        i++;
        continue;
      }

      // Block attribute line, anchor, title (all start at column 0; an
      // indented ".hidden" or "./command" is literal text).
      if (
        BLOCK_ATTR_RE.test(line) &&
        !/^\[\[.*\]\]$/.test(line) &&
        !/^\[\s*\{/.test(line)
      ) {
        pendingAttrs = parseBlockAttrs(trimmed);
        i++;
        continue;
      }
      if (/^\[\[[\w-]+(?:,[^\]]*)?\]\]$/.test(line)) {
        pendingAnchor = line.match(/^\[\[([\w-]+)/)[1];
        i++;
        continue;
      }
      if (/^\.[^\s.]/.test(line)) {
        pendingTitle = this.inline(line.slice(1));
        i++;
        continue;
      }

      // TOC macro
      if (/^toc::\[\]$/.test(trimmed)) {
        push("[[toc]]");
        i++;
        continue;
      }

      // Horizontal rule
      if (trimmed === "'''") {
        push("---");
        i++;
        continue;
      }

      // Section titles
      const heading = trimmed.match(/^(={2,6})\s+(.+?)(?:\s+=+)?$/);
      if (heading) {
        const attrs = takeAttrs();
        const text = this.inline(heading[2]);
        const explicit = pendingAnchor || attrs?.id;
        pendingAnchor = null;
        // The heading's own id comes from this site's anchor plugin (kramdown's
        // rule). Where Asciidoctor's id differs, or the source set one, it
        // becomes an anchor element so links into the old site's sections keep
        // resolving. (The "{#id}" attrs syntax would be read by Nunjucks as the
        // start of a template comment.)
        const auto = explicit ? null : this.sectionId(text);
        if (explicit) this.ids.set(explicit, 1);
        const id =
          explicit || (auto !== slugify(headingText(text)) ? auto : null);
        const anchor = id ? `<a id="${id}"></a>\n` : "";
        push(`${anchor}${"#".repeat(heading[1].length)} ${text}`);
        i++;
        continue;
      }

      // Delimited blocks
      if (isDelimiter(trimmed) && trimmed !== "|===") {
        const kind = CODE_FENCE_RE.test(trimmed)
          ? "fence"
          : DELIMITERS[trimmed] || "example";
        const close = this.findClose(lines, i + 1, trimmed);
        push(
          this.delimited(
            kind,
            lines.slice(i + 1, close),
            takeAttrs(),
            takeTitle(),
            trimmed,
          ),
        );
        i = close + 1;
        continue;
      }

      // Tables
      if (trimmed === "|===") {
        const close = this.findClose(lines, i + 1, "|===");
        push(this.table(lines.slice(i + 1, close), takeAttrs(), takeTitle()));
        i = close + 1;
        continue;
      }

      // Block image
      const blockImage = trimmed.match(
        /^image::(\{%[^%]*%\}|\S+?)\[([^\]]*)\]$/,
      );
      if (blockImage) {
        const a = parseMacroAttrs(blockImage[2]);
        const title = takeTitle();
        takeAttrs();
        let img = imgShortcode(imageSrc(blockImage[1]), a.alt, a.width);
        if (a.link) img = `[${img}](${this.linkTarget(a.link)})`;
        push(title ? `${img}\n\n_Figure ${++this.figures}. ${title}_` : img);
        i++;
        continue;
      }

      // Liquid tags on their own line
      if (/^\{%.*%\}$/.test(trimmed)) {
        push(convertLiquid(trimmed));
        i++;
        continue;
      }

      // Lists (including callout lists)
      if (this.listMarker(line)) {
        const end = this.findListEnd(lines, i);
        push(this.list(lines.slice(i, end)));
        i = end;
        continue;
      }

      // Admonition paragraph
      const admonition = trimmed.match(
        /^(NOTE|TIP|WARNING|IMPORTANT|CAUTION):\s+(.*)$/,
      );
      if (admonition) {
        const end = this.findParagraphEnd(lines, i);
        const body = [admonition[2], ...lines.slice(i + 1, end)];
        push(this.quote(`**${admonition[1]}:** ${this.paragraph(body)}`));
        i = end;
        continue;
      }

      // Literal paragraph (indented) outside a list -> code block
      if (/^\s+\S/.test(line)) {
        let end = i + 1;
        while (end < lines.length && /^\s+\S/.test(lines[end])) end++;
        const block = lines.slice(i, end);
        const indent = Math.min(
          ...block
            .filter((l) => l.trim())
            .map((l) => l.match(/^\s*/)[0].length),
        );
        push("```\n" + block.map((l) => l.slice(indent)).join("\n") + "\n```");
        i = end;
        continue;
      }

      // Paragraph
      const end = this.findParagraphEnd(lines, i);
      const attrs = takeAttrs();
      const title = takeTitle();
      const style = attrs?.positional?.[0];
      let text = this.paragraph(
        lines.slice(i, end),
        attrs?.options.includes("hardbreaks"),
      );
      if (style && ADMONITIONS.includes(style)) {
        text = this.quote(`**${style}:** ${text}`);
      } else if (style === "quote" || style === "verse") {
        text = this.quote(text, attrs.positional.slice(1));
      } else if (style) {
        this.note(`unhandled paragraph style [${style}]`);
      }
      const roles = attrs?.roles || [];
      if (roles.length) text += ` {${roles.map((r) => `.${r}`).join(" ")}}`;
      if (pendingAnchor) {
        text = `<a id="${pendingAnchor}"></a>\n${text}`;
        pendingAnchor = null;
      }
      push(title ? `**${title}**\n\n${text}` : text);
      i = end;
    }
    return out.join("\n\n");
  }

  findClose(lines, from, delimiter) {
    for (let j = from; j < lines.length; j++) {
      if (closesBlock(lines[j], delimiter)) return j;
    }
    this.note(
      `unterminated ${delimiter} block; rest of the post treated as its content`,
    );
    return lines.length;
  }

  // A paragraph ends at a blank line or at the start of another block.
  findParagraphEnd(lines, from) {
    let j = from + 1;
    while (j < lines.length) {
      const t = lines[j].trim();
      if (t === "" || isDelimiter(t)) break;
      if (/^(\[[^\]]*\]$|\.[^\s.]|={2,6} |image::|toc::|\/\/)/.test(lines[j]))
        break;
      if (this.listMarker(lines[j])) break;
      j++;
    }
    return j;
  }

  delimited(kind, inner, attrs, title, delimiter) {
    const style = attrs?.positional?.[0];
    const withTitle = (md) => (title ? `**${title}**\n\n${md}` : md);

    if (kind === "comment") return "";

    if (kind === "listing" || kind === "literal" || kind === "fence") {
      const sourceLang =
        style === "source" ? (attrs.positional[1] || "").trim() : "";
      // A Markdown fence inside AsciiDoc keeps its own language.
      const fenceLang =
        kind === "fence" ? delimiter.replace(/^`+/, "").trim() : "";
      if (attrs?.named?.indent !== undefined)
        this.note("source block indent= attribute ignored");
      if (attrs?.roles?.length)
        this.note(`source block role "${attrs.roles.join(" ")}" dropped`);
      // A listing that itself shows a Markdown fence needs a longer fence.
      const longest = Math.max(
        0,
        ...inner.map((l) => (l.match(/^\s*(`{3,})/) || ["", ""])[1].length),
      );
      const fence = "`".repeat(Math.max(3, longest + 1));
      // Auto-numbered callouts ("<.>", "<!--.-->") get their numbers here, the
      // way Asciidoctor assigns them: in order, per block.
      let n = 0;
      const code = inner.map((l) =>
        l.replace(/<!--\.-->|<\.>/g, (m) =>
          m === "<.>" ? `<${++n}>` : `<!--${++n}-->`,
        ),
      );
      return withTitle(
        fence +
          (fenceLang || sourceLang) +
          "\n" +
          code.join("\n") +
          "\n" +
          fence,
      );
    }

    if (kind === "passthrough") {
      return inner
        .map((l) =>
          convertLiquid(l).replace(
            /\{%\s*asset_path\s+["']?([^"'%\s]+)["']?\s*%\}/g,
            (_, p) => this.assetUrl(p),
          ),
        )
        .join("\n");
    }

    if (kind === "open") {
      const body = this.blocks(inner);
      if (attrs?.roles?.length) {
        this.note(
          `open block role "${attrs.roles.join(" ")}" wrapped in a div`,
        );
        return `<div class="${attrs.roles.join(" ")}">\n\n${body}\n\n</div>`;
      }
      return withTitle(body);
    }

    if (kind === "quote" || style === "quote" || style === "verse") {
      return this.quote(this.blocks(inner), attrs?.positional?.slice(1) || []);
    }

    if (attrs?.options.includes("collapsible")) {
      return `<details>\n<summary>${inlineHtml(title || "Details")}</summary>\n\n${this.blocks(inner)}\n\n</details>`;
    }

    if (kind === "sidebar") {
      this.note("sidebar block rendered as a blockquote");
      return this.quote(withTitle(this.blocks(inner)));
    }

    // Example blocks, with or without an admonition style
    const body = this.blocks(inner);
    if (style && ADMONITIONS.includes(style)) {
      const head = title ? `**${style}: ${title}**` : `**${style}:**`;
      return this.quote(`${head}\n\n${body}`);
    }
    // One grouped unit, as on the old site: an optional numbered caption,
    // then the content (often a listing and its callout list).
    const caption = title
      ? `Example ${++this.examples}. ${title} {.example-title}\n\n`
      : "";
    return `<div class="example">\n\n${caption}${body}\n\n</div>`;
  }

  quote(text, attribution = []) {
    const cited = attribution.filter(Boolean).map((a) => this.inline(a));
    const body = cited.length ? `${text}\n\n— ${cited.join(", ")}` : text;
    return body
      .split("\n")
      .map((l) => (l === "" ? ">" : `> ${l}`))
      .join("\n");
  }

  // ---- lists -------------------------------------------------------------

  listMarker(line) {
    const m = line.match(
      /^(\s*)(\*{1,5}|-|\.{1,5}|\d+\.|<(?:\d+|\.)>)\s+(\S.*)$/,
    );
    if (!m) return null;
    const [, indent, marker, text] = m;
    // `family` tells adjacent lists of different kinds apart.
    if (marker === "-") {
      return {
        depth: 1 + Math.floor(indent.length / 2),
        ordered: false,
        family: "bullet",
        text,
      };
    }
    if (marker[0] === "*")
      return { depth: marker.length, ordered: false, family: "bullet", text };
    if (marker[0] === ".")
      return { depth: marker.length, ordered: true, family: "dot", text };
    if (marker[0] === "<") {
      // "<.>" is auto-numbered; the list renderer counts it.
      const number = marker === "<.>" ? null : Number(marker.slice(1, -1));
      return {
        depth: 1,
        ordered: true,
        callout: true,
        family: "callout",
        number,
        text,
      };
    }
    return {
      depth: 1 + Math.floor(indent.length / 3),
      ordered: true,
      family: "number",
      number: Number(marker.slice(0, -1)),
      text,
    };
  }

  // A list runs until a blank line followed by something that isn't a list
  // item or continuation, or until a block that isn't attached with "+".
  findListEnd(lines, from) {
    let j = from + 1;
    let attached = null;
    const family = this.listMarker(lines[from]).family;
    while (j < lines.length) {
      const t = lines[j].trim();
      const prev = lines[j - 1]?.trim() ?? "";
      if (attached) {
        if (closesBlock(t, attached)) attached = null;
        j++;
        continue;
      }
      if (t === "") {
        let k = j;
        while (k < lines.length && lines[k].trim() === "") k++;
        if (k >= lines.length) return j;
        // The list continues past blank lines only for items of the same kind
        // (a bullet list followed by a numbered one is two lists), for a
        // continuation, or for an indented literal attached to the item.
        const next = this.listMarker(lines[k]);
        if (
          (next && (next.depth > 1 || next.family === family)) ||
          lines[k].trim() === "+" ||
          /^\s+\S/.test(lines[k])
        ) {
          j = k;
          continue;
        }
        return j;
      }
      if (t === "+") {
        j++;
        continue;
      }
      // "+" and any block metadata behind it attach the next block to the item.
      // Metadata starts at column 0; an indented ".x" line is literal text.
      let k = j - 1;
      while (k > from && isBlockMeta(lines[k])) k--;
      const afterContinuation = lines[k].trim() === "+";
      if (isBlockMeta(lines[j])) {
        if (afterContinuation) {
          j++;
          continue;
        }
        return j;
      }
      if (isDelimiter(t)) {
        if (afterContinuation) {
          attached = t;
          j++;
          continue;
        }
        return j;
      }
      if (/^(={2,6} |image::|toc::)/.test(t) && !afterContinuation) return j;
      j++;
    }
    return j;
  }

  list(lines) {
    // Parse into items: { depth, ordered, number, text lines, attached blocks }
    const items = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const marker = this.listMarker(line);
      if (marker) {
        items.push({ ...marker, lines: [marker.text], attached: [] });
        i++;
        continue;
      }
      const t = line.trim();
      const current = items[items.length - 1];
      if (!current || t === "") {
        if (current) current.sawBlank = true;
        i++;
        continue;
      }
      // Indented lines after a blank line form a literal block attached to the item.
      if (current.sawBlank && /^\s+\S/.test(line)) {
        const block = [];
        while (i < lines.length && /^\s+\S/.test(lines[i]))
          block.push(lines[i++]);
        current.attached.push(block);
        continue;
      }
      current.sawBlank = false;
      if (t === "+") {
        // Attach the following block: a whole delimited block, or a paragraph.
        i++;
        const block = [];
        while (i < lines.length && lines[i].trim() === "") i++;
        while (i < lines.length && isBlockMeta(lines[i].trim()))
          block.push(lines[i++]);
        const start = lines[i]?.trim();
        if (start && isDelimiter(start)) {
          const close = this.findClose(lines, i + 1, start);
          block.push(...lines.slice(i, close + 1));
          i = close + 1;
        } else {
          while (
            i < lines.length &&
            lines[i].trim() !== "" &&
            lines[i].trim() !== "+" &&
            !this.listMarker(lines[i])
          ) {
            block.push(lines[i++]);
          }
        }
        current.attached.push(block);
        continue;
      }
      // Lazy continuation of the item text.
      current.lines.push(t);
      i++;
    }

    const out = [];
    const counters = {};
    let prevDepth = 0;
    for (const item of items) {
      if (item.depth > prevDepth) counters[item.depth] = 0;
      prevDepth = item.depth;
      const indent = "  ".repeat(item.depth - 1);
      let marker;
      if (item.callout) {
        counters.callout = item.number ?? (counters.callout || 0) + 1;
        marker = `${counters.callout}.`;
      } else if (item.ordered) {
        counters[item.depth] =
          item.number && counters[item.depth] === 0
            ? item.number
            : (counters[item.depth] || 0) + 1;
        marker = `${counters[item.depth]}.`;
      } else marker = "-";
      const contentIndent = indent + " ".repeat(marker.length + 1);
      const text = this.paragraph(item.lines);
      out.push(
        `${indent}${marker} ${text.replace(/\n/g, `\n${contentIndent}`)}`,
      );
      for (const block of item.attached) {
        out.push("");
        out.push(
          this.blocks(block)
            .split("\n")
            .map((l) => (l === "" ? "" : contentIndent + l))
            .join("\n"),
        );
      }
    }
    if (items.length && items[0].callout) out.push("{.colist}");
    return out.join("\n");
  }

  // ---- tables ------------------------------------------------------------

  table(lines, attrs, title) {
    let columnCount = null;
    const cols = attrs?.named?.cols;
    if (cols) {
      const m = cols.match(/^(\d+)\*$/);
      columnCount = m ? Number(m[1]) : cols.split(",").length;
    }
    const cells = [];
    let firstLineCells = null;
    let blankAfterFirstLine = false;
    lines.forEach((line, idx) => {
      if (line.trim() === "") {
        if (firstLineCells !== null && cells.length === firstLineCells)
          blankAfterFirstLine = true;
        return;
      }
      if (line.startsWith("|") || /^\d*\.?\d*\+?[a-z]?\|/.test(line)) {
        cells.push(...splitCells(line).slice(1));
      } else if (cells.length) {
        cells[cells.length - 1] += "\n" + line;
      }
      if (idx === 0) firstLineCells = cells.length;
    });
    if (!columnCount) columnCount = firstLineCells || cells.length;
    const rows = [];
    for (let c = 0; c < cells.length; c += columnCount)
      rows.push(cells.slice(c, c + columnCount));
    // Header: explicit option, or an implicit first row on one line followed by a blank line.
    const hasHeader =
      attrs?.options.includes("header") ||
      (blankAfterFirstLine && firstLineCells === columnCount);
    const render = (cell) => {
      const text = cell.trim();
      if (/^(\[source|----|\|===)/m.test(text) || /\n\n/.test(text)) {
        this.note(
          "table cell with block content flattened; check the rendered table",
        );
      }
      return this.inline(
        text.replace(
          /^image::(\{%[^%]*%\}|\S+?)\[([^\]]*)\]$/gm,
          "image:$1[$2]",
        ),
      )
        .replace(/\n/g, "<br>")
        .replace(/\|/g, "\\|");
    };
    const md = [];
    const header = hasHeader ? rows.shift() : Array(columnCount).fill("");
    if (!hasHeader)
      this.note(
        "table without a header row; an empty header row was added (GFM needs one)",
      );
    md.push(`| ${header.map(render).join(" | ")} |`);
    md.push(`| ${Array(columnCount).fill("---").join(" | ")} |`);
    for (const row of rows) {
      while (row.length < columnCount) row.push("");
      md.push(`| ${row.map(render).join(" | ")} |`);
    }
    return title
      ? `**Table ${++this.tables}. ${title}**\n\n${md.join("\n")}`
      : md.join("\n");
  }
}

// Split a table row on "|" separators, ignoring pipes inside backticks and
// escaped pipes.
function splitCells(line) {
  const cells = [""];
  let inCode = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "`") inCode = !inCode;
    if (ch === "|" && !inCode && line[i - 1] !== "\\") cells.push("");
    else cells[cells.length - 1] += ch;
  }
  return cells;
}

// Markdown inside a <summary> tag isn't rendered, so convert the little
// inline markup a block title can carry to HTML.
function inlineHtml(text) {
  return text
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^\w])_([^_]+)_(?!\w)/g, "$1<em>$2</em>");
}

export function convertAsciidoc(content) {
  return new AsciidocConverter().convert(content);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    src: "../okta-blog",
    only: null,
    force: false,
    yes: false,
    dryRun: false,
    assets: true,
    report: null,
    overrides: {},
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--src") args.src = argv[++i];
    else if (a === "--override") {
      // slug=file: convert this post from another copy of the source (for
      // example a not-yet-merged upstream PR) instead of --src.
      const [slug, file] = argv[++i].split("=");
      args.overrides[slug] = file;
    } else if (a === "--only")
      args.only = argv[++i].split(",").map((s) => s.trim());
    else if (a === "--force") args.force = true;
    else if (a === "--yes") args.yes = true;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--no-assets") args.assets = false;
    else if (a === "--report") args.report = argv[++i];
    else throw new Error(`unknown argument ${a}`);
  }
  return args;
}

function sha(file) {
  return createHash("sha1").update(readFileSync(file)).digest("hex");
}

// Copy an image if missing; report when an existing copy differs from source.
function copyAsset(from, to, report, dryRun) {
  if (!existsSync(from)) {
    report.push(`missing in source: ${from}`);
    return;
  }
  if (existsSync(to)) {
    if (sha(from) !== sha(to))
      report.push(`differs from source, left as is: ${to}`);
    return;
  }
  if (!dryRun) {
    mkdirSync(path.dirname(to), { recursive: true });
    copyFileSync(from, to);
  }
  report.push(`copied ${to} (${(statSync(from).size / 1024).toFixed(0)} KB)`);
}

// jekyll-assets found an image by its stem, so a post may say ".jpeg" where
// the file is ".jpg". Point such references at the file that exists.
export function resolveImageRefs(markdown, findActual, note = () => {}) {
  let out = markdown;
  for (const ref of imageRefs(markdown)) {
    const actual = findActual(ref);
    if (!actual || actual === ref) continue;
    out = out.replace(
      new RegExp(
        ref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?=[\"'\\s])",
        "g",
      ),
      actual,
    );
    note(`image ${ref} is ${actual} in the source; reference updated`);
  }
  return out;
}

// The old repo keeps post images under img/blog, but a few sit at the img
// root with the author photos (avatar-*); jekyll-assets searched both.
export function sourceAsset(src, ref) {
  const roots = ["_source/_assets/img/blog", "_source/_assets/img"];
  return (
    roots.map((r) => path.join(src, r, ref)).find((p) => existsSync(p)) ??
    path.join(src, roots[0], ref)
  );
}

function localAsset(ref) {
  return /^avatar-/.test(ref)
    ? path.join(AVATAR_DIR, ref)
    : path.join(IMG_DIR, ref);
}

function siblingLookup(src) {
  return (ref) => {
    if (existsSync(sourceAsset(src, ref))) return ref;
    const dir = path.dirname(ref);
    const stem = path.basename(ref).replace(/\.[^.]+$/, "");
    for (const root of ["_source/_assets/img/blog", "_source/_assets/img"]) {
      const folder = path.join(src, root, dir);
      if (!existsSync(folder)) continue;
      const matches = readdirSync(folder).filter(
        (f) => f.replace(/\.[^.]+$/, "") === stem && !f.startsWith("."),
      );
      if (matches.length === 1) return path.posix.join(dir, matches[0]);
    }
    return null;
  };
}

function imageRefs(markdown) {
  const refs = new Set();
  for (const m of markdown.matchAll(/\{%\s*img\s*\{\s*src:\s*"([^"]+)"/g))
    refs.add(m[1]);
  const fm = markdown.match(/^image:\s*["']?([^"'\n]+?)["']?\s*$/m);
  if (fm && !/^https?:/.test(fm[1])) refs.add(fm[1].replace(/^\/?blog\//, ""));
  return [...refs];
}

// The post's author key(s), read with a regex: a few okta-blog posts carry
// front matter that Ruby's YAML accepts but js-yaml rejects.
export function authorKeys(frontMatter) {
  const m = frontMatter.match(/^author:\s*(.+)$/m);
  if (!m) return [];
  const value = m[1].trim();
  if (value.startsWith("[")) {
    return value
      .slice(1, -1)
      .split(",")
      .map((s) => s.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }
  return [value.replace(/^["']|["']$/g, "")];
}

function syncAuthors(srcRepo, markdown, dryRun, report) {
  const keys = authorKeys(splitFrontMatter(markdown).frontMatter);
  const target = yaml.load(readFileSync(AUTHORS_FILE, "utf8")) || {};
  const source =
    yaml.load(
      readFileSync(path.join(srcRepo, "_source/_data/authors.yml"), "utf8"),
    ) || {};
  let appended = "";
  for (const key of keys) {
    if (!key || target[key]) continue;
    if (!source[key]) {
      report.push(`author "${key}" is missing from both authors files`);
      continue;
    }
    appended += "\n" + yaml.dump({ [key]: source[key] }, { lineWidth: -1 });
    target[key] = source[key];
    report.push(`author "${key}" added to ${AUTHORS_FILE}`);
    if (source[key].avatar) {
      copyAsset(
        path.join(srcRepo, "_source/_assets/img", source[key].avatar),
        path.join(AVATAR_DIR, source[key].avatar),
        report,
        dryRun,
      );
    }
  }
  if (appended && !dryRun) {
    writeFileSync(
      AUTHORS_FILE,
      readFileSync(AUTHORS_FILE, "utf8").replace(/\s*$/, "\n") + appended,
    );
  }
}

// The old repo's file names are not always zero-padded ("2026-1-19-…");
// the URL and this site's file name are.
export function normalizeSlug(file) {
  return file
    .replace(/\.(md|adoc)$/, "")
    .replace(
      /^(\d{4})-(\d{1,2})-(\d{1,2})-/,
      (_, y, m, d) => `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}-`,
    );
}

// Local posts the old repo no longer has.
export function retiredPosts(localSlugs, upstreamSlugs) {
  const upstream = new Set(upstreamSlugs);
  return [...localSlugs].filter((slug) => !upstream.has(slug)).sort();
}

// The redirect vercel.json carries for a post's URL, with or without the
// trailing slash, or undefined.
export function redirectFor(redirects, slug) {
  const [, y, m, d, name] = slug.match(/^(\d{4})-(\d{2})-(\d{2})-(.+)$/) || [];
  if (!name) return undefined;
  const url = `/blog/${y}/${m}/${d}/${name}`;
  return redirects.find((r) => r.source === url || r.source === `${url}/`);
}

function postUrl(slug) {
  return `/blog/${slug.slice(0, 10).replace(/-/g, "/")}/${slug.slice(11)}/`;
}

// Image folders a post uses that no other post does.
function privateImageDirs(slug, allPosts) {
  const markdown = readFileSync(path.join(DEST_DIR, `${slug}.md`), "utf8");
  const dirs = new Set(
    imageRefs(markdown).map((ref) => ref.split("/").slice(0, -1).join("/")),
  );
  return [...dirs].filter(
    (dir) =>
      dir &&
      existsSync(path.join(IMG_DIR, dir)) &&
      !allPosts.some(
        (p) =>
          p !== slug &&
          readFileSync(path.join(DEST_DIR, `${p}.md`), "utf8").includes(
            `${dir}/`,
          ),
      ),
  );
}

// Posts the old repo retired: removed here after confirmation, with the
// image folders only they used. A post whose URL has no redirect in
// vercel.json is kept, so a reader lands on the replacement and not a 404.
async function pruneRetired(existing, postsDir, args, report) {
  const upstream = readdirSync(postsDir)
    .filter((f) => /\.(md|adoc)$/.test(f))
    .map(normalizeSlug);
  const retired = retiredPosts(existing, upstream);
  if (!retired.length) return 0;
  const redirects = JSON.parse(readFileSync("vercel.json", "utf8")).redirects;
  const all = [...existing];
  const plan = retired.map((slug) => ({
    slug,
    redirect: redirectFor(redirects, slug),
    dirs: privateImageDirs(slug, all),
  }));
  const lines = [`## Retired in the old repo`];
  for (const p of plan) {
    lines.push(
      p.redirect
        ? `- ${p.slug}.md: ${p.redirect.source} redirects to ${p.redirect.destination}` +
            (p.dirs.length
              ? `; with ${p.dirs.map((d) => `${IMG_DIR}/${d}/`).join(", ")}`
              : "")
        : `- ${p.slug}.md: kept, no redirect in vercel.json for ${postUrl(p.slug)}; add one to the replacement post first`,
    );
  }
  const removable = plan.filter((p) => p.redirect);
  if (args.dryRun || !removable.length) {
    report.push(lines.join("\n"));
    return 0;
  }
  console.log(lines.join("\n"));
  let go = args.yes;
  if (!go && process.stdin.isTTY) {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const answer = await rl.question(
      `Remove ${removable.length} retired post(s) and their private image folders? [y/N] `,
    );
    rl.close();
    go = /^y(es)?$/i.test(answer.trim());
  }
  if (!go) {
    lines.push("- nothing removed (answer y, or pass --yes)");
    report.push(lines.join("\n"));
    return 0;
  }
  for (const p of removable) {
    for (const dir of p.dirs)
      rmSync(path.join(IMG_DIR, dir), { recursive: true });
    rmSync(path.join(DEST_DIR, `${p.slug}.md`));
  }
  lines.push(`- removed ${removable.length} post(s)`);
  report.push(lines.join("\n"));
  return removable.length;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const postsDir = path.join(args.src, "_source/_posts");
  if (!existsSync(postsDir)) {
    throw new Error(`no posts at ${postsDir}; pass --src <path-to-okta-blog>`);
  }
  const existing = new Set(
    readdirSync(DEST_DIR)
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.slice(0, -3)),
  );
  const sources = readdirSync(postsDir)
    .filter((f) => /\.(md|adoc)$/.test(f))
    .map((f) => ({
      file: f,
      slug: normalizeSlug(f),
      adoc: f.endsWith(".adoc"),
    }))
    .filter((p) =>
      args.only
        ? args.only.includes(p.slug)
        : args.force || !existing.has(p.slug),
    );

  const report = [];
  let written = 0;
  for (const post of sources) {
    const dest = path.join(DEST_DIR, `${post.slug}.md`);
    if (existing.has(post.slug) && !args.force && !args.only) continue;
    if (!/^\d{4}-\d{2}-\d{2}-/.test(post.slug)) {
      report.push(
        `## ${post.file}\n- skipped: file name is not YYYY-MM-DD-slug`,
      );
      continue;
    }
    const override = args.overrides[post.slug];
    const content = readFileSync(
      override || path.join(postsDir, post.file),
      "utf8",
    );
    const { markdown: converted, notes } = post.adoc
      ? convertAsciidoc(content)
      : convertMarkdown(content);
    const markdown = args.assets
      ? resolveImageRefs(converted, siblingLookup(args.src), (n) =>
          notes.push(n),
        )
      : converted;
    const lines = [
      `## ${post.file} -> ${dest}${existing.has(post.slug) ? " (overwritten)" : ""}`,
    ];
    if (override)
      lines.push(
        `- converted from ${override} instead of the okta-blog checkout`,
      );
    for (const n of notes) lines.push(`- ${n}`);
    if (!args.dryRun) {
      writeFileSync(dest, markdown);
      written++;
    }
    if (args.assets) {
      const assetReport = [];
      for (const ref of imageRefs(markdown)) {
        copyAsset(
          sourceAsset(args.src, ref),
          localAsset(ref),
          assetReport,
          args.dryRun,
        );
      }
      syncAuthors(args.src, markdown, args.dryRun, assetReport);
      for (const a of assetReport)
        if (!a.startsWith("copied")) lines.push(`- ${a}`);
      const copied = assetReport.filter((a) => a.startsWith("copied")).length;
      if (copied) lines.push(`- copied ${copied} file(s)`);
    }
    report.push(lines.join("\n"));
  }
  const pruned = args.only
    ? 0
    : await pruneRetired(existing, postsDir, args, report);
  const summary =
    `# Migration report\n\n${sources.length} post(s) processed, ${written} written` +
    `${pruned ? `, ${pruned} retired post(s) removed` : ""}` +
    `${args.dryRun ? " (dry run)" : ""}.\n\n${report.join("\n\n")}\n`;
  if (args.report) writeFileSync(args.report, summary);
  console.log(summary);
  console.log(
    "Do not run Prettier or any formatter over the migrated files: it reformats the code samples.",
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
