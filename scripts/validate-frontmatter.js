// Validates front-matter of all blog posts.
// Checks: YAML parses, required fields present, author keys resolve against
// src/_data/authors.yaml, `by` is a known role, and field types are sane.
// Usage: node scripts/validate-frontmatter.js
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import * as yaml from "js-yaml";

const POSTS_DIR = "src/blog/posts";
const AUTHORS_FILE = "src/_data/authors.yaml";

const REQUIRED = ["title", "author"];

// Allowed values for the `by` field (optional, but must be one of these when set).
const BY_VALUES = new Set([
  "advocate",
  "contractor",
  "internal-contributor",
  "external-contributor",
]);

// Communities that have a browsable page. Keep in sync with the COMMUNITIES
// list in .eleventy.js — a value absent from both is silently unbrowsable.
const COMMUNITY_VALUES = new Set([
  "javascript",
  "java",
  ".net",
  "security",
  "devops",
  "mobile",
  "php",
  "python",
  "go",
  "ruby",
]);

// Near-misses for `communities`. Each of these shipped in real posts and
// silently dropped them from their community pages, since nothing reads the key.
const COMMUNITIES_TYPOS = ["communitites", "community", "communites"];

const authors = yaml.load(readFileSync(AUTHORS_FILE, "utf8")) || {};
const authorKeys = new Set(Object.keys(authors));

const files = readdirSync(POSTS_DIR).filter((f) => f.endsWith(".md"));

const issues = [];
function add(file, level, msg) {
  issues.push({ file, level, msg });
}

const fmRe = /^---\r?\n([\s\S]*?)\r?\n---/;

for (const file of files) {
  const raw = readFileSync(path.join(POSTS_DIR, file), "utf8");
  const m = raw.match(fmRe);
  if (!m) {
    add(file, "error", "no front-matter block found");
    continue;
  }
  let data;
  try {
    data = yaml.load(m[1]);
  } catch (e) {
    add(file, "error", `YAML parse error: ${e.message.split("\n")[0]}`);
    continue;
  }
  if (data == null || typeof data !== "object") {
    add(file, "error", "front-matter is not a mapping");
    continue;
  }

  for (const field of REQUIRED) {
    if (data[field] == null || data[field] === "") {
      add(file, "error", `missing required field: ${field}`);
    }
  }

  // author keys must resolve in authors.yaml
  if (data.author != null && data.author !== "") {
    const list = Array.isArray(data.author) ? data.author : [data.author];
    for (const key of list) {
      if (!authorKeys.has(key)) {
        add(file, "error", `unknown author key: ${JSON.stringify(key)}`);
      }
    }
  }

  // `by` is optional, but when present must be one of the known roles
  if (data.by != null && data.by !== "" && !BY_VALUES.has(data.by)) {
    add(
      file,
      "error",
      `invalid by value: ${JSON.stringify(data.by)} (expected one of ${[...BY_VALUES].join(", ")})`,
    );
  }

  // type sanity
  if (data.tags != null && !Array.isArray(data.tags)) {
    add(file, "warn", `tags is not a list (got ${typeof data.tags})`);
  }
  if (data.communities != null && !Array.isArray(data.communities)) {
    add(file, "warn", `communities is not a list`);
  }

  for (const typo of COMMUNITIES_TYPOS) {
    if (data[typo] != null) {
      add(file, "warn", `misspelled key '${typo}' (should be 'communities')`);
    }
  }

  if (Array.isArray(data.communities)) {
    for (const value of data.communities) {
      const normalized = String(value).trim().toLowerCase();
      if (!COMMUNITY_VALUES.has(normalized)) {
        add(
          file,
          "warn",
          `community ${JSON.stringify(value)} has no community page`,
        );
      }
    }
  }
  if (data.description != null && typeof data.description !== "string") {
    add(file, "warn", `description is not a string`);
  }
}

const errors = issues.filter((i) => i.level === "error");
const warns = issues.filter((i) => i.level === "warn");

for (const i of issues) {
  console.log(`${i.level.toUpperCase().padEnd(5)} ${i.file}: ${i.msg}`);
}

console.log(
  `\nScanned ${files.length} posts | ${errors.length} errors, ${warns.length} warnings`,
);

process.exit(errors.length > 0 ? 1 : 0);
