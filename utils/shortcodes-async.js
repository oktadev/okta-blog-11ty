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
  const subdir = src.includes("/")
    ? src.substring(0, src.lastIndexOf("/"))
    : "";
  const outputDir = subdir ? `_site/${dir}/${subdir}` : `_site/${dir}`;
  const urlPath = subdir ? `/${dir}/${subdir}` : `/${dir}`;

  const imgAttributes = header
    ? {
        alt,
        sizes: "1000",
        loading: "lazy",
        decoding: "async",
        class: "social-img",
      }
    : {
        alt,
        sizes,
        loading: "lazy",
        decoding: "async",
      };

  return await Image(`./public/${dir}/${src}`, {
    widths,
    formats: ["webp", "jpeg", "png", "jpg"],
    returnType: "html",
    outputDir,
    urlPath,
    htmlOptions: {
      imgAttributes,
    },
  });
};

export default {
  svg: (args) => svg(args),
  img: (args) => img(args),
};
