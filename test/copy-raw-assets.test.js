import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { collectRefs, copyRawAssets } from "../scripts/copy-raw-assets.js";

test("copyRawAssets copies only the referenced files and reports the missing ones", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "raw-assets-"));
  const posts = path.join(dir, "posts");
  mkdirSync(posts);
  writeFileSync(
    path.join(posts, "2020-01-01-a.md"),
    '<video src="/img/blog/raw-assets-test/demo.mp4"></video>\n<a href="/files/raw-assets-test/gone.pdf">x</a>\n',
  );
  writeFileSync(
    path.join(posts, "2020-01-02-b.md"),
    '<img src="/img/blog/raw-assets-test/demo.mp4">',
  );
  const source = "public/img/blog/raw-assets-test";
  mkdirSync(source, { recursive: true });
  writeFileSync(path.join(source, "demo.mp4"), "video bytes");
  writeFileSync(path.join(source, "unreferenced.mp4"), "never copied");
  try {
    const refs = collectRefs(posts);
    assert.deepEqual(
      [...refs.keys()],
      ["img/blog/raw-assets-test/demo.mp4", "files/raw-assets-test/gone.pdf"],
    );
    assert.deepEqual(refs.get("img/blog/raw-assets-test/demo.mp4"), [
      "2020-01-01-a.md",
      "2020-01-02-b.md",
    ]);
    const out = path.join(dir, "site");
    const first = copyRawAssets(posts, out);
    assert.deepEqual(first, {
      copied: 1,
      kept: 0,
      missing: ["files/raw-assets-test/gone.pdf (2020-01-01-a.md)"],
    });
    assert.ok(existsSync(path.join(out, "img/raw-assets-test/demo.mp4")));
    assert.ok(
      !existsSync(path.join(out, "img/raw-assets-test/unreferenced.mp4")),
    );
    const second = copyRawAssets(posts, out);
    assert.deepEqual([second.copied, second.kept], [0, 1]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(source, { recursive: true, force: true });
  }
});
