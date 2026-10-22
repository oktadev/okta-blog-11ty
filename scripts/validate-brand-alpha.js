// Flags Tailwind opacity modifiers (`bg-brand-primary-blue-300/50`) on brand
// colors other than the design system's alpha-eligible set. Mirrors the
// "Avoid stacking multiple alpha layers" rule from the Figma spec by limiting
// *which* colors may use alpha, not stacking.
// Usage: node scripts/validate-brand-alpha.js
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const SCAN_DIRS = ["src", "public/css"];
const SCAN_EXT = new Set([".njk", ".md", ".css", ".js"]);

// Keep in sync with the hex values called out as alpha-eligible in the Figma
// "Alpha" spec: #0131FF, #9921FE, #FF6217, #E0DAD2, #FFF.
const ALLOWED = new Set([
  "brand-primary-blue-300",
  "brand-primary-purple-300",
  "brand-primary-orange-300",
  "brand-primary-neutral-300",
  "brand-utility-grey-100", // #FFFFFF
]);

// Scoped to `brand-*` only: the restriction comes from the new brand alpha
// spec, not the pre-existing `okta-*` palette, which already uses opacity
// modifiers (e.g. border-okta-carbon/50) outside this system.
const CLASS_RE =
  /(?:bg|text|border|ring|outline|decoration|divide|fill|stroke|accent|caret|from|via|to)-(brand-[a-zA-Z0-9-]+)\/\d{1,3}\b/g;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "_site") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (SCAN_EXT.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

const files = SCAN_DIRS.flatMap(walk);
const issues = [];

for (const file of files) {
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(CLASS_RE)) {
    const color = match[1];
    if (!ALLOWED.has(color)) {
      const line = text.slice(0, match.index).split("\n").length;
      issues.push(
        `${file}:${line}: opacity modifier on disallowed color '${color}' (${match[0]})`,
      );
    }
  }
}

for (const issue of issues) console.log(issue);

console.log(
  `\nScanned ${files.length} files | ${issues.length} disallowed alpha usage${issues.length === 1 ? "" : "s"}`,
);

process.exit(issues.length > 0 ? 1 : 0);
