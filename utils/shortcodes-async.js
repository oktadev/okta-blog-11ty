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

  // For header/social images, don't process - keep original format for social platform compatibility
  if (header) {
    return `<img src="/${dir}/${src}" alt="${alt}" class="social-img" loading="lazy" decoding="async">`;
  }

  // For avatars, use passed-in widths or default to small size
  if (avatar && widths.length === 4 && widths[0] === 100) {
    // Default widths weren't overridden, use avatar defaults
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
  }

  // Use the img shortcode with avatar-specific parameters
  const result = await img({
    src: filename,
    alt,
    avatar: true,
    widths: [avatarSize, avatarSize * 2], // Standard and retina
    sizes: `${avatarSize}px`,
  });

  // Add rounded-full class for avatar styling
  return result.replace(
    "<img",
    `<img class="${widthClass} list-none rounded-full"`,
  );
};

export default {
  svg: (args) => svg(args),
  img: (args) => img(args),
  avatar: (filename, size, alt) => avatar(filename, size, alt),
};
