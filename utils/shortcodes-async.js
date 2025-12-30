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
  return await Image(`./public/img/${src}.svg`, {
    widths,
    formats: ["svg"],
    outputDir: "_site/public/img/",
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

  let imageSrc = `./public/img/blog/${src}`;

  let image;

  const processImage = async (src, formats) => {
    return await Image(src, {
      widths,
      formats,
      outputDir: "_site/public/img/blog",
      returnType: "html",
      htmlOptions: {
        imgAttributes,
      },
    });
  };

  try {
    if (imageSrc.includes(".jpg")) {
      image = await processImage(imageSrc, ["jpg"]);
    } else if (imageSrc.includes(".jpeg")) {
      image = await processImage(imageSrc, ["jpeg"]);
    } else {
      image = await processImage(imageSrc, ["webp", "png"]);
    }
  } catch (error) {
    // If file not found, try alternate jpg/jpeg extension
    if (error.code === "ENOENT") {
      if (imageSrc.includes(".jpeg")) {
        const newImageSrc = imageSrc.replace(".jpeg", ".jpg");
        image = await processImage(newImageSrc, ["jpg"]);
      } else if (imageSrc.includes(".jpg")) {
        const newImageSrc = imageSrc.replace(".jpg", ".jpeg");
        image = await processImage(newImageSrc, ["jpeg"]);
      } else {
        throw error;
      }
    } else {
      throw error;
    }
  }

  return image;
};

export default {
  svgIcon: (src, alt, sizes) => svgIcon(src, alt, sizes),
  svg: (src, alt, sizes) => svg(src, alt, sizes),
  img: (src, alt, sizes) => img(src, alt, sizes),
};
