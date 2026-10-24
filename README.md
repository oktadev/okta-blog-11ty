# OktaDev Blog

The Okta Developer Blog, built with [Eleventy](https://www.11ty.dev/). Posts are Markdown files under `src/blog/posts/`, rendered with Nunjucks.

## Contributions

While we are an open project, we're not open to contributions without prior conversation. If you want to contribute to OktaDev blog content, please reach out to us at <dev-advocacy@okta.com>.

PRs are the final step in our editorial process for contributors. PRs created without communication, approval, or outside the editorial process will be closed.

## Getting going

You need Node 24. `.nvmrc` pins it, so `nvm use` (or `fnm use`) selects it, and `package.json` declares it under `engines`, so `npm install` on an older Node prints a warning.

Fork and clone your forked repo, then run `npm ci` to install dependencies. That also enables the repo's git hooks (see [Git hooks and CI](#git-hooks-and-ci)).

Start the server by running `npm start` and open `http://localhost:8080/blog/`.

### Serving the site

| Command         | What it does                                                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm start`     | Dev server with live reload and incremental rebuilds. Builds every post, so the first boot takes a couple of minutes.                                  |
| `npm run dev`   | Same server, but only the newest 25 posts. Nothing is deleted; the rest are skipped for that run. Set `DEV_POSTS` to change the count: `DEV_POSTS=50 npm start`. |
| `npm run build` | Production build into `_site/`. This is what the Build workflow runs and deploys.                                                                       |

### Other npm scripts

| Command            | What it does                                                                                                                                     | When to run it                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `npm run validate` | Checks every post's front matter: YAML parses, `title` and `author` are present, author keys exist in `src/_data/authors.yaml`, `by` is a known role. | Before pushing. The pre-commit hook runs it for you.              |
| `npm run smoke`    | Asserts that every post in `src/blog/posts/` was emitted at its `/blog/YYYY/MM/DD/slug/` URL and that same-day posts order deterministically.    | After `npm run build`. The Build workflow runs it on every push and PR. |
| `npm test`         | `npm run build` followed by `npm run smoke`.                                                                                                     | When you've changed templates, filters, or the Eleventy config.   |
| `npm run css`      | Compiles Tailwind from `public/css/index.css` into `_site/style.css`. `npm start` and `npm run build` call it for you.                            | Rarely by hand.                                                   |
| `npm run format`   | Runs Prettier over JS and JSON. Posts (`src/blog/posts/`) and Nunjucks templates are excluded on purpose, so it never touches code samples.       | The pre-commit hook formats staged files; run this for a sweep.   |
| `npm run post`     | Scaffolds a new post, see below.                                                                                                                 |                                                                   |
| `npm run test:unit` | Runs the `node:test` suites in `test/`: the migration converters, the live-site verifier, the callout renderer, the Prism grammars and the content lint. | After changing anything in `scripts/` or `utils/`. `npm test` runs them before the build. |
| `npm run migrate` | Converts posts from a checkout of the old `okta-blog` repo (`--src ../okta-blog`): Markdown posts get this site's shortcodes and macros, AsciiDoc posts are converted to Markdown. Only posts missing here are written unless you pass `--force`; `--only slug,slug` limits the run and `--dry-run` previews it. Prints a per-post report of anything it could not map. | When a post lands in the old repo, or to re-convert one after it changed there. |
| `npm run verify-migration -- <slug>` | Fetches the post from the live site and compares its prose, code blocks and inline code with the local build in `_site`, reporting anything the live site has that the local page lacks. `--file slugs.txt` checks a list, `--details` prints the pairs. | After `npm run build`, for any post you migrated or re-converted. |
| `npm run upstream-changes` | Lists the posts, images and authors that changed in the old `okta-blog` repo since this site last reconciled with it (the commit recorded in `scripts/upstream-snapshot.txt`), and prints the `migrate` command for them. `--update` records the current commit once the migration is in. | Whenever the old repo gets a new or edited post, see below. |
| `npm run sync-code-blocks` | Splices every fenced code block in `src/blog/posts/` back from its `okta-blog` source, byte for byte, leaving front matter, prose and shortcodes alone (the fence lines keep their local language tag). `--dry-run` lists what would change, `--details` shows the first differing line per block. | If a formatter has touched posts, or after the old repo fixes a code sample. |

Never run a formatter over `src/blog/posts/`: the code samples there are copied byte for byte from the authors' sources, and a formatter rewrites quote styles, indentation and line breaks, which breaks prose that refers to line numbers. `.prettierignore` excludes the posts and `.vscode/settings.json` turns off format-on-save for Markdown; if your editor formats Markdown on save through another extension, turn that off for this repo. `npm run sync-code-blocks` repairs any post that has been reformatted.

### Keeping up with the old repo

Posts are still published in the old `okta-blog` repo first, so this site reconciles with it rather than the other way round. With a checkout of `okta-blog` next to this one:

1. `git -C ../okta-blog pull`, then `npm run upstream-changes`. It lists new posts, changed posts, deleted posts and changed images since the last reconciliation.
2. Run the `npm run migrate -- --force --only …` command it prints. New posts are converted with their images and authors; changed posts are re-converted whole (never edit a migrated post here by hand, the next run would overwrite it). A deleted post is removed here and its redirect checked in `vercel.json`; a replaced image is copied over by hand.
3. `npm run build`, then `npm run verify-migration -- <slugs>` to compare each post with the live site. A post edited upstream that the live site has not redeployed yet will differ there; that is expected.
4. Review the diff, then `npm run upstream-changes -- --update` to record the commit, and open the PR.

## Writing a post

### Creating a post

`npm run post create <post-name>` scaffolds `src/blog/posts/<today>-<post-name>.md` from a front-matter template and creates its image directory at `public/img/blog/<post-name>/`. Pass an ISO date as a third argument to override today's date.

The scaffolded front matter:

```yaml
---
title: ""
author: # key(s) from src/_data/authors.yaml
by: advocate # advocate | contractor | internal-contributor | external-contributor
communities: [] # e.g. java, javascript, .net, go, php, python, security, devops, mobile
description: ""
tags: []
tweets:
image: ""
type: awareness # awareness | conversion
---
```

`title` and `author` are required. `author` is one key or a list of keys from `src/_data/authors.yaml`. `image` is the post's social and hero image, relative to `public/img/blog/`. The post's URL comes from the file name: `2026-01-21-user-entitlements-workshop.md` publishes at `/blog/2026/01/21/user-entitlements-workshop/`.

Two optional keys worth knowing:

- `changelog` renders a "Last Updated" date at the top and a changelog at the bottom. Entries are `{ date: text }` and can be in any order; newest is shown first. Link the PR that updated the post and the PR that updated its example app.

  ```yaml
  changelog:
    - 2020-08-31: Updated the GitHub repo to have proper starter files. Changes to this article can be viewed in [oktadev/okta-blog#392](https://github.com/oktadev/okta-blog/pull/392).
  ```

- `canonical` marks a syndicated post. It must be an absolute `http(s)` URL; it becomes the page's canonical link and adds an "Originally published at" note.

  ```yaml
  canonical: https://auth0.com/blog/full-stack-java-with-react-spring-boot-and-jhipster/
  ```

- `comments: false` leaves the Discourse comment thread off a post. Posts migrated from the old site carry `discourse_topic_id`, which points at their existing forum topic; a post without one gets a topic created from its URL the first time it's viewed in production.

- `updated` (or the legacy `update-url`/`update-title`/`update-extra` keys carried over from migrated posts) renders a dismissible "this post is old" banner at the top, linking to the replacement post. It's shown automatically — no shortcode call needed in the body.

  ```yaml
  updated:
    slug: "post-slug" # file name without the date prefix and .md
    extra: "optional note"
  ```

  ```yaml
  update-url: /blog/2020/06/26/spring-boot-vue-kotlin
  update-title: "Build a CRUD App with Vue.js, Spring Boot, and Kotlin"
  ```

  If the replacement post hasn't been migrated into this repo yet, the banner links straight to `update-url`/`update-title` instead of a resolved post.

### Markdown conventions

- Surround directories and file names with backticks: `filename.txt`, `/src/component/dummy.file`.
- Use inline backticks for short commands: run `npm install` from the command line.
- Bold button and link names: then click **Done**.
- Write function names with parentheses inside backticks: this calls the `render()` method.
- Wrap `http://localhost` URLs in backticks.
- Fenced code blocks are preferred, but four-space indented code blocks render too (Eleventy turns them off by default; this site turns them back on). Footnotes (`[^1]`) render as on the old site, with a bare number as the marker.
- To float an image beside the text, wrap the shortcode: `<span class="float-right ml-4 mb-2">{% img {...} %}</span>`. The migration does this for the old site's `{: .pull-right }` markers.
- Links into developer.okta.com should be relative: `/docs/whatever/` rather than the full URL.
- Posts are rendered by Nunjucks before Markdown, so code that contains `{{ }}` or `{% %}` must sit inside a raw block or the template engine will try to evaluate it:

  ````
  {% raw %}
  ```html
  <span>{{ title }} app is running!</span>
  ```
  {% endraw %}
  ````

- Add a table of contents with `[[toc]]` on its own line. It lists the post's `##` and `###` headings.

### Shortcodes

Shortcodes are `{% name … %}` tags available in every post. Images are the one you'll use most.

**Images.** Put the file in `public/img/blog/<post-name>/` and reference it relative to `public/img/blog/`. Raster images are converted to responsive WebP; SVGs are kept as SVG and sized to the given width.

```njk
{% img {src: "my-post/screenshot.png", alt: "Text for screen readers"} %}
{% img {src: "my-post/diagram.png", alt: "…", header: "600"} %}
```

`header` takes a display width in pixels, or `true` to render at the responsive hero sizes. The post's social `image` from front matter is rendered as the hero automatically, so you don't need to add it to the body.

**Other shortcodes:**

| Shortcode                                                        | Renders                                                                                                                |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `{% youtube "VIDEO-ID" %}`                                       | An embedded YouTube player. Optional title, width and height follow the ID: `{% youtube "8vY-9tXlCW4", "Demo", 900, 506 %}`. |
| `{% speakerdeck "DATA-ID", 600 %}`                               | An embedded Speaker Deck. The ID is the `data-id` from the deck's embed code; the width in pixels is optional.          |
| `{% excerpt "post-slug" %}`                                      | A card linking to another post on this blog, with its title, description and authors. The slug is the file name without the date prefix and `.md`. |
| `{% svg {src: "name", alt: "…", widths: [30]} %}`                | An SVG from `public/img/blog/name.svg`. Add `type: "logo"` or `type: "icon"` to read from `public/img/` instead.       |
| `{% avatar "file.jpg", "small", "Alt text" %}`                   | A round author avatar from `public/img/avatar/`. Sizes: `small`, `medium`, `large`, `xlarge`. Mostly used by templates.  |

**Tweets.** Put the tweet's URL on a line by itself and it's embedded:

```
https://twitter.com/oktadev/status/1460993714227236868
```

### Macros

Macros generate standard blocks of prose. They're available in every post as `macro.<name>()` with no import. The templates live in `src/_macros/`.

| Macro                        | Generates                                                                                                                                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `macro.integrator({ … })`    | Step-by-step Admin Console instructions for creating an OIDC app, plus a link to the matching guide. Takes `type` (`spa`, `web`, `native`, `service`) and optional `framework`, `loginRedirectUri`, `logoutRedirectUri`, `signup`, `install`, `note`, `customAuthServer`. |
| `macro.oidcdebugger()`       | A short paragraph on getting an access token with the OpenID Connect Debugger. Optional `{ responseType: "…" }`, default `code`.                                                                |
| `macro.cli({ … })`           | Okta CLI instructions. Legacy: the Okta CLI was deprecated in May 2025. Don't use it in new posts.                                                                                             |
| `macro.maven()`              | A deprecated Maven-based setup. Legacy, same as above; see #142.                                                                                                                              |

For example:

```njk
{{ macro.integrator({type: "spa", framework: "React", loginRedirectUri: "http://localhost:3000/callback"}) }}
```

Every parameter, with rendered examples for each framework, is documented on the site at [/blog/integrator-setup/](https://developer.okta.com/blog/integrator-setup/). Screenshots of the Admin Console are discouraged because they're hard to keep up to date.

## Site integrations

Two third-party services are wired into every page, and both behave differently outside production:

- **Search** is Coveo, shared with the rest of developer.okta.com. It loads on every page, including `npm start`, and every ID, endpoint and option it uses lives in `public/js/search/config.js`. Read the warnings in that file and in `public/js/search/token.js` before changing anything: the token storage key is shared with the docs site on the same origin.
- **Comments** are Discourse threads on devforum.okta.com, rendered below each post by `src/_includes/comments.njk`. The forum only accepts embeds served from developer.okta.com, so locally and on deploy previews you see the comment policy with a "Comments are disabled outside production" note instead of the thread.

Redirects and the site's security headers live in `vercel.json`.

## Git hooks and CI

`npm ci` (through the `prepare` script) points git at the hooks in `.githooks/`, so they run without any setup:

- **pre-commit** refuses `.DS_Store` files and anything over 5MB, syntax-checks staged JavaScript, formats staged JS and JSON with Prettier, and runs `npm run validate`. Bypass with `git commit --no-verify` only if you know why it failed.
- **pre-push** runs a full `npm run build` so a broken template or filter is caught before CI. Skip it with `SKIP_BUILD=1 git push` when you've just built.

On GitHub, three workflows in `.github/workflows/` cover every push to `main` and every pull request:

- **CI** (`ci.yml`) runs `npm run validate`.
- **Build** (`build.yml`) runs `npm run build` and `npm run smoke`, and uploads the built site. On a push to `main` it deploys that build to production.
- **Deploy Preview** (`preview.yml`) runs after Build finishes for a pull request. It deploys the uploaded site to `https://deploy-preview-<PR number>--okta-blog-11ty.vercel.app`, generating the Vercel routing from the PR's own `vercel.json` so redirect and header changes show on the preview, and links it in a comment on the PR.

## License

Apache 2.0, see [LICENSE](LICENSE).
