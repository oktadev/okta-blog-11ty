import { test } from "node:test";
import assert from "node:assert/strict";
import { markdownLibrary, slugify } from "../utils/markdown.js";

test("slugify follows kramdown's GFM heading ids", () => {
  for (const [text, id] of [
    ["Create Your Vue + Go App", "create-your-vue--go-app"],
    ["What\u2019s New in Spring Boot 2.1", "whats-new-in-spring-boot-21"],
    ["Implement Okta Login / Logout", "implement-okta-login--logout"],
    [
      "Angular, React, and WebFlux - Oh My!",
      "angular-react-and-webflux---oh-my",
    ],
    [
      "Bernd R\u00fccker, Co-founder & Technologist",
      "bernd-r\u00fccker-co-founder--technologist",
    ],
    ["Use `okta.env` and my_var", "use-oktaenv-and-my_var"],
  ]) {
    assert.equal(slugify(text), id, text);
  }
});

test("headings and the table of contents share the ids, duplicates get -1", () => {
  const html = markdownLibrary.render(
    "[[toc]]\n\n## Vue + Go\n\n## Vue + Go\n",
  );
  assert.match(html, /<h2 id="vue--go"/);
  assert.match(html, /<h2 id="vue--go-1"/);
  assert.match(html, /href="#vue--go"/);
});

test("inline code in a heading stays code in the table of contents (#219)", () => {
  const html = markdownLibrary.render(
    "[[toc]]\n\n## Build a `GroupList` component\n",
  );
  assert.match(
    html,
    /<a href="#build-a-grouplist-component">Build a <code>GroupList<\/code> component<\/a>/,
  );
  assert.match(html, /<h2 id="build-a-grouplist-component"/);
});

test("table of contents keeps code spans that start or end with a backtick", () => {
  for (const [heading, code] of [
    ["## Use `` `value `` here", "`value"],
    ["## Use `` value` `` here", "value`"],
    ["## Use `` `both` `` here", "`both`"],
    ["## Use ```a``b``` here", "a``b"],
  ]) {
    const html = markdownLibrary.render(`[[toc]]\n\n${heading}\n`);
    const toc = html.match(/<nav class="table-of-contents[\s\S]*?<\/nav>/)[0];
    const id = html.match(/<h2 id="([^"]*)"/)[1];
    assert.ok(toc.includes(`<code>${code}</code>`), heading);
    assert.ok(toc.includes(`href="#${id}"`), `${heading}: link matches id`);
  }
});

test("table of contents leaves a whitespace-only code span as it was", () => {
  const html = markdownLibrary.render("[[toc]]\n\n## A ` ` character\n");
  const toc = html.match(/<nav class="table-of-contents[\s\S]*?<\/nav>/)[0];
  assert.ok(toc.includes("A <code> </code> character"), toc);
});

test("table of contents merges adjacent code spans instead of fusing their fences", () => {
  const html = markdownLibrary.render("[[toc]]\n\n## `foo`**`bar`**\n");
  const toc = html.match(/<nav class="table-of-contents[\s\S]*?<\/nav>/)[0];
  assert.ok(toc.includes("<code>foobar</code>"), toc);
  assert.ok(!toc.includes("`"), "no stray backticks");
});

test("table of contents escapes a literal backtick or backslash before a code span", () => {
  const html = markdownLibrary.render(
    "[[toc]]\n\n## a\\``x`\n\n## C:\\dir `y`\n",
  );
  const toc = html.match(/<nav class="table-of-contents[\s\S]*?<\/nav>/)[0];
  assert.ok(toc.includes("a`<code>x</code>"), toc);
  assert.ok(toc.includes("C:\\dir <code>y</code>"), toc);
});

test("footnotes render as on the old site, with a bare number as the marker", () => {
  const html = markdownLibrary.render("Text[^1].\n\n[^1]: The note.\n");
  assert.match(
    html,
    /<sup class="footnote-ref"><a href="#fn1"[^>]*>1<\/a><\/sup>/,
  );
  assert.match(html, /<section class="footnotes">[\s\S]*The note\./);
});

test("indented code blocks stay on even after Eleventy disables them", () => {
  markdownLibrary.disable("code");
  assert.match(
    markdownLibrary.render("Run:\n\n    ls -la\n"),
    /<pre><code>ls -la/,
  );
  markdownLibrary.disable(["code", "table"]);
  assert.match(markdownLibrary.render("    ls -la\n"), /<pre><code>/);
  markdownLibrary.enable("table");
});

test("a trailing {placeholder} stays text while classes, ids and attributes still apply", () => {
  const render = (s) => markdownLibrary.render(s).trim().replace(/\n/g, "");
  assert.equal(
    render("Set it to {yourOktaDomain}"),
    "<p>Set it to {yourOktaDomain}</p>",
  );
  assert.equal(
    render("- issuer = https://${yourOktaDomain}"),
    "<ul><li>issuer = https://${yourOktaDomain}</li></ul>",
  );
  assert.equal(
    render("* PublicKey = {YOURUSERNAME}"),
    "<ul><li>PublicKey = {YOURUSERNAME}</li></ul>",
  );
  assert.equal(render("para {.hide}"), '<p class="hide">para</p>');
  assert.equal(render("x {#anchor}"), '<p id="anchor">x</p>');
  assert.equal(render("y {data-x=1}"), '<p data-x="1">y</p>');
  assert.equal(
    render("Use `{yourOktaDomain}` here"),
    "<p>Use <code>{yourOktaDomain}</code> here</p>",
  );
  // A templated host is never linked, mid-line either; a real URL still is.
  assert.equal(
    render(
      "Open https://${yourOktaDomain}/oauth2/default in a tab, or https://{yourOktaDomain}/x too.",
    ),
    "<p>Open https://${yourOktaDomain}/oauth2/default in a tab, or https://{yourOktaDomain}/x too.</p>",
  );
  assert.equal(
    render("See https://developer.okta.com/ now"),
    '<p>See <a href="https://developer.okta.com/">https://developer.okta.com/</a> now</p>',
  );
});

test("a newline inside a paragraph is a space; two trailing spaces or a backslash break the line", () => {
  assert.equal(
    markdownLibrary.render("one\ntwo\n"),
    "<p>one\ntwo</p>\n",
    "no <br> for a plain newline",
  );
  assert.match(markdownLibrary.render("one  \ntwo\n"), /one<br>\s*two/);
  assert.match(markdownLibrary.render("one\\\ntwo\n"), /one<br>\s*two/);
});
