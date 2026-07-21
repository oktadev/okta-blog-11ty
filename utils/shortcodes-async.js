import Image from "@11ty/eleventy-img";

const svg = async function ({
  src,
  alt,
  widths = [30],
  sizes = "",
  type = "blog",
  class: className = "",
}) {
  let dir = "img/blog/";
  switch (type) {
    case "logo":
    case "icon":
      dir = "img/";
      break;
    case "blog":
      dir = "img/blog/";
      break;
  }

  return await Image(`./public/${dir}${src}.svg`, {
    widths,
    formats: ["svg"],
    outputDir: `_site/${dir}`,
    urlPath: `/${dir}`,
    returnType: "html", // new in v6.0
    htmlOptions: {
      imgAttributes: {
        alt, // required, though "" works fine
        sizes, // required with more than one width, optional if single width output
        loading: "lazy", // optional
        decoding: "async", // optional
        className,
      },
    },
  });
};

// TODO: allow multiple sizes
const img = async function ({
  src,
  alt,
  avatar = false,
  header = false,
  widths = [100, 300, 600, 1000],
  sizes = "",
}) {
  const dir = avatar ? "img/avatar" : "img/blog";

  if (header) {
    return `<img src="/${dir}/${src}" alt="${alt}" class="social-img" loading="lazy" decoding="async">`;
  }

  if (avatar && widths.length === 4 && widths[0] === 100) {
    widths = [40, 80];
    sizes = sizes || "40px";
  }

  const subdir = src.includes("/")
    ? src.substring(0, src.lastIndexOf("/"))
    : "";
  const outputDir = subdir ? `_site/${dir}/${subdir}` : `_site/${dir}`;
  const urlPath = subdir ? `/${dir}/${subdir}` : `/${dir}`;

  const imgAttributes = {
    alt,
    sizes,
    loading: "lazy",
    decoding: "async",
  };

  return await Image(`./public/${dir}/${src}`, {
    widths,
    formats: ["webp"],
    returnType: "html",
    outputDir,
    urlPath,
    htmlOptions: {
      imgAttributes,
    },
  });
};

const avatar = async function (filename, size = "small", alt = "") {
  let widthClass;
  let avatarSize;

  switch (size) {
    case "small":
      widthClass = "w-5";
      avatarSize = 40;
      break;
    case "medium":
      widthClass = "w-12";
      avatarSize = 96;
      break;
    case "large":
      widthClass = "w-16";
      avatarSize = 128;
      break;
    case "xlarge":
      widthClass = "w-24";
      avatarSize = 192;
      break;
  }

  const result = await img({
    src: filename,
    alt,
    avatar: true,
    widths: [avatarSize, avatarSize * 2],
    sizes: `${avatarSize}px`,
  });

  return result.replace(
    "<img",
    `<img class="${widthClass} list-none rounded-full"`,
  );
};

// Async so it can reuse the (async) avatar shortcode for optimized, resized
// WebP avatars instead of a raw full-size <img>. Receives postsCollection from
// the async shortcode registration in .eleventy.js.
const excerpt = async function (stemPath, postsCollection) {
  const post = postsCollection.find((p) => p.page.fileSlug === stemPath);
  if (!post) return "";

  const authorKeys = Array.isArray(post.data.author)
    ? post.data.author
    : [post.data.author];

  const authorsHtml = (
    await Promise.all(
      authorKeys.map(async (key) => {
        const author = post.data.authors[key];
        if (!author) return "";
        const avatarImg = await avatar(
          author.avatar,
          "small",
          author.display_name,
        );
        return `<a href="/blog/authors/${key}/" class="inline-flex items-center gap-1">${avatarImg} ${author.display_name}</a>`;
      }),
    )
  ).join("");

  return `
    <div class="flex-col border-1 border-solid px-2">
      <a href="${post.url}">${post.data.title}</a>
      <p>${post.data.description}</p>
      <div class="flex-col">${authorsHtml}</div>
    </div>`;
};

export default {
  svg: (args) => svg(args),
  img: (args) => img(args),
  avatar: (filename, size, alt) => avatar(filename, size, alt),
  excerpt: (stemPath, postsCollection) => excerpt(stemPath, postsCollection),
};
