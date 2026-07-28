import { minify } from "html-minifier-terser";

const isDev = process.env.ELEVENTY_ENV === "development";

export default function (eleventyConfig) {
  // The macro preprocessor prepends a newline; HTML minification hides it, but the
  // unminified feed needs its <?xml> declaration on the first line to parse.
  eleventyConfig.addTransform("xmlLeadingTrim", function (content) {
    if ((this.page.outputPath || "").endsWith(".xml")) {
      return content.replace(/^\s+/, "");
    }
    return content;
  });

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
