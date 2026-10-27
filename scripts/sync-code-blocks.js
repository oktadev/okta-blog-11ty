// Restore the fenced code blocks of migrated posts from their okta-blog source.
//
// The first migration ran a formatter over the posts, which rewrote code
// samples (quote style, indentation, trailing commas, collapsed call chains)
// and in places shifted the line numbers the prose refers to. The source of
// truth is the post in ../okta-blog, where code is byte for byte what the
// author published. This splices each source block back into the local post
// and leaves everything outside the fences (front matter, shortcodes, prose)
// exactly as it is.
//
// Blocks are paired by content with whitespace, quotes and commas ignored, so
// formatter damage pairs up; what is left is paired in order when both sides
// have the same number of leftovers, and reported otherwise.
//
// Usage: node scripts/sync-code-blocks.js [--src ../okta-blog] [--dry-run]
//                                         [--details] [slug ...]
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { splitSegments } from "./migrate-posts.js";

const POSTS_DIR = "src/blog/posts";

// What a formatter changes: whitespace, quote style, trailing commas and
// semicolons; "=" too, because the first migration stripped empty HTML
// attributes (asp-area="" became asp-area) inside code samples. Two blocks
// with the same key differ only in those.
export function looseKey(text) {
  return text.replace(/[\s'"`,;=]/g, "");
}

// A block's body without its fence lines: the migration retagged languages
// for the highlighter ("c#" to "csharp"), and that is not code.
function body(block) {
  const lines = block.split("\n");
  return lines.length > 2 ? lines.slice(1, -1) : [];
}

function bodyKey(block) {
  return looseKey(body(block).join("\n"));
}

// Longest common subsequence of two key lists, as index pairs.
function lcs(a, b) {
  const n = a.length;
  const m = b.length;
  const table = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i][j] =
        a[i] === b[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const pairs = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      pairs.push([i, j]);
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) i++;
    else j++;
  }
  return pairs;
}

// Pair the local blocks with the source blocks. Returns, per local block, the
// index of its source block or -1, plus how the pair was made.
export function pairBlocks(local, source) {
  const pairs = new Array(local.length).fill(-1);
  const how = new Array(local.length).fill("unpaired");
  for (const [i, j] of lcs(local.map(bodyKey), source.map(bodyKey))) {
    pairs[i] = j;
    how[i] = "formatting";
  }
  // Leftovers pair up in order, as long as each pair still looks like the
  // same sample: at least half of the local lines present in the source block.
  const leftLocal = pairs.map((p, i) => (p < 0 ? i : -1)).filter((i) => i >= 0);
  const used = new Set(pairs.filter((p) => p >= 0));
  const leftSource = source.map((_, j) => j).filter((j) => !used.has(j));
  let k = 0;
  for (const i of leftLocal) {
    if (k >= leftSource.length) break;
    if (!sameSample(local[i], source[leftSource[k]])) continue;
    pairs[i] = leftSource[k++];
    how[i] = "content";
  }
  return { pairs, how };
}

function sameSample(a, b) {
  const inSource = new Set(body(b).map(looseKey).filter(Boolean));
  const lines = body(a).map(looseKey).filter(Boolean);
  if (!lines.length) return inSource.size === 0;
  return lines.filter((l) => inSource.has(l)).length / lines.length >= 0.5;
}

function firstDifference(a, b) {
  const la = a.split("\n");
  const lb = b.split("\n");
  const k = la.findIndex((l, x) => l !== lb[x]);
  return { line: k + 1, local: la[k] ?? "", source: lb[k] ?? "" };
}

// Rebuild a post with its source's code blocks. Returns the new text and what
// changed, without touching the file.
export function syncPost(localText, sourceText) {
  const segments = splitSegments(localText);
  const sourceBlocks = splitSegments(sourceText.replace(/\r\n/g, "\n"))
    .filter((s) => s.code)
    .map((s) => s.text);
  const localIdx = segments
    .map((s, i) => (s.code ? i : -1))
    .filter((i) => i >= 0);
  const localBlocks = localIdx.map((i) => segments[i].text);
  const { pairs, how } = pairBlocks(localBlocks, sourceBlocks);

  const changes = [];
  let unpaired = 0;
  localIdx.forEach((segIndex, k) => {
    const j = pairs[k];
    if (j < 0) {
      unpaired++;
      return;
    }
    const before = segments[segIndex].text;
    // The fence lines stay local: the migration retagged languages the
    // highlighter knows ("c#" to "csharp"), and that is not code.
    const after = restoreBody(before, sourceBlocks[j]);
    if (before === after) return;
    changes.push({
      block: k + 1,
      kind: how[k],
      ...firstDifference(before, after),
    });
    segments[segIndex].text = after;
  });
  const used = new Set(pairs.filter((p) => p >= 0));
  const sourceOnly = sourceBlocks.length - used.size;
  return {
    text: segments.map((s) => s.text).join("\n"),
    blocks: localBlocks.length,
    changes,
    unpaired,
    sourceOnly,
  };
}

// The source block's body between the local block's own fence lines.
export function restoreBody(local, source) {
  const l = local.split("\n");
  const s = source.split("\n");
  const closed =
    l.length > 1 &&
    /^[ \t]*(?:>[ \t]*)*(`{3,}|~{3,})[ \t]*$/.test(l[l.length - 1]);
  if (!closed) return local;
  return [l[0], ...s.slice(1, s.length > 1 ? -1 : 1), l[l.length - 1]].join(
    "\n",
  );
}

function main() {
  const argv = process.argv.slice(2);
  let src = "../okta-blog";
  let dryRun = false;
  let details = false;
  const only = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--src") src = argv[++i];
    else if (argv[i] === "--dry-run") dryRun = true;
    else if (argv[i] === "--details") details = true;
    else only.push(argv[i].replace(/\.md$/, ""));
  }
  const sourceDir = path.join(src, "_source/_posts");
  if (!existsSync(sourceDir)) {
    throw new Error(`no posts at ${sourceDir}; pass --src <path-to-okta-blog>`);
  }

  const slugs = only.length
    ? only
    : readdirSync(POSTS_DIR)
        .filter((f) => f.endsWith(".md"))
        .map((f) => f.slice(0, -3))
        .sort();
  const totals = { posts: 0, noSource: 0, changed: 0, blocks: 0, unpaired: 0 };
  const kinds = { formatting: 0, content: 0 };
  const rows = [];
  for (const slug of slugs) {
    // Posts converted from AsciiDoc were written by the current converter,
    // which never touches code; only Markdown sources are synced.
    const sourceFile = path.join(sourceDir, `${slug}.md`);
    if (!existsSync(sourceFile)) {
      totals.noSource++;
      continue;
    }
    totals.posts++;
    const localFile = path.join(POSTS_DIR, `${slug}.md`);
    const localText = readFileSync(localFile, "utf8");
    const r = syncPost(localText, readFileSync(sourceFile, "utf8"));
    totals.unpaired += r.unpaired;
    if (!r.changes.length && !r.unpaired && !r.sourceOnly) continue;
    if (r.changes.length) {
      totals.changed++;
      totals.blocks += r.changes.length;
      for (const c of r.changes) kinds[c.kind]++;
      if (!dryRun) writeFileSync(localFile, r.text);
    }
    const flags = [];
    if (r.unpaired)
      flags.push(`${r.unpaired} local block(s) without a source match`);
    if (r.sourceOnly)
      flags.push(`${r.sourceOnly} source block(s) not in the local post`);
    rows.push(
      `${slug}: ${r.changes.length} of ${r.blocks} block(s) restored` +
        (flags.length ? ` | ${flags.join(", ")}` : ""),
    );
    if (details) {
      for (const c of r.changes) {
        rows.push(
          `    block ${c.block} (${c.kind}) line ${c.line}:\n      local:  ${c.local.slice(0, 120)}\n      source: ${c.source.slice(0, 120)}`,
        );
      }
    }
  }
  console.log(rows.join("\n"));
  console.log(
    `\n${totals.posts} post(s) with a Markdown source (${totals.noSource} without), ${totals.changed} changed, ${totals.blocks} block(s) ${dryRun ? "to restore" : "restored"}: ${kinds.formatting} formatting, ${kinds.content} content; ${totals.unpaired} block(s) left alone for lack of a match.`,
  );
  if (!dryRun && totals.changed) {
    console.log(
      "Do not run Prettier or any formatter over the posts: it reformats the code samples.",
    );
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === new URL(import.meta.url).pathname
) {
  main();
}
