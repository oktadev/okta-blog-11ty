import { baseUrl, isPreview, PRODUCTION_ORIGIN } from "../../utils/base-url.js";

export default {
  title: "Okta Developer Blog",
  description:
    "The Okta Developer Blog is a place for developers to learn about identity, security, and building better applications.",
  baseUrl,
  isPreview,
  // Not the inverse of isPreview: that's false in dev too, which would switch
  // production-only third-party embeds on at localhost.
  isProduction: baseUrl === PRODUCTION_ORIGIN,
  productionOrigin: PRODUCTION_ORIGIN,
  author: "Okta Developer",
  twitter: "@oktadev",
  lang: "en",
  // Current year, resolved at build time (used in the footer copyright line).
  year: new Date().getFullYear(),
};
