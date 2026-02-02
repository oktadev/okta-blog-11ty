import markdownIt from "markdown-it";
import markdownItAttrs from "markdown-it-attrs";
import markdownItAnchor from "markdown-it-anchor";
import markdownItToc from "markdown-it-table-of-contents";
import tailwindcss from "@tailwindcss/vite";
import yaml from "js-yaml";

import EleventyPluginNavigation from "@11ty/eleventy-navigation";
import EleventyPluginRss from "@11ty/eleventy-plugin-rss";
import syntaxHighlight from "@11ty/eleventy-plugin-syntaxhighlight";
import EleventyVitePlugin from "@11ty/eleventy-plugin-vite";
import eleventyAsciidoc from "eleventy-plugin-asciidoc";
import embedTwitter from "eleventy-plugin-embed-twitter";

import filters from "./utils/filters.js";
import shortcodes from "./utils/shortcodes.js";
import shortcodesAsync from "./utils/shortcodes-async.js";

export default function (eleventyConfig) {
  eleventyConfig.setServerPassthroughCopyBehavior("copy");
  eleventyConfig.addPassthroughCopy({
    "style.out.css": "style.css",
  });

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
  eleventyConfig.addPlugin(EleventyPluginNavigation);
  eleventyConfig.addPlugin(EleventyPluginRss);
  eleventyConfig.addPlugin(syntaxHighlight);
  eleventyConfig.addPlugin(eleventyAsciidoc);
  eleventyConfig.addPlugin(embedTwitter);

  eleventyConfig.addPlugin(EleventyVitePlugin, {
    viteOptions: {
      plugins: [tailwindcss()],
    },
  });

  // Data extensions
  eleventyConfig.addDataExtension("yaml", (contents) => yaml.load(contents));

  // Filters
  eleventyConfig.addPlugin(filters);

  // // Transforms
  // Object.keys(transforms).forEach((transformName) => {
  //   eleventyConfig.addTransform(transformName, transforms[transformName]);

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
    eleventyConfig.addNunjucksAsyncShortcode(
      shortcodeName,
      shortcodesAsync[shortcodeName],
    );
  });

  // Customize Markdown library and settings:
  let markdownLibrary = markdownIt({
    html: true,
    breaks: true,
    linkify: true,
  })
    .use(markdownItAnchor, {
      permalink: markdownItAnchor.permalink.ariaHidden({
        placement: "after",
        class: "direct-link",
        symbol: "#",
        level: [1, 2, 3],
      }),
      slugify: eleventyConfig.getFilter("slug"),
    })
    .use(markdownItAttrs)
    .use(markdownItToc, {
      includeLevel: [1, 2],
      listType: "ul",
    });
  eleventyConfig.setLibrary("md", markdownLibrary);

  // // Layouts
  eleventyConfig.addLayoutAlias("base", "base.njk");
  eleventyConfig.addLayoutAlias("post", "post.njk");

  // // Copy/pass-through files
  // eleventyConfig.addPassthroughCopy("src/assets/css");
  // eleventyConfig.addPassthroughCopy("src/assets/js");
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
