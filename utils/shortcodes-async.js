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

export default {
  svgIcon: (src, alt, sizes) => svgIcon(src, alt, sizes),
};
