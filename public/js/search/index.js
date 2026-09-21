// Entry point for site search, loaded as a module from base.njk. Mounts the
// header searchbox only — results are rendered by developer.okta.com/search/.

import { SEARCH_PAGE_URL, componentOptions } from "./config.js";
import configureEndpoint from "./token.js";

// Ad blockers and Firefox strict tracking protection block the Coveo CDN, so
// window.Coveo may never arrive. Poll briefly rather than assuming it's there.
const COVEO_WAIT_MS = 5000;
const COVEO_POLL_MS = 100;

const waitForCoveo = () =>
  new Promise((resolve, reject) => {
    if (window.Coveo) return resolve();

    const deadline = Date.now() + COVEO_WAIT_MS;
    const poll = setInterval(() => {
      if (window.Coveo) {
        clearInterval(poll);
        resolve();
      } else if (Date.now() > deadline) {
        clearInterval(poll);
        reject(new Error("Coveo library did not load"));
      }
    }, COVEO_POLL_MS);
  });

// Hides the dropdown until there's input and something to suggest. The
// has-suggestions-hidden class is styled in public/css/coveo.css; without that
// rule this does nothing.
const SUGGESTION_DELAY_MS = 500;

const registerOmniboxListener = () => {
  const omnibox = document.querySelector(".CoveoOmnibox");
  if (!omnibox) return;

  // Cancelled on every event: without this, clearing the input inside the delay
  // window lets a pending callback reopen an empty dropdown.
  let showTimer = null;

  Coveo.$$(omnibox).on("populateOmniboxSuggestions", (event, args) => {
    const { magicBox } = args.omnibox;
    const { input } = magicBox.displayedResult;

    clearTimeout(showTimer);

    if (input.length === 0) {
      magicBox.element.classList.add("has-suggestions-hidden");
    } else if (magicBox.suggestionsManager.hasSuggestions) {
      showTimer = setTimeout(
        () => magicBox.element.classList.remove("has-suggestions-hidden"),
        SUGGESTION_DELAY_MS,
      );
    }
  });
};

const start = async () => {
  const searchBar = document.querySelector("[data-search-bar]");
  if (!searchBar) return;

  try {
    await waitForCoveo();
    await configureEndpoint();
    registerOmniboxListener();

    Coveo.initSearchbox(searchBar, SEARCH_PAGE_URL, componentOptions);
  } catch (err) {
    // Log rather than fail silently, so a blocked CDN or a dead token endpoint
    // is visible in the console.
    console.warn(`[search] search unavailable: ${err.message}`);
  }
};

start();
