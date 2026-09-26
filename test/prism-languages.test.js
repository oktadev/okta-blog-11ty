import { test } from "node:test";
import assert from "node:assert/strict";
import Prism from "prismjs";
import { register } from "../utils/prism-languages.js";

register(Prism);

// Token types in order, ignoring plain text.
const types = (code, lang) =>
  Prism.tokenize(code, Prism.languages[lang])
    .filter((t) => typeof t !== "string")
    .map((t) => t.type);

test("hocon: keys, substitutions, strings, comments and values", () => {
  const code = [
    "# Ktor settings",
    "okta {",
    "    orgUrl = ${OKTA_ORGURL} // env",
    '    clientId = "abc"',
    "    timeout = 30s",
    "    enabled = true",
    "}",
  ].join("\n");
  const t = types(code, "hocon");
  assert.deepEqual(t.slice(0, 8), [
    "comment",
    "property",
    "punctuation",
    "property",
    "operator",
    "substitution",
    "comment",
    "property",
  ]);
  assert.ok(t.includes("string"));
  assert.ok(t.includes("number"));
  assert.ok(t.includes("boolean"));
});

test("polar: rules, types, keywords, variables and strings", () => {
  const code =
    'allow(user: User, "create", _bear: BearBase) if\n    not user.is_banned;';
  const t = types(code, "polar");
  assert.equal(t[0], "function");
  assert.ok(t.includes("class-name"));
  assert.ok(t.includes("string"));
  assert.ok(t.includes("variable"));
  assert.deepEqual(
    t.filter((x) => x === "keyword"),
    ["keyword", "keyword"],
  );
});
