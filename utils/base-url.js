const isDev = process.env.ELEVENTY_ENV === "development";

// No trailing slash so it composes cleanly with paths; preview deploys use the Vercel URL.
export function resolveBaseUrl() {
  if (isDev) return "http://localhost:8080";
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "https://developer.okta.com";
}

export const baseUrl = resolveBaseUrl();
