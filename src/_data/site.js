const isDev = process.env.ELEVENTY_ENV === "development";

const baseUrl = isDev ? `localhost:8080` : `https://developer.okta.com/`;

export default {
  title: "Okta Developer Blog",
  description:
    "The Okta Developer Blog is a place for developers to learn about identity, security, and building better applications.",
  baseUrl,
  // Current year, resolved at build time (used in the footer copyright line).
  year: new Date().getFullYear(),
};
