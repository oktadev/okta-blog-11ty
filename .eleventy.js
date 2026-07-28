import markdownIt from "markdown-it";
import markdownItAttrs from "markdown-it-attrs";
import markdownItAnchor from "markdown-it-anchor";
import markdownItToc from "markdown-it-table-of-contents";
import * as yaml from "js-yaml";
import { execSync } from "child_process";

import EleventyPluginRss from "@11ty/eleventy-plugin-rss";
import syntaxHighlight from "@11ty/eleventy-plugin-syntaxhighlight";
import EleventyVitePlugin from "@11ty/eleventy-plugin-vite";
import embedTwitter from "eleventy-plugin-embed-twitter";

import filters from "./utils/filters.js";
import transforms from "./utils/transforms.js";
import shortcodes from "./utils/shortcodes.js";
import shortcodesAsync from "./utils/shortcodes-async.js";

export default function (eleventyConfig) {
  eleventyConfig.on("eleventy.before", () => {
    if (process.env.ELEVENTY_ENV !== "production") {
      execSync("npm run css", { stdio: "inherit" });
    }
  });

  eleventyConfig.addWatchTarget("public/css/");

  // Static files (style.css, fonts/, js/) are pre-copied by npm scripts using
  // shell redirection / cp -rn, which avoids EPERM unlink failures on macOS-mounted fs.

  // Pre Processor
  eleventyConfig.addPreprocessor(
    "macro-inject",
    ".njk,.md",
    (_data, content) => {
      return (
        `{% import "src/_macros/index.njk" as macro with context %}\n` + content
      );
    },
  );

  // Plugins
  eleventyConfig.addPlugin(EleventyPluginRss);
  eleventyConfig.addPlugin(syntaxHighlight);
  eleventyConfig.addPlugin(embedTwitter);
  eleventyConfig.addPlugin(transforms);

  // Vite bundles & optimizes the build output, but it breaks on mounted/synced
  // filesystems (EPERM on rm, ENOTEMPTY on rename) like the local dev setup.
  // Opt in only where it's known to work — set USE_VITE=1 in netlify.toml.
  if (process.env.USE_VITE === "1") {
    eleventyConfig.addPlugin(EleventyVitePlugin);
  }

  // Data extensions
  eleventyConfig.addDataExtension("yaml", (contents) => yaml.load(contents));

  // Filters
  eleventyConfig.addPlugin(filters);

  let postsCollection = [];
  eleventyConfig.addCollection("posts", (collectionApi) => {
    postsCollection = collectionApi.getFilteredByGlob(
      "./src/blog/posts/**/*.md",
    );
    return postsCollection;
  });

  // Shortcodes
  Object.keys(shortcodes).forEach((shortcodeName) => {
    eleventyConfig.addNunjucksShortcode(shortcodeName, (...args) =>
      shortcodes[shortcodeName](...args, postsCollection),
    );
  });

  Object.keys(shortcodesAsync).forEach((shortcodeName) => {
    eleventyConfig.addNunjucksAsyncShortcode(shortcodeName, (...args) =>
      shortcodesAsync[shortcodeName](...args, postsCollection),
    );
  });

  // Customize Markdown library and settings:
  const slugify = (s) =>
    s
      .trim()
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-");

  let markdownLibrary = markdownIt({
    html: true,
    breaks: true,
    linkify: true,
  })
    .use(markdownItAnchor, {
      permalink: markdownItAnchor.permalink.headerLink({
        safariReaderFix: true,
        class: "direct-link",
      }),
      slugify,
    })
    .use(markdownItAttrs)
    .use(markdownItToc, {
      includeLevel: [2, 3],
      listType: "ul",
      slugify,
    });
  eleventyConfig.setLibrary("md", markdownLibrary);

  // // Layouts
  eleventyConfig.addLayoutAlias("base", "base.njk");
  eleventyConfig.addLayoutAlias("post", "post.njk");

  // Static files (style.css, fonts/, js/) are pre-copied by npm scripts using
  // shell cp, which avoids EPERM unlink failures on macOS-mounted fs.

  // Per-page bundles, see https://github.com/11ty/eleventy-plugin-bundle
  // Adds the {% css %} paired shortcode
  eleventyConfig.addBundle("css");
  // Adds the {% js %} paired shortcode
  eleventyConfig.addBundle("js", {
    toFileDirectory: "dist",
  });

  return {
    templateFormats: ["md", "njk", "html", "liquid", "11ty.js"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
    passthroughFileCopy: true,
    dir: {
      input: "src",
      // better not use "public" as the name of the output folder (see above...)
      output: "_site",
      includes: "_includes",
      layouts: "layouts",
      data: "_data",
    },
  };
}
