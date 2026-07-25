const isDev = process.env.ELEVENTY_ENV === "development";

// Absolute base URL (protocol, no trailing slash) so feed links compose cleanly.
// On Vercel preview deploys, use the deployment URL so feed/self links reflect
// the preview domain; local dev and production are fixed.
function resolveBaseUrl() {
  if (isDev) return "http://localhost:8080";
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "https://developer.okta.com";
}

const baseUrl = resolveBaseUrl();

export default {
  title: "Okta Developer Blog",
  description:
    "The Okta Developer Blog is a place for developers to learn about identity, security, and building better applications.",
  baseUrl,
  author: "Okta Developer",
  lang: "en",
};
