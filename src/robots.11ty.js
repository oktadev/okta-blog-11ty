import { isPreview } from "../utils/base-url.js";

// Deploy previews are publicly reachable, so keep crawlers out of them. This
// complements the `noindex` meta tag: `noindex` is only seen once a crawler
// fetches the page, while `Disallow` stops the fetch.
//
// Production deliberately emits nothing. `developer.okta.com/robots.txt` belongs
// to the wider developer site (it carries the docs team's disallow rules and the
// sitemap index), so publishing one from this repo would overwrite it.
export default class Robots {
  data() {
    return {
      permalink: isPreview ? "/robots.txt" : false,
      eleventyExcludeFromCollections: true,
    };
  }

  render() {
    return [
      "# Deploy preview: not for indexing.",
      "User-agent: *",
      "Disallow: /",
      "",
    ].join("\n");
  }
}
