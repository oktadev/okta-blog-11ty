import { test } from "node:test";
import assert from "node:assert/strict";
import {
  builtAssetRefs,
  publishedPath,
  rawAssetRefs,
} from "../utils/raw-assets.js";

test("rawAssetRefs finds media, downloads, full-size links and raw images, quoted or not, once each", () => {
  const refs = rawAssetRefs(
    [
      "<video src=\"/img/blog/d/demo.mp4\" poster='/img/blog/d/poster.png' controls></video>",
      '<a href="/files/d/guide.pdf">PDF</a>',
      '[{% img {src: "d/thumb.png", alt: ""} %}](/img/blog/d/full.png)',
      "<img src=/img/blog/d/raw.png alt=x>",
      '<img src="/img/blog/d/raw.png">',
      '{% img {src: "d/through-shortcode.png", alt: ""} %}',
      '<a href="https://example.com/img/blog/not-ours.png">x</a>',
      '<img src="/img/avatar/a.jpg">',
    ].join("\n"),
  );
  assert.deepEqual(refs, [
    "img/blog/d/demo.mp4",
    "img/blog/d/poster.png",
    "files/d/guide.pdf",
    "img/blog/d/full.png",
    "img/blog/d/raw.png",
  ]);
});

test("builtAssetRefs reads the published, /blog-prefixed form of a built page", () => {
  assert.deepEqual(
    builtAssetRefs(
      '<img src="/blog/img/d/a.png"><a href="/blog/files/d/g.pdf">x</a><a href="/blog/tags/">t</a>',
    ),
    ["img/d/a.png", "files/d/g.pdf"],
  );
});

test("publishedPath drops the doubled blog from post media and leaves downloads alone", () => {
  assert.equal(publishedPath("img/blog/d/demo.mp4"), "img/d/demo.mp4");
  assert.equal(publishedPath("files/d/guide.pdf"), "files/d/guide.pdf");
});
