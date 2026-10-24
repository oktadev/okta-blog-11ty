// Prism grammars for languages posts use that Prism doesn't ship. `register`
// adds them to a Prism instance.
import Prism from "prismjs";

// HOCON (Typesafe Config), as used by Ktor and Akka applications.
// https://github.com/lightbend/config/blob/main/HOCON.md
const hocon = {
  comment: {
    pattern: /(^|[^\\])(?:#|\/\/).*/,
    lookbehind: true,
    greedy: true,
  },
  string: {
    pattern: /"""[\s\S]*?"""|"(?:\\.|[^"\\\r\n])*"/,
    greedy: true,
  },
  // ${path} and ${?path} substitutions
  substitution: {
    pattern: /\$\{\??[^}]*\}/,
    alias: "variable",
  },
  include: {
    pattern: /^\s*include\b/m,
    alias: "keyword",
  },
  // A key is whatever sits before "=", ":" or an object opening brace.
  property: {
    pattern:
      /^[ \t]*(?:"(?:\\.|[^"\\\r\n])*"|[\w.-]+)(?=[ \t]*(?:[=:]|\{|\+=))/m,
    greedy: true,
  },
  boolean: /\b(?:true|false|yes|no|on|off)\b/,
  null: {
    pattern: /\bnull\b/,
    alias: "keyword",
  },
  number:
    /\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\s*(?:ns|us|ms|s|m|h|d|[kKmMgGtT]i?[bB]?)?\b/,
  operator: /\+=|[=:]/,
  punctuation: /[{}[\],]/,
};

// Polar, the Oso authorization policy language.
// https://www.osohq.com/docs/reference/polar
const polar = {
  comment: {
    pattern: /#.*/,
    greedy: true,
  },
  string: {
    pattern: /"(?:\\.|[^"\\\r\n])*"/,
    greedy: true,
  },
  keyword:
    /\b(?:if|and|or|not|in|matches|new|forall|cut|resource|actor|global|permissions|roles|relations|type|declare)\b/,
  boolean: /\b(?:true|false)\b/,
  // A rule or predicate name before its argument list: allow(...), has_role(...)
  function: /\b[a-z_]\w*(?=\s*\()/,
  // A type after a colon or "matches": user: User, x matches Repo
  "class-name": {
    pattern: /(:\s*|\bmatches\s+|\bnew\s+)[A-Z]\w*/,
    lookbehind: true,
  },
  // Anonymous or named variables: _, _bear, user
  variable: /\b_\w*\b/,
  number: /\b\d+(?:\.\d+)?\b/,
  operator: /\?=|[=!<>]=?|[+\-*/]|\bnil\b/,
  punctuation: /[{}[\]();,.:]/,
};

export function register(prism = Prism) {
  prism.languages.hocon = hocon;
  prism.languages.polar = polar;
  return prism;
}
