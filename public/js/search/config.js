// Coveo search configuration. Every Coveo ID, endpoint and URL belongs here.

export const ORG_ID = "oktaproduction9ounvcxa";

export const SEARCH_ENDPOINT = `https://${ORG_ID}.org.coveo.com/rest/search`;
export const ANALYTICS_ENDPOINT = `https://${ORG_ID}.analytics.org.coveo.com/rest`;

export const TOKEN_ENDPOINT =
  "https://wt1ugse0be.execute-api.us-west-2.amazonaws.com/prod/token?site=developer";

// ⚠️ This key and searchHub below are shared with the docs site — same origin,
// same localStorage. Changing one without the other means blog and docs
// overwrite each other's tokens on every navigation between them.
export const TOKEN_STORAGE_KEY = "coveo_token";
export const SEARCH_HUB = "developer-okta-com";

// ⚠️ Must stay absolute. Coveo's redirectToSearchPage() assigns this to an <a>
// and rebuilds the target as `a.protocol + "//" + a.host + a.pathname`, so a
// relative "/search/" would resolve against localhost or the preview host.
export const SEARCH_PAGE_URL = "https://developer.okta.com/search/";

export const componentOptions = {
  Searchbox: {
    enableOmnibox: true,
  },
  Omnibox: {
    // The input reserves 88px for padding, so a longer string truncates at
    // laptop widths.
    placeholder: "Search",
    enableQueryExtensionAddon: true,
    enableQuerySyntax: true,
    triggerQueryOnClear: true,
  },
  Analytics: {
    searchHub: SEARCH_HUB,
    endpoint: ANALYTICS_ENDPOINT,
  },
};
