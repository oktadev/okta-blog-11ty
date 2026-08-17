// Trim the blog to the newest N posts so the dev server builds fast (a full
// build processes all ~700 posts and their images). Restore them afterwards with
// `npm run dev-restore`. Usage: node scripts/dev-clean.js [keep-count] (default 25)
import { readdirSync, unlinkSync } from "node:fs";
import path from "node:path";

const POSTS_DIR = "src/blog/posts";
const keep = Number(process.argv[2]) || 25;

// Date-prefixed filenames (YYYY-MM-DD-*.md) sort chronologically, so the tail is
// the newest.
const posts = readdirSync(POSTS_DIR)
  .filter((f) => f.endsWith(".md"))
  .sort();

const toRemove = posts.slice(0, Math.max(0, posts.length - keep));
for (const file of toRemove) {
  unlinkSync(path.join(POSTS_DIR, file));
}

console.log(
  `Kept the newest ${posts.length - toRemove.length} posts, removed ${toRemove.length}.`,
);
console.warn(
  "These deletions are local-dev only — run `npm run dev-restore` before committing.",
);
