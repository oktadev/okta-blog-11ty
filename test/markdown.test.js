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
