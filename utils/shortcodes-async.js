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

  const imgAttributes = {
    alt, // required, though "" works fine
    sizes, // required with more than one width, optional if single width output
    loading: "lazy", // optional
    decoding: "async", // optional
  };
  if (className) imgAttributes.class = className;

  return await Image(`./public/${dir}${src}.svg`, {
    widths,
    formats: ["svg"],
    outputDir: `_site/${dir}`,
    urlPath: `/${dir}`,
    returnType: "html", // new in v6.0
    htmlOptions: {
      imgAttributes,
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
  // `class` is reserved, so it can't be destructured under its own name.
  class: className = "",
}) {
  const dir = avatar ? "img/avatar" : "img/blog";

  // A numeric `header` is a width hint migrated from Jekyll's `width:`; render one
  // image at that size. `header: true` (the hero) uses the responsive defaults.
  const headerWidth = header && header !== true ? parseInt(header, 10) : null;
  if (headerWidth) {
    widths = [headerWidth];
    sizes = sizes || `${headerWidth}px`;
  } else if (avatar && widths.length === 4 && widths[0] === 100) {
    widths = [40, 80];
    sizes = sizes || "40px";
  }

  const subdir = src.includes("/")
    ? src.substring(0, src.lastIndexOf("/"))
    : "";
  const outputDir = subdir ? `_site/${dir}/${subdir}` : `_site/${dir}`;
  const urlPath = subdir ? `/${dir}/${subdir}` : `/${dir}`;

  // Keep vector sources as SVG; rasterizing a diagram to WebP blurs its lines
  // and text. Only raster sources go through WebP conversion.
  const isSvg = /\.svg$/i.test(src);

  const imgClass = [avatar ? "" : "mx-auto", className]
    .filter(Boolean)
    .join(" ");

  const imgAttributes = {
    alt,
    sizes,
    loading: "lazy",
    decoding: "async",
    ...(imgClass && { class: imgClass }),
  };

  const classAttr = imgClass
    ? ` class="${imgClass.replace(/"/g, "&quot;")}"`
    : "";

  try {
    if (isSvg) {
      // A vector doesn't rasterize, so copy the SVG through and size the <img>
      // to the requested display width (this matches the pre-migration sizing);
      // height stays proportional. The global `img { max-width: 100% }` rule
      // keeps it responsive.
      const metadata = await Image(`./public/${dir}/${src}`, {
        widths: [null],
        formats: ["svg"],
        outputDir,
        urlPath,
      });
      const { url, width, height } = metadata.svg[0];
      const displayWidth = headerWidth || width;
      const displayHeight = Math.round(displayWidth * (height / width));
      const altAttr = (alt || "").replace(/"/g, "&quot;");
      return `<img${classAttr} src="${url}" alt="${altAttr}" width="${displayWidth}" height="${displayHeight}" loading="lazy" decoding="async">`;
    }

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
  } catch (err) {
    console.warn(`[img] could not process ${dir}/${src}: ${err.message}`);
    const sizesAttr = sizes ? ` sizes="${sizes}"` : "";
    return `<img${classAttr} src="/${dir}/${src}" alt="${alt || ""}"${sizesAttr} loading="lazy" decoding="async">`;
  }
};

const avatar = async function (filename, size = "small", alt = "") {
  let widthClass;
  let avatarSize;

  switch (size) {
    case "xsmall":
      widthClass = "w-8";
      avatarSize = 40;
      break;
    case "small":
      widthClass = "w-10";
      avatarSize = 48;
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

  // eleventy-img only scales by width, so a non-square source stays non-square and
  // `rounded-full` would render an ellipse. Force the box square and crop to fill.
  return result.replace(
    "<img",
    `<img class="${widthClass} aspect-square object-cover list-none rounded-full"`,
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
        const avatarImg = await avatar(author.avatar, "xsmall");
        return `<a href="/blog/authors/${key}/" class="inline-flex items-center gap-2">${avatarImg} ${author.display_name}</a>`;
      }),
    )
  ).join("");

  // Joined with no newlines: markdown-it runs with `breaks: true`, so any line
  // break in returned HTML becomes a <br>.
  return [
    `<div class="flex-col border border-solid border-okta-gravel rounded-sm p-3 not-prose my-9">`,
    `<a class="text-xl" href="${post.url}">${post.data.title}</a>`,
    `<p class="text-content-text my-6">${post.data.description}</p>`,
    `<div class="flex-col flex">${authorsHtml}</div>`,
    `</div>`,
  ].join("");
};

export default {
  svg: (args) => svg(args),
  img: (args) => img(args),
  avatar: (filename, size, alt) => avatar(filename, size, alt),
  excerpt: (stemPath, postsCollection) => excerpt(stemPath, postsCollection),
};
