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
//   node scripts/migrate-posts.js [--src ../okta-blog] [--only slug,slug] [--all]
//                                 [--force] [--dry-run] [--no-assets] [--report file]
//
// By default only posts missing from src/blog/posts are written. Images the
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
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import * as yaml from "js-yaml";
// The site's slug rules, so xrefs land on the anchors markdown-it-anchor generates.
import { slugify } from "../utils/markdown.js";

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
  const out = frontMatter
    .replace(/^layout: blog_post[ \t]*\r?\n?/m, "")
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
  const lines = frontMatter.split("\n");
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
  const quoted = attrs.match(new RegExp(`${name}\\s*[:=]\\s*"([^"]*)"`));
  if (quoted) return quoted[1];
  const bare = attrs.match(new RegExp(`${name}\\s*[:=]\\s*([^\\s"%]+)`));
  return bare ? bare[1] : undefined;
}

function imgShortcode(src, alt = "", width) {
  const parts = [`src: "${src}"`, `alt: "${(alt || "").replace(/"/g, '\\"')}"`];
  if (width) parts.push(`header: "${String(width).replace(/px$/, "")}"`);
  return `{% img {${parts.join(", ")}} %}`;
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
      .replace(/\{%\s*img\s+blog\/([^\s%]+)([\s\S]*?)%\}/g, (_, src, attrs) =>
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

function convertMarkdownProse(text) {
  return (
    convertLiquid(
      text
        // Kramdown leftovers
        .replace(/ "no_toc"=""/g, "")
        .replace(/\{: \.center-image \}/g, "")
        .replace(/^\*\*Table of Contents\*\*\{: \.hide \}[ \t]*\r?\n/gm, ""),
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
  const converted = splitSegments(body)
    .map((segment) =>
      segment.code
        ? segment.text
        : transformProse(segment.text, convertMarkdownProse),
    )
    // Each segment holds consecutive lines joined by newlines, so rejoining the
    // segments the same way reproduces the original line structure.
    .join("\n");
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
        Object.hasOwn(this.attrs, name) ? this.attrs[name] : m,
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
      .replace(/(`+)([^`\n]*?)\1/g, (m) => mask(m))
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
          if (a.role) {
            this.note(
              `inline image role "${a.role}" dropped (no equivalent class here)`,
            );
          }
          const img = imgShortcode(imageSrc(target), a.alt, a.width);
          return a.link ? `[${img}](${this.linkTarget(a.link)})` : img;
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
        const id = isId ? plain : slugify(plain);
        if (!label && !isId) {
          this.note(
            `xref by section title "<<${plain}>>" converted to #${id}; verify the anchor exists`,
          );
        }
        return `[${label ? label.trim() : plain}](#${id})`;
      })
      // AsciiDoc prose never contains raw HTML (that needs a passthrough), so
      // a "<placeholder>" is text; Markdown would read it as a tag.
      .replace(/<(?!(?:https?|mailto):)(?=[A-Za-z/!?])/g, "&lt;")
      // Formatting. Unconstrained forms first, then constrained.
      .replace(/\*\*(.+?)\*\*/g, `${BOLD}${BOLD}$1${BOLD}${BOLD}`)
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
    return out.map((l) => this.inline(l)).join("\n");
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
      this.attrs[m[1]] = m[2] ? "" : m[3];
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
        const id = pendingAnchor || attrs?.id;
        pendingAnchor = null;
        // An explicit id becomes an anchor element: the "{#id}" attrs syntax
        // would be read by Nunjucks as the start of a template comment.
        const anchor = id ? `<a id="${id}"></a>\n` : "";
        push(
          `${anchor}${"#".repeat(heading[1].length)} ${this.inline(heading[2])}`,
        );
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
        push(title ? `${img}\n\n_${title}_` : img);
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
      if (lines[j].trim() === delimiter) return j;
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
      return `<details>\n<summary>${title || "Details"}</summary>\n\n${this.blocks(inner)}\n\n</details>`;
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
    this.note("example block unwrapped (its border is not reproduced)");
    return withTitle(body);
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
        if (t === attached) attached = null;
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
      const afterContinuation =
        prev === "+" ||
        (BLOCK_ATTR_RE.test(prev) && lines[j - 2]?.trim() === "+") ||
        (/^\.[^\s.]/.test(prev) &&
          (lines[j - 2]?.trim() === "+" ||
            (BLOCK_ATTR_RE.test(lines[j - 2]?.trim() ?? "") &&
              lines[j - 3]?.trim() === "+")));
      if (BLOCK_ATTR_RE.test(lines[j]) || /^\.[^\s.]/.test(lines[j])) {
        if (
          prev === "+" ||
          (BLOCK_ATTR_RE.test(prev) && lines[j - 2]?.trim() === "+")
        ) {
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
        if (i < lines.length && BLOCK_ATTR_RE.test(lines[i].trim()))
          block.push(lines[i++]);
        if (i < lines.length && /^\.[^\s.]/.test(lines[i].trim()))
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
    return title ? `**${title}**\n\n${md.join("\n")}` : md.join("\n");
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
    all: false,
    force: false,
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
    else if (a === "--all") args.all = true;
    else if (a === "--force") args.force = true;
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

function main() {
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
      slug: f.replace(/\.(md|adoc)$/, ""),
      adoc: f.endsWith(".adoc"),
    }))
    .filter((p) =>
      args.only
        ? args.only.includes(p.slug)
        : args.all || args.force || !existing.has(p.slug),
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
    const { markdown, notes } = post.adoc
      ? convertAsciidoc(content)
      : convertMarkdown(content);
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
          path.join(args.src, "_source/_assets/img/blog", ref),
          path.join(IMG_DIR, ref),
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
  const summary =
    `# Migration report\n\n${sources.length} post(s) processed, ${written} written` +
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
  main();
}
