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
