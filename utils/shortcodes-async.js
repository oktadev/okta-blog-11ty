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
const img = async function (
  src,
  alt,
  header = false,
  widths = [100, 300, 600, 1000],
  sizes = "",
) {
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

  return await Image(`./public/img/blog/${src}`, {
    widths,
    formats: ["webp", "jpeg", "png", "jpg"],
    returnType: "html",
    outputDir: `_site/img/blog/${src}`,
    urlPath: `/img/blog/${src}`,
    htmlOptions: {
      imgAttributes,
    },
  });
};

export default {
  svg: ({ src, alt, widths, sizes, type, class: className }) =>
    svg({ src, alt, widths, sizes, type, class: className }),
  img: (src, alt, header, widths, sizes) =>
    img(src, alt, header, widths, sizes),
};
