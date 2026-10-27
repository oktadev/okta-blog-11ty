import { test } from "node:test";
import assert from "node:assert/strict";
import {
  looseKey,
  pairBlocks,
  restoreBody,
  syncPost,
} from "../scripts/sync-code-blocks.js";

test("looseKey ignores what a formatter changes", () => {
  assert.equal(
    looseKey("const a = { b: 'c', };\n"),
    looseKey('const a = {\n  b: "c"\n}'),
  );
  assert.equal(looseKey("<a asp-area>"), looseKey('<a asp-area="">'));
  assert.notEqual(looseKey("a(1)"), looseKey("a(2)"));
});

test("pairBlocks pairs reformatted blocks by content and leaves a rewritten one", () => {
  const local = [
    "```js\nx = 'a';\n```",
    "```js\nnew();\n```",
    "```js\ny = 1\n```",
  ];
  const source = [
    '```js\nx = "a";\n```',
    "```js\nold();\n```",
    "```js\ny = 1;\n```",
  ];
  const { pairs, how } = pairBlocks(local, source);
  assert.deepEqual(pairs, [0, -1, 2]);
  assert.deepEqual(how, ["formatting", "unpaired", "formatting"]);
});

test("pairBlocks pairs leftovers in order only when they look like the same sample", () => {
  const { pairs, how } = pairBlocks(
    ["```js\na();\nb();\n```", "```js\nz();\n```"],
    ["```js\na();\nb(1);\n```"],
  );
  assert.deepEqual(pairs, [0, -1]);
  assert.deepEqual(how, ["content", "unpaired"]);
  // The fence tag does not matter (the migration retagged languages), the
  // lines do.
  assert.deepEqual(pairBlocks(["```sh\na\n```"], ["```js\na\n```"]).pairs, [0]);
  assert.deepEqual(
    pairBlocks(["```\na\nb\nc\n```"], ["```\nx\ny\nz\n```"]).pairs,
    [-1],
  );
});

test("restoreBody keeps the local fence lines and takes the source body", () => {
  assert.equal(
    restoreBody("```csharp\nvar a = 1;\n```", "```c#\nvar a = 1 ;\n```"),
    "```csharp\nvar a = 1 ;\n```",
  );
  // A blockquoted fence keeps its markers.
  assert.equal(
    restoreBody("> ```sh\n> ls\n> ```", "```sh\nls -la\n```"),
    "> ```sh\nls -la\n> ```",
  );
  // An unterminated fence is never touched.
  assert.equal(restoreBody("```\nopen", "```\nclosed\n```"), "```\nopen");
});

test("syncPost restores code only, reports each change and counts the unpaired", () => {
  const local = [
    "---",
    "title: Local",
    "---",
    "Prose stays, `{% raw %}` and all.",
    "",
    "```js",
    'import React from "react";',
    "```",
    "",
    "More prose.",
    "",
    "```html",
    "<a asp-area>Home</a>",
    "```",
    "",
    "```sh",
    "only here",
    "```",
    "",
  ].join("\n");
  const source = [
    "---",
    "title: Source",
    "layout: blog_post",
    "---",
    "Different prose.",
    "",
    "```js",
    "import React from 'react';",
    "```",
    "",
    "```html",
    '<a asp-area="">Home</a>',
    "```",
    "",
  ].join("\n");
  const r = syncPost(local, source);
  assert.equal(r.blocks, 3);
  assert.equal(r.unpaired, 1);
  assert.equal(r.sourceOnly, 0);
  assert.deepEqual(
    r.changes.map((c) => [c.block, c.kind, c.line]),
    [
      [1, "formatting", 2],
      [2, "formatting", 2],
    ],
  );
  assert.equal(
    r.text,
    local
      .replace('import React from "react";', "import React from 'react';")
      .replace("<a asp-area>Home</a>", '<a asp-area="">Home</a>'),
  );
});

test("syncPost normalizes a CRLF source and leaves an identical post untouched", () => {
  const post = "Text\n\n```js\na();\n```\n";
  assert.equal(
    syncPost(post, "Text\r\n\r\n```js\r\na();\r\n```\r\n").changes.length,
    0,
  );
  assert.equal(syncPost(post, post).text, post);
});
