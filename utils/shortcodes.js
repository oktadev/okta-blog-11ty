import { DateTime } from "luxon";

const READING_SPEED = 300;

const readingTime = (content) => {
  const sanitizeHtml = content.replace(/<\/?[^>]+(>|$)/g, "");
  const numWords = sanitizeHtml.split(" ").length;
  const minutes = Math.round(numWords / READING_SPEED);
  const text = minutes < 1 ? 1 : minutes;

  return `<div class="px-2 bg-okta-cloud rounded-xl content-center font-bold"><p class="text-xs leading-3 uppercase">${text} min read</p></div>`;
};

const avatar = (img, size = "small") => {
  let width;

  switch (size) {
    case "small":
      width = 5;
      break;
    case "medium":
      width = 12;
      break;
    case "large":
      width = 16;
      break;
  }

  return `<img src="/img/avatar/${img}" class="w-${width} list-none rounded-full" alt="${img}" />`;
};

const postsListItem = (post, authorsList) => {
  if (post && post.data && authorsList) {
    const authorsHtml = Object.values(authorsList)
      .map((author) => {
        return `<a href="/authors/${
          author.slug
        }/" class="inline-flex items-center gap-1">${avatar(author.avatar)} ${
          author.display_name
        }</a>`;
      })
      .filter(Boolean)
      .join("");

    return `
      <li class="grid gap-3 mb-5 pb-5 border-b-1 border-okta-gravel">
      <div class="grid gap-1">
        <a href="${post.url}">
        <h2>
          ${post.data.title ? post.data.title : `<code>${post.url}</code>`}
        </h2>
        </a>
        <div class="flex gap-1 items-center">
        ${authorsHtml}
        |
        <time datetime="${DateTime.fromJSDate(post.date, {
          zone: "utc",
        }).toFormat("yyyy-LL-dd")}">
          ${DateTime.fromJSDate(post.date, { zone: "utc" }).toFormat(
            "dd LLLL yyyy",
          )}
        </time> |
        <p>${readingTime(post.content)}</p>
        </div>
      </div>
      ${post.data.description ? `<p>${post.data.description}</p>` : ""}
      <a href="${post.url}">Read more</a>
      </li>`;
  }
};

const youtube = (id, t, w, h) => {
  const width = w || 560;
  const height = h || 315;
  const title = t || "YouTube video player";

  return `<div class="grid justify-center m-4"><iframe width=${width} height=${height} src="https://www.youtube-nocookie.com/embed/${id}" title="${title}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>`;
};

const speakerdeck = (id, width = 600) => {
  const ratio = 1.78343949044586;
  const height = Math.round(width / ratio);

  return `<div class="grid justify-center m-4"><iframe class="speakerdeck-iframe" style="border: 0px none; background: rgba(0, 0, 0, 0.1) padding-box; margin: 0px; padding: 0px; border-radius: 6px; box-shadow: rgba(0, 0, 0, 0.2) 0px 5px 40px; width: ${width}px; height: ${height}px;" src="https://speakerdeck.com/player/${id}" title="Speaker Deck" allowfullscreen="true" data-ratio="${ratio}" frameborder="0"></iframe></div>`;
};

const excerpt = (stemPath, postsCollection) => {
  const post = postsCollection.find((p) => p.page.fileSlug === stemPath);
  console.log({ post });
  const authorKeys = Array.isArray(post.data.author)
    ? post.data.author
    : [post.data.author];
  const authors = authorKeys
    .map((key) => post.data.authors[key])
    .filter(Boolean);

  if (post) {
    const authorsHtml = authors
      ? authors
          .map((author) => {
            return `<a href="/authors/${author.slug}/" class="inline-flex items-center gap-1">${avatar(author.avatar)} ${author.display_name}</a>`;
          })
          .join("")
      : "";

    return `
      <div class="flex-col border-1 border-solid px-2">
        <a href="${post.url}">${post.data.title}</a>
        <p>${post.data.description}</p>
        <div class="flex-col">${authorsHtml}</div>
      </div>`;
  }
  return "";
};

export default {
  readingTime: (content) => readingTime(content),
  avatar: (img, size) => avatar(img, size),
  postsListItem: (post, author) => postsListItem(post, author),
  youtube: (id, t, w, h) => youtube(id, t, w, h),
  speakerdeck: (id, w) => speakerdeck(id, w),
  excerpt: (stemPath, postsCollection) => excerpt(stemPath, postsCollection),
};
