// Build smoke test: assert every source post emitted an HTML page at its exact
// live URL (/blog/YYYY/MM/DD/slug/). Catches template/collection/permalink
// regressions that front-matter validation can't see and a successful build
// won't flag on its own (e.g. a broken collection filter or a changed permalink
// that silently moves or drops pages).
//
// Run after a build:  npm run build && npm run smoke   (or just `npm test`)
import { readdirSync, existsSync } from "node:fs";
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
