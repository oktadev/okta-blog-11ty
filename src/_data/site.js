import { baseUrl, isPreview } from "../../utils/base-url.js";

export default {
  title: "Okta Developer Blog",
  description:
    "The Okta Developer Blog is a place for developers to learn about identity, security, and building better applications.",
  baseUrl,
  isPreview,
  author: "Okta Developer",
  lang: "en",
  // Current year, resolved at build time (used in the footer copyright line).
  year: new Date().getFullYear(),
};
