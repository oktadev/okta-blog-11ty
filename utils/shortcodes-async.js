import Image from "@11ty/eleventy-img";

const svgIcon = async function (src, alt, widths = [30], sizes = "") {
  return await Image(`./public/img/${src}.svg`, {
    widths,
    formats: ["svg"],
    outputDir: "_site/img/",
    returnType: "html", // new in v6.0
    htmlOptions: {
      imgAttributes: {
        alt, // required, though "" works fine
        sizes, // required with more than one width, optional if single width output
        loading: "lazy", // optional
        decoding: "async", // optional
      },
    },
  });
};

const svg = async function (src, alt, widths = [30], sizes = "") {
  return await Image(`./public/img/blog/${src}.svg`, {
    widths,
    formats: ["svg"],
    outputDir: "_site/img/",
    returnType: "html", // new in v6.0
    htmlOptions: {
      imgAttributes: {
        alt, // required, though "" works fine
        sizes, // required with more than one width, optional if single width output
        loading: "lazy", // optional
        decoding: "async", // optional
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
  sizes = ""
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
    formats: ["jpg"],
    outputDir: "_site/img/",
    returnType: "html",
    htmlOptions: {
      imgAttributes,
    },
  });
};

export default {
  svgIcon: (src, alt, sizes) => svgIcon(src, alt, sizes),
  svg: (src, alt, sizes) => svg(src, alt, sizes),
  img: (src, alt, sizes) => img(src, alt, sizes),
};
