// List what changed in the okta-blog repo since this site last reconciled with
// it, and print the migration command that brings it over.
//
// The last reconciled commit is recorded in scripts/upstream-snapshot.txt.
// Posts, their images and the authors file are compared against the checkout's
// current HEAD (pull it first), so nothing here touches the network.
//
// Usage: node scripts/upstream-changes.js [--src ../okta-blog] [--update]
//   --update  record the checkout's HEAD as the reconciled commit, after the
//             migration has been run and reviewed
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SNAPSHOT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "upstream-snapshot.txt",
);
const POSTS = "_source/_posts/";
const IMAGES = "_source/_assets/img/blog/";
const AUTHORS = "_source/_data/authors.yml";

// Sort `git diff --name-status` output into what the migration has to do.
export function classify(nameStatus) {
  const result = {
    added: [],
    modified: [],
    deleted: [],
    images: [],
    authors: false,
  };
  for (const line of nameStatus.split("\n")) {
    const [status, ...rest] = line.split("\t");
    const file = rest[rest.length - 1];
    if (!file) continue;
    if (file.startsWith(POSTS) && /\.(md|adoc)$/.test(file)) {
      const slug = path.basename(file).replace(/\.(md|adoc)$/, "");
      if (status.startsWith("D")) result.deleted.push(slug);
      else if (status.startsWith("A")) result.added.push(slug);
      else result.modified.push(slug);
    } else if (file.startsWith(IMAGES)) {
      result.images.push(file.slice(IMAGES.length));
    } else if (file === AUTHORS) {
      result.authors = true;
    }
  }
  return result;
}

function git(src, ...args) {
  return execFileSync("git", ["-C", src, ...args], { encoding: "utf8" }).trim();
}

// What changed in the old repo since the recorded commit, from its git
// history. `since` is null when nothing has been recorded yet.
export function upstreamDelta(src) {
  const head = git(src, "rev-parse", "HEAD");
  const headDate = git(src, "log", "-1", "--format=%cs");
  if (!existsSync(SNAPSHOT)) {
    return { head, headDate, since: null, sinceDate: null, ...classify("") };
  }
  const [since, sinceDate] = readFileSync(SNAPSHOT, "utf8").trim().split(/\s+/);
  const diff = git(
    src,
    "diff",
    "--name-status",
    since,
    head,
    "--",
    POSTS,
    IMAGES,
    AUTHORS,
  );
  return { head, headDate, since, sinceDate, ...classify(diff) };
}

export function recordSnapshot(src) {
  const head = git(src, "rev-parse", "HEAD");
  const headDate = git(src, "log", "-1", "--format=%cs");
  writeFileSync(SNAPSHOT, `${head} ${headDate}\n`);
  return { head, headDate };
}

function main() {
  const argv = process.argv.slice(2);
  let src = "../okta-blog";
  let update = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--src") src = argv[++i];
    else if (argv[i] === "--update") update = true;
    else throw new Error(`unknown argument ${argv[i]}`);
  }
  if (!existsSync(path.join(src, POSTS))) {
    throw new Error(`no posts at ${src}; pass --src <path-to-okta-blog>`);
  }
  if (update) {
    const { head, headDate } = recordSnapshot(src);
    console.log(
      `Recorded ${head.slice(0, 8)} (${headDate}) as the reconciled commit.`,
    );
    return;
  }
  const r = upstreamDelta(src);
  if (!r.since) {
    console.log(
      `okta-blog at ${r.head.slice(0, 8)} (${r.headDate}); nothing recorded yet, so npm run migrate treats every post as new.`,
    );
    return;
  }
  console.log(
    `okta-blog at ${r.head.slice(0, 8)} (${r.headDate}); last reconciled at ${r.since.slice(0, 8)} (${r.sinceDate}).`,
  );
  const show = (label, list) => {
    if (list.length)
      console.log(`${label} (${list.length}):\n  ${list.join("\n  ")}`);
  };
  show("New posts", r.added);
  show("Changed posts", r.modified);
  show(
    "Deleted posts (the migration asks before removing them; each needs a redirect in vercel.json)",
    r.deleted,
  );
  show("Images added or replaced", r.images);
  if (r.authors)
    console.log(
      "authors.yml changed: the migration adds missing authors; check renamed ones.",
    );
  if (
    !r.added.length &&
    !r.modified.length &&
    !r.deleted.length &&
    !r.images.length &&
    !r.authors
  ) {
    console.log("Nothing changed.");
    return;
  }
  console.log(
    `\nRun:\n  npm run migrate -- --src ${src}\nIt converts the new and changed posts, replaces changed images, asks before removing retired posts, and records the commit.`,
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
