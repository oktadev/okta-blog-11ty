import { test } from "node:test";
import assert from "node:assert/strict";
import {
  convertAsciidoc,
  convertMarkdown,
  liquidArgsToObject,
  parseBlockAttrs,
  protectTemplateSyntax,
  splitSegments,
} from "../scripts/migrate-posts.js";

const md = (body, fm = "layout: blog_post\ntitle: T\nauthor: a") =>
  convertMarkdown(`---\n${fm}\n---\n${body}`).markdown;
const adoc = (body, fm = "layout: blog_post\ntitle: T\nauthor: a") =>
  convertAsciidoc(`---\n${fm}\n---\n:page-liquid:\n\n${body}`);
const bodyOf = (markdown) => markdown.replace(/^---[\s\S]*?---\n/, "");

// ---------------------------------------------------------------------------
// Front matter
// ---------------------------------------------------------------------------

test("front matter: drops layout, strips blog/ from image, keeps the rest verbatim", () => {
  const out = md(
    "Hi.",
    'layout: blog_post\ntitle: "T"\nimage: blog/dir/social.png\nby: advocate',
  );
  assert.equal(
    out,
    '---\ntitle: "T"\nimage: dir/social.png\nby: advocate\n---\nHi.',
  );
});

test("front matter: CRLF sources are normalized to LF", () => {
  const out = convertMarkdown(
    "---\r\ntitle: T\r\n---\r\nOne\r\n\r\n```js\r\nx\r\n```\r\n",
  ).markdown;
  assert.equal(out.includes("\r"), false);
  assert.match(out, /```js\nx\n```/);
});

// ---------------------------------------------------------------------------
// Markdown: code protection
// ---------------------------------------------------------------------------

test("splitSegments: fences, blockquoted fences and unterminated fences are code", () => {
  const segs = splitSegments(
    "a\n```\nx\n```\nb\n> ```js\n> y\n> ```\nc\n~~~\nz",
  );
  assert.deepEqual(
    segs.map((s) => [s.code, s.text]),
    [
      [false, "a"],
      [true, "```\nx\n```"],
      [false, "b"],
      [true, "> ```js\n> y\n> ```"],
      [false, "c"],
      [true, "~~~\nz"],
    ],
  );
});

test("markdown: Liquid inside fenced code and inline code is left byte for byte", () => {
  const body =
    'Run `{% include setup/cli.md type="spa" %}` or:\n\n```liquid\n{% img blog/x/y.png alt:"A" %}\n{%- capture x -%}\n```\n';
  const out = bodyOf(md(body));
  assert.ok(out.includes('{% img blog/x/y.png alt:"A" %}'));
  assert.ok(out.includes("{%- capture x -%}"));
  assert.ok(out.includes('`{% include setup/cli.md type="spa" %}`'));
});

test("protectTemplateSyntax: wraps unprotected template syntax in code, leaves raw regions alone", () => {
  const { text, wrapped } = protectTemplateSyntax(
    "Use `{{ title }}` here.\n\n```html\n<b>{{ x }}</b>\n```\n\n{% raw %}\n```\n{% if y %}\n```\n{% endraw %}\n\n```\nplain\n```",
  );
  assert.equal(wrapped, 2);
  assert.ok(text.includes("{% raw %}`{{ title }}`{% endraw %}"));
  assert.ok(
    text.includes("{% raw %}\n```html\n<b>{{ x }}</b>\n```\n{% endraw %}"),
  );
  assert.equal((text.match(/\{% raw %\}/g) || []).length, 3);
  assert.ok(text.includes("```\nplain\n```"));
});

// ---------------------------------------------------------------------------
// Markdown: Liquid tags
// ---------------------------------------------------------------------------

test("liquidArgsToObject: quoted, single-quoted and bare values", () => {
  assert.equal(
    liquidArgsToObject(
      ` type="spa" framework='ASP.NET Core' note=note loginRedirectUri="http://localhost:3000/callback" `,
    ),
    '{type: "spa", framework: "ASP.NET Core", note: note, loginRedirectUri: "http://localhost:3000/callback"}',
  );
});

test("markdown: setup includes become macro calls with object arguments", () => {
  const out = bodyOf(
    md(
      '{% include setup/integrator.md type="web" framework="Spring Boot" %}\n{% include setup/cli.md type="spa" %}\n{% include setup/oidcdebugger.md %}\n{% include setup/maven.md %}',
    ),
  );
  assert.equal(
    out,
    '{{ macro.integrator({type: "web", framework: "Spring Boot"}) }}\n{{ macro.cli({type: "spa"}) }}\n{{ macro.oidcdebugger({}) }}\n{{ macro.maven() }}',
  );
});

test("markdown: images, embeds, excerpts, post links and the TOC", () => {
  const out = bodyOf(
    md(
      [
        '{% img blog/d/a.png alt:"Alt text" width:"800" %}{: .center-image }',
        '{% img blog/d/b.png alt="B" width=100% %}',
        '{% img blog/d/c.png\n   alt:"multi line" %}',
        "{% youtube abc123 %}",
        "{% youtube abc123 900 %}",
        "{% twitter 1460993714227236868 %}",
        "{% speakerdeck ffe22480 900px %}",
        "{% excerpt /blog/2024/02/29/net-scim %}",
        "[p]({% post_url 2025-7-8-slug-here %})",
        "{% include toc.md %}",
        "* Table of Contents\n{:toc}",
        "{% include integrator-org-warning.html %}",
      ].join("\n"),
    ),
  );
  assert.equal(
    out,
    [
      '{% img {src: "d/a.png", alt: "Alt text", header: "800"} %}',
      '{% img {src: "d/b.png", alt: "B", header: "100"} %}',
      '{% img {src: "d/c.png", alt: "multi line"} %}',
      '{% youtube "abc123" %}',
      '{% youtube "abc123", "", 900 %}',
      "https://twitter.com/i/status/1460993714227236868",
      '{% speakerdeck "ffe22480", 900 %}',
      '{% excerpt "net-scim" %}',
      "[p](/blog/2025/07/08/slug-here/)",
      "[[toc]]",
      "[[toc]]",
      '{% include "integrator-org-warning.njk" %}',
    ].join("\n"),
  );
});

test("markdown: capture/comment tags and empty HTML attributes", () => {
  const out = bodyOf(
    md(
      '{% capture note %}\nx\n{% endcapture %}\n{% comment %}c{% endcomment %}\n<img src="a.png" alt="" class="x">',
    ),
  );
  assert.equal(
    out,
    '{% set note %}\nx\n{% endset %}\n{#c#}\n<img src="a.png" class="x">',
  );
});

// ---------------------------------------------------------------------------
// AsciiDoc: blocks
// ---------------------------------------------------------------------------

test("parseBlockAttrs: positional, named, shorthand and quoted values", () => {
  assert.deepEqual(parseBlockAttrs("[source,java,indent=0]"), {
    positional: ["source", "java"],
    named: { indent: "0" },
    roles: [],
    options: [],
    id: null,
  });
  assert.deepEqual(parseBlockAttrs("[#okta-config.wide%collapsible]"), {
    positional: [],
    named: {},
    roles: ["wide"],
    options: ["collapsible"],
    id: "okta-config",
  });
  assert.deepEqual(
    parseBlockAttrs("[quote, Melvin Conway, 'https://x.com/a[Conway\\'s Law]']")
      .positional,
    ["quote", "Melvin Conway", "https://x.com/a[Conway\\'s Law]"],
  );
  assert.deepEqual(
    parseBlockAttrs('[cols="a,a", frame=none, role="text-right small"]').roles,
    ["text-right", "small"],
  );
});

test("asciidoc: header attributes are consumed, headings and paragraphs reflow", () => {
  const { markdown, notes } = adoc(
    ":toc: macro\n:experimental:\n:commandkey: &#8984;\n\nFirst line\nsecond line.\n\ntoc::[]\n\n== Section *One*\n\n=== Sub\n\nPress kbd:[{commandkey} + S].",
  );
  assert.equal(
    bodyOf(markdown),
    "First line second line.\n\n[[toc]]\n\n## Section **One**\n\n### Sub\n\nPress <kbd>&#8984;</kbd>+<kbd>S</kbd>.\n",
  );
  assert.deepEqual(notes, []);
});

test("asciidoc: hard line breaks and %hardbreaks paragraphs keep their newlines", () => {
  const out = bodyOf(
    adoc("Roses +\nviolets.\n\n[%hardbreaks]\none\ntwo").markdown,
  );
  assert.equal(out, "Roses\nviolets.\n\none\ntwo\n");
});

test("asciidoc: admonition paragraphs and blocks become labelled blockquotes", () => {
  const out = bodyOf(
    adoc(
      "NOTE: Mind the\ngap.\n\n[TIP]\n.Env vars\n====\nUse `okta.env`.\n\n----\nexport X=1\n----\n====",
    ).markdown,
  );
  assert.equal(
    out,
    "> **NOTE:** Mind the gap.\n\n> **TIP: Env vars**\n>\n> Use `okta.env`.\n>\n> ```\n> export X=1\n> ```\n",
  );
});

test("asciidoc: source blocks keep code verbatim, including callouts and prose-like lines", () => {
  const src =
    "[source,java]\n----\npublic class A { // <1>\n  *not bold* _not italic_ NOTE: not an admonition\n  == not a heading\n}\n----\n<1> the class\n<2> more";
  const out = bodyOf(adoc(src).markdown);
  assert.equal(
    out,
    "```java\npublic class A { // <1>\n  *not bold* _not italic_ NOTE: not an admonition\n  == not a heading\n}\n```\n\n1. the class\n2. more\n",
  );
});

test("asciidoc: listing without language, markdown fences, literal paragraphs and titles", () => {
  const out = bodyOf(
    adoc(
      ".A title\n----\nplain\n----\n\n[source,kotlin]\n```\nfun a() {}\n```\n\n    indented\n    literal",
    ).markdown,
  );
  assert.equal(
    out,
    "**A title**\n\n```\nplain\n```\n\n```kotlin\nfun a() {}\n```\n\n```\nindented\nliteral\n```\n",
  );
});

test("asciidoc: example, collapsible, sidebar, quote and open blocks", () => {
  const { markdown, notes } = adoc(
    ".Read a file\n====\nInside.\n====\n\n.Click to see\n[%collapsible]\n====\nHidden.\n====\n\n.OWASP\n****\nSide.\n****\n\n[quote, Melvin Conway, 'https://x.com/law[Conway\\'s Law]']\n____\nOrgs design systems.\n____\n\n[.scrollable]\n--\nOpen.\n--",
  );
  assert.equal(
    bodyOf(markdown),
    [
      "**Read a file**\n\nInside.",
      "<details>\n<summary>Click to see</summary>\n\nHidden.\n\n</details>",
      "> **OWASP**\n>\n> Side.",
      "> Orgs design systems.\n>\n> — Melvin Conway, [Conway\\'s Law](https://x.com/law)",
      '<div class="scrollable">\n\nOpen.\n\n</div>\n',
    ].join("\n\n"),
  );
  assert.ok(notes.some((n) => n.startsWith("example block")));
  assert.ok(notes.some((n) => n.startsWith("sidebar block")));
});

test("asciidoc: passthrough blocks map Liquid and asset paths, comments vanish", () => {
  const out = bodyOf(
    adoc(
      "++++\n{% include integrator-org-warning.html %}\n{% youtube abc %}\n<video src=\"{% asset_path 'blog/d/v.mp4' %}\"></video>\n++++\n\n// a comment\n\n////\nblock comment\n////\n\nAfter.",
    ).markdown,
  );
  assert.equal(
    out,
    '{% include "integrator-org-warning.njk" %}\n{% youtube "abc" %}\n<video src="/img/blog/d/v.mp4"></video>\n\nAfter.\n',
  );
});

test("asciidoc: tables with and without a header row, image cells", () => {
  const withHeader = bodyOf(
    adoc(
      "|===\n|Shortcut |Purpose\n\n|kbd:[Ctrl + N]\n|Find files\n\n|`a|b`\n|Pipe\n|===",
    ).markdown,
  );
  assert.equal(
    withHeader,
    "| Shortcut | Purpose |\n| --- | --- |\n| <kbd>Ctrl</kbd>+<kbd>N</kbd> | Find files |\n| `a\\|b` | Pipe |\n",
  );
  const { markdown, notes } = adoc(
    "[cols=\"a,a\", frame=none, grid=none]\n|===\n| image::{% asset_path 'blog/d/a.jpg' %}[alt=A,width=400]\n| image::{% asset_path 'blog/d/b.jpg' %}[alt=B,width=400]\n|===",
  );
  assert.equal(
    bodyOf(markdown),
    '|  |  |\n| --- | --- |\n| {% img {src: "d/a.jpg", alt: "A", header: "400"} %} | {% img {src: "d/b.jpg", alt: "B", header: "400"} %} |\n',
  );
  assert.ok(notes.some((n) => n.startsWith("table without a header row")));
});

test("asciidoc: block images with title, width, link and asset paths", () => {
  const { markdown, notes } = adoc(
    ".The Initializr\nimage::{% asset_path 'blog/d/init.png' %}[alt=the Initializr,width=800,align=center]\n\nimage::blog/d/full.png[Alt,600,link={% asset_path 'blog/d/full.png' %}]",
  );
  assert.equal(
    bodyOf(markdown),
    '{% img {src: "d/init.png", alt: "the Initializr", header: "800"} %}\n\n_The Initializr_\n\n[{% img {src: "d/full.png", alt: "Alt", header: "600"} %}](/img/blog/d/full.png)\n',
  );
  assert.ok(notes.some((n) => n.startsWith("raw asset path")));
});

// ---------------------------------------------------------------------------
// AsciiDoc: lists
// ---------------------------------------------------------------------------

test("asciidoc: nested bullet and numbered lists, lazy continuation, blank lines between items", () => {
  const out = bodyOf(
    adoc(
      "* One\n  continued\n** Nested\n* Two\n\n* Three\n\n. First\n.. Sub\n. Second\n\n1. Explicit\n2. Numbers",
    ).markdown,
  );
  assert.equal(
    out,
    "- One continued\n  - Nested\n- Two\n- Three\n\n1. First\n  1. Sub\n2. Second\n\n1. Explicit\n2. Numbers\n",
  );
});

test("asciidoc: list continuation attaches paragraphs, code and images to the item", () => {
  const out = bodyOf(
    adoc(
      ". Add a controller:\n+\n[source,java]\n----\nclass A {}\n----\n+\nThen run it.\n+\nimage::blog/d/a.png[Alt]\n. Next step\n\n   mvn verify\n\n. Last",
    ).markdown,
  );
  assert.equal(
    out,
    [
      "1. Add a controller:",
      "",
      "   ```java",
      "   class A {}",
      "   ```",
      "",
      "   Then run it.",
      "",
      '   {% img {src: "d/a.png", alt: "Alt"} %}',
      "2. Next step",
      "",
      "   ```",
      "   mvn verify",
      "   ```",
      "3. Last",
      "",
    ].join("\n"),
  );
});

// ---------------------------------------------------------------------------
// AsciiDoc: inline
// ---------------------------------------------------------------------------

test("asciidoc: links in every form", () => {
  const out = bodyOf(
    adoc(
      "See https://a.io/x[Docs^], link:/blog/2019/01/28/tips[my post], mailto:dev@okta.com[email us], https://bare.io/ and https://empty.io/[].",
    ).markdown,
  );
  assert.equal(
    out,
    "See [Docs](https://a.io/x), [my post](/blog/2019/01/28/tips), [email us](mailto:dev@okta.com), https://bare.io/ and <https://empty.io/>.\n",
  );
});

test("asciidoc: formatting, quotes, literals and symbols", () => {
  const out = bodyOf(
    adoc(
      'This is *bold*, **also bold**, _italic_, __also__, `code *kept*`, `+{literal}+`, a "`quoted link https://x.io[X]`", Ionic + JHipster, C++ and 2^nd^, (C) 2024.',
    ).markdown,
  );
  assert.equal(
    out,
    'This is **bold**, **also bold**, _italic_, _also_, `code *kept*`, `{literal}`, a "quoted link [X](https://x.io)", Ionic + JHipster, C++ and 2<sup>nd</sup>, © 2024.\n',
  );
});

test("asciidoc: inline images, xrefs, anchors and roles", () => {
  const { markdown, notes } = adoc(
    "[#cfg]\n== Config\n\nimage:{% asset_path 'blog/d/j.jpg' %}[alt=Josh,role=\"pull-right\"] Text <<cfg,here>> and <<Other Section>>.\n\n[[ack]]\n_Thanks._\n\n[.text-right]\nRight.",
  );
  assert.equal(
    bodyOf(markdown),
    '<a id="cfg"></a>\n## Config\n\n{% img {src: "d/j.jpg", alt: "Josh"} %} Text [here](#cfg) and [Other Section](#other-section).\n\n<a id="ack"></a>\n_Thanks._\n\nRight. {.text-right}\n',
  );
  assert.ok(notes.some((n) => n.includes('inline image role "pull-right"')));
  assert.ok(notes.some((n) => n.includes("xref by section title")));
});

test("asciidoc: auto-numbered callouts, escaped URLs and indented commands in lists", () => {
  const out = bodyOf(
    adoc(
      "[source,java]\n----\nint a; // <.>\nint b; // <.>\n----\n<.> first\n<.> second\n\n[source,xml]\n----\n<a/> <!--.-->\n----\n<.> only\n\nSee `\\http://localhost:8080` and \\https://x.io.\n\n. Run it:\n\n  ./mvnw quarkus:dev\n\n. Test it:\n\n  http :8080/hello",
    ).markdown,
  );
  assert.equal(
    out,
    [
      "```java\nint a; // <1>\nint b; // <2>\n```",
      "1. first\n2. second",
      "```xml\n<a/> <!--1-->\n```",
      "1. only",
      "See `http://localhost:8080` and https://x.io.",
      "1. Run it:\n\n   ```\n   ./mvnw quarkus:dev\n   ```\n2. Test it:\n\n   ```\n   http :8080/hello\n   ```\n",
    ].join("\n\n"),
  );
});

test("protectTemplateSyntax: a fence that carries its own raw tags is left alone", () => {
  const { text, wrapped } = protectTemplateSyntax(
    "```yaml\n{% raw %}\nname: ${{ x }}\n{% endraw %}\n```\n\n```\n{{ y }}\n```",
  );
  assert.equal(wrapped, 1);
  assert.ok(
    text.startsWith("```yaml\n{% raw %}\nname: ${{ x }}\n{% endraw %}\n```"),
  );
  assert.ok(text.endsWith("{% raw %}\n```\n{{ y }}\n```\n{% endraw %}"));
});

test("asciidoc: blank lines inside code are kept, runs between blocks collapse", () => {
  const out = bodyOf(adoc("A\n\n\n\n----\nx\n\n\n\ny\n----\n\n\n\nB").markdown);
  assert.equal(out, "A\n\n```\nx\n\n\n\ny\n```\n\nB\n");
});

test("asciidoc: unsupported macros are kept and reported", () => {
  const { markdown, notes } = adoc("Click btn:[OK] then footnote:[a note].");
  assert.ok(markdown.includes("btn:[OK]"));
  assert.ok(notes.some((n) => n.includes("btn:")));
  assert.ok(notes.some((n) => n.includes("footnote:")));
});

test("asciidoc: Liquid inside code is protected, prose Liquid is converted", () => {
  const { markdown, notes } = adoc(
    '{% include setup/cli.md type="spa" loginRedirectUri="http://localhost:4200/callback" %}\n\n[source,html]\n----\n<p>{{ title }}</p>\n----',
  );
  assert.equal(
    bodyOf(markdown),
    '{{ macro.cli({type: "spa", loginRedirectUri: "http://localhost:4200/callback"}) }}\n\n{% raw %}\n```html\n<p>{{ title }}</p>\n```\n{% endraw %}\n',
  );
  assert.ok(notes.some((n) => n.startsWith("wrapped 1")));
});
