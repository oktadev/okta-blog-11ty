import { minify } from "html-minifier-terser";

const isDev = process.env.ELEVENTY_ENV === "development";

export default function (eleventyConfig) {
  if (isDev) return; // skip minification in dev for speed

  eleventyConfig.addTransform("htmlmin", async function (content) {
    if ((this.page.outputPath || "").endsWith(".html")) {
      return await minify(content, {
        useShortDoctype: true,
        removeComments: true,
        collapseWhitespace: true,
        minifyCSS: true,
        minifyJS: true,
      });
    }
    return content;
  });
}
