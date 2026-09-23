const isDev = process.env.ELEVENTY_ENV === "development";

export const PRODUCTION_ORIGIN = "https://developer.okta.com";

// No trailing slash so it composes cleanly with paths; preview deploys use the Vercel URL.
export function resolveBaseUrl() {
  if (isDev) return "http://localhost:8080";
  // Deploy previews are built in CI and only the finished _site is handed to
  // Vercel, so VERCEL_URL isn't set at build time. CI passes the preview host
  // in explicitly instead.
  if (process.env.SITE_BASE_URL) {
    return process.env.SITE_BASE_URL.trim().replace(/\/+$/, "");
  }
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return PRODUCTION_ORIGIN;
}

export const baseUrl = resolveBaseUrl();

// A preview deploy is any non-dev build not serving the production host. Used to
// keep previews out of search results.
export const isPreview = !isDev && baseUrl !== PRODUCTION_ORIGIN;
