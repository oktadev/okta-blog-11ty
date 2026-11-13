import TurndownService from "turndown";
import { tables, strikethrough } from "turndown-plugin-gfm";
import { prefixAssetPaths, renderMarkdownAttrs } from "./transforms.js";

// Converts a post's rendered body back to Markdown for the "Copy page" and
// "View as Markdown" actions. The source files can't be served as-is: they are
// full of Nunjucks shortcodes, macros and includes that only mean something to
// this site's build. The rendered HTML has all of those resolved, so this works
// from that instead and maps the site's own markup back to plain Markdown.

const YOUTUBE = /youtube(?:-nocookie)?\.com\/embed\/([\w-]+)/;

function absolute(url, origin, pageUrl) {
  if (!url) return url;
  if (/^[a-z][a-z\d+.-]*:/i.test(url)) return url; // http:, mailto:, etc.
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("#")) return `${origin}${pageUrl}${url}`;
  if (url.startsWith("/")) return `${origin}${url}`;
  return new URL(url, `${origin}${pageUrl}`).href;
}

// eleventy-img's src is the smallest rendition; the last srcset entry is the
// largest, which is what a reader following the link wants.
function largestSource(img) {
  const srcset = img.getAttribute("srcset");
  if (!srcset) return img.getAttribute("src");
  const candidates = srcset.split(",").map((s) => s.trim().split(/\s+/)[0]);
  return candidates[candidates.length - 1];
}

function languageOf(node) {
  const cls = node?.getAttribute?.("class") || "";
  return (cls.match(/language-([\w+#.-]+)/) || [])[1] || "";
}

function fence(code, lang) {
  const longest = Math.max(
    2,
    ...(code.match(/^`{3,}/gm) || []).map((m) => m.length),
  );
  const ticks = "`".repeat(longest + 1);
  return `\n\n${ticks}${lang}\n${code.replace(/\n$/, "")}\n${ticks}\n\n`;
}

function createService(origin, pageUrl) {
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "_",
    hr: "---",
  });
  td.use([tables, strikethrough]);

  // Prose that shows a tag ("&lt;p&gt;" in the HTML) would come back as a real
  // tag, which a Markdown renderer then treats as HTML. Code spans and blocks
  // don't go through escape(), so they keep their literal "<".
  const escape = td.escape.bind(td);
  td.escape = (text) => escape(text).replace(/</g, "&lt;");

  // Turndown pads list markers to four columns ("-   item"); use one space.
  td.addRule("listItem", {
    filter: "li",
    replacement: (content, node) => {
      const parent = node.parentNode;
      let prefix = "- ";
      if (parent.nodeName === "OL") {
        const start = Number(parent.getAttribute("start") || 1);
        let index = 0;
        for (let el = node.previousSibling; el; el = el.previousSibling) {
          if (el.nodeName === "LI") index += 1;
        }
        prefix = `${start + index}. `;
      }
      const isParagraph = /\n$/.test(content);
      const body = content.replace(/^\n+/, "").replace(/\n+$/, "");
      const indented = body.replace(/\n/g, `\n${" ".repeat(prefix.length)}`);
      return (
        prefix +
        indented +
        (isParagraph ? "\n" : "") +
        (node.nextSibling ? "\n" : "")
      );
    },
  });

  td.remove(["script", "style", "noscript"]);
  // The live editors' output panes are empty until the in-page Python runs.
  td.remove((node) => node.nodeName === "PRE" && !node.textContent.trim());
  // The table of contents only repeats the headings that follow it.
  td.remove((node) => node.nodeName === "NAV");

  // Headings wrap their text in a self-link: <h2><a class="direct-link">.
  td.addRule("headingSelfLink", {
    filter: (node) =>
      node.nodeName === "A" && node.classList.contains("direct-link"),
    replacement: (content) => content,
  });

  td.addRule("codeBlock", {
    filter: (node) => node.nodeName === "PRE",
    replacement: (_content, node) => {
      const code = node.querySelector("code") || node;
      const lang =
        languageOf(code) ||
        languageOf(node) ||
        languageOf(node.parentNode?.parentNode);
      // Callout badges render as <i class="conum"></i><b>(1)</b>; textContent
      // keeps the "(1)" and drops the empty icon.
      return fence(code.textContent, lang === "text" ? "" : lang);
    },
  });

  td.addRule("image", {
    filter: "img",
    replacement: (_content, node) => {
      const src = absolute(largestSource(node), origin, pageUrl);
      const alt = (node.getAttribute("alt") || "").replace(/[[\]]/g, "");
      return src ? `![${alt}](${src})` : "";
    },
  });

  td.addRule("link", {
    filter: (node) =>
      node.nodeName === "A" &&
      node.getAttribute("href") &&
      !node.classList.contains("direct-link") &&
      !node.classList.contains("footnote-backref"),
    replacement: (content, node) => {
      const href = absolute(node.getAttribute("href"), origin, pageUrl);
      const text = content.trim();
      if (!text) return "";
      return text === href ? `<${href}>` : `[${text}](${href})`;
    },
  });

  td.addRule("iframe", {
    filter: "iframe",
    replacement: (_content, node) => {
      const src = node.getAttribute("src") || "";
      const yt = src.match(YOUTUBE);
      if (yt)
        return `\n\n[YouTube video](https://www.youtube.com/watch?v=${yt[1]})\n\n`;
      const title = node.getAttribute("title") || "Embedded content";
      return `\n\n[${title}](${absolute(src, origin, pageUrl)})\n\n`;
    },
  });

  // markdown-it-footnote output, back to [^n] references and definitions.
  td.addRule("footnoteRef", {
    filter: (node) =>
      node.nodeName === "SUP" && node.classList.contains("footnote-ref"),
    replacement: (_content, node) =>
      `[^${node.textContent.replace(/[^\w]/g, "")}]`,
  });
  td.addRule("footnoteBackref", {
    filter: (node) =>
      node.nodeName === "A" && node.classList.contains("footnote-backref"),
    replacement: () => "",
  });
  td.addRule("footnotes", {
    filter: (node) =>
      node.nodeName === "SECTION" && node.classList.contains("footnotes"),
    replacement: (_content, node) => {
      const items = Array.from(node.querySelectorAll("li.footnote-item"));
      const defs = items.map((li, i) => {
        const id = (li.getAttribute("id") || "").replace(/^fn/, "") || i + 1;
        const text = td.turndown(li.innerHTML).replace(/\n+/g, " ").trim();
        return `[^${id}]: ${text}`;
      });
      return `\n\n${defs.join("\n")}\n\n`;
    },
  });
  td.addRule("footnoteSeparator", {
    filter: (node) =>
      node.nodeName === "HR" && node.classList.contains("footnotes-sep"),
    replacement: () => "",
  });

  td.addRule("details", {
    filter: "summary",
    replacement: (content) => `\n\n**${content.trim()}**\n\n`,
  });

  // A table GFM can express: a heading row and inline-only cells. Anything
  // else is a layout table (images side by side, a request beside its
  // response, an emoji beside a note), which Turndown would leave as raw HTML.
  // Those are flattened: each cell becomes its own block, in reading order.
  td.addRule("layoutTable", {
    filter: (node) => {
      if (node.nodeName !== "TABLE" || !node.rows?.length) return false;
      const first = node.rows[0];
      const hasHeading =
        first.parentNode.nodeName === "THEAD" ||
        Array.from(first.cells).every((cell) => cell.nodeName === "TH");
      const hasBlocks = node.querySelector(
        "pre, table, ul, ol, blockquote, p + p",
      );
      return !hasHeading || Boolean(hasBlocks);
    },
    replacement: (_content, node) => {
      const rows = Array.from(node.rows).map((row) =>
        Array.from(row.cells)
          .map((cell) => td.turndown(cell.innerHTML).trim())
          .filter(Boolean),
      );
      // One row of two cells, the first an emoji: the site's callout idiom.
      if (rows.length === 1 && rows[0].length === 2 && !/\w/.test(rows[0][0])) {
        const note = rows[0].join(" ");
        return `\n\n${note.replace(/^/gm, "> ")}\n\n`;
      }
      return `\n\n${rows.flat().join("\n\n")}\n\n`;
    },
  });

  // In-browser Python editors (the password hashing post) hold their code in
  // a <textarea>.
  td.addRule("liveCode", {
    filter: (node) =>
      node.nodeName === "TEXTAREA" && node.classList.contains("live-code"),
    replacement: (_content, node) => fence(node.textContent, "python"),
  });

  return td;
}

function yamlString(value) {
  return JSON.stringify(String(value ?? ""));
}

export function postToMarkdown({
  html,
  title,
  description,
  authors,
  date,
  url,
  origin,
}) {
  const td = createService(origin, url);
  const body = td
    .turndown(prefixAssetPaths(renderMarkdownAttrs(html)))
    .replace(/^[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const header = [
    "---",
    `title: ${yamlString(title)}`,
    description ? `description: ${yamlString(description)}` : null,
    authors.length ? `author: ${yamlString(authors.join(", "))}` : null,
    `date: ${date}`,
    `url: ${origin}${url}`,
    "---",
  ].filter(Boolean);

  return `${header.join("\n")}\n\n# ${title}\n\n${body}\n`;
}
