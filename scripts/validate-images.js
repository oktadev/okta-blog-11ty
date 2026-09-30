// Checks the files about to land: nothing over 5MB, no .DS_Store, and no
// raster image wider than 4000px. The pre-commit hook and CI both call this
// so the two can't drift.
// Usage: node scripts/validate-images.js --staged
//        node scripts/validate-images.js --since <git-ref>
//        node scripts/validate-images.js <file...>
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_WIDTH = 4000;
const RASTER = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
}

function targets(argv) {
  if (argv[0] === "--staged") {
    return git("diff", "--cached", "--name-only", "--diff-filter=ACMR");
  }
  if (argv[0] === "--since") {
    if (!argv[1]) throw new Error("--since needs a git ref");
    return git(
      "diff",
      "--name-only",
      "--diff-filter=ACMR",
      `${argv[1]}...HEAD`,
    );
  }
  return argv;
}

// Read the pixel width from the file header. The format is taken from the
// magic bytes, not the extension: 120 images in the repo are JPEGs or WebPs
// saved as .png and the like. Returns undefined when nothing parses, so a
// corrupt file is reported rather than skipped.
const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function imageWidth(buf) {
  if (
    buf.length >= 24 &&
    buf.subarray(0, 8).equals(PNG_SIGNATURE) &&
    buf.readUInt32BE(8) === 13 &&
    buf.toString("latin1", 12, 16) === "IHDR"
  ) {
    return buf.readUInt32BE(16) || undefined;
  }
  if (buf.length >= 10 && /^GIF8[79]a$/.test(buf.toString("latin1", 0, 6))) {
    return buf.readUInt16LE(6) || undefined;
  }
  if (
    buf.length >= 30 &&
    buf.toString("latin1", 0, 4) === "RIFF" &&
    buf.toString("latin1", 8, 12) === "WEBP"
  ) {
    const chunk = buf.toString("latin1", 12, 16);
    // Each chunk type carries a fixed marker; require it before trusting the width.
    if (
      chunk === "VP8 " &&
      buf[23] === 0x9d &&
      buf[24] === 0x01 &&
      buf[25] === 0x2a
    ) {
      return buf.readUInt16LE(26) & 0x3fff || undefined;
    }
    if (chunk === "VP8L" && buf[20] === 0x2f) {
      return (buf.readUInt32LE(21) & 0x3fff) + 1;
    }
    if (chunk === "VP8X" && buf.readUInt32LE(16) === 10) {
      return buf.readUIntLE(24, 3) + 1;
    }
    return;
  }
  // JPEG: walk the marker segments to the first start-of-frame.
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) {
    return;
  }
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) return;
    const marker = buf[i + 1];
    if (marker === 0xff) {
      i++;
      continue;
    }
    const sof =
      marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (sof) return buf.readUInt16BE(i + 7);
    i += 2 + buf.readUInt16BE(i + 2);
  }
}

let files;
try {
  files = targets(process.argv.slice(2));
} catch (err) {
  console.error(`validate-images: ${err.message}`);
  process.exit(2);
}
const errors = [];
let checked = 0;
for (const file of files) {
  if (path.basename(file) === ".DS_Store") {
    checked++;
    errors.push(`${file}: .DS_Store must not be committed`);
    continue;
  }
  let stat;
  try {
    stat = statSync(file);
  } catch {
    continue; // gone since the diff was taken
  }
  if (!stat.isFile()) continue;
  checked++;
  const bytes = stat.size;
  if (bytes > MAX_BYTES) {
    errors.push(
      `${file}: ${(bytes / 1048576).toFixed(1)}MB is over the 5MB limit (reconsider, or use git-lfs)`,
    );
    continue; // already failing; don't read a huge file just to measure it
  }
  const ext = path.extname(file).toLowerCase();
  if (!RASTER.has(ext)) continue;
  const width = imageWidth(readFileSync(file));
  if (width === undefined) {
    errors.push(`${file}: not a readable image`);
  } else if (width > MAX_WIDTH) {
    errors.push(`${file}: ${width}px wide is over the ${MAX_WIDTH}px limit`);
  }
}

for (const error of errors) console.error(`✖ ${error}`);
if (errors.length) {
  console.error(
    `validate-images: ${errors.length} problem(s) in ${checked} file(s)`,
  );
  process.exit(1);
}
console.log(`validate-images: checked ${checked} file(s), no problems`);
