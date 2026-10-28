// Copy the files posts reference by plain path (videos, posters, PDFs, raw
// <img> sources, links to full-size images) from public/ into the build, since
// eleventy-img only produces what goes through the img shortcode. Only
// referenced files are copied, so the originals of shortcode images never ship
// next to their derivatives. Runs from `npm run setup`, before Eleventy.
//
// Usage: node scripts/copy-raw-assets.js [--posts src/blog/posts] [--out _site]
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rawAssetRefs } from "../utils/raw-assets.js";

const SOURCE = "public";

// Every raw reference across the posts, with the posts that use it.
export function collectRefs(postsDir) {
  const refs = new Map();
  for (const file of readdirSync(postsDir).filter((f) => f.endsWith(".md"))) {
    const text = readFileSync(path.join(postsDir, file), "utf8");
    for (const ref of rawAssetRefs(text)) {
      if (!refs.has(ref)) refs.set(ref, []);
      refs.get(ref).push(file);
    }
  }
  return refs;
}

export function copyRawAssets(postsDir, outDir) {
  const result = { copied: 0, kept: 0, missing: [] };
  for (const [ref, posts] of collectRefs(postsDir)) {
    const from = path.join(SOURCE, ref);
    const to = path.join(outDir, ref);
    if (!existsSync(from)) {
      result.missing.push(`${ref} (${posts.join(", ")})`);
      continue;
    }
    if (existsSync(to) && statSync(to).size === statSync(from).size) {
      result.kept++;
      continue;
    }
    mkdirSync(path.dirname(to), { recursive: true });
    copyFileSync(from, to);
    result.copied++;
  }
  return result;
}

function main() {
  const argv = process.argv.slice(2);
  let postsDir = "src/blog/posts";
  let outDir = "_site";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--posts") postsDir = argv[++i];
    else if (argv[i] === "--out") outDir = argv[++i];
    else throw new Error(`unknown argument ${argv[i]}`);
  }
  const r = copyRawAssets(postsDir, outDir);
  console.log(
    `raw assets: ${r.copied} copied, ${r.kept} already in place, ${r.missing.length} missing`,
  );
  for (const m of r.missing) console.log(`  missing in ${SOURCE}: ${m}`);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
