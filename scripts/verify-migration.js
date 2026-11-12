// Compare migrated posts against the live site to prove no content was lost.
//
// For each post it fetches https://developer.okta.com/blog/YYYY/MM/DD/slug
// (cached under node_modules/.cache/verify-migration/), extracts the article
// body, and compares it with the same page from a local build in _site:
//   - prose blocks (paragraphs, list items, headings, table cells) are matched
//     by normalized text, then fuzzily, and anything left only on the live
//     side is reported as missing;
//   - <pre> code blocks are compared one by one, exactly, after normalizing
//     whitespace and callout markers;
//   - inline <code> spans are compared as multisets.
//
// Usage: npm run build && node scripts/verify-migration.js <slug> [<slug>...]
//        node scripts/verify-migration.js --file slugs.txt [--details] [--site _site]
// Exit code 1 when any post has missing prose or mismatched code.
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import {
  builtAssetRefs,
  publishedPath,
  rawAssetRefs,
} from "../utils/raw-assets.js";

const LIVE = "https://developer.okta.com";
const CACHE = "node_modules/.cache/verify-migration";

// ---------------------------------------------------------------------------
// HTML helpers (no dependencies: the pages are simple and well-formed)
// ---------------------------------------------------------------------------

const ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "...",
  mdash: "-",
  ndash: "-",
  rsquo: "'",
  lsquo: "'",
  rdquo: '"',
  ldquo: '"',
  copy: "(c)",
  reg: "(r)",
  trade: "(tm)",
  dash: "-",
  hyphen: "-",
  rarr: "->",
  larr: "<-",
  harr: "<->",
  laquo: "<<",
  raquo: ">>",
  times: "x",
  middot: ".",
  bull: "*",
  zwsp: "",
  thinsp: " ",
  ensp: " ",
  emsp: " ",
};

export function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16)),
    )
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

// The element that starts at `start` (an opening tag) and its balanced end.
export function balancedElement(html, start) {
  const tag = html.slice(start).match(/^<([a-z0-9]+)/i)?.[1];
  if (!tag) return null;
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi");
  re.lastIndex = start;
  let depth = 0;
  let m;
  while ((m = re.exec(html))) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return html.slice(start, m.index + m[0].length);
  }
  return html.slice(start);
}

export function elementByClass(html, className) {
  const re = new RegExp(
    `<(?:div|article|section)[^>]*class="[^"]*\\b${className}\\b[^"]*"[^>]*>`,
    "i",
  );
  const m = html.match(re);
  return m ? balancedElement(html, m.index) : null;
}

// Typographic variation that differs between Asciidoctor/kramdown and
// markdown-it, and callout markers, are normalized away before comparing.
export function normalizeText(s) {
  return (
    decodeEntities(s)
      .replace(/[‘’‚′]/g, "'")
      .replace(/[“”„″]/g, '"')
      // Non-breaking, thin and en/em spaces are spaces.
      .replace(/[\u00a0\u2002\u2003\u2009]/g, " ")
      // Every dash is a hyphen; "--" and an em dash compare equal.
      .replace(/[\u2010\u2011\u2013\u2014\u2212]/g, "-")
      .replace(/-{2,}/g, "-")
      // A backslash that only stops an AsciiDoc substitution is not text, and
      // a stray backtick left by an unparsed code span is not either.
      .replace(/\\(?=\*|https?:)/g, "")
      .replace(/`/g, " ")
      .replace(/\u2026/g, "...")
      .replace(
        /[\u21d0\u21d2\u2192\u2190]/g,
        (c) =>
          ({ "\u21d0": "<=", "\u21d2": "=>", "\u2192": "->", "\u2190": "<-" })[
            c
          ],
      )
      // Zero-width characters are nothing.
      .replace(/[\u200b\u200c\u2060\ufeff]/g, "")
      .replace(/[①-⑳]/g, "")
      .replace(/\s*(?:<\d+>|\(\d+\))\s*$/gm, "")
      .replace(/\(c\)|©/gi, "(c)")
      .replace(/[®™]/g, "")
      .replace(/\s+/g, " ")
      .replace(/\s+([.,;:!?)])/g, "$1")
      .trim()
  );
}

function stripTags(s) {
  return s.replace(/<[^>]+>/g, "");
}

// Split an article's HTML into prose blocks, code blocks and inline code.
export function extract(html) {
  let body = html;
  // Drop tables of contents (both sites list the headings again there) and
  // the changelog this site's layout appends.
  for (const re of [
    /<(?:div|nav)[^>]*(?:id="toc"|class="[^"]*\btoc\b[^"]*"|class="[^"]*table-of-contents[^"]*")[^>]*>/i,
    /<ul[^>]*id="markdown-toc"[^>]*>/i,
    /<p[^>]*class="hide"[^>]*>/i,
  ]) {
    let m;
    while ((m = body.match(re))) {
      const el = balancedElement(body, m.index);
      body = body.slice(0, m.index) + body.slice(m.index + el.length);
    }
  }
  const changelog = body.search(/<p[^>]*id="changelog"/);
  if (changelog >= 0) body = body.slice(0, changelog);
  body = body
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");
  // The setup macros' collapsible details differ by design between the old
  // include and this site's macro (same facts, different code formatting).
  let d;
  while (
    (d = body.match(
      /<details[^>]*>\s*<summary[^>]*>\s*(?:What does the Okta CLI do\?|Where are my new app's credentials\?)/i,
    ))
  ) {
    const el = balancedElement(body, d.index);
    body = body.slice(0, d.index) + body.slice(d.index + el.length);
  }

  const code = [];
  body = body.replace(/<pre\b[\s\S]*?<\/pre>/gi, (pre) => {
    let inner = pre.replace(/<td class="rouge-gutter"[\s\S]*?<\/td>/gi, "");
    inner = inner.replace(/<span class="line-number">[\s\S]*?<\/span>/gi, "");
    // Copy-button labels and similar UI text inside pre elements
    inner = inner.replace(/<button[\s\S]*?<\/button>/gi, "");
    // Asciidoctor drops a callout's comment prefix ("// <1>") entirely and
    // renders a badge; the Markdown keeps "// <1>". Strip both forms.
    const lines = decodeEntities(stripTags(inner.replace(/<br\s*\/?>/gi, "\n")))
      .replace(/ /g, " ")
      .split("\n")
      .map((l) =>
        l
          .replace(/\s+$/, "")
          .replace(
            /\s*(?:\/\/|#|;;|--|<!--)?\s*<(?:\d+|\.)>\s*(?:-->)?\s*$/,
            "",
          )
          .replace(/\s*<!--(?:\d+|\.)-->\s*$/, "")
          .replace(/(?:\s*(?:\(\d+\)|[①-⑳]))+\s*$/, "")
          .replace(/\s+$/, ""),
      );
    // Asciidoctor's indent= attribute and list nesting shift whole blocks;
    // compare them without their common indentation.
    const indent = Math.min(
      ...lines.filter((l) => l.trim()).map((l) => l.match(/^\s*/)[0].length),
      Infinity,
    );
    const text = lines
      .map((l) => (Number.isFinite(indent) ? l.slice(indent) : l))
      .join("\n")
      .replace(/^\n+|\n+$/g, "");
    code.push(text);
    return "\n";
  });

  // Callout lists: the old site renders each number in its own table cell.
  body = body.replace(
    /<td>\s*<i class="conum"[^>]*>\s*<\/i>\s*<b>\d+<\/b>\s*<\/td>/gi,
    "",
  );
  // The deprecated-CLI warning's wording differs between the old include and
  // this site's include by design; it is compared on its own, not per post.
  let warning;
  while (
    (warning = body.match(/<div[^>]*class="integrator-org-warning"[^>]*>/i))
  ) {
    const el = balancedElement(body, warning.index);
    body = body.slice(0, warning.index) + body.slice(warning.index + el.length);
  }

  // Anchors: the ids headings carry (the old site's link targets) and every
  // id on the page (a heading, or an anchor element placed before one).
  const headingIds = [...body.matchAll(/<h[1-6]\b[^>]*\bid="([^"]+)"/gi)]
    .map((m) => m[1])
    .filter((id) => !/^markdown-toc/.test(id));
  const ids = new Set(
    [...body.matchAll(/\bid="([^"]+)"/gi)].map((m) => decodeEntities(m[1])),
  );

  const inline = [];
  body = body.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_, c) => {
    inline.push(normalizeText(stripTags(c)));
    return ` ${stripTags(c)} `;
  });

  // The old site's "this post is old" banner comes from the update-url front
  // matter, which this site's update include does not read yet (see the
  // migration report); leave it out of the comparison.
  let banner;
  while (
    (banner = body.match(
      /<div[^>]*class="[^"]*(?:BlogPost-update|alert)[^"]*"[^>]*>(?=[\s\S]{0,600}Heads up)/i,
    ))
  ) {
    const el = balancedElement(body, banner.index);
    body = body.slice(0, banner.index) + body.slice(banner.index + el.length);
  }

  const prose = body
    .replace(
      /<\/(p|li|h[1-6]|td|th|tr|dt|dd|blockquote|summary|figcaption|caption)>/gi,
      "\n",
    )
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, " ")
    .split("\n")
    .map((l) => normalizeText(stripTags(l)))
    // The old site's tweet embed prints an error where the tweet should be.
    .filter(
      (l) =>
        l.length > 0 &&
        l !== "Table of Contents" &&
        !l.startsWith("There was a 'Moved Permanently' error fetching URL"),
    );

  return { prose, code, inline, headingIds, ids };
}

// Every heading id on the live page must resolve on the local one, on the
// heading itself or on an anchor element.
export function compareAnchors(live, mine) {
  return live.headingIds.filter((id) => !mine.ids.has(decodeEntities(id)));
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

function words(s) {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

// Word-level Dice similarity: cheap and good enough to pair reflowed blocks.
export function similarity(a, b) {
  const wa = words(a);
  const wb = words(b);
  if (!wa.length || !wb.length) return a === b ? 1 : 0;
  const count = new Map();
  for (const w of wa) count.set(w, (count.get(w) || 0) + 1);
  let shared = 0;
  for (const w of wb) {
    const c = count.get(w);
    if (c) {
      shared++;
      count.set(w, c - 1);
    }
  }
  return (2 * shared) / (wa.length + wb.length);
}

export function compareProse(live, mine) {
  const available = mine.map(() => true);
  const touched = mine.map(() => false);
  const missing = [];
  const near = [];
  const take = (i, keepAvailable = false) => {
    touched[i] = true;
    if (!keepAvailable) available[i] = false;
  };
  for (const block of live) {
    const exact = mine.findIndex((b, i) => available[i] && b === block);
    if (exact >= 0) {
      take(exact);
      continue;
    }
    // Live blocks merged into one local block: the longer block stays
    // available for the other live blocks merged into it.
    const merged = mine.findIndex((b, i) => available[i] && b.includes(block));
    if (merged >= 0) {
      take(merged, true);
      continue;
    }
    // A live block split locally: the available local pieces it contains must
    // cover all of it. Whatever they leave over is the missing text, so a
    // truncated paragraph is reported rather than accepted as a piece.
    let rest = block;
    const pieces = [];
    mine.forEach((b, i) => {
      if (available[i] && words(b).length && rest.includes(b)) {
        rest = rest.replace(b, " ");
        pieces.push(i);
      }
    });
    if (pieces.length) {
      pieces.forEach((i) => take(i));
      const left = rest.replace(/\s+/g, " ").trim();
      if (words(left).length) {
        missing.push(left);
        near.push(null);
      }
      continue;
    }
    missing.push(block);
    // The closest local block, so the report shows what changed.
    let best = null;
    let score = 0.5;
    mine.forEach((b, i) => {
      const s = similarity(block, b);
      if (available[i] && s > score) [best, score] = [b, s];
    });
    near.push(best);
  }
  return {
    missing,
    near,
    extra: mine.filter((b, i) => !touched[i] && words(b).length >= 3),
  };
}

export function compareCode(live, mine) {
  const norm = (c) => c.replace(/[ \t]+$/gm, "").replace(/\r/g, "");
  const mismatches = [];
  const n = Math.max(live.length, mine.length);
  const used = new Set();
  for (let i = 0; i < live.length; i++) {
    const a = norm(live[i]);
    let j = mine.findIndex((c, idx) => !used.has(idx) && norm(c) === a);
    if (j < 0) {
      // Fall back to positional comparison for the report.
      j = mine.findIndex((c, idx) => !used.has(idx) && similarity(c, a) >= 0.9);
      if (j < 0) {
        mismatches.push({
          index: i,
          live: a.slice(0, 200),
          mine: mine[i] ? norm(mine[i]).slice(0, 200) : "(none)",
        });
        continue;
      }
      const la = a.split("\n");
      const lb = norm(mine[j]).split("\n");
      const k = la.findIndex((l, x) => l !== lb[x]);
      mismatches.push({
        index: i,
        live: la[k] ?? "",
        mine: lb[k] ?? "(none)",
        fuzzy: true,
      });
    }
    if (j >= 0) used.add(j);
  }
  return { liveCount: live.length, mineCount: mine.length, mismatches, n };
}

export function compareInline(live, mine) {
  const count = new Map();
  for (const c of mine) count.set(c, (count.get(c) || 0) + 1);
  const missing = [];
  for (const c of live) {
    const n = count.get(c) || 0;
    if (n > 0) count.set(c, n - 1);
    else missing.push(c);
  }
  return missing;
}

// ---------------------------------------------------------------------------
// Fetching and reporting
// ---------------------------------------------------------------------------

async function fetchLive(slug) {
  mkdirSync(CACHE, { recursive: true });
  const cached = path.join(CACHE, `${slug}.html`);
  if (existsSync(cached)) return readFileSync(cached, "utf8");
  const [, y, m, d, name] = slug.match(/^(\d{4})-(\d{2})-(\d{2})-(.+)$/);
  const url = `${LIVE}/blog/${y}/${m}/${d}/${name}`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  const html = await res.text();
  writeFileSync(cached, html);
  return html;
}

const POSTS = "src/blog/posts";

function localPage(site, slug) {
  const [, y, m, d, name] = slug.match(/^(\d{4})-(\d{2})-(\d{2})-(.+)$/);
  return path.join(site, "blog", y, m, d, name, "index.html");
}

function localHtml(site, slug) {
  const file = localPage(site, slug);
  if (!existsSync(file)) throw new Error(`${file} not built`);
  return readFileSync(file, "utf8");
}

// A page in _site older than its post compares the wrong content (#204:
// two posts regenerated between a build and the comparison looked like a
// build that differed from itself).
export function staleBuild(postFile, pageFile) {
  if (!existsSync(postFile) || !existsSync(pageFile)) return false;
  return statSync(postFile).mtimeMs > statSync(pageFile).mtimeMs;
}

// Files the built page references by path (videos, posters, PDFs, raw images,
// links to full-size images) that the build does not contain; see
// scripts/copy-raw-assets.js.
export function missingAssets(html, site) {
  return [
    ...rawAssetRefs(html).map(publishedPath),
    ...builtAssetRefs(html),
  ].filter((ref) => !existsSync(path.join(site, "blog", ref)));
}

// A post needs a look when anything the live site has is absent here: prose
// blocks, whole code blocks, a differing code line, inline code spans, a
// heading id that no longer resolves, or a referenced file the build lacks.
export function needsAttention(result) {
  return Boolean(
    result.prose.missing.length ||
    result.code.mismatches.length ||
    result.code.liveCount !== result.code.mineCount ||
    result.inline.length ||
    result.anchors.length ||
    result.assets.length ||
    result.stale,
  );
}

export async function verify(slug, site) {
  const live = extract(
    elementByClass(await fetchLive(slug), "BlogPost-content") ?? "",
  );
  const page = localHtml(site, slug);
  const mine = extract(elementByClass(page, "blog-prose") ?? "");
  const prose = compareProse(live.prose, mine.prose);
  const code = compareCode(live.code, mine.code);
  const inline = compareInline(live.inline, mine.inline);
  const anchors = compareAnchors(live, mine);
  const assets = missingAssets(page, site);
  const stale = staleBuild(
    path.join(POSTS, `${slug}.md`),
    localPage(site, slug),
  );
  return { slug, live, mine, prose, code, inline, anchors, assets, stale };
}

async function main() {
  const argv = process.argv.slice(2);
  let site = "_site";
  let details = false;
  const slugs = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--site") site = argv[++i];
    else if (argv[i] === "--details") details = true;
    else if (argv[i] === "--file") {
      slugs.push(
        ...readFileSync(argv[++i], "utf8")
          .split(/\s+/)
          .filter(Boolean)
          .map((s) => s.replace(/\.(md|adoc)$/, "")),
      );
    } else slugs.push(argv[i].replace(/\.(md|adoc)$/, ""));
  }
  if (!slugs.length) {
    console.error(
      "usage: node scripts/verify-migration.js <slug> [...] | --file slugs.txt [--details] [--site _site]",
    );
    process.exit(2);
  }
  let failed = 0;
  const rows = [];
  for (const slug of slugs) {
    try {
      const r = await verify(slug, site);
      const bad = needsAttention(r);
      if (bad) failed++;
      rows.push(
        `${bad ? "✖" : "✓"} ${slug}: prose ${r.live.prose.length}/${r.mine.prose.length} blocks, ${r.prose.missing.length} missing, ${r.prose.extra.length} extra | code ${r.code.liveCount}/${r.code.mineCount}, ${r.code.mismatches.length} differ | inline code missing ${r.inline.length} | anchors missing ${r.anchors.length} | files missing ${r.assets.length}`,
      );
      if (details || bad) {
        r.prose.missing.forEach((m, i) => {
          rows.push(`    missing prose: ${m.slice(0, 160)}`);
          const n = r.prose.near[i];
          if (n) {
            let k = 0;
            while (k < m.length && m[k] === n[k]) k++;
            rows.push(
              `      closest here: ${n.slice(Math.max(0, k - 30), k + 130)}`,
            );
          }
        });
        if (details)
          for (const m of r.prose.extra)
            rows.push(`    extra prose:   ${m.slice(0, 160)}`);
        for (const m of r.code.mismatches)
          rows.push(
            `    code #${m.index}${m.fuzzy ? " (line differs)" : ""}:\n      live: ${m.live.split("\n")[0]}\n      mine: ${m.mine.split("\n")[0]}`,
          );
        for (const c of r.inline.slice(0, 10))
          rows.push(`    inline code missing: ${c.slice(0, 100)}`);
        for (const a of r.anchors.slice(0, 10))
          rows.push(`    anchor missing: #${a}`);
        for (const f of r.assets.slice(0, 10))
          rows.push(`    file missing from the build: /${f}`);
        if (r.stale)
          rows.push(
            "    page in _site is older than the post: run npm run build, then verify again",
          );
      }
    } catch (err) {
      failed++;
      rows.push(`✖ ${slug}: ${err.message}`);
    }
  }
  console.log(rows.join("\n"));
  console.log(
    `\n${slugs.length - failed} of ${slugs.length} posts match; ${failed} need a look.`,
  );
  process.exit(failed ? 1 : 0);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === new URL(import.meta.url).pathname
) {
  main();
}
