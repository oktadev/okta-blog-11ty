import { test } from "node:test";
import assert from "node:assert/strict";
import { postToMarkdown } from "../utils/markdown-export.js";

const ORIGIN = "https://developer.okta.com";
const URL = "/blog/2026/01/21/example/";

function convert(html) {
  const md = postToMarkdown({
    html,
    title: "Example",
    description: "An example post",
    authors: ["Jane Doe"],
    date: "2026-01-21",
    url: URL,
    origin: ORIGIN,
  });
  // Drop the front matter and title so assertions see only the body.
  return md.split("\n# Example\n\n")[1].trim();
}

test("markdown export: front matter carries the post's metadata", () => {
  const md = postToMarkdown({
    html: "<p>Hi</p>",
    title: 'Say "hi"',
    description: "",
    authors: ["Jane Doe", "Sam Roe"],
    date: "2026-01-21",
    url: URL,
    origin: ORIGIN,
  });
  assert.match(
    md,
    /^---\ntitle: "Say \\"hi\\""\nauthor: "Jane Doe, Sam Roe"\ndate: 2026-01-21\nurl: https:\/\/developer\.okta\.com\/blog\/2026\/01\/21\/example\/\n---\n/,
  );
  assert.doesNotMatch(md, /description:/);
});

test("markdown export: highlighted code keeps its text and language", () => {
  const html =
    '<pre class="language-ts"><code class="language-ts"><span class="token keyword">const</span> a <span class="token operator">=</span> <span class="token string">"&lt;b&gt;"</span>;\n</code></pre>';
  assert.equal(convert(html), '```ts\nconst a = "<b>";\n```');
});

test("markdown export: a fence inside code gets a longer fence", () => {
  const html =
    '<pre class="language-markdown"><code class="language-markdown">```sh\nls\n```\n</code></pre>';
  assert.equal(convert(html), "````markdown\n```sh\nls\n```\n````");
});

test("markdown export: text fences carry no language", () => {
  assert.equal(
    convert(
      '<pre class="language-text"><code class="language-text">plain</code></pre>',
    ),
    "```\nplain\n```",
  );
});

test("markdown export: code callout badges become (n)", () => {
  const html =
    '<pre class="language-java"><code class="language-java">foo(); <i class="conum" data-value="1"></i><b>(1)</b></code></pre>';
  assert.equal(convert(html), "```java\nfoo(); (1)\n```");
});

test("markdown export: heading self-links are unwrapped", () => {
  const html =
    '<h2 id="setup" tabindex="-1"><a class="direct-link" href="#setup"><span>Set up</span></a></h2>';
  assert.equal(convert(html), "## Set up");
});

test("markdown export: images use the largest rendition and absolute URLs", () => {
  const html =
    '<img alt="A [diagram]" src="/blog/img/x/a-100.webp" srcset="/blog/img/x/a-100.webp 100w, /blog/img/x/a-1000.webp 1000w">';
  assert.equal(convert(html), `![A diagram](${ORIGIN}/blog/img/x/a-1000.webp)`);
});

test("markdown export: relative and fragment links become absolute", () => {
  assert.equal(
    convert(
      '<p><a href="/docs/guides/">Guides</a> and <a href="#setup">setup</a></p>',
    ),
    `[Guides](${ORIGIN}/docs/guides/) and [setup](${ORIGIN}${URL}#setup)`,
  );
});

test("markdown export: YouTube embeds become watch links", () => {
  const html =
    '<div class="grid"><iframe src="https://www.youtube-nocookie.com/embed/8hPDL9GCD5Q" title="YouTube video player"></iframe></div>';
  assert.equal(
    convert(html),
    "[YouTube video](https://www.youtube.com/watch?v=8hPDL9GCD5Q)",
  );
});

test("markdown export: the table of contents is dropped", () => {
  const html =
    '<nav class="table-of-contents"><ul><li><a href="#a">A</a></li></ul></nav><p>Body</p>';
  assert.equal(convert(html), "Body");
});

test("markdown export: lists use a single space after the marker", () => {
  assert.equal(
    convert(
      '<ol start="3"><li>One</li><li>Two<ul><li>Nested</li></ul></li></ol>',
    ),
    "3. One\n4. Two\n   - Nested",
  );
});

test("markdown export: an emoji-and-note table becomes a blockquote", () => {
  const html =
    '<table><tr><td style="font-size:3rem">⚠️</td><td><strong>Heads up!</strong><br>Keep it secret.</td></tr></table>';
  assert.equal(convert(html), "> ⚠️ **Heads up!**  \n> Keep it secret.");
});

test("markdown export: a layout table is flattened cell by cell", () => {
  const html =
    "<table><tr><td><strong>Request</strong></td><td><pre>GET /authorize</pre></td></tr></table>";
  assert.equal(convert(html), "**Request**\n\n```\nGET /authorize\n```");
});

test("markdown export: a data table with a heading row stays a table", () => {
  const html =
    "<table><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody><tr><td>a</td><td>1</td></tr></tbody></table>";
  assert.equal(convert(html), "| Name | Value |\n| --- | --- |\n| a | 1 |");
});

test("markdown export: footnotes round-trip", () => {
  const html =
    '<p>Claim<sup class="footnote-ref"><a href="#fn1" id="fnref1">[1]</a></sup></p>' +
    '<hr class="footnotes-sep"><section class="footnotes"><ol class="footnotes-list">' +
    '<li id="fn1" class="footnote-item"><p>Source. <a href="#fnref1" class="footnote-backref">↩︎</a></p></li></ol></section>';
  assert.equal(convert(html), "Claim[^1]\n\n[^1]: Source.");
});

test("markdown export: a tag shown in prose stays text", () => {
  assert.equal(
    convert("<p>Write &lt;p&gt;hi&lt;/p&gt; or <code>&lt;b&gt;</code>.</p>"),
    "Write &lt;p>hi&lt;/p> or `<b>`.",
  );
});
