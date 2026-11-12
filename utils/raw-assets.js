// Files a post references by plain path instead of through the img shortcode:
// videos, posters, PDFs, an occasional raw <img>. They live under
// public/img/blog like the images but are not produced by eleventy-img, so the
// migration copies them from the old repo and the build copies them to _site.
// Served from public/img/blog (media next to a post's images) or public/files
// (the old repo's downloads). As an HTML attribute, quoted in the posts and
// unquoted once the minifier has been over a built page, or as a Markdown link.
const RAW_REF =
  /\b(?:src|href|poster)=(?:['"]\/((?:img\/blog|files)\/[^'"#?]+)['"]|\/((?:img\/blog|files)\/[^\s>'"#?]+))|\]\(\/((?:img\/blog|files)\/[^)\s#?]+)\)/g;

// The referenced paths, relative to public/, in order of first use.
export function rawAssetRefs(text) {
  const refs = new Set();
  for (const m of text.matchAll(RAW_REF)) refs.add(m[1] ?? m[2] ?? m[3]);
  return [...refs];
}

// public/img/blog/<post>/x is published as /blog/img/<post>/x: the build folder
// already sits under /blog, so the second "blog" would be noise.
export function publishedPath(ref) {
  return ref.replace(/^img\/blog\//, "img/");
}

// The same references as they appear in a built page, where the transform has
// moved them under /blog and flattened img/blog to img. Returns paths relative
// to the published root (_site/blog).
const BUILT_REF =
  /\b(?:src|href|poster)=(?:['"]\/blog\/((?:img|files)\/[^'"#?]+)['"]|\/blog\/((?:img|files)\/[^\s>'"#?]+))/g;

export function builtAssetRefs(html) {
  const refs = new Set();
  for (const m of html.matchAll(BUILT_REF)) refs.add(m[1] ?? m[2]);
  return [...refs];
}
