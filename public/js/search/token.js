// Coveo search-token acquisition.
//
// ⚠️ Never store a value under TOKEN_STORAGE_KEY that isn't a JWT with a numeric
// `exp`. The docs site reads the same key from the same origin. In October 2024
// a 503 response body was written there and search broke across all of
// developer.okta.com for weeks. readExpiry() is the guard against that.

import {
  ORG_ID,
  SEARCH_ENDPOINT,
  TOKEN_ENDPOINT,
  TOKEN_STORAGE_KEY,
} from "./config.js";

// Renew early so an in-flight search can't be rejected mid-request.
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

// Storage can be blocked in two different ways: reading the property throws at
// all (sandboxed iframes), or reading works and only writes throw (Safari
// private browsing, full quota). Both are guarded below.
const storageAvailable = () => {
  try {
    return typeof window !== "undefined" && window.localStorage !== null;
  } catch {
    return false;
  }
};

const readStored = () =>
  storageAvailable() ? window.localStorage.getItem(TOKEN_STORAGE_KEY) : null;

// Caching is best-effort — a failed write must not take search down when we
// already hold a valid token.
const writeStored = (value) => {
  if (!storageAvailable()) return;
  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, value);
  } catch (err) {
    console.warn(`[search] could not cache token: ${err.message}`);
  }
};

const clearStored = () => {
  if (storageAvailable()) window.localStorage.removeItem(TOKEN_STORAGE_KEY);
};

// Throws on anything that isn't a well-formed JWT carrying a numeric exp.
const readExpiry = (token) => {
  const payload = token.split(".")[1];
  if (!payload) throw new Error("not a JWT");

  const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const { exp } = JSON.parse(atob(padded));

  if (typeof exp !== "number") throw new Error("no exp claim");
  return exp;
};

const cachedToken = () => {
  const stored = readStored();
  if (!stored) return null;

  // Some producers return the token JSON-quoted, and quotes break Coveo.
  const token = stored.replace(/"/g, "");

  try {
    if (Date.now() < readExpiry(token) * 1000 - EXPIRY_BUFFER_MS) {
      return token;
    }
  } catch (err) {
    console.warn(`[search] discarding unusable cached token: ${err.message}`);
  }

  // Expired or unparseable — drop it so the docs site doesn't inherit it.
  clearStored();
  return null;
};

const renewToken = async () => {
  const response = await fetch(TOKEN_ENDPOINT);
  if (!response.ok) {
    throw new Error(`token endpoint returned ${response.status}`);
  }

  const { token } = await response.json();
  if (!token) throw new Error("token endpoint returned no token");

  readExpiry(token); // Validate before storing. See the warning above.

  writeStored(token);
  return token;
};

const configureEndpoint = async () => {
  const token = cachedToken() || (await renewToken());

  Coveo.SearchEndpoint.configureCloudV2Endpoint(ORG_ID, token, SEARCH_ENDPOINT, {
    renewAccessToken: renewToken,
  });
};

export default configureEndpoint;
