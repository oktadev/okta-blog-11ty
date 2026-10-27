import { test } from "node:test";
import assert from "node:assert/strict";
import { lint, RULES } from "../scripts/lint-content.js";

const rules = (content) => lint(content).map((f) => f.rule);

test("lint: placeholder org domains and the .com placeholder", () => {
  assert.deepEqual(
    rules(
      "Set issuer to https://your-org.okta.com/oauth2/default and https://{yourOktaDomain}.com/x and https://{org}.oktapreview.com.",
    ),
    [
      "placeholder org domain",
      "placeholder org domain",
      "placeholder with a .com suffix",
    ],
  );
  assert.deepEqual(
    rules(
      "Use https://{yourOktaDomain}/oauth2/default and https://dev-133337.okta.com.",
    ),
    [],
  );
});

test("lint: index# only when it is a link target", () => {
  assert.deepEqual(
    rules('See [the docs](index#setup) and <a href="../index#top">top</a>.'),
    ["index# link", "index# link"],
  );
  assert.deepEqual(rules('"factory": "./rsi/index#rsi"'), []);
});

test("lint: curly quotes and the ellipsis, with line numbers", () => {
  const findings = lint("---\ntitle: T\n---\nIt’s “fine”…\n");
  assert.deepEqual(
    findings.map((f) => [f.rule, f.line]),
    [
      ["curly double quote", 4],
      ["curly double quote", 4],
      ["curly single quote", 4],
      ["unicode ellipsis", 4],
    ],
  );
  assert.deepEqual(rules('It\'s "fine"...'), []);
});

test("lint: absolute links to this blog, but not to docs or other hosts", () => {
  assert.deepEqual(
    lint(
      "[a](https://developer.okta.com/blog/2024/02/29/net-scim/) [b](https://developer.okta.com/docs/guides/) [c](/blog/2024/02/29/net-scim/)",
    ).map((f) => f.match),
    ["https://developer.okta.com/blog/2024/02/29/net-scim/"],
  );
});

test("lint: a post can opt out of one rule through front matter", () => {
  const content =
    "---\ntitle: T\nlint-ignore: [index# link]\n---\n[x](index#y) and “q”";
  assert.deepEqual(rules(content), [
    "curly double quote",
    "curly double quote",
  ]);
});

test("lint: every rule carries a fix hint", () => {
  for (const rule of RULES) assert.ok(rule.fix.length > 10, rule.name);
});
