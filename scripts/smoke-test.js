// Build smoke test: assert every source post emitted an HTML page at its exact
// live URL (/blog/YYYY/MM/DD/slug/). Catches template/collection/permalink
// regressions that front-matter validation can't see and a successful build
// won't flag on its own (e.g. a broken collection filter or a changed permalink
// that silently moves or drops pages).
//
// Run after a build:  npm run build && npm run smoke   (or just `npm test`)
import { readdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

const SRC = "src/blog/posts";
const SITE = "_site";

if (!existsSync(path.join(SITE, "blog"))) {
  console.error(`✖ ${SITE}/blog not found — run \`npm run build\` first.`);
  process.exit(1);
}

const posts = readdirSync(SRC).filter((f) => f.endsWith(".md"));
const missing = [];

for (const file of posts) {
  const m = file.match(/^(\d{4})-(\d{2})-(\d{2})-(.+)\.md$/);
  if (!m) {
    // A post that doesn't follow YYYY-MM-DD-slug.md can't be mapped to a URL.
    missing.push(`${file} (filename not YYYY-MM-DD-slug.md)`);
    continue;
  }
  const [, year, month, day, slug] = m;
  const out = path.join(SITE, "blog", year, month, day, slug, "index.html");
  if (!existsSync(out)) {
    missing.push(`${file} -> /blog/${year}/${month}/${day}/${slug}/`);
  }
}

if (missing.length > 0) {
  console.error(
    `✖ smoke test failed: ${missing.length}/${posts.length} posts are missing ` +
      `at their expected URLs:`,
  );
  missing.slice(0, 10).forEach((x) => console.error("   " + x));
  if (missing.length > 10) console.error(`   …and ${missing.length - 10} more`);
  process.exit(1);
}

console.log(
  `✓ smoke test passed: all ${posts.length} posts emitted at their ` +
    `/blog/YYYY/MM/DD/slug/ URLs`,
);

// ---------------------------------------------------------------------------
// Ordering: posts run newest first, and posts sharing a date fall back to their
// filename so the order is the same on every build regardless of the order the
// filesystem hands them over. Eleventy's default collection sort provides that
// tiebreaker (date, then inputPath); this guards against a change that drops it
// — switching to a sort without a tiebreaker, or sorting in a template.
// ---------------------------------------------------------------------------

const postUrl = (file) => {
  const [, year, month, day, slug] = file.match(
    /^(\d{4})-(\d{2})-(\d{2})-(.+)\.md$/,
  );
  return `/blog/${year}/${month}/${day}/${slug}/`;
};

// Newest first, and within a date the filename descending, mirroring how the
// listings render `collections.posts | reverse`.
const expectedOrder = posts
  .filter((f) => /^\d{4}-\d{2}-\d{2}-.+\.md$/.test(f))
  .sort((a, b) => b.localeCompare(a))
  .map(postUrl);

const sameDayDates = new Set(
  Object.entries(
    posts.reduce((acc, f) => {
      const date = f.slice(0, 10);
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {}),
  )
    .filter(([, count]) => count > 1)
    .map(([date]) => date),
);

// Post links from the listing itself. Scoped to the <ol> the listing renders so
// that chrome outside it (the promo banner links at a post, for one) can't be
// mistaken for a list entry.
function listOrder(html) {
  const list = html.match(/<ol\b[^>]*>([\s\S]*?)<\/ol>/);
  if (!list) return [];
  const order = [];
  for (const [, url] of list[1].matchAll(
    /href="(\/blog\/\d{4}\/\d{2}\/\d{2}\/[^"]+\/)"/g,
  )) {
    if (order[order.length - 1] !== url) order.push(url);
  }
  return order;
}

function readIndexOrder() {
  const seen = [];
  for (let page = 1; ; page++) {
    const file =
      page === 1
        ? path.join(SITE, "blog", "index.html")
        : path.join(SITE, "blog", "page", String(page), "index.html");
    if (!existsSync(file)) break;
    seen.push(...listOrder(readFileSync(file, "utf8")));
  }
  return seen;
}

const orderingErrors = [];
const indexOrder = readIndexOrder();

if (indexOrder.length === 0) {
  orderingErrors.push("could not read any post links from the blog index");
} else {
  // Compare only the posts the index actually lists: some posts are deliberately
  // held back with `eleventyExcludeFromCollections`.
  const listed = new Set(indexOrder);
  const expectedListed = expectedOrder.filter((url) => listed.has(url));
  const firstDiff = expectedListed.findIndex((url, i) => indexOrder[i] !== url);
  if (firstDiff !== -1) {
    orderingErrors.push(
      `blog index order diverges at position ${firstDiff}: ` +
        `expected ${expectedListed[firstDiff]}, got ${indexOrder[firstDiff]}`,
    );
  }
}

// Same-day groups must keep their relative order wherever they appear together.
function checkGroupOrder(label, order) {
  const positions = new Map(order.map((url, i) => [url, i]));
  for (const date of sameDayDates) {
    const [y, m, d] = date.split("-");
    const group = expectedOrder.filter((url) =>
      url.startsWith(`/blog/${y}/${m}/${d}/`),
    );
    const present = group.filter((url) => positions.has(url));
    for (let i = 1; i < present.length; i++) {
      if (positions.get(present[i - 1]) > positions.get(present[i])) {
        orderingErrors.push(
          `${label}: ${date} posts are out of order ` +
            `(${present[i - 1]} should precede ${present[i]})`,
        );
      }
    }
  }
}

checkGroupOrder("blog index", indexOrder);

const feedPath = path.join(SITE, "feed.xml");
if (existsSync(feedPath)) {
  const feed = readFileSync(feedPath, "utf8");
  const feedOrder = [
    ...feed.matchAll(
      /<link>[^<]*?(\/blog\/\d{4}\/\d{2}\/\d{2}\/[^<]+)<\/link>/g,
    ),
  ].map(([, url]) => url);
  checkGroupOrder("feed.xml", feedOrder);
}

for (const tagDir of existsSync(path.join(SITE, "blog", "tags"))
  ? readdirSync(path.join(SITE, "blog", "tags"))
  : []) {
  const file = path.join(SITE, "blog", "tags", tagDir, "index.html");
  if (!existsSync(file)) continue;
  const order = listOrder(readFileSync(file, "utf8"));
  checkGroupOrder(`tag page /blog/tags/${tagDir}/`, order);
}

if (orderingErrors.length > 0) {
  console.error(`✖ post ordering is not deterministic:`);
  orderingErrors.slice(0, 10).forEach((x) => console.error("   " + x));
  if (orderingErrors.length > 10) {
    console.error(`   …and ${orderingErrors.length - 10} more`);
  }
  process.exit(1);
}

console.log(
  `✓ ordering check passed: ${sameDayDates.size} dates carry multiple posts and ` +
    `all sort by filename within the date, on the index, tag pages and feed`,
);
