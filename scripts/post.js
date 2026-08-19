// Scaffold a new blog post: `npm run post create <post-name> [date]`.
// Creates src/blog/posts/<date>-<post-name>.md from a front-matter template and
// an empty image directory at public/img/blog/<post-name>/.
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const POSTS_DIR = "src/blog/posts";
const IMG_DIR = "public/img/blog";

const FRONT_MATTER = `---
title: ""
author: # key(s) from src/_data/authors.yaml
by: advocate # advocate | contractor | internal-contributor | external-contributor
communities: [] # e.g. java, javascript, .net, go, php, python, security, devops, mobile
description: ""
tags: []
tweets:
image: ""
type: awareness # awareness | conversion
---
`;

const [
  command,
  postName = "new-post",
  date = new Date().toISOString().slice(0, 10),
] = process.argv.slice(2);

if (command !== "create") {
  console.error("Usage: npm run post create <post-name> [date]");
  process.exit(1);
}

const postPath = path.join(POSTS_DIR, `${date}-${postName}.md`);
if (existsSync(postPath)) {
  console.log(`Post already exists, leaving it untouched: ${postPath}`);
} else {
  writeFileSync(postPath, FRONT_MATTER);
  console.log(`Created ${postPath}`);
}

const imgPath = path.join(IMG_DIR, postName);
mkdirSync(imgPath, { recursive: true });
console.log(`Image directory ready: ${imgPath}`);
