import { test } from "node:test";
import assert from "node:assert/strict";
import { badge, renderCallouts } from "../utils/callouts.js";

test("callouts: comment-prefixed markers at line ends become badges", () => {
  const html = [
    'try (FileInputStream in = new FileInputStream(file)) { <span class="token comment">// &lt;1&gt;</span>',
    "int res;",
    'listen 80; <span class="token comment"># &lt;2&gt;</span>',
    "&lt;dependency&gt; &lt;!--3--&gt;",
  ].join("<br>");
  assert.equal(
    renderCallouts(html),
    [
      `try (FileInputStream in = new FileInputStream(file)) { ${badge(1)}`,
      "int res;",
      `listen 80; ${badge(2)}`,
      `&lt;dependency&gt; ${badge(3)}`,
    ].join("<br>"),
  );
});

test("callouts: bare markers in unhighlighted text and newline-separated lines", () => {
  assert.equal(
    renderCallouts("Your selection? 1 &lt;1&gt;\ngpg&gt; trust &lt;2&gt;"),
    `Your selection? 1 ${badge(1)}\ngpg&gt; trust ${badge(2)}`,
  );
});

test("callouts: markers elsewhere on a line, and real code, are untouched", () => {
  for (const html of [
    "List&lt;1&gt; x = null;",
    "if (a &lt;1&gt; b) {}",
    "Map&lt;String, List&lt;Integer&gt;&gt; m;",
    "no markers here",
  ]) {
    assert.equal(renderCallouts(html), html);
  }
});
