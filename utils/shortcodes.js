import { readFileSync } from "node:fs";
import { baseUrl } from "./base-url.js";

const closeIcon = readFileSync("src/_includes/icons/close.svg", "utf8")
  .replace(/\s+/g, " ")
  .trim();

// Renders the "this post is old" banner. Built as a single-line string
// (join("")) rather than a multi-line .njk include: markdown-it's HTML-block
// parsing mangles multi-line raw HTML embedded in markdown body content,
// splicing in stray <p></p> tags around nested tag boundaries. See the
// `excerpt` shortcode below for the same workaround.
const update = (updated, postsCollection) => {
  if (!updated) return "";
  const { slug, url, title, extra } = updated;
  // Dated post files that share a slug (e.g. two deploy-dotnet-container-aws-fargate
  // posts from different years) also share a fileSlug, since 11ty strips the date
  // prefix. When we have a full URL (the update-url case), match on that instead of
  // fileSlug so we land on the actual target post rather than whichever same-slug
  // post happens to come first in the collection.
  const post = url
    ? postsCollection.find(
        (p) => p.url.replace(/\/$/, "") === url.replace(/\/$/, ""),
      )
    : postsCollection.find((p) => p.fileSlug === slug);

  const href = post
    ? new URL(post.url, baseUrl).href
    : url
      ? new URL(url, baseUrl).href
      : null;
  const linkTitle = post ? post.data.title : title;

  const updatedLink = href
    ? `<p>For an updated version of this post, ${
        linkTitle
          ? `see <a href="${href}">${linkTitle}</a>`
          : `<a href="${href}">click here</a>`
      }.</p>`
    : "";
  const extraText = extra ? `<p>${extra}</p>` : "";

  return [
    `<div class="py-2 px-5 mb-6 rounded-sm text-page-text bg-brand-notifications-900 border border-brand-notifications-1000" role="alert">`,
    `<div class="flex w-full items-start justify-between gap-3 mb-3">`,
    `<p class="text-lg font-bold">Heads up... this post is old!</p>`,
    `<button type="button" class="shrink-0 -m-1.5 p-1.5 cursor-pointer" aria-label="Close" title="Close" onclick="this.closest('[role=alert]').style.display='none'">${closeIcon}</button>`,
    `</div>`,
    updatedLink,
    extraText,
    `</div>`,
  ].join("");
};

// The id may carry a query string ("abc123?start=60"). Most posts predate the
// shortcode and use 700x394, so that is the default; max-w-full and the
// aspect-ratio keep it from overflowing a narrow screen, as the old
// "max-width: 100%" iframes did.
const youtube = (id, t, w, h) => {
  const width = w || 700;
  const height = h || 394;
  const title = (t || "YouTube video player").replace(/"/g, "&quot;");

  return `<div class="grid justify-center m-4"><iframe class="max-w-full h-auto" style="aspect-ratio: ${width} / ${height}" width="${width}" height="${height}" src="https://www.youtube-nocookie.com/embed/${id}" title="${title}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>`;
};

const speakerdeck = (id, width = 600) => {
  const ratio = 1.78343949044586;
  const height = Math.round(width / ratio);

  return `<div class="grid justify-center m-4"><iframe class="speakerdeck-iframe" style="border: 0px none; background: rgba(0, 0, 0, 0.1) padding-box; margin: 0px; padding: 0px; border-radius: 6px; box-shadow: rgba(0, 0, 0, 0.2) 0px 5px 40px; width: ${width}px; height: ${height}px;" src="https://speakerdeck.com/player/${id}" title="Speaker Deck" allowfullscreen="true" data-ratio="${ratio}" frameborder="0"></iframe></div>`;
};

export default {
  // .eleventy.js appends the posts collection to every shortcode call, so a
  // short call lands it in the title, width or height slot; keep only values
  // an author could have typed.
  youtube: (id, ...rest) => {
    const [t, w, h] = rest.map((v) =>
      typeof v === "string" || typeof v === "number" ? v : undefined,
    );
    return youtube(id, t, w, h);
  },
  speakerdeck: (id, w) => speakerdeck(id, w),
  update: (updated, postsCollection) => update(updated, postsCollection),
};
