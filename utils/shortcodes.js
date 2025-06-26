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

  return `<img src="/img/${img}" class="w-${width} list-none rounded-full" />`;
};

const postsListItem = (post, author) => {
  if (post && post.data && author) {
    return `
      <li class="grid gap-3 mb-5 pb-5 border-b-1 border-okta-gravel">
        <div class="grid gap-1">
          <a href="${post.url}">
            <h2>
              ${post.data.title ? post.data.title : `<code>${post.url}</code>`}
            </h2>
          </a>
          <div class="flex gap-1 items-center">
            ${avatar(author.avatar)} |
            <time datetime="${DateTime.fromJSDate(post.date, {
              zone: "utc",
            }).toFormat("yyyy-LL-dd")}">
              ${DateTime.fromJSDate(post.date, { zone: "utc" }).toFormat(
                "dd LLLL yyyy"
              )}
            </time> |
            <p>${readingTime(post.content)}</p>
          </div>
        </div>
        ${post.data.description ? `<div>${post.data.description}</div>` : ""}
      </li>`;
  }
};

const youtube = (id, t, w, h) => {
  const width = w || 560;
  const height = h || 315;
  const title = t || "YouTube video player";

  return `<div class="grid justify-center m-4"><iframe width=${width} height=${height} src="https://www.youtube-nocookie.com/embed/${id}" title="${title}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>`;
};

export default {
  readingTime: (content) => readingTime(content),
  avatar: (img, size) => avatar(img, size),
  postsListItem: (post, author) => postsListItem(post, author),
  youtube: (id) => youtube(id),
};
