import { test } from "node:test";
import assert from "node:assert/strict";
import * as yaml from "js-yaml";
import filters from "../utils/filters.js";

// Register the filters against a stub config and keep the ones we test.
const registered = {};
filters({
  addFilter: (name, fn) => (registered[name] = fn),
  addAsyncFilter: (name, fn) => (registered[name] = fn),
});
const changelogEntries = registered.changelogEntries;

const entries = (frontMatter) =>
  changelogEntries(yaml.load(frontMatter).changelog).map(({ date, text }) => [
    date.toISOString().slice(0, 10),
    text,
  ]);

test("changelog: date-keyed entries, newest first", () => {
  assert.deepEqual(
    entries("changelog:\n- 2023-08-21: First\n- 2023-09-15: Second\n"),
    [
      ["2023-09-15", "Second"],
      ["2023-08-21", "First"],
    ],
  );
});

test('changelog: "<date> => <text>" entries, the old site\'s other form', () => {
  assert.deepEqual(
    entries(
      "changelog:\n  - 2026-07-10 => Updated to include OAuth 2.0 Private Key JWT.\n",
    ),
    [["2026-07-10", "Updated to include OAuth 2.0 Private Key JWT."]],
  );
  // Only the first "=>" separates the date; later ones stay in the text.
  assert.deepEqual(entries("changelog:\n- 2024-01-02 => a => b\n"), [
    ["2024-01-02", "a => b"],
  ]);
});

test("changelog: missing or malformed front matter gives no entries", () => {
  assert.deepEqual(changelogEntries(undefined), []);
  assert.deepEqual(changelogEntries("2024-01-02: not a list"), []);
});
