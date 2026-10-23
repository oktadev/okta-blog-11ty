import { test } from "node:test";
import assert from "node:assert/strict";
import {
  balancedElement,
  compareAnchors,
  compareCode,
  compareInline,
  compareProse,
  elementByClass,
  extract,
  needsAttention,
  normalizeText,
} from "../scripts/verify-migration.js";

test("balancedElement and elementByClass find the whole article", () => {
  const html =
    '<body><div class="x"><div class="BlogPost-content"><p>a</p><div><p>b</p></div></div><p>after</p></div></body>';
  assert.equal(
    elementByClass(html, "BlogPost-content"),
    '<div class="BlogPost-content"><p>a</p><div><p>b</p></div></div>',
  );
  assert.equal(balancedElement("<p>x</p><p>y</p>", 0), "<p>x</p>");
});

test("normalizeText folds typography, entities and callout markers", () => {
  assert.equal(
    normalizeText("It’s &ldquo;fine” — really… &amp; done ①"),
    'It\'s "fine" - really... & done',
  );
  assert.equal(normalizeText("foo(); // (1)\nbar <2>"), "foo(); // bar");
});

test("extract separates prose, code and inline code and drops the TOC", () => {
  const html =
    '<div class="table-of-contents"><ul><li><a href="#a">A</a></li></ul></div>' +
    "<h2>A heading</h2><p>Para with <code>x</code>.</p>" +
    '<pre class="highlight"><code><span class="k">let</span> a = 1; <i class="conum" data-value="1"></i><b>(1)</b>\n</code></pre>' +
    "<ul><li>item one</li><li>item &amp; two</li></ul>" +
    '<p id="changelog"><strong>Changelog</strong></p><ul><li>gone</li></ul>';
  const r = extract(html);
  assert.deepEqual(r.prose, [
    "A heading",
    "Para with x.",
    "item one",
    "item & two",
  ]);
  assert.deepEqual(r.code, ["let a = 1;"]);
  assert.deepEqual(r.inline, ["x"]);
});

test("compareProse reports live blocks that have no counterpart", () => {
  const live = [
    "One two three four",
    "Five six seven eight",
    "Nine ten eleven",
  ];
  const mine = ["One two three four", "Five six seven eight nine"];
  const r = compareProse(live, mine);
  assert.deepEqual(r.missing, ["Nine ten eleven"]);
  assert.deepEqual(r.extra, []);
});

test("compareCode matches blocks out of order and reports the first differing line", () => {
  const r = compareCode(["a\nb", "c"], ["c", "a\nB"]);
  assert.equal(r.liveCount, 2);
  assert.equal(r.mismatches.length, 1);
  assert.deepEqual([r.mismatches[0].live, r.mismatches[0].mine], ["b", "B"]);
});

test("needsAttention fails a post for any kind of loss, including inline code", () => {
  const clean = {
    prose: { missing: [], extra: [] },
    code: { liveCount: 2, mineCount: 2, mismatches: [] },
    inline: [],
    anchors: [],
  };
  assert.equal(needsAttention(clean), false);
  assert.equal(needsAttention({ ...clean, inline: ["okta login"] }), true);
  assert.equal(needsAttention({ ...clean, anchors: ["setup"] }), true);
  assert.equal(
    needsAttention({ ...clean, prose: { missing: ["gone"], extra: [] } }),
    true,
  );
  assert.equal(
    needsAttention({ ...clean, code: { ...clean.code, mineCount: 1 } }),
    true,
  );
  assert.equal(
    needsAttention({
      ...clean,
      code: { ...clean.code, mismatches: [{ index: 0 }] },
    }),
    true,
  );
  // Extra prose on our side is reported but is not a loss.
  assert.equal(
    needsAttention({ ...clean, prose: { missing: [], extra: ["added"] } }),
    false,
  );
});

test("normalizeText folds Asciidoctor's arrows, dashes and zero-width characters", () => {
  assert.equal(normalizeText(">=1.2.3 ⇐2.3.4"), ">=1.2.3 <=2.3.4");
  assert.equal(normalizeText("tr — '+/'"), "tr - '+/'");
  assert.equal(
    normalizeText("src/main/java/…​/demo/App.java"),
    "src/main/java/.../demo/App.java",
  );
});

test("compareInline treats spans as a multiset", () => {
  assert.deepEqual(compareInline(["ab", "ab", "cd"], ["ab", "cd"]), ["ab"]);
});

test("compareProse accepts merged and split blocks but reports the leftover of a truncated one", () => {
  // Two live paragraphs merged into one local block.
  assert.deepEqual(
    compareProse(["One two", "Three four"], ["One two Three four"]).missing,
    [],
  );
  // One live paragraph split into two local blocks that cover it.
  assert.deepEqual(
    compareProse(
      ["Install the SDK and configure the client"],
      ["Install the SDK", "and configure the client"],
    ).missing,
    [],
  );
  // A local block that is only a piece of the live one is a loss.
  assert.deepEqual(
    compareProse(
      ["Install the SDK and configure the client"],
      ["Install the SDK"],
    ).missing,
    ["and configure the client"],
  );
});

test("compareProse and compareInline report short losses too", () => {
  assert.deepEqual(compareProse(["Run it"], []).missing, ["Run it"]);
  assert.deepEqual(compareInline(["x", "y"], ["y"]), ["x"]);
});

test("extract collects heading ids and every id, and compareAnchors reports live ids that do not resolve", () => {
  const live = extract(
    '<h2 id="create-your-vue--go-app">Create</h2><h3 id="run-it">Run</h3><ul id="markdown-toc"></ul>',
  );
  assert.deepEqual(live.headingIds, ["create-your-vue--go-app", "run-it"]);
  const mine = extract(
    '<a id="create-your-vue--go-app"></a><h2 id="create-your-vue-go-app">Create</h2><h3 id="run">Run</h3>',
  );
  assert.deepEqual(
    [...mine.ids],
    ["create-your-vue--go-app", "create-your-vue-go-app", "run"],
  );
  assert.deepEqual(compareAnchors(live, mine), ["run-it"]);
});
