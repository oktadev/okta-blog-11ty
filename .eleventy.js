import { markdownLibrary } from "./utils/markdown.js";
import * as yaml from "js-yaml";
import { readdirSync } from "node:fs";
import { execSync } from "child_process";

import EleventyPluginRss from "@11ty/eleventy-plugin-rss";
import syntaxHighlight from "@11ty/eleventy-plugin-syntaxhighlight";
import EleventyVitePlugin from "@11ty/eleventy-plugin-vite";
import embedTwitter from "eleventy-plugin-embed-twitter";

import Prism from "prismjs";
import loadLanguages from "prismjs/components/index.js";
import { register as registerLanguages } from "./utils/prism-languages.js";
import { renderCallouts } from "./utils/callouts.js";

import filters from "./utils/filters.js";
import transforms from "./utils/transforms.js";
import shortcodes from "./utils/shortcodes.js";
import shortcodesAsync from "./utils/shortcodes-async.js";

registerLanguages(Prism);

function prismKnows(lang) {
  if (Prism.languages[lang]) return true;
  try {
    loadLanguages([lang]);
  } catch {
    return false;
  }
  return Boolean(Prism.languages[lang]);
}

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

  // The syntax highlight plugin returns fences tagged `text`, or with a
  // language Prism doesn't know, unescaped, so a "<token>" in such a sample
  // becomes HTML. Wrap its highlighter and register the wrapper the same way
  // the plugin does: Eleventy re-applies the registered highlighter every time
  // it constructs a Markdown engine but runs amendLibrary only once, so a
  // wrapper installed through amendLibrary was lost by a later construction
  // mid-build and posts rendered after it lost their escaping.
  const prismHighlight = eleventyConfig.markdownHighlighter;
  eleventyConfig.addMarkdownHighlighter((str, lang) => {
    const name = (lang || "").split("/")[0];
    if (name && name !== "text" && prismKnows(name))
      return renderCallouts(prismHighlight(str, lang));
    const cls = ` class="language-${name || "text"}"`;
    return `<pre${cls}><code${cls}>${renderCallouts(markdownLibrary.utils.escapeHtml(str))}</code></pre>`;
  });
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

  // DEV_POSTS=<n> builds only the newest n posts, so the dev server boots in
  // seconds instead of processing every post.
  if (process.env.DEV_POSTS) {
    const POSTS_DIR = "src/blog/posts";
    const keep = Number(process.env.DEV_POSTS);
    // Date-prefixed filenames sort chronologically, so the tail is the newest.
    const posts = readdirSync(POSTS_DIR)
      .filter((file) => file.endsWith(".md"))
      .sort();
    for (const file of posts.slice(0, Math.max(0, posts.length - keep))) {
      eleventyConfig.ignores.add(`${POSTS_DIR}/${file}`);
    }
  }

  let postsCollection = [];
  eleventyConfig.addCollection("posts", (collectionApi) => {
    postsCollection = collectionApi.getFilteredByGlob(
      "./src/blog/posts/**/*.md",
    );
    return postsCollection;
  });

  // Communities: a browsable taxonomy over the `communities` front matter that
  // 643 posts already carry. The allowlist below is the whole contract — it
  // supplies the URL slug and the display label, and anything absent from it
  // (one-off values like `design`, or the stray `announcement`) is left out.
  // Slugs are explicit rather than slugified because ".net" would otherwise
  // become "net" implicitly; here that mapping is at least visible.
  const COMMUNITIES = [
    { name: "javascript", slug: "javascript", label: "JavaScript" },
    { name: "java", slug: "java", label: "Java" },
    { name: ".net", slug: "net", label: ".NET" },
    { name: "security", slug: "security", label: "Security" },
    { name: "devops", slug: "devops", label: "DevOps" },
    { name: "mobile", slug: "mobile", label: "Mobile" },
    { name: "php", slug: "php", label: "PHP" },
    { name: "python", slug: "python", label: "Python" },
    { name: "go", slug: "go", label: "Go" },
    { name: "ruby", slug: "ruby", label: "Ruby" },
  ];

  eleventyConfig.addCollection("communities", (collectionApi) => {
    const posts = collectionApi.getFilteredByGlob("./src/blog/posts/**/*.md");

    return COMMUNITIES.map((community) => ({
      ...community,
      // Trimmed because a few posts write `communities: [ java ]` with padding.
      posts: posts.filter((post) =>
        (post.data.communities || [])
          .map((value) => String(value).trim().toLowerCase())
          .includes(community.name),
      ),
    })).filter((community) => community.posts.length > 0);
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

  // Use the shared Markdown library (see utils/markdown.js).
  markdownLibrary.linkify.set({ fuzzyLink: false });
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
