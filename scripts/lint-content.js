// Content lint for posts: the footguns the old blog's markdown-lint caught.
//   - Okta placeholder org domains that should be {yourOktaDomain}
//   - "https://{yourOktaDomain}.com" (the placeholder already carries the host)
//   - "index#" links (an "index" without a file type never resolves)
//   - curly quotes and the Unicode ellipsis, which break copy-pasted commands
//   - absolute links to other posts on this blog, which should be relative
// Whole files are scanned, code samples included: that is where a placeholder
// domain or a curly quote does the most damage.
//
// Usage: node scripts/lint-content.js            (every post)
//        node scripts/lint-content.js --staged   (the pre-commit hook)
//        node scripts/lint-content.js --since <git-ref>   (CI)
//        node scripts/lint-content.js <file...>
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const POSTS_DIR = "src/blog/posts";

export const RULES = [
  {
    name: "placeholder org domain",
    pattern:
      /https?:\/\/(?:your-org|example|rain|your-subdomain|your-domain|\{org\})\.okta[\w.]*/g,
    fix: "use https://{yourOktaDomain} (or https://{yourOktaDomain}/oauth2/default)",
  },
  {
    name: "placeholder with a .com suffix",
    pattern: /https?:\/\/\{yourOktaDomain\}\.com/g,
    fix: "the placeholder already includes the host: https://{yourOktaDomain}",
  },
  {
    name: "index# link",
    // Only link targets: "index#" also appears legitimately in code, such as
    // an Angular schematics factory "./rsi/index#rsi".
    pattern: /(?:\]\([^)\s]*|href=["'][^"']*)\bindex#[^)\s"']*/g,
    fix: 'link to the page ("/") or to "index.html#…"; a bare "index" never resolves',
  },
  {
    name: "curly double quote",
    pattern: /[“”]/g,
    fix: 'replace with "',
  },
  {
    name: "curly single quote",
    pattern: /[‘’]/g,
    fix: "replace with '",
  },
  {
    name: "unicode ellipsis",
    pattern: /…/g,
    fix: "replace with ...",
  },
  {
    name: "absolute link to this blog",
    pattern:
      /https:\/\/developer\.okta\.com\/blog\/\d{4}\/\d{2}\/\d{2}\/[^\]) [\s]*/g,
    fix: "make it relative: /blog/YYYY/MM/DD/slug/",
  },
];

// A post may opt out of one rule with a front-matter list, e.g. for a post
// that documents the index# problem itself:
//   lint-ignore: [index# link]
function ignoredRules(content) {
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const line = fm?.[1].match(/^lint-ignore:\s*\[([^\]]*)\]/m);
  return line
    ? new Set(
        line[1]
          .split(",")
          .map((s) => s.trim().replace(/^["']|["']$/g, ""))
          .filter(Boolean),
      )
    : new Set();
}

export function lint(content) {
  const ignored = ignoredRules(content);
  const findings = [];
  for (const rule of RULES) {
    if (ignored.has(rule.name)) continue;
    for (const m of content.matchAll(rule.pattern)) {
      const line = content.slice(0, m.index).split("\n").length;
      findings.push({ rule: rule.name, line, match: m[0], fix: rule.fix });
    }
  }
  return findings;
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
}

function targets(argv) {
  let files;
  if (argv[0] === "--staged") {
    files = git("diff", "--cached", "--name-only", "--diff-filter=ACMR");
  } else if (argv[0] === "--since") {
    if (!argv[1]) throw new Error("--since needs a git ref");
    files = git(
      "diff",
      "--name-only",
      "--diff-filter=ACMR",
      `${argv[1]}...HEAD`,
    );
  } else if (argv.length) {
    return argv;
  } else {
    return readdirSync(POSTS_DIR)
      .filter((f) => f.endsWith(".md"))
      .map((f) => path.join(POSTS_DIR, f));
  }
  return files.filter(
    (f) => f.startsWith(`${POSTS_DIR}/`) && f.endsWith(".md"),
  );
}

function main() {
  let files;
  try {
    files = targets(process.argv.slice(2));
  } catch (err) {
    console.error(`lint-content: ${err.message}`);
    process.exit(2);
  }
  let problems = 0;
  let checked = 0;
  for (const file of files) {
    if (!existsSync(file)) continue; // gone since the diff was taken
    checked++;
    const findings = lint(readFileSync(file, "utf8"));
    for (const f of findings) {
      problems++;
      console.error(
        `✖ ${file}:${f.line}: ${f.rule}: ${JSON.stringify(f.match)}\n    ${f.fix}`,
      );
    }
  }
  if (problems) {
    console.error(`lint-content: ${problems} problem(s) in ${checked} post(s)`);
    process.exit(1);
  }
  console.log(`lint-content: checked ${checked} post(s), no problems`);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
