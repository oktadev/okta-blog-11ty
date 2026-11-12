import { test } from "node:test";
import assert from "node:assert/strict";
import { prefixAssetPaths } from "../utils/transforms.js";

test("prefixAssetPaths adds /blog to root-relative media, download and script attributes", () => {
  assert.equal(
    prefixAssetPaths(
      `<video src="/img/blog/d/v.mp4" poster='/img/blog/d/p.png'></video><a href="/files/d/g.pdf">x</a><script src="/js/guide/a.js"></script>`,
    ),
    `<video src="/blog/img/d/v.mp4" poster='/blog/img/d/p.png'></video><a href="/blog/files/d/g.pdf">x</a><script src="/blog/js/guide/a.js"></script>`,
  );
});

test("prefixAssetPaths leaves already-prefixed, external and escaped code-sample paths alone", () => {
  const html = [
    '<img src="/blog/img/d/a.webp">',
    '<a href="/blog/tags/">t</a>',
    '<script src="https://example.com/js/a.js"></script>',
    "&lt;script src=&quot;/js/app.js&quot;&gt;",
  ].join("");
  assert.equal(prefixAssetPaths(html), html);
});
