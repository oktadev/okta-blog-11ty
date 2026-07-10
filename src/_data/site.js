const isDev = process.env.ELEVENTY_ENV === "development";

// Absolute base URL (protocol, no trailing slash) so feed links compose cleanly.
const baseUrl = isDev ? "http://localhost:8080" : "https://developer.okta.com";

export default {
  title: "Okta Developer Blog",
  description:
    "The Okta Developer Blog is a place for developers to learn about identity, security, and building better applications.",
  baseUrl,
  author: "Okta Developer",
  lang: "en",
};
